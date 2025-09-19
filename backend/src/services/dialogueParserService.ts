import { DialogueSegment, CharacterVoiceType, EmotionalTone, CreatureType } from '../types/contracts';

export class DialogueParserService {
  /**
   * Parses story content to extract dialogue segments with speaker information
   * Supports [Speaker]: format and extracts emotional context
   */
  parseDialogue(content: string): DialogueSegment[] {
    const segments: DialogueSegment[] = [];
    
    // Remove HTML tags for parsing
    const cleanContent = this.stripHtmlTags(content);
    
    // Split content into lines for processing
    const lines = cleanContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let segmentId = 1;
    
    for (const line of lines) {
      // Check if line contains dialogue in [Speaker]: format
      const dialogueMatch = line.match(/^\[([^\]]+)\]:\s*(.+)$/);
      
      if (dialogueMatch) {
        const speaker = dialogueMatch[1].trim();
        const text = dialogueMatch[2].trim();
        
        // Extract emotional tone from text context
        const emotionalTone = this.detectEmotionalTone(text);
        
        // Determine voice type (will be refined by character assignment)
        const voiceType = this.getInitialVoiceType(speaker);
        
        segments.push({
          id: `segment_${segmentId++}`,
          speaker,
          text,
          voiceType,
          emotionalTone
        });
      }
    }
    
    return segments;
  }

  /**
   * Assigns character voice types based on speaker names and story context
   */
  assignCharacterVoices(segments: DialogueSegment[], storyCreature: CreatureType): DialogueSegment[] {
    const characterAnalysis = this.analyzeCharacters(segments, storyCreature);
    
    return segments.map(segment => ({
      ...segment,
      voiceType: characterAnalysis[segment.speaker] || segment.voiceType
    }));
  }

  /**
   * Splits content into narrative and dialogue segments for mixed audio generation
   */
  parseNarrativeAndDialogue(content: string): Array<{type: 'narrative' | 'dialogue', content: string, segment?: DialogueSegment}> {
    const result: Array<{type: 'narrative' | 'dialogue', content: string, segment?: DialogueSegment}> = [];
    
    // Remove HTML tags but preserve structure for parsing
    const cleanContent = this.stripHtmlTags(content);
    const lines = cleanContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let narrativeBuffer: string[] = [];
    let segmentId = 1;
    
    for (const line of lines) {
      const dialogueMatch = line.match(/^\[([^\]]+)\]:\s*(.+)$/);
      
      if (dialogueMatch) {
        // Process any accumulated narrative
        if (narrativeBuffer.length > 0) {
          result.push({
            type: 'narrative',
            content: narrativeBuffer.join(' ')
          });
          narrativeBuffer = [];
        }
        
        // Process dialogue
        const speaker = dialogueMatch[1].trim();
        const text = dialogueMatch[2].trim();
        const emotionalTone = this.detectEmotionalTone(text);
        const voiceType = this.getInitialVoiceType(speaker);
        
        const segment: DialogueSegment = {
          id: `segment_${segmentId++}`,
          speaker,
          text,
          voiceType,
          emotionalTone
        };
        
        result.push({
          type: 'dialogue',
          content: text,
          segment
        });
      } else {
        // Accumulate narrative text
        narrativeBuffer.push(line);
      }
    }
    
    // Process any remaining narrative
    if (narrativeBuffer.length > 0) {
      result.push({
        type: 'narrative',
        content: narrativeBuffer.join(' ')
      });
    }
    
    return result;
  }

  /**
   * Detects emotional tone from dialogue text
   */
  private detectEmotionalTone(text: string): EmotionalTone {
    const lowerText = text.toLowerCase();
    
    // Emotional keywords mapping
    const emotionalPatterns: Record<EmotionalTone, string[]> = {
      seductive: ['whispered', 'breathed', 'purred', 'seductively', 'sultry', 'desire', 'want you', 'need you'],
      gruff: ['growled', 'snarled', 'barked', 'roughly', 'harshly', 'demanded', 'gruffly'],
      ethereal: ['sang', 'chimed', 'melodically', 'softly', 'gently', 'like music', 'celestial'],
      menacing: ['threatened', 'warned', 'darkly', 'dangerously', 'ominously', 'death', 'kill'],
      passionate: ['cried out', 'exclaimed', 'fervently', 'intensely', 'love', 'passion', 'heart'],
      tender: ['tenderly', 'lovingly', 'gently', 'sweetly', 'caressed', 'soft', 'care'],
      angry: ['shouted', 'yelled', 'angrily', 'furiously', 'rage', 'anger', 'mad'],
      fearful: ['trembled', 'fearfully', 'afraid', 'scared', 'terror', 'worried', 'anxious'],
      neutral: []
    };
    
    // Check for emotional indicators
    for (const [tone, keywords] of Object.entries(emotionalPatterns)) {
      if (tone === 'neutral') continue;
      
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return tone as EmotionalTone;
        }
      }
    }
    
    // Check punctuation for emotional cues
    if (text.includes('!')) {
      return 'passionate';
    }
    if (text.includes('...')) {
      return 'tender';
    }
    if (text.includes('?') && lowerText.includes('what')) {
      return 'fearful';
    }
    
    return 'neutral';
  }

  /**
   * Determines initial voice type based on speaker name
   */
  private getInitialVoiceType(speaker: string): CharacterVoiceType {
    const lowerSpeaker = speaker.toLowerCase();
    
    // Gender detection
    const femaleNames = ['lady', 'miss', 'mrs', 'arabella', 'victoria', 'elizabeth', 'catherine', 'charlotte', 'she', 'her'];
    const maleNames = ['lord', 'sir', 'mr', 'prince', 'king', 'duke', 'count', 'he', 'him'];
    
    const isFemale = femaleNames.some(name => lowerSpeaker.includes(name));
    const isMale = maleNames.some(name => lowerSpeaker.includes(name));
    
    // Creature type detection from name
    if (lowerSpeaker.includes('vampire') || lowerSpeaker.includes('blood') || lowerSpeaker.includes('fang')) {
      return isFemale ? 'vampire_female' : 'vampire_male';
    }
    if (lowerSpeaker.includes('wolf') || lowerSpeaker.includes('beast') || lowerSpeaker.includes('alpha')) {
      return isFemale ? 'werewolf_female' : 'werewolf_male';
    }
    if (lowerSpeaker.includes('fairy') || lowerSpeaker.includes('fae') || lowerSpeaker.includes('pixie')) {
      return isFemale ? 'fairy_female' : 'fairy_male';
    }
    if (lowerSpeaker.includes('narrator') || lowerSpeaker.includes('voice')) {
      return 'narrator';
    }
    
    // Default to human voices
    return isFemale ? 'human_female' : (isMale ? 'human_male' : 'narrator');
  }

  /**
   * Analyzes all characters in segments to assign appropriate voice types
   */
  private analyzeCharacters(segments: DialogueSegment[], storyCreature: CreatureType): Record<string, CharacterVoiceType> {
    const characterVoices: Record<string, CharacterVoiceType> = {};
    
    // Group speakers and analyze their patterns
    const speakerAnalysis: Record<string, {
      segments: DialogueSegment[],
      emotionalTones: EmotionalTone[],
      textSample: string
    }> = {};
    
    // Collect data for each speaker
    for (const segment of segments) {
      if (!speakerAnalysis[segment.speaker]) {
        speakerAnalysis[segment.speaker] = {
          segments: [],
          emotionalTones: [],
          textSample: ''
        };
      }
      
      speakerAnalysis[segment.speaker].segments.push(segment);
      speakerAnalysis[segment.speaker].emotionalTones.push(segment.emotionalTone);
      speakerAnalysis[segment.speaker].textSample += ' ' + segment.text;
    }
    
    // Assign voices based on analysis
    for (const [speaker, analysis] of Object.entries(speakerAnalysis)) {
      const voiceType = this.determineCharacterVoice(speaker, analysis, storyCreature);
      characterVoices[speaker] = voiceType;
    }
    
    return characterVoices;
  }

  /**
   * Determines the most appropriate voice type for a character
   */
  private determineCharacterVoice(
    speaker: string, 
    analysis: { segments: DialogueSegment[], emotionalTones: EmotionalTone[], textSample: string }, 
    storyCreature: CreatureType
  ): CharacterVoiceType {
    const lowerSpeaker = speaker.toLowerCase();
    const lowerTextSample = analysis.textSample.toLowerCase();
    
    // Determine gender
    const femaleIndicators = ['lady', 'miss', 'mrs', 'she', 'her', 'woman', 'girl'];
    const maleIndicators = ['lord', 'sir', 'mr', 'he', 'him', 'man', 'boy', 'prince', 'king'];
    
    const isFemale = femaleIndicators.some(indicator => 
      lowerSpeaker.includes(indicator) || lowerTextSample.includes(indicator)
    );
    const isMale = maleIndicators.some(indicator => 
      lowerSpeaker.includes(indicator) || lowerTextSample.includes(indicator)
    );
    
    // Determine creature type from context
    const creatureContext = this.determineCreatureContext(speaker, analysis, storyCreature);
    
    // Assign voice based on creature and gender
    if (creatureContext === 'vampire') {
      return isFemale ? 'vampire_female' : 'vampire_male';
    } else if (creatureContext === 'werewolf') {
      return isFemale ? 'werewolf_female' : 'werewolf_male';
    } else if (creatureContext === 'fairy') {
      return isFemale ? 'fairy_female' : 'fairy_male';
    } else if (lowerSpeaker.includes('narrator')) {
      return 'narrator';
    } else {
      // Default to human
      return isFemale ? 'human_female' : (isMale ? 'human_male' : 'human_male');
    }
  }

  /**
   * Determines creature type from speaker context
   */
  private determineCreatureContext(
    speaker: string, 
    analysis: { emotionalTones: EmotionalTone[], textSample: string }, 
    storyCreature: CreatureType
  ): CreatureType | 'human' {
    const lowerSpeaker = speaker.toLowerCase();
    const lowerTextSample = analysis.textSample.toLowerCase();
    
    // Direct creature mentions
    if (lowerSpeaker.includes('vampire') || lowerTextSample.includes('blood') || lowerTextSample.includes('bite')) {
      return 'vampire';
    }
    if (lowerSpeaker.includes('wolf') || lowerSpeaker.includes('beast') || lowerTextSample.includes('howl')) {
      return 'werewolf';
    }
    if (lowerSpeaker.includes('fairy') || lowerSpeaker.includes('fae') || lowerTextSample.includes('magic')) {
      return 'fairy';
    }
    
    // Emotional pattern analysis
    const seductiveCount = analysis.emotionalTones.filter(tone => tone === 'seductive').length;
    const gruffCount = analysis.emotionalTones.filter(tone => tone === 'gruff').length;
    const etherealCount = analysis.emotionalTones.filter(tone => tone === 'ethereal').length;
    
    // If main character matches story creature type and has appropriate emotional patterns
    if (storyCreature === 'vampire' && seductiveCount > 0) {
      return 'vampire';
    }
    if (storyCreature === 'werewolf' && gruffCount > 0) {
      return 'werewolf';
    }
    if (storyCreature === 'fairy' && etherealCount > 0) {
      return 'fairy';
    }
    
    return 'human';
  }

  /**
   * Removes HTML tags from content
   */
  private stripHtmlTags(content: string): string {
    return content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }
}