import axios from 'axios';
import { AudioConversionSeam, ApiResponse, CreatureType, CharacterVoiceType } from '../types/contracts';
import { getVoiceSettingsForEmotion, getAvailableEmotions, VoiceSettings } from './emotionMapping';

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
  /** ElevenLabs API base URL for text-to-speech requests - Using latest v2.5 turbo model */
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  
  /** ElevenLabs API key from environment variables */
  private elevenLabsApiKey = process.env['ELEVENLABS_API_KEY'];

  /**
   * Voice ID mapping for different character types and genders
   * Maps to specific ElevenLabs voice IDs optimized for each character archetype
   * Falls back to environment variables or default voices if custom ones unavailable
   */
  /**
   * Voice mapping for different character types and genders
   * Maps to specific ElevenLabs voice IDs optimized for each character archetype
   * Falls back to environment variables or default voices if custom ones unavailable
   */
  private voiceIds = {
    // ==================== BASIC VOICES (Backwards Compatibility) ====================
    female: process.env['ELEVENLABS_VOICE_FEMALE'] || 'EXAVITQu4vr4xnSDxMaL', // Bella
    male: process.env['ELEVENLABS_VOICE_MALE'] || 'pNInz6obpgDQGcFmaJgB', // Adam
    neutral: process.env['ELEVENLABS_VOICE_NEUTRAL'] || '21m00Tcm4TlvDq8ikWAM', // Rachel
    
    // ==================== CHARACTER-SPECIFIC VOICES ====================
    vampire_male: process.env['ELEVENLABS_VOICE_VAMPIRE_MALE'] || 'ErXwobaYiN019PkySvjV', // Antoni (deep, seductive)
    vampire_female: process.env['ELEVENLABS_VOICE_VAMPIRE_FEMALE'] || 'EXAVITQu4vr4xnSDxMaL', // Bella (alluring)
    werewolf_male: process.env['ELEVENLABS_VOICE_WEREWOLF_MALE'] || 'pNInz6obpgDQGcFmaJgB', // Adam (rough, powerful)
    werewolf_female: process.env['ELEVENLABS_VOICE_WEREWOLF_FEMALE'] || 'AZnzlk1XvdvUeBnXmlld', // Domi (strong, wild)
    fairy_male: process.env['ELEVENLABS_VOICE_FAIRY_MALE'] || 'VR6AewLTigWG4xSOukaG', // Josh (light, ethereal)
    fairy_female: process.env['ELEVENLABS_VOICE_FAIRY_FEMALE'] || 'jsCqWAovK2LkecY7zXl4', // Freya (magical, delicate)
    human_male: process.env['ELEVENLABS_VOICE_HUMAN_MALE'] || 'pNInz6obpgDQGcFmaJgB', // Adam (natural, warm)
    human_female: process.env['ELEVENLABS_VOICE_HUMAN_FEMALE'] || 'EXAVITQu4vr4xnSDxMaL', // Bella (natural, warm)
    narrator: process.env['ELEVENLABS_VOICE_NARRATOR'] || '21m00Tcm4TlvDq8ikWAM' // Rachel (neutral, storytelling)
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
    customSettings?: { stability: number; similarity_boost: number; style: number }
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

    try {
      // Use custom settings if provided, otherwise use defaults
      const voiceSettings = customSettings ? {
        ...customSettings,
        use_speaker_boost: true
      } : {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true
      };
      
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_turbo_v2_5',
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
    // Convert audio buffer to base64 data URL for immediate browser playback
    // This eliminates need for external storage in production
    // Format: data:audio/mp3;base64,{base64EncodedData}
    
    const format = input.format || 'mp3';
    const mimeType = format === 'mp3' ? 'audio/mpeg' : 
                    format === 'wav' ? 'audio/wav' : 
                    format === 'aac' ? 'audio/aac' : 'audio/mpeg';
    
    const base64Audio = audioData.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Audio}`;
    
    // Log file size for debugging
    const fileSizeMB = (audioData.length / 1024 / 1024).toFixed(2);
    console.log(`✅ Audio generated: ${fileSizeMB} MB as ${format} data URL`);
    
    // Future: For production scaling, could switch to cloud storage here
    // if (process.env.AUDIO_STORAGE === 'cloud') {
    //   return await uploadToS3(audioData, input.storyId, format);
    // }
    
    return dataUrl;
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

  private async parseAndAssignVoices(text: string, input: AudioConversionSeam['input']): Promise<Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer, settings?: any}>> {
    const chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer, settings?: any}> = [];
    
    // Extract voice metadata from story content
    const voiceMetadata = this.extractVoiceMetadata(text);
    
    // Log extracted voice metadata for debugging
    if (voiceMetadata.size > 0) {
      console.log(`✅ Extracted voice metadata for ${voiceMetadata.size} characters:`);
      for (const [name, data] of voiceMetadata) {
        console.log(`   ${name}: ${data.description} (${data.characterType} ${data.gender})`);
      }
    }
    
    // Split text by speaker tags while preserving the tags
    const segments = text.split(/(\[([^\]]+)\]:\s*)/);
    
    let currentSpeaker = 'Narrator';
    let currentVoice: CharacterVoiceType = 'narrator';
    let currentSettings: any = undefined;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (!segment) continue;
      
      // Check if this segment is a speaker tag
      const speakerMatch = segment.match(/\[([^\]]+)\]:\s*/);
      
      if (speakerMatch) {
        // This is a speaker tag - update current speaker and voice
        const speakerInfo = speakerMatch[1];
        currentSpeaker = speakerInfo.split(',')[0].trim(); // Remove voice/emotion metadata
        
        // Check if we have voice metadata for this character
        const metadata = voiceMetadata.get(currentSpeaker);
        if (metadata) {
          // Use smart voice assignment based on AI-generated metadata
          const voiceKey = `${metadata.characterType}_${metadata.gender}` as CharacterVoiceType;
          currentVoice = this.voiceIds[voiceKey] ? voiceKey : this.assignVoiceToSpeaker(currentSpeaker);
          currentSettings = metadata.settings;
          console.log(`   🎙️  ${currentSpeaker}: Using ${currentVoice} with optimized settings`);
        } else {
          // Fallback to heuristic assignment
          currentVoice = this.assignVoiceToSpeaker(currentSpeaker);
          currentSettings = undefined;
        }
      } else if (segment.length > 0) {
        // This is dialogue or narrative text
        try {
          const audioData = await this.callElevenLabsAPI(segment, input, currentVoice, currentSettings);
          chunks.push({
            speaker: currentSpeaker,
            text: segment,
            voice: currentVoice,
            audioData: audioData,
            settings: currentSettings
          });
        } catch (error) {
          console.warn(`Failed to generate audio for ${currentSpeaker}: ${error}`);
          // Continue with other chunks rather than failing completely
        }
      }
    }
    
    return chunks;
  }

  /**
   * Extract voice metadata from story content
   * Parses [CharacterName, voice: description]: format from first appearances
   */
  private extractVoiceMetadata(content: string): Map<string, {
    description: string;
    characterType: 'vampire' | 'werewolf' | 'fairy' | 'human';
    gender: 'male' | 'female' | 'neutral';
    traits: string[];
    settings: { stability: number; similarity_boost: number; style: number };
  }> {
    const voiceMetadata = new Map();
    
    // Regex to find: [CharacterName, voice: description]: "dialogue"
    const voiceTagRegex = /\[([^,\]]+),\s*voice:\s*([^\]]+)\]:/g;
    
    let match;
    while ((match = voiceTagRegex.exec(content)) !== null) {
      const characterName = match[1].trim();
      const voiceDescription = match[2].trim();
      
      // Parse the description to extract characteristics
      const analysis = this.analyzeVoiceDescription(voiceDescription);
      
      voiceMetadata.set(characterName, {
        description: voiceDescription,
        ...analysis
      });
    }
    
    return voiceMetadata;
  }
  
  /**
   * Analyze voice description to extract characteristics and optimize settings
   */
  private analyzeVoiceDescription(description: string): {
    characterType: 'vampire' | 'werewolf' | 'fairy' | 'human';
    gender: 'male' | 'female' | 'neutral';
    traits: string[];
    settings: { stability: number; similarity_boost: number; style: number };
  } {
    const words = description.toLowerCase().split(/[\s-]+/);
    
    // Detect character type from keywords
    const vampireWords = ['seductive', 'ancient', 'commanding', 'hypnotic', 'velvet', 'dark', 'eternal', 'midnight', 'crimson', 'obsidian'];
    const werewolfWords = ['primal', 'rough', 'growling', 'powerful', 'wild', 'fierce', 'feral', 'thunder', 'earth', 'moonlit', 'forest'];
    const fairyWords = ['ethereal', 'musical', 'light', 'tinkling', 'magical', 'delicate', 'airy', 'starlight', 'dewdrop', 'windchime', 'crystal'];
    
    let characterType: 'vampire' | 'werewolf' | 'fairy' | 'human' = 'human';
    if (words.some(w => vampireWords.includes(w))) characterType = 'vampire';
    else if (words.some(w => werewolfWords.includes(w))) characterType = 'werewolf';
    else if (words.some(w => fairyWords.includes(w))) characterType = 'fairy';
    
    // Detect gender from keywords
    const maleWords = ['deep', 'gravelly', 'commanding', 'authoritative', 'bass', 'rough', 'thunder', 'granite', 'steel'];
    const femaleWords = ['soft', 'melodic', 'sultry', 'silky', 'soprano', 'delicate', 'gentle', 'pearl', 'silk'];
    
    let gender: 'male' | 'female' | 'neutral' = 'neutral';
    if (words.some(w => maleWords.includes(w))) gender = 'male';
    else if (words.some(w => femaleWords.includes(w))) gender = 'female';
    
    // Optimize voice settings based on traits
    let stability = 0.5;
    let similarity_boost = 0.8;
    let style = 0.5;
    
    // Adjust for character type
    if (characterType === 'vampire') {
      stability = 0.6; // More controlled
      style = 0.7; // More stylized
    } else if (characterType === 'werewolf') {
      stability = 0.4; // More variable
      similarity_boost = 0.9; // Stronger presence
    } else if (characterType === 'fairy') {
      stability = 0.3; // More expressive
      style = 0.8; // Highly stylized
    }
    
    // Adjust for specific traits
    if (words.some(w => ['seductive', 'hypnotic', 'intoxicating', 'mesmerizing'].includes(w))) {
      style += 0.2; // More expressive
      stability -= 0.1; // More variation
    }
    if (words.some(w => ['commanding', 'authoritative', 'powerful'].includes(w))) {
      stability += 0.1; // More controlled
      similarity_boost += 0.1; // Stronger presence
    }
    if (words.some(w => ['ethereal', 'musical', 'delicate', 'tinkling'].includes(w))) {
      style += 0.3; // Very expressive
      stability -= 0.2; // More fluid
    }
    if (words.some(w => ['rough', 'growling', 'gravelly', 'primal'].includes(w))) {
      stability += 0.2; // Consistent roughness
      style -= 0.1; // Less refined
    }
    
    // Clamp to valid range [0, 1]
    stability = Math.max(0, Math.min(1, stability));
    similarity_boost = Math.max(0, Math.min(1, similarity_boost));
    style = Math.max(0, Math.min(1, style));
    
    return {
      characterType,
      gender,
      traits: words,
      settings: { stability, similarity_boost, style }
    };
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

  // ==================== EMOTION METHODS FOR API ENDPOINTS ====================
  
  /**
   * Get comprehensive emotion information and voice capabilities
   */
  getEmotionInfo() {
    const supportedEmotions = getAvailableEmotions();

    return {
      supportedEmotions,
      emotionCount: supportedEmotions.length,
      voiceTypes: Object.keys(this.voiceIds),
      audioFormats: ['mp3', 'wav', 'aac'],
      speedRange: { min: 0.5, max: 1.5 },
      description: 'Advanced multi-voice emotion mapping for spicy fairy tale narration'
    };
  }

  /**
   * Test emotion combination and return voice parameters
   */
  testEmotionCombination(emotion: string) {
    const supportedEmotions = getAvailableEmotions();
    const isValid = supportedEmotions.includes(emotion.toLowerCase());
    
    if (!isValid) {
      return {
        valid: false,
        error: `Emotion '${emotion}' not found in mapping`,
        availableEmotions: supportedEmotions.slice(0, 10) // First 10 for brevity
      };
    }

    const voiceSettings = getVoiceSettingsForEmotion(emotion);

    return {
      valid: true,
      emotion: emotion.toLowerCase(),
      parameters: voiceSettings,
      testVoice: 'narrator',
      sampleText: this.generateSampleTextForEmotion(emotion),
      usage: `Use this emotion in speaker tags like: [Character:${emotion}]: "dialogue text"`
    };
  }

  private generateSampleTextForEmotion(emotion: string): string {
    const samples: Record<string, string> = {
      'seductive': '"Come closer, darling... I won\'t bite... much."',
      'menacing': '"You dare to defy me? Your blood will pay the price."',
      'passionate': '"I burn for you with the fire of a thousand suns."',
      'mysterious': '"Some secrets are better left buried in the shadows."',
      'playful': '"Oh, what fun we shall have tonight, my dear prey."'
    };
    
    return samples[emotion.toLowerCase()] || '"This emotion carries great power in our tales."';
  }
}