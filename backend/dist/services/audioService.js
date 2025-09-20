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
            // Basic voices (backwards compatibility)
            female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
            male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
            neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM', // Rachel
            // Character-specific voices for multi-voice narratives
            vampire_male: process.env.ELEVENLABS_VOICE_VAMPIRE_MALE || 'ErXwobaYiN019PkySvjV', // Antoni (deep, seductive)
            vampire_female: process.env.ELEVENLABS_VOICE_VAMPIRE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella (alluring)
            werewolf_male: process.env.ELEVENLABS_VOICE_WEREWOLF_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam (rough, powerful)
            werewolf_female: process.env.ELEVENLABS_VOICE_WEREWOLF_FEMALE || 'AZnzlk1XvdvUeBnXmlld', // Domi (strong, wild)
            fairy_male: process.env.ELEVENLABS_VOICE_FAIRY_MALE || 'VR6AewLTigWG4xSOukaG', // Josh (light, ethereal)
            fairy_female: process.env.ELEVENLABS_VOICE_FAIRY_FEMALE || 'jsCqWAovK2LkecY7zXl4', // Freya (magical, delicate)
            human_male: process.env.ELEVENLABS_VOICE_HUMAN_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam (natural, warm)
            human_female: process.env.ELEVENLABS_VOICE_HUMAN_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella (natural, warm)
            narrator: process.env.ELEVENLABS_VOICE_NARRATOR || '21m00Tcm4TlvDq8ikWAM' // Rachel (neutral, storytelling)
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
            // Check if content has speaker tags for multi-voice processing
            const hasSpeakerTags = this.hasSpeakerTags(cleanText);
            let audioData;
            if (hasSpeakerTags) {
                // Use multi-voice processing
                try {
                    audioData = await this.generateMultiVoiceAudio(cleanText, input);
                }
                catch (multiVoiceError) {
                    console.warn('Multi-voice generation failed, falling back to single voice:', multiVoiceError);
                    // Fallback to single voice
                    audioData = await this.callElevenLabsAPI(cleanText, input);
                }
            }
            else {
                // Use single voice processing
                audioData = await this.callElevenLabsAPI(cleanText, input);
            }
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
    async callElevenLabsAPI(text, input, voiceOverride) {
        if (!this.elevenLabsApiKey) {
            // Return mock audio data if no API key
            return this.generateMockAudioData(text);
        }
        // Use voice override if provided, otherwise fall back to input voice or default
        const voiceKey = voiceOverride || input.voice || 'female';
        let voiceId = this.voiceIds[voiceKey];
        if (!voiceId) {
            console.warn(`Voice ID not found for ${voiceKey}, using default female voice`);
            voiceId = this.voiceIds['female'];
        }
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
    // ==================== MULTI-VOICE PROCESSING METHODS ====================
    hasSpeakerTags(text) {
        // Check if text contains speaker tags in format [Speaker]: or [Speaker, emotion]:
        return /\[([^\]]+)\]:\s*/.test(text);
    }
    async generateMultiVoiceAudio(text, input) {
        const audioChunks = await this.parseAndAssignVoices(text, input);
        if (audioChunks.length === 0) {
            throw new Error('No audio chunks generated from multi-voice processing');
        }
        if (audioChunks.length === 1) {
            return audioChunks[0].audioData;
        }
        // Merge multiple audio chunks into single output
        return this.mergeAudioChunks(audioChunks);
    }
    async parseAndAssignVoices(text, input) {
        const chunks = [];
        // Split text by speaker tags while preserving the tags
        const segments = text.split(/(\[([^\]]+)\]:\s*)/);
        let currentSpeaker = 'Narrator';
        let currentVoice = 'narrator';
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i].trim();
            if (!segment)
                continue;
            // Check if this segment is a speaker tag
            const speakerMatch = segment.match(/\[([^\]]+)\]:\s*/);
            if (speakerMatch) {
                // This is a speaker tag - update current speaker and voice
                const speakerInfo = speakerMatch[1];
                currentSpeaker = speakerInfo.split(',')[0].trim(); // Remove emotion if present
                currentVoice = this.assignVoiceToSpeaker(currentSpeaker);
            }
            else if (segment.length > 0) {
                // This is dialogue or narrative text
                try {
                    const audioData = await this.callElevenLabsAPI(segment, input, currentVoice);
                    chunks.push({
                        speaker: currentSpeaker,
                        text: segment,
                        voice: currentVoice,
                        audioData: audioData
                    });
                }
                catch (error) {
                    console.warn(`Failed to generate audio for ${currentSpeaker}: ${error}`);
                    // Continue with other chunks rather than failing completely
                }
            }
        }
        return chunks;
    }
    assignVoiceToSpeaker(speakerName) {
        const lowerName = speakerName.toLowerCase();
        // Handle narrator specifically
        if (lowerName.includes('narrator')) {
            return 'narrator';
        }
        // Infer gender from name patterns (basic implementation)
        const isFemale = this.inferGenderFromName(speakerName);
        // Detect character type from name patterns
        const characterType = this.detectCharacterType(speakerName);
        // Build voice key
        const voiceKey = `${characterType}_${isFemale ? 'female' : 'male'}`;
        // Ensure the voice exists in our mapping
        if (this.voiceIds[voiceKey]) {
            return voiceKey;
        }
        // Fallback to human voices
        return isFemale ? 'human_female' : 'human_male';
    }
    detectCharacterType(speakerName) {
        const lowerName = speakerName.toLowerCase();
        // Look for creature type indicators in the name
        if (lowerName.includes('vampire') || lowerName.includes('vamp') || lowerName.includes('lord') || lowerName.includes('count')) {
            return 'vampire';
        }
        if (lowerName.includes('werewolf') || lowerName.includes('wolf') || lowerName.includes('lycan') || lowerName.includes('alpha')) {
            return 'werewolf';
        }
        if (lowerName.includes('fairy') || lowerName.includes('fae') || lowerName.includes('sprite') || lowerName.includes('pixie')) {
            return 'fairy';
        }
        // Default to human for unrecognized types
        return 'human';
    }
    inferGenderFromName(name) {
        const lowerName = name.toLowerCase();
        // Common female name patterns and indicators
        const femaleIndicators = [
            'lady', 'queen', 'princess', 'duchess', 'miss', 'mrs', 'ms',
            'sarah', 'emma', 'olivia', 'ava', 'isabella', 'sophia', 'mia',
            'charlotte', 'amelia', 'harper', 'evelyn', 'abigail', 'emily',
            'elizabeth', 'mila', 'ella', 'avery', 'sofia', 'camila', 'aria',
            'scarlett', 'victoria', 'madison', 'luna', 'grace', 'chloe',
            'penelope', 'layla', 'riley', 'zoey', 'nora', 'lily', 'eleanor',
            'hanna', 'lillian', 'addison', 'aubrey', 'ellie', 'stella',
            'natalie', 'zoe', 'leah', 'hazel', 'violet', 'aurora', 'savannah',
            'audrey', 'brooklyn', 'bella', 'claire', 'skylar', 'lucia',
            'aaliyah', 'josephine', 'anna', 'leilani', 'ivy', 'everly'
        ];
        // Common male name patterns and indicators
        const maleIndicators = [
            'lord', 'king', 'prince', 'duke', 'sir', 'mr', 'count', 'baron',
            'james', 'robert', 'john', 'michael', 'david', 'william', 'richard',
            'joseph', 'thomas', 'christopher', 'charles', 'daniel', 'matthew',
            'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
            'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'jason',
            'edward', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric',
            'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin',
            'samuel', 'gregory', 'alexander', 'patrick', 'frank', 'raymond',
            'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'henry',
            'adam', 'douglas', 'nathan', 'peter', 'zachary', 'kyle', 'noah',
            'alan', 'ethan', 'jeremy', 'lionel', 'christian', 'andrew', 'elijah',
            'wayne', 'liam', 'roy', 'eugene', 'louis', 'arthur', 'sean',
            'austin', 'carl', 'harold', 'jordan', 'mason', 'owen', 'luke'
        ];
        // Check for explicit indicators
        for (const indicator of femaleIndicators) {
            if (lowerName.includes(indicator)) {
                return true;
            }
        }
        for (const indicator of maleIndicators) {
            if (lowerName.includes(indicator)) {
                return false;
            }
        }
        // Default to female if uncertain (can be adjusted based on preferences)
        return true;
    }
    mergeAudioChunks(chunks) {
        // Simple concatenation for MP3 files
        // In a real implementation, you would use audio processing libraries 
        // to properly merge audio with appropriate spacing and transitions
        let totalSize = 0;
        for (const chunk of chunks) {
            totalSize += chunk.audioData.length;
        }
        // Add small silence between chunks (simulated)
        const silenceBuffer = this.generateSilenceBuffer(500); // 500ms silence
        const totalSizeWithSilence = totalSize + (silenceBuffer.length * (chunks.length - 1));
        const mergedBuffer = Buffer.alloc(totalSizeWithSilence);
        let offset = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            chunk.audioData.copy(mergedBuffer, offset);
            offset += chunk.audioData.length;
            // Add silence between chunks (except after the last one)
            if (i < chunks.length - 1) {
                silenceBuffer.copy(mergedBuffer, offset);
                offset += silenceBuffer.length;
            }
        }
        return mergedBuffer;
    }
    generateSilenceBuffer(durationMs) {
        // Generate a small buffer of silence
        // This is a simplified implementation - in production you'd want proper audio silence
        const sampleRate = 44100;
        const samples = Math.floor((durationMs / 1000) * sampleRate * 2); // stereo
        return Buffer.alloc(samples * 2); // 16-bit samples
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
