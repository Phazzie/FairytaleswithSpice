import { CharacterVoiceType, CharacterVoiceProfile, CreatureType, EmotionalTone } from '../types/contracts';

export class CharacterVoiceService {
  // 11Labs voice IDs for character types
  private voiceMapping: Record<CharacterVoiceType, string> = {
    vampire_male: process.env.ELEVENLABS_VOICE_VAMPIRE_MALE || 'EXAVITQu4vr4xnSDxMaL', // Deep, seductive male
    vampire_female: process.env.ELEVENLABS_VOICE_VAMPIRE_FEMALE || '21m00Tcm4TlvDq8ikWAM', // Sultry, alluring female
    werewolf_male: process.env.ELEVENLABS_VOICE_WEREWOLF_MALE || 'pNInz6obpgDQGcFmaJgB', // Gruff, powerful male
    werewolf_female: process.env.ELEVENLABS_VOICE_WEREWOLF_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Strong, confident female
    fairy_male: process.env.ELEVENLABS_VOICE_FAIRY_MALE || '21m00Tcm4TlvDq8ikWAM', // Ethereal, mystical male
    fairy_female: process.env.ELEVENLABS_VOICE_FAIRY_FEMALE || 'pNInz6obpgDQGcFmaJgB', // Melodic, magical female
    human_male: process.env.ELEVENLABS_VOICE_HUMAN_MALE || 'pNInz6obpgDQGcFmaJgB', // Relatable male
    human_female: process.env.ELEVENLABS_VOICE_HUMAN_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Relatable female
    narrator: process.env.ELEVENLABS_VOICE_NARRATOR || '21m00Tcm4TlvDq8ikWAM' // Neutral, clear narrator
  };

  /**
   * Creates character voice profiles for all unique characters in the story
   */
  createCharacterProfiles(characterNames: string[], storyCreature: CreatureType): CharacterVoiceProfile[] {
    const profiles: CharacterVoiceProfile[] = [];
    
    for (const name of characterNames) {
      const voiceType = this.assignVoiceType(name, storyCreature);
      const creatureType = this.determineCreatureType(name, voiceType, storyCreature);
      
      profiles.push({
        characterName: name,
        creatureType,
        voiceType,
        elevenLabsVoiceId: this.voiceMapping[voiceType],
        emotionalPresets: this.getEmotionalPresets(voiceType)
      });
    }
    
    return profiles;
  }

  /**
   * Gets the 11Labs voice ID for a character voice type
   */
  getVoiceId(voiceType: CharacterVoiceType): string {
    return this.voiceMapping[voiceType];
  }

  /**
   * Gets voice settings for specific emotional tone
   */
  getVoiceSettings(voiceType: CharacterVoiceType, emotionalTone: EmotionalTone) {
    const profile = this.getEmotionalPresets(voiceType);
    const emotionalSettings = profile[emotionalTone];
    
    if (emotionalSettings) {
      return emotionalSettings;
    }
    
    // Fallback to default settings based on voice type
    return this.getDefaultVoiceSettings(voiceType);
  }

  /**
   * Assigns voice type based on character name and story context
   */
  private assignVoiceType(name: string, storyCreature: CreatureType): CharacterVoiceType {
    const lowerName = name.toLowerCase();
    
    // Check for explicit creature mentions in name
    if (lowerName.includes('vampire') || lowerName.includes('count') || lowerName.includes('baron')) {
      return this.isFemaleName(name) ? 'vampire_female' : 'vampire_male';
    }
    if (lowerName.includes('wolf') || lowerName.includes('beast') || lowerName.includes('alpha')) {
      return this.isFemaleName(name) ? 'werewolf_female' : 'werewolf_male';
    }
    if (lowerName.includes('fairy') || lowerName.includes('fae') || lowerName.includes('pixie')) {
      return this.isFemaleName(name) ? 'fairy_female' : 'fairy_male';
    }
    if (lowerName.includes('narrator') || lowerName.includes('voice')) {
      return 'narrator';
    }
    
    // If the main character, assign based on story creature
    if (this.isMainCharacter(name)) {
      const gender = this.isFemaleName(name) ? 'female' : 'male';
      return `${storyCreature}_${gender}` as CharacterVoiceType;
    }
    
    // Default to human voices
    return this.isFemaleName(name) ? 'human_female' : 'human_male';
  }

  /**
   * Determines if a name is female based on common patterns
   */
  private isFemaleName(name: string): boolean {
    const lowerName = name.toLowerCase();
    const femaleIndicators = [
      'lady', 'miss', 'mrs', 'duchess', 'countess', 'princess', 'queen',
      'arabella', 'victoria', 'elizabeth', 'catherine', 'charlotte', 'isabella',
      'sophia', 'elena', 'maria', 'anna', 'emma', 'olivia', 'she', 'her'
    ];
    
    return femaleIndicators.some(indicator => lowerName.includes(indicator));
  }

  /**
   * Determines if this is likely the main character
   */
  private isMainCharacter(name: string): boolean {
    const lowerName = name.toLowerCase();
    const mainCharacterIndicators = [
      'lady', 'lord', 'prince', 'princess', 'count', 'duchess', 'baron'
    ];
    
    return mainCharacterIndicators.some(indicator => lowerName.includes(indicator));
  }

  /**
   * Determines creature type from voice type
   */
  private determineCreatureType(name: string, voiceType: CharacterVoiceType, storyCreature: CreatureType): CreatureType {
    if (voiceType.includes('vampire')) return 'vampire';
    if (voiceType.includes('werewolf')) return 'werewolf';
    if (voiceType.includes('fairy')) return 'fairy';
    
    // If main character, use story creature type
    if (this.isMainCharacter(name)) {
      return storyCreature;
    }
    
    return 'vampire'; // Default fallback
  }

  /**
   * Gets emotional presets for a voice type
   */
  private getEmotionalPresets(voiceType: CharacterVoiceType): CharacterVoiceProfile['emotionalPresets'] {
    const baseSettings = this.getDefaultVoiceSettings(voiceType);
    
    // Voice-specific emotional variations
    switch (voiceType) {
      case 'vampire_male':
      case 'vampire_female':
        return {
          seductive: { ...baseSettings, stability: 0.3, style: 0.8 },
          menacing: { ...baseSettings, stability: 0.8, style: 0.3 },
          passionate: { ...baseSettings, stability: 0.4, style: 0.7 },
          tender: { ...baseSettings, stability: 0.6, style: 0.6 },
          neutral: baseSettings
        };
        
      case 'werewolf_male':
      case 'werewolf_female':
        return {
          gruff: { ...baseSettings, stability: 0.8, style: 0.2 },
          angry: { ...baseSettings, stability: 0.9, style: 0.1 },
          passionate: { ...baseSettings, stability: 0.5, style: 0.6 },
          menacing: { ...baseSettings, stability: 0.7, style: 0.3 },
          neutral: baseSettings
        };
        
      case 'fairy_male':
      case 'fairy_female':
        return {
          ethereal: { ...baseSettings, stability: 0.3, style: 0.9 },
          tender: { ...baseSettings, stability: 0.4, style: 0.8 },
          passionate: { ...baseSettings, stability: 0.5, style: 0.7 },
          fearful: { ...baseSettings, stability: 0.6, style: 0.5 },
          neutral: baseSettings
        };
        
      case 'human_male':
      case 'human_female':
        return {
          passionate: { ...baseSettings, stability: 0.5, style: 0.6 },
          tender: { ...baseSettings, stability: 0.6, style: 0.5 },
          fearful: { ...baseSettings, stability: 0.7, style: 0.4 },
          angry: { ...baseSettings, stability: 0.8, style: 0.3 },
          neutral: baseSettings
        };
        
      case 'narrator':
        return {
          neutral: { ...baseSettings, stability: 0.7, style: 0.3 }
        };
        
      default:
        return { neutral: baseSettings };
    }
  }

  /**
   * Gets default voice settings for a character type
   */
  private getDefaultVoiceSettings(voiceType: CharacterVoiceType) {
    const baseSettings = {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
    };

    // Adjust base settings for character types
    switch (voiceType) {
      case 'vampire_male':
      case 'vampire_female':
        return {
          ...baseSettings,
          stability: 0.4, // More dynamic for seductive quality
          style: 0.7 // Higher style for dramatic flair
        };
        
      case 'werewolf_male':
      case 'werewolf_female':
        return {
          ...baseSettings,
          stability: 0.7, // More stable for gruff consistency
          style: 0.3 // Lower style for rougher sound
        };
        
      case 'fairy_male':
      case 'fairy_female':
        return {
          ...baseSettings,
          stability: 0.3, // Very dynamic for ethereal quality
          style: 0.8 // High style for magical sound
        };
        
      case 'narrator':
        return {
          ...baseSettings,
          stability: 0.8, // Very stable for clear narration
          style: 0.2, // Minimal style for neutrality
          use_speaker_boost: false
        };
        
      default:
        return baseSettings;
    }
  }

  /**
   * Validates that all required voice IDs are configured
   */
  validateVoiceConfiguration(): { isValid: boolean; missingVoices: CharacterVoiceType[] } {
    const missingVoices: CharacterVoiceType[] = [];
    
    for (const [voiceType, voiceId] of Object.entries(this.voiceMapping)) {
      if (!voiceId || voiceId.includes('ELEVENLABS_VOICE_')) {
        missingVoices.push(voiceType as CharacterVoiceType);
      }
    }
    
    return {
      isValid: missingVoices.length === 0,
      missingVoices
    };
  }

  /**
   * Gets available voice types for a creature
   */
  getAvailableVoicesForCreature(creature: CreatureType): CharacterVoiceType[] {
    const baseVoices: CharacterVoiceType[] = ['human_male', 'human_female', 'narrator'];
    
    switch (creature) {
      case 'vampire':
        return [...baseVoices, 'vampire_male', 'vampire_female'];
      case 'werewolf':
        return [...baseVoices, 'werewolf_male', 'werewolf_female'];
      case 'fairy':
        return [...baseVoices, 'fairy_male', 'fairy_female'];
      default:
        return baseVoices;
    }
  }
}