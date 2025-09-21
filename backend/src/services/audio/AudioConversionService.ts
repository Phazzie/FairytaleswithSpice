import { AudioConversionSeam } from '@fairytales-with-spice/contracts';

export interface IAudioConversionService {
  convert(text: string, input: AudioConversionSeam['input']): Promise<Buffer>;
}
