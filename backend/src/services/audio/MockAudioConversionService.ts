import { AudioConversionSeam } from '@fairytales-with-spice/contracts';
import { IAudioConversionService } from './AudioConversionService';

export class MockAudioConversionService implements IAudioConversionService {
  async convert(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    const duration = this.estimateDuration(text);
    const numSamples = duration * 44100;
    return Buffer.alloc(numSamples * 2 * 2);
  }

  private estimateDuration(text: string): number {
    const wordsPerSecond = 2.5;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerSecond);
  }
}
