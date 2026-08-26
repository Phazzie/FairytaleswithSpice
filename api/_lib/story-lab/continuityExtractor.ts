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
import { XaiTextClient } from '../services/xaiTextClient';
import { getXaiFastTimeoutMs } from '../config/xaiConfig';
import { STORY_LAB_MIN_AI_CONTINUITY_TIMEOUT_MS } from './continuityBudget';
import { stripMarkdownJsonFence } from '../utils/modelJsonPayload';
import { stripStoryHtmlToText } from '../utils/storyTextBlocks';
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
    const warning = !input.useAi
      ? 'AI continuity extraction disabled for this run.'
      : !client.hasApiKey()
        ? 'Continuity is using local heuristic extraction because XAI_API_KEY is not configured.'
        : 'AI continuity extraction skipped because the request budget was nearly exhausted.';

    return {
      state: input.currentState,
      receipt: {
        source: 'heuristic',
        extractedAt: now,
        confidence: 0.55,
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
      allowFallback: false
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
    const warning = 'Continuity used fallback extraction for this batch because Grok continuity extraction was unavailable.';

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
        confidence: 0.45,
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
      relationships: Array.isArray(candidate.relationships) ? candidate.relationships as CharacterProfile['relationships'] : previous?.relationships ?? [],
      spiceCompatibilities: Array.isArray(candidate.spiceCompatibilities) ? candidate.spiceCompatibilities as CharacterProfile['spiceCompatibilities'] : previous?.spiceCompatibilities ?? [3]
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
  return value === 'protagonist' || value === 'antagonist' || value === 'supporting' || value === 'narrator'
    ? value
    : undefined;
}

function normalizeThreadStatus(value: unknown): PlotThread['status'] | undefined {
  return value === 'active' || value === 'escalating' || value === 'resolved' || value === 'dormant'
    ? value
    : undefined;
}

function normalizeStoryMemoryLifetime(value: unknown): PlotThread['lifetime'] | undefined {
  return value === 'scene' || value === 'chapter' || value === 'series'
    ? value
    : undefined;
}

function stringOr(candidate: unknown, fallback: string | undefined, defaultValue: string): string {
  return isNonEmptyString(candidate) ? candidate.trim() : fallback ?? defaultValue;
}

function arrayOfStrings(candidate: unknown, fallback: string[] | undefined): string[] {
  return Array.isArray(candidate)
    ? uniqueStrings(candidate.filter(isNonEmptyString).map(item => item.trim()))
    : fallback ?? [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

