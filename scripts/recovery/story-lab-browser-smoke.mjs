// Created: 2026-05-28 05:20 UTC

import { mkdir } from 'node:fs/promises';
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

  await waitForHttp(appUrl, 180_000);
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
  await runCommand('npx', [
    '-p',
    'node@20',
    '-c',
    'node -v && npm run build'
  ], rootDir);
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
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const safePath = pathname.includes('..') ? '/' : pathname;
    const relativePath = safePath === '/' ? '/index.html' : safePath;
    const filePath = path.join(browserDir, relativePath);

    streamFile(filePath, response, () => {
      streamFile(path.join(browserDir, 'index.html'), response, () => {
        streamFile(path.join(browserDir, 'index.csr.html'), response, () => {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('Not found');
        });
      });
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
  return 'application/octet-stream';
}

function streamFile(filePath, response, onMissing) {
  const stream = createReadStream(filePath);
  let opened = false;

  stream.on('open', () => {
    opened = true;
    response.writeHead(200, { 'content-type': contentType(filePath) });
    stream.pipe(response);
  });

  stream.on('error', () => {
    if (!opened) {
      onMissing();
    }
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
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new Error(
      `Unable to launch Chromium for browser smoke. Run "npx playwright install chromium" and retry. Original error: ${error.message}`
    );
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 }
  });
  const page = await context.newPage();

  page.on('console', message => {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  if (!liveMode) {
    await installMockStoryLabRoutes(page);
  }

  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Fairytales with Spice/i }).waitFor({ timeout: 20_000 });
    await expectHidden(page.getByText('Story Lab Debug Console'));

    await page.getByLabel('Creature Archetype').selectOption('siren');
    await page.getByLabel('Narrative Tone').selectOption('dark_romance');
    await page.getByLabel('Spicy Level').fill('1');
    await page.getByLabel('Desired Word Budget').selectOption({ label: '600 words' });
    await page.getByLabel('Chapters per Batch').selectOption({ label: '1 chapter' });
    await page.getByLabel('Logline').fill('A siren diplomat risks exile to save a forbidden lover before a cruel reef court.');
    await page.getByLabel('Protagonist Name').fill('Mira');
    await page.getByLabel('Antagonist Name').fill('Lord Brine');
    await page.getByLabel('World Details').fill('A moonlit reef court where vow-binding songs carry the force of law.');
    await page.getByRole('button', { name: /Forbidden Love/i }).click();

    await page.getByRole('button', { name: /Generate Chapters/i }).click();
    await page.getByRole('heading', { name: 'Reefbound Vow', level: 2 }).waitFor({ timeout: liveMode ? 90_000 : 20_000 });
    await page.getByText(/Chapter 1/i).first().waitFor({ timeout: 20_000 });

    await page.getByRole('button', { name: /Continue Saga/i }).click();
    await page.getByText(/Chapter 2/i).first().waitFor({ timeout: liveMode ? 90_000 : 20_000 });

    await page.screenshot({ path: path.join(outputDir, liveMode ? 'live-success.png' : 'mock-success.png'), fullPage: true });
    console.log(`Story Lab browser smoke passed (${liveMode ? 'live' : 'mock'} mode) at ${appUrl}`);
  } catch (error) {
    await page.screenshot({ path: path.join(outputDir, liveMode ? 'live-failure.png' : 'mock-failure.png'), fullPage: true });
    throw error;
  } finally {
    await browser.close();
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

  await page.route(/.*\/api\/story-lab\/stories\/[^/]+\/continue$/, async route => {
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
    telemetry: {
      engine: liveMode ? 'grok' : 'custom',
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
