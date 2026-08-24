#!/usr/bin/env tsx
// Created: 2026-08-24 23:58 UTC

import handler from '../api/story-lab/evaluate';
import { stripMarkdownJsonFence } from '../api/_lib/utils/modelJsonPayload';

interface FakeRequest {
  method: string;
  body?: unknown;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  ended = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
    this.ended = true;
  }

  end(): void {
    this.ended = true;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function withEnv(updates: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(updates)) {
    previous.set(key, process.env[key]);
    const value = updates[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createRequest(body: unknown): FakeRequest {
  return { method: 'POST', body, headers: {} };
}

async function post(body: unknown): Promise<FakeResponse> {
  const response = new FakeResponse();
  await withEnv({ XAI_API_KEY: undefined }, async () => {
    await handler(createRequest(body), response);
  });
  return response;
}

function errorCodeOf(response: FakeResponse): string | undefined {
  return (response.body as { error?: { code?: string } })?.error?.code;
}

async function main(): Promise<void> {
  // ==================== FENCE RECOVERY ====================
  // Both callers told the model to return bare JSON and both stripped a fence
  // anyway, with two hand-rolled readings that each dropped the whole response
  // on a form the other handled. A fence that fails to strip makes `JSON.parse`
  // throw on markup rather than on anything wrong with the model's answer, and
  // a usable evaluation or continuity extraction is discarded for it.
  const fencedSamples: Array<{ label: string; text: string }> = [
    { label: 'bare JSON', text: '{"score":80}' },
    { label: 'plain fence', text: '```\n{"score":80}\n```' },
    { label: 'json fence', text: '```json\n{"score":80}\n```' },
    { label: 'uppercase info string', text: '```JSON\n{"score":80}\n```' },
    // The evaluation route anchored `^` against untrimmed text, so one leading
    // newline left the backticks in the payload.
    { label: 'leading blank line', text: '\n```json\n{"score":80}\n```\n' },
    // The continuity extractor sliced three characters off a response with no
    // line break, leaving `json {"score":80}``` ` behind.
    { label: 'one-line fence', text: '```json {"score":80}```' },
    { label: 'one-line fence without info string', text: '```{"score":80}```' },
    // Neither reading survived a model that added a sentence after the block.
    { label: 'trailing prose', text: '```json\n{"score":80}\n```\nHope that helps!' },
    { label: 'carriage returns', text: '```json\r\n{"score":80}\r\n```' },
    { label: 'four-backtick fence', text: '````json\n{"score":80}\n````' },
    // A model that opened a fence and never closed it still meant the body.
    { label: 'unterminated fence', text: '```json\n{"score":80}' }
  ];

  for (const sample of fencedSamples) {
    const stripped = stripMarkdownJsonFence(sample.text);
    let parsed: { score?: number };
    try {
      parsed = JSON.parse(stripped) as { score?: number };
    } catch (error) {
      throw new Error(
        `${sample.label} should survive fence stripping, got ${JSON.stringify(stripped)} (${(error as Error).message})`
      );
    }

    assert(parsed.score === 80, `${sample.label} should parse to the model's payload`);
  }

  // A fence is only stripped when the response opens with one. Guessing where
  // JSON starts inside prose would be wrong for any answer that merely mentions
  // a fence, so text that does not begin with one comes back trimmed and whole.
  assert(
    stripMarkdownJsonFence('  {"score": 80}  ') === '{"score": 80}',
    'bare JSON should come back trimmed and otherwise untouched'
  );
  assert(
    stripMarkdownJsonFence('{"note":"use ``` to fence"}') === '{"note":"use ``` to fence"}',
    'a backtick run inside unfenced JSON is payload, not a fence'
  );

  // ==================== REQUEST VALIDATION ====================
  // Every field used to be taken on trust: `storyContent` was read as
  // `input.storyContent?.trim()`, `themes` went straight into a `for...of`, and
  // `creature` reached `.toLowerCase()`. None of those throws is inside the
  // route's try block, so a malformed request surfaced as 500 — the service
  // reporting its own failure for a mistake only the caller can fix.
  const malformedBodies: Array<{ label: string; body: unknown }> = [
    { label: 'no body', body: undefined },
    { label: 'array body', body: [{ storyContent: 'A vampire waited at the door.' }] },
    { label: 'string body', body: '{"storyContent":"A vampire waited."}' },
    { label: 'missing storyContent', body: {} },
    { label: 'blank storyContent', body: { storyContent: '   ' } },
    { label: 'numeric storyContent', body: { storyContent: 42 } },
    { label: 'array storyContent', body: { storyContent: ['A vampire waited.'] } },
    { label: 'array configuration', body: { storyContent: 'A vampire waited.', configuration: [] } },
    { label: 'numeric creature', body: { storyContent: 'A vampire waited.', configuration: { creature: 7 } } },
    { label: 'numeric themes', body: { storyContent: 'A vampire waited.', configuration: { themes: 7 } } },
    { label: 'string themes', body: { storyContent: 'A vampire waited.', configuration: { themes: 'romance' } } },
    { label: 'non-string theme entry', body: { storyContent: 'A vampire waited.', configuration: { themes: ['romance', 3] } } },
    { label: 'string spicyLevel', body: { storyContent: 'A vampire waited.', configuration: { spicyLevel: 'very' } } },
    { label: 'string wordCount', body: { storyContent: 'A vampire waited.', configuration: { wordCount: 'lots' } } }
  ];

  for (const sample of malformedBodies) {
    const response = await post(sample.body);

    assert(
      response.statusCode === 400,
      `${sample.label} is a caller error and should be answered with 400, got ${response.statusCode}`
    );
    assert(
      errorCodeOf(response) === 'INVALID_EVALUATION_REQUEST',
      `${sample.label} should report INVALID_EVALUATION_REQUEST, got ${errorCodeOf(response)}`
    );
  }

  // A well-formed request still evaluates, and an omitted configuration still
  // falls back to the defaults the route has always applied.
  for (const body of [
    { storyContent: '<p>A vampire waited at the door, and her blood froze.</p>' },
    // `?.` read a null configuration as an absent one, and a serializer that
    // writes absent optionals as `null` means exactly that by it.
    { storyContent: '<p>A vampire waited at the door, and her blood froze.</p>', configuration: null },
    {
      storyContent: '<p>A vampire waited at the door, and her blood froze.</p>',
      configuration: { creature: 'vampire', themes: ['forbidden_love'], spicyLevel: 4, wordCount: 900 }
    }
  ]) {
    const response = await post(body);

    assert(response.statusCode === 200, `a well-formed request should be evaluated, got ${response.statusCode}`);
    assert(
      (response.body as { data?: { heuristicReport?: unknown } })?.data?.heuristicReport,
      'a well-formed request should carry the deterministic heuristic report'
    );
  }

  console.log('Story Lab evaluate route tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
