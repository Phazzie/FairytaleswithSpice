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
import { ASPECT_RATIOS, CreatureType, IMAGE_STYLES, ImageGenerationSeam, VALIDATION_RULES } from '../api/_lib/types/contracts';
import { logger } from '../api/_lib/utils/logger';
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

  // Spelled out rather than read off the table, deliberately: a table-driven
  // expectation would pass no matter what pixels the table named. What ties the
  // two together is the assertion below, which turns this from a fifth copy of
  // the ratio list into a checked mirror of it — a ratio added to `ASPECT_RATIOS`
  // and not to this map fails here rather than going unexercised.
  const expectedDimensions: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1792, height: 1024 },
    '9:16': { width: 1024, height: 1792 },
    '4:3': { width: 1536, height: 1152 }
  };

  assert(
    ASPECT_RATIOS.length === Object.keys(expectedDimensions).length
      && ASPECT_RATIOS.every(ratio => ratio in expectedDimensions),
    'every ratio in the contract table should have an expected size here'
  );

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

  await testTheProviderIsAskedForTheSizeTheResponseReports();
}

/**
 * The `size` asked of the provider is the one reader of an absent ratio that
 * never appears in the response — which is exactly why it could drift
 * unnoticed. Everything above this proves what the envelope *says*; the line
 * that decides what is actually drawn was `this.mapAspectRatioToSize(input
 * .aspectRatio || '16:9')`, the last hand-written fallback of the family
 * `ASPECT_RATIO_SPECS` was consolidated to end. Retuning `DEFAULT_ASPECT_RATIO`
 * would have moved the reported `width` and `height`, and the mock URL's
 * dimensions, and left the picture at 16:9.
 *
 * The service takes the mock path without a key, so the key is set for the
 * duration and `axios.post` is replaced — the same arrangement the provider
 * tests below use.
 */
async function testTheProviderIsAskedForTheSizeTheResponseReports(): Promise<void> {
  const originalPost = axios.post;
  process.env['XAI_API_KEY'] = 'xai-test-key-for-aspect-ratio';

  try {
    const service = new ImageService();
    let requestedSize: unknown;

    (axios as { post: unknown }).post = async (_url: string, body: any) => {
      requestedSize = body?.size;
      return { data: { data: [{ url: 'https://images.example/generated.png' }] } };
    };

    // An omitted ratio: the case the restated `'16:9'` decided on its own.
    const defaulted = await service.generateImage(createInput());
    assert(defaulted.success, 'a request naming no ratio should succeed');
    const defaultedOutput = defaulted.data as ImageGenerationSeam['output'];
    assert(
      requestedSize === `${defaultedOutput.width}x${defaultedOutput.height}`,
      `the provider should be asked for the size the response reports `
        + `(asked ${String(requestedSize)}, reported ${defaultedOutput.width}x${defaultedOutput.height})`
    );

    // And a named ratio, which was already right and has to stay right.
    for (const aspectRatio of ASPECT_RATIOS) {
      const result = await service.generateImage(createInput({ aspectRatio }));
      assert(result.success, `a request for ${aspectRatio} should succeed`);
      const output = result.data as ImageGenerationSeam['output'];
      assert(
        requestedSize === `${output.width}x${output.height}`,
        `${aspectRatio} should ask the provider for the size it reports (asked ${String(requestedSize)})`
      );
    }
  } finally {
    (axios as { post: unknown }).post = originalPost;
    delete process.env['XAI_API_KEY'];
  }
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

// Capping `imagePrompt` closed the larger of the two ways a caller decides how
// big this route's provider request is. `themes` is the other one:
// `enhancePromptWithStyle` maps every entry into the same `grok-2-image`
// prompt, and nothing bounded the entry count — so the field that was measured
// was one sentence long while the field beside it took as many sentences as a
// body could carry, on a route billed per call.
async function testThemeCountIsBounded(): Promise<void> {
  type Themes = ImageGenerationSeam['input']['themes'];
  const atCap = Array.from({ length: IMAGE_GENERATION_LIMITS.maxThemes }, () => 'betrayal') as Themes;
  const accepted = await new ImageService().generateImage(createInput({ themes: atCap }));
  assert(accepted.success, 'a request at the theme cap should still be served');

  const overCap = Array.from({ length: IMAGE_GENERATION_LIMITS.maxThemes + 1 }, () => 'betrayal') as Themes;
  const refused = await new ImageService().generateImage(createInput({ themes: overCap }));
  assert(!refused.success, 'a request past the theme cap should be refused');
  assert(
    refused.error?.code === 'INVALID_INPUT',
    `too many themes is a caller error, not a service failure (got ${refused.error?.code})`
  );
  assert(
    (refused.error?.message ?? '').includes('themes'),
    `the refusal should name the field that overran (got ${refused.error?.message})`
  );

  // The bound has to hold before the provider prompt is built, which is the
  // whole point of it: the cost is the prompt, not the array.
  const many = Array.from({ length: 5000 }, () => 'unrecognized_theme_id') as unknown as Themes;
  const refusedLarge = await new ImageService().generateImage(createInput({ themes: many }));
  assert(!refusedLarge.success, 'five thousand themes should be refused rather than rendered into a prompt');
  assert(
    refusedLarge.error?.code === 'INVALID_INPUT',
    `an oversized themes array is a caller error (got ${refusedLarge.error?.code})`
  );

  // The number is the one `/api/story/generate` has always enforced, so the two
  // routes cannot disagree about how many seeds one story carries.
  assert(
    IMAGE_GENERATION_LIMITS.maxThemes === VALIDATION_RULES.themes.maxCount,
    'the image route and the story route should bound themes at the same number'
  );
}

/**
 * The id in the envelope, and the id on the failure lines, have to be the
 * request's.
 *
 * `metadata.requestId` was `img-req-${randomUUID()}`, minted inside this
 * service — once per branch, for a response that carries one — and written into
 * the response body and nowhere else. Both of the service's log calls carried
 * no `requestId` at all, which is precisely what the comment beside the second
 * of them names as the defect it was written to fix: "this route's own handler
 * logs a `requestId` on every other line it writes, and the one line describing
 * why the image failed had none". Moving those calls onto the logger did not
 * give them one, because the route's correlation id stopped at the route.
 *
 * Driven through a refused provider request, because that is the path where all
 * three — the envelope, this service's failure line, and the provider's own
 * error line — exist at once.
 */
async function testTheRequestIdReachesTheEnvelopeAndTheLog(): Promise<void> {
  const succeeded = await new ImageService().generateImage(createInput(), 'trace-image-ok');
  assert(succeeded.success, 'a valid request should succeed against the mock provider');
  assert(
    succeeded.metadata?.requestId === 'trace-image-ok',
    `a successful generation should report the route's id (got ${JSON.stringify(succeeded.metadata?.requestId)})`
  );

  const refused = await new ImageService().generateImage(
    createInput({ style: 'watercolour' as ImageGenerationSeam['input']['style'] }),
    'trace-image-refused'
  );
  assert(!refused.success, 'an unsupported style should still be refused');
  assert(
    refused.metadata?.requestId === 'trace-image-refused',
    `a refused generation should report the route's id (got ${JSON.stringify(refused.metadata?.requestId)})`
  );

  const unattributed = await new ImageService().generateImage(createInput());
  assert(
    /^img-req-[0-9a-f-]{36}$/.test(unattributed.metadata?.requestId ?? ''),
    `a generation with no correlation id should still be given one (got ${JSON.stringify(unattributed.metadata?.requestId)})`
  );

  const originalPost = axios.post;
  const originalKey = process.env['XAI_API_KEY'];
  process.env['XAI_API_KEY'] = 'xai-test-key-for-the-request-id-check';
  const captured = { log: console.log, warn: console.warn, error: console.error };
  const silence = () => {};

  try {
    (axios as { post: unknown }).post = async () => {
      throw new AxiosError('Request failed with status code 503', 'ERR_BAD_RESPONSE');
    };

    logger.clearLogs();
    console.log = silence;
    console.warn = silence;
    console.error = silence;

    const failed = await new ImageService().generateImage(createInput(), 'trace-image-failure');

    console.log = captured.log;
    console.warn = captured.warn;
    console.error = captured.error;

    assert(!failed.success, 'a refused provider request should not be reported as a success');
    assert(
      failed.metadata?.requestId === 'trace-image-failure',
      `a failed generation should report the route's id (got ${JSON.stringify(failed.metadata?.requestId)})`
    );

    // Both lines: the provider's own error and this service's failure. Either
    // one without an id is a line an operator cannot join to the request.
    const errors = logger.getRecentLogs(50, 'error');
    for (const expected of ['Grok Image API', 'Image generation failed']) {
      const entry = errors.find(log => log.message.includes(expected));
      assert(entry, `"${expected}" should still be logged (got ${JSON.stringify(errors.map(e => e.message))})`);
      assert(
        entry.context?.requestId === 'trace-image-failure',
        `"${expected}" should be logged under the request's own id (got ${JSON.stringify(entry.context?.requestId)})`
      );
    }
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
 * The response body may carry only a message written for the caller.
 *
 * `generateImage`'s catch block ended `message: error.message || 'Failed to
 * generate image'`, so anything thrown under it decided what
 * `/api/image/generate` told the reader. `runJobWork` states the rule for the
 * same situation — "The thrown detail goes to the log rather than into the job,
 * which is read by the caller and should not carry whatever a provider error
 * says" — and `ExportService.saveAndExport` follows it; this catch was the
 * exception.
 *
 * Both halves are asserted, because either one alone is satisfiable by the
 * wrong fix: a raw failure must not reach the envelope, and the sentence
 * `callGrokImageAI` deliberately writes for the reader must still reach it.
 * A raw axios rejection is the realistic case — the network error a client
 * raises before any HTTP status exists names the provider's host.
 */
async function testOnlyCallerFacingMessagesReachTheEnvelope(): Promise<void> {
  const originalPost = axios.post;
  const originalKey = process.env['XAI_API_KEY'];
  process.env['XAI_API_KEY'] = 'test-key';

  try {
    (axios as { post: unknown }).post = async () => {
      throw new Error('getaddrinfo ENOTFOUND api.x.ai');
    };
    const providerFailure = await new ImageService().generateImage(createInput());

    assert(!providerFailure.success, 'a provider failure should not be reported as a success');
    assert(
      providerFailure.error?.message === 'AI image service temporarily unavailable',
      `a provider failure should answer the sentence written for the reader (got ${providerFailure.error?.message})`
    );
    assert(
      !providerFailure.error?.message.includes('api.x.ai'),
      'the provider host should not reach the response body'
    );

    // A throw from anywhere else under `generateImage` — the shape of failure
    // `validateImageInput`'s own docblock describes, reaching the reader as
    // `input.themes.map is not a function`. Raised here from the prompt builder
    // by a themes array that passes validation and then breaks on `.map`.
    const brokenThemes = createInput();
    (brokenThemes.themes as unknown as { map: unknown }).map = () => {
      throw new TypeError('internal detail the caller must not be shown');
    };
    (axios as { post: unknown }).post = async () => ({
      data: { data: [{ url: 'https://images.example/story.png' }] }
    });
    const internalFailure = await new ImageService().generateImage(brokenThemes);

    assert(!internalFailure.success, 'an internal failure should not be reported as a success');
    assert(
      internalFailure.error?.message === 'Failed to generate image',
      `an internal failure should answer the fixed sentence (got ${internalFailure.error?.message})`
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

// Every style the contract names is accepted by the route and asks the provider
// for a look of its own.
//
// The five style names used to be written out by hand in six places — this
// union, the Angular contract's copy of it, the picker's `IMAGE_STYLES`,
// `VALIDATION_RULES.imageStyle.allowedValues`, `SUPPORTED_STYLES`, and the two
// lookups that turn a style into prompt text and into the provider's style
// parameter — with nothing tying any of them to any other. Both halves of this
// test are the failures that arrangement allowed and neither of which shows up
// as an error: a style missing from `SUPPORTED_STYLES` is refused with
// `UNSUPPORTED_STYLE` for being exactly what the contract says it is, and a
// style missing from `styleMap` is generated in a look nobody asked for.
async function testEveryImageStyleIsAcceptedAndDescribedAsItself(): Promise<void> {
  const modifiers = new Set<string>();

  for (const style of IMAGE_STYLES) {
    const result = await new ImageService().generateImage(createInput({ style }));
    assert(result.success, `mock image generation should succeed for ${style}`);

    const prompt = (result.data as ImageGenerationSeam['output']).prompt;
    assert(
      !prompt.includes('. artistic style.'),
      `${style} is a named style, so it should not fall back to the generic modifier (got: ${prompt})`
    );
    modifiers.add(prompt);
  }

  assert(
    modifiers.size === IMAGE_STYLES.length,
    `each style should reach the provider as its own look (got ${modifiers.size} distinct prompts for ${IMAGE_STYLES.length} styles)`
  );

  // The run-time allow-list `toLoggableImageStyle` checks a caller's `style`
  // against is the same table, so a style the app itself sends can never be
  // logged as `[UNRECOGNIZED]`.
  assert(
    VALIDATION_RULES.imageStyle.allowedValues === IMAGE_STYLES,
    'the validation allow-list should be the contract table itself, not a copy of it'
  );
}

async function main(): Promise<void> {
  await testEveryCreatureArchetypeReachesThePrompt();
  await testEveryImageStyleIsAcceptedAndDescribedAsItself();
  await testEveryThemeTheAppOffersReachesThePrompt();
  await testSceneDescriptionReadsAsProse();
  testTheOpeningSentencesAreReadAsSentences();
  testShortAndUnterminatedStoriesSurviveWhole();
  testTheCapKeepsWholeCharactersAndWholeWords();
  await testMalformedThemesAreRejectedAsCallerError();
  await testAspectRatioNeverContradictsTheDimensions();
  await testCustomImagePromptsAreBounded();
  await testThemeCountIsBounded();
  testProviderResponsesWithoutAUrlAreRefused();
  await testTheServiceRefusesAProviderResponseWithoutAUrl();
  await testProviderFailuresNeverPrintTheApiKey();
  await testOnlyCallerFacingMessagesReachTheEnvelope();
  await testTheRequestIdReachesTheEnvelopeAndTheLog();

  console.log('Image service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
