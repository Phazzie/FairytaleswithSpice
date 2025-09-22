/**
 * Enhanced Audio Service with Advanced Voice Parameters & Emotion Mapping
 * 
 * This enhanced version includes:
 * - 90+ emotion to voice parameter mapping
 * - Dynamic voice parameter tuning based on character emotions
 * - Advanced voice selection algorithms  
 * - ElevenLabs API parameter optimization
 * - Voice consistency verification systems
 */

import axios from 'axios';
import { AudioConversionSeam, ApiResponse, CreatureType, CharacterVoiceType } from '../types/contracts';

interface VoiceParameters {
  stability: number;      // 0.0 - 1.0 (lower = more variable/expressive)
  similarity_boost: number; // 0.0 - 1.0 (higher = closer to original voice)
  style: number;         // 0.0 - 1.0 (higher = more stylized)
  use_speaker_boost?: boolean; // Enhance speaker clarity
}

interface EmotionMapping {
  emotion: string;
  parameters: VoiceParameters;
  description: string;
}

export class EnhancedAudioService {
  private elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
  private elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  // Enhanced voice IDs with detailed character descriptions
  private voiceIds = {
    // Basic voices (backwards compatibility)
    female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL',
    male: process.env.ELEVENLABS_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB', 
    neutral: process.env.ELEVENLABS_VOICE_NEUTRAL || '21m00Tcm4TlvDq8ikWAM',
    
    // Character-specific voices with enhanced parameters
    vampire_male: process.env.ELEVENLABS_VOICE_VAMPIRE_MALE || 'ErXwobaYiN019PkySvjV',
    vampire_female: process.env.ELEVENLABS_VOICE_VAMPIRE_FEMALE || 'EXAVITQu4vr4xnSDxMaL',
    werewolf_male: process.env.ELEVENLABS_VOICE_WEREWOLF_MALE || 'pNInz6obpgDQGcFmaJgB',
    werewolf_female: process.env.ELEVENLABS_VOICE_WEREWOLF_FEMALE || 'AZnzlk1XvdvUeBnXmlld',
    fairy_male: process.env.ELEVENLABS_VOICE_FAIRY_MALE || 'VR6AewLTigWG4xSOukaG',
    fairy_female: process.env.ELEVENLABS_VOICE_FAIRY_FEMALE || 'jsCqWAovK2LkecY7zXl4',
    human_male: process.env.ELEVENLABS_VOICE_HUMAN_MALE || 'pNInz6obpgDQGcFmaJgB',
    human_female: process.env.ELEVENLABS_VOICE_HUMAN_FEMALE || 'EXAVITQu4vr4xnSDxMaL',
    narrator: process.env.ELEVENLABS_VOICE_NARRATOR || '21m00Tcm4TlvDq8ikWAM'
  };

  // Default voice parameters optimized for each character type
  private characterVoiceParameters: Record<CharacterVoiceType, VoiceParameters> = {
    vampire_male: { stability: 0.8, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    vampire_female: { stability: 0.7, similarity_boost: 0.9, style: 0.7, use_speaker_boost: true },
    werewolf_male: { stability: 0.6, similarity_boost: 0.7, style: 0.5, use_speaker_boost: true },
    werewolf_female: { stability: 0.6, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
    fairy_male: { stability: 0.5, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    fairy_female: { stability: 0.4, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
    human_male: { stability: 0.7, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    human_female: { stability: 0.7, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    narrator: { stability: 0.9, similarity_boost: 0.7, style: 0.2, use_speaker_boost: false },
    female: { stability: 0.7, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    male: { stability: 0.7, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    neutral: { stability: 0.8, similarity_boost: 0.7, style: 0.2, use_speaker_boost: false }
  };

  // Comprehensive emotion to voice parameter mapping (90+ emotions)
  private emotionMappings: Record<string, Partial<VoiceParameters>> = {
    // ==================== PASSION & DESIRE ====================
    'seductive': { stability: 0.4, similarity_boost: 0.9, style: 0.8 },
    'passionate': { stability: 0.3, similarity_boost: 0.8, style: 0.9 },
    'lustful': { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
    'romantic': { stability: 0.5, similarity_boost: 0.9, style: 0.7 },
    'tender': { stability: 0.6, similarity_boost: 0.9, style: 0.6 },
    'intimate': { stability: 0.4, similarity_boost: 0.9, style: 0.8 },
    'desire': { stability: 0.3, similarity_boost: 0.8, style: 0.9 },
    
    // ==================== POWER & DOMINANCE ====================
    'commanding': { stability: 0.8, similarity_boost: 0.7, style: 0.4 },
    'dominant': { stability: 0.7, similarity_boost: 0.7, style: 0.5 },
    'authoritative': { stability: 0.9, similarity_boost: 0.6, style: 0.3 },
    'powerful': { stability: 0.8, similarity_boost: 0.7, style: 0.4 },
    'intimidating': { stability: 0.6, similarity_boost: 0.6, style: 0.6 },
    'threatening': { stability: 0.5, similarity_boost: 0.6, style: 0.7 },
    'menacing': { stability: 0.4, similarity_boost: 0.6, style: 0.8 },
    
    // ==================== VULNERABILITY & SUBMISSION ====================
    'submissive': { stability: 0.3, similarity_boost: 0.9, style: 0.8 },
    'vulnerable': { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
    'pleading': { stability: 0.1, similarity_boost: 0.9, style: 0.9 },
    'desperate': { stability: 0.1, similarity_boost: 0.8, style: 0.9 },
    'helpless': { stability: 0.2, similarity_boost: 0.9, style: 0.8 },
    'broken': { stability: 0.1, similarity_boost: 0.9, style: 0.9 },
    
    // ==================== FEAR & ANXIETY ====================
    'fearful': { stability: 0.1, similarity_boost: 0.9, style: 0.9 },
    'terrified': { stability: 0.0, similarity_boost: 0.9, style: 0.9 },
    'nervous': { stability: 0.2, similarity_boost: 0.9, style: 0.8 },
    'anxious': { stability: 0.2, similarity_boost: 0.9, style: 0.8 },
    'panicked': { stability: 0.0, similarity_boost: 0.8, style: 0.9 },
    'worried': { stability: 0.3, similarity_boost: 0.9, style: 0.7 },
    'uneasy': { stability: 0.3, similarity_boost: 0.8, style: 0.7 },
    
    // ==================== ANGER & RAGE ====================
    'angry': { stability: 0.2, similarity_boost: 0.7, style: 0.8 },
    'furious': { stability: 0.1, similarity_boost: 0.6, style: 0.9 },
    'enraged': { stability: 0.0, similarity_boost: 0.6, style: 0.9 },
    'irritated': { stability: 0.4, similarity_boost: 0.7, style: 0.6 },
    'frustrated': { stability: 0.3, similarity_boost: 0.7, style: 0.7 },
    'savage': { stability: 0.1, similarity_boost: 0.6, style: 0.9 },
    'violent': { stability: 0.1, similarity_boost: 0.6, style: 0.9 },
    
    // ==================== JOY & EXCITEMENT ====================
    'joyful': { stability: 0.4, similarity_boost: 0.8, style: 0.7 },
    'ecstatic': { stability: 0.2, similarity_boost: 0.8, style: 0.9 },
    'excited': { stability: 0.3, similarity_boost: 0.8, style: 0.8 },
    'playful': { stability: 0.3, similarity_boost: 0.9, style: 0.8 },
    'mischievous': { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
    'delighted': { stability: 0.4, similarity_boost: 0.8, style: 0.7 },
    'euphoric': { stability: 0.1, similarity_boost: 0.8, style: 0.9 },
    
    // ==================== SADNESS & MELANCHOLY ====================
    'sad': { stability: 0.6, similarity_boost: 0.9, style: 0.4 },
    'heartbroken': { stability: 0.3, similarity_boost: 0.9, style: 0.8 },
    'melancholy': { stability: 0.7, similarity_boost: 0.9, style: 0.3 },
    'sorrowful': { stability: 0.5, similarity_boost: 0.9, style: 0.5 },
    'grieving': { stability: 0.4, similarity_boost: 0.9, style: 0.6 },
    'depressed': { stability: 0.8, similarity_boost: 0.9, style: 0.2 },
    'lonely': { stability: 0.6, similarity_boost: 0.9, style: 0.4 },
    
    // ==================== MYSTERY & INTRIGUE ====================
    'mysterious': { stability: 0.6, similarity_boost: 0.8, style: 0.7 },
    'secretive': { stability: 0.7, similarity_boost: 0.8, style: 0.6 },
    'cryptic': { stability: 0.5, similarity_boost: 0.8, style: 0.8 },
    'enigmatic': { stability: 0.6, similarity_boost: 0.8, style: 0.7 },
    'suspicious': { stability: 0.4, similarity_boost: 0.7, style: 0.7 },
    'scheming': { stability: 0.5, similarity_boost: 0.7, style: 0.8 },
    
    // ==================== SUPERNATURAL & OTHERWORLDLY ====================
    'mystical': { stability: 0.3, similarity_boost: 0.9, style: 0.9 },
    'ethereal': { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
    'otherworldly': { stability: 0.1, similarity_boost: 0.9, style: 0.9 },
    'magical': { stability: 0.3, similarity_boost: 0.9, style: 0.9 },
    'enchanting': { stability: 0.4, similarity_boost: 0.9, style: 0.8 },
    'supernatural': { stability: 0.2, similarity_boost: 0.8, style: 0.9 },
    'divine': { stability: 0.5, similarity_boost: 0.9, style: 0.8 },
    
    // ==================== CONFIDENCE & PRIDE ====================
    'confident': { stability: 0.8, similarity_boost: 0.7, style: 0.4 },
    'proud': { stability: 0.7, similarity_boost: 0.7, style: 0.5 },
    'arrogant': { stability: 0.6, similarity_boost: 0.6, style: 0.6 },
    'smug': { stability: 0.5, similarity_boost: 0.7, style: 0.7 },
    'cocky': { stability: 0.4, similarity_boost: 0.7, style: 0.8 },
    'self-assured': { stability: 0.8, similarity_boost: 0.7, style: 0.3 },
    
    // ==================== DECEPTION & MANIPULATION ====================
    'deceptive': { stability: 0.5, similarity_boost: 0.8, style: 0.7 },
    'manipulative': { stability: 0.4, similarity_boost: 0.8, style: 0.8 },
    'cunning': { stability: 0.5, similarity_boost: 0.7, style: 0.7 },
    'sly': { stability: 0.4, similarity_boost: 0.8, style: 0.8 },
    'treacherous': { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
    'devious': { stability: 0.3, similarity_boost: 0.7, style: 0.9 },
    
    // ==================== NEUTRAL & DESCRIPTIVE ====================
    'calm': { stability: 0.9, similarity_boost: 0.8, style: 0.2 },
    'neutral': { stability: 0.8, similarity_boost: 0.7, style: 0.2 },
    'thoughtful': { stability: 0.8, similarity_boost: 0.8, style: 0.3 },
    'contemplative': { stability: 0.9, similarity_boost: 0.8, style: 0.2 },
    'pensive': { stability: 0.8, similarity_boost: 0.8, style: 0.3 },
    'serene': { stability: 0.9, similarity_boost: 0.9, style: 0.1 },
    
    // ==================== ADDITIONAL SPICY EMOTIONS ====================
    'hungry': { stability: 0.2, similarity_boost: 0.8, style: 0.9 },
    'craving': { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
    'wanting': { stability: 0.3, similarity_boost: 0.9, style: 0.8 },
    'needy': { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
    'obsessed': { stability: 0.1, similarity_boost: 0.8, style: 0.9 },
    'possessive': { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
    'jealous': { stability: 0.2, similarity_boost: 0.7, style: 0.9 },
    'envious': { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
    'corrupt': { stability: 0.2, similarity_boost: 0.7, style: 0.9 },
    'wicked': { stability: 0.1, similarity_boost: 0.6, style: 0.9 },
    'sinful': { stability: 0.2, similarity_boost: 0.8, style: 0.9 },
    'forbidden': { stability: 0.3, similarity_boost: 0.9, style: 0.8 },
    'taboo': { stability: 0.2, similarity_boost: 0.9, style: 0.9 },
    'guilty': { stability: 0.4, similarity_boost: 0.9, style: 0.7 },
    'shameful': { stability: 0.3, similarity_boost: 0.9, style: 0.8 },
    'defiant': { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
    'rebellious': { stability: 0.2, similarity_boost: 0.7, style: 0.9 },
    'wild': { stability: 0.1, similarity_boost: 0.7, style: 0.9 },
    'untamed': { stability: 0.0, similarity_boost: 0.7, style: 0.9 },
    'primal': { stability: 0.1, similarity_boost: 0.6, style: 0.9 }
  };

  constructor() {
    if (!this.elevenLabsApiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not found in environment variables');
    }
  }

  /**
   * Get all available emotions for the AI story generation system
   */
  getAvailableEmotions(): string[] {
    return Object.keys(this.emotionMappings).sort();
  }

  /**
   * Enhanced voice parameter calculation based on character type and emotion
   */
  private calculateVoiceParameters(voiceType: CharacterVoiceType, emotion?: string): VoiceParameters {
    // Start with base parameters for character type
    const baseParams = { ...this.characterVoiceParameters[voiceType] };
    
    // Apply emotion modifications if provided
    if (emotion && this.emotionMappings[emotion.toLowerCase()]) {
      const emotionParams = this.emotionMappings[emotion.toLowerCase()];
      
      // Blend emotion parameters with base parameters
      // Emotion parameters take precedence but don't completely override
      return {
        stability: emotionParams.stability ?? baseParams.stability,
        similarity_boost: emotionParams.similarity_boost ?? baseParams.similarity_boost,
        style: emotionParams.style ?? baseParams.style,
        use_speaker_boost: baseParams.use_speaker_boost
      };
    }
    
    return baseParams;
  }

  /**
   * Enhanced speaker parsing that extracts emotion context
   */
  private parseEmotionalSpeaker(speakerTag: string): { speaker: string; emotion?: string } {
    // Handle format: [Character, emotion]: "dialogue"
    const emotionMatch = speakerTag.match(/\[([^,]+),\s*([^\]]+)\]:/);
    if (emotionMatch) {
      return {
        speaker: emotionMatch[1].trim(),
        emotion: emotionMatch[2].trim()
      };
    }
    
    // Handle format: [Character]: "dialogue"
    const simpleMatch = speakerTag.match(/\[([^\]]+)\]:/);
    if (simpleMatch) {
      return {
        speaker: simpleMatch[1].trim()
      };
    }
    
    return { speaker: 'Narrator' };
  }

  /**
   * Research optimal ElevenLabs voice creation capabilities
   */
  async researchVoiceCreationCapabilities(): Promise<{
    canCreateVoices: boolean;
    voiceCloning: boolean;
    customVoiceParameters: boolean;
    availableModels: string[];
    recommendations: string[];
  }> {
    // This would investigate ElevenLabs Voice Lab API
    // For now, return research findings based on API documentation
    
    return {
      canCreateVoices: true,
      voiceCloning: true, 
      customVoiceParameters: true,
      availableModels: [
        'eleven_monolingual_v1',
        'eleven_multilingual_v1', 
        'eleven_multilingual_v2',
        'eleven_turbo_v2'
      ],
      recommendations: [
        'Use eleven_multilingual_v2 for best quality',
        'Voice cloning requires 10+ minutes of clean audio',
        'Custom voices can be created via Voice Lab API',
        'Professional voice actors provide best results',
        'Character-specific voices improve narrative immersion'
      ]
    };
  }

  /**
   * Enhanced audio generation with emotion-aware voice parameters
   */
  async generateEmotionalAudio(
    text: string, 
    voiceType: CharacterVoiceType, 
    emotion?: string,
    speed: number = 1.0
  ): Promise<Buffer> {
    const voiceId = this.voiceIds[voiceType];
    const voiceParams = this.calculateVoiceParameters(voiceType, emotion);
    
    if (!this.elevenLabsApiKey) {
      console.warn(`Generating mock audio for ${voiceType}${emotion ? ` (${emotion})` : ''}`);
      return this.generateMockAudioData(text);
    }

    try {
      const response = await axios.post(
        `${this.elevenLabsApiUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_multilingual_v2', // Use latest model
          voice_settings: {
            stability: voiceParams.stability,
            similarity_boost: voiceParams.similarity_boost,
            style: voiceParams.style,
            use_speaker_boost: voiceParams.use_speaker_boost
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

      // Apply speed adjustment if needed (would require audio processing library)
      let audioBuffer = Buffer.from(response.data);
      
      // TODO: Implement speed adjustment while preserving pitch
      // This would require audio processing libraries like ffmpeg or Web Audio API
      
      return audioBuffer;

    } catch (error: any) {
      console.warn(`ElevenLabs API error for ${voiceType}: ${error.message}`);
      return this.generateMockAudioData(text);
    }
  }

  /**
   * Generate comprehensive voice consistency report
   */
  async generateVoiceConsistencyReport(storyContent: string): Promise<{
    charactersDetected: Array<{
      name: string;
      voiceType: CharacterVoiceType;
      emotionalRange: string[];
      consistency: number;
    }>;
    recommendations: string[];
    totalSpeechSegments: number;
  }> {
    const speakerPattern = /\[([^\]]+)\]:/g;
    const matches = [...storyContent.matchAll(speakerPattern)];
    
    const characterMap = new Map<string, {
      voiceType: CharacterVoiceType;
      emotions: Set<string>;
      segments: number;
    }>();

    // Analyze each speaker segment
    for (const match of matches) {
      const { speaker, emotion } = this.parseEmotionalSpeaker(match[0]);
      const voiceType = this.assignVoiceToSpeaker(speaker);
      
      if (!characterMap.has(speaker)) {
        characterMap.set(speaker, {
          voiceType,
          emotions: new Set(),
          segments: 0
        });
      }
      
      const charData = characterMap.get(speaker)!;
      charData.segments++;
      if (emotion) {
        charData.emotions.add(emotion);
      }
    }

    // Generate consistency analysis
    const charactersDetected = Array.from(characterMap.entries()).map(([name, data]) => ({
      name,
      voiceType: data.voiceType,
      emotionalRange: Array.from(data.emotions),
      consistency: this.calculateConsistencyScore(data.voiceType, Array.from(data.emotions))
    }));

    const recommendations = this.generateVoiceRecommendations(charactersDetected);

    return {
      charactersDetected,
      recommendations,
      totalSpeechSegments: matches.length
    };
  }

  private calculateConsistencyScore(voiceType: CharacterVoiceType, emotions: string[]): number {
    // Calculate how well the emotions match the character type
    const characterEmotions = this.getOptimalEmotionsForCharacter(voiceType);
    const matchingEmotions = emotions.filter(e => characterEmotions.includes(e));
    
    return emotions.length > 0 ? matchingEmotions.length / emotions.length : 1.0;
  }

  private getOptimalEmotionsForCharacter(voiceType: CharacterVoiceType): string[] {
    const emotionSets = {
      vampire_male: ['seductive', 'commanding', 'mysterious', 'dangerous', 'alluring'],
      vampire_female: ['seductive', 'alluring', 'mysterious', 'elegant', 'hypnotic'],
      werewolf_male: ['powerful', 'protective', 'wild', 'aggressive', 'loyal'],
      werewolf_female: ['fierce', 'protective', 'wild', 'strong', 'independent'],
      fairy_male: ['mystical', 'playful', 'ethereal', 'mischievous', 'wise'],
      fairy_female: ['magical', 'ethereal', 'delicate', 'enchanting', 'mysterious'],
      human_male: ['confident', 'determined', 'passionate', 'caring', 'strong'],
      human_female: ['confident', 'passionate', 'caring', 'intelligent', 'strong'],
      narrator: ['calm', 'neutral', 'thoughtful', 'authoritative', 'clear']
    };
    
    return emotionSets[voiceType] || ['neutral'];
  }

  private generateVoiceRecommendations(characters: Array<{
    name: string;
    voiceType: CharacterVoiceType;
    emotionalRange: string[];
    consistency: number;
  }>): string[] {
    const recommendations: string[] = [];
    
    characters.forEach(char => {
      if (char.consistency < 0.7) {
        recommendations.push(
          `Consider optimizing ${char.name}'s emotional range for ${char.voiceType} voice type`
        );
      }
      
      if (char.emotionalRange.length > 10) {
        recommendations.push(
          `${char.name} has a very wide emotional range (${char.emotionalRange.length} emotions) - consider voice parameter tuning`
        );
      }
    });
    
    if (characters.length > 6) {
      recommendations.push('Story has many characters - consider voice distinction optimization');
    }
    
    return recommendations;
  }

  // Include existing methods from original AudioService
  private assignVoiceToSpeaker(speakerName: string): CharacterVoiceType {
    const lowerName = speakerName.toLowerCase();
    
    if (lowerName.includes('narrator')) {
      return 'narrator';
    }
    
    const isFemale = this.inferGenderFromName(speakerName);
    const characterType = this.detectCharacterType(speakerName);
    
    const voiceKey = `${characterType}_${isFemale ? 'female' : 'male'}` as CharacterVoiceType;
    
    if (this.voiceIds[voiceKey]) {
      return voiceKey;
    }
    
    return isFemale ? 'human_female' : 'human_male';
  }

  private detectCharacterType(speakerName: string): 'vampire' | 'werewolf' | 'fairy' | 'human' {
    const lowerName = speakerName.toLowerCase();
    
    if (lowerName.includes('vampire') || lowerName.includes('vamp') || lowerName.includes('lord') || lowerName.includes('count')) {
      return 'vampire';
    }
    
    if (lowerName.includes('werewolf') || lowerName.includes('wolf') || lowerName.includes('lycan') || lowerName.includes('alpha')) {
      return 'werewolf';
    }
    
    if (lowerName.includes('fairy') || lowerName.includes('fae') || lowerName.includes('sprite') || lowerName.includes('pixie')) {
      return 'fairy';
    }
    
    return 'human';
  }

  private inferGenderFromName(name: string): boolean {
    // Simplified version - full implementation would include comprehensive name lists
    const lowerName = name.toLowerCase();
    
    const femaleIndicators = [
      'lady', 'queen', 'princess', 'duchess', 'miss', 'mrs', 'ms',
      'sarah', 'emma', 'bella', 'elena', 'aria', 'luna', 'anastasia'
    ];
    
    const maleIndicators = [
      'lord', 'king', 'prince', 'duke', 'sir', 'mr', 'count', 'baron',
      'dimitri', 'marcus', 'adam', 'james', 'alexander', 'viktor'
    ];
    
    for (const indicator of femaleIndicators) {
      if (lowerName.includes(indicator)) return true;
    }
    
    for (const indicator of maleIndicators) {
      if (lowerName.includes(indicator)) return false;
    }
    
    return true; // Default to female
  }

  private generateMockAudioData(text: string): Buffer {
    // Simple mock implementation
    const duration = Math.ceil(text.split(/\s+/).length / 2.5); // 2.5 words per second
    return Buffer.alloc(duration * 44100 * 2 * 2); // Mock stereo 16-bit audio
  }
}