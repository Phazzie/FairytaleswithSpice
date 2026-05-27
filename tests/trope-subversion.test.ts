#!/usr/bin/env tsx

import { TropeSubversionService } from '../api/_lib/services/tropeSubversionService';
import { TROPE_DATABASE } from '../api/_lib/data/tropeDatabase';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const service = new TropeSubversionService();

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

console.log('Trope subversion service tests passed');
