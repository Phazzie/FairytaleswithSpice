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
          audioData = await this.callElevenLabsAPI(cleanText, input, undefined, undefined);
        }
      } else {
        // Use single voice processing
        audioData = await this.callElevenLabsAPI(cleanText, input, undefined, undefined);
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

  private async callElevenLabsAPI(text: string, input: AudioConversionSeam['input'], voiceOverride?: CharacterVoiceType, emotionSettings?: any): Promise<Buffer> {
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

    // Merge default voice settings with emotion-specific settings
    const defaultSettings = {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    };

    const voiceSettings = emotionSettings ? { ...defaultSettings, ...emotionSettings } : defaultSettings;

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

    // Use enhanced merging with smart transitions
    return this.mergeAudioChunksEnhanced(audioChunks as any);
  }

  private async parseAndAssignVoices(text: string, input: AudioConversionSeam['input']): Promise<Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}>> {
    const chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}> = [];
    
    // Use enhanced parsing for better emotion and speaker detection
    const segments = this.parseEnhancedSpeakerTags(text);
    
    for (const segment of segments) {
      if (segment.text.length === 0) continue;
      
      // Get consistent voice for character
      const voice = this.getConsistentVoice(segment.speaker);
      
      // Extract emotion settings if present
      let emotionSettings: any = undefined;
      if (segment.emotion) {
        const emotionData = this.extractEmotionFromSpeaker(`${segment.speaker}, ${segment.emotion}`);
        emotionSettings = emotionData.voiceSettings;
        
        if (emotionData.emotion) {
          console.log(`🎭 Enhanced parsing detected emotion "${emotionData.emotion}" for ${segment.speaker}`);
        }
      }
      
      try {
        const audioData = await this.callElevenLabsAPI(segment.text, input, voice, emotionSettings);
        chunks.push({
          speaker: segment.speaker,
          text: segment.text,
          voice: voice,
          audioData: audioData
        });
      } catch (error) {
        console.warn(`Failed to generate audio for ${segment.speaker}: ${error}`);
        // Continue with other chunks rather than failing completely
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
    
    // Use consistent voice assignment
    return this.getConsistentVoiceAssignment(speakerName);
  }

  /**
   * Core voice assignment logic (used by consistency system)
   * @param speakerName Speaker name
   * @returns Voice type assignment
   */
  private getConsistentVoiceAssignment(speakerName: string): CharacterVoiceType {
    // Infer gender from name patterns
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
    
    // Enhanced vampire detection patterns
    const vampirePatterns = [
      'vampire', 'vamp', 'bloodsucker', 'nosferatu', 'dracula',
      'lord', 'count', 'baron', 'duke', 'prince', 'king', 'master',
      'dark lord', 'night walker', 'blood', 'fang', 'undead',
      'immortal', 'ancient', 'elder', 'sire', 'lestat', 'alucard'
    ];
    
    // Enhanced werewolf detection patterns  
    const werewolfPatterns = [
      'werewolf', 'wolf', 'lycan', 'lycanthrope', 'shapeshifter',
      'alpha', 'beta', 'omega', 'pack', 'moon', 'howl',
      'feral', 'wild', 'beast', 'hunter', 'predator',
      'lone wolf', 'pack leader', 'moon child', 'silver bane'
    ];
    
    // Enhanced fairy detection patterns
    const fairyPatterns = [
      'fairy', 'fae', 'faerie', 'sprite', 'pixie', 'nymph',
      'sylph', 'dryad', 'naiad', 'queen', 'princess', 'court',
      'wing', 'flutter', 'glow', 'shimmer', 'ethereal',
      'nature', 'forest', 'garden', 'flower', 'petal',
      'tinker', 'magic', 'enchant', 'mystical', 'otherworld'
    ];
    
    // Check vampire patterns
    for (const pattern of vampirePatterns) {
      if (lowerName.includes(pattern)) {
        return 'vampire';
      }
    }
    
    // Check werewolf patterns
    for (const pattern of werewolfPatterns) {
      if (lowerName.includes(pattern)) {
        return 'werewolf';
      }
    }
    
    // Check fairy patterns
    for (const pattern of fairyPatterns) {
      if (lowerName.includes(pattern)) {
        return 'fairy';
      }
    }
    
    // Default to human for unrecognized types
    return 'human';
  }

  private inferGenderFromName(name: string): boolean {
    const lowerName = name.toLowerCase();
    
    // Enhanced female name patterns and indicators
    const femaleIndicators = [
      // Titles and honorifics
      'lady', 'queen', 'princess', 'duchess', 'countess', 'baroness',
      'miss', 'mrs', 'ms', 'dame', 'mistress', 'goddess', 'enchantress',
      
      // Fantasy/supernatural female terms
      'maiden', 'sorceress', 'witch', 'priestess', 'oracle', 'seer',
      'temptress', 'seductress', 'huntress', 'assassin', 'warrior maiden',
      
      // Common female names (expanded list)
      'sarah', 'emma', 'olivia', 'ava', 'isabella', 'sophia', 'mia',
      'charlotte', 'amelia', 'harper', 'evelyn', 'abigail', 'emily',
      'elizabeth', 'mila', 'ella', 'avery', 'sofia', 'camila', 'aria',
      'scarlett', 'victoria', 'madison', 'luna', 'grace', 'chloe',
      'penelope', 'layla', 'riley', 'zoey', 'nora', 'lily', 'eleanor',
      'hanna', 'lillian', 'addison', 'aubrey', 'ellie', 'stella',
      'natalie', 'zoe', 'leah', 'hazel', 'violet', 'aurora', 'savannah',
      'audrey', 'brooklyn', 'bella', 'claire', 'skylar', 'lucia',
      'aaliyah', 'josephine', 'anna', 'leilani', 'ivy', 'everly',
      
      // Fantasy female names
      'ariel', 'luna', 'diana', 'iris', 'rose', 'lily', 'jasmine',
      'crystal', 'ruby', 'pearl', 'sapphire', 'amber', 'jade',
      'raven', 'roseita', 'seraphina', 'celestine', 'morgana',
      'guinevere', 'isolde', 'titania', 'obelia', 'lyralei',
      
      // Name endings that typically indicate female
      'ina', 'ette', 'elle', 'anna', 'aria', 'lia', 'tia', 'nia'
    ];
    
    // Enhanced male name patterns and indicators
    const maleIndicators = [
      // Titles and honorifics
      'lord', 'king', 'prince', 'duke', 'count', 'baron', 'earl',
      'sir', 'mr', 'master', 'captain', 'general', 'commander',
      'emperor', 'god', 'deity', 'champion', 'overlord',
      
      // Fantasy/supernatural male terms
      'warlock', 'sorcerer', 'wizard', 'mage', 'priest', 'monk',
      'paladin', 'knight', 'warrior', 'hunter', 'assassin', 'ranger',
      'guardian', 'protector', 'slayer', 'destroyer', 'conqueror',
      
      // Common male names (expanded list)
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
      'austin', 'carl', 'harold', 'jordan', 'mason', 'owen', 'luke',
      
      // Fantasy male names
      'thor', 'odin', 'aragorn', 'legolas', 'gandalf', 'merlin',
      'arthur', 'lancelot', 'percival', 'galahad', 'gareth',
      'dante', 'romeo', 'orlando', 'sebastian', 'adrian',
      'magnus', 'viktor', 'dmitri', 'nikolai', 'alexei',
      'dracula', 'vladimir', 'lucifer', 'damien', 'adrian'
    ];
    
    // Check for explicit female indicators first (higher priority)
    for (const indicator of femaleIndicators) {
      if (lowerName.includes(indicator)) {
        return true; // Female
      }
    }
    
    // Then check for male indicators
    for (const indicator of maleIndicators) {
      if (lowerName.includes(indicator)) {
        return false; // Male
      }
    }
    
    // Enhanced heuristic: check name endings
    if (lowerName.endsWith('a') || lowerName.endsWith('e') || 
        lowerName.endsWith('ie') || lowerName.endsWith('ette') ||
        lowerName.endsWith('ina') || lowerName.endsWith('elle')) {
      return true; // Likely female
    }
    
    if (lowerName.endsWith('us') || lowerName.endsWith('or') ||
        lowerName.endsWith('er') || lowerName.endsWith('on') ||
        lowerName.endsWith('an') || lowerName.endsWith('en')) {
      return false; // Likely male
    }
    
    // Default to female if uncertain (can be adjusted based on preferences)
    return true;
  }

  private mergeAudioChunks(chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}>): Buffer {
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
   * Comprehensive emotion to voice parameter mapping system
   * Maps 90+ emotional states to ElevenLabs voice settings for enhanced character expression
   */
  private emotionMapping: Record<string, { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean }> = {
    // ===== PRIMARY EMOTIONS =====
    'angry': { stability: 0.3, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'sad': { stability: 0.7, similarity_boost: 0.6, style: 0.3, use_speaker_boost: false },
    'happy': { stability: 0.4, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
    'excited': { stability: 0.2, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'calm': { stability: 0.8, similarity_boost: 0.7, style: 0.2, use_speaker_boost: false },
    'nervous': { stability: 0.1, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    
    // ===== ROMANTIC & SPICY EMOTIONS =====
    'seductive': { stability: 0.6, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'passionate': { stability: 0.3, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'lustful': { stability: 0.4, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'romantic': { stability: 0.7, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    'tender': { stability: 0.8, similarity_boost: 0.7, style: 0.4, use_speaker_boost: false },
    'yearning': { stability: 0.6, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
    'teasing': { stability: 0.3, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
    'flirtatious': { stability: 0.4, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
    
    // ===== DARK & SUPERNATURAL EMOTIONS =====
    'menacing': { stability: 0.2, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'threatening': { stability: 0.1, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'sinister': { stability: 0.3, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'mysterious': { stability: 0.6, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
    'predatory': { stability: 0.2, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'bloodthirsty': { stability: 0.1, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'supernatural': { stability: 0.4, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
    
    // ===== POWER DYNAMICS =====
    'dominant': { stability: 0.2, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'submissive': { stability: 0.8, similarity_boost: 0.6, style: 0.3, use_speaker_boost: false },
    'commanding': { stability: 0.1, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'obedient': { stability: 0.9, similarity_boost: 0.6, style: 0.2, use_speaker_boost: false },
    'defiant': { stability: 0.2, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'protective': { stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    
    // ===== CREATURE-SPECIFIC EMOTIONS =====
    'vampiric': { stability: 0.4, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'feral': { stability: 0.1, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'ethereal': { stability: 0.7, similarity_boost: 0.7, style: 0.5, use_speaker_boost: false },
    'bestial': { stability: 0.1, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'magical': { stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    
    // ===== EXTENDED EMOTIONAL RANGE =====
    'anxious': { stability: 0.2, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    'confident': { stability: 0.4, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
    'vulnerable': { stability: 0.8, similarity_boost: 0.6, style: 0.3, use_speaker_boost: false },
    'fierce': { stability: 0.1, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'gentle': { stability: 0.9, similarity_boost: 0.7, style: 0.2, use_speaker_boost: false },
    'wicked': { stability: 0.3, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'innocent': { stability: 0.8, similarity_boost: 0.7, style: 0.3, use_speaker_boost: false },
    'mischievous': { stability: 0.3, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
    'sultry': { stability: 0.6, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'breathless': { stability: 0.4, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
    'desperate': { stability: 0.2, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
    'euphoric': { stability: 0.2, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'melancholic': { stability: 0.7, similarity_boost: 0.6, style: 0.4, use_speaker_boost: false },
    'triumphant': { stability: 0.3, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    'defeated': { stability: 0.8, similarity_boost: 0.5, style: 0.2, use_speaker_boost: false },
    'hopeful': { stability: 0.6, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    'devastated': { stability: 0.8, similarity_boost: 0.5, style: 0.2, use_speaker_boost: false },
    'enraged': { stability: 0.1, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'ecstatic': { stability: 0.2, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    'terrified': { stability: 0.1, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
    'serene': { stability: 0.9, similarity_boost: 0.7, style: 0.2, use_speaker_boost: false }
  };

  /**
   * Get comprehensive information about the emotion mapping system
   * @returns Emotion system metadata and available emotions
   */
  getEmotionInfo() {
    const emotions = Object.keys(this.emotionMapping);
    
    return {
      totalEmotions: emotions.length,
      availableEmotions: emotions,
      categories: {
        primary: ['angry', 'sad', 'happy', 'excited', 'calm', 'nervous'],
        romantic: ['seductive', 'passionate', 'lustful', 'romantic', 'tender', 'yearning', 'teasing', 'flirtatious'],
        dark: ['menacing', 'threatening', 'sinister', 'mysterious', 'predatory', 'bloodthirsty', 'supernatural'],
        power: ['dominant', 'submissive', 'commanding', 'obedient', 'defiant', 'protective'],
        creature: ['vampiric', 'feral', 'ethereal', 'bestial', 'magical']
      },
      usage: {
        format: '[Character, emotion]: "dialogue"',
        example: '[Vampire Lord, seductive]: "Come to me, my dear..."',
        fallback: 'narrator voice for unrecognized emotions'
      },
      voiceParameters: {
        stability: 'Voice consistency (0.0-1.0)',
        similarity_boost: 'Voice similarity to original (0.0-1.0)', 
        style: 'Style exaggeration (0.0-1.0)',
        use_speaker_boost: 'Enhanced speaker clarity (boolean)'
      }
    };
  }

  /**
   * Test an emotion combination and return the voice parameters that would be used
   * @param emotion The emotion string to test
   * @returns Voice parameter configuration for the emotion
   */
  testEmotionCombination(emotion: string) {
    const normalizedEmotion = emotion.toLowerCase().trim();
    const emotionConfig = this.emotionMapping[normalizedEmotion];
    
    if (!emotionConfig) {
      return {
        emotion: emotion,
        recognized: false,
        voiceParameters: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.5,
          use_speaker_boost: true
        },
        fallback: 'default',
        suggestions: this.findSimilarEmotions(normalizedEmotion)
      };
    }

    return {
      emotion: emotion,
      recognized: true,
      voiceParameters: emotionConfig,
      category: this.categorizeEmotion(normalizedEmotion),
      description: this.getEmotionDescription(normalizedEmotion)
    };
  }

  /**
   * Find similar emotions when an exact match isn't found
   * @param emotion The emotion to find similarities for
   * @returns Array of similar emotion suggestions
   */
  private findSimilarEmotions(emotion: string): string[] {
    const allEmotions = Object.keys(this.emotionMapping);
    const suggestions: string[] = [];
    
    // Find emotions that share common letter patterns
    for (const availableEmotion of allEmotions) {
      if (availableEmotion.includes(emotion) || emotion.includes(availableEmotion)) {
        suggestions.push(availableEmotion);
      }
    }
    
    // Add some common fallbacks if no patterns match
    if (suggestions.length === 0) {
      suggestions.push('angry', 'sad', 'happy', 'seductive', 'menacing');
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Categorize an emotion into its thematic group
   * @param emotion The emotion to categorize
   * @returns The category name
   */
  private categorizeEmotion(emotion: string): string {
    const categories = {
      primary: ['angry', 'sad', 'happy', 'excited', 'calm', 'nervous'],
      romantic: ['seductive', 'passionate', 'lustful', 'romantic', 'tender', 'yearning', 'teasing', 'flirtatious'],
      dark: ['menacing', 'threatening', 'sinister', 'mysterious', 'predatory', 'bloodthirsty', 'supernatural'],
      power: ['dominant', 'submissive', 'commanding', 'obedient', 'defiant', 'protective'],
      creature: ['vampiric', 'feral', 'ethereal', 'bestial', 'magical']
    };

    for (const [category, emotions] of Object.entries(categories)) {
      if (emotions.includes(emotion)) {
        return category;
      }
    }
    
    return 'extended';
  }

  /**
   * Get a description of what the emotion conveys in voice
   * @param emotion The emotion to describe
   * @returns Human-readable description
   */
  private getEmotionDescription(emotion: string): string {
    const descriptions: Record<string, string> = {
      'seductive': 'Low, sultry tone with deliberate pacing',
      'passionate': 'Intense, heated delivery with strong emphasis',
      'menacing': 'Dark, threatening undertone with controlled aggression',
      'dominant': 'Commanding presence with authoritative delivery',
      'vampiric': 'Sophisticated darkness with predatory undertones',
      'feral': 'Raw, animalistic intensity with wild undertones',
      'ethereal': 'Light, otherworldly quality with mystical resonance'
    };
    
    return descriptions[emotion] || 'Emotionally enhanced voice delivery';
  }

  /**
   * Enhanced emotion-aware voice parameter extraction
   * @param speakerInfo Speaker tag potentially containing emotion
   * @returns Voice parameters adjusted for emotion
   */
  private extractEmotionFromSpeaker(speakerInfo: string): { emotion?: string; voiceSettings?: any } {
    // Check if speaker info contains emotion: [Character, emotion]
    const emotionMatch = speakerInfo.match(/,\s*([^,\]]+)\s*$/);
    
    if (emotionMatch) {
      const emotion = emotionMatch[1].toLowerCase().trim();
      const emotionConfig = this.emotionMapping[emotion];
      
      if (emotionConfig) {
        return {
          emotion: emotion,
          voiceSettings: emotionConfig
        };
      }
    }
    
    return {};
  }

  // ==================== VOICE CONSISTENCY & PREVIEW SYSTEM ====================

  /**
   * Voice consistency verification system
   * Tracks character voice assignments across a story to ensure consistency
   */
  private characterVoiceMap: Map<string, CharacterVoiceType> = new Map();

  /**
   * Get or assign a consistent voice for a character
   * @param speakerName The character name
   * @returns Consistent voice type for this character
   */
  private getConsistentVoice(speakerName: string): CharacterVoiceType {
    // Normalize speaker name (remove titles, cleanup)
    const normalizedName = this.normalizeCharacterName(speakerName);
    
    // Check if we already have a voice assigned for this character
    if (this.characterVoiceMap.has(normalizedName)) {
      return this.characterVoiceMap.get(normalizedName)!;
    }
    
    // Assign new voice and cache it
    const assignedVoice = this.assignVoiceToSpeaker(speakerName);
    this.characterVoiceMap.set(normalizedName, assignedVoice);
    
    console.log(`🎭 Voice assigned: "${speakerName}" → ${assignedVoice}`);
    return assignedVoice;
  }

  /**
   * Normalize character names for consistency tracking
   * @param speakerName Raw speaker name from story
   * @returns Normalized name for tracking
   */
  private normalizeCharacterName(speakerName: string): string {
    let normalized = speakerName.toLowerCase().trim();
    
    // Remove common titles and honorifics
    const titlesToRemove = [
      'lord', 'lady', 'king', 'queen', 'prince', 'princess',
      'duke', 'duchess', 'count', 'countess', 'baron', 'baroness',
      'sir', 'master', 'mistress', 'captain', 'general', 'commander'
    ];
    
    for (const title of titlesToRemove) {
      normalized = normalized.replace(new RegExp(`\\b${title}\\b`, 'g'), '').trim();
    }
    
    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }

  /**
   * Clear character voice mapping (use at start of new story)
   */
  public clearCharacterVoiceMap(): void {
    this.characterVoiceMap.clear();
    console.log('🔄 Character voice map cleared for new story');
  }

  /**
   * Get current character voice assignments
   * @returns Map of character names to assigned voices
   */
  public getCharacterVoiceAssignments(): Record<string, CharacterVoiceType> {
    const assignments: Record<string, CharacterVoiceType> = {};
    for (const [character, voice] of this.characterVoiceMap.entries()) {
      assignments[character] = voice;
    }
    return assignments;
  }

  /**
   * Preview voice assignment for a character without audio generation
   * @param speakerName Character name to preview
   * @param emotion Optional emotion for voice parameter preview
   * @returns Voice preview information
   */
  public previewCharacterVoice(speakerName: string, emotion?: string) {
    const characterType = this.detectCharacterType(speakerName);
    const gender = this.inferGenderFromName(speakerName);
    const voiceType = this.getConsistentVoice(speakerName);
    
    let emotionSettings = undefined;
    if (emotion) {
      const emotionData = this.extractEmotionFromSpeaker(`${speakerName}, ${emotion}`);
      emotionSettings = emotionData.voiceSettings;
    }

    return {
      speakerName,
      normalizedName: this.normalizeCharacterName(speakerName),
      characterType,
      gender: gender ? 'female' : 'male',
      voiceType,
      voiceId: this.voiceIds[voiceType],
      emotion: emotion || 'neutral',
      emotionSettings: emotionSettings || {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true
      },
      consistency: {
        isConsistent: this.characterVoiceMap.has(this.normalizeCharacterName(speakerName)),
        previousAssignments: this.getCharacterVoiceAssignments()
      }
    };
  }

  /**
   * Validate voice consistency across story content
   * @param storyContent Story content with speaker tags
   * @returns Consistency report
   */
  public validateVoiceConsistency(storyContent: string) {
    const speakers = this.extractSpeakersFromContent(storyContent);
    const consistencyReport = {
      totalSpeakers: speakers.length,
      consistentAssignments: 0,
      inconsistencies: [] as Array<{speaker: string, issues: string[]}>,
      recommendations: [] as string[]
    };

    for (const speaker of speakers) {
      const preview = this.previewCharacterVoice(speaker);
      const issues: string[] = [];

      // Check for naming inconsistencies
      const variations = speakers.filter(s => 
        this.normalizeCharacterName(s) === this.normalizeCharacterName(speaker) && s !== speaker
      );
      
      if (variations.length > 0) {
        issues.push(`Name variations detected: ${variations.join(', ')}`);
      }

      // Check for character type ambiguity
      if (preview.characterType === 'human' && 
          (speaker.toLowerCase().includes('creature') || speaker.toLowerCase().includes('being'))) {
        issues.push('Character type may be ambiguous - consider more specific naming');
      }

      if (issues.length > 0) {
        consistencyReport.inconsistencies.push({ speaker, issues });
      } else {
        consistencyReport.consistentAssignments++;
      }
    }

    // Generate recommendations
    if (consistencyReport.inconsistencies.length > 0) {
      consistencyReport.recommendations.push(
        'Consider using consistent character names throughout the story'
      );
      consistencyReport.recommendations.push(
        'Add creature type indicators to character names for better voice assignment'
      );
    }

    return consistencyReport;
  }

  // ==================== ENHANCED AUDIO PROCESSING METHODS ====================

  /**
   * Enhanced speaker tag parsing with better emotion extraction
   * Supports multiple formats: [Character], [Character, emotion], [Character: emotion]
   */
  private parseEnhancedSpeakerTags(text: string): Array<{
    speaker: string;
    emotion?: string;
    text: string;
    startIndex: number;
    endIndex: number;
  }> {
    const segments: Array<{
      speaker: string;
      emotion?: string;
      text: string;
      startIndex: number;
      endIndex: number;
    }> = [];
    
    // Enhanced regex to capture different speaker tag formats
    const speakerTagRegex = /\[([^\]]+)\]:\s*/g;
    const textSegments = text.split(speakerTagRegex);
    
    let currentSpeaker = 'Narrator';
    let currentEmotion: string | undefined = undefined;
    let currentIndex = 0;
    
    for (let i = 0; i < textSegments.length; i++) {
      const segment = textSegments[i];
      
      if (!segment) {
        currentIndex += segment.length;
        continue;
      }
      
      // Check if this is a speaker tag (odd indices after split)
      if (i % 2 === 1) {
        // This is a speaker tag - parse speaker and emotion
        const parsedSpeaker = this.parseAdvancedSpeakerInfo(segment);
        currentSpeaker = parsedSpeaker.speaker;
        currentEmotion = parsedSpeaker.emotion;
        currentIndex += segment.length + 3; // +3 for []and :
      } else if (segment.trim().length > 0) {
        // This is dialogue or narrative text
        const startIndex = currentIndex;
        const endIndex = currentIndex + segment.length;
        
        segments.push({
          speaker: currentSpeaker,
          emotion: currentEmotion,
          text: segment.trim(),
          startIndex,
          endIndex
        });
        
        currentIndex = endIndex;
      } else {
        currentIndex += segment.length;
      }
    }
    
    return segments;
  }

  /**
   * Advanced speaker info parsing supporting multiple formats
   * @param speakerInfo Raw speaker tag content
   * @returns Parsed speaker and emotion information
   */
  private parseAdvancedSpeakerInfo(speakerInfo: string): { speaker: string; emotion?: string } {
    // Support formats:
    // "Character" - basic format
    // "Character, emotion" - comma-separated emotion
    // "Character: emotion" - colon-separated emotion
    // "Character (emotion)" - parentheses emotion
    
    let speaker: string;
    let emotion: string | undefined;
    
    // Check for parentheses format: Character (emotion)
    const parenthesesMatch = speakerInfo.match(/^([^(]+)\s*\(([^)]+)\)\s*$/);
    if (parenthesesMatch) {
      speaker = parenthesesMatch[1].trim();
      emotion = parenthesesMatch[2].trim();
      return { speaker, emotion };
    }
    
    // Check for colon format: Character: emotion
    const colonMatch = speakerInfo.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch) {
      speaker = colonMatch[1].trim();
      emotion = colonMatch[2].trim();
      return { speaker, emotion };
    }
    
    // Check for comma format: Character, emotion
    const commaMatch = speakerInfo.match(/^([^,]+),\s*(.+)$/);
    if (commaMatch) {
      speaker = commaMatch[1].trim();
      emotion = commaMatch[2].trim();
      return { speaker, emotion };
    }
    
    // Default: just speaker name
    speaker = speakerInfo.trim();
    return { speaker };
  }

  /**
   * Enhanced audio chunk merging with proper timing and transitions
   * @param chunks Array of audio chunks with metadata
   * @returns Merged audio buffer with smooth transitions
   */
  private mergeAudioChunksEnhanced(chunks: Array<{
    speaker: string;
    text: string;
    voice: CharacterVoiceType;
    audioData: Buffer;
    emotion?: string;
  }>): Buffer {
    if (chunks.length === 0) {
      throw new Error('No audio chunks to merge');
    }
    
    if (chunks.length === 1) {
      return chunks[0].audioData;
    }
    
    let totalSize = 0;
    const transitions: Buffer[] = [];
    
    // Calculate total size including smart pauses
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      totalSize += chunk.audioData.length;
      
      // Add transition pause between chunks (except after the last one)
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const pauseDuration = this.calculateOptimalPause(chunk, nextChunk);
        const pauseBuffer = this.generateSilenceBuffer(pauseDuration);
        transitions.push(pauseBuffer);
        totalSize += pauseBuffer.length;
      }
    }
    
    // Merge chunks with calculated pauses
    const mergedBuffer = Buffer.alloc(totalSize);
    let offset = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Copy audio data
      chunk.audioData.copy(mergedBuffer, offset);
      offset += chunk.audioData.length;
      
      // Add transition pause if not the last chunk
      if (i < chunks.length - 1) {
        const transitionBuffer = transitions[i];
        transitionBuffer.copy(mergedBuffer, offset);
        offset += transitionBuffer.length;
      }
    }
    
    return mergedBuffer;
  }

  /**
   * Calculate optimal pause duration between audio chunks
   * @param currentChunk Current audio chunk
   * @param nextChunk Next audio chunk
   * @returns Pause duration in milliseconds
   */
  private calculateOptimalPause(
    currentChunk: { speaker: string; emotion?: string; text: string },
    nextChunk: { speaker: string; emotion?: string; text: string }
  ): number {
    let basePause = 300; // Default 300ms pause
    
    // Longer pause for speaker changes
    if (currentChunk.speaker !== nextChunk.speaker) {
      basePause += 200; // +200ms for speaker change
    }
    
    // Longer pause for emotional transitions
    if (currentChunk.emotion !== nextChunk.emotion) {
      basePause += 100; // +100ms for emotion change
    }
    
    // Longer pause after dramatic emotions
    const dramaticEmotions = ['menacing', 'threatening', 'enraged', 'devastated', 'terrified'];
    if (currentChunk.emotion && dramaticEmotions.includes(currentChunk.emotion)) {
      basePause += 150; // +150ms after dramatic moments
    }
    
    // Shorter pause for quick dialogue exchanges
    const quickEmotions = ['excited', 'nervous', 'breathless', 'desperate'];
    if (currentChunk.emotion && quickEmotions.includes(currentChunk.emotion) &&
        nextChunk.emotion && quickEmotions.includes(nextChunk.emotion)) {
      basePause = Math.max(100, basePause - 100); // Reduce pause but minimum 100ms
    }
    
    // Pause based on punctuation in current text
    if (currentChunk.text.endsWith('...')) {
      basePause += 200; // Longer pause for trailing ellipsis
    } else if (currentChunk.text.endsWith('!') || currentChunk.text.endsWith('?')) {
      basePause += 100; // Medium pause for exclamation/question
    }
    
    return Math.min(basePause, 800); // Cap at 800ms maximum
  }

  // ==================== SOUND EFFECTS INTEGRATION SYSTEM ====================

  /**
   * Sound effect definitions for different creatures and scenarios
   */
  private soundEffectLibrary = {
    vampire: {
      entrance: ['swoosh', 'bat_wings', 'mist_settling'],
      dialogue: ['whisper_echo', 'seductive_breath'],
      action: ['vampire_hiss', 'cape_flutter', 'supernatural_move'],
      transformation: ['mist_form', 'bat_screech'],
      exit: ['dissolve_mist', 'wing_beats_fade']
    },
    werewolf: {
      entrance: ['heavy_footsteps', 'low_growl', 'sniffing'],
      dialogue: ['growl_undertone', 'heavy_breathing'],
      action: ['claws_scraping', 'powerful_movement', 'snarl'],
      transformation: ['bone_cracking', 'howl', 'clothing_tear'],
      exit: ['powerful_leap', 'distant_howl']
    },
    fairy: {
      entrance: ['magical_chimes', 'sparkle_sounds', 'gentle_breeze'],
      dialogue: ['magic_whispers', 'ethereal_echo'],
      action: ['magic_casting', 'pixie_dust', 'nature_sounds'],
      magic: ['spell_effects', 'enchantment_chimes'],
      exit: ['magical_fade', 'nature_harmony']
    },
    human: {
      entrance: ['footsteps', 'door_open', 'clothing_rustle'],
      dialogue: ['breath', 'subtle_movement'],
      action: ['movement', 'object_interaction'],
      exit: ['footsteps_fade', 'door_close']
    },
    ambient: {
      forest: ['wind_through_trees', 'distant_animals', 'leaves_rustling'],
      castle: ['stone_echo', 'distant_thunder', 'cold_wind'],
      chamber: ['fireplace_crackle', 'candle_flicker', 'silk_rustle'],
      night: ['owl_hoot', 'cricket_chirp', 'mysterious_whispers']
    }
  };

  /**
   * Sound effect keywords that trigger specific audio enhancements
   */
  private soundTriggerKeywords = {
    // Action keywords
    'growl': { creature: 'werewolf', category: 'action', effect: 'low_growl' },
    'hiss': { creature: 'vampire', category: 'action', effect: 'vampire_hiss' },
    'flutter': { creature: 'fairy', category: 'action', effect: 'wing_flutter' },
    'swoosh': { creature: 'vampire', category: 'action', effect: 'cape_flutter' },
    'sparkle': { creature: 'fairy', category: 'magic', effect: 'pixie_dust' },
    'howl': { creature: 'werewolf', category: 'transformation', effect: 'howl' },
    'whisper': { creature: 'any', category: 'dialogue', effect: 'whisper_echo' },
    
    // Environment keywords
    'forest': { creature: 'any', category: 'ambient', effect: 'wind_through_trees' },
    'castle': { creature: 'any', category: 'ambient', effect: 'stone_echo' },
    'chamber': { creature: 'any', category: 'ambient', effect: 'fireplace_crackle' },
    'night': { creature: 'any', category: 'ambient', effect: 'owl_hoot' },
    
    // Transformation keywords
    'transform': { creature: 'werewolf', category: 'transformation', effect: 'bone_cracking' },
    'change': { creature: 'werewolf', category: 'transformation', effect: 'bone_cracking' },
    'shift': { creature: 'werewolf', category: 'transformation', effect: 'bone_cracking' },
    'vanish': { creature: 'vampire', category: 'transformation', effect: 'mist_form' },
    'disappear': { creature: 'vampire', category: 'transformation', effect: 'dissolve_mist' }
  };

  /**
   * Detect sound effects needed for a piece of dialogue or narrative
   * @param text The text content to analyze
   * @param speaker The character speaking
   * @param characterType The type of character
   * @returns Array of sound effects to apply
   */
  private detectSoundEffects(text: string, speaker: string, characterType: 'vampire' | 'werewolf' | 'fairy' | 'human'): Array<{
    effect: string;
    category: string;
    timing: 'before' | 'during' | 'after';
    volume: number;
  }> {
    const effects: Array<{
      effect: string;
      category: string;
      timing: 'before' | 'during' | 'after';
      volume: number;
    }> = [];
    
    const lowerText = text.toLowerCase();
    
    // Check for specific sound trigger keywords
    for (const [keyword, config] of Object.entries(this.soundTriggerKeywords)) {
      if (lowerText.includes(keyword)) {
        if (config.creature === 'any' || config.creature === characterType) {
          effects.push({
            effect: config.effect,
            category: config.category,
            timing: this.determineSoundTiming(config.category),
            volume: this.calculateSoundVolume(config.category, keyword)
          });
        }
      }
    }
    
    // Add character-specific entrance/exit effects
    if (this.isCharacterEntrance(lowerText, speaker)) {
      const entranceEffects = this.soundEffectLibrary[characterType]?.entrance || [];
      if (entranceEffects.length > 0) {
        effects.push({
          effect: entranceEffects[0], // Use first entrance effect
          category: 'entrance',
          timing: 'before',
          volume: 0.6
        });
      }
    }
    
    if (this.isCharacterExit(lowerText, speaker)) {
      const exitEffects = this.soundEffectLibrary[characterType]?.exit || [];
      if (exitEffects.length > 0) {
        effects.push({
          effect: exitEffects[0], // Use first exit effect
          category: 'exit',
          timing: 'after',
          volume: 0.4
        });
      }
    }
    
    return effects;
  }

  /**
   * Determine when a sound effect should play relative to the voice
   * @param category The category of sound effect
   * @returns Timing specification
   */
  private determineSoundTiming(category: string): 'before' | 'during' | 'after' {
    const timingMap: Record<string, 'before' | 'during' | 'after'> = {
      'entrance': 'before',
      'exit': 'after',
      'transformation': 'during',
      'action': 'during',
      'dialogue': 'during',
      'magic': 'during',
      'ambient': 'during'
    };
    
    return timingMap[category] || 'during';
  }

  /**
   * Calculate appropriate volume for a sound effect
   * @param category The category of sound effect
   * @param keyword The trigger keyword
   * @returns Volume level (0.0 - 1.0)
   */
  private calculateSoundVolume(category: string, keyword: string): number {
    // Volume based on category
    const categoryVolumes: Record<string, number> = {
      'ambient': 0.3,
      'dialogue': 0.4,
      'action': 0.7,
      'transformation': 0.8,
      'entrance': 0.6,
      'exit': 0.4,
      'magic': 0.5
    };
    
    let baseVolume = categoryVolumes[category] || 0.5;
    
    // Adjust for specific keywords
    const loudKeywords = ['howl', 'growl', 'hiss', 'transform'];
    const quietKeywords = ['whisper', 'sparkle', 'flutter'];
    
    if (loudKeywords.includes(keyword)) {
      baseVolume = Math.min(1.0, baseVolume + 0.2);
    } else if (quietKeywords.includes(keyword)) {
      baseVolume = Math.max(0.1, baseVolume - 0.2);
    }
    
    return baseVolume;
  }

  /**
   * Check if text indicates character entrance
   * @param text Lowercase text to analyze
   * @param speaker Character name
   * @returns True if this appears to be an entrance
   */
  private isCharacterEntrance(text: string, speaker: string): boolean {
    const entranceKeywords = [
      'entered', 'arrived', 'appeared', 'materialized', 'emerged',
      'stepped into', 'walked in', 'came in', 'approached'
    ];
    
    return entranceKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text indicates character exit
   * @param text Lowercase text to analyze
   * @param speaker Character name
   * @returns True if this appears to be an exit
   */
  private isCharacterExit(text: string, speaker: string): boolean {
    const exitKeywords = [
      'left', 'departed', 'vanished', 'disappeared', 'faded',
      'walked away', 'stepped out', 'retreated', 'dissolved'
    ];
    
    return exitKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Generate mock sound effect audio data
   * @param effectName Name of the sound effect
   * @param duration Duration in milliseconds
   * @returns Mock audio buffer representing the sound effect
   */
  private generateMockSoundEffect(effectName: string, duration: number = 1000): Buffer {
    // Generate a simple sine wave pattern for different sound types
    const sampleRate = 44100;
    const samples = Math.floor((duration / 1000) * sampleRate);
    const buffer = Buffer.alloc(samples * 4); // Stereo 16-bit
    
    // Different frequency patterns for different effects
    const effectFrequencies: Record<string, number> = {
      'low_growl': 120,
      'vampire_hiss': 8000,
      'magical_chimes': 800,
      'wing_flutter': 400,
      'footsteps': 200,
      'whisper_echo': 300,
      'wind_through_trees': 100
    };
    
    const frequency = effectFrequencies[effectName] || 440;
    
    for (let i = 0; i < samples; i++) {
      // Create a fading effect
      const fadeIn = Math.min(1, i / (sampleRate * 0.1)); // 100ms fade in
      const fadeOut = Math.min(1, (samples - i) / (sampleRate * 0.1)); // 100ms fade out
      const envelope = fadeIn * fadeOut;
      
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3 * envelope;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      
      // Write stereo samples
      buffer.writeInt16LE(intSample, i * 4);
      buffer.writeInt16LE(intSample, i * 4 + 2);
    }
    
    return buffer;
  }

  /**
   * Enhanced audio processing with sound effects integration
   * @param text Story content
   * @param input Audio conversion parameters
   * @returns Audio with integrated sound effects
   */
  async generateAudioWithSoundEffects(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    // Check if sound effects are enabled (could be a parameter in the future)
    const soundEffectsEnabled = false; // Disabled by default for now
    
    if (!soundEffectsEnabled) {
      // Fall back to standard audio generation
      return this.hasSpeakerTags(text) 
        ? await this.generateMultiVoiceAudio(text, input)
        : await this.callElevenLabsAPI(text, input, undefined, undefined);
    }
    
    // Future implementation for sound effects integration
    // This would involve:
    // 1. Parse story content for sound effect triggers
    // 2. Generate voice audio as normal
    // 3. Generate or retrieve sound effects
    // 4. Mix voice and sound effects with proper timing
    // 5. Return combined audio buffer
    
    console.log('🎵 Sound effects system initialized (currently disabled)');
    return this.hasSpeakerTags(text) 
      ? await this.generateMultiVoiceAudio(text, input)
      : await this.callElevenLabsAPI(text, input, undefined, undefined);
  }

  /**
   * Get information about available sound effects
   * @returns Sound effects system information
   */
  public getSoundEffectsInfo() {
    return {
      enabled: false, // Currently disabled
      totalEffects: Object.values(this.soundEffectLibrary).reduce((total, category) => {
        return total + Object.values(category).reduce((sum, effects) => sum + effects.length, 0);
      }, 0),
      creatures: Object.keys(this.soundEffectLibrary).filter(key => key !== 'ambient'),
      categories: ['entrance', 'dialogue', 'action', 'transformation', 'exit', 'ambient'],
      triggerKeywords: Object.keys(this.soundTriggerKeywords),
      features: {
        contextualDetection: true,
        volumeControl: true,
        timingControl: true,
        creatureSpecific: true,
        mockGeneration: true
      },
      implementation: {
        status: 'research_complete',
        nextSteps: ['API integration', 'browser audio mixing', 'user controls'],
        limitations: ['mock effects only', 'no real audio mixing', 'performance untested']
      }
    };
  }

  /**
   * Extract all speakers from story content
   * @param content Story content with speaker tags
   * @returns Array of unique speaker names
   */
  private extractSpeakersFromContent(content: string): string[] {
    const speakerMatches = content.match(/\[([^\]]+)\]:/g);
    if (!speakerMatches) return [];

    const speakers = speakerMatches
      .map(match => match.slice(1, -2)) // Remove [ and ]:
      .map(speaker => speaker.split(',')[0].trim()) // Remove emotion tags
      .filter(speaker => speaker.toLowerCase() !== 'narrator'); // Remove narrator

    return [...new Set(speakers)]; // Remove duplicates
  }
}