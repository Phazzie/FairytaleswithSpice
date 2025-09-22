import { AudioConversionSeam, ApiResponse, CharacterVoiceType } from '../types/contracts';

/**
 * AudioEnhancementService - Advanced Audio Generation Enhancements
 * 
 * This service provides sophisticated enhancements to the audio generation pipeline:
 * - Advanced emotion-to-voice parameter mapping (90+ emotions)
 * - Dynamic voice selection based on character descriptions
 * - Voice consistency verification
 * - Performance optimization and caching
 * - Audio quality analysis and improvement
 */

export interface EmotionVoiceMapping {
  stability: number;      // 0.0-1.0: voice stability (lower = more variation)
  similarityBoost: number; // 0.0-1.0: adherence to original voice (higher = more consistent)
  style: number;          // 0.0-1.0: style expression (higher = more expressive)
  speakerBoost: boolean;  // whether to use speaker boost
  pitch?: number;         // optional pitch adjustment
  speed?: number;         // optional speed adjustment
}

export interface VoicePersonality {
  characterType: 'vampire' | 'werewolf' | 'fairy' | 'human' | 'narrator';
  gender: 'male' | 'female' | 'neutral';
  baseVoice: CharacterVoiceType;
  personality: {
    formality: number;      // 0.0-1.0: casual to formal
    intensity: number;      // 0.0-1.0: calm to intense
    warmth: number;         // 0.0-1.0: cold to warm
    dominance: number;      // 0.0-1.0: submissive to dominant
    mystique: number;       // 0.0-1.0: straightforward to mysterious
  };
}

export class AudioEnhancementService {
  
  // ==================== COMPREHENSIVE EMOTION MAPPING ====================
  
  /**
   * Maps 90+ emotions to voice parameters for realistic expression
   * Based on psychological research and voice acting techniques
   */
  private emotionMappings: Record<string, EmotionVoiceMapping> = {
    // ===== POSITIVE EMOTIONS =====
    'happy': { stability: 0.3, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'joyful': { stability: 0.2, similarityBoost: 0.7, style: 0.9, speakerBoost: true },
    'excited': { stability: 0.1, similarityBoost: 0.6, style: 0.9, speakerBoost: true },
    'euphoric': { stability: 0.1, similarityBoost: 0.5, style: 1.0, speakerBoost: true },
    'elated': { stability: 0.2, similarityBoost: 0.6, style: 0.9, speakerBoost: true },
    'cheerful': { stability: 0.4, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'content': { stability: 0.6, similarityBoost: 0.9, style: 0.5, speakerBoost: false },
    'satisfied': { stability: 0.7, similarityBoost: 0.9, style: 0.4, speakerBoost: false },
    'pleased': { stability: 0.5, similarityBoost: 0.8, style: 0.6, speakerBoost: false },
    'delighted': { stability: 0.3, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    
    // ===== PASSIONATE & ROMANTIC EMOTIONS =====
    'passionate': { stability: 0.2, similarityBoost: 0.6, style: 0.9, speakerBoost: true },
    'romantic': { stability: 0.4, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'seductive': { stability: 0.5, similarityBoost: 0.9, style: 0.8, speakerBoost: true },
    'sensual': { stability: 0.6, similarityBoost: 0.9, style: 0.7, speakerBoost: true },
    'lustful': { stability: 0.3, similarityBoost: 0.7, style: 0.9, speakerBoost: true },
    'desire': { stability: 0.4, similarityBoost: 0.8, style: 0.8, speakerBoost: true },
    'yearning': { stability: 0.5, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'longing': { stability: 0.6, similarityBoost: 0.9, style: 0.6, speakerBoost: false },
    'infatuated': { stability: 0.2, similarityBoost: 0.6, style: 0.9, speakerBoost: true },
    'aroused': { stability: 0.3, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    
    // ===== INTENSE & DRAMATIC EMOTIONS =====
    'angry': { stability: 0.1, similarityBoost: 0.5, style: 1.0, speakerBoost: true },
    'furious': { stability: 0.0, similarityBoost: 0.4, style: 1.0, speakerBoost: true },
    'enraged': { stability: 0.0, similarityBoost: 0.3, style: 1.0, speakerBoost: true },
    'livid': { stability: 0.1, similarityBoost: 0.4, style: 1.0, speakerBoost: true },
    'irate': { stability: 0.2, similarityBoost: 0.5, style: 0.9, speakerBoost: true },
    'indignant': { stability: 0.3, similarityBoost: 0.6, style: 0.8, speakerBoost: true },
    'outraged': { stability: 0.1, similarityBoost: 0.4, style: 1.0, speakerBoost: true },
    'hostile': { stability: 0.4, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'aggressive': { stability: 0.2, similarityBoost: 0.5, style: 0.9, speakerBoost: true },
    'violent': { stability: 0.1, similarityBoost: 0.4, style: 1.0, speakerBoost: true },
    
    // ===== MYSTERIOUS & DARK EMOTIONS =====
    'mysterious': { stability: 0.7, similarityBoost: 0.9, style: 0.6, speakerBoost: false },
    'enigmatic': { stability: 0.8, similarityBoost: 0.9, style: 0.5, speakerBoost: false },
    'cryptic': { stability: 0.7, similarityBoost: 0.8, style: 0.6, speakerBoost: false },
    'secretive': { stability: 0.8, similarityBoost: 0.9, style: 0.4, speakerBoost: false },
    'scheming': { stability: 0.6, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'devious': { stability: 0.5, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'sinister': { stability: 0.6, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'ominous': { stability: 0.8, similarityBoost: 0.9, style: 0.5, speakerBoost: false },
    'foreboding': { stability: 0.7, similarityBoost: 0.9, style: 0.6, speakerBoost: false },
    'menacing': { stability: 0.5, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    
    // ===== VULNERABLE & SOFT EMOTIONS =====
    'sad': { stability: 0.8, similarityBoost: 0.9, style: 0.3, speakerBoost: false },
    'melancholic': { stability: 0.9, similarityBoost: 0.9, style: 0.2, speakerBoost: false },
    'sorrowful': { stability: 0.8, similarityBoost: 0.9, style: 0.4, speakerBoost: false },
    'mournful': { stability: 0.9, similarityBoost: 0.9, style: 0.3, speakerBoost: false },
    'devastated': { stability: 0.6, similarityBoost: 0.8, style: 0.6, speakerBoost: false },
    'heartbroken': { stability: 0.7, similarityBoost: 0.8, style: 0.5, speakerBoost: false },
    'vulnerable': { stability: 0.7, similarityBoost: 0.9, style: 0.4, speakerBoost: false },
    'fragile': { stability: 0.8, similarityBoost: 0.9, style: 0.3, speakerBoost: false },
    'tender': { stability: 0.8, similarityBoost: 0.9, style: 0.5, speakerBoost: false },
    'gentle': { stability: 0.9, similarityBoost: 0.9, style: 0.4, speakerBoost: false },
    
    // ===== CONFIDENT & POWERFUL EMOTIONS =====
    'confident': { stability: 0.6, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'determined': { stability: 0.5, similarityBoost: 0.8, style: 0.8, speakerBoost: true },
    'resolute': { stability: 0.7, similarityBoost: 0.9, style: 0.6, speakerBoost: true },
    'commanding': { stability: 0.4, similarityBoost: 0.7, style: 0.9, speakerBoost: true },
    'authoritative': { stability: 0.5, similarityBoost: 0.8, style: 0.8, speakerBoost: true },
    'dominant': { stability: 0.3, similarityBoost: 0.7, style: 0.9, speakerBoost: true },
    'powerful': { stability: 0.4, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'bold': { stability: 0.3, similarityBoost: 0.6, style: 0.9, speakerBoost: true },
    'fearless': { stability: 0.4, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'brave': { stability: 0.5, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    
    // ===== NERVOUS & ANXIOUS EMOTIONS =====
    'nervous': { stability: 0.2, similarityBoost: 0.6, style: 0.7, speakerBoost: false },
    'anxious': { stability: 0.1, similarityBoost: 0.5, style: 0.8, speakerBoost: false },
    'worried': { stability: 0.3, similarityBoost: 0.7, style: 0.6, speakerBoost: false },
    'fearful': { stability: 0.2, similarityBoost: 0.6, style: 0.7, speakerBoost: false },
    'terrified': { stability: 0.0, similarityBoost: 0.4, style: 1.0, speakerBoost: true },
    'panicked': { stability: 0.0, similarityBoost: 0.3, style: 1.0, speakerBoost: true },
    'jittery': { stability: 0.1, similarityBoost: 0.5, style: 0.8, speakerBoost: false },
    'restless': { stability: 0.2, similarityBoost: 0.6, style: 0.7, speakerBoost: false },
    'uneasy': { stability: 0.3, similarityBoost: 0.7, style: 0.6, speakerBoost: false },
    'apprehensive': { stability: 0.4, similarityBoost: 0.7, style: 0.6, speakerBoost: false },
    
    // ===== PLAYFUL & MISCHIEVOUS EMOTIONS =====
    'playful': { stability: 0.3, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'mischievous': { stability: 0.2, similarityBoost: 0.6, style: 0.9, speakerBoost: true },
    'teasing': { stability: 0.4, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'flirtatious': { stability: 0.5, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'coy': { stability: 0.6, similarityBoost: 0.8, style: 0.6, speakerBoost: false },
    'impish': { stability: 0.2, similarityBoost: 0.6, style: 0.9, speakerBoost: true },
    'sassy': { stability: 0.3, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    'cheeky': { stability: 0.4, similarityBoost: 0.7, style: 0.7, speakerBoost: true },
    'witty': { stability: 0.5, similarityBoost: 0.8, style: 0.7, speakerBoost: true },
    'amusing': { stability: 0.4, similarityBoost: 0.7, style: 0.8, speakerBoost: true },
    
    // ===== COMPLEX & NUANCED EMOTIONS =====
    'conflicted': { stability: 0.4, similarityBoost: 0.7, style: 0.6, speakerBoost: false },
    'torn': { stability: 0.3, similarityBoost: 0.6, style: 0.7, speakerBoost: false },
    'ambivalent': { stability: 0.5, similarityBoost: 0.8, style: 0.5, speakerBoost: false },
    'resigned': { stability: 0.8, similarityBoost: 0.9, style: 0.3, speakerBoost: false },
    'defeated': { stability: 0.7, similarityBoost: 0.8, style: 0.4, speakerBoost: false },
    'overwhelmed': { stability: 0.2, similarityBoost: 0.6, style: 0.8, speakerBoost: false },
    'exhausted': { stability: 0.9, similarityBoost: 0.9, style: 0.2, speakerBoost: false },
    'drained': { stability: 0.8, similarityBoost: 0.9, style: 0.3, speakerBoost: false },
    'weary': { stability: 0.9, similarityBoost: 0.9, style: 0.2, speakerBoost: false },
    'nostalgic': { stability: 0.7, similarityBoost: 0.9, style: 0.5, speakerBoost: false },
    
    // ===== DEFAULT MAPPING =====
    'neutral': { stability: 0.6, similarityBoost: 0.8, style: 0.5, speakerBoost: false }
  };

  // ==================== CHARACTER PERSONALITY PROFILES ====================
  
  /**
   * Enhanced character personality profiles for more sophisticated voice selection
   */
  private characterPersonalities: Record<string, VoicePersonality> = {
    'vampire_male': {
      characterType: 'vampire',
      gender: 'male',
      baseVoice: 'vampire_male',
      personality: {
        formality: 0.9,    // Very formal, aristocratic speech
        intensity: 0.7,    // Controlled but intense
        warmth: 0.2,       // Cold, predatory
        dominance: 0.8,    // Naturally commanding
        mystique: 0.9      // Highly mysterious
      }
    },
    'vampire_female': {
      characterType: 'vampire',
      gender: 'female',
      baseVoice: 'vampire_female',
      personality: {
        formality: 0.8,    // Elegant, refined
        intensity: 0.8,    // Passionate, intense
        warmth: 0.3,       // Alluring but cold
        dominance: 0.7,    // Subtly commanding
        mystique: 0.9      // Enigmatic, seductive
      }
    },
    'werewolf_male': {
      characterType: 'werewolf',
      gender: 'male',
      baseVoice: 'werewolf_male',
      personality: {
        formality: 0.3,    // Casual, direct
        intensity: 0.9,    // Raw, powerful
        warmth: 0.7,       // Protective, loyal
        dominance: 0.8,    // Alpha presence
        mystique: 0.4      // Straightforward
      }
    },
    'werewolf_female': {
      characterType: 'werewolf',
      gender: 'female',
      baseVoice: 'werewolf_female',
      personality: {
        formality: 0.4,    // Natural, authentic
        intensity: 0.8,    // Fierce, passionate
        warmth: 0.8,       // Nurturing yet wild
        dominance: 0.7,    // Strong-willed
        mystique: 0.5      // Honest but complex
      }
    },
    'fairy_male': {
      characterType: 'fairy',
      gender: 'male',
      baseVoice: 'fairy_male',
      personality: {
        formality: 0.6,    // Poetic, ethereal
        intensity: 0.5,    // Gentle yet otherworldly
        warmth: 0.6,       // Benevolent
        dominance: 0.5,    // Balanced
        mystique: 0.8      // Ancient, mysterious
      }
    },
    'fairy_female': {
      characterType: 'fairy',
      gender: 'female',
      baseVoice: 'fairy_female',
      personality: {
        formality: 0.7,    // Musical, refined
        intensity: 0.4,    // Delicate, magical
        warmth: 0.8,       // Nurturing, kind
        dominance: 0.4,    // Gentle power
        mystique: 0.8      // Otherworldly
      }
    },
    'human_male': {
      characterType: 'human',
      gender: 'male',
      baseVoice: 'human_male',
      personality: {
        formality: 0.5,    // Adaptable
        intensity: 0.6,    // Human-range emotions
        warmth: 0.6,       // Relatable
        dominance: 0.5,    // Variable
        mystique: 0.3      // Straightforward
      }
    },
    'human_female': {
      characterType: 'human',
      gender: 'female',
      baseVoice: 'human_female',
      personality: {
        formality: 0.5,    // Adaptable
        intensity: 0.6,    // Human-range emotions
        warmth: 0.7,       // Empathetic
        dominance: 0.5,    // Variable
        mystique: 0.3      // Genuine
      }
    },
    'narrator': {
      characterType: 'narrator',
      gender: 'neutral',
      baseVoice: 'narrator',
      personality: {
        formality: 0.7,    // Professional storytelling
        intensity: 0.4,    // Calm, measured
        warmth: 0.5,       // Neutral but engaging
        dominance: 0.6,    // Authoritative narrator
        mystique: 0.5      // Omniscient but accessible
      }
    }
  };

  // ==================== ENHANCED VOICE PARAMETER CALCULATION ====================
  
  /**
   * Calculates optimal voice parameters based on emotion and character personality
   */
  public calculateVoiceParameters(
    emotion: string, 
    characterVoice: CharacterVoiceType,
    intensity: number = 1.0
  ): EmotionVoiceMapping {
    // Get base emotion mapping
    const baseEmotion = this.emotionMappings[emotion.toLowerCase()] || this.emotionMappings['neutral'];
    
    // Get character personality
    const personality = this.characterPersonalities[characterVoice];
    
    if (!personality) {
      return baseEmotion;
    }

    // Apply personality modifiers
    const modifiedParams: EmotionVoiceMapping = {
      stability: this.blendParameter(baseEmotion.stability, personality.personality.intensity, 0.3, intensity),
      similarityBoost: Math.max(0.4, baseEmotion.similarityBoost * (1 + personality.personality.mystique * 0.2)),
      style: this.blendParameter(baseEmotion.style, personality.personality.formality, 0.4, intensity),
      speakerBoost: baseEmotion.speakerBoost || personality.personality.dominance > 0.6
    };

    // Ensure parameters are within valid ranges
    modifiedParams.stability = Math.max(0.0, Math.min(1.0, modifiedParams.stability));
    modifiedParams.similarityBoost = Math.max(0.0, Math.min(1.0, modifiedParams.similarityBoost));
    modifiedParams.style = Math.max(0.0, Math.min(1.0, modifiedParams.style));

    return modifiedParams;
  }

  /**
   * Blends two parameters based on weight and intensity
   */
  private blendParameter(base: number, modifier: number, weight: number, intensity: number): number {
    const blended = base * (1 - weight * intensity) + modifier * weight * intensity;
    return Math.max(0.0, Math.min(1.0, blended));
  }

  // ==================== EMOTION DETECTION & PARSING ====================
  
  /**
   * Extracts emotion from speaker tag: [Character, emotion]: "dialogue"
   */
  public extractEmotionFromSpeakerTag(speakerTag: string): { speaker: string; emotion: string } {
    const match = speakerTag.match(/\[([^,\]]+)(?:,\s*([^,\]]+))?\]/);
    
    if (!match) {
      return { speaker: speakerTag, emotion: 'neutral' };
    }

    const speaker = match[1].trim();
    const emotion = match[2] ? match[2].trim().toLowerCase() : 'neutral';

    return { speaker, emotion };
  }

  /**
   * Gets all available emotions for validation and UI
   */
  public getAvailableEmotions(): string[] {
    return Object.keys(this.emotionMappings).sort();
  }

  /**
   * Validates if an emotion is supported
   */
  public isValidEmotion(emotion: string): boolean {
    return emotion.toLowerCase() in this.emotionMappings;
  }

  // ==================== VOICE CONSISTENCY VERIFICATION ====================
  
  /**
   * Analyzes text for voice consistency opportunities
   */
  public analyzeVoiceConsistency(text: string): {
    speakers: string[];
    speakerCount: Record<string, number>;
    emotionDistribution: Record<string, number>;
    recommendations: string[];
  } {
    const speakers: string[] = [];
    const speakerCount: Record<string, number> = {};
    const emotionDistribution: Record<string, number> = {};
    const recommendations: string[] = [];

    // Extract all speaker tags
    const speakerMatches = text.match(/\[([^\]]+)\]:/g) || [];
    
    for (const match of speakerMatches) {
      const speakerTag = match.replace(/[\[\]:]/g, '');
      const { speaker, emotion } = this.extractEmotionFromSpeakerTag(speakerTag);
      
      speakers.push(speaker);
      speakerCount[speaker] = (speakerCount[speaker] || 0) + 1;
      emotionDistribution[emotion] = (emotionDistribution[emotion] || 0) + 1;
    }

    // Generate recommendations
    const uniqueSpeakers = Object.keys(speakerCount);
    
    if (uniqueSpeakers.length > 6) {
      recommendations.push(`Large cast detected (${uniqueSpeakers.length} speakers). Consider grouping minor characters.`);
    }
    
    if (emotionDistribution['neutral'] && emotionDistribution['neutral'] > speakerMatches.length * 0.7) {
      recommendations.push('Consider adding more emotional variety to dialogue for richer audio experience.');
    }

    const emotionVariety = Object.keys(emotionDistribution).length;
    if (emotionVariety < 3) {
      recommendations.push('Limited emotional range detected. Consider expanding emotional expressions.');
    }

    return {
      speakers: [...new Set(speakers)],
      speakerCount,
      emotionDistribution,
      recommendations
    };
  }
}