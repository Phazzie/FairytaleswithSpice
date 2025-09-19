import axios from 'axios';
import { AudioConversionSeam, ApiResponse, CharacterVoiceType, MultiVoiceAudioSegment, DialogueSegment, EmotionalContext } from '../types/contracts';
import { DialogueParsingService } from './dialogueParsingService';

export class AudioService {
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  private dialogueParser = new DialogueParsingService();

  // Enhanced voice mapping for character-specific voices
  private characterVoiceIds = {
    // Vampire voices (deep, seductive)
    'vampire-male': process.env.ELEVENLABS_VOICE_VAMPIRE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam (deep)
    'vampire-female': process.env.ELEVENLABS_VOICE_VAMPIRE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella (seductive)
    
    // Werewolf voices (gruff, powerful)
    'werewolf-male': process.env.ELEVENLABS_VOICE_WEREWOLF_MALE || 'pMsXgVXv3BLzUgSXRplE', // Ethan (gruff)
    'werewolf-female': process.env.ELEVENLABS_VOICE_WEREWOLF_FEMALE || 'IKne3meq5aSn9XLyUdCD', // Charlie (strong)
    
    // Fairy voices (ethereal, mystical)  
    'fairy-male': process.env.ELEVENLABS_VOICE_FAIRY_MALE || '21m00Tcm4TlvDq8ikWAM', // Rachel (neutral, ethereal)
    'fairy-female': process.env.ELEVENLABS_VOICE_FAIRY_FEMALE || 'joCqP5bR9XbUE0JMxFwZ', // Dorothy (mystical)
    
    // Human voices (relatable, emotional)
    'human-male': process.env.ELEVENLABS_VOICE_HUMAN_MALE || 'flq6f7yk4E4fJM5XTYuZ', // Michael (emotional)
    'human-female': process.env.ELEVENLABS_VOICE_HUMAN_FEMALE || 'jBpfuIE2acCO8z3wKNLl', // Gigi (relatable)
    
    // Narrator voice
    'narrator': process.env.ELEVENLABS_VOICE_NARRATOR || '21m00Tcm4TlvDq8ikWAM' // Rachel (clear, neutral)
  };

  // Legacy voice mapping for fallback
  private voiceIds = {
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM' // Rachel
  };

  constructor() {
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();

    try {
      // Check if multi-voice is enabled
      if (input.multiVoice) {
        return await this.convertToMultiVoiceAudio(input, startTime);
      } else {
        return await this.convertToSingleVoiceAudio(input, startTime);
      }
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

  /**
   * Convert story to multi-voice audio with character-specific voices
   */
  private async convertToMultiVoiceAudio(input: AudioConversionSeam['input'], startTime: number): Promise<ApiResponse<AudioConversionSeam['output']>> {
    // Parse dialogue segments
    const segments = this.dialogueParser.parseDialogue(input.content, input.creatureType);
    
    if (segments.length === 0) {
      throw new Error('No valid content segments found for audio conversion');
    }

    // Generate audio for each segment
    const audioSegments: MultiVoiceAudioSegment[] = [];
    let totalDuration = 0;
    let totalFileSize = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      try {
        // Generate audio for this segment
        const audioData = await this.generateSegmentAudio(segment, input);
        
        // Create audio segment record
        const audioSegment: MultiVoiceAudioSegment = {
          segmentId: this.generateSegmentId(),
          dialogueSegment: segment,
          audioUrl: await this.uploadSegmentToStorage(audioData, segment, input),
          duration: this.estimateDuration(segment.content),
          fileSize: audioData.length,
          voiceUsed: segment.characterType || 'narrator',
          generatedAt: new Date()
        };

        audioSegments.push(audioSegment);
        totalDuration += audioSegment.duration;
        totalFileSize += audioSegment.fileSize;

        // Update progress
        const progress = Math.floor(((i + 1) / segments.length) * 80); // Reserve 20% for stitching
        console.log(`Audio generation progress: ${progress}% (${i + 1}/${segments.length} segments)`);

      } catch (segmentError: any) {
        console.error(`Failed to generate audio for segment ${i}:`, segmentError);
        // Continue with other segments but log the error
      }
    }

    if (audioSegments.length === 0) {
      throw new Error('Failed to generate audio for any segments');
    }

    // Stitch segments together (mock implementation)
    const finalAudioUrl = await this.stitchAudioSegments(audioSegments, input);

    // Extract unique characters for voice mapping
    const charactersDetected = [...new Set(segments
      .filter(s => s.characterName)
      .map(s => s.characterName!)
    )];

    const voiceMapping: { [characterName: string]: CharacterVoiceType } = {};
    segments.forEach(segment => {
      if (segment.characterName && segment.characterType) {
        voiceMapping[segment.characterName] = segment.characterType;
      }
    });

    // Create response
    const output: AudioConversionSeam['output'] = {
      audioId: this.generateAudioId(),
      storyId: input.storyId,
      audioUrl: finalAudioUrl,
      duration: totalDuration,
      fileSize: totalFileSize,
      format: input.format || 'mp3',
      speed: input.speed || 1.0,
      progress: {
        percentage: 100,
        status: 'completed',
        message: `Multi-voice audio generated with ${audioSegments.length} segments`,
        estimatedTimeRemaining: 0
      },
      completedAt: new Date(),
      isMultiVoice: true,
      segments: audioSegments,
      charactersDetected,
      voiceMapping
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
   * Convert story to single voice audio (legacy method)
   */
  private async convertToSingleVoiceAudio(input: AudioConversionSeam['input'], startTime: number): Promise<ApiResponse<AudioConversionSeam['output']>> {
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
   * Generate audio for a single dialogue segment with character-specific voice and emotional inflection
   */
  private async generateSegmentAudio(segment: DialogueSegment, input: AudioConversionSeam['input']): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      // Return mock audio data if no API key
      return this.generateMockAudioData(segment.content);
    }

    const voiceId = this.getVoiceIdForCharacter(segment.characterType || 'narrator');
    const voiceSettings = this.getVoiceSettingsForEmotion(segment.emotionalContext || 'neutral', segment.characterType);

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: segment.content,
          model_id: 'eleven_multilingual_v2', // Updated to v3 equivalent model
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
      console.error(`ElevenLabs API error for segment ${segment.id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Original ElevenLabs API call for single-voice generation
   */
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

  /**
   * Get voice ID for character type
   */
  private getVoiceIdForCharacter(characterType: CharacterVoiceType): string {
    return this.characterVoiceIds[characterType] || this.characterVoiceIds['narrator'];
  }

  /**
   * Get voice settings adjusted for emotional context and character type
   */
  private getVoiceSettingsForEmotion(emotion: EmotionalContext, characterType?: CharacterVoiceType) {
    const baseSettings = {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    };

    // Adjust settings based on character type
    if (characterType?.includes('vampire')) {
      baseSettings.stability = 0.3; // More dramatic
      baseSettings.style = 0.7; // More expressive
    } else if (characterType?.includes('werewolf')) {
      baseSettings.stability = 0.7; // More gruff/stable
      baseSettings.similarity_boost = 0.9; // More intense
    } else if (characterType?.includes('fairy')) {
      baseSettings.stability = 0.2; // More ethereal/variable
      baseSettings.style = 0.8; // Very expressive
    }

    // Adjust settings based on emotion
    switch (emotion) {
      case 'seductive':
        return {
          ...baseSettings,
          stability: Math.max(0.1, baseSettings.stability - 0.2),
          style: Math.min(1.0, baseSettings.style + 0.3)
        };
      case 'passionate':
        return {
          ...baseSettings,
          stability: Math.max(0.1, baseSettings.stability - 0.3),
          similarity_boost: Math.min(1.0, baseSettings.similarity_boost + 0.1),
          style: Math.min(1.0, baseSettings.style + 0.4)
        };
      case 'mysterious':
        return {
          ...baseSettings,
          stability: Math.max(0.1, baseSettings.stability - 0.1),
          style: Math.min(1.0, baseSettings.style + 0.2)
        };
      case 'tender':
        return {
          ...baseSettings,
          stability: Math.min(1.0, baseSettings.stability + 0.2),
          style: Math.max(0.0, baseSettings.style - 0.1)
        };
      case 'intense':
        return {
          ...baseSettings,
          stability: Math.max(0.1, baseSettings.stability - 0.2),
          similarity_boost: Math.min(1.0, baseSettings.similarity_boost + 0.2)
        };
      case 'desperate':
        return {
          ...baseSettings,
          stability: Math.max(0.1, baseSettings.stability - 0.4),
          style: Math.min(1.0, baseSettings.style + 0.5)
        };
      case 'fearful':
        return {
          ...baseSettings,
          stability: Math.max(0.1, baseSettings.stability - 0.3),
          style: Math.min(1.0, baseSettings.style + 0.3)
        };
      default: // neutral
        return baseSettings;
    }
  }

  /**
   * Upload individual audio segment to storage
   */
  private async uploadSegmentToStorage(audioData: Buffer, segment: DialogueSegment, input: AudioConversionSeam['input']): Promise<string> {
    // Mock storage upload - in real implementation, this would upload to S3, Cloudinary, etc.
    const filename = `story-${input.storyId}-segment-${segment.id}.${input.format || 'mp3'}`;

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return mock URL
    return `https://storage.example.com/audio/segments/${filename}`;
  }

  /**
   * Stitch audio segments together into a single audio file
   */
  private async stitchAudioSegments(segments: MultiVoiceAudioSegment[], input: AudioConversionSeam['input']): Promise<string> {
    // Mock audio stitching - in real implementation, this would use ffmpeg or similar
    const filename = `story-${input.storyId}-complete.${input.format || 'mp3'}`;

    // Simulate stitching delay based on number of segments
    const stitchingDelay = Math.min(5000, segments.length * 500);
    await new Promise(resolve => setTimeout(resolve, stitchingDelay));

    console.log(`Stitched ${segments.length} audio segments into complete audio file`);

    // Return mock URL for complete audio file
    return `https://storage.example.com/audio/complete/${filename}`;
  }

  private async uploadAudioToStorage(audioData: Buffer, input: AudioConversionSeam['input']): Promise<string> {
    // Mock storage upload - in real implementation, this would upload to S3, Cloudinary, etc.
    const filename = `story-${input.storyId}-audio.${input.format || 'mp3'}`;

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

  private generateSegmentId(): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}