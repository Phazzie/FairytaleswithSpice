#!/usr/bin/env node
// Created: 2026-07-04 00:00 EDT
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? '').trimEnd(),
    stderr: (result.stderr ?? result.error?.message ?? '').trimEnd(),
  };
}

function git(args) {
  return run('git', args);
}

function addChecklistItem(items, seen, file, reason) {
  if (seen.has(file)) {
    return;
  }
  seen.add(file);
  items.push({ file, reason });
}

function parseStatusPath(line) {
  const rawPath = line.slice(3);
  const renameTarget = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath;
  if (renameTarget?.startsWith('"') && renameTarget.endsWith('"')) {
    return renameTarget.slice(1, -1);
  }
  return renameTarget ?? rawPath;
}

export function parsePorcelainStatus(statusOutput) {
  const lines = statusOutput.split('\n').filter(Boolean);
  let trackedChanges = 0;
  let untrackedFiles = 0;
  const paths = [];

  for (const line of lines) {
    if (line.startsWith('?? ')) {
      untrackedFiles += 1;
    } else {
      trackedChanges += 1;
    }
    paths.push(parseStatusPath(line));
  }

  return { trackedChanges, untrackedFiles, paths };
}

export function buildDocChecklist(paths) {
  const items = [];
  const seen = new Set();
  const hasPath = (predicate) => paths.some(predicate);

  addChecklistItem(items, seen, 'PR70_RECOVERY_CHANGELOG.md', 'record the slice, decision, validation, and local-vs-pushed status before ending the run');

  if (hasPath((path) => path === 'AGENTS.md')) {
    addChecklistItem(items, seen, 'AGENTS.md', 'operating rules changed; keep the timestamp and routing guidance current');
  }

  if (hasPath((path) => path === 'SUBAGENT_LOG.md' || path.includes('SUBAGENT') || path.includes('AGENT_FINDINGS'))) {
    addChecklistItem(items, seen, 'SUBAGENT_LOG.md', 'subagent batches need tickets, results, integration status, and follow-ups');
  }

  if (hasPath((path) => path === 'package.json' || path.startsWith('scripts/') || path.startsWith('tests/') || path.startsWith('.github/') || path === 'AGENTS.md')) {
    addChecklistItem(items, seen, 'LESSONS_LEARNED.md', 'process, tooling, tests, and CI guardrails should capture durable lessons');
  }

  if (hasPath((path) => path === 'package.json' || path.startsWith('scripts/'))) {
    addChecklistItem(items, seen, 'package.json', 'new repeatable commands should have npm entrypoints when agents are expected to run them');
  }

  if (hasPath((path) => path.startsWith('api/story-lab/') || path.includes('story-lab'))) {
    addChecklistItem(items, seen, 'STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md', 'Story Lab platform hardening status may need a progress or non-claim update');
  }

  if (hasPath((path) => path.includes('storage') || path.includes('cloud') || path.includes('profile') || path.includes('account'))) {
    addChecklistItem(items, seen, 'STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md', 'auth/profile/cloud-library work needs explicit current status');
    addChecklistItem(items, seen, 'STORY_LAB_STORAGE_PORT_EXEC_PLAN.md', 'storage mode and durability claims need to stay honest');
  }

  if (hasPath((path) => path.includes('job'))) {
    addChecklistItem(items, seen, 'STORY_LAB_JOB_ROUTES_EXEC_PLAN.md', 'job route/store/SSE changes need non-durable vs durable status updates');
  }

  if (hasPath((path) => path.startsWith('api/') || path === 'vercel.json')) {
    addChecklistItem(items, seen, 'STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md', 'Vercel route shape or function budget may have changed');
  }

  if (hasPath((path) => path.includes('cors') || path.includes('export') || path.includes('stream') || path.includes('privacy'))) {
    addChecklistItem(items, seen, 'STORY_LAB_PRIVACY_STREAMING_GATES_EXEC_PLAN.md', 'privacy, CORS, export, retention, or streaming invariants may have changed');
  }

  return items;
}

export function isEntrypoint(moduleUrl, argvPath = process.argv[1]) {
  if (!argvPath) {
    return false;
  }
  return fileURLToPath(moduleUrl) === resolve(argvPath);
}

function printList(title, values) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  if (values.length === 0) {
    console.log('none');
    return;
  }
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

function getAheadBehind(leftRef, rightRef) {
  const result = git(['rev-list', '--left-right', '--count', `${leftRef}...${rightRef}`]);
  if (result.status !== 0) {
    return null;
  }
  const [behind, ahead] = result.stdout.split(/\s+/).map((value) => Number.parseInt(value, 10));
  return { ahead, behind };
}

function splitLines(output) {
  return output.split('\n').filter(Boolean);
}

function uniquePaths(...pathLists) {
  return [...new Set(pathLists.flat().filter(Boolean))];
}

function getDiffPaths(baseRef) {
  const result = git(['diff', '--name-only', `${baseRef}...HEAD`]);
  if (result.status !== 0) {
    return [];
  }
  return splitLines(result.stdout);
}

function getLocalMainDelta(originMainExists) {
  if (!originMainExists) {
    return null;
  }
  const mainExists = git(['rev-parse', '--verify', '--quiet', 'refs/heads/main']).status === 0;
  if (!mainExists) {
    return null;
  }
  return getAheadBehind('origin/main', 'refs/heads/main');
}

function requireGitResult(label, result) {
  if (result.status === 0) {
    return true;
  }

  console.error(`recovery:finish could not read ${label}; aborting.`);
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exitCode = 1;
  return false;
}

function collectStopSigns({ branch, localMainDelta, originDelta, originMainExists, status }) {
  const stopSigns = [];

  if (status.trackedChanges > 0 || status.untrackedFiles > 0) {
    stopSigns.push(`working tree is not clean (${status.trackedChanges} tracked, ${status.untrackedFiles} untracked)`);
  }

  if (!originMainExists) {
    stopSigns.push('origin/main is unavailable; fetch before final status or PR-ready claims');
  }

  if (branch === 'main' && originDelta && (originDelta.ahead > 0 || originDelta.behind > 0)) {
    stopSigns.push(`local main differs from origin/main (ahead ${originDelta.ahead}, behind ${originDelta.behind})`);
  }

  if (branch !== 'main' && localMainDelta && (localMainDelta.ahead > 0 || localMainDelta.behind > 0)) {
    stopSigns.push(`local main differs from origin/main (ahead ${localMainDelta.ahead}, behind ${localMainDelta.behind})`);
  }

  return stopSigns;
}

function collectPublicationReminders({ branch, originDelta, upstream, upstreamDelta }) {
  const reminders = [];

  if (upstream.status !== 0) {
    reminders.push('no upstream is configured; push with -u before treating this branch as durable');
  } else if (upstreamDelta && upstreamDelta.ahead > 0) {
    reminders.push(`branch has ${upstreamDelta.ahead} unpushed commit(s) relative to ${upstream.stdout}`);
  }

  if (upstreamDelta && upstreamDelta.behind > 0) {
    reminders.push(`branch is behind ${upstream.stdout} by ${upstreamDelta.behind} commit(s); pull or rebase before final status`);
  }

  if (originDelta && originDelta.behind > 0 && branch !== 'main') {
    reminders.push(`branch is behind origin/main by ${originDelta.behind} commit(s); rebase or explain why not before PR-ready claims`);
  }

  return reminders;
}

function main(argv) {
  const strict = argv.includes('--strict');
  const branchResult = git(['branch', '--show-current']);
  const headResult = git(['rev-parse', '--short', 'HEAD']);
  const statusResult = git(['status', '--porcelain=v1', '--untracked-files=all']);

  if (!requireGitResult('branch', branchResult) || !requireGitResult('HEAD', headResult) || !requireGitResult('working tree status', statusResult)) {
    return;
  }

  const branch = branchResult.stdout || 'detached HEAD';
  const head = headResult.stdout;
  const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const status = parsePorcelainStatus(statusResult.stdout);
  const originMainExists = git(['rev-parse', '--verify', '--quiet', 'origin/main']).status === 0;
  const originDelta = originMainExists ? getAheadBehind('origin/main', 'HEAD') : null;
  const changedPaths = originMainExists ? getDiffPaths('origin/main') : [];
  const localMainDelta = getLocalMainDelta(originMainExists);
  const upstreamDelta = upstream.status === 0 ? getAheadBehind(upstream.stdout, 'HEAD') : null;

  const stopSigns = collectStopSigns({ branch, localMainDelta, originDelta, originMainExists, status });
  const reminders = collectPublicationReminders({ branch, originDelta, upstream, upstreamDelta });
  const docChecklist = buildDocChecklist(uniquePaths(status.paths, changedPaths));

  console.log('Recovery finish check');
  console.log('=====================');
  console.log(`Branch: ${branch}`);
  console.log(`HEAD: ${head}`);
  console.log(`Upstream: ${upstream.status === 0 ? upstream.stdout : 'none'}`);
  if (originDelta) {
    console.log(`Delta vs origin/main: ahead ${originDelta.ahead}, behind ${originDelta.behind}`);
  } else {
    console.log('Delta vs origin/main: unavailable');
  }
  if (localMainDelta) {
    console.log(`Local main vs origin/main: ahead ${localMainDelta.ahead}, behind ${localMainDelta.behind}`);
  } else {
    console.log('Local main vs origin/main: unavailable or not checked');
  }
  console.log(`Working tree: ${status.trackedChanges} tracked change(s), ${status.untrackedFiles} untracked file(s)`);
  console.log(`Changed paths vs origin/main: ${changedPaths.length}`);

  printList('Stop signs', stopSigns);
  printList('Publication reminders', reminders);

  console.log('\nDoc update checklist');
  console.log('--------------------');
  for (const item of docChecklist) {
    console.log(`- ${item.file}: ${item.reason}`);
  }

  console.log('\nBefore final answer or PR-ready claim');
  console.log('-------------------------------------');
  console.log('- Run `git diff --check` for docs-only or source changes.');
  console.log('- Run the focused test/typecheck/build command that matches the changed surface.');
  console.log('- Push/open/update the PR when work is meant to be durable.');
  console.log('- If anything stays local-only, say why and what remains.');

  if (strict && (stopSigns.length > 0 || reminders.length > 0)) {
    process.exitCode = 1;
  }
}

if (isEntrypoint(import.meta.url)) {
  main(process.argv.slice(2));
}
