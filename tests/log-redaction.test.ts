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

console.log('Log redaction tests passed');
