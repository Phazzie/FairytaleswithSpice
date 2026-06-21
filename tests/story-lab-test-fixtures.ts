// Created: 2026-06-13 09:30 EDT

import type { SavedStoryProject } from '../story-generator/src/app/contracts';

export interface SavedStoryProjectFixtureOptions {
  id?: string;
  storyId?: string;
  title?: string;
  synopsis?: string;
  now?: string;
  privateStoryText?: string;
  themeId?: string;
  themeLabel?: string;
  themeDescription?: string;
  logline?: string;
  chapterSummary?: string;
  acceptedMemoryCards?: SavedStoryProject['acceptedMemoryCards'];
}

export function createSavedStoryProjectFixture(
  options: SavedStoryProjectFixtureOptions = {}
): SavedStoryProject {
  const now = options.now ?? '2026-06-13T09:30:00.000Z';
  const id = options.id ?? 'project-1';
  const storyId = options.storyId ?? 'story-1';
  const title = options.title ?? 'Moonlit Chapel';
  const synopsis = options.synopsis ?? 'A forbidden romance in a haunted chapel.';
  const privateStoryText = options.privateStoryText ?? 'Elena revealed the private vault beneath the moonlit chapel.';

  return {
    id,
    storyId,
    title,
    synopsis,
    blueprint: {
      creature: 'witch',
      themes: [
        {
          id: options.themeId ?? 'forbidden-oath',
          label: options.themeLabel ?? 'Forbidden oath',
          description: options.themeDescription ?? 'A vow that binds two enemies together.'
        }
      ],
      logline: options.logline ?? 'A witch and her rival uncover a cursed chapel.',
      spicyLevel: 3,
      tone: 'dark_romance',
      desiredWordBudget: 900,
      chapterBatchSize: 1,
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'closed_door',
        noGoContent: 'No humiliation.'
      }
    },
    summary: {
      storyId,
      title,
      synopsis,
      tone: 'dark_romance',
      spicyLevel: 3,
      createdAt: now,
      updatedAt: now
    },
    state: {
      storyId,
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      beats: [],
      continuityWarnings: [],
      narrativeVoice: 'Gothic, intimate, and tense.',
      lastUpdatedAt: now
    },
    chapters: [
      {
        chapterId: 'chapter-1',
        chapterNumber: 1,
        title: 'Chapter One',
        htmlContent: `<p>${privateStoryText}</p>`,
        rawContent: privateStoryText,
        summary: options.chapterSummary ?? 'Elena finds the hidden vault.',
        wordCount: 9,
        hasCliffhanger: true,
        delta: {
          introducedCharacters: [],
          resolvedThreads: [],
          escalatedThreads: [],
          foreshadowedArtifacts: [],
          continuityFlags: []
        }
      }
    ],
    telemetry: {
      engine: 'grok',
      model: 'grok-4',
      totalLatencyMs: 100,
      averageChapterLatencyMs: 100,
      tokensConsumed: 200,
      retryCount: 0
    },
    continuityExtraction: {
      source: 'heuristic',
      extractedAt: now,
      confidence: 0.7
    },
    acceptedMemoryCards: options.acceptedMemoryCards,
    createdAt: now,
    updatedAt: now
  };
}
