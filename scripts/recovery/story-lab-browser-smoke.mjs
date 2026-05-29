// Created: 2026-05-28 05:20 UTC

import { access, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'tmp', 'story-lab-smoke');
const providedUrl = process.env.STORY_LAB_SMOKE_URL;
let appUrl = providedUrl;
const liveMode = process.env.STORY_LAB_SMOKE_LIVE === '1';
const shouldStartStaticServer = !providedUrl;
const shouldBuildStaticApp = shouldStartStaticServer && process.env.STORY_LAB_SMOKE_SKIP_BUILD !== '1';
const shouldSkipHttpWait = process.env.STORY_LAB_SMOKE_SKIP_HTTP_WAIT === '1'
  || Boolean(providedUrl && new URL(providedUrl).searchParams.has('_vercel_share'));

const smokeSelectors = Object.freeze({
  heading: '[data-testid="story-lab-heading"]',
  debugPanel: '[data-testid="story-lab-debug-panel"]',
  creature: '[data-testid="blueprint-creature"]',
  tone: '[data-testid="blueprint-tone"]',
  spicyLevel: '[data-testid="blueprint-spicy-level"]',
  wordBudget: '[data-testid="blueprint-word-budget"]',
  chapterBatchSize: '[data-testid="blueprint-chapter-batch-size"]',
  logline: '[data-testid="blueprint-logline"]',
  protagonist: '[data-testid="blueprint-protagonist"]',
  antagonist: '[data-testid="blueprint-antagonist"]',
  worldDetails: '[data-testid="blueprint-world-details"]',
  generateButton: '[data-testid="generate-chapters"]',
  continueButton: '[data-testid="continue-saga"]',
  storyPanel: '[data-testid="story-panel"]',
  storyTitle: '[data-testid="story-title"]',
  themeChip: themeId => `[data-testid="theme-chip"][data-theme-id="${themeId}"]`,
  chapterView: chapterNumber => `[data-testid="chapter-view"][data-chapter-number="${chapterNumber}"]`
});

const demoBlueprint = Object.freeze({
  creature: 'siren',
  tone: 'dark_romance',
  spicyLevel: '1',
  wordBudgetLabel: '600 words',
  chapterBatchLabel: '1 chapter',
  themeId: 'forbidden_love',
  logline: 'A siren diplomat risks exile to save a forbidden lover before a cruel reef court.',
  protagonist: 'Mira',
  antagonist: 'Lord Brine',
  worldDetails: 'A moonlit reef court where vow-binding songs carry the force of law.'
});

const consoleMessages = [];
let staticServer = null;

await mkdir(outputDir, { recursive: true });

try {
  if (shouldBuildStaticApp) {
    await runBuild();
  }

  if (shouldStartStaticServer) {
    staticServer = await startStaticServer();
  }

  if (!shouldSkipHttpWait) {
    await waitForHttp(appUrl, 180_000);
  }
  await runSmoke();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (consoleMessages.length) {
    console.error('\nBrowser console output:');
    for (const message of consoleMessages.slice(-25)) {
      console.error(`- ${message}`);
    }
  }
  process.exitCode = 1;
} finally {
  if (staticServer) {
    await new Promise(resolve => staticServer.close(resolve));
  }
}

async function runBuild() {
  if (currentNodeMajorVersion() === 20) {
    await runCommand('npm', ['run', 'build'], rootDir);
    return;
  }

  await runCommand('npx', [
    '--yes',
    '-p',
    'node@20',
    '--',
    'node',
    '-e',
    [
      'console.log(process.version)',
      "const { spawnSync } = require('node:child_process')",
      "const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'",
      "const result = spawnSync(command, ['run', 'build'], { stdio: 'inherit' })",
      'process.exit(result.status ?? 1)'
    ].join(';')
  ], rootDir);
}

function currentNodeMajorVersion() {
  return Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32'
    });

    child.stdout.on('data', chunk => {
      const text = chunk.toString().trim();
      if (text) {
        console.log(`[build] ${text}`);
      }
    });
    child.stderr.on('data', chunk => {
      const text = chunk.toString().trim();
      if (text) {
        console.error(`[build] ${text}`);
      }
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function startStaticServer() {
  const browserDir = path.join(rootDir, 'story-generator', 'dist', 'story-generator', 'browser');
  const server = createServer((request, response) => {
    void serveStaticRequest(browserDir, request, response).catch(error => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Static smoke server error');
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Static smoke server did not expose a TCP port.');
  }

  appUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Serving built Story Lab app at ${appUrl}`);
  return server;
}

async function serveStaticRequest(browserDir, request, response) {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  const filePath = resolveStaticFilePath(browserDir, requestUrl.pathname);

  if (!filePath) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  const fallbackCandidates = path.extname(requestUrl.pathname)
    ? [filePath]
    : [filePath, path.join(browserDir, 'index.html'), path.join(browserDir, 'index.csr.html')];
  const fileToServe = await firstExistingFile(fallbackCandidates);

  if (!fileToServe) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  streamFile(fileToServe, response);
}

async function firstExistingFile(filePaths) {
  for (const filePath of filePaths) {
    if (await fileExists(filePath)) {
      return filePath;
    }
  }
  return null;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveStaticFilePath(root, urlPathname) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPathname);
  } catch {
    return null;
  }

  let relativePath = pathname === '/' ? 'index.html' : pathname;
  while (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }

  const resolvedRoot = path.resolve(root);
  const filePath = path.resolve(resolvedRoot, relativePath);
  const isInsideRoot = filePath === resolvedRoot || filePath.startsWith(`${resolvedRoot}${path.sep}`);

  return isInsideRoot ? filePath : null;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  if (filePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }
  if (filePath.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }
  if (filePath.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  if (filePath.endsWith('.png')) {
    return 'image/png';
  }
  if (filePath.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

function streamFile(filePath, response) {
  const stream = createReadStream(filePath);

  stream.on('open', () => {
    response.writeHead(200, { 'content-type': contentType(filePath) });
    stream.pipe(response);
  });

  stream.on('error', error => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Static file read error');
  });
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

async function runSmoke() {
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to launch Chromium for browser smoke. Run "npx playwright install chromium" and retry. Original error: ${message}`
    );
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 }
    });
    page = await context.newPage();

    page.on('console', message => {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    if (!liveMode) {
      await installMockStoryLabRoutes(page);
    }

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.locator(smokeSelectors.heading).waitFor({ timeout: 20_000 });
    await expectHidden(page.locator(smokeSelectors.debugPanel));

    await page.locator(smokeSelectors.creature).selectOption(demoBlueprint.creature);
    await page.locator(smokeSelectors.tone).selectOption(demoBlueprint.tone);
    await page.locator(smokeSelectors.spicyLevel).fill(demoBlueprint.spicyLevel);
    await page.locator(smokeSelectors.wordBudget).selectOption({ label: demoBlueprint.wordBudgetLabel });
    await page.locator(smokeSelectors.chapterBatchSize).selectOption({ label: demoBlueprint.chapterBatchLabel });
    await page.locator(smokeSelectors.logline).fill(demoBlueprint.logline);
    await page.locator(smokeSelectors.protagonist).fill(demoBlueprint.protagonist);
    await page.locator(smokeSelectors.antagonist).fill(demoBlueprint.antagonist);
    await page.locator(smokeSelectors.worldDetails).fill(demoBlueprint.worldDetails);
    await page.locator(smokeSelectors.themeChip(demoBlueprint.themeId)).click();

    await page.locator(smokeSelectors.generateButton).click();
    await page.locator(smokeSelectors.storyPanel).waitFor({ timeout: liveMode ? 90_000 : 20_000 });
    await expectNonEmptyText(page.locator(smokeSelectors.storyTitle), 'story title');
    await page.locator(smokeSelectors.chapterView(1)).waitFor({ timeout: 20_000 });

    await page.locator(smokeSelectors.continueButton).click();
    await page.locator(smokeSelectors.chapterView(2)).waitFor({ timeout: liveMode ? 90_000 : 20_000 });

    if (!liveMode) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator(smokeSelectors.heading).waitFor({ timeout: 20_000 });
      await page.locator(smokeSelectors.storyPanel).waitFor({ timeout: 20_000 });
      await page.locator(smokeSelectors.chapterView(2)).waitFor({ timeout: 20_000 });
      await expectNonEmptyText(page.locator(smokeSelectors.storyTitle), 'restored story title');
    }

    await page.screenshot({ path: path.join(outputDir, liveMode ? 'live-success.png' : 'mock-success.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 920 });
    await page.screenshot({ path: path.join(outputDir, liveMode ? 'live-mobile-success.png' : 'mock-mobile-success.png'), fullPage: true });
    console.log(`Story Lab browser smoke passed (${liveMode ? 'live' : 'mock'} mode) at ${appUrl}`);
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(outputDir, liveMode ? 'live-failure.png' : 'mock-failure.png'), fullPage: true });
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function installMockStoryLabRoutes(page) {
  await page.route('**/api/story-lab/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { status: 'ok', time: new Date().toISOString() } })
    });
  });

  await page.route('**/api/story-lab/stories', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: buildPayload([buildChapter(1)], 1) })
    });
  });

  await page.route('**/api/story-lab/stories/*/continue', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ...buildPayload([buildChapter(2)], 2), appendedChapterNumbers: [2] } })
    });
  });
}

function buildPayload(chapters, revision) {
  const now = new Date().toISOString();
  return {
    summary: {
      storyId: 'story-smoke',
      title: 'Reefbound Vow',
      synopsis: 'A siren diplomat risks exile to save forbidden testimony from a cruel reef court.',
      tone: 'dark_romance',
      spicyLevel: 1,
      createdAt: now,
      updatedAt: now
    },
    batch: {
      chapters,
      totalWordCount: chapters.reduce((total, chapter) => total + chapter.wordCount, 0),
      suggestedNextPrompts: ['Raise the stakes inside the reef court.']
    },
    state: {
      storyId: 'story-smoke',
      revision,
      characters: [
        {
          id: 'character-mira',
          displayName: 'Mira',
          archetype: 'protagonist',
          summary: 'A siren diplomat torn between exile and testimony.',
          currentGoal: 'Protect her forbidden lover.',
          internalConflict: 'Duty to the court fights loyalty to love.',
          externalConflict: 'Lord Brine controls the reef court.',
          secrets: [],
          relationships: [],
          spiceCompatibilities: [1, 2, 3]
        }
      ],
      threads: [
        {
          id: 'thread-reef-court',
          label: 'Reef Court Trial',
          status: revision > 1 ? 'escalating' : 'active',
          description: 'The court tests whether Mira will betray love or law.',
          foreshadowedDevices: ['vow-binding song']
        }
      ],
      artifacts: [],
      beats: chapters.map(chapter => ({
        id: `beat-${chapter.chapterNumber}`,
        chapterNumber: chapter.chapterNumber,
        summary: chapter.summary,
        beatType: chapter.chapterNumber === 1 ? 'inciting_incident' : 'rising_action',
        tensionLevel: chapter.chapterNumber === 1 ? 3 : 4,
        spicyLevel: 1
      })),
      continuityWarnings: [],
      narrativeVoice: 'Lush, tense, and romantic.',
      lastUpdatedAt: now
    },
    stateDelta: {
      storyId: 'story-smoke',
      fromRevision: revision === 1 ? null : revision - 1,
      toRevision: revision,
      addedChapterNumbers: chapters.map(chapter => chapter.chapterNumber),
      introducedCharacters: [],
      updatedCharacters: [],
      resolvedThreads: [],
      escalatedThreads: [],
      foreshadowedArtifacts: [],
      continuityWarnings: [],
      beatIds: chapters.map(chapter => `beat-${chapter.chapterNumber}`),
      summary: 'Smoke-test state delta.'
    },
    persistence: {
      mode: 'client_carried',
      persistedRevision: revision,
      persistedAt: now
    },
    continuityExtraction: {
      source: liveMode ? 'ai' : 'heuristic',
      extractedAt: now,
      confidence: liveMode ? 0.82 : 0.55,
      warning: liveMode ? undefined : 'Continuity is using local heuristic extraction in smoke mode.'
    },
    telemetry: {
      engine: liveMode ? 'grok' : 'custom',
      model: liveMode ? 'grok-4.3' : 'mock-story-lab',
      reasoningEffort: liveMode ? 'medium' : undefined,
      totalLatencyMs: 100,
      averageChapterLatencyMs: 100,
      tokensConsumed: 1000,
      retryCount: 0
    }
  };
}

function buildChapter(chapterNumber) {
  return {
    chapterId: `chapter-${chapterNumber}`,
    chapterNumber,
    title: chapterNumber === 1 ? 'Reefbound Vow' : 'The Claimed Voice',
    htmlContent: `<p>Mira entered the reef court knowing every song could become a sentence.</p><p>Lord Brine smiled as the water darkened around the witness shell.</p>`,
    rawContent: `Mira entered the reef court knowing every song could become a sentence.`,
    summary: chapterNumber === 1
      ? 'Mira enters the reef court and chooses love over silence.'
      : 'The court escalates its claim while Mira protects the testimony.',
    wordCount: 96,
    hasCliffhanger: true,
    delta: {
      introducedCharacters: [],
      resolvedThreads: [],
      escalatedThreads: ['thread-reef-court'],
      foreshadowedArtifacts: [],
      continuityFlags: []
    }
  };
}

async function expectHidden(locator) {
  const count = await locator.count();
  if (count === 0) {
    return;
  }
  if (await locator.first().isVisible()) {
    throw new Error('Debug panel is visible in default public Story Lab view.');
  }
}

async function expectNonEmptyText(locator, label) {
  await locator.waitFor({ timeout: 20_000 });
  const text = (await locator.textContent())?.trim();
  if (!text) {
    throw new Error(`Expected ${label} to contain visible text.`);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
