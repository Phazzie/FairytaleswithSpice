#!/usr/bin/env tsx

import { TropeSubversionService } from '../api/_lib/services/tropeSubversionService';
import { TROPE_DATABASE } from '../api/_lib/data/tropeDatabase';
import { CREATURE_ARCHETYPES } from '../api/_lib/story-lab/contracts';

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

console.log('Trope subversion service tests passed');
