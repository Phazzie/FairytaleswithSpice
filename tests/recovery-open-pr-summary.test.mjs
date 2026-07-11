// Created: 2026-07-11 00:00 EDT
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGhSpawnOptions,
  exitCodeForOpenPrResult,
  formatOpenPrCommandResult,
  formatOpenPrSummary,
  selectGhExecutable,
  summarizeCheckRollup,
} from '../scripts/recovery/open-pr-summary.mjs';

test('summarizes failing open PR checks by check name', () => {
  const summary = summarizeCheckRollup([
    {
      __typename: 'CheckRun',
      conclusion: 'FAILURE',
      name: 'Validate Vercel recovery build',
      workflowName: 'Recovery CI',
    },
    {
      __typename: 'StatusContext',
      context: 'Vercel',
      state: 'FAILURE',
    },
    {
      __typename: 'CheckRun',
      conclusion: 'SUCCESS',
      name: 'SonarCloud',
    },
  ]);

  assert.equal(summary, 'failing: Validate Vercel recovery build, Vercel');
});

test('summarizes pending open PR checks by check name', () => {
  const summary = summarizeCheckRollup([
    { __typename: 'CheckRun', conclusion: 'SUCCESS', name: 'CI' },
    { __typename: 'CheckRun', status: 'IN_PROGRESS', name: 'Build' },
    { __typename: 'StatusContext', state: 'PENDING', context: 'Vercel' },
  ]);

  assert.equal(summary, 'pending: Build, Vercel');
});

test('truncates failing check names beyond three with count suffix', () => {
  const summary = summarizeCheckRollup([
    { __typename: 'CheckRun', conclusion: 'FAILURE', name: 'A' },
    { __typename: 'CheckRun', conclusion: 'FAILURE', name: 'B' },
    { __typename: 'StatusContext', state: 'ERROR', context: 'C' },
    { __typename: 'CheckRun', conclusion: 'FAILURE', name: 'D' },
  ]);

  assert.equal(summary, 'failing: A, B, C, +1 more');
});

test('formats open PRs with useful branch and check state', () => {
  const lines = formatOpenPrSummary([
    {
      number: 194,
      title: 'Bump the npm_and_yarn group',
      headRefName: 'dependabot/npm_and_yarn/npm_and_yarn-482f367dc7',
      isDraft: false,
      statusCheckRollup: [
        { __typename: 'CheckRun', conclusion: 'SUCCESS', name: 'SonarCloud' },
      ],
    },
  ]);

  assert.deepEqual(lines, [
    '- #194: Bump the npm_and_yarn group [dependabot/npm_and_yarn/npm_and_yarn-482f367dc7; checks passing]',
  ]);
});

test('formats empty open PR list plainly', () => {
  assert.deepEqual(formatOpenPrSummary([]), ['none']);
});

test('marks draft PRs in summary', () => {
  const lines = formatOpenPrSummary([
    {
      number: 200,
      title: 'WIP feature',
      headRefName: 'feature/story-lab',
      isDraft: true,
      statusCheckRollup: [],
    },
  ]);

  assert.deepEqual(lines, ['- #200 draft: WIP feature [feature/story-lab; no checks reported]']);
});

test('formats unavailable open PR state distinctly from no open PRs', () => {
  const result = {
    prs: [],
    warning: 'GitHub CLI unavailable',
  };

  assert.deepEqual(formatOpenPrCommandResult(result), ['unavailable']);
  assert.equal(exitCodeForOpenPrResult(result), 1);
});

test('selects gh only from absolute executable candidates', () => {
  const executablePaths = new Set(['/usr/local/bin/gh']);
  const selected = selectGhExecutable(['gh', '/tmp/gh', '/usr/local/bin/gh'], (candidate) =>
    executablePaths.has(candidate),
  );

  assert.equal(selected, '/usr/local/bin/gh');
});

test('does not select gh from relative candidates', () => {
  const selected = selectGhExecutable(['gh'], () => true);

  assert.equal(selected, '');
});

test('uses a finite timeout for gh process calls', () => {
  const options = buildGhSpawnOptions();

  assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(options.encoding, 'utf8');
  assert.equal(options.timeout, 30000);
});
