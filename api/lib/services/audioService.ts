import axios from 'axios';
import { AudioConversionSeam, ApiResponse, CharacterVoiceType } from '../types/contracts';

export class AudioService {
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  // Voice IDs for different voice types (ElevenLabs voice IDs)
  private voiceIds = {
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

  // Comprehensive emotion to voice settings mapping (90+ emotions)
  private emotionVoiceSettings = {
    // Basic emotions (7)
    'neutral': { stability: 0.7, similarity_boost: 0.8, style: 0.2 },
    'happy': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'sad': { stability: 0.8, similarity_boost: 0.9, style: 0.6 },
    'angry': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'fearful': { stability: 0.2, similarity_boost: 0.5, style: 0.7 },
    'surprised': { stability: 0.1, similarity_boost: 0.6, style: 0.9 },
    'disgusted': { stability: 0.6, similarity_boost: 0.7, style: 0.5 },
    
    // Romantic/intimate emotions (16)
    'seductive': { stability: 0.2, similarity_boost: 0.7, style: 0.8 },
    'passionate': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'tender': { stability: 0.8, similarity_boost: 0.9, style: 0.4 },
    'lustful': { stability: 0.1, similarity_boost: 0.5, style: 1.0 },
    'romantic': { stability: 0.5, similarity_boost: 0.8, style: 0.7 },
    'intimate': { stability: 0.6, similarity_boost: 0.8, style: 0.6 },
    'yearning': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'breathless': { stability: 0.2, similarity_boost: 0.6, style: 0.9 },
    'aroused': { stability: 0.1, similarity_boost: 0.5, style: 0.9 },
    'devoted': { stability: 0.7, similarity_boost: 0.8, style: 0.5 },
    'adoring': { stability: 0.5, similarity_boost: 0.8, style: 0.7 },
    'longing': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'satisfied': { stability: 0.6, similarity_boost: 0.8, style: 0.4 },
    'craving': { stability: 0.2, similarity_boost: 0.6, style: 0.9 },
    'worshiping': { stability: 0.5, similarity_boost: 0.8, style: 0.6 },
    'desiring': { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
    
    // Physical/sensual emotions (12)
    'panting': { stability: 0.1, similarity_boost: 0.4, style: 0.8 },
    'gasping': { stability: 0.1, similarity_boost: 0.3, style: 0.9 },
    'trembling': { stability: 0.2, similarity_boost: 0.5, style: 0.7 },
    'shivering': { stability: 0.3, similarity_boost: 0.6, style: 0.6 },
    'aching': { stability: 0.4, similarity_boost: 0.7, style: 0.7 },
    'tingling': { stability: 0.2, similarity_boost: 0.6, style: 0.8 },
    'feverish': { stability: 0.2, similarity_boost: 0.5, style: 0.8 },
    'dizzy': { stability: 0.3, similarity_boost: 0.6, style: 0.7 },
    'exhausted': { stability: 0.8, similarity_boost: 0.8, style: 0.3 },
    'invigorated': { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
    'weakened': { stability: 0.7, similarity_boost: 0.8, style: 0.4 },
    'energized': { stability: 0.2, similarity_boost: 0.6, style: 0.9 },
    
    // Complex emotional states (26)
    'anxious': { stability: 0.2, similarity_boost: 0.5, style: 0.8 },
    'excited': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'confident': { stability: 0.6, similarity_boost: 0.8, style: 0.5 },
    'nervous': { stability: 0.1, similarity_boost: 0.4, style: 0.7 },
    'amused': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'confused': { stability: 0.3, similarity_boost: 0.6, style: 0.6 },
    'determined': { stability: 0.7, similarity_boost: 0.8, style: 0.6 },
    'defiant': { stability: 0.4, similarity_boost: 0.6, style: 0.8 },
    'pleading': { stability: 0.3, similarity_boost: 0.7, style: 0.9 },
    'threatening': { stability: 0.5, similarity_boost: 0.7, style: 0.8 },
    'mocking': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'sarcastic': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'playful': { stability: 0.3, similarity_boost: 0.7, style: 0.9 },
    'serious': { stability: 0.8, similarity_boost: 0.9, style: 0.3 },
    'mysterious': { stability: 0.6, similarity_boost: 0.8, style: 0.7 },
    'sultry': { stability: 0.2, similarity_boost: 0.6, style: 0.9 },
    'whispering': { stability: 0.9, similarity_boost: 0.9, style: 0.2 },
    'shouting': { stability: 0.1, similarity_boost: 0.4, style: 1.0 },
    'desperate': { stability: 0.2, similarity_boost: 0.5, style: 0.9 },
    'hopeful': { stability: 0.5, similarity_boost: 0.7, style: 0.6 },
    'devastated': { stability: 0.6, similarity_boost: 0.8, style: 0.7 },
    'elated': { stability: 0.2, similarity_boost: 0.6, style: 0.9 },
    'melancholy': { stability: 0.7, similarity_boost: 0.8, style: 0.5 },
    'euphoric': { stability: 0.1, similarity_boost: 0.5, style: 1.0 },
    'bitter': { stability: 0.5, similarity_boost: 0.7, style: 0.7 },
    'envious': { stability: 0.4, similarity_boost: 0.6, style: 0.8 },
    
    // Social/power dynamics (12)
    'dominant': { stability: 0.6, similarity_boost: 0.8, style: 0.7 },
    'submissive': { stability: 0.7, similarity_boost: 0.8, style: 0.4 },
    'possessive': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'jealous': { stability: 0.3, similarity_boost: 0.6, style: 0.8 },
    'vulnerable': { stability: 0.6, similarity_boost: 0.8, style: 0.6 },
    'manipulative': { stability: 0.5, similarity_boost: 0.7, style: 0.8 },
    'trusting': { stability: 0.7, similarity_boost: 0.8, style: 0.4 },
    'betrayed': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'loyal': { stability: 0.8, similarity_boost: 0.9, style: 0.4 },
    'rebellious': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'obedient': { stability: 0.8, similarity_boost: 0.8, style: 0.3 },
    'independent': { stability: 0.6, similarity_boost: 0.8, style: 0.5 },
    
    // Supernatural/fantasy emotions (18)
    'otherworldly': { stability: 0.3, similarity_boost: 0.5, style: 0.9 },
    'ethereal': { stability: 0.7, similarity_boost: 0.6, style: 0.8 },
    'sinister': { stability: 0.4, similarity_boost: 0.6, style: 0.8 },
    'enchanting': { stability: 0.4, similarity_boost: 0.7, style: 0.9 },
    'hypnotic': { stability: 0.5, similarity_boost: 0.8, style: 0.7 },
    'predatory': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'protective': { stability: 0.6, similarity_boost: 0.8, style: 0.5 },
    'primal': { stability: 0.2, similarity_boost: 0.5, style: 1.0 },
    'magical': { stability: 0.4, similarity_boost: 0.6, style: 0.8 },
    'ancient': { stability: 0.8, similarity_boost: 0.9, style: 0.4 },
    'bloodthirsty': { stability: 0.2, similarity_boost: 0.5, style: 0.9 },
    'feral': { stability: 0.1, similarity_boost: 0.4, style: 1.0 },
    'enchanted': { stability: 0.5, similarity_boost: 0.7, style: 0.8 },
    'cursed': { stability: 0.4, similarity_boost: 0.6, style: 0.8 },
    'blessed': { stability: 0.7, similarity_boost: 0.8, style: 0.5 },
    'haunted': { stability: 0.5, similarity_boost: 0.7, style: 0.7 },
    'possessed': { stability: 0.2, similarity_boost: 0.5, style: 0.9 },
    'transcendent': { stability: 0.6, similarity_boost: 0.8, style: 0.6 },
    
    // Intensity variations (16)
    'gentle': { stability: 0.8, similarity_boost: 0.9, style: 0.3 },
    'fierce': { stability: 0.2, similarity_boost: 0.5, style: 1.0 },
    'intense': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'subtle': { stability: 0.9, similarity_boost: 0.9, style: 0.1 },
    'bold': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'timid': { stability: 0.8, similarity_boost: 0.8, style: 0.3 },
    'aggressive': { stability: 0.2, similarity_boost: 0.5, style: 0.9 },
    'calm': { stability: 0.9, similarity_boost: 0.9, style: 0.2 },
    'wild': { stability: 0.1, similarity_boost: 0.4, style: 1.0 },
    'controlled': { stability: 0.8, similarity_boost: 0.9, style: 0.3 },
    'regal': { stability: 0.8, similarity_boost: 0.9, style: 0.5 },
    'noble': { stability: 0.7, similarity_boost: 0.8, style: 0.4 },
    'common': { stability: 0.6, similarity_boost: 0.7, style: 0.6 },
    'formal': { stability: 0.8, similarity_boost: 0.8, style: 0.3 },
    'casual': { stability: 0.5, similarity_boost: 0.7, style: 0.6 },
    'refined': { stability: 0.7, similarity_boost: 0.8, style: 0.4 }
  };

  // Intensity modifiers for dynamic emotion scaling
  private intensityModifiers = {
    'slightly': { stabilityMod: 0.1, styleMod: -0.1 },
    'somewhat': { stabilityMod: 0.05, styleMod: -0.05 },
    'very': { stabilityMod: -0.1, styleMod: 0.15 },
    'extremely': { stabilityMod: -0.2, styleMod: 0.25 },
    'utterly': { stabilityMod: -0.3, styleMod: 0.3 },
    'barely': { stabilityMod: 0.2, styleMod: -0.2 },
    'overwhelmingly': { stabilityMod: -0.25, styleMod: 0.35 }
  };

  constructor() {
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  async convertToAudio(input: AudioConversionSeam['input']): Promise<ApiResponse<AudioConversionSeam['output']>> {
    const startTime = Date.now();

    try {
      // Use rawContent if available (with speaker tags), otherwise fall back to content
      // This allows us to process speaker-tagged content for multi-voice audio
      const sourceContent = (input as any).rawContent || input.content;
      
      // Check if content has speaker tags for multi-voice processing
      const hasSpaekerTags = sourceContent.includes('[') && sourceContent.includes(']:');
      
      let audioData: Buffer;
      
      if (hasSpaekerTags) {
        // Process with multi-voice and emotion support
        audioData = await this.processMultiVoiceAudio(sourceContent, input);
      } else {
        // Standard single-voice processing
        const cleanText = this.cleanHtmlForTTS(sourceContent);
        audioData = await this.callElevenLabsAPI(cleanText, input);
      }

      // Upload to storage and get URL (mock implementation)
      const audioUrl = await this.uploadAudioToStorage(audioData, input);

      // Create response
      const output: AudioConversionSeam['output'] = {
        audioId: this.generateAudioId(),
        storyId: input.storyId,
        audioUrl: audioUrl,
        duration: this.estimateDuration(this.cleanHtmlForTTS(sourceContent)),
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

  private async processMultiVoiceAudio(taggedContent: string, input: AudioConversionSeam['input']): Promise<Buffer> {
    // Split content by speaker tags and process each segment with appropriate voice and emotion
    const segments = this.splitBySpeakerTags(taggedContent);
    const audioSegments: Buffer[] = [];
    
    for (const segment of segments) {
      if (!segment.text.trim()) continue;
      
      // Determine voice for this speaker
      const voice = this.getVoiceForSpeaker(segment.speaker, input.voice || 'female');
      
      // Create input for this segment
      const segmentInput = {
        ...input,
        voice: voice as any
      };
      
      // Generate audio with emotion
      const segmentAudio = await this.callElevenLabsAPIWithEmotion(
        segment.text,
        segmentInput,
        segment.emotion
      );
      
      audioSegments.push(segmentAudio);
      
      // Add small pause between speakers (except for last segment)
      if (segments.indexOf(segment) < segments.length - 1) {
        const pauseAudio = this.generatePauseAudio(0.3); // 300ms pause
        audioSegments.push(pauseAudio);
      }
    }
    
    // Combine all audio segments
    return this.combineAudioBuffers(audioSegments);
  }

  private splitBySpeakerTags(content: string): Array<{ speaker: string; emotion?: string; text: string }> {
    const segments: Array<{ speaker: string; emotion?: string; text: string }> = [];
    
    // Split by speaker tags using regex
    const parts = content.split(/(\[[^\]]+\]:)/);
    
    let currentSpeaker = 'Narrator';
    let currentEmotion: string | undefined;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      if (part.match(/^\[[^\]]+\]:$/)) {
        // This is a speaker tag
        const parsed = this.extractEmotionFromSpeakerTag(part);
        currentSpeaker = parsed.speaker;
        currentEmotion = parsed.emotion;
      } else if (part && !part.match(/^\[[^\]]+\]:$/)) {
        // This is text content
        segments.push({
          speaker: currentSpeaker,
          emotion: currentEmotion,
          text: this.optimizeForSpeech(part)
        });
      }
    }
    
    return segments.filter(seg => seg.text.trim().length > 0);
  }

  private generatePauseAudio(durationSeconds: number): Buffer {
    // Generate silent audio buffer for pauses between speakers
    const sampleRate = 44100;
    const channels = 2;
    const bitsPerSample = 16;
    const numSamples = Math.floor(durationSeconds * sampleRate);
    
    // Create buffer filled with zeros (silence)
    return Buffer.alloc(numSamples * channels * (bitsPerSample / 8));
  }

  private combineAudioBuffers(buffers: Buffer[]): Buffer {
    // Simple concatenation of audio buffers
    // In a real implementation, you might want to handle audio headers properly
    return Buffer.concat(buffers);
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

  private async callElevenLabsAPIWithEmotion(text: string, input: AudioConversionSeam['input'], emotion?: string): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      // Return mock audio data if no API key
      return this.generateMockAudioData(text);
    }

    const voiceId = this.voiceIds[input.voice || 'female'];
    
    // Get dynamic emotion-specific voice settings using new system
    const voiceSettings = this.getEmotionVoiceSettings(emotion);

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

  private async callElevenLabsAPIForVoice(text: string, input: AudioConversionSeam['input'], voice: CharacterVoiceType): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      // Return mock audio data if no API key
      return this.generateMockAudioData(text);
    }

    const voiceId = this.voiceIds[voice];
    
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

  private extractEmotionFromSpeakerTag(speakerTag: string): { speaker: string; emotion?: string } {
    // Parse speaker tags with advanced emotion support:
    // [Character Name]: normal speech
    // [Character Name, emotion]: single emotion
    // [Character Name, emotion1+emotion2]: emotion blend
    // [Character Name, very_emotion]: intensity modifier
    // [Narrator]: descriptive text
    // [Narrator, intimate]: intimate narration
    
    const match = speakerTag.match(/\[([^,\]]+)(?:,\s*([^,\]]+))?\]/);
    
    if (match) {
      const speaker = match[1].trim();
      const emotionStr = match[2] ? match[2].trim() : undefined;
      
      if (emotionStr) {
        // Process dynamic emotions (blends, intensities, etc.)
        const processedEmotion = this.processDynamicEmotion(emotionStr);
        return { speaker, emotion: processedEmotion };
      }
      
      return { speaker, emotion: emotionStr };
    }
    
    return { speaker: speakerTag };
  }

  private processDynamicEmotion(emotionStr: string): string {
    // Handle various emotion formats:
    // "passionate+desperate" -> emotion blend
    // "very_seductive" -> intensity modifier
    // "extremely_angry" -> strong intensity
    // "slightly_nervous" -> weak intensity
    
    // Check for intensity modifiers
    const intensityMatch = emotionStr.match(/^(slightly|somewhat|very|extremely|utterly|barely|overwhelmingly)_(.+)$/);
    if (intensityMatch) {
      const [, intensity, baseEmotion] = intensityMatch;
      return `${intensity}_${baseEmotion}`;
    }
    
    // Check for emotion blends
    if (emotionStr.includes('+')) {
      const emotions = emotionStr.split('+').map(e => e.trim());
      return `blend_${emotions.join('_')}`;
    }
    
    return emotionStr;
  }

  private getEmotionVoiceSettings(emotion?: string): any {
    if (!emotion) {
      return {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      };
    }

    // Handle intensity modifiers
    const intensityMatch = emotion.match(/^(slightly|somewhat|very|extremely|utterly|barely|overwhelmingly)_(.+)$/);
    if (intensityMatch) {
      const [, intensity, baseEmotion] = intensityMatch;
      return this.applyIntensityModifier(baseEmotion, intensity);
    }

    // Handle emotion blends
    if (emotion.startsWith('blend_')) {
      const emotions = emotion.replace('blend_', '').split('_');
      return this.blendEmotions(emotions);
    }

    // Handle regular emotions
    const emotionKey = emotion.toLowerCase() as keyof typeof this.emotionVoiceSettings;
    const emotionSettings = this.emotionVoiceSettings[emotionKey];
    
    if (emotionSettings) {
      return {
        ...emotionSettings,
        use_speaker_boost: true
      };
    }

    // Fallback for unknown emotions - try to infer from similar emotions
    return this.inferEmotionSettings(emotion);
  }

  private applyIntensityModifier(baseEmotion: string, intensity: string): any {
    const baseSettings = this.emotionVoiceSettings[baseEmotion.toLowerCase() as keyof typeof this.emotionVoiceSettings];
    const modifier = this.intensityModifiers[intensity as keyof typeof this.intensityModifiers];
    
    if (!baseSettings || !modifier) {
      return {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      };
    }

    return {
      stability: Math.max(0.1, Math.min(0.9, baseSettings.stability + modifier.stabilityMod)),
      similarity_boost: Math.max(0.1, Math.min(0.9, baseSettings.similarity_boost)),
      style: Math.max(0.1, Math.min(1.0, baseSettings.style + modifier.styleMod)),
      use_speaker_boost: true
    };
  }

  private blendEmotions(emotions: string[]): any {
    // Blend multiple emotions by averaging their parameters
    const validEmotions = emotions
      .map(e => e.toLowerCase())
      .filter(e => e in this.emotionVoiceSettings)
      .slice(0, 3); // Max 3 emotions for performance

    if (validEmotions.length === 0) {
      return {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      };
    }

    const blended = validEmotions.reduce((acc, emotion) => {
      const settings = this.emotionVoiceSettings[emotion as keyof typeof this.emotionVoiceSettings];
      acc.stability += settings.stability;
      acc.similarity_boost += settings.similarity_boost;
      acc.style += settings.style;
      return acc;
    }, { stability: 0, similarity_boost: 0, style: 0 });

    const count = validEmotions.length;
    return {
      stability: Math.max(0.1, Math.min(0.9, blended.stability / count)),
      similarity_boost: Math.max(0.1, Math.min(0.9, blended.similarity_boost / count)),
      style: Math.max(0.1, Math.min(1.0, blended.style / count)),
      use_speaker_boost: true
    };
  }

  private inferEmotionSettings(emotion: string): any {
    // AI-like inference for unknown emotions based on keywords
    const emotionLower = emotion.toLowerCase();
    
    // Romantic/sensual keywords
    if (emotionLower.includes('love') || emotionLower.includes('desire') || 
        emotionLower.includes('warm') || emotionLower.includes('soft')) {
      return { stability: 0.5, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true };
    }
    
    // Aggressive/intense keywords
    if (emotionLower.includes('rage') || emotionLower.includes('fury') || 
        emotionLower.includes('harsh') || emotionLower.includes('violent')) {
      return { stability: 0.2, similarity_boost: 0.5, style: 0.9, use_speaker_boost: true };
    }
    
    // Mysterious/supernatural keywords
    if (emotionLower.includes('dark') || emotionLower.includes('shadow') || 
        emotionLower.includes('mystic') || emotionLower.includes('spell')) {
      return { stability: 0.6, similarity_boost: 0.7, style: 0.8, use_speaker_boost: true };
    }
    
    // Sad/melancholy keywords
    if (emotionLower.includes('sorrow') || emotionLower.includes('grief') || 
        emotionLower.includes('mourn') || emotionLower.includes('weep')) {
      return { stability: 0.8, similarity_boost: 0.9, style: 0.6, use_speaker_boost: true };
    }
    
    // Default fallback
    return {
      stability: 0.7,
      similarity_boost: 0.8,
      style: 0.2,
      use_speaker_boost: true
    };
  }

  private getVoiceForSpeaker(speaker: string, fallbackVoice: string = 'female'): string {
    // Map different speaker types to appropriate voices
    const speakerLower = speaker.toLowerCase();
    
    // Narrator always uses neutral voice
    if (speakerLower.includes('narrator')) {
      return 'neutral';
    }
    
    // Character voice assignment based on creature type and gender cues
    if (speakerLower.includes('vampire') || speakerLower.includes('lord') || 
        speakerLower.includes('king') || speakerLower.includes('duke') ||
        speakerLower.includes('prince') || speakerLower.includes('master')) {
      return 'male';
    }
    
    if (speakerLower.includes('werewolf') || speakerLower.includes('alpha') ||
        speakerLower.includes('beta') || speakerLower.includes('pack')) {
      return 'male';
    }
    
    if (speakerLower.includes('fairy') || speakerLower.includes('fae') ||
        speakerLower.includes('lady') || speakerLower.includes('queen') ||
        speakerLower.includes('duchess') || speakerLower.includes('princess')) {
      return 'female';
    }
    
    // Common female names and titles
    const femaleNames = ['sarah', 'emma', 'aria', 'luna', 'aurora', 'isabelle', 'elena', 'sophia'];
    const maleNames = ['drake', 'alexander', 'damien', 'gabriel', 'lucien', 'adrian', 'marcus', 'sebastian'];
    
    if (femaleNames.some(name => speakerLower.includes(name))) {
      return 'female';
    }
    
    if (maleNames.some(name => speakerLower.includes(name))) {
      return 'male';
    }
    
    return fallbackVoice;
  }

  private getSupportedEmotions(): string[] {
    return Object.keys(this.emotionVoiceSettings);
  }

  // Public method to get emotion information for frontend/debugging
  public getEmotionInfo() {
    const emotions = this.getSupportedEmotions();
    return {
      totalEmotions: emotions.length,
      categories: {
        basic: ['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted'],
        romantic: ['seductive', 'passionate', 'tender', 'lustful', 'romantic', 'intimate', 'yearning', 'breathless', 'aroused', 'devoted', 'adoring', 'longing', 'satisfied', 'craving', 'worshiping', 'desiring'],
        physical: ['panting', 'gasping', 'trembling', 'shivering', 'aching', 'tingling', 'feverish', 'dizzy', 'exhausted', 'invigorated', 'weakened', 'energized'],
        complex: ['anxious', 'excited', 'confident', 'nervous', 'amused', 'confused', 'determined', 'defiant', 'pleading', 'threatening', 'mocking', 'sarcastic', 'playful', 'serious', 'mysterious', 'sultry', 'whispering', 'shouting', 'desperate', 'hopeful', 'devastated', 'elated', 'melancholy', 'euphoric', 'bitter', 'envious'],
        social: ['dominant', 'submissive', 'possessive', 'jealous', 'vulnerable', 'manipulative', 'trusting', 'betrayed', 'loyal', 'rebellious', 'obedient', 'independent'],
        supernatural: ['otherworldly', 'ethereal', 'sinister', 'enchanting', 'hypnotic', 'predatory', 'protective', 'primal', 'magical', 'ancient', 'bloodthirsty', 'feral', 'enchanted', 'cursed', 'blessed', 'haunted', 'possessed', 'transcendent'],
        intensity: ['gentle', 'fierce', 'intense', 'subtle', 'bold', 'timid', 'aggressive', 'calm', 'wild', 'controlled', 'regal', 'noble', 'common', 'formal', 'casual', 'refined']
      },
      dynamicFeatures: {
        emotionBlends: {
          description: 'Combine multiple emotions with + syntax',
          examples: ['passionate+desperate', 'seductive+mysterious', 'angry+hurt'],
          maxBlend: 3
        },
        intensityModifiers: {
          description: 'Modify emotion intensity with prefixes',
          modifiers: Object.keys(this.intensityModifiers),
          examples: ['very_seductive', 'extremely_angry', 'slightly_nervous', 'utterly_devastated']
        },
        aiInference: {
          description: 'System can infer settings for unknown emotions',
          examples: ['lovesick', 'heartbroken', 'spellbound', 'enchantress-like']
        }
      },
      allEmotions: emotions,
      exampleUsage: [
        '[Character, seductive]: "Come closer..."',
        '[Vampire Lord, very_threatening]: "You will regret this."',
        '[Sarah, passionate+desperate]: "I need you..."',
        '[Narrator, mysterious+ancient]: Long ago, in shadows deep...',
        '[Fairy Queen, extremely_regal]: "Bow before your queen."',
        '[Werewolf, feral+bloodthirsty]: "The hunt begins."',
        '[Character, slightly_nervous]: "I think... maybe..."'
      ],
      totalPossibleCombinations: 'Infinite (90+ base emotions × 7 intensities × unlimited blends)'
    };
  }

  // Method for testing emotion combinations
  public testEmotionCombination(emotionString: string): any {
    const processed = this.processDynamicEmotion(emotionString);
    const settings = this.getEmotionVoiceSettings(processed);
    
    return {
      original: emotionString,
      processed: processed,
      voiceSettings: settings,
      isBlend: processed.startsWith('blend_'),
      hasIntensity: processed.includes('_') && !processed.startsWith('blend_'),
      isInferred: !Object.keys(this.emotionVoiceSettings).includes(emotionString.toLowerCase())
    };
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

  private async parseAndAssignVoices(text: string, input: AudioConversionSeam['input']): Promise<Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}>> {
    const chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}> = [];
    
    // Split text by speaker tags while preserving the tags
    const segments = text.split(/(\[([^\]]+)\]:\s*)/);
    
    let currentSpeaker = 'Narrator';
    let currentVoice: CharacterVoiceType = 'narrator';
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (!segment) continue;
      
      // Check if this segment is a speaker tag
      const speakerMatch = segment.match(/\[([^\]]+)\]:\s*/);
      
      if (speakerMatch) {
        // This is a speaker tag - update current speaker and voice
        const speakerInfo = speakerMatch[1];
        currentSpeaker = speakerInfo.split(',')[0].trim(); // Remove emotion if present
        currentVoice = this.assignVoiceToSpeaker(currentSpeaker);
      } else if (segment.length > 0) {
        // This is dialogue or narrative text
        try {
          const audioData = await this.callElevenLabsAPIForVoice(segment, input, currentVoice);
          chunks.push({
            speaker: currentSpeaker,
            text: segment,
            voice: currentVoice,
            audioData: audioData
          });
        } catch (error) {
          console.warn(`Failed to generate audio for ${currentSpeaker}: ${error}`);
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
    // Enhanced text processing for multi-voice TTS with speaker tag support
    
    // Step 1: Extract and preserve speaker tags for voice assignment
    const speakerTaggedContent = this.preserveSpeakerTags(htmlContent);
    
    // Step 2: Remove HTML tags but keep structure
    let cleanText = speakerTaggedContent
      .replace(/<h[1-6][^>]*>/gi, '\n\n') // Headers become paragraph breaks
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '\n') // Paragraphs become line breaks
      .replace(/<\/p>/gi, '\n')
      .replace(/<br[^>]*>/gi, '\n') // Line breaks
      .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
      .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace within lines
      .trim();

    // Step 3: Split into processable chunks respecting character limits
    const chunks = this.splitIntoChunks(cleanText);
    
    // Step 4: Add speech optimization
    const processedChunks = chunks.map(chunk => this.optimizeForSpeech(chunk));
    
    return processedChunks.join('\n\n');
  }

  private preserveSpeakerTags(htmlContent: string): string {
    // Preserve speaker tags in rawContent if available, otherwise extract from HTML
    // This method handles both clean HTML and tagged content from the story service
    
    // If content already has speaker tags, return as-is
    if (htmlContent.includes('[') && htmlContent.includes(']:')) {
      return htmlContent;
    }
    
    // Otherwise, try to identify dialogue and add basic speaker tags
    let taggedContent = htmlContent;
    
    // Basic dialogue detection and tagging
    taggedContent = taggedContent.replace(/"([^"]+)"/g, (match, dialogue) => {
      return `[Character]: "${dialogue}"`;
    });
    
    // Tag narrative content
    taggedContent = taggedContent.replace(/^(?!\[)([^"\n]+)$/gm, (match, text) => {
      if (text.trim() && !text.includes('[') && !text.includes('"')) {
        return `[Narrator]: ${text}`;
      }
      return text;
    });
    
    return taggedContent;
  }

  private splitIntoChunks(text: string, maxChunkSize: number = 2500): string[] {
    // Split text into chunks respecting ElevenLabs character limits
    // ElevenLabs has a ~5000 character limit per request, we use 2500 for safety
    
    const chunks: string[] = [];
    const lines = text.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      const lineWithBreak = line + '\n';
      
      // If adding this line would exceed limit, save current chunk and start new one
      if (currentChunk.length + lineWithBreak.length > maxChunkSize && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = lineWithBreak;
      } else {
        currentChunk += lineWithBreak;
      }
    }
    
    // Add final chunk if not empty
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private optimizeForSpeech(text: string): string {
    // Optimize text for natural speech synthesis
    let optimized = text;
    
    // Add pauses for better speech flow
    optimized = optimized
      .replace(/\.\s/g, '. ') // Ensure space after periods
      .replace(/\?\s/g, '? ') // Ensure space after question marks  
      .replace(/\!\s/g, '! ') // Ensure space after exclamation marks
      .replace(/:\s/g, ': ') // Ensure space after colons
      .replace(/;\s/g, '; ') // Ensure space after semicolons
      .replace(/,\s/g, ', '); // Ensure space after commas
    
    // Add longer pauses for scene transitions
    optimized = optimized
      .replace(/\.\n/g, '...\n') // Add pause after sentence at line end
      .replace(/\n\n/g, '\n...\n'); // Add pause between paragraphs
    
    // Expand abbreviations for better pronunciation
    optimized = optimized
      .replace(/\bMr\./g, 'Mister')
      .replace(/\bMrs\./g, 'Missus') 
      .replace(/\bMs\./g, 'Miss')
      .replace(/\bDr\./g, 'Doctor')
      .replace(/\bSt\./g, 'Saint')
      .replace(/\b([0-9]+)am\b/g, '$1 A M')
      .replace(/\b([0-9]+)pm\b/g, '$1 P M');
    
    return optimized;
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