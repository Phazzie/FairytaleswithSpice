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
      
      // Clean HTML content for text-to-speech
      const cleanText = this.cleanHtmlForTTS(sourceContent);

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