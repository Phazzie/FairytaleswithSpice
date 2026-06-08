#!/usr/bin/env tsx
// Created: 2026-05-28 02:31 UTC

import {
  buildStoryLabPayloadFromGeneratedStory,
  continueStoryLab,
  generateStoryLabGenesis,
  shouldUseMockStoryLab,
  toClassicGenerationInput
} from '../api/_lib/story-lab/storyLabEngine';
import { getAuthorStylesForCreature } from '../api/_lib/config/authorStyles';
import type { StoryGenerationSeam as LabGenerationSeam } from '../api/_lib/story-lab/contracts';
import type {
  ChapterContinuationSeam as ClassicContinuationSeam,
  CreatureType,
  StoryGenerationSeam as ClassicGenerationSeam
} from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function withEnv<T>(updates: Record<string, string | undefined>, fn: () => T): T {
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
    return fn();
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

async function withEnvAsync<T>(updates: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
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
      description: 'A relationship that breaks supernatural law.'
    },
    {
      id: 'court_intrigue',
      label: 'Court Intrigue',
      description: 'Power changes hands through ceremony and betrayal.'
    }
  ],
  logline: 'A siren diplomat must betray her court to save a forbidden lover.',
  spicyLevel: 3,
  tone: 'dark_romance',
  desiredWordBudget: 1500,
  chapterBatchSize: 2,
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'dangerous_proximity',
    intimacyBoundary: 'fade_to_black',
    noGoContent: 'No coercion and no humiliation.'
  },
  protagonistName: 'Mira',
  antagonistName: 'Lord Brine',
  worldDetails: 'A moonlit reef court ruled by vow-binding songs.',
  narrativeDirectives: 'Keep the prose lush but tense.'
};

const classicInput = toClassicGenerationInput(blueprint);
assert(classicInput.creature === 'siren', 'creature should pass through');
assert(classicInput.wordCount === 1500, 'Story Lab word budget should remain first-class');
assert(classicInput.requestedChapterCount === 2, 'chapterBatchSize should map to requestedChapterCount');
assert(classicInput.generationContext?.source === 'story_lab', 'generation context should identify Story Lab');
assert(classicInput.generationContext?.logline === blueprint.logline, 'logline should not be flattened away');
assert(classicInput.generationContext?.themeSeeds?.[1]?.description.includes('betrayal'), 'theme descriptions should survive mapping');
assert(classicInput.generationContext?.heatContract?.tensionMode === 'dangerous_proximity', 'Heat Contract should survive Story Lab mapping');
assert(classicInput.generationContext?.heatContract?.noGoContent?.includes('coercion'), 'Heat Contract no-go content should reach generation context');
assert(
  toClassicGenerationInput({
    ...blueprint,
    themes: [{ id: 'magical_bargain', label: 'Magical Bargain', description: 'Every wish has a price.' }]
  }).generationContext?.themeSeeds?.[0]?.id === 'magical_bargain',
  'unsupported UI theme ids should still survive in Story Lab generation context'
);
assert(classicInput.userInput === blueprint.logline, 'legacy userInput fallback should stay concise');
assert(classicInput.themes.length === 1, 'unknown Story Lab theme ids should not enter classic themes');
assert(classicInput.themes[0] === 'forbidden_love', 'known Story Lab theme ids should map to classic themes');

const creatureStyleKeywords: Record<CreatureType, string[]> = {
  vampire: ['vampire', 'fang', 'immortal', 'blood'],
  werewolf: ['wolf', 'pack', 'shifter', 'moon'],
  fairy: ['fae', 'fairy', 'seelie', 'unseelie'],
  siren: ['siren', 'bargainer', 'debt'],
  djinn: ['wish', 'bargain', 'magic'],
  witch: ['witch', 'spell', 'grimoire', 'familiar'],
  dragon: ['dragon', 'scale', 'hoard', 'wing'],
  demon: ['demon', 'hell', 'infernal', 'contract'],
  angel: ['angel', 'wing', 'cathedral', 'heaven'],
  mermaid: ['mermaid', 'tide', 'reef', 'brine']
};

for (const [creature, keywords] of Object.entries(creatureStyleKeywords) as [CreatureType, string[]][]) {
  const styles = getAuthorStylesForCreature(creature);
  assert(styles.length >= 3, `${creature} should have at least three style seeds`);
  const combinedText = styles
    .map(style => `${style.author} ${style.voiceSample} ${style.trait}`)
    .join(' ')
    .toLowerCase();
  assert(keywords.some(keyword => combinedText.includes(keyword)), `${creature} style bank should contain creature-specific language`);
}

for (const creature of ['witch', 'dragon', 'demon', 'angel', 'mermaid'] as CreatureType[]) {
  const styles = getAuthorStylesForCreature(creature);
  const combinedText = styles
    .map(style => `${style.author} ${style.voiceSample} ${style.trait}`)
    .join(' ')
    .toLowerCase();
  const matchingKeywords = creatureStyleKeywords[creature].filter(keyword => combinedText.includes(keyword));
  assert(matchingKeywords.length >= 2, `${creature} style bank should carry multiple creature-specific cues`);
  assert(styles !== getAuthorStylesForCreature('vampire'), `${creature} should not reuse the vampire style bank object`);
  assert(styles !== getAuthorStylesForCreature('werewolf'), `${creature} should not reuse the werewolf style bank object`);
  assert(styles !== getAuthorStylesForCreature('fairy'), `${creature} should not reuse the fairy style bank object`);
}

const classicStory: ClassicGenerationSeam['output'] = {
  storyId: 'story-test',
  title: 'Song of the Reef Court',
  content: '<h3>Chapter 1: Salt Vows</h3><p>Mira chose the forbidden door.</p>',
  rawContent: '<p>[Mira, voice: moonlit-silk defiant]: "Open it."</p>',
  creature: 'siren',
  themes: ['forbidden_love'],
  spicyLevel: 3,
  actualWordCount: 8,
  estimatedReadTime: 1,
  hasCliffhanger: true,
  generatedAt: new Date(),
  tropeMetadata: 'serialized-trope-state',
  chapters: [
    {
      chapterId: 'chapter-1',
      chapterNumber: 1,
      title: 'Salt Vows',
      content: '<p>Mira chose the forbidden door.</p>',
      rawContent: '<p>[Mira, voice: moonlit-silk defiant]: "Open it."</p>',
      wordCount: 6,
      generatedAt: new Date(),
      hasAudio: false,
      cliffhangerEnding: true,
      nextChapterHint: 'Reveal what waits below the reef court.'
    }
  ],
  totalWordCount: 6,
  appendedToStory: '<p>Mira chose the forbidden door.</p>',
  nextChapterHint: 'Reveal what waits below the reef court.'
};

const payload = buildStoryLabPayloadFromGeneratedStory(blueprint, classicStory, {
  requestId: 'req-test',
  processingTime: 2000,
  chaptersRequested: 2,
  chaptersGenerated: 1
});
assert(payload.summary.storyId === 'story-test', 'summary should keep real story id');
assert(payload.summary.title === 'Song of the Reef Court', 'summary should keep real title');
assert(payload.summary.tropeMetadata === 'serialized-trope-state', 'trope metadata should survive for continuations');
assert(payload.batch.chapters.length === 1, 'real chapters should be mapped into Story Lab batch');
assert(payload.batch.chapters[0].rawContent?.includes('[Mira'), 'raw speaker-tag content should survive');
assert(payload.batch.suggestedNextPrompts.some(prompt => prompt.includes('Reveal what waits')), 'next chapter hint should become a prompt');
assert(payload.state.characters.some(character => character.displayName === 'Mira'), 'protagonist should seed continuity state');
assert(payload.state.threads.some(thread => thread.label === 'Court Intrigue'), 'theme seeds should become continuity threads');
assert(payload.telemetry.engine === 'grok', 'real StoryService mapping should report grok telemetry');
assert(payload.telemetry.totalLatencyMs === 2000, 'real StoryService latency metadata should reach Story Lab telemetry');

withEnv({ XAI_API_KEY: undefined, STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, () => {
  assert(shouldUseMockStoryLab(), 'missing provider key should use mock Story Lab fallback outside production');
});

withEnv({ XAI_API_KEY: undefined, STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: 'production', VERCEL_ENV: undefined }, () => {
  assert(!shouldUseMockStoryLab(), 'production missing provider key should not use mock Story Lab fallback');
});

withEnv({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, () => {
  assert(!shouldUseMockStoryLab(), 'provider key should choose real engine path');
});

withEnv({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: 'true' }, () => {
  assert(shouldUseMockStoryLab(), 'explicit mock flag should override provider key');
});

(async () => {
  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = await generateStoryLabGenesis({
      ...blueprint,
      heatContract: {
        ...blueprint.heatContract!,
        adultOnlyConfirmed: false
      }
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called for an unconfirmed Heat Contract');
        },
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by genesis test');
        }
      })
    });

    assert(!response.success, 'unconfirmed Heat Contract should fail before provider call');
    assert(response.error.code === 'CONTENT_POLICY_VIOLATION', 'unconfirmed Heat Contract should use content policy error');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = await generateStoryLabGenesis({
      ...blueprint,
      heatContract: undefined
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called when Heat Contract is missing');
        },
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by genesis test');
        }
      })
    });

    assert(!response.success, 'missing Heat Contract should fail before provider call');
    assert(response.error.code === 'CONTENT_POLICY_VIOLATION', 'missing Heat Contract should use content policy error');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = await generateStoryLabGenesis(blueprint, {
      serviceFactory: () => ({
        generateStory: async () => ({
          success: false,
          error: {
            code: 'UPSTREAM_DOWN',
            message: 'Provider was configured but unavailable.'
          }
        }),
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by genesis test');
        }
      })
    });

    assert(!response.success, 'configured provider failure should return an error');
    assert(response.error.code === 'UPSTREAM_DOWN', 'provider error code should be preserved');
    assert(response.error.message.includes('configured'), 'provider error message should be preserved');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = await generateStoryLabGenesis(blueprint, {
      serviceFactory: () => ({
        generateStory: async () => ({
          success: true,
          data: classicStory,
          metadata: {
            requestId: 'req-partial',
            processingTime: 3000,
            chaptersRequested: 2,
            chaptersGenerated: 1,
            partialFailures: [{
              chapterNumber: 2,
              message: 'Provider timed out before chapter 2.'
            }]
          }
        }),
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by genesis test');
        }
      })
    });

    assert(!response.success, 'partial provider success should not look like a complete Story Lab batch');
    assert(response.error.code === 'PARTIAL_GENERATION_FAILED', 'partial failure should use a specific error code');
  });

  await withEnvAsync({ XAI_API_KEY: undefined, STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: 'production', VERCEL_ENV: undefined }, async () => {
    const response = await generateStoryLabGenesis(blueprint, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called when production provider config is missing');
        },
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by genesis test');
        }
      })
    });

    assert(!response.success, 'production missing provider key should fail closed');
    assert(response.error.code === 'AI_UNAVAILABLE', 'production missing provider key should use AI_UNAVAILABLE');
    assert(response.error.message.includes('XAI_API_KEY'), 'production missing provider key should tell operators what is missing');
  });

  await withEnvAsync({ XAI_API_KEY: undefined, STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: 'production' }, async () => {
    const response = await continueStoryLab({
      storyId: payload.summary.storyId,
      chapterBatchSize: 1,
      storyState: payload.state,
      previouslyGeneratedChapters: payload.batch.chapters,
      continuationBrief: 'Raise the danger.',
      existingSummary: payload.summary
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by continuation test');
        },
        continueChapter: async () => {
          throw new Error('continueChapter should not be called when production provider config is missing');
        }
      })
    });

    assert(!response.success, 'production continuation missing provider key should fail closed');
    assert(response.error.code === 'AI_UNAVAILABLE', 'production continuation missing provider key should use AI_UNAVAILABLE');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    let sawHeatContract = false;
    const response = await continueStoryLab({
      storyId: payload.summary.storyId,
      chapterBatchSize: 1,
      storyState: payload.state,
      previouslyGeneratedChapters: payload.batch.chapters,
      continuationBrief: 'Keep the boundary intact.',
      existingSummary: payload.summary,
      heatContract: blueprint.heatContract
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by continuation test');
        },
        continueChapter: async input => {
          sawHeatContract = input.generationContext?.heatContract?.intimacyBoundary === 'fade_to_black';
          return {
            success: true,
            data: {
              chapterId: 'chapter-2',
              chapterNumber: 2,
              title: 'Boundary Kept',
              content: '<h3>Chapter 2: Boundary Kept</h3><p>Mira chose restraint.</p>',
              rawContent: '<p>[Mira]: "We wait."</p>',
              wordCount: 7,
              cliffhangerEnding: true,
              themesContinued: ['forbidden_love'],
              spicyLevelMaintained: 3,
              appendedToStory: '<h3>Chapter 2: Boundary Kept</h3><p>Mira chose restraint.</p>',
              tropeMetadata: payload.summary.tropeMetadata,
              chapters: [{
                chapterId: 'chapter-2',
                chapterNumber: 2,
                title: 'Boundary Kept',
                content: '<h3>Chapter 2: Boundary Kept</h3><p>Mira chose restraint.</p>',
                rawContent: '<p>[Mira]: "We wait."</p>',
                wordCount: 7,
                generatedAt: new Date(),
                hasAudio: false,
                cliffhangerEnding: true
              }],
              totalWordCount: 7
            }
          };
        }
      })
    });

    assert(response.success, 'continuation with Heat Contract should succeed through service seam');
    assert(sawHeatContract, 'continuation service input should receive the original Heat Contract');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    let capturedInput: ClassicContinuationSeam['input'] | undefined;
    const courtroomState = {
      ...payload.state,
      threads: [
        ...payload.state.threads,
        {
          id: 'story-test-thread-resolved',
          label: 'Settled Debt',
          status: 'resolved' as const,
          description: 'This bargain has already been paid.',
          foreshadowedDevices: []
        }
      ],
      artifacts: [
        ...payload.state.artifacts,
        {
          id: 'story-test-paid-charm',
          name: 'Paid Charm',
          significance: 'A charm whose bargain has already closed.',
          introducedInChapter: 1,
          resolvedInChapter: 1
        }
      ],
      continuityWarnings: [
        'Resolve the vow-binding song before changing courts.'
      ]
    };

    const response = await continueStoryLab({
      storyId: payload.summary.storyId,
      chapterBatchSize: 1,
      storyState: courtroomState,
      previouslyGeneratedChapters: payload.batch.chapters,
      continuationBrief: 'Let the court demand payment.',
      existingSummary: payload.summary
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by continuity courtroom test');
        },
        continueChapter: async input => {
          capturedInput = input;
          return {
            success: true,
            data: {
              chapterId: 'chapter-2',
              chapterNumber: 2,
              title: 'Court Payment',
              content: '<h3>Chapter 2: Court Payment</h3><p>The court called the debt due.</p>',
              rawContent: '<p>[Mira]: "Name the price."</p>',
              wordCount: 8,
              cliffhangerEnding: true,
              themesContinued: ['forbidden_love'],
              spicyLevelMaintained: 3,
              appendedToStory: '<h3>Chapter 2: Court Payment</h3><p>The court called the debt due.</p>',
              tropeMetadata: payload.summary.tropeMetadata,
              chapters: [{
                chapterId: 'chapter-2',
                chapterNumber: 2,
                title: 'Court Payment',
                content: '<h3>Chapter 2: Court Payment</h3><p>The court called the debt due.</p>',
                rawContent: '<p>[Mira]: "Name the price."</p>',
                wordCount: 8,
                generatedAt: new Date(),
                hasAudio: false,
                cliffhangerEnding: true
              }],
              totalWordCount: 8
            }
          };
        }
      })
    });

    assert(response.success, 'continuation with continuity courtroom anchors should succeed');
    assert(capturedInput?.userInput?.includes('Let the court demand payment.'), 'original continuation brief should stay in service input');
    assert(capturedInput?.userInput?.includes('Continuity Courtroom:'), 'service input should include the continuity courtroom anchor');
    assert(capturedInput?.userInput?.includes('Pressure rising: Forbidden Love'), 'escalating threads should be named for payoff');
    assert(capturedInput?.userInput?.includes('Open promise: Court Intrigue'), 'active threads should be named for payoff');
    assert(capturedInput?.userInput?.includes('World clue: Vow-Binding Songs'), 'unresolved artifacts should be named for payoff');
    assert(capturedInput?.userInput?.includes('Continuity note: Resolve the vow-binding song before changing courts.'), 'continuity warnings should be carried into the next chapter request');
    assert(!capturedInput?.userInput?.includes('Settled Debt'), 'resolved threads should not be repeated as open courtroom debts');
    assert(!capturedInput?.userInput?.includes('Paid Charm'), 'resolved artifacts should not be repeated as unresolved courtroom debts');
    assert(capturedInput?.userInput?.includes('Chapter Ending Stress Test:'), 'service input should include the chapter ending stress-test anchor');
    assert(capturedInput?.userInput?.includes('Considered endings: emotional reveal, danger escalation, secret exposed.'), 'ending stress test should keep the candidate set visible to the model');
    assert(capturedInput?.userInput?.includes('Chosen ending pressure: Secret exposed'), 'unresolved lore and debt language should choose the secret-exposed ending pressure');
    assert(capturedInput?.userInput?.includes('leave one sharper question active'), 'ending stress test should preserve serialized momentum');
    assert(capturedInput?.userInput?.includes('Cliche Alarm:'), 'service input should include the cliche alarm anchor');
    assert(capturedInput?.userInput?.includes('Obvious stale path to avoid: a formal demand with no personal cost or surprising consequence.'), 'debt/payment continuation should avoid the obvious formal-demand scene');
    assert(capturedInput?.userInput?.includes('Freshness rule: turn the scene through Forbidden Love'), 'cliche alarm should tie freshness to a concrete unresolved story thread');
    assert((capturedInput?.userInput?.length ?? 0) <= 900, 'hidden continuation anchors should stay under the compactness budget');
  });

  console.log('Story Lab real-engine mapping tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
