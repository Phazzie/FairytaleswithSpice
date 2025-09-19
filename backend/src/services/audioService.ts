import axios from 'axios';
import { AudioConversionSeam, ApiResponse } from '../types/contracts';
import { MultiVoiceAudioService } from './multiVoiceAudioService';

export class AudioService {
  private multiVoiceService: MultiVoiceAudioService;
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  // Legacy voice IDs for backward compatibility
  private voiceIds = {
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM' // Rachel
  };

  constructor() {
    this.multiVoiceService = new MultiVoiceAudioService();
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  /**
   * Main audio conversion method - now supports multi-voice generation
   */
  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    // Delegate to the multi-voice service which handles both single and multi-voice scenarios
    return await this.multiVoiceService.convertToAudio(input);
  }

  // Legacy methods maintained for backward compatibility
  private async callElevenLabsAPI(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(text);
    }

    const voiceId = this.voiceIds[input.voice || 'female'];

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.5,
            use_speaker_boost: true
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      return Buffer.from(response.data);

    } catch (error: any) {
      console.error('ElevenLabs API error:', error.response?.data || error.message);
      throw error;
    }
  }

  private async uploadAudioToStorage(audioData: Buffer, input: AudioConversionSeam['input']): Promise<string> {
    const filename = `story-${input.storyId}-audio.${input.format || 'mp3'}`;
    await new Promise(resolve => setTimeout(resolve, 500));
    return `https://storage.example.com/audio/${filename}`;
  }

  private cleanHtmlForTTS(htmlContent: string): string {
    let cleanText = htmlContent
      .replace(/<[^>]*>/g, '')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    cleanText = cleanText
      .replace(/\.\s/g, '. ')
      .replace(/\?\s/g, '? ')
      .replace(/\!\s/g, '! ');

    return cleanText;
  }

  private estimateDuration(text: string): number {
    const wordsPerSecond = 2.5;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerSecond);
  }

  private generateMockAudioData(text: string): Buffer {
    const duration = this.estimateDuration(text);
    const sampleRate = 44100;
    const channels = 2;
    const bitsPerSample = 16;
    const numSamples = duration * sampleRate;
    const buffer = Buffer.alloc(numSamples * channels * (bitsPerSample / 8));

    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      buffer.writeInt16LE(intSample, i * 4);
      buffer.writeInt16LE(intSample, i * 4 + 2);
    }

    return buffer;
  }

  private generateAudioId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}