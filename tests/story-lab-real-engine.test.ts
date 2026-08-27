#!/usr/bin/env tsx
// Created: 2026-05-28 02:31 UTC

import {
  buildStoryLabPayloadFromGeneratedStory,
  continueStoryLab,
  generateStoryLabGenesis,
  previewStoryLabContinuationGuidance,
  shouldUseMockStoryLab,
  toClassicGenerationInput
} from '../api/_lib/story-lab/storyLabEngine';
import { getAuthorStylesForCreature, type AuthorStyle } from '../api/_lib/config/authorStyles';
import type {
  StoryGenerationSeam as LabGenerationSeam,
  StoryStateSnapshot
} from '../api/_lib/story-lab/contracts';
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

// Every creature the blueprint offers, other than the three whose banks the
// others are measured against. `siren` and `djinn` used to be absent from this
// list because both pointed at `FAIRY_STYLES`: a reader who chose either was
// given the fae court's voices, and the keyword assertion above passed only
// because `FAIRY_STYLES` ends on a Bargainer entry that says "siren",
// "bargain", and "debts".
for (const creature of ['siren', 'djinn', 'witch', 'dragon', 'demon', 'angel', 'mermaid'] as CreatureType[]) {
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

// No two creatures share a bank at all: the reuse assertions above only ever
// named three banks, so a new creature pointed at, say, `WITCH_STYLES` would
// pass every one of them.
const styleBanksByCreature = new Map<AuthorStyle[], CreatureType>();
for (const creature of Object.keys(creatureStyleKeywords) as CreatureType[]) {
  const styles = getAuthorStylesForCreature(creature);
  const owner = styleBanksByCreature.get(styles);
  assert(owner === undefined, `${creature} shares its style bank with ${owner}`);
  styleBanksByCreature.set(styles, creature);
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
assert(
  payload.state.characters.some(character =>
    character.displayName === 'Mira'
    && character.relationships.some(relationship =>
      relationship.characterId === 'story-test-antagonist'
      && relationship.relationship === 'rival'
      && relationship.notes.includes('costly choice'))),
  'protagonist should seed a typed relationship edge to the antagonist'
);
assert(payload.state.threads.some(thread => thread.label === 'Court Intrigue'), 'theme seeds should become continuity threads');
assert(payload.state.threads.every(thread => thread.lifetime === 'series'), 'real genesis threads should default to series lifetime');
assert(payload.state.artifacts.every(artifact => artifact.lifetime === 'series'), 'real world artifacts should default to series lifetime');
assert(payload.telemetry.engine === 'grok', 'real StoryService mapping should report grok telemetry');
assert(payload.telemetry.totalLatencyMs === 2000, 'real StoryService latency metadata should reach Story Lab telemetry');

const payloadWithoutRawChapterContent = buildStoryLabPayloadFromGeneratedStory(blueprint, {
  ...classicStory,
  storyId: 'story-test-without-raw-content',
  chapters: [{
    ...classicStory.chapters[0],
    rawContent: undefined,
    content: '<p>Mira chose the visible chapter text.</p>'
  }]
}, {
  requestId: 'req-test',
  processingTime: 2000,
  chaptersRequested: 1,
  chaptersGenerated: 1
});
assert(
  payloadWithoutRawChapterContent.batch.chapters[0].rawContent === '<p>Mira chose the visible chapter text.</p>',
  'Story Lab chapters should fall back to htmlContent when rawContent is missing'
);

const payloadWithEmptyRawChapterContent = buildStoryLabPayloadFromGeneratedStory(blueprint, {
  ...classicStory,
  storyId: 'story-test-empty-raw-content',
  chapters: [{
    ...classicStory.chapters[0],
    rawContent: '',
    content: '<p>Mira chose the visible chapter text.</p>'
  }]
}, {
  requestId: 'req-test',
  processingTime: 2000,
  chaptersRequested: 1,
  chaptersGenerated: 1
});
assert(
  payloadWithEmptyRawChapterContent.batch.chapters[0].rawContent === '',
  'Story Lab chapters should preserve an intentional empty rawContent string'
);

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
            message: 'Provider was configured but unavailable.',
            details: { providerStack: 'private upstream detail' }
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
    assert(!('details' in response.error), 'Story Lab generation errors should not expose provider details');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    const response = await generateStoryLabGenesis(blueprint, {
      serviceFactory: () => ({
        generateStory: async () => ({
          success: false,
          error: undefined
        }) as never,
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by malformed genesis error test');
        }
      })
    });

    assert(!response.success, 'malformed provider error should still return an error response');
    assert(response.error.code === 'GENERATION_FAILED', 'malformed provider error should use the fallback code');
    assert(response.error.message === 'Story Lab request failed before completing.', 'malformed provider error should use a safe fallback message');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    const response = await generateStoryLabGenesis(blueprint, {
      serviceFactory: () => ({
        generateStory: async () => ({
          success: false,
          error: {
            code: 'INVALID_REQUEST ',
            message: ' Provider rejected the blueprint. '
          }
        }),
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by trimmed genesis error test');
        }
      })
    });

    assert(!response.success, 'provider error with padded fields should return an error response');
    assert(response.error.code === 'INVALID_REQUEST', 'provider error code should be trimmed');
    assert(response.error.message === 'Provider rejected the blueprint.', 'provider error message should be trimmed');
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
          throw new Error('generateStory should not be called by continuation failure test');
        },
        continueChapter: async () => ({
          success: false,
          error: {
            code: 'CONTINUATION_UPSTREAM_DOWN',
            message: 'Continuation provider unavailable.',
            details: { providerStack: 'private continuation detail' }
          }
        })
      })
    });

    assert(!response.success, 'configured continuation provider failure should return an error');
    assert(response.error.code === 'CONTINUATION_UPSTREAM_DOWN', 'continuation provider error code should be preserved');
    assert(!('details' in response.error), 'Story Lab continuation errors should not expose provider details');
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

  // The adult-reader confirmation used to be checked on genesis only, so it
  // covered chapter 1 of a story and no chapter after it. The contract decides
  // how explicit the prose is — the test above proves the boundary reaches the
  // prompt — so a continuation carrying an unconfirmed one was generated under
  // terms the reader had not agreed to.
  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    const response = await continueStoryLab({
      storyId: payload.summary.storyId,
      chapterBatchSize: 1,
      storyState: payload.state,
      previouslyGeneratedChapters: payload.batch.chapters,
      continuationBrief: 'Raise the danger.',
      existingSummary: payload.summary,
      heatContract: {
        ...blueprint.heatContract!,
        intimacyBoundary: 'literary_on_page',
        adultOnlyConfirmed: false
      }
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by continuation test');
        },
        continueChapter: async () => {
          throw new Error('continueChapter should not be called for an unconfirmed Heat Contract');
        }
      })
    });

    assert(!response.success, 'unconfirmed continuation Heat Contract should fail before provider call');
    assert(
      response.error.code === 'CONTENT_POLICY_VIOLATION',
      `unconfirmed continuation Heat Contract should use content policy error, got ${response.error.code}`
    );
  });

  // A continuation that names no contract at all is asking for more of the
  // story it already has, under the terms that story was begun on. That has
  // always been served and stays served: the gate is on a contract the caller
  // supplies, not on one it omits.
  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    let reachedProvider = false;
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
          reachedProvider = true;
          return {
            success: false,
            error: {
              code: 'CONTINUATION_UPSTREAM_DOWN',
              message: 'Continuation provider unavailable.'
            }
          };
        }
      })
    });

    assert(reachedProvider, 'a continuation with no Heat Contract should still reach the provider');
    assert(!response.success, 'the stubbed provider failure should still be reported');
    assert(
      response.error.code === 'CONTINUATION_UPSTREAM_DOWN',
      `an absent Heat Contract should not be answered as a policy violation, got ${response.error.code}`
    );
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
    assert(capturedInput?.userInput?.includes('Endings: emotional reveal, danger escalation, secret exposed.'), 'ending stress test should keep the candidate set visible to the model');
    assert(capturedInput?.userInput?.includes('Chosen: Secret exposed'), 'unresolved lore and debt language should choose the secret-exposed ending pressure');
    assert(capturedInput?.userInput?.includes('Scene pressure mix: Secret + Setting;'), 'scene pressure mixer should reuse the ending anchor');
    assert(capturedInput?.userInput?.includes('leave one sharper'), 'ending stress test should preserve serialized momentum');
    assert(capturedInput?.userInput?.includes('Cliche Alarm:'), 'service input should include the cliche alarm anchor');
    assert(capturedInput?.userInput?.includes('Avoid: formal demand with no personal cost.'), 'debt/payment continuation should avoid the obvious formal-demand scene');
    assert(capturedInput?.userInput?.includes('Freshness: turn Forbidden Love'), 'cliche alarm should tie freshness to a concrete unresolved story thread');
    assert(!capturedInput?.userInput?.includes('Subtext Receipt:'), 'subtext receipt should not add a fourth hidden anchor block');
    assert(
      capturedInput?.userInput?.includes('Subtext receipt: prove Mira and Lord Brine by behavior before explanation.'),
      'subtext receipt should reach the real continuation seam as behavior-first guidance'
    );
    assert((capturedInput?.userInput?.length ?? 0) <= 900, 'hidden continuation anchors should stay under the compactness budget');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    let capturedInput: ClassicContinuationSeam['input'] | undefined;
    const longText = 'Ninth mirror debt '.repeat(60).trim();
    const richState: StoryStateSnapshot = {
      ...payload.state,
      threads: Array.from({ length: 6 }, (_item, index) => ({
        id: `story-test-long-thread-${index}`,
        label: index === 0 ? 'Ninth Mirror Debt' : `Long Court Debt ${index}`,
        status: index % 2 === 0 ? 'escalating' as const : 'active' as const,
        description: `${longText} thread ${index} must not overflow the hidden guidance budget.`,
        foreshadowedDevices: [`Mirror shard ${index}`, `${longText} device ${index}`],
        lifetime: 'series' as const
      })),
      artifacts: Array.from({ length: 4 }, (_item, index) => ({
        id: `story-test-long-artifact-${index}`,
        name: `Ninth Mirror ${index}`,
        significance: `${longText} artifact ${index} keeps repeating expensive court context.`,
        introducedInChapter: 1
      })),
      continuityWarnings: Array.from({ length: 5 }, (_item, index) =>
        `${longText} warning ${index} should be selected deterministically without overrunning the budget.`
      )
    };

    const response = await continueStoryLab({
      storyId: payload.summary.storyId,
      chapterBatchSize: 1,
      storyState: richState,
      previouslyGeneratedChapters: payload.batch.chapters,
      continuationBrief: 'Focus on the ninth mirror debt.',
      existingSummary: payload.summary
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by hidden-guidance budget test');
        },
        continueChapter: async input => {
          capturedInput = input;
          return {
            success: true,
            data: {
              chapterId: 'chapter-2',
              chapterNumber: 2,
              title: 'Budgeted Mirror',
              content: '<h3>Chapter 2: Budgeted Mirror</h3><p>The mirror debt narrowed.</p>',
              rawContent: '<p>[Mira]: "Name the mirror."</p>',
              wordCount: 8,
              cliffhangerEnding: true,
              themesContinued: ['forbidden_love'],
              spicyLevelMaintained: 3,
              appendedToStory: '<h3>Chapter 2: Budgeted Mirror</h3><p>The mirror debt narrowed.</p>',
              tropeMetadata: payload.summary.tropeMetadata,
              chapters: [{
                chapterId: 'chapter-2',
                chapterNumber: 2,
                title: 'Budgeted Mirror',
                content: '<h3>Chapter 2: Budgeted Mirror</h3><p>The mirror debt narrowed.</p>',
                rawContent: '<p>[Mira]: "Name the mirror."</p>',
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

    const providerBrief = capturedInput?.userInput ?? '';
    const hiddenGuidance = providerBrief.replace('Focus on the ninth mirror debt.', '').trim();
    assert(response.success, 'continuation with rich hidden guidance should succeed');
    assert(providerBrief.includes('Continuity Courtroom:'), 'budgeted guidance should retain the courtroom heading');
    assert(providerBrief.includes('Pressure rising: Ninth Mirror Debt'), 'activated long thread should remain selected first');
    assert(providerBrief.includes('Chapter Ending Stress Test:'), 'budgeted guidance should retain ending strategy');
    assert(providerBrief.includes('Cliche Alarm:'), 'budgeted guidance should retain freshness guidance');
    assert(hiddenGuidance.length <= 860, 'assembled hidden guidance should stay inside its documented budget');
  });

  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    let capturedInput: ClassicContinuationSeam['input'] | undefined;
    const partialState = {
      ...payload.state,
      threads: [{
        id: 'story-test-partial-thread',
        label: 'Partial Oath',
        status: 'active' as const
      }],
      characters: [
        {
          id: 'mira',
          displayName: 'Mira',
          archetype: 'protagonist',
          summary: 'A diplomat with stale partial continuity.',
          currentGoal: 'Protect the oath.',
          internalConflict: '',
          externalConflict: '',
          secrets: [],
          relationships: [{
            characterId: 'lord-brine',
            relationship: 'rival'
          }],
          spiceCompatibilities: [3]
        },
        {
          id: 'lord-brine',
          displayName: 'Lord Brine',
          archetype: 'antagonist',
          summary: 'A rival in a partial relationship edge.',
          currentGoal: 'Collect the debt.',
          internalConflict: '',
          externalConflict: '',
          secrets: [],
          spiceCompatibilities: [3]
        }
      ],
      continuityWarnings: [undefined, 'Carry the partial oath forward.']
    } as unknown as StoryStateSnapshot;

    const response = await continueStoryLab({
      storyId: payload.summary.storyId,
      chapterBatchSize: 1,
      storyState: partialState,
      previouslyGeneratedChapters: payload.batch.chapters,
      continuationBrief: undefined,
      existingSummary: payload.summary
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by partial continuity test');
        },
        continueChapter: async input => {
          capturedInput = input;
          return {
            success: true,
            data: {
              chapterId: 'chapter-2',
              chapterNumber: 2,
              title: 'Partial Oath',
              content: '<h3>Chapter 2: Partial Oath</h3><p>Mira protected the oath.</p>',
              rawContent: '<p>[Mira]: "The oath remains."</p>',
              wordCount: 8,
              cliffhangerEnding: true,
              themesContinued: ['forbidden_love'],
              spicyLevelMaintained: 3,
              appendedToStory: '<h3>Chapter 2: Partial Oath</h3><p>Mira protected the oath.</p>',
              tropeMetadata: payload.summary.tropeMetadata,
              chapters: [{
                chapterId: 'chapter-2',
                chapterNumber: 2,
                title: 'Partial Oath',
                content: '<h3>Chapter 2: Partial Oath</h3><p>Mira protected the oath.</p>',
                rawContent: '<p>[Mira]: "The oath remains."</p>',
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

    const providerBrief = capturedInput?.userInput ?? '';
    assert(response.success, 'partial continuity state should not break continuation guidance');
    assert(providerBrief.includes('Partial Oath'), 'thread label should survive when description/devices are missing');
    assert(providerBrief.includes('Mira and Lord Brine'), 'relationship pressure should tolerate missing optional notes');
    assert(providerBrief.includes('Carry the partial oath forward.'), 'valid continuity warning should survive stale warning entries');
    assert(!providerBrief.includes('undefined'), 'partial continuity state should not inject undefined into hidden guidance');
  });

  // `previouslyGeneratedChapters` arrives in the request body and the routes
  // check only that it is an array. Both of the engine's readings of it are
  // `Math.max` over `chapter.chapterNumber`, which answers `NaN` for a single
  // entry that has no number on it — and `NaN` travelled the whole way through
  // a paid generation without throwing: the model was asked to continue from
  // chapter `NaN`, and every chapter it wrote came back numbered `NaN`, which
  // serializes as `null` for the client to append a project by.
  await withEnvAsync({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined, NODE_ENV: undefined, VERCEL_ENV: undefined }, async () => {
    const unreadableNumbers: unknown[] = [undefined, null, 'two', Number.NaN, {}];

    for (const chapterNumber of unreadableNumbers) {
      let providerWasCalled = false;
      const response = await continueStoryLab({
        storyId: payload.summary.storyId,
        chapterBatchSize: 1,
        storyState: payload.state,
        previouslyGeneratedChapters: [
          { ...payload.batch.chapters[0], chapterNumber: chapterNumber as number }
        ],
        continuationBrief: 'Raise the danger.',
        existingSummary: payload.summary
      }, {
        serviceFactory: () => ({
          generateStory: async () => {
            throw new Error('generateStory should not be called by the chapter-number guard test');
          },
          continueChapter: async () => {
            providerWasCalled = true;
            throw new Error('continueChapter should not be called for an unnumbered previous chapter');
          }
        })
      });

      const label = JSON.stringify(chapterNumber) ?? String(chapterNumber);
      assert(!response.success, `chapterNumber=${label} should be refused`);
      assert(
        response.error.code === 'INVALID_REQUEST',
        `chapterNumber=${label} is a caller error, not a service failure (got ${response.error.code})`
      );
      assert(
        response.error.message.includes('chapterNumber'),
        `the refusal should name the field that cannot be read (got ${response.error.message})`
      );
      assert(!providerWasCalled, `chapterNumber=${label} must be refused before the generation is billed`);
    }
  });

  // The pressure scans behind the hidden continuation guidance read the story
  // state as whole words rather than as substrings. Each case below is a word
  // the substring scan matched a shorter keyword inside, and the defect it
  // produced is the guidance line the model was then given: `lie` inside
  // `courtier` is worth `+3` to `secret_exposed`, which is on its own enough to
  // decide the chapter's ending pressure, and `heart` inside `hearth` decided
  // which cliche the chapter was told to avoid.
  {
    const pressureState = (label: string, description: string): StoryStateSnapshot => ({
      storyId: 'story-pressure-probe',
      revision: 2,
      characters: [],
      threads: [{
        id: 'story-pressure-probe-thread-1',
        label,
        status: 'active',
        description,
        foreshadowedDevices: [],
        lifetime: 'series'
      }],
      artifacts: [],
      beats: [],
      continuityWarnings: [],
      narrativeVoice: 'close third',
      lastUpdatedAt: '2026-08-27T00:00:00.000Z'
    } as unknown as StoryStateSnapshot);

    const guidanceFor = (label: string, description: string): string =>
      previewStoryLabContinuationGuidance({
        continuationBrief: '',
        storyState: pressureState(label, description)
      }).hiddenGuidance;

    const courtiers = guidanceFor('Court Intrigue', 'The courtiers gather beneath the chandeliers.');
    assert(
      !courtiers.includes('Scene pressure mix: Secret'),
      '`courtiers` and `chandeliers` are not the word `lie`, so they must not choose the secret pressure'
    );

    const hearth = guidanceFor('Winter Refuge', 'She banks the hearth and waits for the thaw.');
    assert(
      !hearth.includes('Avoid: confession of what they already know.'),
      '`hearth` is not the word `heart`, so it must not choose the confession cliche'
    );

    const unwanted = guidanceFor('Unwelcome Guest', 'The unwanted visitor will not leave.');
    assert(
      !unwanted.includes('Avoid: confession of what they already know.'),
      '`unwanted` is not the word `want`, and reads as the opposite of the beat it was credited to'
    );

    const priceless = guidanceFor('The Reliquary', 'A priceless relic sits unclaimed on the altar.');
    assert(
      !priceless.includes('Avoid: formal demand with no personal cost.'),
      '`priceless` is not the word `price`, so it must not read as a bargain coming due'
    );

    // The matches the substring scan got right are still matches, inflections
    // included — the repair must not cost the scans their real signal.
    const lies = guidanceFor('Hidden Secrets', 'Someone is telling lies beautifully.');
    assert(
      lies.includes('Scene pressure mix: Secret'),
      '`lies` is the word `lie`, so a state that names one must still choose the secret pressure'
    );

    const dangerous = guidanceFor('The Treeline', 'A dangerous hunter waits beyond it.');
    assert(
      dangerous.includes('Chosen: Danger escalation'),
      '`dangerous` and `hunter` are inflections of `danger` and `hunt`, and must still escalate'
    );

    const threatening = guidanceFor('The Siege', 'Something threatening moves outside the walls.');
    assert(
      threatening.includes('Chosen: Danger escalation'),
      '`threatening` is an inflection of `threat`, and must still escalate'
    );
  }

  console.log('Story Lab real-engine mapping tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
