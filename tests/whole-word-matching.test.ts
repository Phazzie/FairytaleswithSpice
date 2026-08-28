#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The word boundary every keyword scan in this repository asks about, and the
// three scans that used to ask it with `\b`.
//
// `\b` is ASCII-only: JavaScript defines it against `[A-Za-z0-9_]`, so it finds
// a word boundary between an ASCII letter and an accented one. Each assertion
// below names the scan that was wrong because of it and the decision that scan
// feeds — the reported spicy level of a continuation, the threads a
// continuation prompt is told are open, the pressures the continuity courtroom
// reports, the cliffhanger type the next batch is prompted from.

import { CliffhangerService } from '../api/_lib/services/cliffhangerService';
import {
  analyzeEmotionalTone,
  extractPlotThreads,
  extractSpicyLevelFromContent,
  extractThemesFromContent,
  stripSpeakerTagsForDisplay
} from '../api/_lib/services/storyContentAnalysis';
import { previewStoryLabContinuationGuidance } from '../api/_lib/story-lab/continuationGuidance';
import { buildStoryQualityHeuristicReport } from '../api/_lib/story-lab/evaluation/storyQualityHeuristics';
import type { StoryStateSnapshot } from '../api/_lib/story-lab/contracts';
import {
  containsWholeWord,
  wholeWordAlternationPattern,
  wholeWordPattern
} from '../api/_lib/utils/wholeWord';
import { assert } from './assert';

// ==================== the shared matcher ====================

assert(containsWholeWord('she kept the oath', 'oath'), 'A keyword standing alone is the word.');
assert(!containsWholeWord('she began loathing him', 'oath'), 'A keyword inside a longer word is not the word.');

// The three spellings `\b` got wrong, in each of the three positions an accent
// can sit in relative to the keyword.
assert(!containsWholeWord('"touché," he said', 'touch'), '`touch` is not the word in `touché`.');
assert(!containsWholeWord('she caressé his jaw', 'caress'), '`caress` is not the word in `caressé`.');
assert(!containsWholeWord('her sińful pride', 'sin'), '`sin` is not the word in `sińful`.');

// The same word written with a combining mark rather than a precomposed one.
// `\p{M}` in the boundary class is what keeps these two spellings agreeing.
assert(
  !containsWholeWord('the desiré of a saint', 'desire'),
  '`desire` is not the word in a decomposed `desiré`.'
);

// A keyword may not be credited from inside a word in another script either,
// which is the general case the three assertions above are instances of.
assert(!containsWholeWord('плоть', 'плот'), 'A keyword inside a longer Cyrillic word is not the word.');
assert(containsWholeWord('она дала клятву', 'клятву'), 'A non-ASCII keyword standing alone is the word.');

// An underscore joins two words rather than continuing one, and the ids this
// app writes with it name the very words these scans look for. `\b` counted it
// as a word character and so could not see them.
assert(containsWholeWord('tagged power_dynamics', 'power'), 'An underscore ends a word.');

// Phrases take the boundary at their ends, not around each word inside them,
// so a hyphenated or multi-word keyword matches as itself.
assert(containsWholeWord('a star-crossed pair', 'star-crossed'), 'A hyphenated phrase is one keyword.');
assert(containsWholeWord('her blood froze', 'blood froze'), 'A multi-word phrase is one keyword.');
assert(!containsWholeWord('her blood froze', 'blood frozen'), 'A phrase is not credited by a prefix of itself.');

// A keyword carrying regex metacharacters is a literal, not a pattern.
assert(!containsWholeWord('the oath', 'o.th'), 'A metacharacter in a keyword is matched literally.');
assert(containsWholeWord('the o.th', 'o.th'), 'A literal metacharacter still matches itself.');

assert(
  wholeWordAlternationPattern(['choose', 'chose', 'chosen']).test('she chose the door'),
  'An alternation matches any of its spellings.'
);
assert(
  !wholeWordAlternationPattern(['choose', 'chose', 'chosen']).test('she chosé the door'),
  'An alternation is bounded the same way a single keyword is.'
);
assert(
  wholeWordPattern(String.raw`what\s+(?:if|would|could)`).test('but what if she lied'),
  'A pattern source is bounded rather than re-escaped.'
);

// ==================== extractSpicyLevelFromContent ====================
// The level travels back to the caller and the story reopens at it, so a hit
// on a word of fencing banter contradicts the dial the reader set themselves.

assert(
  extractSpicyLevelFromContent('<p>"Touché," he said, and turned back to the map.</p>') === 1,
  '`touché` is not `touch`, so a chaste scene is not level 3.'
);
assert(
  extractSpicyLevelFromContent('<p>He touched her wrist.</p>') === 3,
  'A real `touch` still reads level 3.'
);

// ==================== extractThemesFromContent ====================

assert(
  extractThemesFromContent('<p>A sińful pride ran through the house.</p>').length === 0,
  '`sińful` does not carry the `sin` theme.'
);
assert(
  extractThemesFromContent('<p>Her sins were her own.</p>').includes('sin'),
  'A real `sins` still carries the `sin` theme.'
);

// ==================== extractPlotThreads ====================

assert(
  !extractPlotThreads('<p>The secreté was sealed in wax.</p>').includes('Unresolved mystery or secret'),
  '`secreté` does not open a secret thread.'
);
assert(
  extractPlotThreads('<p>But what if she had lied?</p>').includes('Unresolved questions'),
  'The `what if` phrase still opens an unresolved-question thread.'
);

// ==================== analyzeEmotionalTone ====================

assert(
  analyzeEmotionalTone('<p>A woundé healed slowly.</p>') === 'romantic with building tension',
  'A decomposed `woundé` does not report the wound register.'
);

// ==================== cliffhangerService ====================
// The winning type selects the three continuations the next batch is prompted
// with, so a hook credited from inside another word steers the whole next
// chapter.

const cliffhangerService = new CliffhangerService();
const accentedEnding = cliffhangerService.analyze(
  '<p>The hall emptied.</p><p>She folded the map and walked out into the rain, her nameé forgotten.</p>'
);
assert(
  !accentedEnding.cliffhangerType || accentedEnding.cliffhangerType !== 'mystery',
  '`nameé` is not the `name` hook.'
);
const realEnding = cliffhangerService.analyze(
  '<p>The hall emptied.</p><p>She turned the key and the door swung open on a secret she had buried.</p>'
);
assert(realEnding.cliffhangerDetected, 'A real hook is still detected.');

// ==================== continuationGuidance ====================
// The pressure keywords decide what the continuity courtroom reports as the
// pressure already on the page.

function stateWithThread(label: string, description: string): StoryStateSnapshot {
  return {
    storyId: 'story-1',
    revision: 1,
    characters: [],
    threads: [{
      id: 'thread-1',
      label,
      status: 'active',
      description,
      foreshadowedDevices: [],
      lifetime: 'series'
    }],
    artifacts: [],
    beats: [],
    continuityWarnings: [],
    narrativeVoice: 'third person limited',
    lastUpdatedAt: '2026-08-27T00:00:00.000Z'
  };
}

const accentedPressure = previewStoryLabContinuationGuidance({
  storyState: stateWithThread('The courté', 'A courté sealed the recordé and said nothing.')
});
const realPressure = previewStoryLabContinuationGuidance({
  storyState: stateWithThread('The court', 'The court sealed the record and said nothing.')
});
assert(
  accentedPressure.hiddenGuidance !== realPressure.hiddenGuidance,
  '`courté` is not the `court` pressure keyword, so the two states do not guide alike.'
);

// ==================== storyQualityHeuristics ====================
// The continuity scan already read the boundary this way; the assertion is here
// so the one that was right cannot regress onto `\b` with the three that were
// not.
//
// "This module reads it correctly" was too broad a claim, and the agency
// assertions below are what it missed: the same file's `extractAgencyActions`
// was still ending its verb on `\b`, one lookaround away from the name it had
// just bounded properly.

const heuristicReport = buildStoryQualityHeuristicReport({
  storyContent: '<p>She switched off the lamp and climbed the stair.</p>',
  configuration: { creature: 'witch', themes: [], spicyLevel: 3, wordCount: 900 }
});
assert(
  !heuristicReport.dimensions
    .find(dimension => dimension.id === 'continuity')
    ?.signals.some(signal => signal.includes('Creature appears')),
  '`switched` does not report `Creature appears: witch`.'
);

// ==================== extractAgencyActions ====================
// `Agency actions` is advisory, but it is also worth five points a piece in
// `character_consistency`, so a verb credited from inside another word reports a
// character as having acted and scores them for it. The name is written
// mid-sentence in each case because a sentence-initial capital is explained by
// its position rather than by being a name.

function agencySignals(storyContent: string): string[] {
  return buildStoryQualityHeuristicReport({
    storyContent,
    configuration: { creature: 'vampire', themes: [], spicyLevel: 3, wordCount: 900 }
  }).dimensions
    .find(dimension => dimension.id === 'character_consistency')
    ?.signals.filter(signal => signal.startsWith('Agency actions')) ?? [];
}

assert(
  agencySignals('<p>The lock broke and Mira only said touché.</p>').length === 0,
  '`touché` is not the verb `touch`, so banter is not an agency action.'
);
assert(
  agencySignals('<p>The lock broke and Mira touched the seal.</p>').join() === 'Agency actions: touched',
  'A real `touched` is still credited to the named character.'
);
// The two scored identically before the boundary was fixed -- same signal, same
// 63 -- which is the whole of the defect: the dimension could not tell a
// character who acted from one who made a joke.
assert(
  agencySignals('<p>The lock broke and Mira only said pressé.</p>').length === 0,
  'A decomposed `pressé` is not the verb `press`.'
);

// ==================== narrative shift openers ====================
// `stripSpeakerTagsForDisplay` starts a new paragraph on a short line that opens
// with one of these words. `\b` found a boundary between the ASCII letters of
// `the` and the combining acute after them, so the same word split one way
// precomposed and another way decomposed -- a paragraph break that depended on
// how the model happened to encode one character.

function paragraphCount(line: string): number {
  return stripSpeakerTagsForDisplay(`She turned the key.\n${line}\nHe followed her in.`)
    .split(/\n\s*\n/).length;
}

assert(
  paragraphCount('Théatre lights died.') === paragraphCount('Théatre lights died.'),
  'A decomposed `Théatre` opens no beat that its precomposed spelling does not.'
);
assert(
  paragraphCount('Théatre lights died.') === 1,
  '`Théatre` is not the opener `the`.'
);
assert(paragraphCount('Then the lights died.') === 2, 'A real opener still starts a beat.');

console.log('Whole-word matching tests passed');
