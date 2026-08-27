#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The five reasoning efforts are one table, and the two contracts that report
// the field read it rather than spelling it out again.
//
// They were written four times — the union in `xaiConfig`, the `Set` beside it
// that `XAI_STORY_REASONING_EFFORT` is validated against, and an inline copy on
// each contract's telemetry field. Two identical unions are structurally
// assignable, so nothing would have reported the drift; what this file asserts
// is the part a type cannot.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  XAI_REASONING_EFFORTS,
  isXaiReasoningEffort
} from '../shared/reasoningEffortVocabulary';
import {
  DEFAULT_XAI_REASONING_EFFORT,
  XAI_REASONING_EFFORTS as CONFIG_REASONING_EFFORTS,
  getXaiReasoningEffort
} from '../api/_lib/config/xaiConfig';
import { assert } from './assert';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

// ==================== The table has one home ====================

assert(XAI_REASONING_EFFORTS.length === 5, 'the ladder should still be five efforts');
assert(
  new Set<string>(XAI_REASONING_EFFORTS).size === XAI_REASONING_EFFORTS.length,
  'the ladder should not repeat an effort'
);
assert(
  CONFIG_REASONING_EFFORTS === XAI_REASONING_EFFORTS,
  "the provider config's table should be the shared table itself"
);
assert(
  isXaiReasoningEffort(DEFAULT_XAI_REASONING_EFFORT),
  'the default effort should be one the table names'
);

for (const effort of XAI_REASONING_EFFORTS) {
  assert(isXaiReasoningEffort(effort), `${effort} is in the table and should be accepted`);
}
for (const rejected of ['maximum', 'HIGH', '', ' high', 3, null, undefined, ['high']]) {
  assert(
    !isXaiReasoningEffort(rejected),
    `${String(rejected)} is not an effort the provider is asked for and should be refused`
  );
}

// ==================== The env var is checked against that table ====================

const configuredEffort = process.env['XAI_STORY_REASONING_EFFORT'];

try {
  for (const effort of XAI_REASONING_EFFORTS) {
    process.env['XAI_STORY_REASONING_EFFORT'] = effort;
    assert(
      getXaiReasoningEffort() === effort,
      `a deployment configuring ${effort} should get ${effort}`
    );

    // The read lowercases and trims before checking, and did before this
    // change; the guard has to keep answering for both.
    process.env['XAI_STORY_REASONING_EFFORT'] = `  ${effort.toUpperCase()}  `;
    assert(
      getXaiReasoningEffort() === effort,
      `${effort} spelled with padding and capitals should still be that effort`
    );
  }

  for (const unusable of ['maximum', '', '   ', 'high effort']) {
    process.env['XAI_STORY_REASONING_EFFORT'] = unusable;
    assert(
      getXaiReasoningEffort() === DEFAULT_XAI_REASONING_EFFORT,
      `an unusable effort (${JSON.stringify(unusable)}) should fall back to the default`
    );
  }

  delete process.env['XAI_STORY_REASONING_EFFORT'];
  assert(
    getXaiReasoningEffort() === DEFAULT_XAI_REASONING_EFFORT,
    'an unconfigured deployment should get the default effort'
  );
} finally {
  if (configuredEffort === undefined) {
    delete process.env['XAI_STORY_REASONING_EFFORT'];
  } else {
    process.env['XAI_STORY_REASONING_EFFORT'] = configuredEffort;
  }
}

// ==================== Nothing writes the ladder out again ====================

for (const [label, path] of [
  ['the provider config', 'api/_lib/config/xaiConfig.ts'],
  ['the API contract', 'api/_lib/types/contracts.ts'],
  ['the Angular contract', 'story-generator/src/app/contracts.ts']
] as const) {
  const source = readSource(path);

  assert(
    source.includes('reasoningEffortVocabulary'),
    `${label} should read the efforts from the shared vocabulary`
  );
  assert(
    !/'none'\s*\|\s*'low'\s*\|\s*'medium'\s*\|\s*'high'\s*\|\s*'xhigh'/.test(source),
    `${label} spells the efforts as a union again; the type comes from the table`
  );
  assert(
    !/\[\s*'none'\s*,\s*'low'\s*,\s*'medium'/.test(source),
    `${label} lists the efforts again; there should be one table`
  );
}

// ==================== The retired reader stays retired ====================

// `isHighAgentEffort` was exported for logging that was never written, so it was
// a second place deciding what "high effort" means with no caller to hold it to
// account. Nothing in the repository called it, tests included.
const configSource = readSource('api/_lib/config/xaiConfig.ts');
assert(
  !configSource.includes('export function isHighAgentEffort'),
  'isHighAgentEffort had no caller anywhere; it should not come back without one'
);

console.log('Reasoning effort vocabulary tests passed');
