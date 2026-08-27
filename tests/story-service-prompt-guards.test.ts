#!/usr/bin/env tsx
// Created: 2026-06-21 20:57 UTC

import { StoryService } from '../api/_lib/services/storyService';
import type { StoryGenerationSeam } from '../api/_lib/types/contracts';
import { analyzeEmotionalTone } from '../api/_lib/services/storyContentAnalysis';
import { STORY_BLUEPRINT_LIMITS } from '../shared/storyBlueprintLimits';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const service = new StoryService() as unknown as {
  formatThemeContext(input: StoryGenerationSeam['input']): string;
  formatStoryLabContext(input: StoryGenerationSeam['input']): string;
};

const longLabel = 'L'.repeat(120);
const longDescription = 'D'.repeat(360);
const baseGenerationContext = {
  source: 'story_lab',
  logline: 'A'.repeat(500),
  tone: 'dark_romance',
  protagonistName: 'Mira',
  antagonistName: 'Lord Brine',
  worldDetails: 'W'.repeat(500),
  narrativeDirectives: 'N'.repeat(500),
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'dangerous_proximity',
    intimacyBoundary: 'fade_to_black',
    noGoContent: 'X'.repeat(500)
  },
  themeSeeds: [
    null,
    { label: longLabel, description: longDescription },
    { label: '', description: 'missing label' },
    { label: 'Missing description' },
    ...Array.from({ length: 8 }, (_item, index) => ({
      label: `Theme ${index}`,
      description: `Description ${index}`
    }))
  ]
};

const baseInput = {
  creature: 'siren',
  themes: ['forbidden_love'],
  spicyLevel: 3,
  wordCount: 900,
  userInput: 'A guarded reef court romance.'
};

/** The fixture, with one blueprint field replaced, as the service reads it. */
function buildInput(contextOverrides: Record<string, unknown> = {}): StoryGenerationSeam['input'] {
  return {
    ...baseInput,
    generationContext: { ...baseGenerationContext, ...contextOverrides }
  } as unknown as StoryGenerationSeam['input'];
}

const input = buildInput();

const themeContext = service.formatThemeContext(input);
assert(themeContext.includes('L'.repeat(80)), 'theme labels should be preserved up to the cap');
assert(!themeContext.includes('L'.repeat(81)), 'theme labels should be capped at 80 characters');
assert(themeContext.includes('D'.repeat(280)), 'theme descriptions should be preserved up to the cap');
assert(!themeContext.includes('D'.repeat(281)), 'theme descriptions should be capped at 280 characters');
assert(!themeContext.includes('missing label'), 'invalid theme seed entries should be skipped');
assert(themeContext.split(';').length === 5, 'theme seed output should be capped to five entries');

// Each blueprint field is carried to the cap the route publishes for *that*
// field, not to the tightest of them. The prompt used to apply one 320 to all
// six, so a logline the form counts down from 420, the 600 characters of world
// details the parser accepts, and the 1200 characters of narrative directives it
// accepts were each cut to 320 with nothing in the response saying so — the
// block they are written into ends by calling them binding story intent.
const storyLabContext = service.formatStoryLabContext(input);
assert(
  storyLabContext.includes('A'.repeat(STORY_BLUEPRINT_LIMITS.maxLoglineLength)),
  'a logline should reach the prompt at the length the blueprint route accepts'
);
assert(
  !storyLabContext.includes('A'.repeat(STORY_BLUEPRINT_LIMITS.maxLoglineLength + 1)),
  'a logline past the route cap should still be cut'
);
// The fixture's world details and narrative directives are 500 characters each,
// inside the 600 and 1200 the parser accepts, so both have to reach the prompt
// whole. The old 320 dropped 180 characters of each.
assert(
  storyLabContext.includes('W'.repeat(500)),
  'world details inside the route cap should reach the prompt whole'
);
assert(
  storyLabContext.includes('N'.repeat(500)),
  'narrative directives inside the route cap should reach the prompt whole'
);
// And the cap is still a cap, at each field's own number.
const oversizedContext = service.formatStoryLabContext(buildInput({ worldDetails: 'W'.repeat(STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength + 200) }));
assert(
  oversizedContext.includes('W'.repeat(STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength)),
  'world details should be carried to their own cap'
);
assert(
  !oversizedContext.includes('W'.repeat(STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength + 1)),
  'world details past their own cap should still be cut'
);
assert(
  storyLabContext.includes('X'.repeat(STORY_BLUEPRINT_LIMITS.maxNoGoContentLength)),
  'no-go content should be preserved up to its own cap'
);
assert(
  !storyLabContext.includes('X'.repeat(STORY_BLUEPRINT_LIMITS.maxNoGoContentLength + 1)),
  'no-go content past its own cap should be cut'
);
assert(!storyLabContext.includes('undefined'), 'malformed prompt context should not render undefined');

// The cut is measured in UTF-16 code units, the unit the routes measure these
// fields in, and it never splits a code point. `slice` did: a cap landing
// between the halves of a surrogate pair left a lone surrogate in the prompt,
// which `JSON.stringify` escapes rather than refuses, so the provider request
// carried a character the reader never typed.
// The leading ASCII character is what puts the cap between the halves of an
// astral one: without it the even cap falls on a character boundary and the old
// `slice` happened to be safe.
const astralLogline = `x${'🜁'.repeat(STORY_BLUEPRINT_LIMITS.maxLoglineLength)}`;
const astralContext = service.formatStoryLabContext(buildInput({ logline: astralLogline }));
assert(
  !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(astralContext),
  'a cut inside an astral character must not leave a lone surrogate in the prompt'
);

// And it backs up to a word boundary rather than ending mid-word: the model is
// shown an excerpt, not a fragment.
// A seven-character word against an even cap, so a raw cut lands inside one.
const wordBoundaryContext = service.formatStoryLabContext(buildInput({ worldDetails: 'abcdef '.repeat(200) }));
const worldDetailsLine = wordBoundaryContext
  .split('\n')
  .find(line => line.startsWith('- World details: '));
assert(worldDetailsLine, 'the world details line should be present');
assert(
  worldDetailsLine.endsWith('abcdef'),
  `a capped field should end on a whole word, not mid-word (ended "${worldDetailsLine.slice(-10)}")`
);

// The continuation prompt is told what the previous chapter's emotional
// register is. `dominan` was a word stem left over from substring matching and
// every keyword is matched as a whole word, so nothing could ever match it: a
// chapter written about dominance and nothing else was described to the model
// as `romantic with building tension`.
const dominanceChapter = '<p>She named the terms. He was dominant in every way that counted.</p>';
const dominanceTone = analyzeEmotionalTone(dominanceChapter);
assert(dominanceTone.includes('intense'), 'a chapter about dominance should read as an intense register');
assert(
  analyzeEmotionalTone('<p>Her dominance was not in question.</p>').includes('intense'),
  'the dominance inflection should be recognised too'
);
assert(
  analyzeEmotionalTone('<p>A quiet supper by the window.</p>') === 'romantic with building tension',
  'a chapter carrying none of the registers should still fall back honestly'
);

// The registers that already worked keep working: this repair spells out one
// alternative, it does not loosen the whole-word matching around it.
assert(
  analyzeEmotionalTone('<p>He took control of the room.</p>').includes('intense'),
  'the registers that already matched should be unchanged'
);
assert(
  !analyzeEmotionalTone('<p>The predominant colour was red.</p>').includes('intense'),
  'a word that merely contains a keyword should still not match'
);

console.log('Story service prompt guard tests passed');
