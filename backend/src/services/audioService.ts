import { AudioConversionSeam, ApiResponse } from '@fairytales-with-spice/contracts';
import { IAudioConversionService } from './audio/AudioConversionService';

export interface IAudioService {
  convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>>;
}

export class AudioService implements IAudioService {
  private audioConversionService: IAudioConversionService;

  constructor(audioConversionService: IAudioConversionService) {
    this.audioConversionService = audioConversionService;
  }

  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}`;

    try {
      const cleanText = this.cleanHtmlForTTS(input.content);
      const audioData = await this.audioConversionService.convert(cleanText, input);
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
}