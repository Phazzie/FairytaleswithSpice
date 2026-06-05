// Created: 2026-06-03 04:46 EDT

const shouldRun = process.env.RUN_REAL_GROK_SMOKE === '1';
const providedUrl = process.env.STORY_LAB_SMOKE_URL;
const hasLocalProviderKey = Boolean(process.env.XAI_API_KEY);

if (!shouldRun) {
  console.log('Skipping live Story Lab provider smoke. Set RUN_REAL_GROK_SMOKE=1 to enable.');
  process.exit(0);
}

if (!providedUrl && !hasLocalProviderKey) {
  console.log('Skipping live Story Lab provider smoke. Provide STORY_LAB_SMOKE_URL or XAI_API_KEY.');
  process.exit(0);
}

const blueprint = {
  creature: 'witch',
  themes: [
    {
      id: 'magical_bargain',
      label: 'Magical Bargain',
      description: 'Every wish has a price.'
    },
    {
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'Desire has consequences.'
    }
  ],
  logline: 'A witch bargains with a fallen angel to save her bookshop before dawn.',
  spicyLevel: 2,
  tone: 'dark_romance',
  desiredWordBudget: 600,
  chapterBatchSize: 1,
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'slow_burn',
    intimacyBoundary: 'fade_to_black',
    noGoContent: 'No coercion and no humiliation.'
  },
  protagonistName: 'Rowan',
  antagonistName: 'Seraph',
  worldDetails: 'A rain-bright bookshop where every locked shelf keeps a living secret.',
  narrativeDirectives: 'Keep the prose romantic, specific, and under the requested spice ceiling.'
};

try {
  const response = providedUrl
    ? await callDeployment(providedUrl)
    : await callLocalEngine();

  assertLiveStoryPayload(response);
  console.log('Live Story Lab provider smoke passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function callDeployment(url) {
  const endpoint = new URL('/api/story-lab/stories', normalizeBaseUrl(url));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(blueprint)
  });

  if (!response.ok) {
    throw new Error(`Deployment smoke failed with HTTP ${response.status}`);
  }

  return await response.json();
}

async function callLocalEngine() {
  const { generateStoryLabGenesis } = await import('../../api/_lib/story-lab/storyLabEngine.ts');
  return await generateStoryLabGenesis(blueprint);
}

function normalizeBaseUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = '/';
  parsed.search = '';
  parsed.hash = '';
  return parsed;
}

function assertLiveStoryPayload(response) {
  if (!response?.success) {
    throw new Error(`Live provider smoke returned error: ${JSON.stringify(response?.error ?? response)}`);
  }

  const data = response.data;
  if (!data?.summary?.title) {
    throw new Error('Live provider smoke response is missing a story title.');
  }

  if (!Array.isArray(data.batch?.chapters) || data.batch.chapters.length < 1) {
    throw new Error('Live provider smoke response is missing generated chapters.');
  }

  if (!data.batch.chapters[0]?.htmlContent) {
    throw new Error('Live provider smoke first chapter is missing htmlContent.');
  }

  const telemetry = data.telemetry;
  if (!telemetry?.model) {
    throw new Error('Live provider smoke response is missing telemetry.model.');
  }

  if (telemetry.engine !== 'grok') {
    throw new Error(`Live provider smoke expected Grok telemetry, got: ${JSON.stringify(telemetry)}`);
  }

  if (!telemetry.model.toLowerCase().includes('grok')) {
    throw new Error(`Live provider smoke expected a Grok model, got: ${JSON.stringify(telemetry)}`);
  }

  if (telemetry.model.toLowerCase().includes('mock')) {
    throw new Error(`Live provider smoke used mock telemetry: ${JSON.stringify(telemetry)}`);
  }
}
