#!/usr/bin/env tsx
// Created: 2026-08-26 UTC
// Rewritten: 2026-08-27 UTC, when the prompt stopped being transcribed.
//
// Proving Grounds offers one template called "Current Production", described as
// "The current production prompt used in the main app". Every other template on
// that page is measured against it, so the claim is the page's whole basis for
// comparison — and it was a hand-copy of a prompt that had moved on. The copy
// was repaired in place twice, once for the word-count pacing block and once for
// the spice ladder, and was still missing the midpoint moral dilemma, the eight
// cliffhanger examples, the hook-placement and serialization rules, the whole
// enhanced voice system, and the Chekhov ledger.
//
// `shared/productionStoryPrompt.ts` is the text now, and both sides build from
// it. What this file asserts is that neither side has started transcribing it
// again, and that every budget the picker offers is still paced.
//
// The Proving Grounds service is read as source text rather than imported: the
// file is an Angular `@Injectable` and the root test runner has no
// `@angular/core`, the same arrangement `story-generator-route-splitting` and
// the component style budget test use.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRODUCTION_AUDIO_AND_VOICE_BLOCK,
  PRODUCTION_PROSE_ENGINE_BLOCK,
  PRODUCTION_SERIALIZATION_BLOCK,
  PRODUCTION_SYSTEM_PROMPT_GOAL,
  PRODUCTION_SYSTEM_PROMPT_OPENING,
  buildProductionSystemPrompt,
  buildProductionUserPrompt,
  formatChekhovLedger
} from '../shared/productionStoryPrompt';
import { SPICE_LEVEL_PROMPT_BLOCK } from '../shared/spiceLevelPromptLadder';
import { StoryService } from '../api/_lib/services/storyService';
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

/** The blocks the shared module is assembled from, by the heading each opens with. */
const SHARED_BLOCKS: readonly [string, string][] = [
  ['the opening', PRODUCTION_SYSTEM_PROMPT_OPENING],
  ['the prose engine', PRODUCTION_PROSE_ENGINE_BLOCK],
  ['the spice ladder', SPICE_LEVEL_PROMPT_BLOCK],
  ['the serialization hooks', PRODUCTION_SERIALIZATION_BLOCK],
  ['the audio and voice system', PRODUCTION_AUDIO_AND_VOICE_BLOCK],
  ['the closing goal', PRODUCTION_SYSTEM_PROMPT_GOAL]
];

// ==================== NEITHER SIDE TRANSCRIBES THE PROMPT ====================
// A heading in either file is a copy starting again. Both build from the module.

const TRANSCRIPTION_MARKERS: readonly string[] = [
  'PROSE ENGINE (MANDATORY):',
  'SERIALIZATION HOOKS - ENGINEERED ADDICTION:',
  'AUDIO FORMAT (NON-NEGOTIABLE):',
  'WORD COUNT PACING:',
  'CHEKHOV LEDGER'
];

for (const marker of TRANSCRIPTION_MARKERS) {
  assert(
    !storyServiceSource.includes(marker),
    `storyService.ts should build "${marker}" from shared/productionStoryPrompt, not restate it`
  );
  assert(
    !promptTemplatesSource.includes(marker),
    `the Proving Grounds template should build "${marker}" from shared/productionStoryPrompt, not restate it`
  );
}

assert(
  promptTemplatesSource.includes('buildProductionSystemPrompt()'),
  'the "Current Production" system prompt should be the shared builder\'s answer'
);
assert(
  promptTemplatesSource.includes('buildProductionUserPrompt({'),
  'the "Current Production" user prompt should be built by the shared builder'
);

// ==================== PRODUCTION SENDS THE SHARED TEXT ====================
// `buildSystemPrompt` and `buildUserPrompt` are private, so these go through the
// same door the other prompt tests use. One instance, because the constructor
// logs a warning about the absent API key it does not need to build a prompt.
const storyService = new StoryService() as any;

const storyInput = {
  creature: 'vampire',
  themes: ['betrayal'],
  userInput: 'A duel at the winter court.',
  spicyLevel: 3,
  wordCount: 900
};

const productionSystemPrompt: string = storyService.buildSystemPrompt(storyInput);
const productionUserPrompt: string = storyService.buildUserPrompt(storyInput);

for (const [label, block] of SHARED_BLOCKS) {
  assert(
    productionSystemPrompt.includes(block),
    `the production system prompt should carry ${label} as the shared module writes it`
  );
}

// The two per-run sections are the only thing the Proving Grounds copy omits,
// and they are the two that cannot be a constant.
assert(
  productionSystemPrompt.includes('DYNAMIC STYLE SELECTION FOR THIS STORY:'),
  'a generated story should still name the author styles drawn for its creature'
);
assert(
  productionSystemPrompt.includes('SELECTED STRUCTURE:'),
  'a generated story should still name the beat structure drawn for it'
);

const provingGroundsSystemPrompt = buildProductionSystemPrompt();
assert(
  !provingGroundsSystemPrompt.includes('DYNAMIC STYLE SELECTION FOR THIS STORY:'),
  'the heading for the drawn author styles should go when there are none to list'
);
for (const [label, block] of SHARED_BLOCKS) {
  assert(
    provingGroundsSystemPrompt.includes(block),
    `the Proving Grounds system prompt should carry ${label}`
  );
}

// The reader's own idea reaches the model under production's heading.
assert(
  productionUserPrompt.includes(`CREATIVE DIRECTION: ${storyInput.userInput}`),
  'the production user prompt should label the reader\'s idea'
);
const withoutDirection: string = storyService.buildUserPrompt({ ...storyInput, userInput: '' });
assert(
  !withoutDirection.includes('CREATIVE DIRECTION:'),
  'a request with no idea of its own should carry no heading for one'
);

// ==================== EVERY BUDGET A READER CAN PICK IS PACED ====================

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

const pacedCounts = readPacedWordCounts(
  readWordCountPacingBlock(productionUserPrompt, 'the production prompt'),
  'the production prompt'
);

for (const budget of readWordCountOptions()) {
  assert(
    pacedCounts.includes(budget),
    `the prompt should pace ${budget} words, which the picker offers; it paces ${JSON.stringify(pacedCounts)}`
  );
}

// ==================== THE PLANTED ELEMENTS ARE NAMED ====================
// Production plants two per story and the page's copy planted none, so a variant
// was measured against a prompt that asked for no planting at all.
assert(
  productionUserPrompt.includes('[Chekhov1]:') && productionUserPrompt.includes('[Chekhov2]:'),
  'the production user prompt should name the two elements this run plants'
);
assert(
  buildProductionUserPrompt({
    wordCount: '900',
    creature: 'Vampire',
    themes: 'betrayal',
    spicyLabel: 'Spicy',
    spicyLevel: '3',
    creativeDirectionLine: '',
    storyLabContextLine: '',
    chekhovLedger: formatChekhovLedger(['a first element', 'a second element'])
  }).includes('[Chekhov2]: a second element'),
  'the shared ledger format should be what the prompt carries'
);

console.log('Proving Grounds production prompt tests passed');
