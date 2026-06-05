import {
  parseStoryLabBlueprintFromBody,
  parseStoryLabBlueprintFromQuery
} from '../api/_lib/story-lab/validation/blueprintParser';
import type { CreatureType } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const allCreatures: CreatureType[] = [
  'vampire',
  'werewolf',
  'fairy',
  'siren',
  'djinn',
  'witch',
  'dragon',
  'demon',
  'angel',
  'mermaid'
];

function bodyForCreature(creature: CreatureType) {
  return {
    creature,
    tone: 'dark_romance',
    spicyLevel: 3,
    desiredWordBudget: 900,
    chapterBatchSize: 2,
    logline: `A ${creature} tests shared Story Lab validation.`,
    themes: [
      {
        id: 'forbidden_love',
        label: 'Forbidden Love',
        description: 'Desire has consequences.'
      }
    ],
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: 'No coercion.'
    }
  };
}

for (const creature of allCreatures) {
  const postResult = parseStoryLabBlueprintFromBody(bodyForCreature(creature));
  assert(!postResult.error, `${creature} should parse from POST body`);
  assert(postResult.blueprint.creature === creature, `${creature} should survive POST parsing`);
  assert(postResult.blueprint.logline === `A ${creature} tests shared Story Lab validation.`, `${creature} logline should be trimmed and preserved`);
  assert(postResult.blueprint.themes[0].id === 'forbidden_love', `${creature} themes should survive POST parsing`);
  assert(postResult.blueprint.heatContract?.adultOnlyConfirmed === true, `${creature} Heat Contract should survive POST parsing`);

  const queryResult = parseStoryLabBlueprintFromQuery({
    ...bodyForCreature(creature),
    spicyLevel: '3',
    desiredWordBudget: '900',
    chapterBatchSize: '2',
    themes: JSON.stringify(bodyForCreature(creature).themes),
    heatContract: JSON.stringify(bodyForCreature(creature).heatContract)
  });

  assert(!queryResult.error, `${creature} should parse from stream query`);
  assert(JSON.stringify(queryResult.blueprint) === JSON.stringify(postResult.blueprint), `${creature} POST and query parsing should normalize identically`);
}

const invalidCreature = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  creature: 'gargoyle'
});
assert(invalidCreature.error?.message.includes('vampire'), 'invalid creature message should list supported creature options');

const invalidBody = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  logline: '   ',
  chapterBatchSize: 4
});
assert(invalidBody.error?.invalidFields.includes('logline'), 'blank logline should be reported as invalid');
assert(invalidBody.error?.invalidFields.includes('chapterBatchSize'), 'invalid chapterBatchSize should be reported as invalid');

console.log('Story Lab shared blueprint parser tests passed');
