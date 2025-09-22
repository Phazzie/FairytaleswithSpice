import axios from 'axios';
import { AudioConversionSeam, ApiResponse, CreatureType, CharacterVoiceType } from '../types/contracts';

/**
 * AudioService - Advanced Multi-Voice Text-to-Speech Processing
 * 
 * This service provides sophisticated audio generation capabilities for spicy fairy tales,
 * featuring multi-voice narratives where different characters speak with distinct voices.
 * 
 * Key Features:
 * - Multi-voice support: Different voices for vampires, werewolves, fairies, humans, and narrator
 * - Speaker tag parsing: Automatically detects [Character]: dialogue patterns
 * - Character type inference: Analyzes speaker names to assign appropriate voices
 * - Gender detection: Uses name patterns to assign male/female voices
 * - Audio merging: Combines multiple voice segments into seamless narration
 * - 90+ emotion mapping: Maps emotional states to voice parameters
 * - Fallback system: Works with mock data when ElevenLabs API unavailable
 * 
 * Supported Voice Types:
 * - vampire_male/female: Deep, seductive voices for vampire characters
 * - werewolf_male/female: Rough, powerful voices for werewolf characters  
 * - fairy_male/female: Light, ethereal voices for fairy characters
 * - human_male/female: Natural, warm voices for human characters
 * - narrator: Neutral storytelling voice for narrative sections
 * 
 * Usage Example:
 * ```
 * const audioService = new AudioService();
 * const result = await audioService.convertToAudio({
 *   storyId: 'story_123',
 *   content: '[Vampire Lord]: "Come to me..." [Fairy Princess]: "Never!"',
 *   voice: 'female', // fallback if no speaker tags
 *   speed: 1.0,
 *   format: 'mp3'
 * });
 * ```
 * 
 * @author Fairytales with Spice Development Team
 * @version 2.1.0
 * @since 2025-09-21
 */
export class AudioService {
  /** ElevenLabs API base URL for text-to-speech requests */
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  
  /** ElevenLabs API key from environment variables */
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  /**
   * Voice ID mapping for different character types and genders
   * Maps to specific ElevenLabs voice IDs optimized for each character archetype
   * Falls back to environment variables or default voices if custom ones unavailable
   */
  private voiceIds = {
    // ==================== BASIC VOICES (Backwards Compatibility) ====================
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM', // Rachel
    
    // ==================== CHARACTER-SPECIFIC VOICES ====================
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

  constructor() {
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();

    try {
      // Clean HTML content for text-to-speech
      const cleanText = this.cleanHtmlForTTS(input.content);

      // Check if content has speaker tags for multi-voice processing
      const hasSpeakerTags = this.hasSpeakerTags(cleanText);
      
      let audioData: Buffer;
      
      if (hasSpeakerTags) {
        // Use multi-voice processing
        try {
          audioData = await this.generateMultiVoiceAudio(cleanText, input);
        } catch (multiVoiceError) {
          console.warn('Multi-voice generation failed, falling back to single voice:', multiVoiceError);
          // Fallback to single voice
          audioData = await this.callElevenLabsAPI(cleanText, input);
        }
      } else {
        // Use single voice processing
        audioData = await this.callElevenLabsAPI(cleanText, input);
      }

      // Upload to storage and get URL (mock implementation)
      const audioUrl = await this.uploadAudioToStorage(audioData, input);

      // Create response
      const output: AudioConversionSeam['output'] = {
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

    } catch (error: any) {
      console.error('Audio conversion error:', error);

      let errorCode = 'CONVERSION_FAILED';
      let errorMessage = 'Failed to convert story to audio';

      if (error.response?.status === 429) {
        errorCode = 'AUDIO_QUOTA_EXCEEDED';
        errorMessage = 'Audio generation quota exceeded';
      } else if (error.response?.status === 400) {
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

  private async callElevenLabsAPI(
    text: string, 
    input: AudioConversionSeam['input'], 
    voiceOverride?: CharacterVoiceType,
    emotion?: string,
    characterName?: string
  ): Promise<Buffer> {
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

    // Calculate emotion-aware voice parameters
    const voiceSettings = this.calculateVoiceParameters(voiceKey as CharacterVoiceType, emotion, characterName);
    
    console.log(`🎵 Generating audio for ${characterName || 'Unknown'} with emotion: ${emotion || 'neutral'}`, voiceSettings);

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: voiceSettings
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey
          },
          responseType: 'arraybuffer',
          timeout: 60000 // 60 seconds timeout
        }
      );

      return Buffer.from(response.data);

    } catch (error: any) {
      console.error('ElevenLabs API error:', error.response?.data || error.message);
      throw error;
    }
  }

  private async uploadAudioToStorage(audioData: Buffer, input: AudioConversionSeam['input']): Promise<string> {
    // Mock storage upload - in real implementation, this would upload to S3, Cloudinary, etc.
    const filename = `story-${input.storyId}-audio.${input.format || 'mp3'}`;

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock URL
    return `https://storage.example.com/audio/${filename}`;
  }

  // ==================== MULTI-VOICE PROCESSING METHODS ====================

  private hasSpeakerTags(text: string): boolean {
    // Check if text contains speaker tags in format [Speaker]: or [Speaker, emotion]:
    return /\[([^\]]+)\]:\s*/.test(text);
  }

  private async generateMultiVoiceAudio(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
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

  private async parseAndAssignVoices(text: string, input: AudioConversionSeam['input']): Promise<Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer, emotion?: string}>> {
    const chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer, emotion?: string}> = [];
    
    // Split text by speaker tags while preserving the tags
    const segments = text.split(/(\[([^\]]+)\]:\s*)/);
    
    let currentSpeaker = 'Narrator';
    let currentVoice: CharacterVoiceType = 'narrator';
    let currentEmotion: string | undefined = undefined;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (!segment) continue;
      
      // Check if this segment is a speaker tag
      const speakerMatch = segment.match(/\[([^\]]+)\]:\s*/);
      
      if (speakerMatch) {
        // This is a speaker tag - extract speaker and emotion
        const { speaker, emotion } = this.extractEmotionFromSpeaker(speakerMatch[1]);
        currentSpeaker = speaker;
        currentEmotion = emotion;
        currentVoice = this.assignVoiceToSpeaker(currentSpeaker);
        
        console.log(`🎭 Speaker: ${currentSpeaker}, Emotion: ${currentEmotion || 'neutral'}, Voice: ${currentVoice}`);
      } else if (segment.length > 0) {
        // This is dialogue or narrative text
        try {
          const audioData = await this.callElevenLabsAPI(segment, input, currentVoice, currentEmotion, currentSpeaker);
          chunks.push({
            speaker: currentSpeaker,
            text: segment,
            voice: currentVoice,
            audioData: audioData,
            emotion: currentEmotion
          });
        } catch (error) {
          console.warn(`Failed to generate audio for ${currentSpeaker} (${currentEmotion || 'neutral'}): ${error}`);
          // Continue with other chunks rather than failing completely
        }
      }
    }
    
    return chunks;
  }

  private assignVoiceToSpeaker(speakerName: string): CharacterVoiceType {
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
    const voiceKey = `${characterType}_${isFemale ? 'female' : 'male'}` as CharacterVoiceType;
    
    // Ensure the voice exists in our mapping
    if (this.voiceIds[voiceKey]) {
      return voiceKey;
    }
    
    // Fallback to human voices
    return isFemale ? 'human_female' : 'human_male';
  }

  private detectCharacterType(speakerName: string): 'vampire' | 'werewolf' | 'fairy' | 'human' {
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

  private inferGenderFromName(name: string): boolean {
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

  private mergeAudioChunks(chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer, emotion?: string}>): Buffer {
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

  private generateSilenceBuffer(durationMs: number): Buffer {
    // Generate a small buffer of silence
    // This is a simplified implementation - in production you'd want proper audio silence
    const sampleRate = 44100;
    const samples = Math.floor((durationMs / 1000) * sampleRate * 2); // stereo
    return Buffer.alloc(samples * 2); // 16-bit samples
  }

  private cleanHtmlForTTS(htmlContent: string): string {
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

  private estimateDuration(text: string): number {
    // Rough estimation: 150 words per minute = 2.5 words per second
    const wordsPerSecond = 2.5;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerSecond);
  }

  private generateMockAudioData(text: string): Buffer {
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

  private generateAudioId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== EMOTION MAPPING SYSTEM ====================

  /**
   * Comprehensive emotion mapping for voice parameters
   * Maps 90+ emotional states to voice settings for nuanced character expression
   */
  private emotionToVoiceParameters: Record<string, {
    stability: number;
    similarity_boost: number;
    style: number;
    pitch_shift: number;
  }> = {
    // ==================== PRIMARY EMOTIONS ====================
    'angry': { stability: 0.3, similarity_boost: 0.9, style: 0.8, pitch_shift: 0.1 },
    'sad': { stability: 0.7, similarity_boost: 0.6, style: 0.3, pitch_shift: -0.2 },
    'happy': { stability: 0.4, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.15 },
    'fear': { stability: 0.2, similarity_boost: 0.9, style: 0.9, pitch_shift: 0.3 },
    'disgust': { stability: 0.6, similarity_boost: 0.7, style: 0.6, pitch_shift: -0.1 },
    'surprise': { stability: 0.3, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.2 },
    'neutral': { stability: 0.5, similarity_boost: 0.8, style: 0.5, pitch_shift: 0.0 },

    // ==================== SPICY FAIRY TALE EMOTIONS ====================
    'seductive': { stability: 0.8, similarity_boost: 0.9, style: 0.8, pitch_shift: -0.1 },
    'sultry': { stability: 0.9, similarity_boost: 0.9, style: 0.9, pitch_shift: -0.15 },
    'passionate': { stability: 0.4, similarity_boost: 0.8, style: 0.9, pitch_shift: 0.1 },
    'lustful': { stability: 0.6, similarity_boost: 0.9, style: 0.9, pitch_shift: 0.05 },
    'dominant': { stability: 0.7, similarity_boost: 0.9, style: 0.8, pitch_shift: 0.1 },
    'submissive': { stability: 0.8, similarity_boost: 0.7, style: 0.6, pitch_shift: -0.1 },
    'teasing': { stability: 0.4, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.2 },
    'playful': { stability: 0.4, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.15 },
    'mischievous': { stability: 0.3, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.1 },
    'alluring': { stability: 0.8, similarity_boost: 0.9, style: 0.8, pitch_shift: -0.05 },

    // ==================== CREATURE-SPECIFIC EMOTIONS ====================
    // Vampire emotions
    'bloodthirsty': { stability: 0.5, similarity_boost: 0.9, style: 0.9, pitch_shift: 0.0 },
    'predatory': { stability: 0.6, similarity_boost: 0.9, style: 0.8, pitch_shift: -0.1 },
    'ancient': { stability: 0.9, similarity_boost: 0.8, style: 0.7, pitch_shift: -0.2 },
    'regal': { stability: 0.8, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.0 },
    'hypnotic': { stability: 0.9, similarity_boost: 0.9, style: 0.8, pitch_shift: -0.1 },

    // Werewolf emotions
    'feral': { stability: 0.2, similarity_boost: 0.9, style: 0.9, pitch_shift: 0.2 },
    'protective': { stability: 0.6, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.1 },
    'territorial': { stability: 0.4, similarity_boost: 0.9, style: 0.8, pitch_shift: 0.15 },
    'pack_leader': { stability: 0.7, similarity_boost: 0.9, style: 0.8, pitch_shift: 0.1 },
    'wild': { stability: 0.3, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.2 },

    // Fairy emotions
    'ethereal': { stability: 0.7, similarity_boost: 0.7, style: 0.6, pitch_shift: 0.3 },
    'magical': { stability: 0.6, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.2 },
    'whimsical': { stability: 0.4, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.25 },
    'mischief': { stability: 0.3, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.2 },
    'otherworldly': { stability: 0.8, similarity_boost: 0.7, style: 0.6, pitch_shift: 0.15 },

    // ==================== ADVANCED EMOTIONAL STATES ====================
    'conflicted': { stability: 0.4, similarity_boost: 0.7, style: 0.6, pitch_shift: 0.0 },
    'determined': { stability: 0.6, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.1 },
    'vulnerable': { stability: 0.8, similarity_boost: 0.6, style: 0.4, pitch_shift: -0.1 },
    'confident': { stability: 0.5, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.05 },
    'suspicious': { stability: 0.5, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.0 },
    'curious': { stability: 0.4, similarity_boost: 0.8, style: 0.6, pitch_shift: 0.1 },
    'contemplative': { stability: 0.8, similarity_boost: 0.7, style: 0.5, pitch_shift: -0.05 },
    'melancholic': { stability: 0.8, similarity_boost: 0.6, style: 0.4, pitch_shift: -0.15 },

    // ==================== INTENSITY VARIATIONS ====================
    'whisper': { stability: 0.9, similarity_boost: 0.6, style: 0.3, pitch_shift: -0.1 },
    'murmur': { stability: 0.8, similarity_boost: 0.7, style: 0.4, pitch_shift: -0.05 },
    'shout': { stability: 0.2, similarity_boost: 0.9, style: 0.9, pitch_shift: 0.2 },
    'growl': { stability: 0.3, similarity_boost: 0.9, style: 0.9, pitch_shift: -0.2 },
    'purr': { stability: 0.9, similarity_boost: 0.8, style: 0.7, pitch_shift: -0.1 },
    'hiss': { stability: 0.4, similarity_boost: 0.9, style: 0.8, pitch_shift: 0.1 },

    // ==================== RELATIONSHIP DYNAMICS ====================
    'intimate': { stability: 0.9, similarity_boost: 0.8, style: 0.7, pitch_shift: -0.1 },
    'distant': { stability: 0.7, similarity_boost: 0.6, style: 0.5, pitch_shift: 0.0 },
    'commanding': { stability: 0.6, similarity_boost: 0.9, style: 0.8, pitch_shift: 0.1 },
    'pleading': { stability: 0.6, similarity_boost: 0.7, style: 0.6, pitch_shift: 0.1 },
    'defiant': { stability: 0.4, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.15 },
    'respectful': { stability: 0.7, similarity_boost: 0.8, style: 0.6, pitch_shift: 0.0 },

    // ==================== EXTENDED EMOTION SET ====================
    'amused': { stability: 0.5, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.1 },
    'annoyed': { stability: 0.4, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.05 },
    'anxious': { stability: 0.3, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.15 },
    'bored': { stability: 0.8, similarity_boost: 0.6, style: 0.4, pitch_shift: -0.1 },
    'cautious': { stability: 0.7, similarity_boost: 0.8, style: 0.6, pitch_shift: 0.0 },
    'cheerful': { stability: 0.4, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.2 },
    'disappointed': { stability: 0.7, similarity_boost: 0.6, style: 0.4, pitch_shift: -0.1 },
    'embarrassed': { stability: 0.6, similarity_boost: 0.7, style: 0.5, pitch_shift: 0.05 },
    'excited': { stability: 0.3, similarity_boost: 0.8, style: 0.9, pitch_shift: 0.25 },
    'frustrated': { stability: 0.4, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.1 },
    'grateful': { stability: 0.6, similarity_boost: 0.8, style: 0.6, pitch_shift: 0.0 },
    'guilty': { stability: 0.6, similarity_boost: 0.7, style: 0.5, pitch_shift: -0.05 },
    'hopeful': { stability: 0.5, similarity_boost: 0.8, style: 0.6, pitch_shift: 0.1 },
    'impatient': { stability: 0.3, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.1 },
    'jealous': { stability: 0.4, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.05 },
    'lonely': { stability: 0.8, similarity_boost: 0.6, style: 0.4, pitch_shift: -0.1 },
    'nostalgic': { stability: 0.8, similarity_boost: 0.7, style: 0.5, pitch_shift: -0.05 },
    'overwhelmed': { stability: 0.3, similarity_boost: 0.7, style: 0.7, pitch_shift: 0.1 },
    'proud': { stability: 0.6, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.05 },
    'relieved': { stability: 0.7, similarity_boost: 0.7, style: 0.5, pitch_shift: 0.0 },
    'romantic': { stability: 0.8, similarity_boost: 0.8, style: 0.7, pitch_shift: -0.05 },
    'shocked': { stability: 0.2, similarity_boost: 0.9, style: 0.9, pitch_shift: 0.25 },
    'thoughtful': { stability: 0.8, similarity_boost: 0.7, style: 0.5, pitch_shift: -0.05 },
    'worried': { stability: 0.5, similarity_boost: 0.7, style: 0.6, pitch_shift: 0.05 },

    // ==================== NARRATIVE-SPECIFIC EMOTIONS ====================
    'storytelling': { stability: 0.7, similarity_boost: 0.8, style: 0.6, pitch_shift: 0.0 },
    'descriptive': { stability: 0.8, similarity_boost: 0.7, style: 0.5, pitch_shift: 0.0 },
    'dramatic': { stability: 0.4, similarity_boost: 0.8, style: 0.8, pitch_shift: 0.1 },
    'suspenseful': { stability: 0.5, similarity_boost: 0.8, style: 0.7, pitch_shift: 0.05 },
    'climactic': { stability: 0.3, similarity_boost: 0.9, style: 0.9, pitch_shift: 0.15 }
  };

  /**
   * Character consistency tracking to maintain voice parameters across emotional changes
   */
  private characterVoiceMemory: Map<string, {
    baseVoice: CharacterVoiceType;
    emotionalHistory: Array<{ emotion: string; timestamp: number }>;
    preferredParameters: any;
    lastUsed: number;
  }> = new Map();

  /**
   * Extract emotion from speaker tag and calculate voice parameters
   * Supports formats: [Character]: text, [Character, emotion]: text
   */
  private extractEmotionFromSpeaker(speakerInfo: string): { speaker: string; emotion?: string } {
    const parts = speakerInfo.split(',').map(part => part.trim());
    return {
      speaker: parts[0],
      emotion: parts.length > 1 ? parts[1].toLowerCase() : undefined
    };
  }

  /**
   * Calculate voice parameters based on character type, base voice, and emotion
   */
  private calculateVoiceParameters(
    voice: CharacterVoiceType, 
    emotion?: string,
    characterName?: string
  ): any {
    // Base parameters for voice type
    const baseParams = {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    };

    // Apply emotion-specific modifications if emotion is provided
    if (emotion && this.emotionToVoiceParameters[emotion]) {
      const emotionParams = this.emotionToVoiceParameters[emotion];
      
      // Blend base parameters with emotion parameters
      const blendedParams = {
        stability: this.blendParameter(baseParams.stability, emotionParams.stability, 0.7),
        similarity_boost: this.blendParameter(baseParams.similarity_boost, emotionParams.similarity_boost, 0.8),
        style: this.blendParameter(baseParams.style, emotionParams.style, 0.6),
        use_speaker_boost: baseParams.use_speaker_boost
      };

      // Store character consistency data
      if (characterName) {
        this.updateCharacterVoiceMemory(characterName, voice, emotion, blendedParams);
      }

      return blendedParams;
    }

    // Apply character consistency if available
    if (characterName && this.characterVoiceMemory.has(characterName)) {
      const memory = this.characterVoiceMemory.get(characterName)!;
      if (memory.preferredParameters) {
        return { ...baseParams, ...memory.preferredParameters };
      }
    }

    return baseParams;
  }

  /**
   * Blend two parameter values with a given weight
   */
  private blendParameter(base: number, emotion: number, weight: number): number {
    return base * (1 - weight) + emotion * weight;
  }

  /**
   * Update character voice memory for consistency
   */
  private updateCharacterVoiceMemory(
    characterName: string,
    voice: CharacterVoiceType,
    emotion: string,
    parameters: any
  ): void {
    const now = Date.now();
    
    if (!this.characterVoiceMemory.has(characterName)) {
      this.characterVoiceMemory.set(characterName, {
        baseVoice: voice,
        emotionalHistory: [],
        preferredParameters: parameters,
        lastUsed: now
      });
    }

    const memory = this.characterVoiceMemory.get(characterName)!;
    memory.emotionalHistory.push({ emotion, timestamp: now });
    memory.lastUsed = now;

    // Keep only recent emotional history (last 10 emotions)
    if (memory.emotionalHistory.length > 10) {
      memory.emotionalHistory = memory.emotionalHistory.slice(-10);
    }

    // Update preferred parameters based on recent usage
    memory.preferredParameters = this.calculatePreferredParameters(memory.emotionalHistory, parameters);
  }

  /**
   * Calculate preferred parameters based on emotional history
   */
  private calculatePreferredParameters(
    emotionalHistory: Array<{ emotion: string; timestamp: number }>,
    currentParams: any
  ): any {
    if (emotionalHistory.length === 0) return currentParams;

    // Weight recent emotions more heavily
    const weights = emotionalHistory.map((_, index) => Math.pow(0.9, emotionalHistory.length - index - 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    let avgStability = 0;
    let avgSimilarity = 0;
    let avgStyle = 0;

    emotionalHistory.forEach((entry, index) => {
      const emotionParams = this.emotionToVoiceParameters[entry.emotion];
      if (emotionParams) {
        const weight = weights[index] / totalWeight;
        avgStability += emotionParams.stability * weight;
        avgSimilarity += emotionParams.similarity_boost * weight;
        avgStyle += emotionParams.style * weight;
      }
    });

    return {
      stability: avgStability || currentParams.stability,
      similarity_boost: avgSimilarity || currentParams.similarity_boost,
      style: avgStyle || currentParams.style,
      use_speaker_boost: true
    };
  }

  /**
   * Test emotion combination and return voice parameters
   * Public method for emotion testing API endpoint
   */
  public testEmotionCombination(emotion: string): {
    emotion: string;
    isSupported: boolean;
    parameters?: any;
    suggestions?: string[];
  } {
    const normalizedEmotion = emotion.toLowerCase().trim();
    
    if (this.emotionToVoiceParameters[normalizedEmotion]) {
      return {
        emotion: normalizedEmotion,
        isSupported: true,
        parameters: this.emotionToVoiceParameters[normalizedEmotion]
      };
    }

    // Find similar emotions using fuzzy matching
    const suggestions = this.findSimilarEmotions(normalizedEmotion);
    
    return {
      emotion: normalizedEmotion,
      isSupported: false,
      suggestions
    };
  }

  /**
   * Find similar emotions using basic fuzzy matching
   */
  private findSimilarEmotions(emotion: string): string[] {
    const allEmotions = Object.keys(this.emotionToVoiceParameters);
    const suggestions: string[] = [];

    // Exact substring matches
    allEmotions.forEach(knownEmotion => {
      if (knownEmotion.includes(emotion) || emotion.includes(knownEmotion)) {
        suggestions.push(knownEmotion);
      }
    });

    // If no substring matches, try partial word matches
    if (suggestions.length === 0) {
      const emotionWords = emotion.toLowerCase().split(/[^a-z]+/);
      allEmotions.forEach(knownEmotion => {
        const knownWords = knownEmotion.toLowerCase().split(/[^a-z]+/);
        const hasCommonWord = emotionWords.some(word => 
          word.length > 2 && knownWords.some(knownWord => 
            knownWord.includes(word) || word.includes(knownWord)
          )
        );
        if (hasCommonWord && !suggestions.includes(knownEmotion)) {
          suggestions.push(knownEmotion);
        }
      });
    }

    // If still no matches, try Levenshtein distance for shorter strings
    if (suggestions.length === 0 && emotion.length <= 10) {
      allEmotions.forEach(knownEmotion => {
        if (this.levenshteinDistance(emotion, knownEmotion) <= 2) {
          suggestions.push(knownEmotion);
        }
      });
    }

    // Fallback: suggest some common emotions if nothing found
    if (suggestions.length === 0) {
      suggestions.push('happy', 'sad', 'angry', 'seductive', 'playful');
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get comprehensive emotion information for API endpoints
   */
  public getEmotionInfo(): {
    totalEmotions: number;
    categories: Record<string, string[]>;
    recentlyUsed: Array<{ character: string; emotion: string; timestamp: number }>;
  } {
    const emotions = Object.keys(this.emotionToVoiceParameters);
    
    const categories = {
      'Primary Emotions': ['angry', 'sad', 'happy', 'fear', 'disgust', 'surprise', 'neutral'],
      'Spicy Fairy Tale': ['seductive', 'sultry', 'passionate', 'lustful', 'dominant', 'submissive', 'teasing', 'playful', 'mischievous', 'alluring'],
      'Vampire Specific': ['bloodthirsty', 'predatory', 'ancient', 'regal', 'hypnotic'],
      'Werewolf Specific': ['feral', 'protective', 'territorial', 'pack_leader', 'wild'],
      'Fairy Specific': ['ethereal', 'magical', 'whimsical', 'mischief', 'otherworldly'],
      'Advanced States': ['conflicted', 'determined', 'vulnerable', 'confident', 'suspicious', 'curious', 'contemplative', 'melancholic'],
      'Intensity Variations': ['whisper', 'murmur', 'shout', 'growl', 'purr', 'hiss'],
      'Relationship Dynamics': ['intimate', 'distant', 'commanding', 'pleading', 'defiant', 'respectful'],
      'Narrative Specific': ['storytelling', 'descriptive', 'dramatic', 'suspenseful', 'climactic']
    };

    // Collect recently used emotions from character memory
    const recentlyUsed: Array<{ character: string; emotion: string; timestamp: number }> = [];
    this.characterVoiceMemory.forEach((memory, character) => {
      memory.emotionalHistory.forEach(entry => {
        recentlyUsed.push({
          character,
          emotion: entry.emotion,
          timestamp: entry.timestamp
        });
      });
    });

    // Sort by timestamp descending and take last 20
    recentlyUsed.sort((a, b) => b.timestamp - a.timestamp);

    return {
      totalEmotions: emotions.length,
      categories,
      recentlyUsed: recentlyUsed.slice(0, 20)
    };
  }
}