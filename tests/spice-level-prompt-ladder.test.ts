#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The Proving Grounds page presents one prompt as "Current Production". Its
// whole claim is that a variant tested against it is tested against the real
// thing, so anything in it that `StoryService` does not send is drift the
// reader has no way to see.
//
// Two halves of the spice ladder were that. The label substituted into
// `SPICE LEVEL: {{SPICY_LABEL}}` disagreed with production at all five levels
// (`Scorching & Explicit` where the run sends `Very spicy`), and the system
// prompt's `SPICE LEVELS` block was an earlier revision with a heading that
// dropped "and do not exceed the requested level" and five one-line
// descriptions naming none of the boundaries the real prompt names.
//
// `shared/spiceLevelPromptLadder.ts` is the one ladder now. This asserts that
// both prompts are built from it, by reading the two prompt builders' actual
// output rather than by asserting that either file imports anything.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SPICE_LEVEL_PROMPT_BLOCK,
  SPICE_LEVEL_PROMPT_RUNGS,
  readSpiceLevelPromptLabel,
  UNKNOWN_SPICE_LEVEL_PROMPT_LABEL
} from '../shared/spiceLevelPromptLadder';
import { getSpicyLabel } from '../api/_lib/services/storyContentAnalysis';
import { StoryService } from '../api/_lib/services/storyService';
import { assert } from './assert';

// ==================== The ladder is the five levels ====================

assert(
  SPICE_LEVEL_PROMPT_RUNGS.map(rung => rung.level).join(',') === '1,2,3,4,5',
  'the ladder should be levels 1 through 5, in order'
);

for (const rung of SPICE_LEVEL_PROMPT_RUNGS) {
  assert(rung.label.trim().length > 0, `level ${rung.level} should have a label`);
  assert(rung.guidance.trim().length > 0, `level ${rung.level} should say what it permits`);
  assert(
    !rung.label.includes(':'),
    `level ${rung.level}'s label must not contain the separator the prompt block uses`
  );
}

assert(
  SPICE_LEVEL_PROMPT_BLOCK.startsWith('SPICE LEVELS (match exactly and do not exceed the requested level):'),
  'the block must keep the ceiling instruction, which is the half the stale copy had dropped'
);

for (const rung of SPICE_LEVEL_PROMPT_RUNGS) {
  assert(
    SPICE_LEVEL_PROMPT_BLOCK.includes(`Level ${rung.level} - ${rung.label}: ${rung.guidance}`),
    `the block should state level ${rung.level} exactly once, from the rung`
  );
}

// ==================== Production reads it ====================

for (const rung of SPICE_LEVEL_PROMPT_RUNGS) {
  assert(
    getSpicyLabel(rung.level) === rung.label,
    `level ${rung.level} should reach the user prompt as ${rung.label}`
  );
}

assert(
  getSpicyLabel(99) === UNKNOWN_SPICE_LEVEL_PROMPT_LABEL,
  'a level outside the ladder keeps the existing fallback label'
);
assert(
  readSpiceLevelPromptLabel(0) === UNKNOWN_SPICE_LEVEL_PROMPT_LABEL,
  'level 0 is not a rung'
);

// The system prompt carries the block itself, not a paraphrase of it.
const systemPrompt: string = (new StoryService() as any).buildSystemPrompt({
  creature: 'vampire',
  themes: [],
  userInput: '',
  spicyLevel: 3,
  wordCount: 900
});
assert(
  systemPrompt.includes(SPICE_LEVEL_PROMPT_BLOCK),
  'StoryService.buildSystemPrompt should send the shared ladder verbatim'
);

// ==================== The preview reads it too ====================
//
// `PromptTemplatesService` is an Angular service and this suite runs outside
// that tree, so the assertion is made against the file: it must carry no spice
// ladder of its own, and must interpolate the shared block into the prompt it
// presents as production.
const promptTemplatesSource = readFileSync(
  join(process.cwd(), 'story-generator/src/app/proving-grounds/prompt-templates.service.ts'),
  'utf8'
);

assert(
  promptTemplatesSource.includes('${SPICE_LEVEL_PROMPT_BLOCK}'),
  'the Proving Grounds production prompt should interpolate the shared ladder'
);
assert(
  promptTemplatesSource.includes('readSpiceLevelPromptLabel'),
  'the Proving Grounds spice label should come from the shared ladder'
);

for (const staleLabel of ['Sweet & Sensual', 'Warm & Steamy', 'Hot & Intense', 'Scorching & Explicit', 'Inferno & Graphic']) {
  assert(
    !promptTemplatesSource.includes(staleLabel),
    `the Proving Grounds should no longer name a spice level ${staleLabel}, which no run has ever sent`
  );
}

assert(
  !promptTemplatesSource.includes('SPICE LEVELS (match exactly):'),
  'the Proving Grounds should no longer carry its own, shorter spice heading'
);

console.log('spice-level-prompt-ladder tests passed');
