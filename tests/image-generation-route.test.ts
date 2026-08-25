#!/usr/bin/env tsx
// Created: 2026-08-25 13:05 UTC
//
// Proves a malformed image request is answered as the caller's mistake rather
// than as a server failure.
//
// `/api/image/generate` was the one route written inline in the Node server, and
// the one route that never got the shared body reading. It did
// `const input = req.body; if (!input.storyId || …)`, and Express 5 leaves
// `req.body` as `undefined` for a request with no body or one sent without
// `Content-Type: application/json` — it no longer initialises it to `{}` the way
// Express 4 did. Reading `input.storyId` off that threw a `TypeError` into the
// route's own catch, which answered `500 INTERNAL_ERROR`: the caller was told
// the image service had failed and that retrying might help.
//
// The service had the same shape of hole one level down. `content` was checked
// with `!input.content || input.content.length < 10`, and `length` is `undefined`
// for a number — not `< 10` — so a JSON body carrying a number under `content`
// passed validation and threw inside the renderer, answering
// `IMAGE_GENERATION_FAILED`.

import assert from 'node:assert/strict';
import { handleImageGenerationRoute } from '../api/_lib/http/imageGenerationRoute';
import { ImageService } from '../api/_lib/services/imageService';

// The service reads `XAI_API_KEY` in its constructor and falls back to a mock
// image URL when it is absent, so clearing it before the first `new
// ImageService()` is what keeps these tests off the network.
delete process.env['XAI_API_KEY'];

interface RecordedResponse {
  statusCode: number | null;
  body: any;
  headers: Record<string, string>;
}

function fakeResponse(): { res: any; recorded: RecordedResponse } {
  const recorded: RecordedResponse = { statusCode: null, body: null, headers: {} };
  const res = {
    setHeader(name: string, value: string) {
      recorded.headers[name] = value;
    },
    status(code: number) {
      recorded.statusCode = code;
      return res;
    },
    json(body: unknown) {
      recorded.body = body;
    }
  };

  return { res, recorded };
}

async function post(body: unknown): Promise<RecordedResponse> {
  const { res, recorded } = fakeResponse();
  await handleImageGenerationRoute({ method: 'POST', headers: {}, body }, res);
  return recorded;
}

const validRequest = {
  storyId: 'story_abc',
  content: 'The vampire lord waited at the top of the stair, and the door below opened.',
  creature: 'vampire',
  themes: ['betrayal'],
  style: 'dark'
};

async function testUnparseableBodiesAreRefusedAsInvalidInput(): Promise<void> {
  const bodies: Array<[string, unknown]> = [
    ['no body at all', undefined],
    ['a null body', null],
    ['a body that parsed as a string', '{"storyId":"story_abc"}'],
    ['a body that parsed as an array', [validRequest]],
    ['a body that parsed as a number', 7]
  ];

  for (const [label, body] of bodies) {
    const response = await post(body);
    assert.equal(response.statusCode, 400, `${label} should be a 400, got ${response.statusCode}`);
    assert.equal(response.body.success, false, `${label} should not report success`);
    assert.equal(response.body.error.code, 'INVALID_INPUT', `${label} should name the caller's mistake`);
  }
}

async function testNonTextFieldsAreRefusedBeforeTheRenderer(): Promise<void> {
  const service = new ImageService();

  const numericContent = await service.generateImage({ ...validRequest, content: 1234567890123 } as any);
  assert.equal(numericContent.success, false);
  assert.equal(
    numericContent.error?.code,
    'INVALID_INPUT',
    'a numeric `content` is a malformed request, not a failed image generation'
  );

  const objectContent = await service.generateImage({ ...validRequest, content: { text: 'x'.repeat(50) } } as any);
  assert.equal(objectContent.success, false);
  assert.equal(objectContent.error?.code, 'INVALID_INPUT');

  const numericStoryId = await service.generateImage({ ...validRequest, storyId: 42 } as any);
  assert.equal(numericStoryId.success, false);
  assert.equal(numericStoryId.error?.code, 'INVALID_INPUT');

  const blankStoryId = await service.generateImage({ ...validRequest, storyId: '   ' } as any);
  assert.equal(blankStoryId.success, false);
  assert.equal(blankStoryId.error?.code, 'INVALID_INPUT');
}

async function testServiceRefusalsReachTheCallerAsClientErrors(): Promise<void> {
  const refused = await post({ ...validRequest, style: 'watercolour' });
  assert.equal(refused.statusCode, 400, "an unsupported style is the caller's to fix");
  assert.equal(refused.body.error.code, 'UNSUPPORTED_STYLE');

  const badRatio = await post({ ...validRequest, aspectRatio: '21:9' });
  assert.equal(badRatio.statusCode, 400);
  assert.equal(badRatio.body.error.code, 'INVALID_INPUT');

  const missingThemes = await post({ ...validRequest, themes: [] });
  assert.equal(missingThemes.statusCode, 400);
  assert.equal(missingThemes.body.error.code, 'INVALID_INPUT');
}

async function testAWellFormedRequestIsStillServed(): Promise<void> {
  const generated = await post(validRequest);

  assert.equal(generated.statusCode, 200, 'a well-formed request should still be served');
  assert.equal(generated.body.success, true);
  assert.equal(typeof generated.body.data.imageUrl, 'string');
  assert.equal(generated.body.data.storyId, 'story_abc');

  // Every route answers with the id its log lines carry.
  assert.ok(
    /^req_[0-9a-f-]{36}$/.test(generated.headers['X-Request-ID'] ?? ''),
    'the route should echo a correlation id'
  );
}

async function main(): Promise<void> {
  await testUnparseableBodiesAreRefusedAsInvalidInput();
  await testNonTextFieldsAreRefusedBeforeTheRenderer();
  await testServiceRefusalsReachTheCallerAsClientErrors();
  await testAWellFormedRequestIsStillServed();

  console.log('Image generation route tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
