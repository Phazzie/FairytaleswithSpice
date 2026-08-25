#!/usr/bin/env tsx
// Created: 2026-08-24 23:40 UTC

import axios from 'axios';
import { ImageService, readGeneratedImageUrl } from '../api/_lib/services/imageService';
import { CreatureType, ImageGenerationSeam } from '../api/_lib/types/contracts';

// The service reads `XAI_API_KEY` in its constructor and falls back to a mock
// image URL when it is absent, so clearing it before the first `new
// ImageService()` is what keeps these tests off the network.
delete process.env['XAI_API_KEY'];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const paragraphStory = '<p>He shut the door.</p><p>Blood pooled at her feet &amp; the &quot;hunter&quot; smiled.</p>';

function createInput(overrides: Partial<ImageGenerationSeam['input']> = {}): ImageGenerationSeam['input'] {
  return {
    storyId: 'story_image_regression',
    content: paragraphStory,
    creature: 'vampire',
    themes: ['betrayal'],
    style: 'dark',
    ...overrides
  };
}

// The story arrives as the generator's HTML. Deleting the tags without putting
// a boundary in their place welded the words on either side of a paragraph
// break — `door.</p><p>Blood` was described to the image model as
// `door.Blood` — and left the generator's entities in the prose as literal
// `&amp;` and `&quot;` text.
async function testSceneDescriptionReadsAsProse(): Promise<void> {
  const result = await new ImageService().generateImage(createInput());

  assert(result.success, 'mock image generation should succeed');
  const prompt = (result.data as ImageGenerationSeam['output']).prompt;

  assert(!prompt.includes('door.Blood'), `paragraph break should not weld two words together (got: ${prompt})`);
  assert(prompt.includes('door.'), `the first paragraph should survive into the prompt (got: ${prompt})`);
  assert(!/&(amp|quot|lt|gt|#39|nbsp);/i.test(prompt), `entities should be decoded, not sent literally (got: ${prompt})`);
  assert(prompt.includes('"hunter"'), `&quot; should read as a quotation mark (got: ${prompt})`);
  // `[^<>]` rather than `[^>]` for the reason `storyTextBlocks` records: with
  // `[^>]*`, every `<` in a run of them starts a scan to the end of the string
  // before failing for want of a `>`, which is quadratic in the run's length.
  // Excluding `<` decides each position once, and `<p>` still matches.
  assert(!/<[^<>]*>/.test(prompt), `no markup should reach the image model (got: ${prompt})`);
}

// A malformed `themes` reached `input.themes.map(...)` and threw, and the
// `generateImage` catch block reports every throw as `IMAGE_GENERATION_FAILED`
// — so a caller who sent the wrong shape was told the image service had
// failed, with the raw `input.themes.map is not a function` as the message.
async function testMalformedThemesAreRejectedAsCallerError(): Promise<void> {
  const malformedThemes: unknown[] = ['betrayal', [], [''], [42], 'betrayal, revenge', undefined, null];

  for (const themes of malformedThemes) {
    const input = createInput({ themes: themes as ImageGenerationSeam['input']['themes'] });
    const result = await new ImageService().generateImage(input);

    assert(!result.success, `themes=${JSON.stringify(themes)} should be rejected`);
    assert(
      result.error?.code === 'INVALID_INPUT',
      `themes=${JSON.stringify(themes)} is a caller error, not a service failure (got ${result.error?.code})`
    );
    assert(
      !(result.error?.message ?? '').includes('is not a function'),
      `themes=${JSON.stringify(themes)} should not leak an internal TypeError (got ${result.error?.message})`
    );
  }

  const missingCreature = await new ImageService().generateImage(
    createInput({ creature: '' as ImageGenerationSeam['input']['creature'] })
  );
  assert(missingCreature.error?.code === 'INVALID_INPUT', 'an empty creature is a caller error');
}

// An unsupported ratio fell back to 16:9 for the provider request and for the
// reported dimensions, while the response echoed the ratio that was asked for.
// The caller was handed a payload whose `aspectRatio` contradicted its own
// `width` and `height`.
async function testAspectRatioNeverContradictsTheDimensions(): Promise<void> {
  const unsupported = await new ImageService().generateImage(
    createInput({ aspectRatio: '21:9' as ImageGenerationSeam['input']['aspectRatio'] })
  );

  assert(!unsupported.success, 'an unsupported aspect ratio should be rejected');
  assert(
    unsupported.error?.code === 'INVALID_INPUT',
    `an unsupported aspect ratio is a caller error (got ${unsupported.error?.code})`
  );

  const expectedDimensions: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1792, height: 1024 },
    '9:16': { width: 1024, height: 1792 },
    '4:3': { width: 1536, height: 1152 }
  };

  for (const [aspectRatio, dimensions] of Object.entries(expectedDimensions)) {
    const result = await new ImageService().generateImage(
      createInput({ aspectRatio: aspectRatio as ImageGenerationSeam['input']['aspectRatio'] })
    );

    assert(result.success, `${aspectRatio} should be supported`);
    const output = result.data as ImageGenerationSeam['output'];
    assert(output.aspectRatio === aspectRatio, `${aspectRatio} should be echoed back (got ${output.aspectRatio})`);
    assert(
      output.width === dimensions.width && output.height === dimensions.height,
      `${aspectRatio} should report ${dimensions.width}x${dimensions.height} (got ${output.width}x${output.height})`
    );
    assert(
      output.imageUrl.includes(`${dimensions.width}/${dimensions.height}`),
      `the mock image should be built at the reported size (got ${output.imageUrl})`
    );
  }

  const defaulted = await new ImageService().generateImage(createInput());
  const defaultedOutput = defaulted.data as ImageGenerationSeam['output'];
  assert(defaultedOutput.aspectRatio === '16:9', 'an omitted ratio should default to 16:9');
  assert(defaultedOutput.width === 1792 && defaultedOutput.height === 1024, 'the default ratio should report 1792x1024');
}

// `response.data.data[0].url` was read straight through, and reading a missing
// property yields `undefined` rather than throwing — so a provider entry that
// carried no URL was reported as `success: true` with `imageUrl: undefined`
// beside a real `imageId` and dimensions, and callers rendered a broken image
// instead of seeing the failure.
function testProviderResponsesWithoutAUrlAreRefused(): void {
  const responsesWithoutAUrl: unknown[] = [
    undefined,
    null,
    {},
    { data: null },
    { data: [] },
    { data: {} },
    { data: [{}] },
    { data: [{ b64_json: 'aGVsbG8=' }] },
    { data: [{ url: '' }] },
    { data: [{ url: '   ' }] },
    { data: [{ url: 42 }] }
  ];

  for (const responseData of responsesWithoutAUrl) {
    let threw = false;
    try {
      readGeneratedImageUrl(responseData);
    } catch {
      threw = true;
    }

    assert(threw, `a response of ${JSON.stringify(responseData)} should be refused, not returned as a URL`);
  }

  assert(
    readGeneratedImageUrl({ data: [{ url: ' https://images.example/story.png ' }] })
      === 'https://images.example/story.png',
    'a well-formed response should yield its URL'
  );
}

/**
 * Prove the same thing through the service, not just through the helper.
 *
 * A test that only calls `readGeneratedImageUrl` still passes if
 * `callGrokImageAI` goes back to reading `response.data.data[0].url`, which is
 * the wiring the fix is actually about. Driving `generateImage` with a stubbed
 * provider fails in that case, because the service would again answer
 * `success: true` with an undefined `imageUrl`.
 *
 * The service reads `XAI_API_KEY` in its constructor and takes the mock path
 * without one, so the key is set for the duration and `axios.post` is replaced
 * to keep the call off the network.
 */
async function testTheServiceRefusesAProviderResponseWithoutAUrl(): Promise<void> {
  const originalPost = axios.post;
  const originalKey = process.env['XAI_API_KEY'];
  process.env['XAI_API_KEY'] = 'test-key';

  try {
    (axios as { post: unknown }).post = async () => ({ data: { data: [{ b64_json: 'aGVsbG8=' }] } });
    const missingUrl = await new ImageService().generateImage(createInput());

    assert(!missingUrl.success, 'a provider response with no URL should not be reported as a success');
    assert(
      missingUrl.error?.code === 'IMAGE_GENERATION_FAILED',
      `a provider response with no URL should fail the request (got ${missingUrl.error?.code})`
    );

    (axios as { post: unknown }).post = async () => ({
      data: { data: [{ url: 'https://images.example/story.png' }] }
    });
    const withUrl = await new ImageService().generateImage(createInput());

    assert(withUrl.success, 'a provider response carrying a URL should still succeed');
    assert(
      (withUrl.data as ImageGenerationSeam['output']).imageUrl === 'https://images.example/story.png',
      'the provider URL should reach the caller unchanged'
    );
  } finally {
    (axios as { post: unknown }).post = originalPost;
    if (originalKey === undefined) {
      delete process.env['XAI_API_KEY'];
    } else {
      process.env['XAI_API_KEY'] = originalKey;
    }
  }
}

/**
 * The creature is the one blueprint setting that most decides what an image
 * looks like. The context map covered three of the ten archetypes `CreatureType`
 * names, so the other seven were illustrated as an unspecified `supernatural
 * being` — the reader's choice dropped from the prompt for seven of the ten
 * options the form offers.
 */
async function testEveryCreatureArchetypeReachesThePrompt(): Promise<void> {
  const creatures: CreatureType[] = [
    'vampire',
    'werewolf',
    'fairy',
    'siren',
    'djinn',
    'witch',
    'dragon',
    'demon',
    'angel',
    'mermaid'
  ];
  const descriptions = new Set<string>();

  for (const creature of creatures) {
    const result = await new ImageService().generateImage(createInput({ creature }));
    assert(result.success, `mock image generation should succeed for ${creature}`);

    const prompt = (result.data as ImageGenerationSeam['output']).prompt;
    assert(
      !prompt.includes('supernatural being'),
      `${creature} is a named archetype, so it should not fall back to the generic description (got: ${prompt})`
    );

    // The generic fallback is one shared string, so the descriptions being
    // distinct is what proves each archetype is described as itself rather than
    // that the fallback was merely renamed.
    const description = prompt.split('. ')[1] ?? prompt;
    assert(!descriptions.has(description), `${creature} should have its own description (got: ${description})`);
    descriptions.add(description);
  }
}

async function main(): Promise<void> {
  await testEveryCreatureArchetypeReachesThePrompt();
  await testSceneDescriptionReadsAsProse();
  await testMalformedThemesAreRejectedAsCallerError();
  await testAspectRatioNeverContradictsTheDimensions();
  testProviderResponsesWithoutAUrlAreRefused();
  await testTheServiceRefusesAProviderResponseWithoutAUrl();

  console.log('Image service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
