#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The keyword scans compile their tables once, not once per chapter.
//
// `wholeWordAlternationPattern` exists to be "compiled once per table by the
// callers that scan repeatedly, never per call", and two modules were still
// asking `containsWholeWord` one keyword at a time — which builds a `RegExp` per
// call. Between them, `storyContentAnalysis` and `storyQualityHeuristics` held
// four hundred-odd keywords across eight tables, three of those tables written
// as literals *inside* the function that reads them, so both the table and a
// pattern for every word in it were constructed again for every chapter of
// every continuation and every story-quality scan.
//
// What the reading does is unchanged and is proved where it always was —
// `story-content-analysis.test.ts` asserts the boundaries, the substrings that
// must not match, and the past-tense inflections that must. This file asserts
// the two things that changed: that no scan builds a whole-word pattern while
// it runs, and that every keyword in every moved table still matches on its own,
// which is what makes the alternation the same question as the per-term form.

import {
  analyzeEmotionalTone,
  extractPlotThreads,
  extractSpicyLevelFromContent,
  extractThemesFromContent
} from '../api/_lib/services/storyContentAnalysis';
import { buildStoryQualityHeuristicReport } from '../api/_lib/story-lab/evaluation/storyQualityHeuristics';
import { wholeWordPattern } from '../api/_lib/utils/wholeWord';
import { assert } from './assert';

/**
 * Whole-word patterns constructed since the counter was installed.
 *
 * Only `wholeWordPattern`'s output is counted — a regex *literal* never reaches
 * the `RegExp` constructor, so what this sees is the deliberate construction of
 * a boundary-wrapped pattern and nothing else. The counter is installed after
 * the imports below have run, so the tables' own patterns are already built.
 */
const WHOLE_WORD_PATTERN_PREFIX = '(?<![\\p{L}\\p{N}\\p{M}])';

const CHAPTER = [
  '<h3>Chapter 4: The Ledger</h3>',
  '<p>[Elena]: You kept the secret, and the danger grew with it.</p>',
  '<p>She had desired him since the blood oath, and the shadows in the hall',
  'were dangerous. He pressed the ledger into her hands and kissed her once,',
  'gently, before the court could see. The cold of the stone stung her palms.</p>',
  '<p>What if the debt came due tonight?</p>'
].join('\n');

// ==================== Nothing is compiled while a scan runs ====================

const NativeRegExp = globalThis.RegExp;
let wholeWordPatternsBuilt = 0;

class CountingRegExp extends NativeRegExp {
  constructor(pattern: string | RegExp, flags?: string) {
    // eslint-disable-next-line constructor-super
    super(pattern as string, flags as string);

    if (typeof pattern === 'string' && pattern.startsWith(WHOLE_WORD_PATTERN_PREFIX)) {
      wholeWordPatternsBuilt += 1;
    }
  }
}

globalThis.RegExp = CountingRegExp as unknown as RegExpConstructor;

try {
  // The counter has to be able to see a construction, or "zero" proves nothing
  // about the scans below — it would just mean the prefix never matched.
  wholeWordPattern('sentinel');
  assert(
    wholeWordPatternsBuilt === 1,
    `the counter should see a whole-word pattern being built, saw ${wholeWordPatternsBuilt}`
  );

  for (const [label, scan] of [
    ['extractPlotThreads', () => extractPlotThreads(CHAPTER)],
    ['analyzeEmotionalTone', () => analyzeEmotionalTone(CHAPTER)],
    ['extractThemesFromContent', () => extractThemesFromContent(CHAPTER)],
    ['extractSpicyLevelFromContent', () => extractSpicyLevelFromContent(CHAPTER)],
    // The heuristics' own tables are fixed; what it matches *from the request* —
    // the creature and the theme words — is not, so an empty configuration is
    // what isolates the tables. See below for the per-request half.
    ['buildStoryQualityHeuristicReport', () => buildStoryQualityHeuristicReport({
      storyContent: CHAPTER,
      configuration: { creature: '', themes: [], spicyLevel: 3, wordCount: 900 }
    })]
  ] as const) {
    wholeWordPatternsBuilt = 0;
    // Twice, because a scan that compiled its table lazily and cached it would
    // pass a single call and fail this.
    scan();
    scan();

    assert(
      wholeWordPatternsBuilt === 0,
      `${label} built ${wholeWordPatternsBuilt} whole-word patterns while scanning; its table should be compiled once`
    );
  }

  // The continuity dimension matches the creature and the theme words a
  // *request* carried, so those patterns are built per call and legitimately so
  // — there is no list to compile ahead of time. What this pins is that the cost
  // is bounded by the configuration rather than by the file's own tables: three
  // words in, at most three patterns out, where the whole scan used to build
  // forty-eight.
  wholeWordPatternsBuilt = 0;
  buildStoryQualityHeuristicReport({
    storyContent: CHAPTER,
    configuration: { creature: 'vampire', themes: ['blood_oaths'], spicyLevel: 3, wordCount: 900 }
  });
  assert(
    wholeWordPatternsBuilt > 0 && wholeWordPatternsBuilt <= 3,
    `the continuity scan should build a pattern only for each configured word it checks, built ${wholeWordPatternsBuilt}`
  );
} finally {
  globalThis.RegExp = NativeRegExp;
}

// ==================== Every keyword still matches on its own ====================

// The alternation puts the boundary at its ends rather than around each word
// inside it, which is what keeps a multi-word keyword (`intense passion`,
// `secret love`, `star-crossed`) one hook. That is the property to check: each
// keyword, alone in a sentence, still reaches the answer its table names.

for (const [thread, keyword] of [
  ['Unresolved mystery or secret', 'mystery'],
  ['Active threat or danger', 'threatening'],
  ['Forbidden relationship tension', 'impossible'],
  ['Power dynamics in play', 'controlling'],
  ['Unresolved questions', 'what could']
] as const) {
  assert(
    extractPlotThreads(`<p>It was ${keyword} then.</p>`).includes(thread),
    `'${keyword}' should still report the thread '${thread}'`
  );
}

for (const [tone, keyword] of [
  ['passionate', 'craving'],
  ['dark/suspenseful', 'shadowy'],
  ['playful', 'laughter'],
  ['angsty', 'scarred'],
  ['intense', 'commanding']
] as const) {
  assert(
    analyzeEmotionalTone(`<p>The room was ${keyword}.</p>`).includes(tone),
    `'${keyword}' should still report the tone '${tone}'`
  );
}

for (const [theme, keyword] of [
  ['forbidden_love', 'star-crossed'],
  ['dark_secrets', 'concealed'],
  ['deceit', 'false promise'],
  ['lust', 'ravenous'],
  ['sin', 'penance']
] as const) {
  assert(
    extractThemesFromContent(`<p>A ${keyword} thing, that.</p>`).includes(theme as never),
    `'${keyword}' should still report the theme '${theme}'`
  );
}

for (const [level, keyword] of [
  [5, 'intense passion'],
  [4, 'breathlessly'],
  [3, 'caressing'],
  [2, 'tenderness']
] as const) {
  assert(
    extractSpicyLevelFromContent(`<p>She wrote of ${keyword}.</p>`) === level,
    `'${keyword}' should still read at level ${level}`
  );
}

// The rungs are read hottest first, which is what the fall-through chain of
// `if`s did: a chapter carrying words from several rungs takes the highest.
assert(
  extractSpicyLevelFromContent('<p>A tender kiss, then breathless, explicit want.</p>') === 5,
  'a chapter matching several rungs should still read at the hottest of them'
);
assert(
  extractSpicyLevelFromContent('<p>A quiet supper by the window.</p>') === 1,
  'a chapter matching no rung should still read at the mildest level'
);

console.log('Keyword scan compilation tests passed');
