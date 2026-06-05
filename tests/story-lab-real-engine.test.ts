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
import type { CreatureType, StoryGenerationSeam as ClassicGenerationSeam } from '../api/_lib/types/contracts';

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

  console.log('Story Lab real-engine mapping tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
