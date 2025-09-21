import { AudioConversionSeam } from '@fairytales-with-spice/contracts';
import { HttpClient } from '../../lib/http/HttpClient';
import { IAudioConversionService } from './AudioConversionService';

export class ElevenLabsService implements IAudioConversionService {
  private elevenLabsApiKey: string;
  private httpClient: HttpClient;

  private voiceIds = {
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL',
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB',
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM',
  };

  constructor(httpClient: HttpClient, apiKey: string) {
    this.httpClient = httpClient;
    this.elevenLabsApiKey = apiKey;
  }

  async convert(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
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
}
