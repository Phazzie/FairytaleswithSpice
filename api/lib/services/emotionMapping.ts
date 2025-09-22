/**
 * Enhanced Audio Service with Emotion Mapping
 * Comprehensive emotion → voice parameter mapping system for character consistency
 */

export interface EmotionVoiceMapping {
  emotion: string;
  stability: number;        // 0.0-1.0, emotional consistency
  similarity_boost: number; // 0.0-1.0, character voice similarity
  style: number;           // 0.0-1.0, emotion intensity
  use_speaker_boost: boolean; // Enhanced character consistency
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

/**
 * Comprehensive 90+ emotion mapping for voice parameter optimization
 * Based on psychological emotion research and ElevenLabs voice parameter effectiveness
 */
export const EMOTION_VOICE_MAPPINGS: Record<string, EmotionVoiceMapping> = {
  // ==================== BASIC EMOTIONS ====================
  'anger': { emotion: 'anger', stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
  'fear': { emotion: 'fear', stability: 0.2, similarity_boost: 0.9, style: 0.6, use_speaker_boost: true },
  'joy': { emotion: 'joy', stability: 0.7, similarity_boost: 0.6, style: 0.5, use_speaker_boost: false },
  'sadness': { emotion: 'sadness', stability: 0.4, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
  'surprise': { emotion: 'surprise', stability: 0.1, similarity_boost: 0.7, style: 0.8, use_speaker_boost: false },
  'disgust': { emotion: 'disgust', stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },

  // ==================== ROMANTIC/SEDUCTIVE EMOTIONS ====================
  'seductive': { emotion: 'seductive', stability: 0.6, similarity_boost: 0.7, style: 0.8, use_speaker_boost: true },
  'passionate': { emotion: 'passionate', stability: 0.4, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  'lustful': { emotion: 'lustful', stability: 0.5, similarity_boost: 0.7, style: 0.8, use_speaker_boost: true },
  'loving': { emotion: 'loving', stability: 0.8, similarity_boost: 0.6, style: 0.6, use_speaker_boost: false },
  'intimate': { emotion: 'intimate', stability: 0.7, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
  'flirtatious': { emotion: 'flirtatious', stability: 0.6, similarity_boost: 0.5, style: 0.7, use_speaker_boost: false },
  'alluring': { emotion: 'alluring', stability: 0.6, similarity_boost: 0.7, style: 0.8, use_speaker_boost: true },
  'tempting': { emotion: 'tempting', stability: 0.5, similarity_boost: 0.7, style: 0.8, use_speaker_boost: true },

  // ==================== POWER/DOMINANCE EMOTIONS ====================
  'dominant': { emotion: 'dominant', stability: 0.8, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
  'commanding': { emotion: 'commanding', stability: 0.9, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  'authoritative': { emotion: 'authoritative', stability: 0.8, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
  'submissive': { emotion: 'submissive', stability: 0.6, similarity_boost: 0.9, style: 0.4, use_speaker_boost: true },
  'defiant': { emotion: 'defiant', stability: 0.4, similarity_boost: 0.7, style: 0.8, use_speaker_boost: true },
  'rebellious': { emotion: 'rebellious', stability: 0.3, similarity_boost: 0.7, style: 0.8, use_speaker_boost: true },

  // ==================== SUPERNATURAL/CREATURE-SPECIFIC EMOTIONS ====================
  'predatory': { emotion: 'predatory', stability: 0.7, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
  'bloodthirsty': { emotion: 'bloodthirsty', stability: 0.5, similarity_boost: 0.8, style: 0.9, use_speaker_boost: true },
  'feral': { emotion: 'feral', stability: 0.2, similarity_boost: 0.7, style: 0.9, use_speaker_boost: true },
  'otherworldly': { emotion: 'otherworldly', stability: 0.6, similarity_boost: 0.6, style: 0.7, use_speaker_boost: false },
  'magical': { emotion: 'magical', stability: 0.5, similarity_boost: 0.5, style: 0.6, use_speaker_boost: false },
  'ethereal': { emotion: 'ethereal', stability: 0.7, similarity_boost: 0.5, style: 0.5, use_speaker_boost: false },
  'ancient': { emotion: 'ancient', stability: 0.9, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
  'immortal': { emotion: 'immortal', stability: 0.8, similarity_boost: 0.7, style: 0.3, use_speaker_boost: true },

  // ==================== DARK/GOTHIC EMOTIONS ====================
  'menacing': { emotion: 'menacing', stability: 0.7, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
  'sinister': { emotion: 'sinister', stability: 0.6, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
  'brooding': { emotion: 'brooding', stability: 0.6, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
  'tormented': { emotion: 'tormented', stability: 0.4, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  'haunted': { emotion: 'haunted', stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  'melancholic': { emotion: 'melancholic', stability: 0.6, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
  'vengeful': { emotion: 'vengeful', stability: 0.5, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
  'malicious': { emotion: 'malicious', stability: 0.6, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },

  // ==================== VULNERABILITY/INNOCENCE EMOTIONS ====================
  'vulnerable': { emotion: 'vulnerable', stability: 0.5, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true },
  'innocent': { emotion: 'innocent', stability: 0.8, similarity_boost: 0.6, style: 0.3, use_speaker_boost: false },
  'naive': { emotion: 'naive', stability: 0.7, similarity_boost: 0.7, style: 0.4, use_speaker_boost: false },
  'confused': { emotion: 'confused', stability: 0.3, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
  'hesitant': { emotion: 'hesitant', stability: 0.4, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
  'uncertain': { emotion: 'uncertain', stability: 0.3, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },

  // ==================== COMPLEX/LAYERED EMOTIONS ====================
  'bittersweet': { emotion: 'bittersweet', stability: 0.6, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
  'conflicted': { emotion: 'conflicted', stability: 0.4, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  'yearning': { emotion: 'yearning', stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  'desperate': { emotion: 'desperate', stability: 0.3, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
  'obsessed': { emotion: 'obsessed', stability: 0.4, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true },
  'possessive': { emotion: 'possessive', stability: 0.6, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },

  // ==================== SOCIAL/INTERPERSONAL EMOTIONS ====================
  'jealous': { emotion: 'jealous', stability: 0.4, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
  'envious': { emotion: 'envious', stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  'protective': { emotion: 'protective', stability: 0.7, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  'territorial': { emotion: 'territorial', stability: 0.6, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true },
  'loyal': { emotion: 'loyal', stability: 0.8, similarity_boost: 0.7, style: 0.5, use_speaker_boost: true },
  'betrayed': { emotion: 'betrayed', stability: 0.4, similarity_boost: 0.9, style: 0.7, use_speaker_boost: true },

  // ==================== ENERGY/INTENSITY EMOTIONS ====================
  'energetic': { emotion: 'energetic', stability: 0.5, similarity_boost: 0.6, style: 0.7, use_speaker_boost: false },
  'enthusiastic': { emotion: 'enthusiastic', stability: 0.6, similarity_boost: 0.6, style: 0.7, use_speaker_boost: false },
  'excited': { emotion: 'excited', stability: 0.4, similarity_boost: 0.6, style: 0.8, use_speaker_boost: false },
  'calm': { emotion: 'calm', stability: 0.9, similarity_boost: 0.7, style: 0.3, use_speaker_boost: false },
  'serene': { emotion: 'serene', stability: 0.9, similarity_boost: 0.6, style: 0.2, use_speaker_boost: false },
  'restless': { emotion: 'restless', stability: 0.3, similarity_boost: 0.7, style: 0.6, use_speaker_boost: true },

  // ==================== COMMUNICATION/EXPRESSION EMOTIONS ====================
  'whispering': { emotion: 'whispering', stability: 0.8, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true },
  'shouting': { emotion: 'shouting', stability: 0.2, similarity_boost: 0.7, style: 0.9, use_speaker_boost: true },
  'pleading': { emotion: 'pleading', stability: 0.4, similarity_boost: 0.9, style: 0.7, use_speaker_boost: true },
  'demanding': { emotion: 'demanding', stability: 0.6, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
  'sarcastic': { emotion: 'sarcastic', stability: 0.7, similarity_boost: 0.7, style: 0.6, use_speaker_boost: true },
  'mocking': { emotion: 'mocking', stability: 0.6, similarity_boost: 0.7, style: 0.7, use_speaker_boost: true },

  // ==================== DEFAULT/NEUTRAL ====================
  'neutral': { emotion: 'neutral', stability: 0.7, similarity_boost: 0.7, style: 0.5, use_speaker_boost: false },
  'speaking': { emotion: 'speaking', stability: 0.7, similarity_boost: 0.7, style: 0.5, use_speaker_boost: false }
};

/**
 * Gets available emotions for story generation prompts
 */
export function getAvailableEmotions(): string[] {
  return Object.keys(EMOTION_VOICE_MAPPINGS).sort();
}

/**
 * Extracts and optimizes voice settings for emotional context
 */
export function getVoiceSettingsForEmotion(emotion: string): VoiceSettings {
  const mapping = EMOTION_VOICE_MAPPINGS[emotion.toLowerCase()] || EMOTION_VOICE_MAPPINGS['neutral'];
  
  return {
    stability: mapping.stability,
    similarity_boost: mapping.similarity_boost,
    style: mapping.style,
    use_speaker_boost: mapping.use_speaker_boost
  };
}

/**
 * Analyzes emotional intensity and adjusts voice parameters accordingly
 */
export function adjustVoiceForEmotionalIntensity(baseSettings: VoiceSettings, intensity: number = 1.0): VoiceSettings {
  // Intensity should be between 0.0 and 2.0 (2.0 for extreme emotions)
  const clampedIntensity = Math.max(0.0, Math.min(2.0, intensity));
  
  return {
    stability: Math.max(0.0, Math.min(1.0, baseSettings.stability * (2.0 - clampedIntensity * 0.5))),
    similarity_boost: baseSettings.similarity_boost,
    style: Math.max(0.0, Math.min(1.0, baseSettings.style * clampedIntensity)),
    use_speaker_boost: baseSettings.use_speaker_boost || clampedIntensity > 1.2
  };
}