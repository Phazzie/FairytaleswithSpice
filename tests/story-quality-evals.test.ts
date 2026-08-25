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

// The evaluation route is called with the story exactly as the generator
// renders it: `<p>` elements on one line, `[Speaker]:` tags inside those
// elements, no blank lines anywhere. Scored against the raw markup, the whole
// story counted as a single paragraph and no line ever started with a speaker
// tag, so the paragraph-shaped and dialogue-shaped dimensions all reported the
// opposite of what the story contains.
function testHtmlStoriesAreScoredOnTheirProse(): void {
  const htmlStory = '<section><h3>The Witness Shell</h3>'
    + '<p>[Narrator]: Salt stung her wrist as the witness shell glowed under the reef arch.</p>'
    + '<p>[Mira]: &quot;If the shell repeats my vow, Lord Brine owns the court by sunrise.&quot;</p>'
    + '<p>[Lord Brine]: &quot;Then choose which secret survives the tide.&quot;</p>'
    + '<p>Mira touched the blood oath hidden under her sleeve. Whose name would the shell give up?</p>'
    + '</section>';

  const report = buildStoryQualityHeuristicReport({
    storyContent: htmlStory,
    configuration: {
      creature: 'siren',
      themes: ['blood_oaths'],
      spicyLevel: 3,
      wordCount: 900
    }
  });

  const dimension = (id: string) => {
    const found = report.dimensions.find(entry => entry.id === id);
    assert(found, `report should include the ${id} dimension`);
    return found;
  };

  const proseQuality = dimension('prose_quality');
  assert(
    proseQuality.signals.some(signal => /^Paragraphs: [2-9]/.test(signal)),
    `an HTML story should be counted as several paragraphs (signals=${JSON.stringify(proseQuality.signals)})`
  );
  assert(
    !proseQuality.signals.includes('Words: 1'),
    'markup should not be counted as a single word'
  );

  const audioReadiness = dimension('audio_readiness');
  assert(
    audioReadiness.signals.some(signal => signal.startsWith('Speaker variety: Narrator, Mira, Lord Brine')),
    `speaker tags inside <p> elements should still be read as dialogue (signals=${JSON.stringify(audioReadiness.signals)})`
  );
  assert(
    audioReadiness.signals.includes('No overlong paragraphs detected.'),
    'a story of short paragraphs should not be penalised as one overlong block'
  );

  // The cliffhanger dimension is documented as reading the ending. Its hook
  // words appear only in the last paragraph here, and the ending's question
  // mark is the last character of the prose — not of the markup.
  const cliffhanger = dimension('cliffhanger_quality');
  assert(
    cliffhanger.signals.includes('Ending closes on a question or exclamation.'),
    `the ending should be read past its closing tags (signals=${JSON.stringify(cliffhanger.signals)})`
  );
}

/**
 * The two identity-shaped dimensions have to be able to say "no".
 *
 * Both used to answer yes to everything. `\b[A-Z][a-z]+\b` matches the first
 * word of every sentence, so this story of four sentences and no cast reported
 * four named characters and collected the whole named-character bonus, which
 * caps at two. And `extractConcreteAnchors` dropped tokens shorter than three
 * characters before pairing them, so the determiners its own weak-first-token
 * list exists to reject — `a`, `an`, `my` — were gone before the guard ran, and
 * the deleted token welded its two neighbours into a phrase the prose never
 * contained: "She opened a door" was scored as the concrete anchor
 * `opened door`.
 */
function testAnonymousProseScoresAsAnonymous(): void {
  const report = buildStoryQualityHeuristicReport({
    storyContent: [
      'She opened a door and stepped through the cold hall.',
      'Rain fell hard. Blood pooled where the light could not reach.',
      'He carried my key past the arch and said nothing about the vow.'
    ].join('\n\n'),
    configuration: {
      creature: 'vampire',
      themes: [],
      spicyLevel: 3,
      wordCount: 900
    }
  });

  const characterConsistency = report.dimensions.find(dimension => dimension.id === 'character_consistency');
  assert(characterConsistency, 'report should include the character consistency dimension');
  assert(
    !characterConsistency.signals.some(signal => signal.startsWith('Named character count:')),
    `sentence-initial words are not a cast (signals=${JSON.stringify(characterConsistency.signals)})`
  );

  const proseQuality = report.dimensions.find(dimension => dimension.id === 'prose_quality');
  assert(proseQuality, 'report should include the prose quality dimension');
  const anchorSignal = proseQuality.signals.find(signal => signal.startsWith('Specific anchors:'));
  assert(
    !anchorSignal,
    `"a door", "my key", and "the arch" are generic references, not concrete anchors (got ${anchorSignal})`
  );
}

/**
 * The other direction: a story that does name its cast and does anchor its
 * objects still gets credit for both, so the guards above cannot be satisfied
 * by scoring nothing at all.
 */
function testNamedProseStillScores(): void {
  const report = buildStoryQualityHeuristicReport({
    storyContent: [
      '[Narrator]: Salt stung her wrist while Mira watched the witness shell.',
      'The price was named when Lord Brine pressed the blood oath into her palm.'
    ].join('\n\n'),
    configuration: {
      creature: 'siren',
      themes: [],
      spicyLevel: 3,
      wordCount: 900
    }
  });

  const characterConsistency = report.dimensions.find(dimension => dimension.id === 'character_consistency');
  assert(
    characterConsistency?.signals.includes('Named character count: 2'),
    `Mira and Lord Brine are a cast (signals=${JSON.stringify(characterConsistency?.signals)})`
  );

  const proseQuality = report.dimensions.find(dimension => dimension.id === 'prose_quality');
  assert(
    proseQuality?.signals.some(signal => signal.includes('Specific anchors: witness shell, blood oath')),
    `named objects are still concrete anchors (signals=${JSON.stringify(proseQuality?.signals)})`
  );
}

async function main(): Promise<void> {
  testHtmlStoriesAreScoredOnTheirProse();
  testAnonymousProseScoresAsAnonymous();
  testNamedProseStillScores();

  const heuristicReport = buildStoryQualityHeuristicReport({
    storyContent: [
      '[Mira]: "If the shell repeats my vow, Lord Brine owns the court by sunrise."',
      "[Narrator]: Mira pressed her palm to the witness shell. Salt stung Mira's wrist as the witness shell glowed under the reef arch, bright enough for every rival to see.",
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
  const heuristicDimensionIds = new Set(heuristicReport.dimensions.map(dimension => dimension.id));
  assert(heuristicReport.source === 'heuristic', 'quality report should identify deterministic heuristic mode.');
  assert(heuristicReport.dimensions.length === 7, 'quality report should include the seven planned dimensions.');
  assert(heuristicDimensionIds.has('continuity'), 'quality report should include continuity.');
  assert(heuristicDimensionIds.has('audio_readiness'), 'quality report should include audio readiness.');
  assert(heuristicReport.dimensions.every(dimension => dimension.score >= 0 && dimension.score <= 100), 'quality scores should stay normalized.');
  assert(heuristicReport.dimensions.some(dimension => dimension.signals.length > 0), 'quality report should include explainable signals.');
  const proseQuality = heuristicReport.dimensions.find(dimension => dimension.id === 'prose_quality');
  assert(proseQuality?.signals.some(signal => signal.includes('Specific anchors: witness shell, reef arch, blood oath')), 'prose quality should report concrete specificity anchors.');
  assert(proseQuality?.signals.some(signal => signal.includes('Sensory texture: glow, salt, sting')), 'prose quality should report concrete sensory texture.');
  const characterConsistency = heuristicReport.dimensions.find(dimension => dimension.id === 'character_consistency');
  assert(characterConsistency?.signals.some(signal => signal.includes('Agency actions: pressed, touched')), 'character consistency should report protagonist agency actions.');
  const audioReadiness = heuristicReport.dimensions.find(dimension => dimension.id === 'audio_readiness');
  assert(audioReadiness?.signals.some(signal => signal.includes('Speaker variety: Mira, Narrator, Lord Brine')), 'audio-readiness should report concrete speaker variety.');

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
  assert(continuity.receipt.warning?.includes('disabled'), 'disabled AI continuity fallback should be visible.');

  const guidancePreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Pay off the witness shell and make Lord Brine escalate.',
    storyState: genesisPayload.state
  });
  assert(guidancePreview.providerBrief.includes('Pay off the witness shell'), 'guidance preview should preserve the user continuation brief.');
  assert(guidancePreview.hiddenGuidance.includes('Continuity Courtroom:'), 'guidance preview should expose hidden continuity anchors for future UI preview work.');
  assert(guidancePreview.anchorHeadings.length === 3, 'guidance preview should report the three hidden anchor blocks.');
  assert(guidancePreview.characterCount <= 900, 'guidance preview should expose the same compactness budget guarded by real-engine tests.');
  const activationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Bring the blood oath into the next room.',
    storyState: {
      ...genesisPayload.state,
      threads: [
        {
          id: 'thread-weather-tax',
          label: 'Weather Tax',
          status: 'active',
          description: 'The court taxes every storm that crosses the reef.',
          foreshadowedDevices: []
        },
        {
          id: 'thread-kitchen-claim',
          label: 'Kitchen Claim',
          status: 'active',
          description: 'The servants know who stole the silver ladle.',
          foreshadowedDevices: []
        },
        {
          id: 'thread-silent-harbor',
          label: 'Silent Harbor',
          status: 'active',
          description: 'The harbor stopped answering ships at midnight.',
          foreshadowedDevices: []
        },
        {
          id: 'thread-blood-oath',
          label: 'Blood Oath',
          status: 'active',
          description: 'The old vow follows Mira into every negotiation.',
          foreshadowedDevices: []
        }
      ],
      artifacts: [],
      continuityWarnings: []
    }
  });
  assert(activationPreview.hiddenGuidance.includes('Open promise: Blood Oath'), 'continuation guidance should prioritize a brief-matched thread when the courtroom is compacted.');
  assert(
    activationPreview.contextSourceMap.some(item =>
      item.kind === 'thread'
      && item.label === 'Blood Oath'
      && item.anchorLabel === 'Open promise'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Blood Oath thread was activated.'
  );
  const memoryComparisonState = {
    ...genesisPayload.state,
    characters: [],
    threads: [
      {
        id: 'thread-weather-tax',
        label: 'Weather Tax',
        status: 'active' as const,
        description: 'The court taxes every storm that crosses the reef.',
        foreshadowedDevices: []
      },
      {
        id: 'thread-kitchen-claim',
        label: 'Kitchen Claim',
        status: 'active' as const,
        description: 'The servants know who stole the silver ladle.',
        foreshadowedDevices: []
      },
      {
        id: 'thread-silent-harbor',
        label: 'Silent Harbor',
        status: 'active' as const,
        description: 'The harbor stopped answering ships at midnight.',
        foreshadowedDevices: []
      },
      {
        id: 'thread-moonlit-oath',
        label: 'Moonlit Oath',
        status: 'active' as const,
        description: 'Mara promised the duke a ledger that would cost her the archive.',
        foreshadowedDevices: []
      }
    ],
    artifacts: [],
    continuityWarnings: []
  };
  const neutralMemoryPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Raise the pressure in the next room.',
    storyState: memoryComparisonState
  });
  assert(
    !neutralMemoryPreview.contextSourceMap.some(item => item.kind === 'thread' && item.label === 'Moonlit Oath'),
    'neutral continuation brief should not activate the lower-priority Moonlit Oath thread.'
  );
  const acceptedMemoryPreview = previewStoryLabContinuationGuidance({
    continuationBrief: [
      'Raise the pressure in the next room.',
      '',
      'Accepted Memory Cards:',
      '- Promise card: Moonlit Oath. Mara will burn the moonlit ledger before she lets the duke own the vow. Trigger: Moonlit oath, ledger.'
    ].join('\n'),
    storyState: memoryComparisonState
  });
  assert(
    acceptedMemoryPreview.hiddenGuidance.includes('Open promise: Moonlit Oath'),
    'accepted memory card text should change the selected continuity anchor.'
  );
  assert(
    acceptedMemoryPreview.contextSourceMap.some(item =>
      item.kind === 'thread'
      && item.label === 'Moonlit Oath'
      && item.reason.includes('accepted memory card text')),
    'guidance preview should explain when accepted memory card text activated an anchor.'
  );
  const artifactActivationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Use the glass key now; make it unlock the forbidden tide door.',
    storyState: {
      ...genesisPayload.state,
      threads: [],
      artifacts: [
        {
          id: 'artifact-silver-ladle',
          name: 'Silver Ladle',
          significance: 'The kitchen staff hid it after the court dinner.',
          introducedInChapter: 1
        },
        {
          id: 'artifact-storm-ledger',
          name: 'Storm Ledger',
          significance: 'The reef court taxes storms by moon phase.',
          introducedInChapter: 1
        },
        {
          id: 'artifact-glass-key',
          name: 'Glass Key',
          significance: 'A brittle key that opens the forbidden tide door only once.',
          introducedInChapter: 1
        }
      ],
      continuityWarnings: []
    }
  });
  assert(artifactActivationPreview.hiddenGuidance.includes('World clue: Glass Key'), 'continuation guidance should prioritize a brief-matched artifact when the courtroom is compacted.');
  assert(
    artifactActivationPreview.contextSourceMap.some(item =>
      item.kind === 'artifact'
      && item.label === 'Glass Key'
      && item.anchorLabel === 'World clue'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Glass Key artifact was activated.'
  );
  const relationshipActivationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Let Coral Scribe betray Mira with the court ledger.',
    storyState: {
      ...genesisPayload.state,
      characters: [
        {
          id: 'mira',
          displayName: 'Mira',
          archetype: 'protagonist',
          summary: 'A siren diplomat carrying a forbidden oath.',
          currentGoal: 'Keep the reef court from owning her lover.',
          internalConflict: 'She wants help but fears being seen needing it.',
          externalConflict: 'The court wants the oath made public.',
          secrets: [],
          relationships: [
            {
              characterId: 'lord-brine',
              relationship: 'rival',
              notes: 'Lord Brine can turn the vow into leverage.'
            },
            {
              characterId: 'coral-scribe',
              relationship: 'ally',
              notes: 'Coral Scribe knows which ledger proves the betrayal.'
            }
          ],
          spiceCompatibilities: [3]
        },
        {
          id: 'lord-brine',
          displayName: 'Lord Brine',
          archetype: 'antagonist',
          summary: 'A reef lord with a claim on the oath.',
          currentGoal: 'Own the court record.',
          internalConflict: 'He wants Mira to choose him and the court.',
          externalConflict: 'Mira can make him look desperate.',
          secrets: [],
          relationships: [],
          spiceCompatibilities: [3]
        },
        {
          id: 'coral-scribe',
          displayName: 'Coral Scribe',
          archetype: 'supporting',
          summary: 'A court recordkeeper who knows which ledger can hurt Mira.',
          currentGoal: 'Survive whichever side wins.',
          internalConflict: 'Loyalty costs more than silence.',
          externalConflict: 'Both Mira and Lord Brine need the ledger.',
          secrets: [],
          relationships: [],
          spiceCompatibilities: [3]
        }
      ],
      threads: [],
      artifacts: [],
      continuityWarnings: []
    }
  });
  assert(relationshipActivationPreview.hiddenGuidance.includes('Relationship pressure: Mira and Coral Scribe'), 'continuation guidance should prioritize a brief-matched relationship pair.');
  assert(
    relationshipActivationPreview.contextSourceMap.some(item =>
      item.kind === 'relationship'
      && item.label === 'Mira and Coral Scribe'
      && item.anchorLabel === 'Relationship pressure'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Coral Scribe relationship was activated.'
  );
  const warningActivationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Make Coral Scribe honor the ledger warning before the court leaves.',
    storyState: {
      ...genesisPayload.state,
      characters: [],
      threads: [],
      artifacts: [],
      continuityWarnings: [
        'Do not move the storm tax before the reef bell rings.',
        'Keep the kitchen staff out of the oath scene.',
        'Coral Scribe must betray Mira before the ledger leaves court.'
      ]
    }
  });
  assert(warningActivationPreview.hiddenGuidance.includes('Continuity note: Coral Scribe must betray Mira before the ledger leaves court.'), 'continuation guidance should prioritize a brief-matched continuity warning when the courtroom is compacted.');
  assert(
    warningActivationPreview.contextSourceMap.some(item =>
      item.kind === 'warning'
      && item.label === 'Coral Scribe must betray Mira before the ledger leaves court.'
      && item.anchorLabel === 'Continuity note'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Coral Scribe warning was activated.'
  );

  let continuationInput: ClassicContinuationSeam['input'] | null = null;
  const continuationResponse = await withEnv({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, () => continueStoryLab({
      storyId: genesisPayload.summary.storyId,
      chapterBatchSize: 1,
      storyState: genesisPayload.state,
      previouslyGeneratedChapters: genesisPayload.batch.chapters,
      continuationBrief: [
        'Pay off the witness shell and make Lord Brine escalate.',
        '',
        'Accepted Memory Cards:',
        '- Promise card: Private ledger. The private card detail names the hidden betrayal. Trigger: Private ledger, betrayal.'
      ].join('\n'),
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
  assert(!hiddenGuidance.includes('Subtext Receipt:'), 'subtext receipt should stay inside an existing hidden block.');
  assert(hiddenGuidance.includes('Scene pressure mix: Secret + Setting;'), 'continuation guidance should add a compact pressure mix inside the ending anchor.');
  assert(!hiddenGuidance.includes('Scene pressure mix: Secret + Setting.'), 'scene pressure should include a concrete seeded variant, not just labels.');
  assert(
    hiddenGuidance.includes('Subtext receipt: prove Mira and Lord Brine by behavior before explanation.'),
    'continuation guidance should force emotional change to show through behavior before explanation.'
  );
  assert(!hiddenGuidance.includes('Escalating thread:'), 'continuation guidance should not expose mechanical thread labels.');
  assert(!hiddenGuidance.includes('Open thread:'), 'continuation guidance should not expose mechanical thread labels.');
  assert(!hiddenGuidance.includes('Unresolved artifact:'), 'continuation guidance should not expose mechanical artifact labels.');
  assert(!hiddenGuidance.includes('Warning to honor:'), 'continuation guidance should not expose mechanical warning labels.');
  assert(!hiddenGuidance.includes('generic conflict'), 'continuation guidance should not ask the model to avoid generic conflict with generic wording.');
  assert(!hiddenGuidance.includes('World clue: World Details'), 'continuation guidance should not use a generic world artifact name.');
  assert(hiddenGuidance.includes('World clue: Witness Shells'), 'continuation guidance should name the concrete world clue.');
  assert(continuationResponse.data.batch.chapters[0].chapterNumber === 2, 'continuation should append the next chapter number.');
  assert(continuationResponse.data.continuityExtraction?.source === 'heuristic', 'test-injected service should keep heuristic continuity labeling.');
  const suggestedPromptText = continuationResponse.data.batch.suggestedNextPrompts.join(' ');
  assert(suggestedPromptText.includes('Pay off the witness shell'), 'public continuation brief should still seed suggested prompt chips.');
  assert(!suggestedPromptText.includes('Accepted Memory Cards'), 'suggested prompt chips should not expose internal accepted memory sections.');
  assert(!suggestedPromptText.includes('private card detail'), 'suggested prompt chips should not expose private memory card detail.');

  console.log('Story quality evals passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
