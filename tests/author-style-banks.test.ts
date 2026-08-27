#!/usr/bin/env tsx
// Created: 2026-08-27 UTC

/**
 * The ten author voice banks are what the story prompt asks the model to sound
 * like, and what the Proving Grounds panel tells the reader a run would sound
 * like. They lived twice — once in `api/_lib/config/authorStyles.ts` and once
 * in `GenerationLogicService` — and both ways that arrangement fails had
 * already happened by the time the copies were merged:
 *
 * - an **entry the copies disagree about**: three of the twelve vampire samples
 *   had their em dashes flattened to hyphens on the API side alone, so the
 *   panel showed the reader one sentence and the model was given another; and
 * - a **bank one copy has and the other does not**: the API grew `SIREN_STYLES`
 *   and `DJINN_STYLES` and the panel's copy did not, so for two of the ten
 *   creatures the panel named twelve fae authors for a story written from four
 *   sea or wish voices.
 *
 * So this file asserts the property that stops either recurring: the banks are
 * declared once in `shared/authorStyleBanks.ts`, and both readers read that
 * declaration. A copy pasted back into either tree fails here rather than being
 * noticed by whoever next compares a prompt to its preview.
 *
 * The Angular service is read as source text rather than imported: it is an
 * `@Injectable` and the root test runner has no `@angular/core`, the same
 * arrangement `story-prompt-tables` and `proving-grounds-production-prompt`
 * use.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './assert';
import {
  AUTHOR_STYLE_BANKS,
  PRIMARY_AUTHOR_COUNT,
  SECONDARY_AUTHOR_BANKS,
  SECONDARY_AUTHOR_COUNT,
  getSecondaryAuthorVoices,
  type StoryVoiceCreature
} from '../shared/authorStyleBanks';
import { getAuthorStylesForCreature, selectRandomAuthorStyles } from '../api/_lib/config/authorStyles';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const generationLogicSource = readSource('story-generator/src/app/proving-grounds/generation-logic.service.ts');
const authorStylesSource = readSource('api/_lib/config/authorStyles.ts');
const creatures = Object.keys(AUTHOR_STYLE_BANKS) as StoryVoiceCreature[];

// ==================== The banks themselves ====================

assert(creatures.length === 10, `the blueprint offers ten creatures, found ${creatures.length} banks`);

for (const creature of creatures) {
  const bank = AUTHOR_STYLE_BANKS[creature];
  assert(bank.length >= PRIMARY_AUTHOR_COUNT, `${creature} has fewer voices than a prompt draws from it`);

  for (const voice of bank) {
    for (const field of ['author', 'voiceSample', 'trait'] as const) {
      assert(
        typeof voice[field] === 'string' && voice[field].trim().length > 0,
        `${creature} voice ${voice.author} has no ${field}, and every field is written into the prompt`
      );
      // The rows are delimited, so a cell that still holds the delimiter is a
      // row whose columns did not land where they were meant to — a mistyped
      // edit that would otherwise reach the prompt looking like ordinary prose.
      assert(
        !voice[field].includes('|'),
        `${creature} voice ${voice.author} has a stray delimiter in ${field}; its row is mis-split`
      );
    }
  }

  assert(
    new Set(bank.map(voice => voice.author)).size === bank.length,
    `${creature} names an author twice, so a draw can prompt one voice as if it were two`
  );
}

// No two creatures share a bank object. The API's own reuse assertions name
// three banks by hand, so a new creature pointed at, say, the witch bank passes
// every one of them; this is the same check stated over the whole table.
const bankOwners = new Map<unknown, StoryVoiceCreature>();
for (const creature of creatures) {
  const owner = bankOwners.get(AUTHOR_STYLE_BANKS[creature]);
  assert(owner === undefined, `${creature} shares its voice bank with ${owner}`);
  bankOwners.set(AUTHOR_STYLE_BANKS[creature], creature);
}

// The em dashes the API's copy had flattened. A voice sample is an example of
// an author's prose handed to the model as the thing to sound like, so the mark
// these three sentences are built on is not incidental to them.
const vampireSamples = AUTHOR_STYLE_BANKS.vampire.map(voice => voice.voiceSample).join('\n');
for (const emDashPhrase of ['prey—or perhaps', 'nothing—nothing—had', 'tension—human']) {
  assert(
    vampireSamples.includes(emDashPhrase),
    `the vampire bank should carry "${emDashPhrase}" with its em dash, not a hyphen in its place`
  );
}

// ==================== The blend voice ====================

for (const creature of creatures) {
  const pairing = SECONDARY_AUTHOR_BANKS[creature];
  assert(pairing.length === 2, `${creature} should borrow from two banks`);
  assert(!pairing.includes(creature), `${creature} borrows its blend voice from itself`);
  assert(pairing[0] !== pairing[1], `${creature} names the same bank twice as its pairing`);

  for (const bank of pairing) {
    assert(
      Object.prototype.hasOwnProperty.call(AUTHOR_STYLE_BANKS, bank),
      `${creature} borrows from ${bank}, which is not a creature with a bank`
    );
  }

  const secondary = getSecondaryAuthorVoices(creature);
  assert(
    secondary.length === AUTHOR_STYLE_BANKS[pairing[0]].length + AUTHOR_STYLE_BANKS[pairing[1]].length,
    `${creature}'s blend pool should be exactly the two banks it is paired with`
  );
  assert(
    secondary.every(voice => !AUTHOR_STYLE_BANKS[creature].includes(voice)),
    `${creature}'s blend pool includes a voice from its own bank`
  );
}

// The shape a run actually draws: two from the creature's own bank, one from
// the pair. This is what the panel previews, so the count is part of the
// contract rather than an implementation detail.
for (const creature of creatures) {
  const drawn = selectRandomAuthorStyles(creature);
  assert(
    drawn.length === PRIMARY_AUTHOR_COUNT + SECONDARY_AUTHOR_COUNT,
    `${creature} should be prompted with ${PRIMARY_AUTHOR_COUNT + SECONDARY_AUTHOR_COUNT} voices, got ${drawn.length}`
  );
  assert(
    new Set(drawn.map(voice => voice.author)).size === drawn.length,
    `${creature} drew the same author twice`
  );

  const primaryBank = getAuthorStylesForCreature(creature);
  assert(
    drawn.slice(0, PRIMARY_AUTHOR_COUNT).every(voice => primaryBank.includes(voice)),
    `${creature}'s first ${PRIMARY_AUTHOR_COUNT} voices should come from its own bank`
  );
  assert(
    getSecondaryAuthorVoices(creature).includes(drawn[PRIMARY_AUTHOR_COUNT]),
    `${creature}'s blend voice should come from the banks it is paired with`
  );
}

// ==================== One declaration, two readers ====================

for (const [label, source] of [
  ['authorStyles', authorStylesSource],
  ['GenerationLogicService', generationLogicSource]
] as const) {
  assert(
    /from\s+'[^']*shared\/authorStyleBanks'/.test(source),
    `${label} should read the voice banks from shared/authorStyleBanks`
  );

  // The declaration, not a mention: a docblock may name an author in prose, but
  // an `author:` key is the copy this test exists to prevent.
  assert(
    !/\bauthor:\s*['"]/.test(source),
    `${label} declares voices of its own again; there should be one table`
  );
}

console.log('Author style bank tests passed');
