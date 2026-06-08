// Created: 2025-10-29 08:27 UTC

import {
  ApiEnvelope,
  ChapterBatchSize,
  ChapterDelta,
  CharacterProfile,
  GeneratedChapter,
  LoreArtifact,
  PlotThread,
  StoryContinuationSeam,
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryStateDelta,
  StoryStateSnapshot,
  StorySummary
} from './contracts';
import { randomUUID } from 'node:crypto';
import { getTransientStorySnapshot, persistStoryIteration } from './stateStore';

let storyRevisionCounter = 1;
let chapterIdCounter = 1;

function createSummary(storyId: string, logline: string): StorySummary {
  const now = new Date().toISOString();
  return {
    storyId,
    title: `The ${logline.split(' ')[0] || 'Crimson'} Chronicles`,
    synopsis: logline,
    tone: 'dark_romance',
    spicyLevel: 3,
    createdAt: now,
    updatedAt: now
  };
}

function createProtagonist(storyId: string): CharacterProfile {
  return {
    id: `${storyId}-protagonist`,
    displayName: 'Selene of the Velvet Court',
    archetype: 'protagonist',
    summary: 'A cunning envoy balancing desire and duty.',
    currentGoal: 'Protect the mortal she loves without sparking war.',
    internalConflict: 'Craves belonging yet resents the court that owns her.',
    externalConflict: 'A political marriage demands her loyalty.',
    secrets: ['Carries a forbidden rune that binds her heart.'],
    relationships: [],
    spiceCompatibilities: [2, 3, 4]
  };
}

function createMortalBeloved(storyId: string): CharacterProfile {
  return {
    id: `${storyId}-mortal-beloved`,
    displayName: 'Rowan Vale',
    archetype: 'supporting',
    summary: 'A mortal scholar whose forbidden research draws the courts into conflict.',
    currentGoal: 'Decode the oath scroll before the rival court claims it.',
    internalConflict: 'Wants the truth but fears becoming leverage against Selene.',
    externalConflict: 'Hunted by envoys who need the scroll destroyed.',
    secrets: ['Recognizes the crimson signet from a childhood vision.'],
    relationships: [
      {
        characterId: `${storyId}-protagonist`,
        relationship: 'lover',
        notes: 'Drawn to Selene despite knowing her court may execute them both.'
      }
    ],
    spiceCompatibilities: [2, 3]
  };
}

function createRivalEmissary(storyId: string): CharacterProfile {
  return {
    id: `${storyId}-rival-emissary`,
    displayName: 'Marcellus Nightbloom',
    archetype: 'antagonist',
    summary: 'An elegant rival emissary who weaponizes etiquette and old debts.',
    currentGoal: 'Force Selene to betray the mortal alliance.',
    internalConflict: 'Still honors a vow he pretends to have forgotten.',
    externalConflict: 'The court expects public victory before the next moonrise.',
    secrets: ['Knows who forged the broken oath scroll.'],
    relationships: [
      {
        characterId: `${storyId}-protagonist`,
        relationship: 'rival',
        notes: 'Their rivalry carries unresolved attraction and political danger.'
      }
    ],
    spiceCompatibilities: [3, 4]
  };
}

function createBaseThread(storyId: string, batchSize: ChapterBatchSize): PlotThread {
  return {
    id: `${storyId}-thread-1`,
    label: 'Forbidden diplomacy pact',
    status: batchSize > 1 ? 'escalating' : 'active',
    description: 'A secret alliance between rival courts threatens to collapse.',
    foreshadowedDevices: ['Crimson signet ring', 'Broken oath scroll'],
    lifetime: 'series'
  };
}

function createSignetArtifact(storyId: string): LoreArtifact {
  return {
    id: `${storyId}-artifact-ring`,
    name: 'Crimson Signet Ring',
    significance: 'Unlocks the sealed crypt beneath the court.',
    introducedInChapter: 1,
    lifetime: 'series'
  };
}

function createOathScroll(storyId: string, chapterNumber: number): LoreArtifact {
  return {
    id: `${storyId}-artifact-oath-scroll`,
    name: 'Broken Oath Scroll',
    significance: 'Records the pact that can bind or free both courts.',
    introducedInChapter: chapterNumber,
    lifetime: 'chapter'
  };
}

function createBaseState(storyId: string, batchSize: ChapterBatchSize): StoryStateSnapshot {
  const now = new Date().toISOString();
  return {
    storyId,
    revision: storyRevisionCounter++,
    characters: [createProtagonist(storyId)],
    threads: [createBaseThread(storyId, batchSize)],
    artifacts: [createSignetArtifact(storyId)],
    beats: [],
    continuityWarnings: [],
    narrativeVoice: 'Velvet noir',
    lastUpdatedAt: now
  };
}

function createChapterDelta(storyId: string, chapterNumber: number, batchSize: ChapterBatchSize): ChapterDelta {
  let introducedCharacters: CharacterProfile[] = [];
  if (chapterNumber === 1) {
    introducedCharacters = [createMortalBeloved(storyId)];
  } else if (chapterNumber === 2) {
    introducedCharacters = [createRivalEmissary(storyId)];
  }

  let foreshadowedArtifacts: LoreArtifact[] = [];
  if (chapterNumber === 1) {
    foreshadowedArtifacts = [createSignetArtifact(storyId)];
  } else if (chapterNumber === 2) {
    foreshadowedArtifacts = [createOathScroll(storyId, chapterNumber)];
  }

  const continuityFlags = batchSize === 3 && chapterNumber % 3 === 0
    ? [`Chapter ${chapterNumber} should pay off one planted court secret before adding another.`]
    : [];

  return {
    introducedCharacters,
    resolvedThreads: chapterNumber >= 6 ? [`${storyId}-thread-1`] : [],
    escalatedThreads: chapterNumber >= 2 ? [`${storyId}-thread-1`] : [],
    foreshadowedArtifacts,
    continuityFlags
  };
}

function createChapter(storyId: string, chapterNumber: number, batchSize: ChapterBatchSize): GeneratedChapter {
  const id = `chapter-${chapterIdCounter++}`;
  const cliffhanger = chapterNumber % Math.max(2, batchSize) === 0;
  const delta = createChapterDelta(storyId, chapterNumber, batchSize);
  return {
    chapterId: id,
    chapterNumber,
    title: `Chapter ${chapterNumber}: Midnight Reverie`,
    htmlContent: `<p>Chapter ${chapterNumber} unfurls in candlelit intrigue and whispered vows.</p>`,
    rawContent: `<p>Chapter ${chapterNumber} unfurls in candlelit intrigue and whispered vows.</p>`,
    summary: 'Passion collides with political duty beneath a bleeding moon.',
    wordCount: 850,
    hasCliffhanger: cliffhanger,
    delta
  };
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

function applyChapterDeltas(
  state: StoryStateSnapshot,
  chapters: GeneratedChapter[],
  revision: number = state.revision
): StoryStateSnapshot {
  const introducedCharacters = chapters.flatMap(chapter => chapter.delta.introducedCharacters);
  const foreshadowedArtifacts = chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts);
  const escalatedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.escalatedThreads));
  const resolvedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.resolvedThreads));
  const continuityWarnings = uniqueStrings([
    ...state.continuityWarnings,
    ...chapters.flatMap(chapter => chapter.delta.continuityFlags)
  ]);
  const now = new Date().toISOString();

  return {
    ...state,
    revision,
    characters: mergeUniqueById(state.characters, introducedCharacters),
    threads: state.threads.map(thread => {
      if (resolvedThreadIds.has(thread.id)) {
        return { ...thread, status: 'resolved' as const };
      }
      if (escalatedThreadIds.has(thread.id) && thread.status !== 'resolved') {
        return { ...thread, status: 'escalating' as const };
      }
      return thread;
    }),
    artifacts: mergeUniqueById(state.artifacts, foreshadowedArtifacts),
    beats: [
      ...state.beats,
      ...chapters.map(chapter => ({
        id: `${state.storyId}-beat-${chapter.chapterNumber}`,
        chapterNumber: chapter.chapterNumber,
        summary: chapter.summary,
        beatType: chapter.chapterNumber === 1 ? 'inciting_incident' as const : 'rising_action' as const,
        tensionLevel: Math.min(5, 2 + (chapter.chapterNumber % 4)) as 1 | 2 | 3 | 4 | 5,
        spicyLevel: 3 as const
      }))
    ],
    continuityWarnings,
    lastUpdatedAt: now
  };
}

function buildStateDelta(
  storyId: string,
  fromState: StoryStateSnapshot | null,
  toState: StoryStateSnapshot,
  chapters: GeneratedChapter[]
): StoryStateDelta {
  const introducedCharacters = mergeUniqueById([], chapters.flatMap(chapter => chapter.delta.introducedCharacters));
  const foreshadowedArtifacts = mergeUniqueById([], chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts));
  const escalatedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.escalatedThreads));
  const escalatedThreads = toState.threads.filter(thread => escalatedThreadIds.has(thread.id));
  const resolvedThreads = uniqueStrings(chapters.flatMap(chapter => chapter.delta.resolvedThreads));
  const continuityWarnings = uniqueStrings(chapters.flatMap(chapter => chapter.delta.continuityFlags));
  const beatIds = chapters.map(chapter => `${storyId}-beat-${chapter.chapterNumber}`);

  const updatedCharacters = fromState
    ? toState.characters.filter(character => {
        const previous = fromState.characters.find(existing => existing.id === character.id);
        return previous ? JSON.stringify(previous) !== JSON.stringify(character) : false;
      })
    : [];

  return {
    storyId,
    fromRevision: fromState?.revision ?? null,
    toRevision: toState.revision,
    addedChapterNumbers: chapters.map(chapter => chapter.chapterNumber),
    introducedCharacters,
    updatedCharacters,
    resolvedThreads,
    escalatedThreads,
    foreshadowedArtifacts,
    continuityWarnings,
    beatIds,
    summary: `Added chapters ${chapters.map(chapter => chapter.chapterNumber).join(', ')} and updated continuity state.`
  };
}

export function buildGenesisResponse(
  input: StoryGenerationSeam['input']
): ApiEnvelope<StoryIterationPayload> {
  const storyId = `story-${randomUUID()}`;
  const chapters: GeneratedChapter[] = [];
  for (let i = 0; i < input.chapterBatchSize; i++) {
    chapters.push(createChapter(storyId, i + 1, input.chapterBatchSize));
  }
  const baseState = createBaseState(storyId, input.chapterBatchSize);
  const state = applyChapterDeltas(baseState, chapters);
  const summary = createSummary(storyId, input.logline);
  const payload: StoryIterationPayload = {
    summary,
    batch: {
      chapters,
      totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      suggestedNextPrompts: [
        'Explore the rival court’s reaction.',
        'Deepen the mortal love interest’s backstory.'
      ]
    },
    state,
    stateDelta: buildStateDelta(storyId, null, state, chapters),
    telemetry: {
      engine: 'custom',
      totalLatencyMs: 2200,
      averageChapterLatencyMs: Math.round(2200 / input.chapterBatchSize),
      tokensConsumed: 1600,
      retryCount: 0
    }
  };
  payload.persistence = persistStoryIteration(payload);

  return {
    success: true,
    data: payload
  };
}

export function buildContinuationResponse(
  input: StoryContinuationSeam['input']
): ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }> {
  const transientSnapshot = getTransientStorySnapshot(input.storyId);
  const previousChapters = input.previouslyGeneratedChapters.length
    ? input.previouslyGeneratedChapters
    : transientSnapshot?.chapters ?? [];
  const lastChapter = previousChapters[previousChapters.length - 1];
  const startingNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
  const chapters: GeneratedChapter[] = [];
  for (let i = 0; i < input.chapterBatchSize; i++) {
    chapters.push(createChapter(input.storyId, startingNumber + i, input.chapterBatchSize));
  }

  const preservedSummary = input.existingSummary
    ? { ...input.existingSummary, updatedAt: new Date().toISOString() }
    : createSummary(input.storyId, input.storyState.narrativeVoice);
  const nextState = applyChapterDeltas(input.storyState, chapters, input.storyState.revision + 1);
  const payload: StoryIterationPayload & { appendedChapterNumbers: number[] } = {
    summary: preservedSummary,
    batch: {
      chapters,
      totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      suggestedNextPrompts: ['Resolve the ancient oath.', 'Reveal a betrayal from within the court.']
    },
    state: nextState,
    stateDelta: buildStateDelta(input.storyId, input.storyState, nextState, chapters),
    telemetry: {
      engine: 'custom',
      totalLatencyMs: 2400,
      averageChapterLatencyMs: Math.round(2400 / input.chapterBatchSize),
      tokensConsumed: 1750,
      retryCount: 1
    },
    appendedChapterNumbers: chapters.map(chapter => chapter.chapterNumber)
  };
  payload.persistence = persistStoryIteration(payload, previousChapters);

  return {
    success: true,
    data: payload
  };
}
