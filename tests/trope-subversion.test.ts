#!/usr/bin/env tsx

import {
  TropeSubversionService,
  type TropeSelection,
  type TropeSubversionOptions
} from '../api/_lib/services/tropeSubversionService';
import { TROPE_DATABASE } from '../api/_lib/data/tropeDatabase';
import { CREATURE_ARCHETYPES } from '../api/_lib/story-lab/contracts';
import { StoryService } from '../api/_lib/services/storyService';
import type { StoryGenerationSeam } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const service = new TropeSubversionService();

// Every loop below iterates `Object.keys(TROPE_DATABASE)`, so none of them can
// notice a creature the table never had: a missing bank is not a failing case,
// it is a case that never runs. That is how siren, djinn, witch, dragon, demon,
// angel, and mermaid went the whole time with no tropes at all — seven of the
// ten creatures the blueprint offers, each one generating with no subversion
// directives in its prompt and no `tropeMetadata` for its continuations — while
// this file passed. The check has to come from the creature list rather than
// from the table being checked.
for (const creature of CREATURE_ARCHETYPES) {
  assert(
    Object.prototype.hasOwnProperty.call(TROPE_DATABASE, creature),
    `${creature}: every creature the blueprint offers needs a trope bank, or its stories get no subversion directives at all`
  );
  assert(
    service.supportsCreature(creature),
    `${creature}: TropeSubversionService should report support for every blueprint creature`
  );
}

// The banks also have to be comparably deep. `createWeightedTropePool` pushes
// each common trope three times, so a thin bank still fills a request — by
// repeating the same handful of tropes across every generation for that
// creature, which is the variety this feature exists to provide.
const REQUIRED_COMMON_TROPES = 10;
const REQUIRED_SUBVERSIVE_TROPES = 5;
const seenTropeIds = new Set<string>();

for (const creature of Object.keys(TROPE_DATABASE) as Array<keyof typeof TROPE_DATABASE>) {
  const bank = TROPE_DATABASE[creature];

  assert(
    bank.common.length >= REQUIRED_COMMON_TROPES,
    `${creature}: needs at least ${REQUIRED_COMMON_TROPES} common tropes (has ${bank.common.length})`
  );
  assert(
    bank.subversive.length >= REQUIRED_SUBVERSIVE_TROPES,
    `${creature}: needs at least ${REQUIRED_SUBVERSIVE_TROPES} subversive tropes (has ${bank.subversive.length})`
  );

  // A duplicated id is a silent merge: `selectRandomTropes` keys uniqueness on
  // the id and `deserializeTropeSelection` looks a selection up by it, so two
  // tropes sharing one are a single trope wearing two names.
  for (const trope of [...bank.common, ...bank.subversive]) {
    assert(!seenTropeIds.has(trope.id), `${creature}: trope id ${trope.id} is used more than once`);
    seenTropeIds.add(trope.id);
    assert(trope.name.trim().length > 0, `${creature}/${trope.id}: needs a name`);
    assert(trope.description.trim().length > 0, `${creature}/${trope.id}: needs a description`);
    assert(
      trope.subversionInstruction.trim().length > 0,
      `${creature}/${trope.id}: needs a subversion instruction, which is the only part of it the prompt carries`
    );
  }
}

for (const creature of Object.keys(TROPE_DATABASE) as Array<keyof typeof TROPE_DATABASE>) {
  const selection = service.selectTropesForSubversion({ creature, tropeCount: 3 });

  assert(selection.creature === creature, `${creature}: creature should be preserved`);
  assert(selection.selectedTropes.length === 3, `${creature}: should select requested trope count`);
  assert(
    new Set(selection.selectedTropeIds).size === selection.selectedTropeIds.length,
    `${creature}: selected tropes should be unique`
  );

  const prompt = service.enhancePromptWithSubversions(
    'Header\n\nPROSE ENGINE (MANDATORY):\nKeep prose sharp.',
    selection
  );

  assert(prompt.includes('HIDDEN UNIQUENESS DIRECTIVES'), `${creature}: prompt should include hidden directives`);
  assert(prompt.includes('PROSE ENGINE (MANDATORY):'), `${creature}: prompt should preserve original prompt`);

  const serialized = service.serializeTropeSelection(selection);
  const restored = service.deserializeTropeSelection(serialized);

  assert(restored !== null, `${creature}: serialized selection should restore`);
  assert(restored.creature === creature, `${creature}: restored creature should match`);
  assert(restored.selectedTropeIds.length === selection.selectedTropeIds.length, `${creature}: restored ids should match`);
}

// The selection pool is weighted by repetition, so its length counts copies
// rather than distinct tropes. A preferred intensity that leaves a single trope
// in the pool still leaves three copies of it, which looked like enough to
// satisfy a request for two — and the caller was handed one trope instead of
// falling back to the wider pool that could supply the second.
for (const creature of Object.keys(TROPE_DATABASE) as Array<keyof typeof TROPE_DATABASE>) {
  const creatureTropes = TROPE_DATABASE[creature];
  const allTropes = [...creatureTropes.common, ...creatureTropes.subversive];

  for (const intensity of ['subtle', 'moderate', 'dramatic'] as const) {
    const requestedCount = 2;
    if (allTropes.length < requestedCount) {
      continue;
    }

    const selection = service.selectTropesForSubversion({
      creature,
      preferredIntensity: intensity,
      tropeCount: requestedCount
    });

    assert(
      selection.selectedTropes.length === requestedCount,
      `${creature}/${intensity}: a preferred intensity should never return fewer tropes than requested ` +
        `(got ${selection.selectedTropes.length})`
    );
    assert(
      new Set(selection.selectedTropeIds).size === requestedCount,
      `${creature}/${intensity}: selected tropes should stay distinct`
    );
  }
}

// The count the service draws when the caller names none. `StoryService` named
// one on every call — its own `randomInt(2, 4)`, the same range written out
// again — so the service's `minTropes`/`maxTropes` had no reachable reader and
// this default was never exercised by the app. Drawn repeatedly because the
// count is random: one call proves the default returns *a* count, and only a
// run of them proves it stays inside the range the service declares.
for (const creature of Object.keys(TROPE_DATABASE) as Array<keyof typeof TROPE_DATABASE>) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const selection = service.selectTropesForSubversion({ creature });
    const count = selection.selectedTropes.length;

    assert(
      count >= 2 && count <= 3,
      `${creature}: an unspecified trope count should stay inside the service's own range (got ${count})`
    );
    assert(
      new Set(selection.selectedTropeIds).size === count,
      `${creature}: a default-count selection should still be distinct`
    );
    assert(
      selection.subversionInstructions.length === count,
      `${creature}: every selected trope should contribute the instruction the prompt carries`
    );
  }
}

// And the app asks for that default rather than drawing its own. `StoryService`
// is the service's only caller; it passed `tropeCount: randomInt(2, 4)` on every
// call, which is why the range above had no reader. Asserting on the options the
// seam receives is what catches a caller reintroducing its own count — the
// counts agree today, so nothing about the selection itself could.
const storyService = new StoryService() as unknown as {
  tropeService: { selectTropesForSubversion(options: TropeSubversionOptions): TropeSelection };
  selectTropeSubversions(input: StoryGenerationSeam['input']): TropeSelection | undefined;
};
const observedOptions: TropeSubversionOptions[] = [];
const realSelect = storyService.tropeService.selectTropesForSubversion.bind(storyService.tropeService);
storyService.tropeService.selectTropesForSubversion = options => {
  observedOptions.push(options);
  return realSelect(options);
};

const selected = storyService.selectTropeSubversions({
  creature: 'vampire',
  themes: ['forbidden_love'],
  spicyLevel: 3,
  wordCount: 900
} as unknown as StoryGenerationSeam['input']);

assert(selected !== undefined, 'a supported creature should still get a trope selection');
assert(observedOptions.length === 1, 'the service should be asked exactly once');
assert(
  observedOptions[0].tropeCount === undefined,
  'the app should let the service draw the count from its own range, not name one'
);

console.log('Trope subversion service tests passed');
