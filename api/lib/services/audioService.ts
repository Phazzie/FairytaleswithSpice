import axios from 'axios';
import { AudioConversionSeam, ApiResponse } from '../types/contracts';

export class AudioService {
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  // Voice IDs for different voice types (ElevenLabs voice IDs)
  private voiceIds = {
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Bella
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', // Adam
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM' // Rachel
  };

  // Comprehensive emotion to voice settings mapping
  private emotionVoiceSettings = {
    // Basic emotions
    'neutral': { stability: 0.7, similarity_boost: 0.8, style: 0.2 },
    'happy': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'sad': { stability: 0.8, similarity_boost: 0.9, style: 0.6 },
    'angry': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'fearful': { stability: 0.2, similarity_boost: 0.5, style: 0.7 },
    'surprised': { stability: 0.1, similarity_boost: 0.6, style: 0.9 },
    'disgusted': { stability: 0.6, similarity_boost: 0.7, style: 0.5 },
    
    // Romantic/intimate emotions
    'seductive': { stability: 0.2, similarity_boost: 0.7, style: 0.8 },
    'passionate': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'tender': { stability: 0.8, similarity_boost: 0.9, style: 0.4 },
    'lustful': { stability: 0.1, similarity_boost: 0.5, style: 1.0 },
    'romantic': { stability: 0.5, similarity_boost: 0.8, style: 0.7 },
    'intimate': { stability: 0.6, similarity_boost: 0.8, style: 0.6 },
    'yearning': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'breathless': { stability: 0.2, similarity_boost: 0.6, style: 0.9 },
    
    // Complex emotional states
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
    
    // Supernatural/fantasy emotions
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
    
    // Intensity variations
    'gentle': { stability: 0.8, similarity_boost: 0.9, style: 0.3 },
    'fierce': { stability: 0.2, similarity_boost: 0.5, style: 1.0 },
    'intense': { stability: 0.3, similarity_boost: 0.6, style: 0.9 },
    'subtle': { stability: 0.9, similarity_boost: 0.9, style: 0.1 },
    'bold': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'timid': { stability: 0.8, similarity_boost: 0.8, style: 0.3 },
    'aggressive': { stability: 0.2, similarity_boost: 0.5, style: 0.9 },
    'calm': { stability: 0.9, similarity_boost: 0.9, style: 0.2 },
    'wild': { stability: 0.1, similarity_boost: 0.4, style: 1.0 },
    'controlled': { stability: 0.8, similarity_boost: 0.9, style: 0.3 }
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
    
    // Get emotion-specific voice settings
    const emotionKey = emotion?.toLowerCase() as keyof typeof this.emotionVoiceSettings;
    const emotionSettings = emotionKey ? this.emotionVoiceSettings[emotionKey] : null;
    const defaultSettings = {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    };

    const voiceSettings = emotionSettings 
      ? { ...defaultSettings, ...emotionSettings, use_speaker_boost: true }
      : defaultSettings;

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

  private extractEmotionFromSpeakerTag(speakerTag: string): { speaker: string; emotion?: string } {
    // Parse speaker tags like:
    // [Character Name]: normal speech
    // [Character Name, emotion]: emotional speech
    // [Narrator]: descriptive text
    // [Narrator, intimate]: intimate narration
    
    const match = speakerTag.match(/\[([^,\]]+)(?:,\s*([^,\]]+))?\]/);
    
    if (match) {
      const speaker = match[1].trim();
      const emotion = match[2] ? match[2].trim() : undefined;
      return { speaker, emotion };
    }
    
    return { speaker: speakerTag };
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
        romantic: ['seductive', 'passionate', 'tender', 'lustful', 'romantic', 'intimate', 'yearning', 'breathless'],
        complex: ['anxious', 'excited', 'confident', 'nervous', 'amused', 'confused', 'determined', 'defiant', 'pleading', 'threatening', 'mocking', 'sarcastic', 'playful', 'serious', 'mysterious', 'sultry', 'whispering', 'shouting'],
        supernatural: ['otherworldly', 'ethereal', 'sinister', 'enchanting', 'hypnotic', 'predatory', 'protective', 'primal', 'magical', 'ancient'],
        intensity: ['gentle', 'fierce', 'intense', 'subtle', 'bold', 'timid', 'aggressive', 'calm', 'wild', 'controlled']
      },
      allEmotions: emotions,
      exampleUsage: [
        '[Character, seductive]: "Come closer..."',
        '[Narrator, mysterious]: The shadows seemed to move...',
        '[Vampire Lord, threatening]: "You will regret this."',
        '[Sarah, breathless]: "I can\'t... I can\'t resist..."'
      ]
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