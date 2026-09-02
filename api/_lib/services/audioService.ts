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
 * The PCM sample rate requested from ElevenLabs (`output_format=pcm_16000`)
 * and written into every WAV header this service produces, mock or real, so
 * one buffer format serves both paths.
 */
const SAMPLE_RATE = 16000;
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
 * this module's fixed `SAMPLE_RATE`/`BYTES_PER_SAMPLE`, that is 32,000 bytes
 * of raw PCM per second before base64 (~1.33x larger again), so an
 * unbounded chapter risks exceeding a serverless platform's response-size
 * limit, or simply taking a long time to synthesize and transfer for very
 * little benefit over narrating a shorter excerpt. Two minutes of audio is
 * under 5MB of base64 even at this uncompressed rate, and is checked against
 * the *slowest* allowed `speed` — the case that takes the longest to say the
 * same words — so a request that would exceed it is refused before any
 * synthesis call is made, with the estimate that decided so in the message.
 *
 * Narrating a full multi-hundred-word chapter in one request, or returning a
 * stored file's URL instead of an inline `data:` URI so the cap can be
 * lifted, is real follow-up work, not a decision this change makes by
 * omission.
 */
const MAX_ESTIMATED_DURATION_SECONDS = 120;

/**
 * The same speaker-tag shape `extractCharacterNames` in `storyContentAnalysis`
 * already matches: `[Name]:`, `[Name, voice: …]:`, `[Name, emotion: …]:`. Kept
 * as its own pattern rather than imported, because that function throws the
 * match away after reading the name and this one needs the tag's full length
 * to find where the spoken text starts.
 */
const SPEAKER_TAG_PATTERN = /^\[([^\],]+)(?:,\s*[^\]]+)?\]:\s*/;

export interface AudioSegment {
  speaker: string;
  text: string;
}

/**
 * Split speaker-tagged chapter text into ordered `{ speaker, text }` segments.
 *
 * Reads `splitStoryIntoTextBlocks` rather than the raw string the way every
 * other scan of this content does, so a paragraph break naive tag-stripping
 * would weld is still a paragraph break here. A block with no leading speaker
 * tag is narration, read as `Narrator` — the same default the story prompt's
 * own `AUDIO FORMAT` instructions describe.
 */
export function parseAudioSegments(content: string): AudioSegment[] {
  return splitStoryIntoTextBlocks(content)
    .map(block => {
      const match = block.match(SPEAKER_TAG_PATTERN);
      const speaker = match ? match[1].trim() : NARRATOR_SPEAKER;
      const spoken = match ? block.slice(match[0].length) : block;
      const text = spoken.trim().replace(/^"([\s\S]*)"$/, '$1').trim();

      return { speaker, text };
    })
    .filter(segment => segment.text.length > 0);
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
 * A failure whose message was written to be read by the caller. See
 * `ImageService`'s `CallerFacingImageError` for why this distinction is
 * marked on the throw rather than assumed by the catch block that forwards it.
 */
class CallerFacingAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallerFacingAudioError';
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

      return {
        success: false,
        error: {
          code: 'AUDIO_GENERATION_FAILED',
          message: error instanceof CallerFacingAudioError ? error.message : 'Failed to generate audio'
        },
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
    const voicesUsed: string[] = [];
    const buffers: Buffer[] = [];

    for (const segment of segments) {
      const voiceId = this.resolveVoiceId(segment.speaker, voiceOverride);
      if (!voicesUsed.includes(voiceId)) {
        voicesUsed.push(voiceId);
      }

      buffers.push(await this.synthesizeSegment(segment, voiceId, speed, requestId));
    }

    return { pcm: Buffer.concat(buffers), voicesUsed };
  }

  /**
   * Resolve a segment's speaker to a voice id.
   *
   * Order: the caller's `voice` override, applied to every segment alike; a
   * per-character environment variable named after the speaker (README's own
   * `ELEVENLABS_VOICE_<NAME>` convention, generalized from the creature/gender
   * examples it gave to the character names the tags actually carry); a
   * narrator-or-default fallback variable; and, failing all three, a
   * deterministic mock id so a request with none of this configured still
   * resolves instead of throwing.
   */
  private resolveVoiceId(speaker: string, voiceOverride: string | undefined): string {
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

    return mockVoiceId(speaker);
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
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
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
      throw new CallerFacingAudioError('AI audio narration service temporarily unavailable');
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

    const speed: unknown = input.speed;
    if (speed !== undefined && (typeof speed !== 'number' || speed < MIN_SPEED || speed > MAX_SPEED)) {
      return { code: 'INVALID_INPUT', message: `speed must be a number between ${MIN_SPEED} and ${MAX_SPEED}` };
    }

    const format: unknown = input.format;
    if (format !== undefined && !(AUDIO_FORMATS as readonly string[]).includes(format as string)) {
      return {
        code: 'UNSUPPORTED_FORMAT',
        message: `Unsupported audio format. Supported formats: ${AUDIO_FORMATS.join(', ')}`,
        // The contract's `errors.UNSUPPORTED_FORMAT` names these, and
        // `ExportService.validateExportInput`'s `FORMAT_NOT_SUPPORTED` already
        // includes them for the same reason: a client can render "wav" rather
        // than parse it back out of the message string.
        requestedFormat: format as string,
        supportedFormats: AUDIO_FORMATS
      };
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
 * (`output_format=pcm_16000`) hand this the same shape of buffer, so one
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
