import assert from 'node:assert/strict';
import { XaiTextClient } from '../api/_lib/services/xaiTextClient';
import { getXaiReasoningEffort, getXaiStoryModel } from '../api/_lib/config/xaiConfig';

async function main(): Promise<void> {
  const shouldRun = (
    process.env['RUN_REAL_GROK_SMOKE'] === '1'
    || process.env['RUN_REAL_GROK_MULTI_AGENT_SMOKE'] === '1'
  ) && Boolean(process.env['XAI_API_KEY']);

  if (!shouldRun) {
    console.log('SKIP: Set RUN_REAL_GROK_SMOKE=1 and XAI_API_KEY to run the real Grok smoke test.');
    return;
  }

  const client = new XaiTextClient();
  const startedAt = Date.now();

  const response = await client.generateText({
    operation: 'smoke',
    system: 'You write concise supernatural romance test prose. Return two vivid sentences only.',
    user: 'Write two sentences about a moonlit siren court preparing a forbidden vow.',
    maxOutputTokens: 220,
    temperature: 0.6,
    topP: 0.9,
    timeoutMs: 90000
  });

  assert(response.text.trim().length > 20, 'Expected non-empty Grok text.');
  assert(response.model.includes('grok'), 'Expected a Grok model response.');

  console.log('Grok smoke passed.');
  console.log(`Configured model: ${getXaiStoryModel()}`);
  console.log(`Reasoning effort: ${getXaiReasoningEffort()}`);
  console.log(`Latency: ${Date.now() - startedAt} ms`);
  console.log(`Output characters: ${response.text.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
