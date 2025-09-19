"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const axios_1 = __importDefault(require("axios"));
const multiVoiceAudioService_1 = require("./multiVoiceAudioService");
class AudioService {
    constructor() {
        this.elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
        this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        // Legacy voice IDs for backward compatibility
        this.voiceIds = {
            female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
            male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
            neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM' // Rachel
        };
        this.multiVoiceService = new multiVoiceAudioService_1.MultiVoiceAudioService();
        if (!this.elevenLabsApiKey) {
            console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
        }
    }
    /**
     * Main audio conversion method - now supports multi-voice generation
     */
    async convertToAudio(input) {
        // Delegate to the multi-voice service which handles both single and multi-voice scenarios
        return await this.multiVoiceService.convertToAudio(input);
    }
    // Legacy methods maintained for backward compatibility
    async callElevenLabsAPI(text, input) {
        if (!this.elevenLabsApiKey) {
            return this.generateMockAudioData(text);
        }
        const voiceId = this.voiceIds[input.voice || 'female'];
        try {
            const response = await axios_1.default.post(`${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`, {
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8,
                    style: 0.5,
                    use_speaker_boost: true
                }
            }, {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            console.error('ElevenLabs API error:', error.response?.data || error.message);
            throw error;
        }
    }
    async uploadAudioToStorage(audioData, input) {
        const filename = `story-${input.storyId}-audio.${input.format || 'mp3'}`;
        await new Promise(resolve => setTimeout(resolve, 500));
        return `https://storage.example.com/audio/${filename}`;
    }
    cleanHtmlForTTS(htmlContent) {
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
    estimateDuration(text) {
        const wordsPerSecond = 2.5;
        const wordCount = text.split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerSecond);
    }
    generateMockAudioData(text) {
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
    generateAudioId() {
        return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.AudioService = AudioService;
