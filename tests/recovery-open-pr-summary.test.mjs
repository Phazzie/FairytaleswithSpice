// Created: 2026-07-11 00:00 EDT
import assert from 'node:assert/strict';
import test from 'node:test';

import { formatOpenPrSummary, summarizeCheckRollup } from '../scripts/recovery/open-pr-summary.mjs';

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
