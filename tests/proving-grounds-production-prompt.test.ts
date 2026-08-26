#!/usr/bin/env tsx
// Created: 2026-08-26 UTC

/**
 * Proving Grounds offers one template called "Current Production", described as
 * "The current production prompt used in the main app". Every other template on
 * that page is measured against it, so the claim is the page's whole basis for
 * comparison — and nothing was checking it.
 *
 * The pacing block had drifted. It named 700, 900, and 1200 words while
 * `wordCountOptions` offers 600, 900, 1200, and 1500, so two of the four budgets
 * a reader can select here reached the model under a heading that describes
 * neither of them, and 700 — which no picker in this repository offers — was one
 * of the three that were described. A comparison run at 600 or 1500 was
 * measuring the drift rather than the variant under test.
 *
 * Read as source text rather than by importing the service: the file is an
 * Angular `@Injectable` and the root test runner has no `@angular/core`, the
 * same arrangement `story-generator-route-splitting` and the component style
 * budget test use.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './assert';

const repoRoot = process.cwd();
const promptTemplatesSource = readFileSync(
  join(repoRoot, 'story-generator/src/app/proving-grounds/prompt-templates.service.ts'),
  'utf8'
);
const storyServiceSource = readFileSync(
  join(repoRoot, 'api/_lib/services/storyService.ts'),
  'utf8'
);
const provingGroundsSource = readFileSync(
  join(repoRoot, 'story-generator/src/app/proving-grounds/proving-grounds.ts'),
  'utf8'
);

/**
 * The `WORD COUNT PACING:` heading and the bulleted lines under it, which run
 * until the first line that is not one.
 */
function readWordCountPacingBlock(source: string, label: string): string[] {
  const lines = source.split('\n');
  const headingIndex = lines.findIndex(line => line.trim() === 'WORD COUNT PACING:');
  assert(headingIndex !== -1, `${label} should carry a WORD COUNT PACING block`);

  const block: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line.startsWith('- ')) {
      break;
    }
    block.push(line);
  }

  assert(block.length > 0, `${label} should list at least one pacing line`);
  return block;
}

/** The word counts a pacing line names, as the numbers before ` words`. */
function readPacedWordCounts(block: string[], label: string): number[] {
  return block.map(line => {
    const match = /^-\s*(\d+)\s+words:/.exec(line);
    assert(match, `${label} pacing line should name a word count: ${line}`);
    return Number(match[1]);
  });
}

/** The budgets the Proving Grounds picker actually offers. */
function readWordCountOptions(): number[] {
  const match = /wordCountOptions:\s*WordBudget\[\]\s*=\s*\[([^\]]*)\]/.exec(provingGroundsSource);
  assert(match, 'proving-grounds.ts should declare wordCountOptions');

  const options = match[1]!
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(Number);

  assert(
    options.length > 0 && options.every(Number.isFinite),
    `wordCountOptions should be a list of numbers, got ${JSON.stringify(match[1])}`
  );
  return options;
}

const templateBlock = readWordCountPacingBlock(promptTemplatesSource, 'the Proving Grounds template');
const productionBlock = readWordCountPacingBlock(storyServiceSource, 'the production prompt');
const templateCounts = readPacedWordCounts(templateBlock, 'the Proving Grounds template');
const productionCounts = readPacedWordCounts(productionBlock, 'the production prompt');
const wordCountOptions = readWordCountOptions();

// ==================== EVERY BUDGET A READER CAN PICK IS PACED ====================
for (const budget of wordCountOptions) {
  assert(
    templateCounts.includes(budget),
    `the "Current Production" template should pace ${budget} words, which the picker offers; it paces ${JSON.stringify(templateCounts)}`
  );
  assert(
    productionCounts.includes(budget),
    `the production prompt should pace ${budget} words; it paces ${JSON.stringify(productionCounts)}`
  );
}

// ==================== THE TEMPLATE IS THE PRODUCTION PROMPT ====================
// The page's claim is that this template is what the app sends, so the block has
// to be the production one line for line rather than merely covering the same
// budgets.
assert(
  templateBlock.length === productionBlock.length,
  `the template should pace the same number of budgets as production: ${templateBlock.length} vs ${productionBlock.length}`
);

for (let index = 0; index < productionBlock.length; index += 1) {
  assert(
    templateBlock[index] === productionBlock[index],
    `pacing line ${index + 1} has drifted from production:\n  template:   ${templateBlock[index]}\n  production: ${productionBlock[index]}`
  );
}

console.log('Proving Grounds production prompt tests passed');
