#!/usr/bin/env tsx
// Created: 2026-09-02 UTC

import {
  AudioService,
  isRetryableElevenLabsError,
  MAX_AUDIO_SEGMENTS,
  parseAudioSegments
} from '../api/_lib/services/audioService';
import { AUDIO_FORMATS, AudioConversionSeam } from '../api/_lib/types/contracts';

// The service reads `ELEVENLABS_API_KEY` in the constructor and falls back to
// its mock narration when it is absent, the way `ImageService` does for
// `XAI_API_KEY` — clearing it before the first `new AudioService()` is what
// keeps these tests off the network.
delete process.env['ELEVENLABS_API_KEY'];
delete process.env['ELEVENLABS_VOICE_NARRATOR'];
delete process.env['ELEVENLABS_VOICE_DEFAULT'];
delete process.env['ELEVENLABS_VOICE_LORD_DAMIEN'];
// `isProductionRuntime()` reads these from ambient `process.env`, the same
// gap `tests/api-access-control.test.ts` pins `RATE_LIMIT_STORE` against —
// an ambient `NODE_ENV=production` in whatever runs this suite would turn
// every mock-mode assertion below into an `AI_UNAVAILABLE` failure instead.
delete process.env['NODE_ENV'];
delete process.env['VERCEL_ENV'];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createInput(overrides: Partial<AudioConversionSeam['input']> = {}): AudioConversionSeam['input'] {
  return {
    storyId: 'story_audio_regression',
    content: '<p>[Narrator]: The candles guttered.</p><p>[Lord Damien, voice: velvet-smoke]: "Come closer."</p>',
    ...overrides
  };
}

/** A 44-byte RIFF/WAVE header should sit in front of whatever this service produces. */
function assertIsWavBuffer(buffer: Buffer): void {
  assert(buffer.length >= 44, `a WAV file should carry its 44-byte header (got ${buffer.length} bytes)`);
  assert(buffer.toString('ascii', 0, 4) === 'RIFF', 'a WAV file should open with RIFF');
  assert(buffer.toString('ascii', 8, 12) === 'WAVE', 'a WAV file should declare the WAVE format');
  assert(buffer.toString('ascii', 12, 16) === 'fmt ', 'a WAV file should carry an fmt chunk');
  assert(buffer.toString('ascii', 36, 40) === 'data', 'a WAV file should carry a data chunk');
}

function decodeDataUri(audioUrl: string): Buffer {
  const match = audioUrl.match(/^data:([^;]+);base64,(.+)$/);
  assert(match, `audioUrl should be a base64 data URI (got: ${audioUrl.slice(0, 40)}…)`);
  return Buffer.from(match![2], 'base64');
}

// The speaker tag can carry a voice description, an emotion, or nothing at
// all — `[Narrator]:`, `[Name, voice: …]:`, `[Name, emotion: …]:` — and the
// same three shapes are what `extractCharacterNames` already reads elsewhere
// in this codebase.
function testSpeakerTagsAreParsedIntoOrderedSegments(): void {
  const segments = parseAudioSegments(
    '<p>[Narrator]: The candles guttered.</p>'
    + '<p>[Lord Damien, voice: velvet-smoke whiskey-rough]: "Come closer."</p>'
    + '<p>[Mira, emotion: afraid]: "Are you certain?"</p>'
    + '<p>[Lord Damien]: "You are safe here."</p>'
  );

  assert(segments.length === 4, `four paragraphs should be four segments (got ${segments.length})`);
  assert(segments[0].speaker === 'Narrator' && segments[0].text === 'The candles guttered.', 'narrator segment should read plainly');
  assert(segments[1].speaker === 'Lord Damien' && segments[1].text === 'Come closer.', 'a voice-tagged line should resolve to the character and the quoted text');
  assert(segments[2].speaker === 'Mira' && segments[2].text === 'Are you certain?', 'an emotion-tagged line should resolve the same way');
  assert(segments[3].speaker === 'Lord Damien' && segments[3].text === 'You are safe here.', 'a repeat speaker keeps its plain tag');
}

// A block with no bracketed speaker tag at all is narration by default — the
// same reading `parseAudioSegments`'s docblock states.
function testUntaggedTextIsNarration(): void {
  const segments = parseAudioSegments('<p>She opened the door.</p>');
  assert(segments.length === 1 && segments[0].speaker === 'Narrator', 'untagged prose should default to Narrator');
}

// A paragraph break in the markup is a paragraph break in the segments, not a
// welded run of text — the failure `splitStoryIntoTextBlocks` exists to
// prevent, read the same way `ImageService`'s scene reader reads it.
function testHtmlParagraphBreaksStaySeparateSegments(): void {
  const segments = parseAudioSegments('<p>[Narrator]: He shut the door.</p><p>[Narrator]: Blood pooled at her feet.</p>');
  assert(segments.length === 2, `two paragraphs should stay two segments (got ${segments.length})`);
  assert(!segments[0].text.includes('Blood'), 'the two paragraphs should not be welded together');
}

// A block is not guaranteed to carry exactly one speaker. An anchored pattern
// would leave a second tag sitting in the first speaker's text, read aloud as
// literal words instead of switching the voice.
function testMultipleSpeakerTagsWithinOneBlockAreSplit(): void {
  const segments = parseAudioSegments('<p>[Narrator]: She turned. [Mira]: "Stop."</p>');

  assert(segments.length === 2, `one block with two tags should be two segments (got ${segments.length})`);
  assert(segments[0].speaker === 'Narrator' && segments[0].text === 'She turned.', `first segment should be Narrator's alone (got ${JSON.stringify(segments[0])})`);
  assert(segments[1].speaker === 'Mira' && segments[1].text === 'Stop.', `second segment should be Mira's, tag stripped (got ${JSON.stringify(segments[1])})`);
  assert(!segments[0].text.includes('[Mira]'), 'the second tag should not leak into the first segment\'s spoken text');
}

// Two calls with the same content should resolve the same speaker to the same
// mock voice id, and two different speakers to two different ids — otherwise
// a caller cannot tell from the response which lines shared a voice.
async function testMockVoiceResolutionIsDeterministicAndDistinctPerSpeaker(): Promise<void> {
  const input = createInput();
  const first = await new AudioService().convertToAudio(input);
  const second = await new AudioService().convertToAudio(input);

  assert(first.success && second.success, 'mock narration should succeed');
  const firstVoices = (first.data as AudioConversionSeam['output']).voiceUsed;
  const secondVoices = (second.data as AudioConversionSeam['output']).voiceUsed;

  assert(JSON.stringify(firstVoices) === JSON.stringify(secondVoices), 'the same content should resolve to the same voices every time');
  assert(firstVoices.length === 2, `Narrator and Lord Damien should resolve to two distinct voices (got ${firstVoices.length})`);
}

// A per-character environment variable, in the shape README:387 already
// documents for creature/gender voices, should be read for a character name
// too, and should win over the deterministic mock fallback.
async function testPerCharacterVoiceEnvVarOverridesTheMockFallback(): Promise<void> {
  process.env['ELEVENLABS_VOICE_LORD_DAMIEN'] = 'voice_configured_by_operator';
  try {
    const result = await new AudioService().convertToAudio(createInput());
    assert(result.success, 'narration should still succeed with a configured voice');
    const voices = (result.data as AudioConversionSeam['output']).voiceUsed;
    assert(voices.includes('voice_configured_by_operator'), `the configured voice id should be used (got ${JSON.stringify(voices)})`);
  } finally {
    delete process.env['ELEVENLABS_VOICE_LORD_DAMIEN'];
  }
}

// `ELEVENLABS_VOICE_DEFAULT` alone — this seam's smallest documented setup —
// has to cover the Narrator too, not just named characters.
// `resolveConfiguredVoiceId` runs identically in mock and real mode (only the
// "unconfigured in real mode" throw is mode-specific), so this exercises the
// same fallback bug without an API key or a network call: `voiceUsed` reports
// whatever the resolver actually picked either way.
async function testDefaultVoiceEnvVarAloneCoversTheNarrator(): Promise<void> {
  process.env['ELEVENLABS_VOICE_DEFAULT'] = 'operator_default_voice';
  try {
    const result = await new AudioService().convertToAudio(createInput({
      content: '<p>[Narrator]: Only the narrator speaks here.</p>'
    }));
    assert(result.success, `ELEVENLABS_VOICE_DEFAULT alone should resolve the narrator (got ${JSON.stringify(result.error)})`);
    const voices = (result.data as AudioConversionSeam['output']).voiceUsed;
    assert(voices.includes('operator_default_voice'), `the default voice should be used for the narrator (got ${JSON.stringify(voices)})`);
  } finally {
    delete process.env['ELEVENLABS_VOICE_DEFAULT'];
  }
}

// In real mode, ElevenLabs only ever receives a speed clamped into its own
// narrower range — so the pre-synthesis length estimate has to use that
// clamped value too, or a caller requesting a fast speed the provider won't
// honor could slip an oversized request past the cap on the strength of an
// estimate synthesis will never actually produce.
async function testDurationEstimateUsesTheProvidersEffectiveSpeedInRealMode(): Promise<void> {
  process.env['ELEVENLABS_API_KEY'] = 'test-key-not-a-real-credential';
  try {
    // 600 words at the caller's requested speed (2.0) estimates ~120s — under
    // the cap — but ElevenLabs clamps to 1.2, where the same words take ~200s,
    // over it. This must be refused for exceeding the cap, not accepted and
    // then produce an oversized response (or a shorter one than promised).
    const result = await new AudioService().convertToAudio(createInput({
      content: '<p>[Narrator]: ' + 'word '.repeat(600) + '</p>',
      speed: 2.0
    }));
    assert(!result.success, 'a request only short enough at an unhonoured speed should be refused');
    assert(result.error?.code === 'INVALID_INPUT', `got ${result.error?.code}`);

    // The same content and speed in mock mode is fine: the mock path honours
    // the caller's raw speed in full, with nothing to clamp.
    delete process.env['ELEVENLABS_API_KEY'];
    const mockResult = await new AudioService().convertToAudio(createInput({
      content: '<p>[Narrator]: ' + 'word '.repeat(600) + '</p>',
      speed: 2.0
    }));
    assert(mockResult.success, 'the same request should narrate fine in mock mode, where speed is not clamped');
  } finally {
    delete process.env['ELEVENLABS_API_KEY'];
  }
}

// The caller's `voice` override, when sent, applies to every segment — even
// the ones that would otherwise resolve to different voices.
async function testCallerVoiceOverrideAppliesToEverySegment(): Promise<void> {
  const result = await new AudioService().convertToAudio(createInput({ voice: 'caller_chosen_voice' }));
  assert(result.success, 'narration should succeed with an override');
  const voices = (result.data as AudioConversionSeam['output']).voiceUsed;
  assert(JSON.stringify(voices) === JSON.stringify(['caller_chosen_voice']), `every segment should share the override (got ${JSON.stringify(voices)})`);
}

// The response has to be bytes a player can actually open, not a placeholder:
// a real RIFF/WAVE header, a `data:audio/wav;base64,…` URI, and a duration
// that grows with more text to narrate.
async function testMockNarrationProducesAValidWavFile(): Promise<void> {
  const result = await new AudioService().convertToAudio(createInput());
  assert(result.success, 'mock narration should succeed');

  const output = result.data as AudioConversionSeam['output'];
  assert(output.format === 'wav', `the default format should be wav (got ${output.format})`);
  assertIsWavBuffer(decodeDataUri(output.audioUrl));
  assert(output.duration > 0, `duration should be positive (got ${output.duration})`);

  const longer = await new AudioService().convertToAudio(createInput({
    content: '<p>[Narrator]: ' + 'word '.repeat(200) + '</p>'
  }));
  assert(longer.success, 'a longer chapter should still narrate');
  assert(
    (longer.data as AudioConversionSeam['output']).duration > output.duration,
    'more words should take longer to narrate'
  );
}

// The response is a `data:` URI carrying the whole file inline, not a stream
// or a stored file — so a chapter long enough to produce a many-megabyte
// response is refused up front, before any synthesis call, rather than risking
// a serverless response-size limit or a slow request for little benefit.
async function testOverlongContentIsRefusedBeforeSynthesis(): Promise<void> {
  // ~200s at the default speed and words-per-minute this service assumes —
  // comfortably past the 180s cap.
  const tooLong = await new AudioService().convertToAudio(createInput({
    content: '<p>[Narrator]: ' + 'word '.repeat(500) + '</p>'
  }));

  assert(!tooLong.success, 'content estimated past the duration cap should be refused');
  assert(tooLong.error?.code === 'INVALID_INPUT', `an overlong request is a caller error (got ${tooLong.error?.code})`);
  assert(/too long/i.test(tooLong.error?.message ?? ''), `the message should say why (got ${tooLong.error?.message})`);

  // Comfortably under the cap at the default speed — the cap is read from
  // the estimate, not from a flat word ceiling.
  const shortEnough = await new AudioService().convertToAudio(createInput({
    content: '<p>[Narrator]: ' + 'word '.repeat(400) + '</p>'
  }));
  assert(shortEnough.success, 'content safely under the cap should still narrate');
}

// `speed` scales the mock narration's estimated duration; a slower reading
// should take longer, matching what a real narration at that speed would.
async function testSpeedScalesTheEstimatedDuration(): Promise<void> {
  const normal = await new AudioService().convertToAudio(createInput({ speed: 1.0 }));
  const slow = await new AudioService().convertToAudio(createInput({ speed: 0.5 }));

  assert(normal.success && slow.success, 'both speeds should narrate successfully');
  assert(
    (slow.data as AudioConversionSeam['output']).duration > (normal.data as AudioConversionSeam['output']).duration,
    'a slower speed should produce a longer estimated duration'
  );
}

// A caller error is answered as one, the same rule `ImageService.validateImageInput`
// follows: a missing field, an out-of-range speed, and an unsupported format are
// all `INVALID_INPUT`/`UNSUPPORTED_FORMAT`, never `AUDIO_GENERATION_FAILED`.
async function testMalformedInputIsRejectedAsCallerError(): Promise<void> {
  const missingStoryId = await new AudioService().convertToAudio(createInput({ storyId: '' }));
  assert(missingStoryId.error?.code === 'INVALID_INPUT', 'an empty storyId is a caller error');

  // Real ids are `story_<uuid>` (~42 characters). An unbounded storyId is
  // echoed verbatim into a successful response alongside the synthesized
  // audio, so a multi-megabyte one could push an otherwise-compliant
  // response past the inline-response budget after synthesis already ran.
  const oversizedStoryId = await new AudioService().convertToAudio(createInput({ storyId: 'x'.repeat(1000) }));
  assert(oversizedStoryId.error?.code === 'INVALID_INPUT', `an oversized storyId is a caller error (got ${oversizedStoryId.error?.code})`);

  const tooShort = await new AudioService().convertToAudio(createInput({ content: 'hi' }));
  assert(tooShort.error?.code === 'INVALID_INPUT', 'content shorter than the floor is a caller error');

  const speedTooHigh = await new AudioService().convertToAudio(createInput({ speed: 10 }));
  assert(speedTooHigh.error?.code === 'INVALID_INPUT', 'a speed outside the supported range is a caller error');

  const unsupportedFormat = await new AudioService().convertToAudio(
    createInput({ format: 'flac' as AudioConversionSeam['input']['format'] })
  );
  assert(unsupportedFormat.error?.code === 'UNSUPPORTED_FORMAT', `an unsupported format should be refused by name (got ${unsupportedFormat.error?.code})`);
  assert(
    typeof (unsupportedFormat.error as { requestedFormat?: unknown }).requestedFormat === 'string',
    'requestedFormat should be a string the caller can render'
  );

  // A non-string format must not reach `requestedFormat` verbatim — the
  // contract types that field as a string, and `format as string` on a
  // number would have written the number straight into it.
  const numericFormat = await new AudioService().convertToAudio(
    createInput({ format: 42 as unknown as AudioConversionSeam['input']['format'] })
  );
  assert(numericFormat.error?.code === 'INVALID_INPUT', `a non-string format is a caller error (got ${numericFormat.error?.code})`);

  const noNarratableText = await new AudioService().convertToAudio(createInput({ content: '           ' }));
  assert(!noNarratableText.success, 'whitespace-only content should be refused');

  const oversizedContent = await new AudioService().convertToAudio(createInput({ content: 'x'.repeat(25_000) }));
  assert(oversizedContent.error?.code === 'INVALID_INPUT', `content past the raw-length cap should be refused before parsing (got ${oversizedContent.error?.code})`);

  // Request bodies are untyped JSON at runtime: a `voice` that is not a
  // string must not reach `.trim()` inside voice resolution and surface as an
  // uncaught TypeError reported as a 500-style AUDIO_GENERATION_FAILED.
  const numericVoice = await new AudioService().convertToAudio(
    createInput({ voice: 42 as unknown as AudioConversionSeam['input']['voice'] })
  );
  assert(numericVoice.error?.code === 'INVALID_INPUT', `a non-string voice is a caller error, not a crash (got ${numericVoice.error?.code})`);

  const blankVoice = await new AudioService().convertToAudio(createInput({ voice: '   ' }));
  assert(blankVoice.error?.code === 'INVALID_INPUT', 'a blank voice override is a caller error');
}

// A production deployment with no ElevenLabs key must refuse rather than
// silently narrate several minutes of mock silence as `success: true`,
// "Narration ready" — the same "no silent mock in production" rule
// `StoryService`/`storyLabEngine` already enforce for their own provider.
async function testProductionWithNoKeyFailsClosedInsteadOfMocking(): Promise<void> {
  process.env['NODE_ENV'] = 'production';
  try {
    const result = await new AudioService().convertToAudio(createInput());
    assert(!result.success, 'production with no ElevenLabs key should refuse, not mock');
    assert(result.error?.code === 'AI_UNAVAILABLE', `got ${result.error?.code}`);
    assert(/ELEVENLABS_API_KEY/.test(result.error?.message ?? ''), `the message should name what to set (got ${result.error?.message})`);
  } finally {
    delete process.env['NODE_ENV'];
  }
}

// A real API key with no voice configured anywhere (no override, no
// per-character or narrator/default env var) must fail with a clear
// configuration message, not by handing ElevenLabs a fabricated mock voice
// id and reporting whatever error that produces as a generic outage.
async function testRealModeRequiresAConfiguredVoice(): Promise<void> {
  process.env['ELEVENLABS_API_KEY'] = 'test-key-not-a-real-credential';
  try {
    const result = await new AudioService().convertToAudio(createInput({
      content: '<p>[Narrator]: Only the narrator speaks here.</p>'
    }));

    assert(!result.success, 'an unconfigured real-mode voice should fail rather than call the provider with a mock id');
    assert(result.error?.code === 'AUDIO_GENERATION_FAILED', `got ${result.error?.code}`);
    assert(/no elevenlabs voice is configured/i.test(result.error?.message ?? ''), `the message should name the real problem (got ${result.error?.message})`);
    // A missing voice configuration fails identically on every retry, unlike
    // a provider outage — `AudioConversionSeam.errors.AUDIO_GENERATION_FAILED`
    // declares `retryable` for exactly this distinction.
    assert(
      (result.error as { retryable?: unknown }).retryable === false,
      `a configuration error should be reported as not retryable (got ${(result.error as { retryable?: unknown }).retryable})`
    );
  } finally {
    delete process.env['ELEVENLABS_API_KEY'];
  }
}

// A character budget alone doesn't bound how many times a chapter changes
// speaker — `[A]: a ` repeated hundreds of times fits comfortably under
// `MAX_AUDIO_CONTENT_LENGTH` while still being that many sequential paid
// ElevenLabs calls if this weren't refused first.
async function testTooManySpeakerSegmentsIsRejected(): Promise<void> {
  const segmentTags = (count: number) =>
    Array.from({ length: count }, (_, index) => `[Speaker${index}]: line`).join(' ');

  const result = await new AudioService().convertToAudio(createInput({ content: segmentTags(MAX_AUDIO_SEGMENTS + 1) }));

  assert(!result.success, 'content with more speaker segments than the cap should be refused');
  assert(result.error?.code === 'INVALID_INPUT', `too many segments is a caller error (got ${result.error?.code})`);
  assert(/too many times/i.test(result.error?.message ?? ''), `the message should say why (got ${result.error?.message})`);

  const withinCap = await new AudioService().convertToAudio(createInput({ content: segmentTags(MAX_AUDIO_SEGMENTS) }));
  assert(withinCap.success, 'content at exactly the segment cap should still narrate');
}

// `MAX_AUDIO_SEGMENTS` bounds provider calls, not paragraphs: many short
// consecutive narration paragraphs — ordinary prose, not an adversarial
// shape — used to be counted one segment per paragraph and wrongly refused
// as "too many speaker changes" even though every one of them is Narrator.
async function testConsecutiveSameSpeakerParagraphsAreCoalescedForTheSegmentCap(): Promise<void> {
  const manyNarratorParagraphs = Array.from(
    { length: MAX_AUDIO_SEGMENTS * 2 },
    (_, index) => `<p>[Narrator]: word${index}.</p>`
  ).join('');

  const result = await new AudioService().convertToAudio(createInput({ content: manyNarratorParagraphs }));
  assert(result.success, `many same-speaker paragraphs should coalesce under the segment cap, not be refused (got ${JSON.stringify(result.error)})`);
}

// A permanent provider failure (bad credentials, an invalid voice id, a
// rejected payload) will reproduce identically on every retry; only a
// response-less failure (timeout, dropped connection), a rate limit, or a
// provider-side outage is worth a caller retrying.
function testRetryabilityClassificationForProviderErrors(): void {
  assert(isRetryableElevenLabsError({}) === true, 'a response-less failure (timeout/network error) should be retryable');
  assert(isRetryableElevenLabsError({ response: { status: 408 } }) === true, 'an explicit request timeout should be retryable');
  assert(isRetryableElevenLabsError({ response: { status: 429 } }) === true, 'a rate limit should be retryable');
  assert(isRetryableElevenLabsError({ response: { status: 500 } }) === true, 'a provider 5xx should be retryable');
  assert(isRetryableElevenLabsError({ response: { status: 503 } }) === true, 'a provider 503 should be retryable');
  assert(isRetryableElevenLabsError({ response: { status: 401 } }) === false, 'an invalid API key should not be retryable');
  assert(isRetryableElevenLabsError({ response: { status: 400 } }) === false, 'a rejected payload should not be retryable');
  assert(isRetryableElevenLabsError({ response: { status: 422 } }) === false, 'an invalid voice id should not be retryable');
}

async function testTheRequestIdReachesTheEnvelope(): Promise<void> {
  const result = await new AudioService().convertToAudio(createInput(), 'audio-req-fixed-id');
  assert(result.metadata?.requestId === 'audio-req-fixed-id', 'a caller-supplied request id should reach the envelope unchanged');
}

async function main(): Promise<void> {
  testSpeakerTagsAreParsedIntoOrderedSegments();
  testUntaggedTextIsNarration();
  testHtmlParagraphBreaksStaySeparateSegments();
  testMultipleSpeakerTagsWithinOneBlockAreSplit();
  await testMockVoiceResolutionIsDeterministicAndDistinctPerSpeaker();
  await testPerCharacterVoiceEnvVarOverridesTheMockFallback();
  await testCallerVoiceOverrideAppliesToEverySegment();
  await testMockNarrationProducesAValidWavFile();
  await testOverlongContentIsRefusedBeforeSynthesis();
  await testSpeedScalesTheEstimatedDuration();
  await testMalformedInputIsRejectedAsCallerError();
  await testProductionWithNoKeyFailsClosedInsteadOfMocking();
  await testRealModeRequiresAConfiguredVoice();
  await testDefaultVoiceEnvVarAloneCoversTheNarrator();
  await testDurationEstimateUsesTheProvidersEffectiveSpeedInRealMode();
  await testTooManySpeakerSegmentsIsRejected();
  await testConsecutiveSameSpeakerParagraphsAreCoalescedForTheSegmentCap();
  testRetryabilityClassificationForProviderErrors();
  await testTheRequestIdReachesTheEnvelope();

  assert(AUDIO_FORMATS.length === 1 && AUDIO_FORMATS[0] === 'wav', 'this seam should still support exactly one format: wav');

  console.log('Audio service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
