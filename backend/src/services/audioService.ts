import { AudioConversionSeam, ApiResponse } from '@fairytales-with-spice/contracts';
import { HttpClient } from '../lib/http/HttpClient';

export interface IAudioService {
  convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>>;
}

export class AudioService implements IAudioService {
  private elevenLabsApiKey: string | undefined;
  private httpClient: HttpClient;

  private voiceIds = {
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL',
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB',
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM',
  };

  constructor(httpClient: HttpClient, apiKey?: string) {
    this.httpClient = httpClient;
    this.elevenLabsApiKey = apiKey;
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}`;

    try {
      const cleanText = this.cleanHtmlForTTS(input.content);
      const audioData = await this.callElevenLabsAPI(cleanText, input);
      const audioUrl = await this.uploadAudioToStorage(audioData, input);

      const output: AudioConversionSeam['output'] = {
        audioId: `audio_${Date.now()}`,
        storyId: input.storyId,
        audioUrl,
        duration: this.estimateDuration(cleanText),
        fileSize: audioData.length,
        format: input.format || 'mp3',
        voice: input.voice || 'female',
        speed: input.speed || 1.0,
        progress: {
          percentage: 100,
          status: 'completed',
          message: 'Audio conversion completed successfully',
          estimatedTimeRemaining: 0
        },
        completedAt: new Date()
      };

      return { success: true, data: output, metadata: { requestId, processingTime: Date.now() - startTime } };
    } catch (error: any) {
      console.error('Audio conversion error:', error);
      return {
        success: false,
        error: { code: 'CONVERSION_FAILED', message: 'Failed to convert story to audio', details: error.message },
        metadata: { requestId, processingTime: Date.now() - startTime }
      };
    }
  }

  private async callElevenLabsAPI(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(text);
    }

    const voiceId = this.voiceIds[input.voice || 'female'] || this.voiceIds.female;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const headers = {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': this.elevenLabsApiKey
    };
    const data = {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 }
    };

    const response = await this.httpClient.post<ArrayBuffer>(url, data, { headers, responseType: 'arraybuffer' });
    return Buffer.from(response);
  }

  private async uploadAudioToStorage(audioData: Buffer, input: AudioConversionSeam['input']): Promise<string> {
    const filename = `story-${input.storyId}-audio.${input.format || 'mp3'}`;
    await new Promise(resolve => setTimeout(resolve, 500));
    return `https://storage.example.com/audio/${filename}`;
  }

  private cleanHtmlForTTS(htmlContent: string): string {
    return htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private estimateDuration(text: string): number {
    const wordsPerSecond = 2.5;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerSecond);
  }

  private generateMockAudioData(text: string): Buffer {
    const duration = this.estimateDuration(text);
    const numSamples = duration * 44100;
    return Buffer.alloc(numSamples * 2 * 2);
  }
}