import axios from 'axios';
import { AudioConversionSeam, ApiResponse, DialogueSegment, CharacterVoiceProfile, CreatureType } from '../types/contracts';
import { DialogueParserService } from './dialogueParserService';
import { CharacterVoiceService } from './characterVoiceService';
import { AudioStitchingService } from './audioStitchingService';

export class AudioService {
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  // Legacy voice IDs for backward compatibility
  private voiceIds = {
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM' // Rachel
  };

  // Services for multi-voice processing
  private dialogueParser = new DialogueParserService();
  private characterVoiceService = new CharacterVoiceService();
  private audioStitchingService = new AudioStitchingService();

  constructor() {
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();

    try {
      // Check if multi-voice is enabled and story contains dialogue
      const hasDialogue = this.detectDialogueFormat(input.content);
      const enableMultiVoice = input.enableMultiVoice !== false && hasDialogue;

      if (enableMultiVoice) {
        return await this.convertToMultiVoiceAudio(input, startTime);
      } else {
        return await this.convertToSingleVoiceAudio(input, startTime);
      }

    } catch (error: any) {
      console.error('Audio conversion error:', error);

      let errorCode = 'CONVERSION_FAILED';
      let errorMessage = 'Failed to convert story to audio';
      let stage: 'text_processing' | 'audio_generation' | 'file_creation' | 'dialogue_parsing' | 'voice_assignment' | 'segment_stitching' = 'text_processing';

      if (error.response?.status === 429) {
        errorCode = 'AUDIO_QUOTA_EXCEEDED';
        errorMessage = 'Audio generation quota exceeded';
      } else if (error.response?.status === 400) {
        errorCode = 'UNSUPPORTED_CONTENT';
        errorMessage = 'Story content contains unsupported elements';
      } else if (error.message?.includes('dialogue parsing')) {
        errorCode = 'DIALOGUE_PARSING_FAILED';
        errorMessage = 'Failed to parse dialogue segments';
        stage = 'dialogue_parsing';
      } else if (error.message?.includes('voice assignment')) {
        errorCode = 'VOICE_ASSIGNMENT_FAILED';
        errorMessage = 'Failed to assign character voices';
        stage = 'voice_assignment';
      } else if (error.message?.includes('stitching')) {
        errorCode = 'CONVERSION_FAILED';
        errorMessage = 'Failed to combine audio segments';
        stage = 'segment_stitching';
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
   * Converts story to multi-voice audio with character-specific voices
   */
  private async convertToMultiVoiceAudio(input: AudioConversionSeam['input'], startTime: number): Promise<ApiResponse<AudioConversionSeam['output']>> {
    console.log('🎭 Converting to multi-voice audio...');

    // Parse dialogue segments from story content
    const dialogueSegments = this.dialogueParser.parseDialogue(input.content);
    
    if (dialogueSegments.length === 0) {
      throw new Error('No dialogue segments found for multi-voice conversion');
    }

    console.log(`🎯 Found ${dialogueSegments.length} dialogue segments`);

    // Determine story creature type for voice assignment
    const storyCreature = this.detectStoryCreature(input.content);
    
    // Assign character voices
    const assignedSegments = this.dialogueParser.assignCharacterVoices(dialogueSegments, storyCreature);
    
    // Create character profiles
    const uniqueCharacters = [...new Set(assignedSegments.map(s => s.speaker))];
    const characterProfiles = this.characterVoiceService.createCharacterProfiles(uniqueCharacters, storyCreature);
    
    console.log(`👥 Assigned voices for ${uniqueCharacters.length} characters`);

    // Parse full content for narrative and dialogue
    const contentSegments = this.dialogueParser.parseNarrativeAndDialogue(input.content);
    
    // Generate audio for each segment
    const audioSegments: Array<{ segment: DialogueSegment; audioBuffer: Buffer; type: 'dialogue' | 'narrative' }> = [];
    const audioSegmentUrls: string[] = [];
    
    let processedSegments = 0;
    for (const contentSegment of contentSegments) {
      let audioBuffer: Buffer;
      let segmentData: DialogueSegment;
      
      if (contentSegment.type === 'dialogue' && contentSegment.segment) {
        // Generate dialogue audio with character voice
        segmentData = contentSegment.segment;
        const characterProfile = characterProfiles.find(p => p.characterName === segmentData.speaker);
        audioBuffer = await this.generateCharacterAudio(segmentData, characterProfile);
      } else {
        // Generate narrative audio with narrator voice
        segmentData = {
          id: `narrative_${processedSegments}`,
          speaker: 'Narrator',
          text: contentSegment.content,
          voiceType: 'narrator',
          emotionalTone: 'neutral'
        };
        audioBuffer = await this.generateNarrativeAudio(contentSegment.content);
      }
      
      audioSegments.push({
        segment: segmentData,
        audioBuffer,
        type: contentSegment.type
      });
      
      // Upload individual segment for debugging
      const segmentUrl = await this.uploadAudioToStorage(audioBuffer, input, `segment_${processedSegments}`);
      audioSegmentUrls.push(segmentUrl);
      
      processedSegments++;
      console.log(`🔊 Generated audio for segment ${processedSegments}/${contentSegments.length}`);
    }

    // Stitch audio segments together
    console.log('🧵 Stitching audio segments...');
    const stitchedAudio = await this.audioStitchingService.stitchAudioSegments(audioSegments, input.format || 'mp3');
    
    // Upload final audio
    const audioUrl = await this.uploadAudioToStorage(stitchedAudio, input);
    
    // Calculate final metrics
    const duration = this.audioStitchingService.estimateCombinedDuration(assignedSegments);
    const fileSize = stitchedAudio.length;

    const output: AudioConversionSeam['output'] = {
      audioId: this.generateAudioId(),
      storyId: input.storyId,
      audioUrl: audioUrl,
      duration: duration,
      fileSize: fileSize,
      format: input.format || 'mp3',
      voice: input.voice || 'female', // Legacy field
      speed: input.speed || 1.0,
      progress: {
        percentage: 100,
        status: 'completed',
        message: `Multi-voice audio with ${uniqueCharacters.length} characters completed successfully`,
        estimatedTimeRemaining: 0
      },
      completedAt: new Date(),
      isMultiVoice: true,
      dialogueSegments: assignedSegments,
      characterProfiles: characterProfiles,
      audioSegmentUrls: audioSegmentUrls
    };

    console.log('✅ Multi-voice audio conversion completed');

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
   * Fallback to single-voice conversion for stories without dialogue
   */
  private async convertToSingleVoiceAudio(input: AudioConversionSeam['input'], startTime: number): Promise<ApiResponse<AudioConversionSeam['output']>> {
    console.log('🔊 Converting to single-voice audio...');

    // Clean HTML content for text-to-speech
    const cleanText = this.cleanHtmlForTTS(input.content);

    // Generate audio using ElevenLabs
    const audioData = await this.callElevenLabsAPI(cleanText, input);

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
        message: 'Single-voice audio conversion completed successfully',
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
   * Generates audio for a character dialogue segment
   */
  private async generateCharacterAudio(segment: DialogueSegment, characterProfile?: CharacterVoiceProfile): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(segment.text);
    }

    const voiceId = characterProfile?.elevenLabsVoiceId || this.characterVoiceService.getVoiceId(segment.voiceType);
    const voiceSettings = characterProfile 
      ? this.characterVoiceService.getVoiceSettings(segment.voiceType, segment.emotionalTone)
      : this.getDefaultVoiceSettings();

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: segment.text,
          model_id: 'eleven_multilingual_v2', // Use v2 for better multi-voice support
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
      console.error(`ElevenLabs API error for character ${segment.speaker}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generates audio for narrative text using narrator voice
   */
  private async generateNarrativeAudio(text: string): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(text);
    }

    const voiceId = this.characterVoiceService.getVoiceId('narrator');
    const voiceSettings = this.characterVoiceService.getVoiceSettings('narrator', 'neutral');

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_multilingual_v2',
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
      console.error('ElevenLabs API error for narrative:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Detects if content contains dialogue in [Speaker]: format
   */
  private detectDialogueFormat(content: string): boolean {
    const cleanContent = this.stripHtmlTags(content);
    const dialoguePattern = /\[([^\]]+)\]:\s*(.+)/;
    return dialoguePattern.test(cleanContent);
  }

  /**
   * Detects the main creature type from story content
   */
  private detectStoryCreature(content: string): CreatureType {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('vampire') || lowerContent.includes('blood') || lowerContent.includes('fang')) {
      return 'vampire';
    }
    if (lowerContent.includes('werewolf') || lowerContent.includes('wolf') || lowerContent.includes('howl')) {
      return 'werewolf';
    }
    if (lowerContent.includes('fairy') || lowerContent.includes('fae') || lowerContent.includes('magic')) {
      return 'fairy';
    }
    
    // Default to vampire if unclear
    return 'vampire';
  }

  /**
   * Gets default voice settings
   */
  private getDefaultVoiceSettings() {
    return {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    };
  }

  private async callElevenLabsAPI(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      // Return mock audio data if no API key
      return this.generateMockAudioData(text);
    }

    const voiceId = this.voiceIds[input.voice || 'female'];

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
          timeout: 60000 // 60 seconds timeout
        }
      );

      return Buffer.from(response.data);

    } catch (error: any) {
      console.error('ElevenLabs API error:', error.response?.data || error.message);
      throw error;
    }
  }

  private async uploadAudioToStorage(audioData: Buffer, input: AudioConversionSeam['input'], segmentId?: string): Promise<string> {
    // Mock storage upload - in real implementation, this would upload to S3, Cloudinary, etc.
    const filename = segmentId 
      ? `story-${input.storyId}-${segmentId}.${input.format || 'mp3'}`
      : `story-${input.storyId}-audio.${input.format || 'mp3'}`;

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock URL
    return `https://storage.example.com/audio/${filename}`;
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

  /**
   * Removes HTML tags from content for text processing
   */
  private stripHtmlTags(content: string): string {
    return content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }
}