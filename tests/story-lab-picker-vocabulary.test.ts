#!/usr/bin/env tsx
// Created: 2026-08-27 UTC

/**
 * What the two screens offer, and the tables that decide it.
 *
 * `story-lab-blueprint-vocabulary` asserts that the API's parser and the
 * Angular form check a blueprint against one set of tables rather than two
 * hand-kept copies. It covers the two *validators* — and a validator is only
 * half of what a vocabulary reaches. The other half is the picker: what a
 * reader is offered on the Story Lab blueprint form, and what a prompt can be
 * tested against in the Proving Grounds.
 *
 * Both screens wrote their own lists. That fails in the opposite direction to
 * the one that test describes, and more quietly. A form that accepts what the
 * route refuses tells the reader so, eventually, with a `400` naming a field; a
 * picker that is short one value tells nobody anything. A creature added to
 * `CREATURE_ARCHETYPES` reaches the type, the parser, `FormValidationService`,
 * the prompt builders, and the log filter, and stops at the two `<select>`s —
 * so it is accepted everywhere and offered nowhere, and the one screen built
 * for comparing prompts cannot compare the newest creature's.
 *
 * The compile-time half of the fix is a total `Record` over each vocabulary for
 * the labels and descriptions, which TypeScript refuses when a key is missing;
 * the preflight typechecks both Angular projects, so that half is enforced
 * already. This file asserts the other half — that the option lists are still
 * built by mapping the table, and that neither screen has grown a literal copy
 * of a vocabulary again, in a component or in a template.
 *
 * The Angular sources are read as text rather than imported, for the reason
 * `story-lab-blueprint-vocabulary` gives: they are components, and the root
 * test runner has no `@angular/core`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './assert';
import { escapeHtml } from '../story-generator/src/app/story-html-exporter';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const appComponent = readSource('story-generator/src/app/app.ts');
const appTemplate = readSource('story-generator/src/app/app.html');
const provingGroundsComponent = readSource('story-generator/src/app/proving-grounds/proving-grounds.ts');
const provingGroundsTemplate = readSource('story-generator/src/app/proving-grounds/proving-grounds.html');

// ==================== Each picker reads the table it offers ====================

for (const [label, source, tables] of [
  [
    'the Story Lab blueprint form',
    appComponent,
    [
      'CREATURE_ARCHETYPES',
      'NARRATIVE_TONES',
      'SPICY_LEVELS',
      'WORD_BUDGETS',
      'CHAPTER_BATCH_SIZES',
      'HEAT_TENSION_MODES',
      'HEAT_INTIMACY_BOUNDARIES'
    ]
  ],
  [
    'the Proving Grounds',
    provingGroundsComponent,
    ['CREATURE_ARCHETYPES', 'SPICY_LEVELS', 'WORD_BUDGETS', 'CHAPTER_BATCH_SIZES']
  ]
] as const) {
  for (const table of tables) {
    assert(source.includes(table), `${label} should build its picker from ${table}`);
  }
}

// ==================== Neither screen restates a vocabulary ====================

// The declaration, not a mention: a docblock may name a creature in prose, but
// two of them side by side is the copy this test exists to prevent.
const adjacentPairs = [
  ['creatures', "'vampire'", "'werewolf'"],
  ['tones', "'romance'", "'dark_romance'"],
  ['tension modes', "'slow_burn'", "'dangerous_proximity'"],
  ['intimacy boundaries', "'fade_to_black'", "'closed_door'"]
] as const;

for (const [label, source] of [
  ['the Story Lab blueprint form', appComponent],
  ['the Proving Grounds', provingGroundsComponent]
] as const) {
  for (const [vocabulary, firstValue, secondValue] of adjacentPairs) {
    assert(
      !new RegExp(`${firstValue},\\s*${secondValue}`).test(source),
      `${label} lists the ${vocabulary} again; there should be one table`
    );
  }
}

// A template's `<option>` elements are the whole of what a `<select>` offers,
// so a hand-written set of them is the same second declaration one layer
// further from anything that can check it.
for (const [label, template, forbidden] of [
  [
    'the Story Lab blueprint form',
    appTemplate,
    ['value="dark_romance"', '[ngValue]="1200"', '[ngValue]="3"']
  ],
  ['the Proving Grounds', provingGroundsTemplate, ['max="5"', 'min="1"']]
] as const) {
  for (const markup of forbidden) {
    assert(
      !template.includes(markup),
      `${label} template still writes \`${markup}\` by hand; it should read the vocabulary`
    );
  }
}

// The dead list beside the spice slider: five levels no template ever read,
// while the control's own bounds were spelled out in the markup.
// The declaration again, not the docblock above it that explains why it went.
assert(
  !/^\s*(readonly\s+)?spicyLevelOptions\b/m.test(provingGroundsComponent),
  'the Proving Grounds spice slider should read its bounds from SPICY_LEVELS, not a list nothing renders'
);
for (const bound of ['minSpicyLevel', 'maxSpicyLevel'] as const) {
  assert(
    provingGroundsTemplate.includes(bound),
    `the Proving Grounds spice slider should bind ${bound} rather than a number written into the markup`
  );
}

// ==================== Model prose is escaped into the preview ====================

// `renderChapters` assembles the document the Proving Grounds stores, exports,
// and renders. `htmlContent` is markup by contract; `title` and `summary` are
// text, and text carrying `<` or `&` is not markup that happens to be safe.
for (const field of ['chapter.title', 'chapter.summary'] as const) {
  assert(
    provingGroundsComponent.includes(`escapeHtml(${field})`),
    `the Proving Grounds preview should escape ${field} the way the story exporter does`
  );
  assert(
    !provingGroundsComponent.includes(`\${${field}}`),
    `the Proving Grounds preview interpolates ${field} into markup unescaped`
  );
}

assert(
  escapeHtml('<The Reckoning> & "Roses"') === '&lt;The Reckoning&gt; &amp; &quot;Roses&quot;',
  'escapeHtml should render a chapter title as the text it is'
);

console.log('Story Lab picker vocabulary tests passed');
