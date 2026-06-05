#!/usr/bin/env tsx
// Created: 2026-06-03 04:43 EDT

import { parseBlueprint } from '../api/story-lab/stream/genesis';
import type { CreatureType } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function requestForCreature(creature: CreatureType) {
  return {
    query: {
      creature,
      tone: 'dark_romance',
      spicyLevel: '2',
      desiredWordBudget: '600',
      chapterBatchSize: '1',
      logline: `${creature} tests the Story Lab streaming parser.`,
      themes: JSON.stringify([
        {
          id: 'forbidden_love',
          label: 'Forbidden Love',
          description: 'Desire has consequences.'
        }
      ]),
      heatContract: JSON.stringify({
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'fade_to_black',
        noGoContent: 'No coercion.'
      })
    }
  };
}

const charmedCreatures: CreatureType[] = ['witch', 'dragon', 'demon', 'angel', 'mermaid'];

for (const creature of charmedCreatures) {
  const result = parseBlueprint(requestForCreature(creature));
  assert(!result.error, `${creature} should be accepted by Story Lab stream parser`);
  assert(result.blueprint.creature === creature, `${creature} should survive stream parser`);
  assert(result.blueprint.themes[0].id === 'forbidden_love', `${creature} should preserve theme seeds`);
  assert(result.blueprint.heatContract?.adultOnlyConfirmed === true, `${creature} should preserve Heat Contract`);
}

const invalidResult = parseBlueprint(requestForCreature('dragon' as CreatureType & string));
assert(!invalidResult.error, 'valid dragon baseline should parse before invalid mutation');

const badResult = parseBlueprint({
  query: {
    ...requestForCreature('dragon').query,
    creature: 'gargoyle'
  }
});
assert(badResult.error?.message.includes('witch'), 'invalid creature message should list expanded creature options');
assert(badResult.error?.invalidFields.includes('creature'), 'invalid creature should be reported by field');

console.log('Story Lab stream parser tests passed');
