// Created: 2026-09-02 UTC
//
// ==================== AUDIO NARRATION SERVICE ====================
// Implements SEAM 6: Chapter → Audio Narration.
//
// See `AudioConversionSeam` in `../types/contracts` for why this file exists:
// the README documented this endpoint, its request shape, and its voice-id
// environment variables while no code behind any of it was in the repository,
// and `Chapter.hasAudio`/`audioUrl` were hardcoded `false`/`undefined` at every
// call site because nothing could ever set them. This is what makes those
// fields, and the `[Character, voice: …]:`/`[Narrator]:` tags the story prompt
// already emits into `rawContent`, resolve to a real answer.

import axios from 'axios';
import { randomUUID, createHash } from 'node:crypto';
import { ApiResponse, AUDIO_FORMATS, AudioConversionSeam, AudioFormat } from '../types/contracts';
import { splitStoryIntoTextBlocks } from '../../../shared/storyTextBlocks';
import { logApiError, logError } from '../utils/logger';
import { toLoggableStoryId } from '../utils/loggableRequestParameters';

/**
 * The PCM sample rate requested from ElevenLabs (`output_format=pcm_8000`)
 * and written into every WAV header this service produces, mock or real, so
 * one buffer format serves both paths. 8kHz rather than a higher rate for the
 * reason `MAX_ESTIMATED_DURATION_SECONDS` explains: this is telephone-quality
 * audio, not hi-fi, and it is what keeps a useful narration length inside a
 * single inline response. 16-bit linear PCM (not a compressed encoding like
 * μ-law) is kept for universal `<audio>` playback support — halving the byte
 * rate again by dropping to 8-bit would risk browsers that do not decode
 * compressed WAV, which is a worse failure than a shorter cap.
 */
const SAMPLE_RATE = 8000;
const BYTES_PER_SAMPLE = 2; // 16-bit PCM
const CHANNELS = 1;

const AUDIO_MIME_TYPES: Record<AudioFormat, string> = {
  wav: 'audio/wav'
};

const NARRATOR_SPEAKER = 'Narrator';
const DEFAULT_FORMAT: AudioFormat = 'wav';
const DEFAULT_SPEED = 1.0;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2.0;

/** The shortest content a chapter can be narrated from. Mirrors `ImageService`'s floor for the same reason. */
const MIN_AUDIO_CONTENT_LENGTH = 10;

/**
 * The longest raw `content` this route will even attempt to parse.
 *
 * Checked before `parseAudioSegments` runs, not after: without it, a caller
 * could send an arbitrarily large body and pay for the paragraph split and
 * per-block regex scan on all of it before `MAX_ESTIMATED_DURATION_SECONDS`
 * below ever gets a chance to refuse the request. Generous relative to any
 * chapter this app actually generates (the largest `WORD_COUNTS` rung is
 * 1500 words, well under 20,000 characters of HTML), so it is a backstop
 * against a pathological or malicious body rather than a limit a real
 * chapter is expected to reach.
 */
const MAX_AUDIO_CONTENT_LENGTH = 20_000;

/** The longest `voice` override this route accepts — a provider voice id, not caller prose. */
const MAX_VOICE_LENGTH = 200;

/**
 * Average spoken pace, used to size the mock provider's silence (see
 * `synthesizeMockSegment`) and to estimate a request's narration length
 * before any synthesis runs (see `MAX_ESTIMATED_DURATION_SECONDS`).
 */
const NARRATION_WORDS_PER_MINUTE = 150;

/**
 * The longest narration this route will produce in one response.
 *
 * The output is a `data:` URI carrying the whole WAV file inline in the JSON
 * envelope, not a stream or a stored file — deliberately, per
 * `AudioConversionSeam`'s docblock, to avoid new storage infrastructure. At
 * this module's fixed `SAMPLE_RATE`/`BYTES_PER_SAMPLE`, that is 16,000 bytes
 * of raw PCM per second before base64 (~1.33x larger again) — so three
 * minutes is a little under 4MB of base64, chosen to stay under common
 * serverless response-size limits with headroom for the surrounding JSON.
 * Checked against the *slowest* allowed `speed` — the case that takes the
 * longest to say the same words — so a request that would exceed it is
 * refused before any synthesis call is made, with the estimate that decided
 * so in the message.
 *
 * This bounds the feature to an excerpt rather than guaranteeing a whole
 * chapter: at the default speed that is ~450 words, and this app's shortest
 * `WORD_COUNTS` rung alone is 600. The frontend's "Listen to Chapter"
 * control and the README are worded around that — an excerpt, not a promise
 * this seam cannot keep — for the same reason this whole feature exists:
 * README:3 promised "multi-voice audio narration" with nothing behind it.
 * Narrating a full chapter needs either a stored file served by URL instead
 * of an inline `data:` URI, or real compression (MP3/Opus) instead of linear
 * PCM; both are real follow-up work, not a decision this change makes by
 * omission.
 */
const MAX_ESTIMATED_DURATION_SECONDS = 180;

/**
 * The same speaker-tag shape `extractCharacterNames` in `storyContentAnalysis`
 * already matches: `[Name]:`, `[Name, voice: …]:`, `[Name, emotion: …]:`. Kept
 * as its own pattern rather than imported, because that function throws every
 * match away after reading the name and this one needs each tag's position
 * and length to cut the block at every speaker change, not just the first.
 * Global rather than anchored: `PRODUCTION_AUDIO_AND_VOICE_BLOCK` describes
 * one speaker tag opening a paragraph, but nothing enforces that a model
 * output actually keeps to it, and a paragraph carrying two lines of
 * dialogue — `[Narrator]: She turned. [Mira]: "Stop."` — has a second tag
 * that an anchored pattern would leave sitting in the Narrator's spoken text,
 * read aloud as literal words instead of switching the voice.
 */
const SPEAKER_TAG_PATTERN = /\[([^\],]+)(?:,\s*[^\]]+)?\]:\s*/g;

/** A segment's text, quotes and surrounding whitespace trimmed off. `''` for a run that was only whitespace. */
function cleanSpokenText(raw: string): string {
  return raw.trim().replace(/^"([\s\S]*)"$/, '$1').trim();
}

export interface AudioSegment {
  speaker: string;
  text: string;
}

/**
 * Split speaker-tagged chapter text into ordered `{ speaker, text }` segments.
 *
 * Reads `splitStoryIntoTextBlocks` rather than the raw string the way every
 * other scan of this content does, so a paragraph break naive tag-stripping
 * would weld is still a paragraph break here. Within each block, every
 * speaker tag — not just a leading one — starts a new segment; text before
 * the first tag in a block (or a block with no tag at all) is narration,
 * read as `Narrator` — the same default the story prompt's own
 * `AUDIO FORMAT` instructions describe.
 */
export function parseAudioSegments(content: string): AudioSegment[] {
  const segments: AudioSegment[] = [];

  for (const block of splitStoryIntoTextBlocks(content)) {
    let speaker = NARRATOR_SPEAKER;
    let cursor = 0;
    SPEAKER_TAG_PATTERN.lastIndex = 0;

    for (let match = SPEAKER_TAG_PATTERN.exec(block); match !== null; match = SPEAKER_TAG_PATTERN.exec(block)) {
      const text = cleanSpokenText(block.slice(cursor, match.index));
      if (text) {
        segments.push({ speaker, text });
      }

      speaker = match[1].trim();
      cursor = match.index + match[0].length;
    }

    const text = cleanSpokenText(block.slice(cursor));
    if (text) {
      segments.push({ speaker, text });
    }
  }

  return segments;
}

/** `Lord Damien` → `ELEVENLABS_VOICE_LORD_DAMIEN`, the per-character override README:387 already documents the shape of. */
function speakerEnvKey(speaker: string): string {
  const normalized = speaker.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `ELEVENLABS_VOICE_${normalized}`;
}

/** A voice id with no external dependency: stable per speaker, distinct across speakers, needing no configuration. */
function mockVoiceId(speaker: string): string {
  return `mock_voice_${createHash('sha256').update(speaker).digest('hex').slice(0, 12)}`;
}

/**
 * ElevenLabs' documented range for `voice_settings.speed`, which is narrower
 * than this seam's own `MIN_SPEED`/`MAX_SPEED`. Verify against ElevenLabs'
 * current API reference before relying on this exact bound in production —
 * providers revise these ranges, and this repository has no network access
 * to confirm it live.
 */
const ELEVENLABS_MIN_SPEED = 0.7;
const ELEVENLABS_MAX_SPEED = 1.2;

function clampToElevenLabsSpeedRange(speed: number): number {
  return Math.min(ELEVENLABS_MAX_SPEED, Math.max(ELEVENLABS_MIN_SPEED, speed));
}

/**
 * A failure whose message was written to be read by the caller. See
 * `ImageService`'s `CallerFacingImageError` for why this distinction is
 * marked on the throw rather than assumed by the catch block that forwards it.
 *
 * `retryable` travels with it because the two throw sites mean different
 * things by "failed": a missing voice configuration will fail identically on
 * every retry until an operator fixes it, while a provider outage might not.
 * `AudioConversionSeam.errors.AUDIO_GENERATION_FAILED` declares the field;
 * this is what actually populates it, rather than leaving every response
 * `undefined` regardless of which failure produced it.
 */
class CallerFacingAudioError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'CallerFacingAudioError';
    this.retryable = retryable;
  }
}

export class AudioService {
  private elevenLabsApiKey: string | undefined;
  private elevenLabsApiUrl: string;

  constructor() {
    this.elevenLabsApiKey = process.env['ELEVENLABS_API_KEY'];
    this.elevenLabsApiUrl = 'https://api.elevenlabs.io/v1/text-to-speech';
  }

  async convertToAudio(
    input: AudioConversionSeam['input'],
    requestId?: string
  ): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();
    const correlationId = this.resolveRequestId(requestId);

    try {
      const validationError = this.validateAudioInput(input);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          metadata: { requestId: correlationId, processingTime: Date.now() - startTime }
        };
      }

      const segments = parseAudioSegments(input.content);
      if (segments.length === 0) {
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'No narratable text was found in the supplied content' },
          metadata: { requestId: correlationId, processingTime: Date.now() - startTime }
        };
      }

      const speed = input.speed ?? DEFAULT_SPEED;
      const estimatedSeconds = estimateNarrationSeconds(segments, speed);
      if (estimatedSeconds > MAX_ESTIMATED_DURATION_SECONDS) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: `This content is too long to narrate in one request `
              + `(~${Math.round(estimatedSeconds)}s estimated, ${MAX_ESTIMATED_DURATION_SECONDS}s max). `
              + 'Narrate a shorter excerpt.'
          },
          metadata: { requestId: correlationId, processingTime: Date.now() - startTime }
        };
      }

      const format = input.format ?? DEFAULT_FORMAT;
      const { pcm, voicesUsed } = await this.synthesizeSegments(segments, input.voice, speed, correlationId);
      const wavBuffer = buildWavBuffer(pcm);

      const output: AudioConversionSeam['output'] = {
        audioId: this.generateAudioId(),
        storyId: input.storyId,
        audioUrl: this.buildDataUri(format, wavBuffer),
        format,
        duration: estimateDurationSeconds(pcm.length),
        voiceUsed: voicesUsed,
        generatedAt: new Date()
      };

      return {
        success: true,
        data: output,
        metadata: { requestId: correlationId, processingTime: Date.now() - startTime }
      };
    } catch (error: any) {
      // Through the logger rather than the console, for the reason
      // `ImageService.generateImage`'s catch does: an axios error can carry
      // `config.headers['xi-api-key']`, and `logError` redacts what it keeps
      // rather than printing whatever the thrown value happens to hold.
      logError('Audio generation failed', error, {
        requestId: correlationId,
        endpoint: '/api/audio/convert',
        method: 'POST'
      }, { storyId: toLoggableStoryId(input.storyId) });

      // Built separately from the object literal below so `retryable` is not
      // an excess property against `ApiErrorPayload`'s declared shape — the
      // same reason `validateAudioInput`'s wider return type exists for
      // `UNSUPPORTED_FORMAT`'s extra fields. `AudioConversionSeam`'s own
      // `errors.AUDIO_GENERATION_FAILED` is the type this actually answers to.
      const failure: { code: string; message: string; retryable: boolean } = {
        code: 'AUDIO_GENERATION_FAILED',
        message: error instanceof CallerFacingAudioError ? error.message : 'Failed to generate audio',
        // An error this catch did not throw itself (and therefore did not
        // mark) is treated as not retryable, the same as the generic message
        // beside it — an unanticipated bug is not something the caller's
        // retry fixes either.
        retryable: error instanceof CallerFacingAudioError ? error.retryable : false
      };

      return {
        success: false,
        error: failure,
        metadata: { requestId: correlationId, processingTime: Date.now() - startTime }
      };
    }
  }

  /** Synthesize every segment in order and concatenate the PCM, so the narration reads in the order the chapter does. */
  private async synthesizeSegments(
    segments: AudioSegment[],
    voiceOverride: string | undefined,
    speed: number,
    requestId: string
  ): Promise<{ pcm: Buffer; voicesUsed: string[] }> {
    const isMockMode = !this.elevenLabsApiKey;
    const voicesUsed: string[] = [];
    const buffers: Buffer[] = [];

    for (const segment of segments) {
      const configuredVoiceId = this.resolveConfiguredVoiceId(segment.speaker, voiceOverride);

      // A mock id is only ever a stand-in for "no configuration was found" —
      // it is never a real ElevenLabs voice. Handing one to the real API on a
      // request that only forgot to configure a voice would have ElevenLabs
      // reject it, which `synthesizeSegment`'s catch below reports as "AI
      // audio narration service temporarily unavailable" — the wrong answer
      // for what is a configuration gap, not a provider outage.
      if (!isMockMode && !configuredVoiceId) {
        // Not retryable: the request will fail identically until an operator
        // sets a voice, which is not something the caller's next attempt can fix.
        throw new CallerFacingAudioError(
          `No ElevenLabs voice is configured for "${segment.speaker}". Set ELEVENLABS_VOICE_DEFAULT `
            + '(or ELEVENLABS_VOICE_NARRATOR, or a per-character ELEVENLABS_VOICE_<NAME> override) '
            + 'before narrating with a real API key.',
          false
        );
      }

      const voiceId = configuredVoiceId ?? mockVoiceId(segment.speaker);
      if (!voicesUsed.includes(voiceId)) {
        voicesUsed.push(voiceId);
      }

      buffers.push(await this.synthesizeSegment(segment, voiceId, speed, requestId));
    }

    return { pcm: Buffer.concat(buffers), voicesUsed };
  }

  /**
   * Resolve a segment's speaker to a voice id actually backed by
   * configuration, or `null` when none is.
   *
   * Order: the caller's `voice` override, applied to every segment alike; a
   * per-character environment variable named after the speaker (README's own
   * `ELEVENLABS_VOICE_<NAME>` convention, generalized from the creature/gender
   * examples it gave to the character names the tags actually carry); a
   * narrator-or-default fallback variable. `null` rather than a mock id here:
   * the caller (`synthesizeSegments`) decides what an unresolved voice means —
   * a fallback to the mock provider's deterministic id in mock mode, or a
   * refusal in real mode, where sending that same id to ElevenLabs would only
   * fail less clearly.
   */
  private resolveConfiguredVoiceId(speaker: string, voiceOverride: string | undefined): string | null {
    if (voiceOverride && voiceOverride.trim()) {
      return voiceOverride.trim();
    }

    const perCharacter = process.env[speakerEnvKey(speaker)];
    if (perCharacter && perCharacter.trim()) {
      return perCharacter.trim();
    }

    const fallbackKey = speaker === NARRATOR_SPEAKER ? 'ELEVENLABS_VOICE_NARRATOR' : 'ELEVENLABS_VOICE_DEFAULT';
    const fallback = process.env[fallbackKey];
    if (fallback && fallback.trim()) {
      return fallback.trim();
    }

    return null;
  }

  private async synthesizeSegment(
    segment: AudioSegment,
    voiceId: string,
    speed: number,
    requestId: string
  ): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return synthesizeMockSegment(segment.text, speed);
    }

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/${encodeURIComponent(voiceId)}`,
        {
          text: segment.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            // ElevenLabs' own documented range for this setting is narrower
            // than this seam's `MIN_SPEED`/`MAX_SPEED` (0.5-2.0); clamped
            // here so a caller's extreme value is still forwarded as the
            // closest the provider accepts rather than rejected as a
            // malformed request on a field this route already validated.
            // The mock path (`synthesizeMockSegment`) honours the full range,
            // since its "speed" is only ever a duration estimate.
            speed: clampToElevenLabsSpeedRange(speed)
          }
        },
        {
          headers: {
            'xi-api-key': this.elevenLabsApiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/pcm'
          },
          params: { output_format: `pcm_${SAMPLE_RATE}` },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error: any) {
      logApiError('ElevenLabs Audio API', error, {
        requestId,
        endpoint: '/api/audio/convert',
        method: 'POST'
      });
      // Retryable: this is the provider call failing, the transient case
      // `CallerFacingAudioError`'s docblock contrasts with the configuration
      // error above.
      throw new CallerFacingAudioError('AI audio narration service temporarily unavailable', true);
    }
  }

  private buildDataUri(format: AudioFormat, content: Buffer): string {
    return `data:${AUDIO_MIME_TYPES[format]};base64,${content.toString('base64')}`;
  }

  /**
   * Reject a request this service cannot honour before it reaches synthesis.
   * Read as `unknown` the way `ImageService.validateImageInput` does, for the
   * same reason: the contract types these as strings and numbers, and the
   * wire does not.
   */
  private validateAudioInput(
    input: AudioConversionSeam['input']
  ): { code: string; message: string; requestedFormat?: string; supportedFormats?: readonly string[] } | null {
    const storyId: unknown = input.storyId;
    if (typeof storyId !== 'string' || storyId.trim().length === 0) {
      return { code: 'INVALID_INPUT', message: 'Story ID is required and must be a non-empty string' };
    }

    const content: unknown = input.content;
    if (typeof content !== 'string' || content.length < MIN_AUDIO_CONTENT_LENGTH) {
      return { code: 'INVALID_INPUT', message: 'Chapter content is required and must be substantial' };
    }
    if (content.length > MAX_AUDIO_CONTENT_LENGTH) {
      return {
        code: 'INVALID_INPUT',
        message: `Content must be ${MAX_AUDIO_CONTENT_LENGTH} characters or fewer`
      };
    }

    const voice: unknown = input.voice;
    if (voice !== undefined) {
      if (typeof voice !== 'string' || voice.trim().length === 0) {
        return { code: 'INVALID_INPUT', message: 'voice must be a non-empty string when provided' };
      }
      if (voice.length > MAX_VOICE_LENGTH) {
        return { code: 'INVALID_INPUT', message: `voice must be ${MAX_VOICE_LENGTH} characters or fewer` };
      }
    }

    const speed: unknown = input.speed;
    if (speed !== undefined && (typeof speed !== 'number' || speed < MIN_SPEED || speed > MAX_SPEED)) {
      return { code: 'INVALID_INPUT', message: `speed must be a number between ${MIN_SPEED} and ${MAX_SPEED}` };
    }

    // Read as `unknown` and checked for `string` before it is ever placed in
    // `requestedFormat` below: the contract types that field as a string, and
    // a caller sending `{"format": 42}` or `{"format": null}` is not one —
    // `format as string` would have written the number or `null` straight
    // into a field a client reads expecting text.
    const format: unknown = input.format;
    if (format !== undefined) {
      if (typeof format !== 'string') {
        return { code: 'INVALID_INPUT', message: 'format must be a string when provided' };
      }
      if (!(AUDIO_FORMATS as readonly string[]).includes(format)) {
        return {
          code: 'UNSUPPORTED_FORMAT',
          message: `Unsupported audio format. Supported formats: ${AUDIO_FORMATS.join(', ')}`,
          // The contract's `errors.UNSUPPORTED_FORMAT` names these, and
          // `ExportService.validateExportInput`'s `FORMAT_NOT_SUPPORTED` already
          // includes them for the same reason: a client can render "wav" rather
          // than parse it back out of the message string.
          requestedFormat: format,
          supportedFormats: AUDIO_FORMATS
        };
      }
    }

    return null;
  }

  /** See `ImageService.resolveRequestId`: the correlation id goes with the request, not minted fresh per service. */
  private resolveRequestId(requestId?: string): string {
    return requestId && requestId.trim() ? requestId.trim() : `audio-req-${randomUUID()}`;
  }

  private generateAudioId(): string {
    return `audio-${randomUUID()}`;
  }
}

/**
 * How long one segment's text takes to read aloud, at `NARRATION_WORDS_PER_MINUTE`
 * and the given `speed`. Floor of 0.3s keeps an empty-sounding segment from
 * vanishing at very low `speed`. Shared by the pre-synthesis length check
 * (`MAX_ESTIMATED_DURATION_SECONDS`) and the mock provider's silence, so the
 * two never quote different paces for the same text.
 */
function estimateSegmentSeconds(text: string, speed: number): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(0.3, ((wordCount / NARRATION_WORDS_PER_MINUTE) * 60) / speed);
}

/** The whole request's estimated narration length — every segment, at the one `speed` they all share. */
function estimateNarrationSeconds(segments: AudioSegment[], speed: number): number {
  return segments.reduce((total, segment) => total + estimateSegmentSeconds(segment.text, speed), 0);
}

/**
 * Silent PCM for the mock provider, sized to roughly how long the real line
 * would take ElevenLabs to read — so a chapter of ten short lines of dialogue
 * does not report the same duration as one long monologue.
 */
function synthesizeMockSegment(text: string, speed: number): Buffer {
  const seconds = estimateSegmentSeconds(text, speed);
  const sampleCount = Math.round(seconds * SAMPLE_RATE);

  return Buffer.alloc(sampleCount * BYTES_PER_SAMPLE);
}

function estimateDurationSeconds(pcmByteLength: number): number {
  return Math.round((pcmByteLength / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 100) / 100;
}

/**
 * A standard 44-byte PCM WAV header in front of `pcm`, at this module's fixed
 * mono 16-bit `SAMPLE_RATE`. Both the mock path and the real ElevenLabs path
 * (`output_format=pcm_8000`) hand this the same shape of buffer, so one
 * writer serves either.
 */
function buildWavBuffer(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size (PCM)
  header.writeUInt16LE(1, 20); // audio format: PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
