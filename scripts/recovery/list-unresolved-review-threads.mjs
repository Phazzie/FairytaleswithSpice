#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_LIMIT = 200;
const VALUE_OPTION_NAMES = new Set(['--limit', '--state', '--repo', '--prs']);
const THREAD_MODES = new Set(['active', 'include-outdated', 'outdated-only']);
const GH_CANDIDATE_PATHS = [
  '/usr/bin/gh',
  '/usr/local/bin/gh',
  '/opt/homebrew/bin/gh',
];

let ghBinary = '';

export function parseArgs(argv) {
  const options = {
    limit: DEFAULT_LIMIT,
    state: 'all',
    format: 'markdown',
    threadMode: 'active',
    prs: [],
    repo: '',
  };

  const pendingArgs = [...argv];

  while (pendingArgs.length > 0) {
    const arg = pendingArgs.shift();

    if (arg === '--json') {
      options.format = 'json';
      continue;
    }

    if (arg === '--markdown') {
      options.format = 'markdown';
      continue;
    }

    if (arg === '--include-outdated') {
      setThreadMode(options, 'include-outdated');
      continue;
    }

    if (arg === '--outdated-only') {
      setThreadMode(options, 'outdated-only');
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    const parsedOption = parseValueOption(arg, pendingArgs);
    applyValueOption(options, parsedOption.name, parsedOption.value);
  }

  validateOptions(options);
  return options;
}

function setThreadMode(options, threadMode) {
  if (options.threadMode !== 'active' && options.threadMode !== threadMode) {
    throw new Error('Choose only one outdated thread mode: --include-outdated or --outdated-only');
  }

  options.threadMode = threadMode;
}

function parseValueOption(arg, pendingArgs) {
  const equalsIndex = arg.indexOf('=');
  const name = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);

  if (!VALUE_OPTION_NAMES.has(name)) {
    throw new Error(`Unknown argument: ${arg}`);
  }

  const value = equalsIndex === -1 ? pendingArgs.shift() : arg.slice(equalsIndex + 1);
  if (!value) {
    throw new Error(`${name} requires a value`);
  }

  return {
    name,
    value,
  };
}

function applyValueOption(options, name, value) {
  const handlers = {
    '--limit': () => {
      options.limit = Number(value);
    },
    '--state': () => {
      options.state = value;
    },
    '--repo': () => {
      options.repo = value;
    },
    '--prs': () => {
      options.prs = parsePrList(value);
    },
  };

  handlers[name]();
}

function validateOptions(options) {
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error('--limit must be a positive integer');
  }

  if (!['all', 'open', 'closed', 'merged'].includes(options.state)) {
    throw new Error('--state must be one of: all, open, closed, merged');
  }

  if (!THREAD_MODES.has(options.threadMode)) {
    throw new Error('--threadMode must be one of: active, include-outdated, outdated-only');
  }
}

function parsePrList(value) {
  return value
    .split(',')
    .map((entry) => entry.trim().replace(/^#/, ''))
    .filter(Boolean)
    .map(Number)
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function printHelp() {
  console.log(`Usage: npm run review:unresolved -- [options]

Lists unresolved GitHub review threads across pull requests.

Options:
  --prs 149,150,151       Audit only selected pull request numbers.
  --limit 200             Number of PRs to scan when --prs is omitted.
  --state all             PR state for gh pr list: all, open, closed, merged.
  --repo owner/name       Repository override. Defaults to gh's current repo.
  --include-outdated      Include outdated unresolved review threads.
  --outdated-only         List only outdated unresolved review threads.
  --json                  Emit machine-readable JSON.
  --markdown              Emit a markdown table. This is the default.
`);
}

function runGh(args) {
  try {
    return execFileSync(getGhBinary(), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8').trim() : '';
    throw new Error(stderr || error.message);
  }
}

function getGhBinary() {
  if (ghBinary) {
    return ghBinary;
  }

  ghBinary = GH_CANDIDATE_PATHS.find(isExecutable) || '';
  if (!ghBinary) {
    throw new Error(`GitHub CLI not found in fixed paths: ${GH_CANDIDATE_PATHS.join(', ')}`);
  }

  return ghBinary;
}

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getRepoParts(repoOverride) {
  const repo = repoOverride || runGh(['repo', 'view', '--json', 'owner,name', '--jq', '.owner.login + "/" + .name']);
  const [owner, name] = repo.split('/');

  if (!owner || !name) {
    throw new Error(`Could not parse repository as owner/name: ${repo}`);
  }

  return { owner, name };
}

function listPullRequests(options) {
  if (options.prs.length > 0) {
    return [...new Set(options.prs)].map((number) => ({ number }));
  }

  const args = [
    'pr',
    'list',
    '--state',
    options.state,
    '--limit',
    String(options.limit),
    '--json',
    'number,title,state,url',
  ];

  if (options.repo) {
    args.push('--repo', options.repo);
  }

  return JSON.parse(runGh(args));
}

function fetchPullRequest(owner, repo, number) {
  const reviewThreads = [];
  let pullRequest = null;
  let cursor = '';

  do {
    const page = fetchReviewThreadPage(owner, repo, number, cursor);
    pullRequest = pullRequest || page;
    reviewThreads.push(...page.reviewThreads.nodes);
    cursor = page.reviewThreads.pageInfo.hasNextPage ? page.reviewThreads.pageInfo.endCursor : '';
  } while (cursor);

  return {
    ...pullRequest,
    reviewThreads: {
      nodes: reviewThreads,
    },
  };
}

function fetchReviewThreadPage(owner, repo, number, cursor) {
  const args = [
    'api',
    'graphql',
    '-f',
    `query=${REVIEW_THREADS_QUERY}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${repo}`,
    '-F',
    `number=${number}`,
  ];

  if (cursor) {
    args.push('-f', `cursor=${cursor}`);
  }

  return JSON.parse(
    runGh(args),
  ).data.repository.pullRequest;
}

const REVIEW_THREADS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      title
      state
      url
      reviewThreads(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 1) {
            nodes {
              author {
                login
              }
              body
              url
            }
          }
        }
      }
    }
  }
}`;

function summarizeThread(thread) {
  const firstComment = thread.comments.nodes[0] || {};
  const body = typeof firstComment.body === 'string' ? firstComment.body : '';
  const firstLine = body.split(/\r?\n/).find((line) => line.trim().length > 0) || '';
  return {
    id: thread.id,
    isOutdated: Boolean(thread.isOutdated),
    path: thread.path || '',
    line: thread.line || null,
    author: firstComment.author?.login || '',
    url: firstComment.url || '',
    firstLine: firstLine.slice(0, 160),
  };
}

export function selectUnresolvedThreads(threads, threadMode = 'active') {
  if (!THREAD_MODES.has(threadMode)) {
    throw new Error(`Unknown thread mode: ${threadMode}`);
  }

  return threads
    .filter((thread) => !thread.isResolved)
    .filter((thread) => {
      if (threadMode === 'include-outdated') {
        return true;
      }

      if (threadMode === 'outdated-only') {
        return thread.isOutdated;
      }

      return !thread.isOutdated;
    })
    .map(summarizeThread);
}

export function buildPullRequestRow(pullRequest, threadMode) {
  const unresolvedThreads = selectUnresolvedThreads(pullRequest.reviewThreads.nodes, threadMode);

  if (unresolvedThreads.length === 0) {
    return null;
  }

  return {
    number: pullRequest.number,
    state: pullRequest.state,
    matchingThreads: unresolvedThreads.length,
    threadMode,
    title: pullRequest.title,
    url: pullRequest.url,
    threads: unresolvedThreads,
  };
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', String.raw`\|`).replaceAll(/\r?\n/g, ' ');
}

function printMarkdown(rows) {
  if (rows.length === 0) {
    console.log('No matching unresolved review threads found.');
    return;
  }

  console.log('| PR | State | Matching threads | Title | URL |');
  console.log('|---|---:|---:|---|---|');
  for (const row of rows) {
    console.log(
      `| #${row.number} | ${escapeCell(row.state)} | ${row.matchingThreads} | ${escapeCell(row.title)} | ${escapeCell(row.url)} |`,
    );
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const { owner, name } = getRepoParts(options.repo);
  const pullRequests = listPullRequests(options);
  const rows = [];

  for (const entry of pullRequests) {
    const pullRequest = fetchPullRequest(owner, name, entry.number);
    const row = buildPullRequestRow(pullRequest, options.threadMode);

    if (!row) {
      continue;
    }

    rows.push(row);
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  printMarkdown(rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
