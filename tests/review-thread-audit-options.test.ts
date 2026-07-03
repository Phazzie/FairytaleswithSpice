// Created: 2026-07-03 08:38 EDT
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

process.argv = ['node', 'tests/review-thread-audit-options.test.ts'];

void main();

async function main() {
  const reviewAudit = await import('../scripts/recovery/list-unresolved-review-threads.mjs');

  const buildPullRequestRow = reviewAudit.buildPullRequestRow as (
    pullRequest: {
      number: number;
      state: string;
      title: string;
      url: string;
      reviewThreads: { nodes: typeof threads };
    },
    threadMode: string,
  ) => {
    matchingThreads: number;
    threadMode: string;
    activeThreads?: number;
    threads: Array<{ id: string; isOutdated: boolean }>;
  };
  const parseArgs = reviewAudit.parseArgs as (argv: string[]) => {
    format: string;
    threadMode: string;
  };
  const isEntrypoint = reviewAudit.isEntrypoint as (moduleUrl: string, argvPath?: string) => boolean;
  const selectUnresolvedThreads = reviewAudit.selectUnresolvedThreads as (
    threads: Array<{
      id: string;
      isResolved: boolean;
      isOutdated: boolean;
      comments: { nodes: Array<{ body: string; author: { login: string }; url: string }> };
    }>,
    threadMode: string,
  ) => Array<{ id: string }>;

  const activeThread = {
    id: 'active-thread',
    isResolved: false,
    isOutdated: false,
    path: 'api/story-lab/stories.ts',
    line: 42,
    comments: {
      nodes: [
        {
          author: { login: 'reviewer' },
          body: 'Active issue',
          url: 'https://example.com/active',
        },
      ],
    },
  };

  const outdatedThread = {
    id: 'outdated-thread',
    isResolved: false,
    isOutdated: true,
    path: 'api/story-lab/old.ts',
    line: 12,
    comments: {
      nodes: [
        {
          author: { login: 'reviewer' },
          body: 'Outdated issue',
          url: 'https://example.com/outdated',
        },
      ],
    },
  };

  const resolvedOutdatedThread = {
    id: 'resolved-outdated-thread',
    isResolved: true,
    isOutdated: true,
    path: 'api/story-lab/resolved.ts',
    line: 7,
    comments: {
      nodes: [
        {
          author: { login: 'reviewer' },
          body: 'Resolved issue',
          url: 'https://example.com/resolved',
        },
      ],
    },
  };

  const threads = [activeThread, outdatedThread, resolvedOutdatedThread];

  assert.equal(parseArgs(['--json']).threadMode, 'active');
  assert.equal(parseArgs(['--include-outdated', '--json']).threadMode, 'include-outdated');
  assert.equal(parseArgs(['--outdated-only', '--json']).threadMode, 'outdated-only');
  assert.throws(
    () => parseArgs(['--include-outdated', '--outdated-only']),
    /Choose only one outdated thread mode/,
  );

  const scriptPath = 'scripts/recovery/list-unresolved-review-threads.mjs';
  const scriptUrl = pathToFileURL(resolve(scriptPath)).href;
  assert.equal(isEntrypoint(scriptUrl, scriptPath), true);
  assert.equal(isEntrypoint(scriptUrl, resolve(scriptPath)), true);
  assert.equal(isEntrypoint(scriptUrl, 'scripts/recovery/other-script.mjs'), false);

  assert.deepEqual(
    selectUnresolvedThreads(threads, 'active').map((thread) => thread.id),
    ['active-thread'],
  );
  assert.deepEqual(
    selectUnresolvedThreads(threads, 'include-outdated').map((thread) => thread.id),
    ['active-thread', 'outdated-thread'],
  );
  assert.deepEqual(
    selectUnresolvedThreads(threads, 'include-outdated').map((thread) => thread.isOutdated),
    [false, true],
  );
  assert.deepEqual(
    selectUnresolvedThreads(threads, 'outdated-only').map((thread) => thread.id),
    ['outdated-thread'],
  );

  const row = buildPullRequestRow(
    {
      number: 156,
      state: 'MERGED',
      title: 'Fix Story Lab batch status review follow-up',
      url: 'https://example.com/pr/156',
      reviewThreads: { nodes: threads },
    },
    'include-outdated',
  );

  assert.equal(row.matchingThreads, 2);
  assert.equal(row.threadMode, 'include-outdated');
  assert.equal('activeThreads' in row, false);
  assert.deepEqual(
    row.threads.map((thread) => ({ id: thread.id, isOutdated: thread.isOutdated })),
    [
      { id: 'active-thread', isOutdated: false },
      { id: 'outdated-thread', isOutdated: true },
    ],
  );

  console.log('review-thread-audit-options: ok');
}
