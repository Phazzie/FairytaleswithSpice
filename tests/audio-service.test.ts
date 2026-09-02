#!/usr/bin/env tsx
// Created: 2026-09-02 UTC

import {
  AudioService,
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

  const tooShort = await new AudioService().convertToAudio(createInput({ content: 'hi' }));
  assert(tooShort.error?.code === 'INVALID_INPUT', 'content shorter than the floor is a caller error');

  const speedTooHigh = await new AudioService().convertToAudio(createInput({ speed: 10 }));
  assert(speedTooHigh.error?.code === 'INVALID_INPUT', 'a speed outside the supported range is a caller error');

  const unsupportedFormat = await new AudioService().convertToAudio(
    createInput({ format: 'flac' as AudioConversionSeam['input']['format'] })
  );
  assert(unsupportedFormat.error?.code === 'UNSUPPORTED_FORMAT', `an unsupported format should be refused by name (got ${unsupportedFormat.error?.code})`);

  const noNarratableText = await new AudioService().convertToAudio(createInput({ content: '           ' }));
  assert(!noNarratableText.success, 'whitespace-only content should be refused');
}

async function testTheRequestIdReachesTheEnvelope(): Promise<void> {
  const result = await new AudioService().convertToAudio(createInput(), 'audio-req-fixed-id');
  assert(result.metadata?.requestId === 'audio-req-fixed-id', 'a caller-supplied request id should reach the envelope unchanged');
}

async function main(): Promise<void> {
  testSpeakerTagsAreParsedIntoOrderedSegments();
  testUntaggedTextIsNarration();
  testHtmlParagraphBreaksStaySeparateSegments();
  await testMockVoiceResolutionIsDeterministicAndDistinctPerSpeaker();
  await testPerCharacterVoiceEnvVarOverridesTheMockFallback();
  await testCallerVoiceOverrideAppliesToEverySegment();
  await testMockNarrationProducesAValidWavFile();
  await testSpeedScalesTheEstimatedDuration();
  await testMalformedInputIsRejectedAsCallerError();
  await testTheRequestIdReachesTheEnvelope();

  assert(AUDIO_FORMATS.length === 1 && AUDIO_FORMATS[0] === 'wav', 'this seam should still support exactly one format: wav');

  console.log('Audio service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
