#!/usr/bin/env tsx
// Created: 2026-08-27 UTC

/**
 * The continuation brief decides which unresolved threads, artifacts,
 * relationships, and warnings the next batch is shown, and the Story Lab's
 * "Continuity Preview" panel exists to show the reader that decision before
 * they press continue — it labels each item `Matched continuation guidance` or
 * names the fallback that put it there.
 *
 * The panel was making that claim from a scorer of its own, written beside the
 * guidance builder's and disagreeing with it in three ways: a three-character
 * token floor rather than four, the best candidate rather than the sum of them,
 * and an apostrophe the guidance's normalizer removes. Nothing failed — the
 * panel simply described a selection the run does not make.
 *
 * So this file pins the one scorer both now read, and the property that keeps
 * them reading it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './assert';
import {
  ACTIVATION_TOKEN_MIN_LENGTH,
  ACTIVATION_WHOLE_CANDIDATE_SCORE,
  formatThreadDebtLabel,
  normalizeActivationText,
  scoreActivationCandidates
} from '../shared/continuityActivation';
import { WORD_INFLECTION_SUFFIXES, WORD_INFLECTION_SUFFIX_PATTERN } from '../shared/wordInflections';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

// ==================== Normalizing ====================

assert(
  normalizeActivationText('  The  Moonlit   Oath. ') === 'the moonlit oath',
  'the normalizer should lowercase, drop punctuation, and collapse the gaps it leaves'
);
assert(
  normalizeActivationText(undefined) === '' && normalizeActivationText(42) === '',
  'anything that is not a string carries no words to compare'
);

// A story written outside Latin script used to normalize to the empty string,
// which dropped it from the comparison entirely and left the courtroom choosing
// by story order alone.
assert(
  normalizeActivationText('Клятва Миры') === 'клятва миры',
  'a non-Latin thread label should keep its words'
);
assert(
  normalizeActivationText('美咲の契約') === '美咲の契約',
  'a label with no spaces in it should survive as one word'
);

// The apostrophe is a separator on both sides of the comparison, so what it
// splits is split the same way in the brief and in the candidate.
assert(
  normalizeActivationText("José's pact") === 'josé s pact',
  'an apostrophe should separate rather than delete the letters around it'
);

// ==================== Scoring ====================

const brief = normalizeActivationText('Pay off the moonlit oath before the reef court sits again.');

assert(scoreActivationCandidates(['Moonlit oath'], '') === 0, 'an empty brief activates nothing');
assert(
  scoreActivationCandidates([], brief) === 0,
  'an item with nothing to recognise it by cannot be activated'
);

// The whole phrase, plus one for each of its words that the brief also carries.
assert(
  scoreActivationCandidates(['Moonlit oath'], brief) === ACTIVATION_WHOLE_CANDIDATE_SCORE + 2,
  'a candidate the brief contains in full should score the phrase and its words'
);

// Candidates are added, not maxed: a thread whose label, description, and
// foreshadowed device each echo the brief is more plainly asked for than one
// whose label alone does, and the panel used to rank those the other way round.
const summed = scoreActivationCandidates(['Moonlit oath', 'The reef court wants the oath paid'], brief);
const strongest = scoreActivationCandidates(['Moonlit oath'], brief);
assert(summed > strongest, 'a second matching candidate should raise the score, not be discarded');

// The token floor. `vow` is three characters, so it counts for nothing on its
// own — which is the disagreement that made the panel report a match the
// guidance had scored zero.
assert(ACTIVATION_TOKEN_MIN_LENGTH === 4, 'the token floor is four characters on both sides');
assert(
  scoreActivationCandidates(['Broken vow'], normalizeActivationText('Honour the vow she made.')) === 0,
  'a short shared word should not activate a candidate the brief never names'
);
assert(
  scoreActivationCandidates(['Broken oath'], normalizeActivationText('Honour the oath she made.')) === 1,
  'a word past the floor should activate the candidate it belongs to'
);

// Stop words are below the floor for the same reason: `the`, `and`, `a` appear
// in every brief and every label, and counting them would score everything
// against everything.
assert(
  scoreActivationCandidates(['The glass key'], normalizeActivationText('The duke and the ledger.')) === 0,
  'the words every brief contains should not activate anything'
);

// ==================== The word, not the substring ====================
// The floor above bounds how short a token may be; it says nothing about where
// one ends. `includes` was the reading, and these needles are exactly the length
// that collides: `oath` is inside `loathing`, `pact` inside `impact`, `court`
// inside `courtesy`. This is the last door of the substring family
// `extractThemesFromContent`, `extractSpicyLevelFromContent`, and `containsAny`
// were each moved off, and the one that orders the whole selection — so a
// collision here does not merely mis-score an item, it puts a thread the brief
// never named in front of the model and drops the one it did.

assert(
  scoreActivationCandidates(['Broken oath'], normalizeActivationText('I want more about the loathing between them.')) === 0,
  '`loathing` does not name the `oath` a thread is called after'
);
assert(
  scoreActivationCandidates(['Blood pact'], normalizeActivationText('Show me the impact of her choice.')) === 0,
  '`impact` does not name a `pact`'
);
assert(
  scoreActivationCandidates(['The reef court'], normalizeActivationText('She answered with courtesy.')) === 0,
  '`courtesy` does not name the `court`'
);

// The whole-candidate score is the same question asked of a phrase, and it was
// the same `includes`: a phrase has to sit on word boundaries at both ends.
assert(
  scoreActivationCandidates(['Oath'], normalizeActivationText('She began loathing him.')) === 0,
  'a one-word candidate is not named whole by a word that merely contains it'
);
// `moonlit` really is in this brief, so the candidate keeps that one point; what
// it must not keep is the whole-phrase score, which `oathkeeper` used to supply.
assert(
  scoreActivationCandidates(['Moonlit oath'], normalizeActivationText('The moonlit oathkeeper waited.')) === 1,
  'a phrase is not named whole by a longer word its last token merely starts'
);

// A whole-word matcher with no inflection table passes the "no false positives"
// half of this repair and quietly costs the scan its real signal, which is the
// lesson `continuationGuidance` recorded when it made the same move. `oaths` and
// `pacts` are matches the substring reading got right, and they survive.
assert(
  scoreActivationCandidates(['Broken oath'], normalizeActivationText('Honour the oaths she made.')) === 1,
  'a plural of the token still activates the candidate'
);
assert(
  scoreActivationCandidates(['Blood pact'], normalizeActivationText('Settle the pacts between them.')) === 1,
  'a plural still activates where the bare substring reading would have'
);
assert(
  scoreActivationCandidates(['A caress'], normalizeActivationText('She caressed the hilt.')) === 1,
  'a past tense still activates'
);
// Only the endings, and only at the end: the brief's word has to begin with the
// token. This is the half of the substring reading that was sound, and it is
// what keeps the three collisions above refused while the three matches here
// are kept -- `courtesy` begins with `court` and continues `esy`, which is not
// an ending a word keeps its meaning across.
assert(
  scoreActivationCandidates(['The reef court'], normalizeActivationText('The courts sat again.')) === 1,
  '`courts` is the `court`, where `courtesy` is not'
);
assert(
  scoreActivationCandidates(['A name'], normalizeActivationText('She was nameless by then.')) === 0,
  '`less` is not an ending this set carries, so `nameless` is not the `name`'
);

// The set is read two ways -- as a list here, and as a regex alternation that
// `storyQualityHeuristics` interpolates after an escaped keyword. That second
// reading is only safe while every ending is plain lowercase letters, which is a
// property of the list rather than of the line that joins it.
assert(
  WORD_INFLECTION_SUFFIXES.every(suffix => /^[a-z]+$/.test(suffix)),
  'every inflection ending is plain lowercase letters, so the alternation needs no escaping'
);
assert(
  WORD_INFLECTION_SUFFIX_PATTERN === '(?:s|es|d|ed|ing|r|rs)?',
  'the shared alternation is the one storyQualityHeuristics used to spell inline'
);

// The matches the substring reading got right are still matches: an exact word,
// a phrase sitting on its own boundaries, and a word at either end of the brief.
assert(
  scoreActivationCandidates(['Moonlit oath'], normalizeActivationText('Pay off the moonlit oath.'))
    === ACTIVATION_WHOLE_CANDIDATE_SCORE + 2,
  'a phrase the brief states in full still scores whole and by each of its words'
);
assert(
  scoreActivationCandidates(['Oath'], normalizeActivationText('oath')) === ACTIVATION_WHOLE_CANDIDATE_SCORE + 1,
  'a brief that is nothing but the candidate still activates it at both ends of the string'
);

// ==================== The thread label ====================

assert(formatThreadDebtLabel('escalating') === 'Pressure rising', 'an escalating thread is pressure rising');
assert(formatThreadDebtLabel('dormant') === 'Quiet promise', 'a dormant thread is a quiet promise');
assert(formatThreadDebtLabel('active') === 'Open promise', 'an active thread is an open promise');

// ==================== One declaration, two readers ====================

for (const [label, path] of [
  ['continuationGuidance', 'api/_lib/story-lab/continuationGuidance.ts'],
  ['AppComponent', 'story-generator/src/app/app.ts']
] as const) {
  const source = readSource(path);

  assert(
    /from\s+'[^']*shared\/continuityActivation'/.test(source),
    `${label} should read the activation scorer from shared/continuityActivation`
  );
  assert(
    !/function\s+\w*[Nn]ormalize\w*ActivationText/.test(source)
      && !/\bnormalize\w*ActivationText\s*\(value/.test(source),
    `${label} declares its own activation normalizer again; there should be one`
  );
  assert(
    !/function\s+score\w*Activation(Candidates|Match)\s*\(/.test(source),
    `${label} declares its own activation scorer again; there should be one`
  );
}

console.log('Continuity activation tests passed');
