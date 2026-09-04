#!/usr/bin/env tsx
// Created: 2026-06-21 20:57 UTC

import { StoryService } from '../api/_lib/services/storyService';
import type { ChapterContinuationSeam, StoryGenerationSeam } from '../api/_lib/types/contracts';
import type { HeatContract } from '../api/_lib/story-lab/contracts';
import { analyzeEmotionalTone } from '../api/_lib/services/storyContentAnalysis';
import { withMergedContentBoundaries } from '../api/_lib/story-lab/contentBoundaries';
import {
  STORY_BLUEPRINT_LIMITS,
  STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH,
  STORY_LAB_PROFILE_LIMITS
} from '../shared/storyBlueprintLimits';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const service = new StoryService() as unknown as {
  formatThemeContext(input: StoryGenerationSeam['input']): string;
  formatStoryLabContext(input: StoryGenerationSeam['input']): string;
  formatContinuationStoryLabContext(context: ChapterContinuationSeam['input']['generationContext']): string;
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
// `noGoContent` is the one field whose prompt bound is not its own route cap,
// because `withMergedContentBoundaries` puts two capped sources in it. The
// fixture's 500 characters are inside the merged bound and so reach the prompt
// whole; the bound is still a bound at the sum of the two.
assert(
  storyLabContext.includes('X'.repeat(500)),
  'no-go content inside the merged bound should reach the prompt whole'
);
const oversizedNoGo = service.formatStoryLabContext(buildInput({
  heatContract: {
    ...baseGenerationContext.heatContract,
    noGoContent: 'X'.repeat(STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH + 200)
  }
}));
assert(
  oversizedNoGo.includes('X'.repeat(STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH)),
  'no-go content should be carried to the merged bound'
);
assert(
  !oversizedNoGo.includes('X'.repeat(STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH + 1)),
  'no-go content past the merged bound should still be cut'
);

// The merge itself, which is what the bound is for. `withMergedContentBoundaries`
// joins a reader's profile-wide `contentBoundaries` onto the request's own
// no-go list with a newline, so a request already at its own cap produces a
// value 641 characters wide. Measured against one source's 320 that kept the
// request's half and **none** of the profile's: the reader's standing
// boundaries were deleted in full, at the last step before the model, having
// survived the profile route that deliberately refuses rather than shortens
// them.
const requestHalf = 'R'.repeat(STORY_BLUEPRINT_LIMITS.maxNoGoContentLength);
const profileHalf = 'P'.repeat(STORY_LAB_PROFILE_LIMITS.maxContentBoundariesLength);
const mergedNoGo = service.formatStoryLabContext(buildInput({
  heatContract: {
    ...baseGenerationContext.heatContract,
    noGoContent: withMergedContentBoundaries(
      { ...baseGenerationContext.heatContract, noGoContent: requestHalf } as HeatContract,
      profileHalf
    ).noGoContent
  }
}));
assert(
  mergedNoGo.includes(requestHalf),
  'the request half of a merged no-go list should reach the prompt whole'
);
assert(
  mergedNoGo.includes(profileHalf),
  'the profile half of a merged no-go list should reach the prompt whole'
);

// The merged bound is the sum of two caps, so it is the right number only if
// neither source can be wider than the cap it is the sum of — and both can.
// The request's half is capped by nothing on the continuation path, and a
// stored profile may predate its own cap, which
// `normalizeStoryLabProfilePreferences` deliberately keeps loading. Either one
// spends the other's share and the bound then deletes a whole half, which is
// the defect the bound exists to stop, one source further up. `capNoGoSource`
// holds each to its own cap while they are still separate.
for (const [label, requestLength, profileLength] of [
  ['a request half past every cap', 700, STORY_LAB_PROFILE_LIMITS.maxContentBoundariesLength],
  ['a stored profile predating its cap', STORY_BLUEPRINT_LIMITS.maxNoGoContentLength, 700],
  ['both halves oversized', 900, 900]
] as Array<[string, number, number]>) {
  const oversizedMerge = withMergedContentBoundaries(
    { ...baseGenerationContext.heatContract, noGoContent: 'R'.repeat(requestLength) } as HeatContract,
    'P'.repeat(profileLength)
  ).noGoContent!;
  assert(
    oversizedMerge.length <= STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH,
    `${label} should merge within the bound, got ${oversizedMerge.length}`
  );
  for (const [builder, block] of [
    ['genesis', service.formatStoryLabContext(buildInput({
      heatContract: { ...baseGenerationContext.heatContract, noGoContent: oversizedMerge }
    }))],
    ['continuation', continuationBlock(oversizedMerge)]
  ] as Array<[string, string]>) {
    const line = block.split('\n').find(candidate => candidate.startsWith('- No-go content:')) ?? '';
    assert(
      line.includes('R'.repeat(STORY_BLUEPRINT_LIMITS.maxNoGoContentLength)),
      `${label} should keep a full request half in the ${builder} prompt`
    );
    assert(
      line.includes('P'.repeat(STORY_LAB_PROFILE_LIMITS.maxContentBoundariesLength)),
      `${label} should keep a full profile half in the ${builder} prompt`
    );
  }
}

// And the merge stays a no-op where it always was: nothing to add leaves the
// contract alone, and a request that carried no no-go list of its own takes the
// profile's without a stray separator in front of it.
assert(
  withMergedContentBoundaries(
    { ...baseGenerationContext.heatContract, noGoContent: 'Keep me.' } as HeatContract,
    undefined
  ).noGoContent === 'Keep me.',
  'a merge with no boundaries to add should leave the contract alone'
);
assert(
  withMergedContentBoundaries(
    { ...baseGenerationContext.heatContract, noGoContent: '' } as HeatContract,
    'Only mine.'
  ).noGoContent === 'Only mine.',
  'a merge onto an empty no-go list should not leave a separator'
);
assert(!storyLabContext.includes('undefined'), 'malformed prompt context should not render undefined');

// The continuation builder writes the same Heat Contract into the same shape of
// block, on the path that produces every chapter after the first, and it read
// `noGoContent` with a bare `.trim()` instead of through the boundary above.
// `limitStoryLabPromptText`'s docblock states the rule as covering every Story
// Lab field that reaches a prompt, "the Heat Contract's no-go list" named among
// them; this builder was the exception.
function continuationBlock(noGoContent: string): string {
  return service.formatContinuationStoryLabContext({
    source: 'story_lab',
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'dangerous_proximity',
      intimacyBoundary: 'fade_to_black',
      noGoContent
    }
  } as ChapterContinuationSeam['input']['generationContext']);
}

// The cap. No continuation route parses a blueprint — the story route spreads
// the request body and the job route's normalizer ends `heatContract:
// partial.heatContract` — so this is the only bound the field has on that path,
// and there was none: 50,000 characters reached the model in full.
const oversizedContinuation = continuationBlock('Y'.repeat(50_000));
assert(
  oversizedContinuation.includes('Y'.repeat(STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH)),
  'a continuation no-go list should be carried to the merged bound'
);
assert(
  !oversizedContinuation.includes('Y'.repeat(STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH + 1)),
  'a continuation no-go list past the merged bound should be cut'
);

// The whitespace collapse, which is what keeps the value on the line it was
// written into. A newline here is the ordinary case rather than a malformed
// one: `withMergedContentBoundaries` writes one. Read raw, the profile's half
// landed as a bare line inside a block of `- ` bullets — no longer part of the
// no-go item, and indistinguishable from one of the app's own constraints.
const mergedContinuation = continuationBlock(
  withMergedContentBoundaries(
    {
      adultOnlyConfirmed: true,
      tensionMode: 'dangerous_proximity',
      intimacyBoundary: 'fade_to_black',
      noGoContent: requestHalf
    } as HeatContract,
    profileHalf
  ).noGoContent!
);
const noGoLines = mergedContinuation.split('\n').filter(line => line.startsWith('- No-go content:'));
assert(noGoLines.length === 1, 'a merged continuation no-go list should be one prompt line');
assert(
  noGoLines[0].includes(requestHalf) && noGoLines[0].includes(profileHalf),
  'both halves of a merged continuation no-go list should stay on that line'
);
assert(
  mergedContinuation.split('\n').every(line => line === '' || line.startsWith('- ') || line.endsWith(':')),
  'no part of a no-go list should reach the prompt as a line of its own'
);

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
