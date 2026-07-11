#!/usr/bin/env node
// Created: 2026-07-11 00:00 EDT
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FAILING_OUTCOMES = new Set(['ACTION_REQUIRED', 'CANCELLED', 'ERROR', 'FAILURE', 'FAILED', 'TIMED_OUT']);
const PENDING_OUTCOMES = new Set(['EXPECTED', 'IN_PROGRESS', 'PENDING', 'QUEUED', 'REQUESTED', 'WAITING']);

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

function readOpenPrs() {
  const result = spawnSync(
    'gh',
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
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
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

export function isEntrypoint(moduleUrl, argvPath = process.argv[1]) {
  return Boolean(argvPath) && fileURLToPath(moduleUrl) === resolve(argvPath);
}

function main() {
  const { prs, warning } = readOpenPrs();
  for (const line of formatOpenPrSummary(prs)) {
    console.log(line);
  }
  if (warning) {
    console.log(`WARNING: ${warning}`);
  }
}

if (isEntrypoint(import.meta.url)) {
  main();
}
