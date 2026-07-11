#!/usr/bin/env node
// Created: 2026-07-11 00:00 EDT
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FAILING_OUTCOMES = new Set(['ACTION_REQUIRED', 'CANCELLED', 'ERROR', 'FAILURE', 'FAILED', 'TIMED_OUT']);
const PENDING_OUTCOMES = new Set(['EXPECTED', 'IN_PROGRESS', 'PENDING', 'QUEUED', 'REQUESTED', 'WAITING']);
const GH_COMMAND_TIMEOUT_MS = 30000;
const GH_EXECUTABLE_CANDIDATES = [
  process.env.GH_BIN,
  '/opt/homebrew/bin/gh',
  '/usr/local/bin/gh',
  '/usr/bin/gh',
].filter(Boolean);

function normalizeValue(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function checkOutcome(check) {
  return normalizeValue(check?.conclusion ?? check?.state ?? check?.status).toUpperCase();
}

function checkName(check) {
  return normalizeValue(check?.name ?? check?.context ?? check?.workflowName ?? check?.__typename) || 'unknown check';
}

function formatNameList(names) {
  const uniqueNames = [...new Set(names.filter(Boolean))];
  const shown = uniqueNames.slice(0, 3).join(', ');
  const extra = uniqueNames.length - 3;
  return extra > 0 ? `${shown}, +${extra} more` : shown || 'unknown check';
}

export function summarizeCheckRollup(checks) {
  const rollup = Array.isArray(checks) ? checks : [];
  if (rollup.length === 0) {
    return 'no checks reported';
  }

  const failing = rollup.filter((check) => FAILING_OUTCOMES.has(checkOutcome(check))).map(checkName);
  if (failing.length > 0) {
    return `failing: ${formatNameList(failing)}`;
  }

  const pending = rollup.filter((check) => PENDING_OUTCOMES.has(checkOutcome(check))).map(checkName);
  if (pending.length > 0) {
    return `pending: ${formatNameList(pending)}`;
  }

  return 'checks passing';
}

export function formatOpenPrSummary(prs) {
  const openPrs = Array.isArray(prs) ? prs : [];
  if (openPrs.length === 0) {
    return ['none'];
  }

  return openPrs.map((pr) => {
    const draft = pr?.isDraft ? ' draft' : '';
    const number = normalizeValue(pr?.number);
    const title = normalizeValue(pr?.title) || 'untitled';
    const branch = normalizeValue(pr?.headRefName) || 'unknown branch';
    const checks = summarizeCheckRollup(pr?.statusCheckRollup);
    return `- #${number}${draft}: ${title} [${branch}; ${checks}]`;
  });
}

export function formatOpenPrCommandResult(result) {
  if (result?.warning) {
    return ['unavailable'];
  }
  return formatOpenPrSummary(result?.prs);
}

export function exitCodeForOpenPrResult(result) {
  return result?.warning ? 1 : 0;
}

function isExecutableFile(candidate) {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function selectGhExecutable(candidates, exists = isExecutableFile) {
  for (const candidate of candidates) {
    if (isAbsolute(candidate) && exists(candidate)) {
      return candidate;
    }
  }
  return '';
}

export function buildGhSpawnOptions() {
  return {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: GH_COMMAND_TIMEOUT_MS,
  };
}

function readOpenPrs() {
  const ghExecutable = selectGhExecutable(GH_EXECUTABLE_CANDIDATES);
  if (!ghExecutable) {
    return {
      prs: [],
      warning: 'GitHub CLI unavailable; set GH_BIN to an absolute gh path or install gh in /opt/homebrew/bin, /usr/local/bin, or /usr/bin before PR/status claims.',
    };
  }

  // ghExecutable is selected from fixed absolute candidates above. Do not call bare "gh" here.
  const result = spawnSync(
    ghExecutable,
    [
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      '20',
      '--json',
      'number,title,headRefName,isDraft,statusCheckRollup',
    ],
    buildGhSpawnOptions(),
  );

  if (result.error) {
    return {
      prs: [],
      warning: `GitHub CLI unavailable; run gh pr list --state open before PR/status claims. (${result.error.message})`,
    };
  }

  if (result.status !== 0) {
    const detail = normalizeValue(result.stderr) || `exit ${result.status}`;
    return {
      prs: [],
      warning: `Could not read open PRs with gh; run gh pr list --state open manually before PR/status claims. (${detail})`,
    };
  }

  try {
    return { prs: JSON.parse(result.stdout || '[]'), warning: '' };
  } catch (error) {
    return {
      prs: [],
      warning: `Could not parse gh open-PR output; run gh pr list --state open manually. (${error.message})`,
    };
  }
}

function main() {
  const result = readOpenPrs();
  for (const line of formatOpenPrCommandResult(result)) {
    console.log(line);
  }
  if (result.warning) {
    console.error(`WARNING: ${result.warning}`);
  }
  process.exitCode = exitCodeForOpenPrResult(result);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
