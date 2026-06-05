#!/usr/bin/env tsx
// Created: 2026-06-05 00:56 EDT

import { redactSensitiveLogData } from '../api/_lib/utils/logger';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const storyText = 'Elena opened the forbidden grimoire and confessed the secret ending.';
const prompt = 'Write a spicy supernatural chapter using the entire private blueprint.';
const email = 'reader@example.com';
const apiKey = 'xai-secret-key-123';
const artifactUrl = 'https://blob.vercel-storage.com/story/export.html?token=private-token';

const redacted = redactSensitiveLogData({
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey
  },
  email,
  prompt,
  storyText,
  rawContent: storyText,
  htmlContent: `<p>${storyText}</p>`,
  exportArtifactUrl: artifactUrl,
  nested: {
    callbackUrl: artifactUrl,
    model: 'grok-4'
  }
});

const serialized = JSON.stringify(redacted);

assert(!serialized.includes(storyText), 'story text should be redacted');
assert(!serialized.includes(prompt), 'prompts should be redacted');
assert(!serialized.includes(email), 'emails should be redacted');
assert(!serialized.includes(apiKey), 'API keys and auth headers should be redacted');
assert(!serialized.includes(artifactUrl), 'artifact URLs should be redacted');
assert(serialized.includes('grok-4'), 'safe operational metadata should be preserved');
assert(serialized.includes('[REDACTED]'), 'redacted logs should use a clear placeholder');

const telemetry = redactSensitiveLogData({
  promptTokens: 123,
  completionTokens: 456,
  tokensConsumed: 579,
  hobby: 'skateboarding near skyscrapers',
  apiKey: 'xai-secret-key-123'
});
const telemetrySerialized = JSON.stringify(telemetry);

assert(telemetrySerialized.includes('promptTokens'), 'token-count telemetry keys should be preserved');
assert(telemetrySerialized.includes('579'), 'token-count telemetry values should be preserved');
assert(telemetrySerialized.includes('skateboarding'), 'normal words beginning with sk should not be redacted');
assert(!telemetrySerialized.includes('xai-secret-key-123'), 'actual API key fields should still be redacted');

console.log('Log redaction tests passed');
