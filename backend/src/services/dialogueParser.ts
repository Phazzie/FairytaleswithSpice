import { DialogueSegment, EmotionType, CharacterVoiceType, CreatureType } from '../types/contracts';

/**
 * DialogueParser extracts and processes dialogue segments from story content
 * Handles [Speaker]: and [Speaker, emotion]: formats from AI-generated stories
 */
export class DialogueParser {
  
  /**
   * Parse story content and extract dialogue segments with character voice assignments
   */
  parseStoryDialogue(content: string, creatureType?: CreatureType): DialogueSegment[] {
    // Remove HTML tags first
    const cleanContent = this.cleanHtmlContent(content);
    
    // Split content into segments based on dialogue patterns
    const segments = this.extractDialogueSegments(cleanContent);
    
    // Assign character voices based on analysis
    const processedSegments = segments.map(segment => ({
      ...segment,
      voiceType: this.assignCharacterVoice(segment.speaker, segment.emotion, creatureType)
    }));
    
    return processedSegments;
  }

  /**
   * Clean HTML content while preserving dialogue structure
   */
  private cleanHtmlContent(htmlContent: string): string {
    // Replace paragraph tags with newlines to preserve dialogue structure
    return htmlContent
      .replace(/<\/p>\s*<p>/g, '\n') // Replace paragraph breaks with newlines
      .replace(/<p[^>]*>/g, '') // Remove opening paragraph tags
      .replace(/<\/p>/g, '\n') // Replace closing paragraph tags with newlines
      .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
      .replace(/\n\s*\n/g, '\n') // Remove extra newlines
      .trim();
  }

  /**
   * Extract dialogue segments using regex patterns for [Speaker]: and [Speaker, emotion]: formats
   */
  private extractDialogueSegments(content: string): DialogueSegment[] {
    const segments: DialogueSegment[] = [];
    
    // Split content by paragraphs/sentences that contain dialogue patterns
    const lines = content.split(/\n+/);
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Look for [Speaker]: or [Speaker, emotion]: patterns
      const dialogueMatch = trimmedLine.match(/\[([^,\]]+)(?:,\s*([^,\]]+))?\]:\s*(.+)/);
      
      if (dialogueMatch) {
        const [, speaker, emotion, text] = dialogueMatch;
        
        segments.push({
          speaker: speaker.trim(),
          text: text.trim().replace(/^["'"]/g, '').replace(/["'"]$/g, ''), // Clean quotes
          emotion: this.parseEmotion(emotion),
          voiceType: 'narrator' // Will be assigned later
        });
      }
    }
    
    // If no dialogue segments found, treat entire content as narrator
    if (segments.length === 0) {
      segments.push({
        speaker: 'Narrator',
        text: content,
        emotion: 'neutral',
        voiceType: 'narrator'
      });
    }
    
    return segments;
  }

  /**
   * Parse emotion from dialogue tag, mapping to our EmotionType
   */
  private parseEmotion(emotionText?: string): EmotionType {
    if (!emotionText) return 'neutral';
    
    const emotionMap: Record<string, EmotionType> = {
      'seductive': 'seductive',
      'seductively': 'seductive',
      'angry': 'angry',
      'angrily': 'angry',
      'fearful': 'fearful',
      'fearfully': 'fearful',
      'passionate': 'passionate',
      'passionately': 'passionate',
      'tender': 'tender',
      'tenderly': 'tender',
      'commanding': 'commanding',
      'commandingly': 'commanding',
      'playful': 'playful',
      'playfully': 'playful',
      'mysterious': 'mysterious',
      'mysteriously': 'mysterious',
      'intimate': 'intimate',
      'intimately': 'intimate',
      'sultry': 'seductive',
      'growling': 'angry',
      'whispering': 'intimate',
      'breathless': 'passionate'
    };
    
    const normalized = emotionText.toLowerCase().trim();
    return emotionMap[normalized] || 'neutral';
  }

  /**
   * Assign character-specific voice types based on speaker analysis and creature context
   */
  private assignCharacterVoice(speaker: string, emotion?: EmotionType, creatureType?: CreatureType): CharacterVoiceType {
    const speakerLower = speaker.toLowerCase();
    
    // Handle narrator specially
    if (speakerLower.includes('narrator') || speakerLower.includes('description')) {
      return 'narrator';
    }
    
    // Analyze speaker name for creature type indicators
    const isVampire = this.isVampireCharacter(speakerLower);
    const isWerewolf = this.isWerewolfCharacter(speakerLower);
    const isFairy = this.isFairyCharacter(speakerLower);
    
    // Determine gender from name/context
    const isFemale = this.inferGender(speakerLower);
    
    // Assign voice based on creature type analysis
    if (isVampire) {
      return isFemale ? 'vampire_female' : 'vampire_male';
    } else if (isWerewolf) {
      return isFemale ? 'werewolf_female' : 'werewolf_male';
    } else if (isFairy) {
      return isFemale ? 'fairy_female' : 'fairy_male';
    } else if (creatureType) {
      // Fallback to story's main creature type
      return isFemale ? `${creatureType}_female` as CharacterVoiceType : `${creatureType}_male` as CharacterVoiceType;
    } else {
      // Default to human voices
      return isFemale ? 'human_female' : 'human_male';
    }
  }

  /**
   * Detect vampire characters from speaker names
   */
  private isVampireCharacter(speakerName: string): boolean {
    const vampireIndicators = [
      'vampire', 'lord', 'count', 'baron', 'duke', 'master',
      'bloodsucker', 'fang', 'dark', 'shadow', 'night',
      'dracula', 'vlad', 'alucard', 'carmilla', 'lilith'
    ];
    
    return vampireIndicators.some(indicator => speakerName.includes(indicator));
  }

  /**
   * Detect werewolf characters from speaker names
   */
  private isWerewolfCharacter(speakerName: string): boolean {
    const werewolfIndicators = [
      'wolf', 'werewolf', 'alpha', 'beta', 'pack', 'luna',
      'howl', 'fang', 'claw', 'beast', 'wild', 'hunter',
      'fenrir', 'lycan', 'lycanthrope'
    ];
    
    return werewolfIndicators.some(indicator => speakerName.includes(indicator));
  }

  /**
   * Detect fairy characters from speaker names
   */
  private isFairyCharacter(speakerName: string): boolean {
    const fairyIndicators = [
      'fairy', 'fae', 'pixie', 'sprite', 'nymph', 'sylph',
      'queen', 'princess', 'court', 'wing', 'magic', 'mystical',
      'titania', 'oberon', 'puck', 'aurora', 'luna'
    ];
    
    return fairyIndicators.some(indicator => speakerName.includes(indicator));
  }

  /**
   * Infer gender from speaker name (basic implementation)
   */
  private inferGender(speakerName: string): boolean {
    const femaleIndicators = [
      'lady', 'queen', 'princess', 'duchess', 'countess', 'miss', 'mrs',
      'she', 'her', 'woman', 'girl', 'female', 'bella', 'sarah', 'luna',
      'anna', 'emma', 'sophia', 'isabella', 'olivia', 'emily', 'lily',
      'carmilla', 'lilith', 'aurora', 'titania', 'morgana'
    ];
    
    const maleIndicators = [
      'lord', 'king', 'prince', 'duke', 'count', 'baron', 'master', 'mr',
      'he', 'him', 'man', 'boy', 'male', 'adam', 'alex', 'damien',
      'gabriel', 'lucas', 'adrian', 'marcus', 'sebastian', 'nicholas',
      'dracula', 'vlad', 'alucard', 'fenrir', 'oberon', 'lucifer'
    ];
    
    const hasFemaleIndicator = femaleIndicators.some(indicator => speakerName.includes(indicator));
    const hasMaleIndicator = maleIndicators.some(indicator => speakerName.includes(indicator));
    
    if (hasFemaleIndicator && !hasMaleIndicator) return true;
    if (hasMaleIndicator && !hasFemaleIndicator) return false;
    
    // Default to female for romantic stories (matches existing voice preference)
    return true;
  }

  /**
   * Analyze content and suggest optimal character voice mappings
   */
  getCharacterVoiceMapping(segments: DialogueSegment[]): Record<string, CharacterVoiceType> {
    const mapping: Record<string, CharacterVoiceType> = {};
    
    segments.forEach(segment => {
      if (!mapping[segment.speaker]) {
        mapping[segment.speaker] = segment.voiceType;
      }
    });
    
    return mapping;
  }

  /**
   * Estimate total audio duration based on text length and voice types
   */
  estimateAudioDuration(segments: DialogueSegment[], speed: number = 1.0): number {
    let totalDuration = 0;
    
    segments.forEach(segment => {
      // Different voice types have different speaking rates
      const baseWordsPerSecond = this.getVoiceWordsPerSecond(segment.voiceType);
      const adjustedRate = baseWordsPerSecond * speed;
      
      const wordCount = segment.text.split(/\s+/).length;
      segment.duration = Math.ceil(wordCount / adjustedRate);
      
      totalDuration += segment.duration;
      
      // Add small pauses between speakers
      if (segments.indexOf(segment) > 0) {
        totalDuration += 0.5; // 500ms pause between dialogue
      }
    });
    
    return totalDuration;
  }

  /**
   * Get speaking rate for different voice types
   */
  private getVoiceWordsPerSecond(voiceType: CharacterVoiceType): number {
    const rates: Record<CharacterVoiceType, number> = {
      'vampire_male': 2.0, // Slower, more deliberate
      'vampire_female': 2.2,
      'werewolf_male': 2.8, // Faster, more direct
      'werewolf_female': 2.6,
      'fairy_male': 2.4, // Mystical pace
      'fairy_female': 2.3,
      'human_male': 2.5, // Standard rate
      'human_female': 2.4,
      'narrator': 2.2 // Slower for clarity
    };
    
    return rates[voiceType] || 2.5;
  }
}