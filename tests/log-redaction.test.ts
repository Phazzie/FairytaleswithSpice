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

const sharedContext = { model: 'grok-4', attempt: 2 };
const sharedReferences = redactSensitiveLogData({
  first: sharedContext,
  second: sharedContext,
  batch: [sharedContext, sharedContext]
}) as Record<string, any>;

assert(sharedReferences.second?.model === 'grok-4', 'a repeated object reference should be redacted, not dropped as circular');
assert(sharedReferences.batch?.[1]?.attempt === 2, 'repeated array entries should keep their values');
assert(
  !JSON.stringify(sharedReferences).includes('[Circular]'),
  'non-circular shared references should never be reported as circular'
);

const prose = redactSensitiveLogData({
  note: 'the forbearer and the torchbearer stayed intact'
}) as Record<string, string>;
assert(
  prose.note === 'the forbearer and the torchbearer stayed intact',
  'a word that merely contains "bearer" is not a credential and must survive redaction'
);

const scheme = redactSensitiveLogData({
  note: 'sent Bearer abc123def456 upstream'
}) as Record<string, string>;
assert(
  !scheme.note.includes('abc123def456'),
  'a real Bearer credential should still be redacted'
);

// The word-boundary guard must not treat the delimiters that actually precede
// a credential as word characters. `=`, `/` and `+` are all valid bearer-token
// characters, so keying the guard off the token grammar would leak these.
for (const delimiter of ['=', ':', '/', '+', '"', ',', '(']) {
  const delimited = redactSensitiveLogData({
    note: `Authorization${delimiter}Bearer abc123def456 upstream`
  }) as Record<string, string>;
  assert(
    !delimited.note.includes('abc123def456'),
    `a Bearer credential introduced by "${delimiter}" should be redacted`
  );
}

const cyclic: Record<string, unknown> = { model: 'grok-4' };
cyclic['self'] = cyclic;
const redactedCycle = redactSensitiveLogData(cyclic) as Record<string, any>;
assert(redactedCycle.self === '[Circular]', 'true cycles should still be broken');

console.log('Log redaction tests passed');
