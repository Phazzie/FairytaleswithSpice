"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const axios_1 = __importDefault(require("axios"));
class AudioService {
    constructor() {
        this.elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
        this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        // Voice IDs for different voice types (ElevenLabs voice IDs)
        this.voiceIds = {
            female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
            male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
            neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM' // Rachel
        };
        if (!this.elevenLabsApiKey) {
            console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
        }
    }
    async convertToAudio(input) {
        const startTime = Date.now();
        try {
            // Clean HTML content for text-to-speech
            const cleanText = this.cleanHtmlForTTS(input.content);
            // Generate audio using ElevenLabs
            const audioData = await this.callElevenLabsAPI(cleanText, input);
            // Upload to storage and get URL (mock implementation)
            const audioUrl = await this.uploadAudioToStorage(audioData, input);
            // Create response
            const output = {
                audioId: this.generateAudioId(),
                storyId: input.storyId,
                audioUrl: audioUrl,
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
            return {
                success: true,
                data: output,
                metadata: {
                    requestId: this.generateRequestId(),
                    processingTime: Date.now() - startTime
                }
            };
        }
        catch (error) {
            console.error('Audio conversion error:', error);
            let errorCode = 'CONVERSION_FAILED';
            let errorMessage = 'Failed to convert story to audio';
            if (error.response?.status === 429) {
                errorCode = 'AUDIO_QUOTA_EXCEEDED';
                errorMessage = 'Audio generation quota exceeded';
            }
            else if (error.response?.status === 400) {
                errorCode = 'UNSUPPORTED_CONTENT';
                errorMessage = 'Story content contains unsupported elements';
            }
            return {
                success: false,
                error: {
                    code: errorCode,
                    message: errorMessage,
                    details: error.message
                },
                metadata: {
                    requestId: this.generateRequestId(),
                    processingTime: Date.now() - startTime
                }
            };
        }
    }
    async callElevenLabsAPI(text, input) {
        if (!this.elevenLabsApiKey) {
            // Return mock audio data if no API key
            return this.generateMockAudioData(text);
        }
        const voiceId = this.voiceIds[input.voice || 'female'];
        // Detect emotions in the text and get appropriate voice settings
        const detectedEmotions = this.detectEmotion(text);
        // Use the first detected emotion for voice settings, fallback to neutral
        const primaryEmotion = detectedEmotions.length > 0 ? detectedEmotions[0].emotion : 'neutral';
        const voiceSettings = this.getEmotionalVoiceSettings(primaryEmotion);
        console.log(`🎭 Detected emotion: ${primaryEmotion} for audio generation`);
        try {
            const response = await axios_1.default.post(`${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`, {
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: voiceSettings
            }, {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                responseType: 'arraybuffer',
                timeout: 60000 // 60 seconds timeout
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            console.error('ElevenLabs API error:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Detects emotion from text containing emotion tags in format: [Character, emotion]: "dialogue"
     * Also attempts to infer emotion from context if no explicit tags are found
     */
    detectEmotion(text) {
        const emotions = [];
        // Regex to match emotion tags: [Character Name, emotion]: "dialogue"
        const emotionTagRegex = /\[([^,]+),\s*([^\]]+)\]:\s*(.+?)(?=\s*\[|$)/gi;
        let match;
        while ((match = emotionTagRegex.exec(text)) !== null) {
            const character = match[1].trim();
            const emotion = match[2].trim().toLowerCase();
            const dialogue = match[3].trim();
            // Validate emotion type
            const validEmotions = ['seductive', 'fearful', 'angry', 'passionate', 'sad', 'joyful', 'mysterious', 'neutral'];
            if (validEmotions.includes(emotion)) {
                emotions.push({ character, emotion, dialogue });
            }
            else {
                // If emotion not recognized, infer from context
                const inferredEmotion = this.inferEmotionFromContext(dialogue);
                emotions.push({ character, emotion: inferredEmotion, dialogue });
            }
        }
        // If no emotion tags found, infer emotion from general content
        if (emotions.length === 0) {
            const inferredEmotion = this.inferEmotionFromContext(text);
            emotions.push({ emotion: inferredEmotion, dialogue: text });
        }
        return emotions;
    }
    /**
     * Infers emotion from dialogue content using keyword analysis
     */
    inferEmotionFromContext(text) {
        const lowerText = text.toLowerCase();
        // Define emotion keywords
        const emotionKeywords = {
            seductive: ['seduce', 'tempt', 'allure', 'entice', 'charm', 'sultry', 'breathe', 'whisper'],
            fearful: ['fear', 'afraid', 'scared', 'terrified', 'trembling', 'shaking', 'panic', 'horror'],
            angry: ['angry', 'furious', 'rage', 'mad', 'enraged', 'livid', 'scream', 'yell', 'growl'],
            passionate: ['passionate', 'intense', 'burning', 'desire', 'love', 'heart', 'yearning'],
            sad: ['sad', 'sorrow', 'weep', 'cry', 'tears', 'melancholy', 'grief', 'mourn'],
            joyful: ['joy', 'happy', 'laugh', 'cheerful', 'delighted', 'excited', 'gleeful', 'bright'],
            mysterious: ['mysterious', 'secret', 'hidden', 'whisper', 'shadow', 'dark', 'enigmatic']
        };
        // Count emotion keyword matches
        let maxMatches = 0;
        let detectedEmotion = 'neutral';
        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                detectedEmotion = emotion;
            }
        }
        return detectedEmotion;
    }
    /**
     * Maps emotions to appropriate ElevenLabs voice settings
     */
    getEmotionalVoiceSettings(emotion) {
        const emotionSettings = {
            seductive: {
                stability: 0.3, // Lower stability for more variation
                similarity_boost: 0.9, // High similarity to maintain voice
                style: 0.8, // Higher style for sultry delivery
                use_speaker_boost: true
            },
            fearful: {
                stability: 0.1, // Very low stability for trembling effect
                similarity_boost: 0.7, // Moderate similarity
                style: 0.3, // Lower style for more natural fear
                use_speaker_boost: false
            },
            angry: {
                stability: 0.2, // Low stability for aggressive variation
                similarity_boost: 0.8, // Good similarity
                style: 0.9, // High style for emphasis
                use_speaker_boost: true
            },
            passionate: {
                stability: 0.4, // Moderate stability
                similarity_boost: 0.9, // High similarity
                style: 0.7, // High style for intensity
                use_speaker_boost: true
            },
            sad: {
                stability: 0.7, // Higher stability for consistent low energy
                similarity_boost: 0.8, // Good similarity
                style: 0.2, // Lower style for softer tone
                use_speaker_boost: false
            },
            joyful: {
                stability: 0.3, // Lower stability for energetic variation
                similarity_boost: 0.8, // Good similarity
                style: 0.6, // Moderate style for upbeat delivery
                use_speaker_boost: true
            },
            mysterious: {
                stability: 0.6, // Moderate stability
                similarity_boost: 0.9, // High similarity
                style: 0.8, // High style for dramatic effect
                use_speaker_boost: false
            },
            neutral: {
                stability: 0.5, // Default settings
                similarity_boost: 0.8,
                style: 0.5,
                use_speaker_boost: true
            }
        };
        return emotionSettings[emotion] || emotionSettings.neutral;
    }
    async uploadAudioToStorage(audioData, input) {
        // Mock storage upload - in real implementation, this would upload to S3, Cloudinary, etc.
        const filename = `story-${input.storyId}-audio.${input.format || 'mp3'}`;
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 500));
        // Return mock URL
        return `https://storage.example.com/audio/${filename}`;
    }
    cleanHtmlForTTS(htmlContent) {
        // Remove HTML tags and clean up content for text-to-speech
        let cleanText = htmlContent
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\n\s*\n/g, '\n') // Remove extra newlines
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        // Add pauses for better speech flow
        cleanText = cleanText
            .replace(/\.\s/g, '. ') // Ensure space after periods
            .replace(/\?\s/g, '? ') // Ensure space after question marks
            .replace(/\!\s/g, '! '); // Ensure space after exclamation marks
        return cleanText;
    }
    estimateDuration(text) {
        // Rough estimation: 150 words per minute = 2.5 words per second
        const wordsPerSecond = 2.5;
        const wordCount = text.split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerSecond);
    }
    generateMockAudioData(text) {
        // Generate mock audio data for testing without API
        const duration = this.estimateDuration(text);
        const sampleRate = 44100; // 44.1kHz
        const channels = 2; // Stereo
        const bitsPerSample = 16;
        const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
        // Create a simple sine wave as mock audio
        const numSamples = duration * sampleRate;
        const buffer = Buffer.alloc(numSamples * channels * (bitsPerSample / 8));
        for (let i = 0; i < numSamples; i++) {
            const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3; // 440Hz sine wave
            const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
            // Write to buffer (little-endian)
            buffer.writeInt16LE(intSample, i * 4); // Left channel
            buffer.writeInt16LE(intSample, i * 4 + 2); // Right channel
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
