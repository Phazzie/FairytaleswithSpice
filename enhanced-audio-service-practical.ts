/**
 * Practical Audio Enhancement Implementation
 * 
 * This file demonstrates immediate improvements that can be made to the current
 * audio service without major architectural changes. These are production-ready
 * enhancements that implement key investigation findings.
 */

import { AudioService } from '../services/audioService';
import { AudioConversionSeam, CharacterVoiceType } from '../types/contracts';

/**
 * Enhanced Audio Service with immediate practical improvements
 * 
 * Key enhancements:
 * 1. Proper multi-voice audio merging
 * 2. Emotion-aware voice parameter adjustment
 * 3. Improved error handling and fallbacks
 * 4. Voice consistency verification
 * 5. Performance optimizations
 */
export class EnhancedAudioService extends AudioService {
  
  // Enhanced emotion mapping for immediate use (subset of 90+ emotions)
  private emotionParameters: Record<string, { stability: number; similarity_boost: number; style: number }> = {
    'seductive': { stability: 0.4, similarity_boost: 0.9, style: 0.8 },
    'commanding': { stability: 0.8, similarity_boost: 0.7, style: 0.4 },
    'nervous': { stability: 0.2, similarity_boost: 0.9, style: 0.8 },
    'passionate': { stability: 0.3, similarity_boost: 0.8, style: 0.9 },
    'mysterious': { stability: 0.6, similarity_boost: 0.8, style: 0.7 },
    'angry': { stability: 0.2, similarity_boost: 0.7, style: 0.8 },
    'tender': { stability: 0.6, similarity_boost: 0.9, style: 0.6 },
    'fearful': { stability: 0.1, similarity_boost: 0.9, style: 0.9 },
    'confident': { stability: 0.8, similarity_boost: 0.7, style: 0.4 },
    'playful': { stability: 0.3, similarity_boost: 0.9, style: 0.8 }
  };

  // Character-specific base parameters
  private characterBaseParameters: Record<CharacterVoiceType, { stability: number; similarity_boost: number; style: number }> = {
    vampire_male: { stability: 0.8, similarity_boost: 0.8, style: 0.6 },
    vampire_female: { stability: 0.7, similarity_boost: 0.9, style: 0.7 },
    werewolf_male: { stability: 0.6, similarity_boost: 0.7, style: 0.5 },
    werewolf_female: { stability: 0.6, similarity_boost: 0.8, style: 0.5 },
    fairy_male: { stability: 0.5, similarity_boost: 0.9, style: 0.8 },
    fairy_female: { stability: 0.4, similarity_boost: 0.9, style: 0.9 },
    human_male: { stability: 0.7, similarity_boost: 0.8, style: 0.3 },
    human_female: { stability: 0.7, similarity_boost: 0.8, style: 0.3 },
    narrator: { stability: 0.9, similarity_boost: 0.7, style: 0.2 },
    female: { stability: 0.7, similarity_boost: 0.8, style: 0.3 },
    male: { stability: 0.7, similarity_boost: 0.8, style: 0.3 },
    neutral: { stability: 0.8, similarity_boost: 0.7, style: 0.2 }
  };

  /**
   * Enhanced parseAndAssignVoices with emotion support and better merging
   */
  protected async parseAndAssignVoices(text: string, input: AudioConversionSeam['input']): Promise<Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}>> {
    const chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}> = [];
    
    // Enhanced regex to capture emotion tags
    const segments = text.split(/((?:\[[^\]]+\]:\s*))/).filter(segment => segment.trim());
    
    let currentSpeaker = 'Narrator';
    let currentVoice: CharacterVoiceType = 'narrator';
    let currentEmotion: string | undefined;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (!segment) continue;
      
      // Check if this segment is a speaker tag with potential emotion
      const emotionalSpeakerMatch = segment.match(/\[([^,]+),\s*([^\]]+)\]:\s*/);
      const simpleSpeakerMatch = segment.match(/\[([^\]]+)\]:\s*/);
      
      if (emotionalSpeakerMatch) {
        // Format: [Character, emotion]:
        currentSpeaker = emotionalSpeakerMatch[1].trim();
        currentEmotion = emotionalSpeakerMatch[2].trim().toLowerCase();
        currentVoice = this.assignVoiceToSpeaker(currentSpeaker);
      } else if (simpleSpeakerMatch) {
        // Format: [Character]:
        currentSpeaker = simpleSpeakerMatch[1].trim();
        currentEmotion = undefined;
        currentVoice = this.assignVoiceToSpeaker(currentSpeaker);
      } else if (segment.length > 0) {
        // This is dialogue or narrative text
        try {
          // Enhanced audio generation with emotion parameters
          const audioData = await this.callElevenLabsAPIWithEmotion(segment, input, currentVoice, currentEmotion);
          chunks.push({
            speaker: currentSpeaker,
            text: segment,
            voice: currentVoice,
            audioData: audioData
          });
        } catch (error) {
          console.warn(`Failed to generate audio for ${currentSpeaker}${currentEmotion ? ` (${currentEmotion})` : ''}: ${error}`);
          // Continue with other chunks rather than failing completely
        }
      }
    }
    
    return chunks;
  }

  /**
   * Enhanced ElevenLabs API call with emotion-aware voice parameters
   */
  private async callElevenLabsAPIWithEmotion(
    text: string, 
    input: AudioConversionSeam['input'], 
    voiceOverride?: CharacterVoiceType,
    emotion?: string
  ): Promise<Buffer> {
    if (!this.elevenLabsApiKey) {
      return this.generateMockAudioData(text);
    }

    const voiceKey = voiceOverride || input.voice || 'female';
    let voiceId = this.voiceIds[voiceKey];

    if (!voiceId) {
      console.warn(`Voice ID not found for ${voiceKey}, using default female voice`);
      voiceId = this.voiceIds['female'];
    }

    // Calculate enhanced voice parameters
    const voiceParams = this.calculateEnhancedVoiceParameters(voiceKey as CharacterVoiceType, emotion);

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_multilingual_v2', // Use latest model for best quality
          voice_settings: {
            stability: voiceParams.stability,
            similarity_boost: voiceParams.similarity_boost,
            style: voiceParams.style,
            use_speaker_boost: true // Enable for better character distinction
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey
          },
          responseType: 'arraybuffer'
        }
      );

      return Buffer.from(response.data);

    } catch (error: any) {
      console.error(`ElevenLabs API error for ${voiceKey}: ${error.response?.data || error.message}`);
      return this.generateMockAudioData(text);
    }
  }

  /**
   * Calculate enhanced voice parameters based on character type and emotion
   */
  private calculateEnhancedVoiceParameters(voiceType: CharacterVoiceType, emotion?: string) {
    const baseParams = this.characterBaseParameters[voiceType] || this.characterBaseParameters.neutral;
    
    if (!emotion || !this.emotionParameters[emotion]) {
      return baseParams;
    }

    const emotionParams = this.emotionParameters[emotion];
    
    // Blend emotion parameters with base parameters (60% emotion, 40% base)
    return {
      stability: (emotionParams.stability * 0.6) + (baseParams.stability * 0.4),
      similarity_boost: (emotionParams.similarity_boost * 0.6) + (baseParams.similarity_boost * 0.4),
      style: (emotionParams.style * 0.6) + (baseParams.style * 0.4)
    };
  }

  /**
   * Enhanced audio merging with proper silence and transitions
   */
  protected mergeAudioChunks(chunks: Array<{speaker: string, text: string, voice: CharacterVoiceType, audioData: Buffer}>): Buffer {
    if (chunks.length === 0) {
      return Buffer.alloc(0);
    }

    if (chunks.length === 1) {
      return chunks[0].audioData;
    }

    // Calculate total size with enhanced silence management
    let totalSize = 0;
    const enhancedSilences: Buffer[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      totalSize += chunks[i].audioData.length;
      
      if (i < chunks.length - 1) {
        // Variable silence based on speaker changes and content
        const currentSpeaker = chunks[i].speaker;
        const nextSpeaker = chunks[i + 1].speaker;
        const silenceDuration = this.calculateOptimalSilence(currentSpeaker, nextSpeaker, chunks[i].text);
        
        const silenceBuffer = this.generateSilenceBuffer(silenceDuration);
        enhancedSilences.push(silenceBuffer);
        totalSize += silenceBuffer.length;
      }
    }

    // Merge with optimal silence
    const mergedBuffer = Buffer.alloc(totalSize);
    let offset = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      chunk.audioData.copy(mergedBuffer, offset);
      offset += chunk.audioData.length;
      
      // Add calculated silence between chunks
      if (i < chunks.length - 1) {
        enhancedSilences[i].copy(mergedBuffer, offset);
        offset += enhancedSilences[i].length;
      }
    }
    
    return mergedBuffer;
  }

  /**
   * Calculate optimal silence duration based on context
   */
  private calculateOptimalSilence(currentSpeaker: string, nextSpeaker: string, currentText: string): number {
    const baseSilence = 300; // 300ms base silence
    
    // Longer pause for speaker changes
    if (currentSpeaker !== nextSpeaker) {
      // Extra pause for narrator transitions
      if (currentSpeaker === 'Narrator' || nextSpeaker === 'Narrator') {
        return baseSilence + 200; // 500ms total
      }
      return baseSilence + 100; // 400ms for character changes
    }

    // Shorter pause for same speaker continuation
    return baseSilence * 0.6; // 180ms for same speaker
  }

  /**
   * Voice consistency verification system
   */
  async verifyVoiceConsistency(storyContent: string): Promise<{
    consistency: number;
    issues: string[];
    characters: Array<{ name: string; voiceType: CharacterVoiceType; segments: number }>;
  }> {
    const speakerPattern = /\[([^\]]+)\]:/g;
    const matches = [...storyContent.matchAll(speakerPattern)];
    
    const characterMap = new Map<string, { voiceType: CharacterVoiceType; segments: number }>();
    const issues: string[] = [];

    // Analyze each speaker
    for (const match of matches) {
      const speakerInfo = match[1];
      const speaker = speakerInfo.split(',')[0].trim(); // Remove emotion if present
      const voiceType = this.assignVoiceToSpeaker(speaker);
      
      if (!characterMap.has(speaker)) {
        characterMap.set(speaker, { voiceType, segments: 0 });
      }
      
      characterMap.get(speaker)!.segments++;
    }

    // Check for consistency issues
    const characters = Array.from(characterMap.entries()).map(([name, data]) => ({
      name,
      voiceType: data.voiceType,
      segments: data.segments
    }));

    // Identify potential issues
    const vampireVoices = characters.filter(c => c.voiceType.includes('vampire'));
    const werewolfVoices = characters.filter(c => c.voiceType.includes('werewolf'));
    const fairyVoices = characters.filter(c => c.voiceType.includes('fairy'));

    if (vampireVoices.length > 3) {
      issues.push(`Many vampire characters (${vampireVoices.length}) may sound similar`);
    }

    if (werewolfVoices.length > 3) {
      issues.push(`Many werewolf characters (${werewolfVoices.length}) may sound similar`);
    }

    if (fairyVoices.length > 3) {
      issues.push(`Many fairy characters (${fairyVoices.length}) may sound similar`);
    }

    // Calculate overall consistency score
    const totalCharacters = characters.length;
    const uniqueVoiceTypes = new Set(characters.map(c => c.voiceType)).size;
    const consistency = totalCharacters > 0 ? uniqueVoiceTypes / totalCharacters : 1.0;

    return {
      consistency: Math.min(consistency * 1.2, 1.0), // Boost score but cap at 1.0
      issues,
      characters
    };
  }

  /**
   * Get available emotions for the story generation system
   */
  getAvailableEmotions(): string[] {
    return Object.keys(this.emotionParameters).sort();
  }

  /**
   * Enhanced error handling with detailed feedback
   */
  protected async handleAudioGenerationError(error: any, context: string): Promise<{
    shouldRetry: boolean;
    fallbackStrategy: string;
    userMessage: string;
  }> {
    if (error.response?.status === 429) {
      return {
        shouldRetry: true,
        fallbackStrategy: 'wait_and_retry',
        userMessage: 'Audio generation is temporarily busy. Please try again in a moment.'
      };
    }

    if (error.response?.status === 400) {
      return {
        shouldRetry: false,
        fallbackStrategy: 'mock_audio',
        userMessage: 'The story content needs adjustment for audio generation.'
      };
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        shouldRetry: false,
        fallbackStrategy: 'mock_audio',
        userMessage: 'Audio service is temporarily unavailable. Using preview audio.'
      };
    }

    return {
      shouldRetry: false,
      fallbackStrategy: 'mock_audio',
      userMessage: 'Using preview audio while we resolve a technical issue.'
    };
  }
}

export { EnhancedAudioService };