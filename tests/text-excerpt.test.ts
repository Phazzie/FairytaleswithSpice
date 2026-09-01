#!/usr/bin/env tsx
// Created: 2026-08-26 UTC

import {
  capAtWordBoundary,
  capAtWordBoundaryWithinCodeUnits,
  tailAtWordBoundary
} from '../api/_lib/utils/textExcerpt';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasLoneSurrogate(value: string): boolean {
  return [...value].some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0xd800 && code <= 0xdfff;
  });
}

// ==================== capAtWordBoundary ====================

assert(capAtWordBoundary('short enough', 40) === 'short enough', 'text inside the cap is returned untouched');

// The cap counts characters, not UTF-16 code units. `🗝` is one character and
// two units, so a cap that counted units could cut it in half; every caller
// here hands the result to a model, where a lone surrogate is a character the
// story never contained.
const astralCap = capAtWordBoundary('key 🗝 tail', 5);
assert(!hasLoneSurrogate(astralCap), `an astral character must be kept whole or dropped whole, got ${JSON.stringify(astralCap)}`);
assert(Array.from(astralCap).length <= 5, 'the cap counts code points');

// The whole point of an astral test is the boundary that falls inside the pair,
// so cut at exactly the character before it and at the character itself.
assert(capAtWordBoundary('ab🗝', 2) === 'ab', 'a cap that stops before the pair keeps what came before it');
assert(capAtWordBoundary('ab🗝cd', 3) === 'ab🗝', 'a cap that reaches the pair keeps the whole pair');

// And the word. A cut at an arbitrary offset ends mid-word, so the model is
// shown a fragment and asked to continue from it.
const wordCap = capAtWordBoundary('the hunter opened the door', 14);
assert(wordCap === 'the hunter', `the cap should back up to a word boundary, got ${JSON.stringify(wordCap)}`);
assert(!/\s$/.test(wordCap), 'backing up should not leave trailing whitespace');

// A first word longer than the whole cap has no whitespace to back up to, and
// is kept as it is rather than becoming nothing at all.
assert(capAtWordBoundary('antidisestablishmentarianism', 10) === 'antidisest', 'an over-long first word is still cut, at a character boundary');

// ---- The cut that broke nothing ----
// Backing up unconditionally cost a word the cut had not touched: at 10 the cut
// falls exactly where `beta` ends, and the answer was `alpha` rather than
// `alpha beta`. The claim this module makes about itself is that backing up
// "costs at most one word"; it was costing one that was still whole.
assert(
  capAtWordBoundary('alpha beta gamma', 10) === 'alpha beta',
  'a cut that lands exactly where a word ends must keep that word'
);

// The same boundary reached from the other side: the cut includes the space, so
// the last word inside it is whole and only the whitespace is given back.
assert(
  capAtWordBoundary('alpha beta gamma', 11) === 'alpha beta',
  'a cut that includes the following space keeps the word before it, without the space'
);

// And the case that must not change: a cut inside `gamma` really did break a
// word, so that word goes back.
assert(
  capAtWordBoundary('alpha beta gamma', 14) === 'alpha beta',
  'a cut inside a word still gives that word back'
);

// ==================== tailAtWordBoundary ====================

assert(tailAtWordBoundary('short enough', 40) === 'short enough', 'text inside the tail is returned untouched');

// The mirror: the continuation prompt shows the model the most recent prose, so
// the cut is at the front, and `slice(-n)` counted units there too.
const astralTail = tailAtWordBoundary('lead 🗝 key', 5);
assert(!hasLoneSurrogate(astralTail), `the tail must not begin on half a character, got ${JSON.stringify(astralTail)}`);
assert(Array.from(astralTail).length <= 5, 'the tail counts code points');

assert(tailAtWordBoundary('🗝cd', 2) === 'cd', 'a tail that starts after the pair keeps what came after it');
assert(tailAtWordBoundary('ab🗝cd', 3) === '🗝cd', 'a tail that reaches the pair keeps the whole pair');

const wordTail = tailAtWordBoundary('the hunter opened the door', 14);
assert(wordTail === 'the door', `the tail should move forward to a word boundary, got ${JSON.stringify(wordTail)}`);
assert(!/^\s/.test(wordTail), 'moving forward should not leave leading whitespace');

// A tail with no whitespace in it at all is kept as it is, for the same reason
// the cap keeps an over-long first word: dropping it would leave nothing.
assert(tailAtWordBoundary('antidisestablishmentarianism', 10) === 'ntarianism', 'an unbroken tail is still cut, at a character boundary');

// ---- The mirror of the cut that broke nothing ----
// At 10 the tail starts exactly where `beta` starts, and moving forward anyway
// answered `gamma` — a word of the model's most recent prose thrown away
// because the cut happened to be clean.
assert(
  tailAtWordBoundary('alpha beta gamma', 10) === 'beta gamma',
  'a tail that starts exactly where a word starts must keep that word'
);

assert(
  tailAtWordBoundary('alpha beta gamma', 11) === 'beta gamma',
  'a tail that starts on the preceding space keeps the word after it, without the space'
);

assert(
  tailAtWordBoundary('alpha beta gamma', 9) === 'gamma',
  'a tail that starts inside a word still gives that word up'
);

// ==================== capAtWordBoundaryWithinCodeUnits ====================
// The same cut for `continuationGuidance`, whose per-line budget is spent in
// `.length` — UTF-16 code units — rather than in code points.

assert(
  capAtWordBoundaryWithinCodeUnits('short enough', 40) === 'short enough',
  'text inside the cap is returned untouched'
);

// An astral character costs two units, so it is taken whole or not at all: the
// `slice` this replaces would have cut between its halves and left a lone
// surrogate in the continuation prompt.
const unitAstral = capAtWordBoundaryWithinCodeUnits('ab🗝', 3);
assert(!hasLoneSurrogate(unitAstral), `an astral character must be kept whole or dropped whole, got ${JSON.stringify(unitAstral)}`);
assert(unitAstral === 'ab', 'a pair that does not fit the remaining units is dropped whole');
assert(capAtWordBoundaryWithinCodeUnits('ab🗝', 4) === 'ab🗝', 'a pair that fits is kept');

// The budget is the caller's, and it is in code units: an astral character must
// never let one line spend more of it than the cap allows.
const budgeted = capAtWordBoundaryWithinCodeUnits('🗝🗝🗝🗝', 5);
assert(budgeted.length <= 5, `the cap counts code units, got length ${budgeted.length}`);

const unitWords = capAtWordBoundaryWithinCodeUnits('the hunter opened the door', 14);
assert(unitWords === 'the hunter', `the cut should back up to a word boundary, got ${JSON.stringify(unitWords)}`);
assert(!/\s$/.test(unitWords), 'backing up should not leave trailing whitespace');

assert(
  capAtWordBoundaryWithinCodeUnits('antidisestablishmentarianism', 10) === 'antidisest',
  'an unbroken first word longer than the cap is still cut, at a character boundary'
);

// The code-unit cut reads the character it stopped before too, so it recognises
// the same clean boundary the code-point cut does.
assert(
  capAtWordBoundaryWithinCodeUnits('alpha beta gamma', 10) === 'alpha beta',
  'a code-unit cut that lands exactly where a word ends must keep that word'
);

// The character after the cut may be the first half of a surrogate pair rather
// than whitespace, and half a character is not a word boundary: `🗝` did not
// end `beta`, so `beta` is still a broken word and goes back.
assert(
  capAtWordBoundaryWithinCodeUnits('alpha beta🗝 gamma', 10) === 'alpha',
  'a cut that stops before an astral character has not found a word boundary'
);

console.log('Text excerpt tests passed');
