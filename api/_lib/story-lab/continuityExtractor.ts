import { createHash } from 'node:crypto';
import type {
  CharacterProfile,
  ContinuityExtractionReceipt,
  GeneratedChapter,
  LoreArtifact,
  PlotThread,
  StoryGenerationSeam,
  StoryStateSnapshot,
  StorySummary
} from './contracts';
import { SPICY_LEVELS } from './contracts';
import {
  CHARACTER_ARCHETYPES,
  PLOT_THREAD_STATUSES,
  RELATIONSHIP_KINDS,
  STORY_MEMORY_LIFETIMES,
  isVocabularyMember
} from '../../../shared/storyStateVocabulary';
import { XaiTextClient } from '../services/xaiTextClient';
import { getXaiFastTimeoutMs } from '../config/xaiConfig';
import { STORY_LAB_MIN_AI_CONTINUITY_TIMEOUT_MS } from './continuityBudget';
import { stripMarkdownJsonFence } from '../utils/modelJsonPayload';
import { stripStoryHtmlToText } from '../../../shared/storyTextBlocks';
import { capAtWordBoundary } from '../utils/textExcerpt';

/**
 * How much of each chapter the continuity extractor is shown, in code points.
 * Unchanged from the `slice(0, 2200)` it replaces.
 */
const CONTINUITY_CHAPTER_EXCERPT_MAX_LENGTH = 2200;

export interface ContinuityExtractionInput {
  storyId: string;
  currentState: StoryStateSnapshot;
  chapters: GeneratedChapter[];
  summary: StorySummary;
  blueprint?: StoryGenerationSeam['input'];
  useAi: boolean;
  timeoutMs?: number;
  /**
   * The route's correlation id, for the provider call below.
   *
   * This is the *second* paid provider call a successful Story Lab generation
   * makes, after the chapters themselves. `XaiTextClient` logs every call's
   * start, latency, and failure through `request.context`, and this one passed
   * none — so a generation whose chapters were correlated correctly still had
   * its continuity call, and the timeout or provider error that most often
   * degrades a batch, recorded under no request at all.
   */
  requestId?: string;
}

interface ContinuityExtractionResult {
  state: StoryStateSnapshot;
  receipt: ContinuityExtractionReceipt;
}

export interface AiContinuityShape {
  characters?: Partial<CharacterProfile>[];
  threads?: Partial<PlotThread>[];
  artifacts?: Partial<LoreArtifact>[];
  continuityWarnings?: string[];
  suggestedNarrativeVoice?: string;
  confidence?: number;
}

export async function extractContinuity(input: ContinuityExtractionInput): Promise<ContinuityExtractionResult> {
  const now = new Date().toISOString();
  const client = new XaiTextClient();
  const timeoutMs = input.timeoutMs ?? getXaiFastTimeoutMs();

  if (!input.useAi || !client.hasApiKey() || timeoutMs < STORY_LAB_MIN_AI_CONTINUITY_TIMEOUT_MS) {
    // There is no heuristic extraction path in this file — this branch is a
    // pure passthrough of `input.currentState`, so the warning has to say
    // that plainly rather than imply some lesser analysis ran. A model that
    // ran and merged nothing new is a fact worth telling the reader who sees
    // this string verbatim in `app.html`'s story-memory panel.
    const warning = !input.useAi
      ? 'AI continuity extraction disabled for this run — the character, thread, and artifact list did not update this batch.'
      : !client.hasApiKey()
        ? 'Continuity tracking is unavailable because XAI_API_KEY is not configured — the character, thread, and artifact list did not update this batch.'
        : 'AI continuity extraction skipped because the request budget was nearly exhausted — the character, thread, and artifact list did not update this batch.';

    return {
      state: input.currentState,
      receipt: {
        source: 'heuristic',
        extractedAt: now,
        // No facts were extracted, so there is nothing to be confident about
        // — a nonzero value here previously implied a lesser-quality analysis
        // had run when none had.
        confidence: 0,
        warning
      }
    };
  }

  try {
    const response = await client.generateText({
      operation: 'continuity_extraction',
      system: [
        'You extract serial-story continuity facts for a supernatural romance writing app.',
        'Return only valid JSON. Do not include Markdown fences.',
        'Keep arrays compact. Preserve existing ids when they are provided.',
        'Do not invent cloud persistence, audio state, or facts not supported by the chapters.'
      ].join(' '),
      user: buildContinuityPrompt(input),
      maxOutputTokens: 1200,
      temperature: 0.2,
      topP: 0.9,
      timeoutMs,
      modelPreference: 'fast',
      allowFallback: false,
      // Named as its own endpoint rather than the route's: this call is made
      // from inside a generation, and a reader following one correlation id
      // through the log should be able to tell the continuity call apart from
      // the chapter calls that precede it.
      context: input.requestId
        ? {
            requestId: input.requestId,
            endpoint: 'story-lab/continuity-extraction',
            method: 'POST'
          }
        : undefined
    });

    const aiShape = parseContinuityJson(response.text);
    const state = mergeAiContinuity(input.currentState, aiShape, now);

    return {
      state,
      receipt: {
        source: 'ai',
        extractedAt: now,
        confidence: clampConfidence(aiShape.confidence),
        warning: undefined
      }
    };
  } catch (error) {
    // Same passthrough as the skip branch above, on a provider error instead
    // of a skip: `characters`/`threads`/`artifacts` are unchanged, only
    // `continuityWarnings` and `lastUpdatedAt` move. Say so rather than
    // calling it "fallback extraction", which claims an analysis this catch
    // block never performs.
    const warning = 'Grok continuity extraction failed for this batch — the character, thread, and artifact list did not update.';

    return {
      state: {
        ...input.currentState,
        continuityWarnings: uniqueStrings([
          ...input.currentState.continuityWarnings,
          warning
        ]),
        lastUpdatedAt: now
      },
      receipt: {
        source: 'mixed',
        extractedAt: now,
        // No facts were extracted here either — see the skip branch above.
        confidence: 0,
        warning
      }
    };
  }
}

/**
 * Exported so the chapter rendering the model is actually shown can be asserted
 * on directly, the way `readGeneratedImageUrl` is in the image service. The
 * alternative is reaching it through `extractContinuity`, which needs a
 * configured provider and would prove nothing about the prompt either way.
 */
export function buildContinuityPrompt(input: ContinuityExtractionInput): string {
  const chapterText = input.chapters
    .map(chapter => [
      `CHAPTER ${chapter.chapterNumber}: ${chapter.title}`,
      // The chapter arrives as the generator's HTML. A local stripper deleted
      // the tags and joined everything with single spaces, which left the
      // paragraph structure out of the prompt and — because it decoded nothing
      // — put `&amp;` and `&quot;` in front of the model as literal entity
      // text, so the continuity facts were extracted from prose no reader ever
      // saw. `stripStoryHtmlToText` is the rendering the cliffhanger, image,
      // and story-quality scanners already read.
      //
      // Capped in code points rather than in code units: `.slice(0, 2200)` could
      // cut between the halves of a surrogate pair and hand the model a lone
      // surrogate — `JSON.stringify` escapes it rather than refusing it, so the
      // prompt was simply built with a character the chapter never held — and
      // cut mid-word wherever else it landed.
      capAtWordBoundary(stripStoryHtmlToText(chapter.htmlContent), CONTINUITY_CHAPTER_EXCERPT_MAX_LENGTH)
    ].join('\n'))
    .join('\n\n');

  return JSON.stringify({
    task: 'Update serial continuity state after the latest Story Lab batch.',
    requiredJsonShape: {
      characters: 'array of CharacterProfile-like objects',
      threads: 'array of PlotThread-like objects',
      artifacts: 'array of LoreArtifact-like objects',
      continuityWarnings: 'array of concise warnings',
      suggestedNarrativeVoice: 'short description',
      confidence: 'number from 0 to 1'
    },
    // The four closed fields of those objects, named to the model that is being
    // asked to fill them.
    //
    // `mergeAiContinuity` checks each of these against its vocabulary and
    // *drops* a value that is not in it, keeping whatever the state already
    // held — so a model answering `archetype: "love_interest"`, `status:
    // "open"`, `lifetime: "arc"`, or `relationship: "mentor"` has its
    // continuity fact discarded in silence, and the reader sees a character
    // whose archetype never changed and a thread whose status never moved.
    // Nothing in this prompt had ever told it otherwise: `requiredJsonShape`
    // named the object types and stopped, and `existingState` below shows
    // values only for the entities the story already has. Sending the tables
    // costs a few dozen tokens and is read from the same lists the merge checks
    // against, so the two cannot disagree.
    allowedValues: {
      'characters[].archetype': CHARACTER_ARCHETYPES,
      'characters[].spiceCompatibilities[]': SPICY_LEVELS,
      'characters[].relationships[].relationship': RELATIONSHIP_KINDS,
      'threads[].status': PLOT_THREAD_STATUSES,
      'threads[].lifetime and artifacts[].lifetime': STORY_MEMORY_LIFETIMES
    },
    existingState: {
      characters: input.currentState.characters,
      threads: input.currentState.threads,
      artifacts: input.currentState.artifacts,
      narrativeVoice: input.currentState.narrativeVoice,
      continuityWarnings: input.currentState.continuityWarnings
    },
    summary: input.summary,
    blueprint: input.blueprint ? {
      creature: input.blueprint.creature,
      tone: input.blueprint.tone,
      logline: input.blueprint.logline,
      protagonistName: input.blueprint.protagonistName,
      antagonistName: input.blueprint.antagonistName,
      themes: input.blueprint.themes.map(theme => theme.label),
      worldDetails: input.blueprint.worldDetails
    } : undefined,
    latestChapters: chapterText
  });
}

function parseContinuityJson(content: string): AiContinuityShape {
  const jsonText = stripMarkdownJsonFence(content);

  const parsed = JSON.parse(jsonText) as unknown;
  const data = parsed && typeof parsed === 'object'
    ? parsed as AiContinuityShape
    : {};

  return {
    characters: Array.isArray(data.characters) ? data.characters : [],
    threads: Array.isArray(data.threads) ? data.threads : [],
    artifacts: Array.isArray(data.artifacts) ? data.artifacts : [],
    continuityWarnings: Array.isArray(data.continuityWarnings) ? data.continuityWarnings : [],
    suggestedNarrativeVoice: typeof data.suggestedNarrativeVoice === 'string' ? data.suggestedNarrativeVoice : undefined,
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined
  };
}

/**
 * Fold one model answer into the continuity state.
 *
 * Exported for the same reason `buildContinuityPrompt` is: this is where the
 * answer becomes the state the next continuation is built from, and reaching it
 * through `extractContinuity` needs a configured provider that would prove
 * nothing about the merge either way.
 */
export function mergeAiContinuity(
  currentState: StoryStateSnapshot,
  aiShape: AiContinuityShape,
  now: string
): StoryStateSnapshot {
  return {
    ...currentState,
    characters: mergeCharacters(currentState.characters, aiShape.characters ?? []),
    threads: mergeThreads(currentState.threads, aiShape.threads ?? []),
    artifacts: mergeArtifacts(currentState.artifacts, aiShape.artifacts ?? []),
    continuityWarnings: uniqueStrings([
      ...currentState.continuityWarnings,
      ...(aiShape.continuityWarnings ?? []).filter(isNonEmptyString)
    ]),
    narrativeVoice: aiShape.suggestedNarrativeVoice?.trim() || currentState.narrativeVoice,
    lastUpdatedAt: now
  };
}

function mergeCharacters(existing: CharacterProfile[], incoming: Partial<CharacterProfile>[]): CharacterProfile[] {
  const byId = new Map(existing.map(character => [character.id, character]));

  for (const candidate of incoming) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const id = isNonEmptyString(candidate.id) ? candidate.id : slugId('character', candidate.displayName);
    if (!id || !isNonEmptyString(candidate.displayName)) {
      continue;
    }

    const previous = byId.get(id);
    byId.set(id, {
      id,
      displayName: candidate.displayName,
      archetype: normalizeArchetype(candidate.archetype) ?? previous?.archetype ?? 'supporting',
      summary: stringOr(candidate.summary, previous?.summary, 'Character continuity extracted from the latest chapter.'),
      currentGoal: stringOr(candidate.currentGoal, previous?.currentGoal, 'Pursue the central story desire.'),
      internalConflict: stringOr(candidate.internalConflict, previous?.internalConflict, 'Desire conflicts with self-protection.'),
      externalConflict: stringOr(candidate.externalConflict, previous?.externalConflict, 'The supernatural world resists easy resolution.'),
      secrets: arrayOfStrings(candidate.secrets, previous?.secrets),
      relationships: relationshipEdges(candidate.relationships, previous?.relationships),
      spiceCompatibilities: spiceLevels(candidate.spiceCompatibilities, previous?.spiceCompatibilities)
    });
  }

  return Array.from(byId.values());
}

function mergeThreads(existing: PlotThread[], incoming: Partial<PlotThread>[]): PlotThread[] {
  const byId = new Map(existing.map(thread => [thread.id, thread]));

  for (const candidate of incoming) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const id = isNonEmptyString(candidate.id) ? candidate.id : slugId('thread', candidate.label);
    if (!id || !isNonEmptyString(candidate.label)) {
      continue;
    }

    const previous = byId.get(id);
    byId.set(id, {
      id,
      label: candidate.label,
      status: normalizeThreadStatus(candidate.status) ?? previous?.status ?? 'active',
      description: stringOr(candidate.description, previous?.description, 'Active thread extracted from the latest chapter.'),
      foreshadowedDevices: arrayOfStrings(candidate.foreshadowedDevices, previous?.foreshadowedDevices),
      lifetime: normalizeStoryMemoryLifetime(candidate.lifetime) ?? previous?.lifetime
    });
  }

  return Array.from(byId.values());
}

function mergeArtifacts(existing: LoreArtifact[], incoming: Partial<LoreArtifact>[]): LoreArtifact[] {
  const byId = new Map(existing.map(artifact => [artifact.id, artifact]));

  for (const candidate of incoming) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const id = isNonEmptyString(candidate.id) ? candidate.id : slugId('artifact', candidate.name);
    if (!id || !isNonEmptyString(candidate.name)) {
      continue;
    }

    const previous = byId.get(id);
    byId.set(id, {
      id,
      name: candidate.name,
      significance: stringOr(candidate.significance, previous?.significance, 'Unresolved story artifact.'),
      introducedInChapter: typeof candidate.introducedInChapter === 'number' ? candidate.introducedInChapter : previous?.introducedInChapter,
      resolvedInChapter: typeof candidate.resolvedInChapter === 'number' ? candidate.resolvedInChapter : previous?.resolvedInChapter,
      lifetime: normalizeStoryMemoryLifetime(candidate.lifetime) ?? previous?.lifetime
    });
  }

  return Array.from(byId.values());
}

function normalizeArchetype(value: unknown): CharacterProfile['archetype'] | undefined {
  return isVocabularyMember(CHARACTER_ARCHETYPES, value) ? value : undefined;
}

function normalizeThreadStatus(value: unknown): PlotThread['status'] | undefined {
  return isVocabularyMember(PLOT_THREAD_STATUSES, value) ? value : undefined;
}

function normalizeStoryMemoryLifetime(value: unknown): PlotThread['lifetime'] | undefined {
  return isVocabularyMember(STORY_MEMORY_LIFETIMES, value) ? value : undefined;
}

function stringOr(candidate: unknown, fallback: string | undefined, defaultValue: string): string {
  return isNonEmptyString(candidate) ? candidate.trim() : fallback ?? defaultValue;
}

/**
 * Read a list of free-text facts a model proposed — a character's secrets, a
 * thread's foreshadowed devices.
 *
 * `relationshipEdges` and `spiceLevels` below both distinguish an array that
 * arrives *empty* from an array whose entries were all refused, and their notes
 * say why: the first is the model reporting that there is nothing here, which is
 * a fact it is allowed to report; the second is the model trying to report
 * something and getting the shape wrong, which is not a reason to believe what
 * was already recorded is gone. This function is the third array reader in the
 * merge and it was the one still storing the empty list the filter produced.
 *
 * Nothing here refuses a plain string, so the case looks unreachable until you
 * remember what these entries actually are. `secrets` and `foreshadowedDevices`
 * are lists of short prose, and a model asked for them answers in the shape it
 * finds natural: `[{"secret": "She was there that night"}]`, `[["the pact"]]`,
 * or a single `null` where it had nothing for one slot. Every one of those
 * satisfies `Array.isArray`, survives nothing, and cleared the character's real
 * secrets — the extraction that was supposed to add a fact deleted several, and
 * the next continuation prompt was built from a character who had never kept
 * anything from anyone.
 *
 * The same rule as its two siblings, then: entries that arrive and are all
 * refused fall back; `[]` still clears.
 */
function arrayOfStrings(candidate: unknown, fallback: string[] | undefined): string[] {
  if (!Array.isArray(candidate)) {
    return fallback ?? [];
  }

  const values = uniqueStrings(candidate.filter(isNonEmptyString).map(item => item.trim()));

  return values.length || candidate.length === 0 ? values : fallback ?? [];
}

// Exported for `storyLabEngine.ts`'s own read of `storyState.characters`/
// `.threads` when building `continuityState` for the continuation seam — a
// request-supplied `storyState` is only ever truthy-checked at the route
// boundary, never schema-validated, so an array that passes `Array.isArray`
// can still hold an entry whose `displayName`/`description`/`label` is
// missing, empty, or not a string at all.
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Read the relationship edges a model proposed for a character.
 *
 * Every other field on the merged profile is normalized — `normalizeArchetype`
 * for the archetype, `stringOr` for the prose, `arrayOfStrings` for the secrets
 * — and these two arrays were asserted instead: `candidate.relationships as
 * CharacterProfile['relationships']`. `Array.isArray` was the whole check, so
 * the array's *contents* were whatever the model wrote. A cast is not a
 * validation, and this is model output arriving through `JSON.parse`: the entry
 * can be `null`, a bare name string, or an object missing the fields the type
 * says are there, and every one of those is stored in the story state and
 * handed to both trees that read it.
 *
 * The API tree already knows this. `getCharacterRelationships` in
 * `continuationGuidance.ts` re-filters the same array on every read — object,
 * string `characterId`, string `relationship` — which is a guard that only
 * needs to exist because what it reads was never checked. The Angular tree has
 * no such guard: `buildContinuityRelationshipPreviewItem` in `app.ts` iterates
 * `character.relationships` and reads `relationship.characterId` straight off
 * each entry, so a `null` in the array is a `TypeError` thrown while rendering
 * the continuity panel, and a plain string is an edge that silently matches no
 * character and vanishes from the preview.
 *
 * Checking it once here is what makes the stored state match its own type, so
 * neither reader has to re-derive the guarantee — and the reader that never did
 * stops being the one that pays for it. `relationship` is checked against the
 * five kinds the contract lists rather than against `typeof === 'string'`,
 * because the union is what the type promises and a model that answers
 * `"mentor"` is proposing a kind this app has no reading for; `notes` is
 * required by the type and defaults to empty rather than being left `undefined`
 * under a declaration that says it is a string.
 *
 * An array whose entries are *all* refused falls back rather than storing the
 * empty list the filter produced. Dropping the bad edge is right; letting the
 * drop take the character's real relationships with it is not, and that is what
 * happened: a model answering the single edge `{characterId, relationship:
 * "mentor"}` cleared a `lover` edge the story had actually established, because
 * `Array.isArray` was satisfied and nothing survived the filter. `spiceLevels`
 * below already reads this way and its note says why; this is the same rule for
 * the array beside it.
 *
 * An array that arrives *empty* still clears, and the difference is the point.
 * `[]` is the model saying this character has no relationships, which is a fact
 * it is allowed to report; an array with entries in it is the model trying to
 * report relationships and getting the vocabulary wrong, which is not a reason
 * to believe the ones already recorded are gone.
 */
function relationshipEdges(
  candidate: unknown,
  fallback: CharacterProfile['relationships'] | undefined
): CharacterProfile['relationships'] {
  if (!Array.isArray(candidate)) {
    return fallback ?? [];
  }

  const edges = candidate.flatMap(entry => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const edge = entry as Partial<CharacterProfile['relationships'][number]>;
    if (!isNonEmptyString(edge.characterId) || !isVocabularyMember(RELATIONSHIP_KINDS, edge.relationship)) {
      return [];
    }

    return [{
      characterId: edge.characterId.trim(),
      relationship: edge.relationship,
      notes: typeof edge.notes === 'string' ? edge.notes.trim() : ''
    }];
  });

  return edges.length || candidate.length === 0 ? edges : fallback ?? [];
}

/**
 * Read the spice levels a model proposed a character is written for.
 *
 * The same cast as above, over a `SpicyLevel[]` — the `1 | 2 | 3 | 4 | 5` union
 * the whole app is dialled in. `[0]`, `[9]`, and `["3"]` all satisfied
 * `Array.isArray` and were stored as levels, under a declaration saying they
 * cannot be. Levels outside the union are dropped rather than clamped: a model
 * that answers `9` has not said "5", it has said something this scale does not
 * express, and inventing the nearest legal value would record a compatibility
 * the extraction never claimed.
 *
 * The `[3]` default is unchanged — the middle of the scale, for a character the
 * model gave no compatibility for at all — but it now also answers an array
 * that held nothing usable, which previously stored an empty list where the
 * type says there is at least a default.
 */
function spiceLevels(
  candidate: unknown,
  fallback: CharacterProfile['spiceCompatibilities'] | undefined
): CharacterProfile['spiceCompatibilities'] {
  if (!Array.isArray(candidate)) {
    return fallback ?? [3];
  }

  // `SPICY_LEVELS` rather than a sixth spelling of `1 | 2 | 3 | 4 | 5`: the
  // scale has had a table since the blueprint pickers were given one, and this
  // was the last reader in the repository still comparing against the numbers
  // by hand.
  const levels = Array.from(new Set(
    candidate.filter((level): level is CharacterProfile['spiceCompatibilities'][number] =>
      (SPICY_LEVELS as readonly number[]).includes(level))
  ));

  return levels.length ? levels : fallback ?? [3];
}

/**
 * Derive the id a character, thread, or artifact is merged under when the model
 * did not supply one.
 *
 * The id is the merge key: `mergeCharacters` and its siblings keep one entry per
 * id, so two different names sharing an id are not two entries but one, the
 * second overwriting the first. `[^a-z0-9]+` deleted every character outside
 * ASCII, so a cast named in any other script produced no slug body at all and
 * every one of them collapsed onto the bare prefix — `Мира`, `美咲`, and `Ελένη`
 * all merged into `character-`, and the continuity state the next continuation
 * prompt is built from carried a single character wearing whichever name the
 * model happened to mention last. Threads and artifacts merged the same way.
 *
 * Matching Unicode letters and numbers keeps those names distinct and legible in
 * the id. A name written entirely in punctuation or emoji still leaves nothing
 * to slug, so its id falls back to a digest of the name — unreadable, but
 * distinct, which is the property the merge actually depends on. The cap is
 * applied over code points so it cannot cut an astral character in half.
 *
 * Letters and numbers are not the whole of a word, though.
 * `shared/storyDownloadFilename.ts` cites this function as the reading it was
 * modelled on and then names two things it has to do differently, and both of
 * them are things this one was getting wrong:
 *
 * - **A combining mark is not a letter**, so every mark was read as a separator
 *   and the word it belongs to was cut apart at each one. `मेरी कहानी` slugged to
 *   `म-र-कह-न` and `เรื่องของฉัน` to `เร-องของฉ-น` — the vowels and tone marks
 *   deleted, hyphens left where they had been. That is the same collapse the
 *   ASCII-only pattern caused, one step in: not every such name becomes the bare
 *   prefix, but names that differ only in their marks now share an id, and the
 *   merge keeps one entry for both.
 * - **The same name has two spellings.** `é` and `e` + U+0301 are different
 *   strings, so a model that wrote `José` decomposed in one batch and
 *   precomposed in the next produced two ids for one character — and the merge,
 *   which exists to fold a re-mentioned character back into the entry it already
 *   has, instead carried two half-populated copies of them into the prompt the
 *   next continuation is built from. Normalizing is what makes the two spellings
 *   one key; the digest fallback is normalized for the same reason.
 *
 * Retaining marks is right for a mark attached to a letter and wrong for one
 * left on its own — an emoji's variation selector is a nonspacing mark, so `❤️`
 * split into a part holding nothing but the selector. So a part counts only if
 * it has a letter or number in it, and the finished slug is checked the same way
 * because the cap can leave a tail of only the leading marks of a part it cut
 * into. A name with nothing else in it still reaches the digest.
 */
function slugId(prefix: string, value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  const name = value.normalize('NFC').trim();
  // Splitting on the unsupported runs and joining the parts back collapses each
  // run and drops the leading and trailing ones in a single linear pass, the way
  // the export filename stem is built. Trimming them with `/^-+|-+$/` instead is
  // quadratic on a long run of separators.
  const parts = name
    .toLowerCase()
    .split(SLUG_SEPARATOR_PATTERN)
    .filter(part => SLUG_PART_HAS_WORD_CHARACTER.test(part));
  // The cap counts code points, so an astral character is kept whole or dropped
  // whole, and it can strand at most the one separator the join left behind.
  const slug = Array.from(parts.join('-'))
    .slice(0, SLUG_ID_MAX_LENGTH)
    .join('')
    .replace(/-$/, '');

  return `${prefix}-${SLUG_PART_HAS_WORD_CHARACTER.test(slug) ? slug : digestName(name)}`;
}

const SLUG_ID_MAX_LENGTH = 48;
const SLUG_SEPARATOR_PATTERN = /[^\p{L}\p{N}\p{M}]+/u;
const SLUG_PART_HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;

function digestName(name: string): string {
  return createHash('sha256').update(name, 'utf8').digest('hex').slice(0, 12);
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.7;
  }

  return Math.max(0, Math.min(1, value));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

