// Created: 2025-10-29 08:27 UTC

import {
  ApiEnvelope,
  ChapterBatchSize,
  GeneratedChapter,
  StoryContinuationSeam,
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryStateSnapshot,
  StorySummary
} from './contracts';

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

function createState(storyId: string, batchSize: ChapterBatchSize): StoryStateSnapshot {
  const now = new Date().toISOString();
  return {
    storyId,
    revision: storyRevisionCounter++,
    characters: [
      {
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
      }
    ],
    threads: [
      {
        id: `${storyId}-thread-1`,
        label: 'Forbidden diplomacy pact',
        status: batchSize > 1 ? 'escalating' : 'active',
        description: 'A secret alliance between rival courts threatens to collapse.',
        foreshadowedDevices: ['Crimson signet ring', 'Broken oath scroll']
      }
    ],
    artifacts: [
      {
        id: `${storyId}-artifact-ring`,
        name: 'Crimson Signet Ring',
        significance: 'Unlocks the sealed crypt beneath the court.',
        introducedInChapter: 1
      }
    ],
    beats: [],
    continuityWarnings: [],
    narrativeVoice: 'Velvet noir',
    lastUpdatedAt: now
  };
}

function createChapter(chapterNumber: number, batchSize: ChapterBatchSize): GeneratedChapter {
  const id = `chapter-${chapterIdCounter++}`;
  const cliffhanger = chapterNumber % Math.max(2, batchSize) === 0;
  return {
    chapterId: id,
    chapterNumber,
    title: `Chapter ${chapterNumber}: Midnight Reverie`,
    htmlContent: `<p>Chapter ${chapterNumber} unfurls in candlelit intrigue and whispered vows.</p>`,
    rawContent: `<p>Chapter ${chapterNumber} unfurls in candlelit intrigue and whispered vows.</p>`,
    summary: 'Passion collides with political duty beneath a bleeding moon.',
    wordCount: 850,
    hasCliffhanger: cliffhanger,
    delta: {
      introducedCharacters: [],
      resolvedThreads: [],
      escalatedThreads: [],
      foreshadowedArtifacts: [],
      continuityFlags: []
    }
  };
}

export function buildGenesisResponse(
  input: StoryGenerationSeam['input']
): ApiEnvelope<StoryIterationPayload> {
  const storyId = `story-${Date.now()}`;
  const chapters: GeneratedChapter[] = [];
  for (let i = 0; i < input.chapterBatchSize; i++) {
    chapters.push(createChapter(i + 1, input.chapterBatchSize));
  }

  return {
    success: true,
    data: {
      summary: createSummary(storyId, input.logline),
      batch: {
        chapters,
        totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
        suggestedNextPrompts: [
          'Explore the rival court’s reaction.',
          'Deepen the mortal love interest’s backstory.'
        ]
      },
      state: createState(storyId, input.chapterBatchSize),
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 2200,
        averageChapterLatencyMs: Math.round(2200 / input.chapterBatchSize),
        tokensConsumed: 1600,
        retryCount: 0
      }
    }
  };
}

export function buildContinuationResponse(
  input: StoryContinuationSeam['input']
): ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }> {
  const lastChapter = input.previouslyGeneratedChapters.at(-1);
  const startingNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
  const chapters: GeneratedChapter[] = [];
  for (let i = 0; i < input.chapterBatchSize; i++) {
    chapters.push(createChapter(startingNumber + i, input.chapterBatchSize));
  }

  const preservedSummary = input.existingSummary
    ? { ...input.existingSummary, updatedAt: new Date().toISOString() }
    : createSummary(input.storyId, input.storyState.narrativeVoice);

  return {
    success: true,
    data: {
      summary: preservedSummary,
      batch: {
        chapters,
        totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
        suggestedNextPrompts: ['Resolve the ancient oath.', 'Reveal a betrayal from within the court.']
      },
      state: {
        ...input.storyState,
        revision: input.storyState.revision + 1,
        lastUpdatedAt: new Date().toISOString()
      },
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 2400,
        averageChapterLatencyMs: Math.round(2400 / input.chapterBatchSize),
        tokensConsumed: 1750,
        retryCount: 1
      },
      appendedChapterNumbers: chapters.map(chapter => chapter.chapterNumber)
    }
  };
}
