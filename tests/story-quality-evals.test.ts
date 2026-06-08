#!/usr/bin/env tsx
// Created: 2026-05-28 21:25 UTC

import {
  buildStoryLabPayloadFromGeneratedStory,
  continueStoryLab,
  previewStoryLabContinuationGuidance,
  toClassicGenerationInput
} from '../api/_lib/story-lab/storyLabEngine';
import { extractContinuity } from '../api/_lib/story-lab/continuityExtractor';
import { buildStoryQualityHeuristicReport } from '../api/_lib/story-lab/evaluation/storyQualityHeuristics';
import type { StoryGenerationSeam as LabGenerationSeam } from '../api/_lib/story-lab/contracts';
import type {
  ChapterContinuationSeam as ClassicContinuationSeam,
  StoryGenerationSeam as ClassicGenerationSeam
} from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function withEnv<T>(updates: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(updates)) {
    previous.set(key, process.env[key]);
    const value = updates[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

const blueprint: LabGenerationSeam['input'] = {
  creature: 'siren',
  themes: [
    {
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'A vow that makes desire politically dangerous.'
    },
    {
      id: 'blood_oaths',
      label: 'Blood Oaths',
      description: 'Promises that demand a physical price.'
    }
  ],
  logline: 'A siren diplomat must betray a moonlit reef court to save her forbidden lover.',
  spicyLevel: 3,
  tone: 'dark_romance',
  desiredWordBudget: 900,
  chapterBatchSize: 2,
  protagonistName: 'Mira',
  antagonistName: 'Lord Brine',
  worldDetails: 'A reef court where witness shells record every vow.',
  narrativeDirectives: 'Keep the romance dangerous and give each chapter a sharp unanswered question.'
};

const classicStory: ClassicGenerationSeam['output'] = {
  storyId: 'story-quality',
  title: 'Witness Shells',
  content: '<p>Mira pressed her palm to the witness shell while Lord Brine listened.</p>',
  rawContent: 'Mira pressed her palm to the witness shell while Lord Brine listened.',
  creature: 'siren',
  themes: ['forbidden_love', 'blood_oaths'],
  spicyLevel: 3,
  actualWordCount: 24,
  estimatedReadTime: 1,
  hasCliffhanger: true,
  generatedAt: new Date('2026-05-28T20:00:00.000Z'),
  tropeMetadata: 'trope-state: forbidden vow inverted by public testimony',
  chapters: [
    {
      chapterId: 'chapter-1',
      chapterNumber: 1,
      title: 'The Witness Shell',
      content: '<p>Mira pressed her palm to the witness shell while Lord Brine listened.</p>',
      rawContent: 'Mira pressed her palm to the witness shell while Lord Brine listened.',
      wordCount: 12,
      generatedAt: new Date('2026-05-28T20:00:00.000Z'),
      hasAudio: false,
      cliffhangerEnding: true,
      nextChapterHint: 'Reveal which oath the shell recorded.'
    }
  ],
  totalWordCount: 12,
  appendedToStory: '<p>Mira pressed her palm to the witness shell while Lord Brine listened.</p>',
  nextChapterHint: 'Reveal which oath the shell recorded.'
};

async function main(): Promise<void> {
  const heuristicReport = buildStoryQualityHeuristicReport({
    storyContent: [
      '[Mira]: "If the shell repeats my vow, Lord Brine owns the court by sunrise."',
      '[Narrator]: The witness shell glowed under the reef arch, bright enough for every rival to see.',
      '[Lord Brine]: "Then choose which secret survives the tide."',
      'Mira touched the blood oath hidden under her sleeve. The bargain had followed her from the first chapter, and now it wanted a name.'
    ].join('\n\n'),
    configuration: {
      creature: 'siren',
      themes: ['forbidden_love', 'blood_oaths'],
      spicyLevel: 3,
      wordCount: 900
    }
  });
  const heuristicDimensionIds = heuristicReport.dimensions.map(dimension => dimension.id);
  assert(heuristicReport.source === 'heuristic', 'quality report should identify deterministic heuristic mode.');
  assert(heuristicReport.dimensions.length === 7, 'quality report should include the seven planned dimensions.');
  assert(heuristicDimensionIds.includes('continuity'), 'quality report should include continuity.');
  assert(heuristicDimensionIds.includes('audio_readiness'), 'quality report should include audio readiness.');
  assert(heuristicReport.dimensions.every(dimension => dimension.score >= 0 && dimension.score <= 100), 'quality scores should stay normalized.');
  assert(heuristicReport.dimensions.some(dimension => dimension.signals.length > 0), 'quality report should include explainable signals.');
  const proseQuality = heuristicReport.dimensions.find(dimension => dimension.id === 'prose_quality');
  assert(proseQuality?.signals.some(signal => signal.includes('Specific anchors: witness shell, reef arch, blood oath')), 'prose quality should report concrete specificity anchors.');

  const classicInput = toClassicGenerationInput(blueprint);
  assert(classicInput.generationContext?.protagonistName === 'Mira', 'protagonist name should survive Story Lab mapping.');
  assert(classicInput.generationContext?.antagonistName === 'Lord Brine', 'antagonist name should survive Story Lab mapping.');
  assert(classicInput.generationContext?.narrativeDirectives?.includes('unanswered question'), 'narrative directives should survive Story Lab mapping.');
  assert(classicInput.generationContext?.themeSeeds?.some(theme => theme.label === 'Blood Oaths'), 'theme labels should survive Story Lab mapping.');

  const genesisPayload = buildStoryLabPayloadFromGeneratedStory(blueprint, classicStory, {
    requestId: 'quality-eval',
    processingTime: 1400,
    chaptersRequested: 2,
    chaptersGenerated: 1
  });
  assert(genesisPayload.state.characters.some(character => character.displayName === 'Mira'), 'protagonist should seed state.');
  assert(genesisPayload.state.characters.some(character => character.displayName === 'Lord Brine'), 'antagonist should seed state.');
  assert(genesisPayload.batch.chapters[0].hasCliffhanger, 'cliffhanger metadata should reach Story Lab chapters.');
  assert(genesisPayload.batch.suggestedNextPrompts.some(prompt => prompt.includes('oath')), 'next chapter hint should become a continuation prompt.');

  const continuity = await extractContinuity({
    storyId: genesisPayload.summary.storyId,
    currentState: genesisPayload.state,
    chapters: genesisPayload.batch.chapters,
    summary: genesisPayload.summary,
    blueprint,
    useAi: false
  });
  assert(continuity.receipt.source === 'heuristic', 'continuity extraction should label heuristic fallback.');
  assert(continuity.receipt.warning?.includes('heuristic'), 'heuristic fallback should be visible.');

  const guidancePreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Pay off the witness shell and make Lord Brine escalate.',
    storyState: genesisPayload.state
  });
  assert(guidancePreview.providerBrief.includes('Pay off the witness shell'), 'guidance preview should preserve the user continuation brief.');
  assert(guidancePreview.hiddenGuidance.includes('Continuity Courtroom:'), 'guidance preview should expose hidden continuity anchors for future UI preview work.');
  assert(guidancePreview.anchorHeadings.length === 3, 'guidance preview should report the three hidden anchor blocks.');
  assert(guidancePreview.characterCount <= 900, 'guidance preview should expose the same compactness budget guarded by real-engine tests.');

  let continuationInput: ClassicContinuationSeam['input'] | null = null;
  const continuationResponse = await withEnv({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, () => continueStoryLab({
      storyId: genesisPayload.summary.storyId,
      chapterBatchSize: 1,
      storyState: genesisPayload.state,
      previouslyGeneratedChapters: genesisPayload.batch.chapters,
      continuationBrief: 'Pay off the witness shell and make Lord Brine escalate.',
      existingSummary: genesisPayload.summary
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by continuation eval.');
        },
        continueChapter: async input => {
          continuationInput = input;
          return {
            success: true,
            data: {
              storyId: input.storyId,
              chapterNumber: 2,
              title: 'The Recorded Oath',
              content: "<p>The witness shell sang Mira's secret into the court.</p>",
              creature: 'siren',
              spicyLevelMaintained: 3,
              toneConsistency: true,
              continuedAt: new Date('2026-05-28T20:05:00.000Z'),
              chapters: [
                {
                  chapterId: 'chapter-2',
                  chapterNumber: 2,
                  title: 'The Recorded Oath',
                  content: "<p>The witness shell sang Mira's secret into the court.</p>",
                  rawContent: "The witness shell sang Mira's secret into the court.",
                  wordCount: 10,
                  generatedAt: new Date('2026-05-28T20:05:00.000Z'),
                  hasAudio: false,
                  cliffhangerEnding: true
                }
              ],
              totalWordCount: 10,
              appendedToStory: "<p>The witness shell sang Mira's secret into the court.</p>",
              nextChapterHint: 'Force Lord Brine to name the punishment.',
              tropeMetadata: input.tropeMetadata
            }
          };
        }
      })
    })
  );

  assert(continuationResponse.success, 'continuation eval should succeed with a fake service.');
  assert(
    continuationInput?.existingContent.toLowerCase().includes('witness shell'),
    `continuation should receive previous chapter context. Received: ${continuationInput?.existingContent ?? 'none'}`
  );
  assert(continuationInput?.userInput?.includes('Lord Brine'), 'continuation brief should reach the story service.');
  const hiddenGuidance = continuationInput?.userInput ?? '';
  assert(hiddenGuidance.includes('Continuity Courtroom:'), 'continuation guidance should include continuity anchors.');
  assert(hiddenGuidance.includes('Chapter Ending Stress Test:'), 'continuation guidance should include ending pressure.');
  assert(hiddenGuidance.includes('Cliche Alarm:'), 'continuation guidance should include stale-path avoidance.');
  assert(!hiddenGuidance.includes('Scene Pressure Mixer:'), 'scene pressure should reuse an existing anchor instead of adding a fourth hidden block.');
  assert(hiddenGuidance.includes('Scene pressure mix: Secret + Setting;'), 'continuation guidance should add a compact pressure mix inside the ending anchor.');
  assert(!hiddenGuidance.includes('Scene pressure mix: Secret + Setting.'), 'scene pressure should include a concrete seeded variant, not just labels.');
  assert(!hiddenGuidance.includes('Escalating thread:'), 'continuation guidance should not expose mechanical thread labels.');
  assert(!hiddenGuidance.includes('Open thread:'), 'continuation guidance should not expose mechanical thread labels.');
  assert(!hiddenGuidance.includes('Unresolved artifact:'), 'continuation guidance should not expose mechanical artifact labels.');
  assert(!hiddenGuidance.includes('Warning to honor:'), 'continuation guidance should not expose mechanical warning labels.');
  assert(!hiddenGuidance.includes('generic conflict'), 'continuation guidance should not ask the model to avoid generic conflict with generic wording.');
  assert(!hiddenGuidance.includes('World clue: World Details'), 'continuation guidance should not use a generic world artifact name.');
  assert(hiddenGuidance.includes('World clue: Witness Shells'), 'continuation guidance should name the concrete world clue.');
  assert(continuationResponse.data.batch.chapters[0].chapterNumber === 2, 'continuation should append the next chapter number.');
  assert(continuationResponse.data.continuityExtraction?.source === 'heuristic', 'test-injected service should keep heuristic continuity labeling.');

  console.log('Story quality evals passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
