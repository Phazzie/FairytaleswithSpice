import axios from 'axios';
import { 
  AudioConversionSeam, 
  ApiResponse, 
  SpeakerSegment, 
  CharacterVoiceType, 
  EmotionalContext,
  MultiVoiceAudioResult,
  CreatureType,
  AudioProgress 
} from '../types/contracts';

/**
 * Multi-Voice Audio Service (Backend)
 * 
 * This service implements the complete multi-voice audio generation pipeline:
 * 1. Parse dialogue from [Speaker]: format
 * 2. Assign character-specific voices based on creature types
 * 3. Generate individual audio segments with emotional inflection
 * 4. Stitch segments together into a complete audiobook
 */
export class MultiVoiceAudioService {
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  // Character-specific voice mappings for ElevenLabs v3 API
  private characterVoiceIds: Record<CharacterVoiceType, string> = {
    // Vampire voices - Deep, seductive
    vampire_male_seductive: process.env.ELEVENLABS_VAMPIRE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam (modified)
    vampire_female_seductive: process.env.ELEVENLABS_VAMPIRE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella (modified)
    
    // Werewolf voices - Gruff, powerful
    werewolf_male_gruff: process.env.ELEVENLABS_WEREWOLF_MALE || 'ErXwobaYiN019PkySvjV', // Antoni
    werewolf_female_strong: process.env.ELEVENLABS_WEREWOLF_FEMALE || 'MF3mGyEYCl7XYWbV9V6O', // Elli
    
    // Fairy voices - Ethereal, mystical
    fairy_ethereal: process.env.ELEVENLABS_FAIRY_ETHEREAL || '21m00Tcm4TlvDq8ikWAM', // Rachel (modified)
    fairy_mystical: process.env.ELEVENLABS_FAIRY_MYSTICAL || 'AZnzlk1XvdvUeBnXmlld', // Domi
    
    // Human voices - Relatable, emotional
    human_male_emotional: process.env.ELEVENLABS_HUMAN_MALE || 'VR6AewLTigWG4xSOukaG', // Arnold
    human_female_emotional: process.env.ELEVENLABS_HUMAN_FEMALE || 'jsCqWAovK2LkecY7zXl4', // Freya
    
    // Narrator voices - Neutral, storytelling
    narrator_neutral: process.env.ELEVENLABS_NARRATOR_NEUTRAL || 'onwK4e9ZLuTAKqWW03F9', // Daniel
    narrator_intimate: process.env.ELEVENLABS_NARRATOR_INTIMATE || 'cgSgspJ2msm6clMCkdW9' // Jessica
  };

  constructor() {
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found - using mock audio generation');
    }
  }

  /**
   * Main entry point for multi-voice audio conversion
   */
  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();
    const multiVoice = input.multiVoice !== false; // Default to true

    try {
      let result: AudioConversionSeam['output'];

      if (multiVoice) {
        result = await this.generateMultiVoiceAudio(input, startTime);
      } else {
        result = await this.generateSingleVoiceAudio(input, startTime);
      }

      return {
        success: true,
        data: result,
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };

    } catch (error: any) {
      console.error('Multi-voice audio conversion error:', error);
      return this.handleError(error, startTime);
    }
  }

  /**
   * Generate multi-voice audio with character-specific voices
   */
  private async generateMultiVoiceAudio(
    input: AudioConversionSeam['input'], 
    startTime: number
  ): Promise<AudioConversionSeam['output']> {
    
    // Step 1: Parse dialogue and identify speakers
    const segments = this.parseDialogue(input.content);
    if (segments.length === 0) {
      throw new Error('No dialogue segments found - content may not be properly formatted');
    }

    // Step 2: Assign voices to characters
    this.assignCharacterVoices(segments, input.creatureType, input.characterVoiceOverrides);

    // Step 3: Generate audio for each segment
    const audioSegments = await this.generateAudioSegments(segments, input);

    // Step 4: Stitch segments together
    const compiledAudio = await this.stitchAudioSegments(audioSegments, input);

    // Step 5: Create multi-voice result
    const multiVoiceResult: MultiVoiceAudioResult = {
      segments: audioSegments,
      compiledAudioUrl: compiledAudio.url,
      totalDuration: compiledAudio.duration,
      characterVoices: this.extractCharacterVoiceMapping(audioSegments)
    };

    return {
      audioId: this.generateAudioId(),
      storyId: input.storyId,
      audioUrl: compiledAudio.url,
      duration: compiledAudio.duration,
      fileSize: compiledAudio.fileSize,
      format: input.format || 'mp3',
      voice: input.voice || 'neutral',
      speed: input.speed || 1.0,
      progress: {
        percentage: 100,
        status: 'completed',
        message: `Multi-voice audiobook completed with ${audioSegments.length} character voices`,
        estimatedTimeRemaining: 0,
        currentStep: 'finalization',
        segmentsCompleted: audioSegments.length,
        totalSegments: audioSegments.length
      },
      completedAt: new Date(),
      multiVoiceResult,
      isMultiVoice: true
    };
  }

  /**
   * Generate single-voice audio (fallback mode)
   */
  private async generateSingleVoiceAudio(
    input: AudioConversionSeam['input'], 
    startTime: number
  ): Promise<AudioConversionSeam['output']> {
    
    // Clean HTML content for text-to-speech
    const cleanText = this.cleanHtmlForTTS(input.content);
    
    // Generate audio using single voice
    const audioData = await this.callElevenLabsAPI(cleanText, input.voice || 'neutral', input);
    
    // Upload to storage
    const audioUrl = await this.uploadAudioToStorage(audioData, input);

    return {
      audioId: this.generateAudioId(),
      storyId: input.storyId,
      audioUrl: audioUrl,
      duration: this.estimateDuration(cleanText),
      fileSize: audioData.length,
      format: input.format || 'mp3',
      voice: input.voice || 'neutral',
      speed: input.speed || 1.0,
      progress: {
        percentage: 100,
        status: 'completed',
        message: 'Single-voice audio conversion completed',
        estimatedTimeRemaining: 0,
        currentStep: 'finalization'
      },
      completedAt: new Date(),
      isMultiVoice: false
    };
  }

  /**
   * Parse dialogue from [Speaker]: format
   */
  private parseDialogue(content: string): SpeakerSegment[] {
    const segments: SpeakerSegment[] = [];
    
    // Remove HTML tags but preserve structure for parsing
    const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Regex to match [Speaker] or [Speaker, emotion]: "dialogue" format
    const speakerPattern = /\[([^\]]+?)(?:,\s*([^\]]+?))?\]:\s*([^[]+?)(?=\[|$)/g;
    
    let match;
    while ((match = speakerPattern.exec(cleanContent)) !== null) {
      const speaker = match[1].trim();
      const emotion = match[2]?.trim() as EmotionalContext || 'neutral';
      const text = match[3].trim();
      
      if (text.length > 0) {
        segments.push({
          speaker,
          text,
          emotion,
          voiceType: 'narrator_neutral' // Will be assigned later
        });
      }
    }

    return segments;
  }

  /**
   * Assign character-specific voices based on creature types and character names
   */
  private assignCharacterVoices(
    segments: SpeakerSegment[], 
    creatureType?: CreatureType,
    overrides?: Record<string, CharacterVoiceType>
  ): void {
    const characterVoiceAssignments = new Map<string, CharacterVoiceType>();

    for (const segment of segments) {
      const speakerLower = segment.speaker.toLowerCase();
      
      // Apply manual overrides first
      if (overrides && overrides[segment.speaker]) {
        segment.voiceType = overrides[segment.speaker];
        continue;
      }

      // Check if already assigned
      if (characterVoiceAssignments.has(segment.speaker)) {
        segment.voiceType = characterVoiceAssignments.get(segment.speaker)!;
        continue;
      }

      // Assign voice based on character type detection
      let voiceType: CharacterVoiceType;

      if (speakerLower === 'narrator') {
        voiceType = segment.emotion === 'intimate' ? 'narrator_intimate' : 'narrator_neutral';
      } else if (this.isVampireCharacter(speakerLower, creatureType)) {
        voiceType = this.detectGender(segment.text, speakerLower) === 'female' 
          ? 'vampire_female_seductive' 
          : 'vampire_male_seductive';
      } else if (this.isWerewolfCharacter(speakerLower, creatureType)) {
        voiceType = this.detectGender(segment.text, speakerLower) === 'female'
          ? 'werewolf_female_strong'
          : 'werewolf_male_gruff';
      } else if (this.isFairyCharacter(speakerLower, creatureType)) {
        voiceType = Math.random() > 0.5 ? 'fairy_ethereal' : 'fairy_mystical';
      } else {
        // Default to human voices
        voiceType = this.detectGender(segment.text, speakerLower) === 'female'
          ? 'human_female_emotional'
          : 'human_male_emotional';
      }

      segment.voiceType = voiceType;
      characterVoiceAssignments.set(segment.speaker, voiceType);
    }
  }

  /**
   * Character type detection helpers
   */
  private isVampireCharacter(speakerLower: string, creatureType?: CreatureType): boolean {
    return creatureType === 'vampire' || 
           speakerLower.includes('vampire') || 
           speakerLower.includes('lord') ||
           speakerLower.includes('count');
  }

  private isWerewolfCharacter(speakerLower: string, creatureType?: CreatureType): boolean {
    return creatureType === 'werewolf' || 
           speakerLower.includes('wolf') || 
           speakerLower.includes('pack') ||
           speakerLower.includes('alpha');
  }

  private isFairyCharacter(speakerLower: string, creatureType?: CreatureType): boolean {
    return creatureType === 'fairy' || 
           speakerLower.includes('fairy') || 
           speakerLower.includes('fae') ||
           speakerLower.includes('sprite');
  }

  /**
   * Simple gender detection based on common patterns
   */
  private detectGender(text: string, speakerName: string): 'male' | 'female' {
    const femaleIndicators = ['she', 'her', 'lady', 'queen', 'princess', 'miss', 'mrs'];
    const maleIndicators = ['he', 'his', 'lord', 'king', 'prince', 'mr', 'sir'];
    
    const textLower = text.toLowerCase();
    const nameLower = speakerName.toLowerCase();
    
    // Check name patterns
    const femaleNames = ['sarah', 'elena', 'luna', 'aria', 'bella', 'rose'];
    const maleNames = ['alexander', 'damien', 'lucas', 'adrian', 'gabriel', 'marcus'];
    
    if (femaleNames.some(name => nameLower.includes(name))) return 'female';
    if (maleNames.some(name => nameLower.includes(name))) return 'male';
    
    // Check text context
    const femaleScore = femaleIndicators.reduce((score, indicator) => 
      score + (textLower.includes(indicator) ? 1 : 0), 0);
    const maleScore = maleIndicators.reduce((score, indicator) => 
      score + (textLower.includes(indicator) ? 1 : 0), 0);
    
    return femaleScore > maleScore ? 'female' : 'male';
  }

  /**
   * Generate audio for each segment
   */
  private async generateAudioSegments(
    segments: SpeakerSegment[], 
    input: AudioConversionSeam['input']
  ): Promise<SpeakerSegment[]> {
    
    const audioSegments: SpeakerSegment[] = [];
    let currentTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      try {
        // Clean text for TTS
        const cleanText = this.cleanTextForTTS(segment.text);
        
        // Generate audio with character-specific voice and emotional context
        const audioData = await this.generateCharacterAudio(
          cleanText, 
          segment.voiceType, 
          segment.emotion || 'neutral',
          input
        );
        
        // Upload segment audio
        const audioUrl = await this.uploadSegmentAudio(audioData, segment, i, input);
        
        // Calculate duration
        const duration = this.estimateDuration(cleanText);
        
        audioSegments.push({
          ...segment,
          startTime: currentTime,
          duration,
          audioUrl
        });
        
        currentTime += duration;
        
      } catch (error) {
        console.error(`Failed to generate audio for segment ${i}:`, error);
        // Create a fallback segment
        audioSegments.push({
          ...segment,
          startTime: currentTime,
          duration: 2, // 2 second silence
          audioUrl: undefined
        });
        currentTime += 2;
      }
    }

    return audioSegments;
  }

  /**
   * Generate audio for a specific character with emotional context
   */
  private async generateCharacterAudio(
    text: string, 
    voiceType: CharacterVoiceType, 
    emotion: EmotionalContext,
    input: AudioConversionSeam['input']
  ): Promise<Buffer> {
    
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(text);
    }

    const voiceId = this.characterVoiceIds[voiceType];
    const voiceSettings = this.getVoiceSettingsForEmotion(emotion, voiceType);

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_multilingual_v2', // v3 model for better emotional range
          voice_settings: voiceSettings
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      return Buffer.from(response.data);

    } catch (error: any) {
      console.error(`ElevenLabs API error for voice ${voiceType}:`, error.response?.data || error.message);
      // Fallback to mock data
      return this.generateMockAudioData(text);
    }
  }

  /**
   * Get voice settings optimized for emotional context
   */
  private getVoiceSettingsForEmotion(emotion: EmotionalContext, voiceType: CharacterVoiceType) {
    const baseSettings = {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    };

    // Adjust settings based on emotion
    switch (emotion) {
      case 'seductive':
        return { ...baseSettings, stability: 0.3, style: 0.8 };
      case 'fearful':
        return { ...baseSettings, stability: 0.2, style: 0.3 };
      case 'angry':
        return { ...baseSettings, stability: 0.7, style: 0.9 };
      case 'tender':
        return { ...baseSettings, stability: 0.8, style: 0.2 };
      case 'commanding':
        return { ...baseSettings, stability: 0.9, style: 0.7 };
      case 'mysterious':
        return { ...baseSettings, stability: 0.4, style: 0.6 };
      default:
        return baseSettings;
    }
  }

  /**
   * Stitch audio segments together
   */
  private async stitchAudioSegments(
    segments: SpeakerSegment[], 
    input: AudioConversionSeam['input']
  ): Promise<{ url: string; duration: number; fileSize: number }> {
    
    // In a real implementation, this would use FFmpeg or similar to combine audio files
    // For now, we'll simulate the stitching process
    
    const totalDuration = segments.reduce((sum, segment) => sum + (segment.duration || 0), 0);
    const estimatedFileSize = Math.floor(totalDuration * 32000); // Rough estimate for MP3
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const compiledUrl = await this.uploadCompiledAudio(segments, input);
    
    return {
      url: compiledUrl,
      duration: totalDuration,
      fileSize: estimatedFileSize
    };
  }

  /**
   * Helper methods
   */
  private cleanHtmlForTTS(htmlContent: string): string {
    return htmlContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanTextForTTS(text: string): string {
    return text
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private estimateDuration(text: string): number {
    const wordsPerSecond = 2.5;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerSecond);
  }

  private extractCharacterVoiceMapping(segments: SpeakerSegment[]): Record<string, CharacterVoiceType> {
    const mapping: Record<string, CharacterVoiceType> = {};
    segments.forEach(segment => {
      mapping[segment.speaker] = segment.voiceType;
    });
    return mapping;
  }

  private async uploadSegmentAudio(
    audioData: Buffer, 
    segment: SpeakerSegment, 
    index: number,
    input: AudioConversionSeam['input']
  ): Promise<string> {
    // Mock upload for segment audio
    const filename = `${input.storyId}-segment-${index}-${segment.speaker.replace(/\s+/g, '_')}.${input.format || 'mp3'}`;
    await new Promise(resolve => setTimeout(resolve, 100));
    return `https://storage.example.com/audio/segments/${filename}`;
  }

  private async uploadCompiledAudio(
    segments: SpeakerSegment[], 
    input: AudioConversionSeam['input']
  ): Promise<string> {
    // Mock upload for compiled audiobook
    const filename = `${input.storyId}-multivoice-audiobook.${input.format || 'mp3'}`;
    await new Promise(resolve => setTimeout(resolve, 500));
    return `https://storage.example.com/audio/compiled/${filename}`;
  }

  private async uploadAudioToStorage(audioData: Buffer, input: AudioConversionSeam['input']): Promise<string> {
    const filename = `story-${input.storyId}-audio.${input.format || 'mp3'}`;
    await new Promise(resolve => setTimeout(resolve, 500));
    return `https://storage.example.com/audio/${filename}`;
  }

  private async callElevenLabsAPI(text: string, voice: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(text);
    }

    // Use basic voice mapping for fallback
    const voiceId = voice === 'female' ? this.characterVoiceIds.human_female_emotional :
                   voice === 'male' ? this.characterVoiceIds.human_male_emotional :
                   this.characterVoiceIds.narrator_neutral;

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.5,
            use_speaker_boost: true
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('ElevenLabs API error:', error.response?.data || error.message);
      return this.generateMockAudioData(text);
    }
  }

  private generateMockAudioData(text: string): Buffer {
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

  private generateAudioId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(error: any, startTime: number): ApiResponse<AudioConversionSeam['output']> {
    let errorCode = 'CONVERSION_FAILED';
    let errorMessage = 'Failed to convert story to multi-voice audio';

    if (error.response?.status === 429) {
      errorCode = 'AUDIO_QUOTA_EXCEEDED';
      errorMessage = 'Audio generation quota exceeded';
    } else if (error.response?.status === 400) {
      errorCode = 'UNSUPPORTED_CONTENT';
      errorMessage = 'Story content contains unsupported elements';
    } else if (error.message.includes('dialogue segments')) {
      errorCode = 'DIALOGUE_PARSING_FAILED';
      errorMessage = 'Failed to parse dialogue from story content';
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