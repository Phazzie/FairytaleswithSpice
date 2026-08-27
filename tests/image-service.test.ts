#!/usr/bin/env tsx
// Created: 2026-08-24 23:40 UTC

import { inspect } from 'node:util';
import axios, { AxiosError } from 'axios';
import {
  IMAGE_SCENE_DESCRIPTION_MAX_LENGTH,
  ImageService,
  buildSceneDescriptionFromStory,
  readGeneratedImageUrl
} from '../api/_lib/services/imageService';
import { CreatureType, ImageGenerationSeam } from '../api/_lib/types/contracts';
import { STORY_LAB_THEME_SEED_IDS } from '../shared/storyLabThemeSeeds';
import { IMAGE_GENERATION_LIMITS } from '../shared/storyBlueprintLimits';

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

// `split('.')` is not a sentence split: `?` and `!` end a sentence too, and
// this app writes dialogue-heavy openings. A chapter that opens on questions had
// no period anywhere near its start, so "the first three sentences" was the
// whole chapter — and rejoining the pieces with `'.'` replaced whatever
// terminator each one actually ended on, so a question reached the image model
// as a statement.
function testTheOpeningSentencesAreReadAsSentences(): void {
  const questions = '<p>Where is she? Who took her? Why now? '
    + 'The hunter counted his knives and did not answer any of it.</p>';
  const description = buildSceneDescriptionFromStory(questions);

  assert(
    description === 'Where is she? Who took her? Why now?',
    `three questions are three sentences, terminators and all (got: ${JSON.stringify(description)})`
  );
  assert(
    !description.includes('counted his knives'),
    `the fourth sentence should not be in the scene (got: ${JSON.stringify(description)})`
  );
}

// A story that stops mid-sentence still has a scene in it, and a story shorter
// than three sentences is not padded or truncated.
function testShortAndUnterminatedStoriesSurviveWhole(): void {
  const unterminated = '<p>She opened the door and the cold came in</p>';
  assert(
    buildSceneDescriptionFromStory(unterminated) === 'She opened the door and the cold came in',
    `a trailing unterminated sentence should still be read (got: ${JSON.stringify(buildSceneDescriptionFromStory(unterminated))})`
  );

  // The paragraph break between them is the one `stripStoryHtmlToText` put
  // where the markup had a `</p><p>`, and it stays: welding those two words
  // together is what that helper exists to prevent.
  const twoSentences = '<p>He shut the door.</p><p>Blood pooled at her feet.</p>';
  assert(
    buildSceneDescriptionFromStory(twoSentences) === 'He shut the door.\n\nBlood pooled at her feet.',
    `two sentences should come back as two (got: ${JSON.stringify(buildSceneDescriptionFromStory(twoSentences))})`
  );
}

// `substring(0, 200)` counts UTF-16 code units, so a cut between the halves of a
// surrogate pair left a lone surrogate in the text sent to the provider, and a
// cut anywhere else landed mid-word.
function testTheCapKeepsWholeCharactersAndWholeWords(): void {
  const longSentence = `<p>${'astral '.repeat(40)}end.</p>`;
  const description = buildSceneDescriptionFromStory(longSentence);

  assert(
    Array.from(description).length <= IMAGE_SCENE_DESCRIPTION_MAX_LENGTH,
    `the description should respect the cap (got ${Array.from(description).length} code points)`
  );
  assert(
    description.endsWith('astral'),
    `the cap should land on a word boundary (got: ${JSON.stringify(description.slice(-20))})`
  );

  // One astral character per code point, so a UTF-16 cut at the cap falls
  // between the halves of a surrogate pair.
  const astral = `<p>${'𝔞'.repeat(300)}</p>`;
  const astralDescription = buildSceneDescriptionFromStory(astral);

  assert(
    !/[\uD800-\uDFFF]/.test(astralDescription.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')),
    'the cap should never strand half of a surrogate pair'
  );
  assert(
    Array.from(astralDescription).length === IMAGE_SCENE_DESCRIPTION_MAX_LENGTH,
    `an unbroken astral run should be cut at the cap in whole characters (got ${Array.from(astralDescription).length})`
  );
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
 * Nothing this service writes about a provider failure may carry the key it
 * authenticated with.
 *
 * Both of its failure paths used to write to the console with the error object
 * or the provider's response body beside them. `console.error` formats an
 * object with `util.inspect`, and an HTTP client's error carries the request
 * config it failed on — `config.headers.Authorization`, which on this path is
 * `Bearer ${XAI_API_KEY}`. The redacting logger every other paid service on
 * this surface uses names the fields it keeps (`name`, `message`, `stack`,
 * `code`, `response.status`, `response.data`) and never reaches `config` at
 * all, so the guarantee belongs to the log call rather than to whichever error
 * happens to be thrown at it.
 *
 * The response body is the second half. It is the provider's text, logged
 * verbatim before, and it goes through `redactSensitiveLogData` now — which is
 * what reduces an echoed `api_key` in it rather than printing it.
 *
 * Driven with a real `AxiosError` rather than a hand-built object, because the
 * shape that carries the credential is the client's, not this repository's.
 */
async function testProviderFailuresNeverPrintTheApiKey(): Promise<void> {
  const originalPost = axios.post;
  const originalKey = process.env['XAI_API_KEY'];
  const secretKey = 'xai-test-key-must-never-be-logged';
  process.env['XAI_API_KEY'] = secretKey;

  const written: string[] = [];
  const captured = { log: console.log, warn: console.warn, error: console.error };
  const record = (...args: unknown[]) => {
    written.push(args.map(argument => inspect(argument, { depth: 8 })).join(' '));
  };

  try {
    (axios as { post: unknown }).post = async (url: string, body: unknown, config: any) => {
      // The error an HTTP client raises for a refused request, carrying the
      // config it sent — which is where the credential lives.
      throw new AxiosError(
        'Request failed with status code 401',
        'ERR_BAD_REQUEST',
        { url, data: body, headers: config?.headers } as any,
        {},
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: { url, headers: config?.headers } as any,
          data: { error: { message: 'invalid api key', api_key: secretKey } }
        } as any
      );
    };

    console.log = record;
    console.warn = record;
    console.error = record;

    const result = await new ImageService().generateImage(createInput());

    console.log = captured.log;
    console.warn = captured.warn;
    console.error = captured.error;

    assert(!result.success, 'a refused provider request should not be reported as a success');

    const output = written.join('\n');
    assert(written.length > 0, 'a provider failure should still be logged');
    assert(
      !output.includes(secretKey),
      'no log line may carry the provider API key'
    );
    assert(
      output.includes('Grok Image API') && output.includes('Image generation failed'),
      `both failure lines should still be written (got: ${output.slice(0, 400)})`
    );
  } finally {
    console.log = captured.log;
    console.warn = captured.warn;
    console.error = captured.error;
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

/*
 * The theme ids `app.ts` actually sends are read from `shared/`, not restated
 * here.
 *
 * They are not `ThemeType`. The image seam types `themes` as `string[]`, and
 * the only client this route has builds its picker from `availableThemes` —
 * twelve Story Lab `ThemeSeed`s — and passes `theme.id` straight through. This
 * file used to hold its own transcription of that list, which made the check
 * below assert against a copy rather than against the picker: a seed added to
 * the picker and not to this file would have passed. Importing the list the
 * picker itself is built from is what makes a new seed with no visual element a
 * failing case.
 */

/**
 * Seven of those twelve — `court_intrigue`, `blood_oaths`, `slow_burn`,
 * `enemies_to_lovers`, `magical_bargain`, `secret_identity`, and
 * `forced_proximity` — matched nothing in a table keyed on the eighteen classic
 * `ThemeType` values, so they reached the image model as the shared
 * `mysterious elements` fallback. A reader who picked two of the seven had both
 * of their choices described to the model with the same three words.
 */
async function testEveryThemeTheAppOffersReachesThePrompt(): Promise<void> {
  const visualElements = new Set<string>();

  for (const theme of STORY_LAB_THEME_SEED_IDS) {
    const result = await new ImageService().generateImage(createInput({ themes: [theme] }));
    assert(result.success, `mock image generation should succeed for ${theme}`);

    const prompt = (result.data as ImageGenerationSeam['output']).prompt;
    const visualElement = /Visual elements: (.*?)\. /.exec(prompt)?.[1];

    assert(visualElement, `the prompt should name a visual element for ${theme} (got: ${prompt})`);
    assert(
      visualElement !== 'mysterious elements',
      `${theme} is on the picker, so it should not fall back to the generic visual element (got: ${prompt})`
    );
    // The fallback is one shared string, so distinctness is what proves each
    // theme is described as itself rather than that the fallback was renamed.
    assert(!visualElements.has(visualElement), `${theme} should have its own visual element (got: ${visualElement})`);
    visualElements.add(visualElement);
  }
}

// `imagePrompt` replaces the scene description when it is present, so it is the
// text that reaches `grok-2-image` verbatim — and it was the one field on this
// route that nothing measured, on a request billed by the token. The other
// branch of the same method has been capped at 200 characters all along.
async function testCustomImagePromptsAreBounded(): Promise<void> {
  const withinCap = 'a'.repeat(IMAGE_GENERATION_LIMITS.maxImagePromptLength);
  const accepted = await new ImageService().generateImage(createInput({ imagePrompt: withinCap }));
  assert(accepted.success, 'a prompt at the cap should still be served');
  assert(
    (accepted.data as ImageGenerationSeam['output']).prompt.includes(withinCap),
    'a prompt within the cap should reach the provider whole'
  );

  const overCap = 'a'.repeat(IMAGE_GENERATION_LIMITS.maxImagePromptLength + 1);
  const refused = await new ImageService().generateImage(createInput({ imagePrompt: overCap }));
  assert(!refused.success, 'a prompt past the cap should be refused');
  assert(
    refused.error?.code === 'INVALID_INPUT',
    `an oversized imagePrompt is a caller error, not a service failure (got ${refused.error?.code})`
  );
  assert(
    (refused.error?.message ?? '').includes('imagePrompt'),
    `the refusal should name the field that overran (got ${refused.error?.message})`
  );

  // The contract types the field as a string and the wire does not.
  // `buildImagePrompt` treats any truthy value as a prompt, so a number or an
  // object reached the provider request as its `String()` form.
  for (const imagePrompt of [42, { text: 'a vampire' }, ['a vampire']]) {
    const result = await new ImageService().generateImage(
      createInput({ imagePrompt: imagePrompt as unknown as string })
    );

    assert(!result.success, `imagePrompt=${JSON.stringify(imagePrompt)} should be rejected`);
    assert(
      result.error?.code === 'INVALID_INPUT',
      `imagePrompt=${JSON.stringify(imagePrompt)} is a caller error (got ${result.error?.code})`
    );
  }

  // Absent is not the same as invalid: the field is optional, and omitting it is
  // how every request the app itself makes reaches the scene-description path.
  const omitted = await new ImageService().generateImage(createInput());
  assert(omitted.success, 'an omitted imagePrompt should still be served from the story');
}

async function main(): Promise<void> {
  await testEveryCreatureArchetypeReachesThePrompt();
  await testEveryThemeTheAppOffersReachesThePrompt();
  await testSceneDescriptionReadsAsProse();
  testTheOpeningSentencesAreReadAsSentences();
  testShortAndUnterminatedStoriesSurviveWhole();
  testTheCapKeepsWholeCharactersAndWholeWords();
  await testMalformedThemesAreRejectedAsCallerError();
  await testAspectRatioNeverContradictsTheDimensions();
  await testCustomImagePromptsAreBounded();
  testProviderResponsesWithoutAUrlAreRefused();
  await testTheServiceRefusesAProviderResponseWithoutAUrl();
  await testProviderFailuresNeverPrintTheApiKey();

  console.log('Image service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
