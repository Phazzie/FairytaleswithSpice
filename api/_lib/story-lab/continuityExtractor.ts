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

interface ContinuityExtractionInput {
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

interface AiContinuityShape {
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

  if (!input.useAi || !client.hasApiKey() || timeoutMs <= 0) {
    const warning = !client.hasApiKey()
      ? 'Continuity is using local heuristic extraction because XAI_API_KEY is not configured.'
      : !input.useAi
        ? 'AI continuity extraction disabled for this run.'
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

function buildContinuityPrompt(input: ContinuityExtractionInput): string {
  const chapterText = input.chapters
    .map(chapter => [
      `CHAPTER ${chapter.chapterNumber}: ${chapter.title}`,
      htmlToText(chapter.htmlContent).slice(0, 2200)
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

function stripMarkdownJsonFence(content: string): string {
  let text = content.trim();

  if (!text.startsWith('```')) {
    return text;
  }

  const firstLineBreakIndex = text.indexOf('\n');
  if (firstLineBreakIndex === -1) {
    return text.slice(3).trim();
  }

  text = text.slice(firstLineBreakIndex + 1).trim();
  if (text.endsWith('```')) {
    text = text.slice(0, -3).trim();
  }

  return text;
}

function mergeAiContinuity(
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

function slugId(prefix: string, value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}`;
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

function htmlToText(html: string): string {
  let text = '';
  let insideTag = false;
  let previousWasSpace = false;

  for (const character of html) {
    if (character === '<') {
      insideTag = true;
      appendSpace();
      continue;
    }

    if (character === '>') {
      insideTag = false;
      appendSpace();
      continue;
    }

    if (insideTag) {
      continue;
    }

    if (isWhitespaceCharacter(character)) {
      appendSpace();
      continue;
    }

    text += character;
    previousWasSpace = false;
  }

  return text.trim();

  function appendSpace() {
    if (!previousWasSpace) {
      text += ' ';
      previousWasSpace = true;
    }
  }
}

function isWhitespaceCharacter(character: string): boolean {
  return character === ' '
    || character === '\n'
    || character === '\r'
    || character === '\t'
    || character === '\f'
    || character === '\v';
}
