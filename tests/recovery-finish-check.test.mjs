// Created: 2026-07-04 00:00 EDT
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const finishCheck = await import('../scripts/recovery/finish-check.mjs');

const { parsePorcelainStatus, buildDocChecklist, isEntrypoint } = finishCheck;

test('parses porcelain status and maps doc reminders', () => {
  const status = parsePorcelainStatus(
    [
      ' M package.json',
      'M  AGENTS.md',
      '?? scripts/recovery/finish-check.mjs',
      '?? tests/recovery-finish-check.test.mjs',
      '',
    ].join('\n'),
  );

  assert.equal(status.trackedChanges, 2);
  assert.equal(status.untrackedFiles, 2);
  assert.deepEqual(status.paths, [
    'package.json',
    'AGENTS.md',
    'scripts/recovery/finish-check.mjs',
    'tests/recovery-finish-check.test.mjs',
  ]);

  const checklist = buildDocChecklist(status.paths);
  const checklistFiles = checklist.map((entry) => entry.file);

  assert(checklistFiles.includes('PR70_RECOVERY_CHANGELOG.md'), 'finish check should always remind about the running changelog');
  assert(checklistFiles.includes('AGENTS.md'), 'AGENTS.md edits should remind agents to update the operating guide timestamp/rules');
  assert(checklistFiles.includes('LESSONS_LEARNED.md'), 'process/tooling changes should remind agents to record durable lessons');
  assert(checklistFiles.includes('package.json'), 'script changes should remind agents to keep npm entrypoints current');
});

test('maps branch-diff paths to execution-plan reminders', () => {
  const checklist = buildDocChecklist([
    'api/story-lab/jobs.ts',
    'api/story-lab/account/profile.ts',
    'vercel.json',
    'package.json',
  ]);
  const checklistFiles = checklist.map((entry) => entry.file);

  assert(checklistFiles.includes('STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md'));
  assert(checklistFiles.includes('STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md'));
  assert(checklistFiles.includes('STORY_LAB_STORAGE_PORT_EXEC_PLAN.md'));
  assert(checklistFiles.includes('STORY_LAB_JOB_ROUTES_EXEC_PLAN.md'));
  assert(checklistFiles.includes('STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md'));
  assert(checklistFiles.includes('package.json'));
});

test('maps Story Lab surface changes to current status docs', () => {
  const checklist = buildDocChecklist([
    'story-generator/src/app/app.ts',
    'story_lab_exploration_findings.md',
  ]);
  const checklistFiles = checklist.map((entry) => entry.file);

  assert(checklistFiles.includes('STORY_LAB_CONCEPT_CHECKLIST.md'));
  assert(checklistFiles.includes('STORY_LAB_FUTURE_WORK_CHECKLIST.md'));
  assert(checklistFiles.includes('STORY_LAB_EXPLORATION_TICKETS.md'));
  assert(checklistFiles.includes('STORY_LAB_EXPLORATION_FINDINGS.md'));
});

test('detects whether the finish check is the entrypoint', () => {
  const scriptPath = 'scripts/recovery/finish-check.mjs';
  const scriptUrl = pathToFileURL(resolve(scriptPath)).href;

  assert.equal(isEntrypoint(scriptUrl, scriptPath), true);
  assert.equal(isEntrypoint(scriptUrl, resolve(scriptPath)), true);
  assert.equal(isEntrypoint(scriptUrl, 'scripts/recovery/slice-status.sh'), false);
});
