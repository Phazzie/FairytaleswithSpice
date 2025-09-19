"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const axios_1 = __importDefault(require("axios"));
const dialogueParser_1 = require("./dialogueParser");
class AudioService {
    constructor() {
        this.elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
        this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        this.dialogueParser = new dialogueParser_1.DialogueParser();
        // Enhanced voice IDs for character-specific voices (11Labs voice IDs)
        this.characterVoiceIds = {
            // Vampire voices - deep, seductive
            vampire_male: process.env.ELEVENLABS_VOICE_VAMPIRE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam (deep male)
            vampire_female: process.env.ELEVENLABS_VOICE_VAMPIRE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella (seductive female)
            // Werewolf voices - gruff, powerful
            werewolf_male: process.env.ELEVENLABS_VOICE_WEREWOLF_MALE || 'pqHfZKP75CvOlQylNhV4', // Bill (gruff male)
            werewolf_female: process.env.ELEVENLABS_VOICE_WEREWOLF_FEMALE || 'XrExE9yKIg1WjnnlVkGX', // Matilda (strong female)
            // Fairy voices - ethereal, mystical  
            fairy_male: process.env.ELEVENLABS_VOICE_FAIRY_MALE || 'AZnzlk1XvdvUeBnXmlld', // Domi (ethereal male)
            fairy_female: process.env.ELEVENLABS_VOICE_FAIRY_FEMALE || 'ThT5KcBeYPX3keUQqHPh', // Dorothy (mystical female)
            // Human voices - relatable, emotional
            human_male: process.env.ELEVENLABS_VOICE_HUMAN_MALE || 'yoZ06aMxZJJ28mfd3POQ', // Sam (relatable male)
            human_female: process.env.ELEVENLABS_VOICE_HUMAN_FEMALE || 'TxGEqnHWrfWFTfGW9XjX', // Josh (emotional female)
            // Narrator voice - clear, authoritative
            narrator: process.env.ELEVENLABS_VOICE_NARRATOR || '21m00Tcm4TlvDq8ikWAM' // Rachel (clear narrator)
        };
        // Legacy voice IDs for backward compatibility
        this.voiceIds = {
            female: this.characterVoiceIds.human_female,
            male: this.characterVoiceIds.human_male,
            neutral: this.characterVoiceIds.narrator
        };
        if (!this.elevenLabsApiKey) {
            console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
        }
    }
    async convertToAudio(input) {
        const startTime = Date.now();
        try {
            // Determine if multi-voice generation should be used
            const enableMultiVoice = input.enableMultiVoice !== false; // Default to true
            if (enableMultiVoice) {
                return await this.generateMultiVoiceAudio(input, startTime);
            }
            else {
                return await this.generateSingleVoiceAudio(input, startTime);
            }
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
    /**
     * Generate multi-voice audio from dialogue segments
     */
    async generateMultiVoiceAudio(input, startTime) {
        // Parse dialogue segments from story content
        const dialogueSegments = this.dialogueParser.parseStoryDialogue(input.content, input.creatureType);
        if (dialogueSegments.length === 0) {
            // Fall back to single voice if no dialogue found
            return await this.generateSingleVoiceAudio(input, startTime);
        }
        // Generate audio segments for each dialogue piece
        const audioSegments = [];
        let currentProgress = 0;
        for (let i = 0; i < dialogueSegments.length; i++) {
            const segment = dialogueSegments[i];
            // Update progress
            currentProgress = Math.floor((i / dialogueSegments.length) * 80); // Leave 20% for compilation
            try {
                // Generate audio for this segment
                const audioData = await this.generateSegmentAudio(segment, input);
                // Store segment with audio data
                const processedSegment = {
                    ...segment,
                    audioUrl: await this.uploadAudioSegment(audioData, segment, input),
                    duration: this.estimateSegmentDuration(segment.text)
                };
                audioSegments.push(processedSegment);
            }
            catch (segmentError) {
                console.error(`Failed to generate audio for segment ${i}:`, segmentError);
                // Continue with other segments, mark this one as failed
                audioSegments.push({
                    ...segment,
                    audioUrl: undefined,
                    duration: this.estimateSegmentDuration(segment.text)
                });
            }
        }
        // Compile segments into final audio file
        const compiledAudioUrl = await this.compileAudioSegments(audioSegments, input);
        const totalDuration = this.dialogueParser.estimateAudioDuration(audioSegments, input.speed || 1.0);
        const characterVoices = this.dialogueParser.getCharacterVoiceMapping(audioSegments);
        // Create response
        const output = {
            audioId: this.generateAudioId(),
            storyId: input.storyId,
            audioUrl: compiledAudioUrl,
            duration: totalDuration,
            fileSize: this.estimateFileSize(totalDuration),
            format: input.format || 'mp3',
            voice: input.voice || 'female',
            speed: input.speed || 1.0,
            progress: {
                percentage: 100,
                status: 'completed',
                message: 'Multi-voice audio generation completed successfully',
                estimatedTimeRemaining: 0,
                currentSegment: audioSegments.length,
                totalSegments: audioSegments.length
            },
            completedAt: new Date(),
            isMultiVoice: true,
            dialogueSegments: audioSegments,
            characterVoices: characterVoices,
            segmentCount: audioSegments.length
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
    /**
     * Generate single voice audio (legacy mode)
     */
    async generateSingleVoiceAudio(input, startTime) {
        // Clean HTML content for text-to-speech
        const cleanText = this.cleanHtmlForTTS(input.content);
        // Generate audio using ElevenLabs
        const audioData = await this.callElevenLabsAPI(cleanText, input);
        // Upload to storage and get URL
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
            completedAt: new Date(),
            isMultiVoice: false
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
    /**
     * Generate audio for a specific dialogue segment using character-specific voice
     */
    async generateSegmentAudio(segment, input) {
        if (!this.elevenLabsApiKey) {
            return this.generateMockAudioData(segment.text);
        }
        const voiceId = this.characterVoiceIds[segment.voiceType];
        const voiceSettings = this.getVoiceSettings(segment.voiceType, segment.emotion);
        try {
            const response = await axios_1.default.post(`${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`, {
                text: segment.text,
                model_id: 'eleven_multilingual_v2', // Using v2 for better quality
                voice_settings: voiceSettings
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
            console.error(`ElevenLabs API error for ${segment.speaker}:`, error.response?.data || error.message);
            // Fallback to default voice if character voice fails
            return await this.generateFallbackAudio(segment.text, input);
        }
    }
    /**
     * Get voice settings based on character type and emotion
     */
    getVoiceSettings(voiceType, emotion) {
        const baseSettings = {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.5,
            use_speaker_boost: true
        };
        // Adjust settings based on character type
        switch (voiceType) {
            case 'vampire_male':
            case 'vampire_female':
                return {
                    ...baseSettings,
                    stability: 0.7, // More stable for seductive delivery
                    style: 0.8 // Higher style for dramatic effect
                };
            case 'werewolf_male':
            case 'werewolf_female':
                return {
                    ...baseSettings,
                    stability: 0.4, // Less stable for gruff delivery
                    similarity_boost: 0.9 // Higher boost for powerful voice
                };
            case 'fairy_male':
            case 'fairy_female':
                return {
                    ...baseSettings,
                    stability: 0.6,
                    style: 0.7 // Mystical delivery
                };
            case 'narrator':
                return {
                    ...baseSettings,
                    stability: 0.8, // Very stable for clear narration
                    style: 0.3 // Lower style for neutral delivery
                };
            default:
                return baseSettings;
        }
    }
    /**
     * Generate fallback audio using default voice
     */
    async generateFallbackAudio(text, input) {
        const fallbackVoiceId = this.voiceIds[input.voice || 'female'];
        try {
            const response = await axios_1.default.post(`${this.elevenLabsApiUrl}/text-to-speech/${fallbackVoiceId}`, {
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
            // Final fallback to mock data
            return this.generateMockAudioData(text);
        }
    }
    /**
     * Upload individual audio segment to storage
     */
    async uploadAudioSegment(audioData, segment, input) {
        const filename = `story-${input.storyId}-segment-${segment.speaker}-${Date.now()}.${input.format || 'mp3'}`;
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 200));
        return `https://storage.example.com/audio/segments/${filename}`;
    }
    /**
     * Compile audio segments into final multi-voice audio file
     */
    async compileAudioSegments(segments, input) {
        // In a real implementation, this would use audio processing libraries like FFmpeg
        // to concatenate audio segments with appropriate timing and transitions
        const filename = `story-${input.storyId}-multivoice.${input.format || 'mp3'}`;
        // Simulate compilation time based on segment count
        const compilationTime = Math.min(segments.length * 100, 2000);
        await new Promise(resolve => setTimeout(resolve, compilationTime));
        return `https://storage.example.com/audio/compiled/${filename}`;
    }
    /**
     * Estimate duration for a text segment
     */
    estimateSegmentDuration(text) {
        const wordsPerSecond = 2.5;
        const wordCount = text.split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerSecond);
    }
    /**
     * Estimate file size based on duration
     */
    estimateFileSize(durationSeconds) {
        // MP3 at 128kbps = ~16KB per second
        return Math.ceil(durationSeconds * 16 * 1024);
    }
    /**
     * Legacy API call for single voice generation
     */
    async callElevenLabsAPI(text, input) {
        if (!this.elevenLabsApiKey) {
            // Return mock audio data if no API key
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
                timeout: 60000 // 60 seconds timeout
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            console.error('ElevenLabs API error:', error.response?.data || error.message);
            throw error;
        }
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
