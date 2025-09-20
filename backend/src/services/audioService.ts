import axios from 'axios';
import { AudioConversionSeam, ApiResponse, DialogueSegment, CharacterVoiceType } from '../types/contracts';
import { DialogueParser } from './dialogueParser';

// Emotion types for voice adjustment
export type EmotionType = 'seductive' | 'fearful' | 'angry' | 'passionate' | 'sad' | 'joyful' | 'mysterious' | 'neutral';

interface EmotionalVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

interface DetectedEmotion {
  character?: string;
  emotion: EmotionType;
  dialogue: string;
}

export class AudioService {
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  private dialogueParser = new DialogueParser();

  // Enhanced voice IDs for character-specific voices (11Labs voice IDs)
  private characterVoiceIds = {
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
  private voiceIds = {
    female: this.characterVoiceIds.human_female,
    male: this.characterVoiceIds.human_male,
    neutral: this.characterVoiceIds.narrator
  };

  constructor() {
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();

    try {
      // Determine if multi-voice generation should be used
      const enableMultiVoice = input.enableMultiVoice !== false; // Default to true
      
      if (enableMultiVoice) {
        return await this.generateMultiVoiceAudio(input, startTime);
      } else {
        return await this.generateSingleVoiceAudio(input, startTime);
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
   * Generate multi-voice audio from dialogue segments
   */
  private async generateMultiVoiceAudio(input: AudioConversionSeam['input'], startTime: number): Promise<ApiResponse<AudioConversionSeam['output']>> {
    // Parse dialogue segments from story content
    const dialogueSegments = this.dialogueParser.parseStoryDialogue(input.content, input.creatureType);
    
    if (dialogueSegments.length === 0) {
      // Fall back to single voice if no dialogue found
      return await this.generateSingleVoiceAudio(input, startTime);
    }

    // Generate audio segments for each dialogue piece
    const audioSegments: DialogueSegment[] = [];
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
        
      } catch (segmentError) {
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
    const output: AudioConversionSeam['output'] = {
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
  private async generateSingleVoiceAudio(input: AudioConversionSeam['input'], startTime: number): Promise<ApiResponse<AudioConversionSeam['output']>> {
    // Clean HTML content for text-to-speech
    const cleanText = this.cleanHtmlForTTS(input.content);

    // Generate audio using ElevenLabs
    const audioData = await this.callElevenLabsAPI(cleanText, input);

    // Upload to storage and get URL
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
  private async generateSegmentAudio(segment: DialogueSegment, input: AudioConversionSeam['input']): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(segment.text);
    }

    const voiceId = this.characterVoiceIds[segment.voiceType];
    const voiceSettings = this.getVoiceSettings(segment.voiceType, segment.emotion);

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: segment.text,
          model_id: 'eleven_multilingual_v2', // Using v2 for better quality
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
      console.error(`ElevenLabs API error for ${segment.speaker}:`, error.response?.data || error.message);
      
      // Fallback to default voice if character voice fails
      return await this.generateFallbackAudio(segment.text, input);
    }
  }

  /**
   * Get voice settings based on character type and emotion
   */
  private getVoiceSettings(voiceType: CharacterVoiceType, emotion?: string) {
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
  private async generateFallbackAudio(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    const fallbackVoiceId = this.voiceIds[input.voice || 'female'];
    
    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${fallbackVoiceId}`,
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
    } catch (error) {
      // Final fallback to mock data
      return this.generateMockAudioData(text);
    }
  }

  /**
   * Upload individual audio segment to storage
   */
  private async uploadAudioSegment(audioData: Buffer, segment: DialogueSegment, input: AudioConversionSeam['input']): Promise<string> {
    const filename = `story-${input.storyId}-segment-${segment.speaker}-${Date.now()}.${input.format || 'mp3'}`;
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return `https://storage.example.com/audio/segments/${filename}`;
  }

  /**
   * Compile audio segments into final multi-voice audio file
   */
  private async compileAudioSegments(segments: DialogueSegment[], input: AudioConversionSeam['input']): Promise<string> {
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
  private estimateSegmentDuration(text: string): number {
    const wordsPerSecond = 2.5;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerSecond);
  }

  /**
   * Estimate file size based on duration
   */
  private estimateFileSize(durationSeconds: number): number {
    // MP3 at 128kbps = ~16KB per second
    return Math.ceil(durationSeconds * 16 * 1024);
  }
  /**
   * Legacy API call for single voice generation
   */
  private async callElevenLabsAPI(text: string, input: AudioConversionSeam['input']): Promise<Buffer> {
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

  /**
   * Detects emotion from text containing emotion tags in format: [Character, emotion]: "dialogue"
   * Also attempts to infer emotion from context if no explicit tags are found
   */
  private detectEmotion(text: string): DetectedEmotion[] {
    const emotions: DetectedEmotion[] = [];
    
    // Regex to match emotion tags: [Character Name, emotion]: "dialogue"
    const emotionTagRegex = /\[([^,]+),\s*([^\]]+)\]:\s*(.+?)(?=\s*\[|$)/gi;
    let match;
    
    while ((match = emotionTagRegex.exec(text)) !== null) {
      const character = match[1].trim();
      const emotion = match[2].trim().toLowerCase() as EmotionType;
      const dialogue = match[3].trim();
      
      // Validate emotion type
      const validEmotions: EmotionType[] = ['seductive', 'fearful', 'angry', 'passionate', 'sad', 'joyful', 'mysterious', 'neutral'];
      if (validEmotions.includes(emotion)) {
        emotions.push({ character, emotion, dialogue });
      } else {
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
  private inferEmotionFromContext(text: string): EmotionType {
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
    let detectedEmotion: EmotionType = 'neutral';
    
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedEmotion = emotion as EmotionType;
      }
    }
    
    return detectedEmotion;
  }

  /**
   * Maps emotions to appropriate ElevenLabs voice settings
   */
  private getEmotionalVoiceSettings(emotion: EmotionType): EmotionalVoiceSettings {
    const emotionSettings: Record<EmotionType, EmotionalVoiceSettings> = {
      seductive: {
        stability: 0.3,        // Lower stability for more variation
        similarity_boost: 0.9, // High similarity to maintain voice
        style: 0.8,           // Higher style for sultry delivery
        use_speaker_boost: true
      },
      fearful: {
        stability: 0.1,        // Very low stability for trembling effect
        similarity_boost: 0.7, // Moderate similarity
        style: 0.3,           // Lower style for more natural fear
        use_speaker_boost: false
      },
      angry: {
        stability: 0.2,        // Low stability for aggressive variation
        similarity_boost: 0.8, // Good similarity
        style: 0.9,           // High style for emphasis
        use_speaker_boost: true
      },
      passionate: {
        stability: 0.4,        // Moderate stability
        similarity_boost: 0.9, // High similarity
        style: 0.7,           // High style for intensity
        use_speaker_boost: true
      },
      sad: {
        stability: 0.7,        // Higher stability for consistent low energy
        similarity_boost: 0.8, // Good similarity
        style: 0.2,           // Lower style for softer tone
        use_speaker_boost: false
      },
      joyful: {
        stability: 0.3,        // Lower stability for energetic variation
        similarity_boost: 0.8, // Good similarity
        style: 0.6,           // Moderate style for upbeat delivery
        use_speaker_boost: true
      },
      mysterious: {
        stability: 0.6,        // Moderate stability
        similarity_boost: 0.9, // High similarity
        style: 0.8,           // High style for dramatic effect
        use_speaker_boost: false
      },
      neutral: {
        stability: 0.5,        // Default settings
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true
      }
    };
    
    return emotionSettings[emotion] || emotionSettings.neutral;
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

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}