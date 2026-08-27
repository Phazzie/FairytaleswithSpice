// Created: 2026-08-27 02:55 UTC

/**
 * State-snapshot construction and merge logic, extracted out of
 * `storyLabEngine.ts`: turning a genesis blueprint or a fresh batch of
 * chapters into the next `StoryStateSnapshot`/`StoryStateDelta` the next
 * continuation request is built from. Pure functions of the previous state
 * and the chapters just generated — no AI calls, no route handling.
 */

import type {
  CharacterProfile,
  ChapterDelta,
  GeneratedChapter,
  LoreArtifact,
  PlotThread,
  StoryGenerationSeam as LabGenerationSeam,
  StoryStateDelta,
  StoryStateSnapshot
} from './contracts';
import { collapseWhitespace } from '../utils/whitespace';

const WORLD_ARTIFACT_MAX_NAME_WORDS = 4;

export function buildStateSnapshot(
  input: LabGenerationSeam['input'] | undefined,
  storyId: string,
  chapters: GeneratedChapter[],
  previousState: StoryStateSnapshot | null,
  now: string
): StoryStateSnapshot {
  const revision = previousState ? previousState.revision + 1 : 1;
  const generatedCharacters = input ? buildInitialCharacters(storyId, input) : [];
  const generatedThreads = input ? buildInitialThreads(storyId, input) : [];
  const generatedArtifacts = input?.worldDetails ? [buildWorldArtifact(storyId, input.worldDetails)] : [];
  const previousBeats = previousState?.beats ?? [];
  const previousSpicyLevel = previousBeats.length
    ? previousBeats[previousBeats.length - 1]?.spicyLevel
    : undefined;

  return {
    storyId,
    revision,
    characters: mergeUniqueById(previousState?.characters ?? [], [
      ...generatedCharacters,
      ...chapters.flatMap(chapter => chapter.delta.introducedCharacters)
    ]),
    threads: mergeThreads(previousState?.threads ?? generatedThreads, chapters),
    artifacts: mergeUniqueById(previousState?.artifacts ?? [], [
      ...generatedArtifacts,
      ...chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts)
    ]),
    beats: [
      ...(previousState?.beats ?? []),
      ...chapters.map(chapter => ({
        id: `${storyId}-beat-${chapter.chapterNumber}`,
        chapterNumber: chapter.chapterNumber,
        summary: chapter.summary,
        beatType: chapter.chapterNumber === 1 ? 'inciting_incident' as const : 'rising_action' as const,
        tensionLevel: Math.min(5, 2 + (chapter.chapterNumber % 4)) as 1 | 2 | 3 | 4 | 5,
        spicyLevel: input?.spicyLevel ?? previousSpicyLevel ?? 3
      }))
    ],
    continuityWarnings: uniqueStrings([
      ...(previousState?.continuityWarnings ?? []),
      ...chapters.flatMap(chapter => chapter.delta.continuityFlags)
    ]),
    narrativeVoice: input?.tone?.split('_').join(' ') ?? previousState?.narrativeVoice ?? 'dark romance',
    lastUpdatedAt: now
  };
}

function buildInitialCharacters(storyId: string, input: LabGenerationSeam['input']): CharacterProfile[] {
  const protagonistName = input.protagonistName?.trim() || `${capitalize(input.creature)} protagonist`;
  const antagonistName = input.antagonistName?.trim();
  const protagonistId = `${storyId}-protagonist`;
  const antagonistId = `${storyId}-antagonist`;
  const characters: CharacterProfile[] = [
    {
      id: protagonistId,
      displayName: protagonistName,
      archetype: 'protagonist',
      summary: `${protagonistName} anchors the ${input.creature} story promised by the blueprint.`,
      currentGoal: input.logline,
      internalConflict: 'Desire and self-protection pull in opposite directions.',
      externalConflict: antagonistName || 'The supernatural world resists the romance.',
      secrets: [],
      relationships: antagonistName ? [{
        characterId: antagonistId,
        relationship: 'rival',
        notes: `${antagonistName} pressures ${protagonistName} into a costly choice.`
      }] : [],
      spiceCompatibilities: [input.spicyLevel]
    }
  ];

  if (antagonistName) {
    characters.push({
      id: antagonistId,
      displayName: antagonistName,
      archetype: 'antagonist',
      summary: 'An opposing force named in the Story Lab blueprint.',
      currentGoal: 'Pressure the protagonist into a costly choice.',
      internalConflict: 'Their own desire complicates the threat they represent.',
      externalConflict: input.logline,
      secrets: [],
      relationships: [{
        characterId: protagonistId,
        relationship: 'rival',
        notes: `${protagonistName} can expose or refuse the costly choice.`
      }],
      spiceCompatibilities: [input.spicyLevel]
    });
  }

  return characters;
}

function buildInitialThreads(storyId: string, input: LabGenerationSeam['input']): PlotThread[] {
  const themeThreads = input.themes.length
    ? input.themes.map((theme, index) => ({
        id: `${storyId}-thread-${index + 1}`,
        label: theme.label,
        status: 'active' as const,
        description: theme.description,
        foreshadowedDevices: [],
        lifetime: 'series' as const
      }))
    : [];

  return themeThreads.length ? themeThreads : [{
    id: `${storyId}-thread-1`,
    label: 'Central romance',
    status: 'active',
    description: input.logline,
    foreshadowedDevices: [],
    lifetime: 'series'
  }];
}

function buildWorldArtifact(storyId: string, worldDetails: string): LoreArtifact {
  return {
    id: `${storyId}-world-details`,
    name: deriveWorldArtifactName(worldDetails),
    significance: worldDetails,
    introducedInChapter: 1,
    lifetime: 'series'
  };
}

function deriveWorldArtifactName(worldDetails: string): string {
  const compacted = collapseWhitespace(worldDetails).replace(/[.!?]+$/g, '').trim();
  const whereMatch = compacted.match(/\bwhere\s+(.+?)(?:\s+(?:record|records|rule|rules|bind|binds|hold|holds|keep|keeps|hide|hides|guard|guards|demand|demands|remember|remembers|change|changes|cost|costs|make|makes)\b|$)/i);
  if (whereMatch?.[1]) {
    return formatWorldArtifactName(whereMatch[1]);
  }

  const byMatch = compacted.match(/\b(?:ruled|bound|guarded|haunted|recorded|kept|protected)\s+by\s+(.+?)(?:[.,;:]|$)/i);
  if (byMatch?.[1]) {
    return formatWorldArtifactName(byMatch[1]);
  }

  const withoutArticle = compacted.replace(/^(?:a|an|the)\s+/i, '');
  const beforeRelation = withoutArticle.split(/\b(?:where|ruled by|bound by|guarded by|with|whose|that)\b/i)[0] ?? withoutArticle;
  return formatWorldArtifactName(beforeRelation);
}

function formatWorldArtifactName(value: string): string {
  const cleaned = value
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, WORLD_ARTIFACT_MAX_NAME_WORDS);
  if (!words.length) {
    return 'World Texture';
  }

  return words.map(formatWorldArtifactWord).join(' ');
}

function formatWorldArtifactWord(word: string): string {
  return word.split('-').map(capitalize).join('-');
}

export function buildChapterDelta(
  storyId: string,
  chapterNumber: number,
  batchSize: number,
  hasCliffhanger: boolean
): ChapterDelta {
  const continuityFlags = batchSize > 1 && chapterNumber % batchSize === 0
    ? [`Review Chapter ${chapterNumber} ending for payoff before expanding the next batch.`]
    : [];

  return {
    introducedCharacters: [],
    resolvedThreads: [],
    escalatedThreads: hasCliffhanger ? [`${storyId}-thread-1`] : [],
    foreshadowedArtifacts: [],
    continuityFlags
  };
}

export function buildStateDelta(
  storyId: string,
  fromState: StoryStateSnapshot | null,
  toState: StoryStateSnapshot,
  chapters: GeneratedChapter[]
): StoryStateDelta {
  const addedChapterNumbers = chapters.map(chapter => chapter.chapterNumber);

  return {
    storyId,
    fromRevision: fromState?.revision ?? null,
    toRevision: toState.revision,
    addedChapterNumbers,
    introducedCharacters: chapters.flatMap(chapter => chapter.delta.introducedCharacters),
    updatedCharacters: [],
    resolvedThreads: uniqueStrings(chapters.flatMap(chapter => chapter.delta.resolvedThreads)),
    escalatedThreads: toState.threads.filter(thread =>
      chapters.some(chapter => chapter.delta.escalatedThreads.includes(thread.id))
    ),
    foreshadowedArtifacts: chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts),
    continuityWarnings: uniqueStrings(chapters.flatMap(chapter => chapter.delta.continuityFlags)),
    beatIds: addedChapterNumbers.map(chapterNumber => `${storyId}-beat-${chapterNumber}`),
    summary: `Added chapter${addedChapterNumbers.length === 1 ? '' : 's'} ${addedChapterNumbers.join(', ')} from the real story engine.`
  };
}

/**
 * `buildStateDelta` (below) already reports `resolvedThreads` straight from
 * each chapter's own delta — this is where that same signal needs to land in
 * the persisted snapshot, so a thread the delta calls resolved doesn't keep
 * reading as unresolved (`continuationGuidance.ts`'s `isUnresolvedThread`)
 * forever after. `mockData.ts`'s `applyChapterDeltas` already merges this
 * exact way; this mirrors it rather than inventing a second shape.
 */
function mergeThreads(existingThreads: PlotThread[], chapters: GeneratedChapter[]): PlotThread[] {
  const escalatedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.escalatedThreads));
  const resolvedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.resolvedThreads));
  return existingThreads.map(thread => {
    if (resolvedThreadIds.has(thread.id)) {
      return { ...thread, status: 'resolved' as const };
    }
    if (escalatedThreadIds.has(thread.id) && thread.status !== 'resolved') {
      return { ...thread, status: 'escalating' as const };
    }
    return thread;
  });
}

function mergeUniqueById<T extends { id: string }>(existing: T[], additions: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of additions) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}
