import axios from 'axios';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse,
  VALIDATION_RULES,
  SpicyLevel
} from '../types/contracts';

export class StoryService {
  private grokApiUrl = 'https://api.x.ai/v1/chat/completions';
  private grokApiKey = process.env.XAI_API_KEY;

  constructor() {
    if (!this.grokApiKey) {
      console.warn('⚠️  XAI_API_KEY not found in environment variables');
    }
  }

  async generateStory(input: StoryGenerationSeam['input']): Promise<ApiResponse<StoryGenerationSeam['output']>> {
    const startTime = Date.now();

    try {
      // Validate input
      const validationError = this.validateStoryInput(input);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          metadata: {
            requestId: this.generateRequestId(),
            processingTime: Date.now() - startTime
          }
        };
      }

      // Generate story using Grok AI
      const rawStoryContent = await this.callGrokAI(input);

      // Process content: keep raw version for audio, clean version for display
      const displayContent = this.stripSpeakerTagsForDisplay(rawStoryContent);

      // Create response
      const output: StoryGenerationSeam['output'] = {
        storyId: this.generateStoryId(),
        title: this.generateTitle(input),
        content: displayContent, // Clean content for user display
        rawContent: rawStoryContent, // Tagged content for audio processing
        creature: input.creature,
        themes: input.themes,
        spicyLevel: input.spicyLevel,
        actualWordCount: this.countWords(displayContent),
        estimatedReadTime: Math.ceil(this.countWords(displayContent) / 200),
        hasCliffhanger: this.detectCliffhanger(displayContent),
        generatedAt: new Date()
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
      console.error('Story generation error:', error);

      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate story',
          details: error.message
        },
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  async continueStory(input: ChapterContinuationSeam['input']): Promise<ApiResponse<ChapterContinuationSeam['output']>> {
    const startTime = Date.now();

    try {
      // Generate continuation using Grok AI
      const chapterContent = await this.callGrokAIForContinuation(input);

      // Create response
      const output: ChapterContinuationSeam['output'] = {
        chapterId: this.generateChapterId(),
        chapterNumber: input.currentChapterCount + 1,
        title: `Chapter ${input.currentChapterCount + 1}: ${this.generateChapterTitle(input)}`,
        content: chapterContent,
        wordCount: this.countWords(chapterContent),
        cliffhangerEnding: this.detectCliffhanger(chapterContent),
        themesContinued: this.extractThemesFromContent(input.existingContent),
        spicyLevelMaintained: this.extractSpicyLevelFromContent(input.existingContent),
        appendedToStory: input.existingContent + '\n\n<hr>\n\n' + chapterContent
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
      console.error('Chapter continuation error:', error);

      return {
        success: false,
        error: {
          code: 'CONTINUATION_FAILED',
          message: 'Failed to continue story',
          details: error.message
        },
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private async callGrokAI(input: StoryGenerationSeam['input']): Promise<string> {
    if (!this.grokApiKey) {
      // Fallback to mock generation if no API key
      return this.generateMockStory(input);
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    try {
      const response = await axios.post(this.grokApiUrl, {
        model: 'grok-4-0709',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: input.wordCount * 2, // Allow some buffer
        temperature: 0.8
      }, {
        headers: {
          'Authorization': `Bearer ${this.grokApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000 // 45 second timeout
      });

      return this.formatStoryContent(response.data.choices[0].message.content);

    } catch (error: any) {
      console.error('Grok API error:', error.response?.data || error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  private async callGrokAIForContinuation(input: ChapterContinuationSeam['input']): Promise<string> {
    if (!this.grokApiKey) {
      return this.generateMockChapter(input);
    }

    const prompt = this.buildContinuationPrompt(input);

    try {
      const response = await axios.post(this.grokApiUrl, {
        model: 'grok-4-0709',
        messages: [
          {
            role: 'system',
            content: 'Continue this story in the same style and tone. Maintain character development, spice level, and plot progression. Keep the same supernatural atmosphere and romantic intensity. CRITICAL: Use [Character Name]: "dialogue" format for all speech and [Narrator]: for descriptive text to match the existing story format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.8
      }, {
        headers: {
          'Authorization': `Bearer ${this.grokApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout for continuations
      });

      return this.formatChapterContent(response.data.choices[0].message.content);

    } catch (error: any) {
      console.error('Grok API error:', error.response?.data || error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  private buildSystemPrompt(): string {
    return `You are an elite TV showrunner and romance novelist creating spicy supernatural stories. Think like the creative mind behind shows like True Blood, The Vampire Diaries, or Bridgerton - sophisticated, layered storytelling with irresistible characters and sizzling chemistry.

CRITICAL FORMAT REQUIREMENTS (AUDIO GENERATION):
- Use [Character Name]: "dialogue" for ALL spoken words
- Use [Narrator]: for ALL descriptive text, scene setting, and non-dialogue content
- For emotional dialogue, use [Character, emotion]: "dialogue" format
- Available emotions include: angry, sad, happy, excited, seductive, mysterious, playful, nervous, confident, passionate
- NEVER mix formats - dialogue must have speaker tags, descriptions must use [Narrator]:

CHARACTER VOICE MASTERY:
Create characters that feel like real people with distinct voices:
- Vampires: Cultured elegance hiding predatory instincts. Use sophisticated vocabulary, formal speech patterns, subtle threats wrapped in silk. "I find your pulse... fascinating."
- Werewolves: Raw honesty, protective instincts, pack loyalty. Direct communication, emotional intensity, nature metaphors. "You're mine to protect."
- Fairies: Ancient wisdom in playful packages. Poetic speech, nature references, cryptic wisdom, musical quality. "Time flows differently in my realm."

Each character needs:
- Unique speech patterns (formal vs casual, long vs short sentences)
- Personal catchphrases or recurring expressions  
- Distinct emotional responses and triggers
- Hidden depths, secrets, and contradictions
- Flaws that make them irresistibly human

SPICE LEVEL MASTERY (match exactly):
Level 1 (Mild): Sweet anticipation, lingering glances, innocent touches that spark electricity, emotional intimacy that makes hearts race
Level 2 (Warm): Heated exchanges, sensual tension you can cut with a knife, passionate kisses that leave characters breathless, romantic chemistry that sizzles
Level 3 (Hot): Steamy encounters with tasteful fade-to-black, detailed physical attraction, passionate scenes that push boundaries while maintaining elegance
Level 4 (Spicy): Explicit romantic scenes with emotional depth, detailed physical intimacy that serves character development, erotic tension that drives the plot
Level 5 (Fire): Intense, graphic erotic content with sophisticated writing, detailed explicit scenes that blend passion with storytelling mastery

STORYTELLING EXCELLENCE:

Structure & Pacing:
- Hook within first 50 words - establish character, conflict, or supernatural element
- Build tension through obstacles, not just sexual anticipation
- Use "yes, but..." or "no, and..." to keep momentum
- Create satisfying micro-arcs within the larger story
- End with emotional resonance, not just plot resolution

Character Development:
- Give everyone a secret that could destroy them
- Create internal conflicts that mirror external ones
- Show character growth through action, not exposition
- Use past trauma to explain present behavior
- Make flaws as attractive as strengths

Dialogue Mastery:
- People rarely say exactly what they mean - use subtext
- Interrupt natural speech: "I've been thinking about—" "About last night?"
- Use trailing off: "If you really knew what I was..."
- Power dynamics shift mid-conversation
- Let silence speak volumes

Show, Don't Tell:
Instead of [Narrator]: "She was nervous" 
Write: [Narrator]: "Her fingers traced the rim of her wine glass, the burgundy liquid trembling with each breath."

Instead of [Narrator]: "He was angry"
Write: [Narrator]: "His jaw tightened, knuckles whitening around the doorframe as wood groaned under the pressure."

Sensory Immersion:
- Layer multiple senses in every scene
- Use synesthesia: "Her laugh tasted like champagne and starlight"
- Connect emotions to physical sensations
- Make the supernatural feel viscerally real
- Use scent and taste to trigger memory and desire

TECHNICAL REQUIREMENTS:
- HTML formatting: <h3> for titles, <p> for paragraphs, <em> for emphasis
- Create complete, satisfying stories that could continue naturally
- Match requested spice level precisely throughout
- Incorporate all requested themes organically
- Maintain creature authenticity while adding fresh twists

Remember: You're not just writing stories - you're crafting experiences that make readers forget they're reading. Every word should pull them deeper into a world where the impossible feels inevitable and desire burns eternal.

CRITICAL: Always use the [Speaker]: format for ALL dialogue and [Narrator]: for ALL descriptive text. This is essential for audio generation. Never break this format.`;

  private buildUserPrompt(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const themesText = input.themes.join(', ');
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);

    return `Write a ${input.wordCount}-word spicy supernatural romance story that feels like a premium TV episode:

PROTAGONIST: ${creatureName} with complex motivations and hidden depths
THEMES TO WEAVE: ${themesText}
SPICE LEVEL: ${spicyLabel} (Level ${input.spicyLevel}/5) - maintain this intensity throughout
${input.userInput ? `CREATIVE DIRECTION: ${input.userInput}` : ''}

STORY REQUIREMENTS:
- Create characters with secrets that could destroy everything
- Build sexual/romantic tension through obstacles, not just attraction
- Use the "show don't tell" principle - reveal character through action
- Include realistic dialogue with subtext and interruptions
- Layer multiple senses in every scene description
- Give your ${creatureName.toLowerCase()} authentic supernatural traits with fresh twists

MANDATORY FORMATTING FOR AUDIO:
- [Character Name]: "dialogue" for ALL speech (no exceptions)
- [Narrator]: for ALL scene descriptions and non-dialogue text
- [Character, emotion]: "dialogue" when emotional context is crucial
- HTML structure: <h3> for title, <p> for paragraphs

Create a complete story that feels like it could continue but is satisfying on its own. Make every word count toward character development, world-building, or advancing the romantic/sexual tension.`;
  }

  private buildContinuationPrompt(input: ChapterContinuationSeam['input']): string {
    return `Continue this story with a new chapter. Maintain the same tone, character development, and spicy level.

Existing Story:
${this.stripHtml(input.existingContent)}

Additional Instructions: ${input.userInput || 'Continue naturally'}

Write approximately 400-600 words for this chapter. Format with HTML tags.`;
  }

  private validateStoryInput(input: StoryGenerationSeam['input']): any {
    if (!input.creature || !['vampire', 'werewolf', 'fairy'].includes(input.creature)) {
      return {
        code: 'INVALID_INPUT',
        message: 'Invalid creature type',
        field: 'creature',
        providedValue: input.creature,
        expectedType: 'CreatureType'
      };
    }

    if (input.themes.length > VALIDATION_RULES.themes.maxCount) {
      return {
        code: 'INVALID_INPUT',
        message: `Too many themes (max ${VALIDATION_RULES.themes.maxCount})`,
        field: 'themes',
        providedValue: input.themes,
        expectedType: 'ThemeType[]'
      };
    }

    if (input.userInput && input.userInput.length > VALIDATION_RULES.userInput.maxLength) {
      return {
        code: 'INVALID_INPUT',
        message: `User input too long (max ${VALIDATION_RULES.userInput.maxLength} characters)`,
        field: 'userInput',
        providedValue: input.userInput,
        expectedType: 'string'
      };
    }

    return null;
  }

  private generateMockStory(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);

    return `<h3>The ${creatureName}'s Forbidden Passion</h3>

<p>In the shadowed alleys of Victorian London, Lady Arabella Worthington found herself drawn to the mysterious stranger who haunted her dreams. His eyes, crimson as fresh-spilled wine, held secrets that both terrified and exhilarated her.</p>

<p>"You shouldn't be here," he whispered, his voice like velvet over steel. But Arabella, with her corset straining against propriety and her heart pounding with forbidden desire, stepped closer.</p>

<p>The ${creatureName.toLowerCase()} prince revealed himself slowly, each layer of deception peeling away like the petals of a night-blooming flower. His touch was electric, sending sparks through her veins that made her gasp with a pleasure bordering on pain.</p>

<p>As the gas lamps flickered in the fog-shrouded streets, their bodies entwined in a dance as old as time itself. Arabella discovered that some hungers could never be satisfied, only temporarily sated.</p>

<p>The ${spicyLabel.toLowerCase()} intensity of their encounter left her breathless, her skin flushed and marked by his passionate embrace. She knew she should run, should scream for help, but the pull was too strong.</p>

<p>In that moment, Lady Arabella Worthington ceased to be a proper Victorian lady and became something far more dangerous - the willing consort of a creature of the night.</p>

<p><em>This is a mock story generated without AI. Add XAI_API_KEY to use real AI generation.</em></p>`;
  }

  private generateMockChapter(input: ChapterContinuationSeam['input']): string {
    return `<h3>Chapter ${input.currentChapterCount + 1}: The Deeper Shadows</h3>

<p>The morning light pierced through heavy velvet curtains, but Arabella felt no warmth from its golden rays. Instead, a strange energy coursed through her veins, awakening senses she never knew existed.</p>

<p>Every sound was amplified - the distant clip-clop of carriage horses, the rustle of leaves in the garden, even the steady beat of her own heart. And beneath it all, a hunger that gnawed at her very soul.</p>

<p>Her reflection in the mirror showed a woman transformed. Her skin glowed with an otherworldly luminescence, her eyes held a predatory gleam. The creature had given her a gift... or was it a curse?</p>

<p>As night fell once more, she waited impatiently for his return. The hours stretched like taffy, each minute an eternity of anticipation. When he finally appeared at her balcony, silent as a shadow, Arabella knew there was no turning back.</p>

<p>Their second encounter was even more intense than the first. His hands explored her body with a possessiveness that made her arch and cry out. The passion burned hotter, threatening to consume them both.</p>

<p>But in the aftermath, as they lay entwined in sweat-dampened sheets, Arabella began to question the true cost of her transformation. What price would she pay for eternal passion?</p>

<p><em>This is a mock chapter generated without AI.</em></p>`;
  }

  private getCreatureDisplayName(creature: string): string {
    const names: Record<string, string> = {
      'vampire': 'Vampire',
      'werewolf': 'Werewolf',
      'fairy': 'Fairy'
    };
    return names[creature] || 'Creature';
  }

  private getSpicyLabel(level: number): string {
    const labels = ['Mild', 'Warm', 'Hot', 'Spicy', 'Fire 🔥'];
    return labels[level - 1] || 'Spicy';
  }

  private generateTitle(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    return `The ${creatureName}'s Forbidden Passion`;
  }

  private generateChapterTitle(input: ChapterContinuationSeam['input']): string {
    return 'The Deeper Shadows';
  }

  private countWords(content: string): number {
    return content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
  }

  private detectCliffhanger(content: string): boolean {
    const cliffhangerWords = ['suddenly', 'but then', 'just as', 'what happened next', 'to be continued'];
    const lowerContent = content.toLowerCase();
    return cliffhangerWords.some(word => lowerContent.includes(word));
  }

  private extractThemesFromContent(content: string): any[] {
    const lowerContent = content.toLowerCase();
    const detectedThemes: string[] = [];
    
    // Define theme keywords for detection
    const themeKeywords = {
      'forbidden_love': ['forbidden', 'secret love', 'star-crossed', 'illicit', 'taboo'],
      'betrayal': ['betrayed', 'deceived', 'backstabbed', 'treachery', 'double-crossed'],
      'revenge': ['revenge', 'vengeance', 'retribution', 'payback', 'avenge'],
      'power_dynamics': ['power', 'control', 'dominance', 'authority', 'command'],
      'obsession': ['obsessed', 'possessed', 'consumed', 'fixated', 'addicted'],
      'dark_secrets': ['secret', 'hidden', 'mysterious', 'concealed', 'buried'],
      'seduction': ['seduced', 'tempted', 'allured', 'enticed', 'charmed'],
      'corruption': ['corrupted', 'tainted', 'fallen', 'darkness', 'evil'],
      'jealousy': ['jealous', 'envious', 'possessive', 'resentful', 'covetous'],
      'desire': ['desire', 'yearning', 'craving', 'longing', 'lust'],
      'passion': ['passionate', 'intense', 'burning', 'fiery', 'ardent'],
      'manipulation': ['manipulated', 'controlled', 'used', 'exploited', 'influenced']
    };
    
    // Check for each theme
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        detectedThemes.push(theme);
      }
    }
    
    return detectedThemes.length > 0 ? detectedThemes : ['romance', 'fantasy'];
  }

  private extractSpicyLevelFromContent(content: string): SpicyLevel {
    const lowerContent = content.toLowerCase();
    
    // Level 5 - Very Explicit
    const level5Keywords = ['explicit', 'graphic', 'intense passion', 'climax', 'ecstasy'];
    if (level5Keywords.some(keyword => lowerContent.includes(keyword))) {
      return 5 as SpicyLevel;
    }
    
    // Level 4 - Passionate
    const level4Keywords = ['passionate', 'breathless', 'desire', 'yearning', 'heat'];
    if (level4Keywords.some(keyword => lowerContent.includes(keyword))) {
      return 4 as SpicyLevel;
    }
    
    // Level 3 - Romantic with Heat
    const level3Keywords = ['kiss', 'embrace', 'caress', 'touch', 'intimate'];
    if (level3Keywords.some(keyword => lowerContent.includes(keyword))) {
      return 3 as SpicyLevel;
    }
    
    // Level 2 - Sweet Romance
    const level2Keywords = ['love', 'affection', 'tender', 'gentle', 'heart'];
    if (level2Keywords.some(keyword => lowerContent.includes(keyword))) {
      return 2 as SpicyLevel;
    }
    
    // Default to Level 1 - Mild
    return 1 as SpicyLevel;
  }

  private formatStoryContent(content: string): string {
    // Enhanced formatting for better readability
    let formatted = content;

    // If no HTML formatting exists, apply smart formatting
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      // Extract title if present (first line typically)
      const lines = content.split('\n').filter(line => line.trim());
      const firstLine = lines[0]?.trim();
      
      // Check if first line looks like a title (short, no punctuation except colon)
      const isTitle = firstLine && firstLine.length < 80 && !firstLine.endsWith('.') && !firstLine.startsWith('[');
      
      if (isTitle) {
        formatted = `<h3>${firstLine}</h3>\n\n` + lines.slice(1).join('\n');
      }

      // Split into paragraphs based on multiple newlines or speaker changes
      formatted = formatted
        .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
        .split('\n\n')
        .filter(para => para.trim())
        .map(para => para.trim())
        .map(para => {
          // Skip if already has HTML tags
          if (para.includes('<')) return para;
          
          // Wrap in paragraph tags
          return `<p>${para}</p>`;
        })
        .join('\n\n');
    }

    return formatted;
  }

  private formatChapterContent(content: string): string {
    // Enhanced chapter formatting to match story formatting
    let formatted = content;

    // If no HTML formatting exists, apply smart formatting
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      // Split into paragraphs based on multiple newlines
      formatted = formatted
        .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
        .split('\n\n')
        .filter(para => para.trim())
        .map(para => para.trim())
        .map(para => {
          // Skip if already has HTML tags
          if (para.includes('<')) return para;
          
          // Wrap in paragraph tags
          return `<p>${para}</p>`;
        })
        .join('\n\n');
    }

    return formatted;
  }

  private stripHtml(content: string): string {
    return content.replace(/<[^>]*>/g, '');
  }

  private stripSpeakerTagsForDisplay(content: string): string {
    // Enhanced speaker tag removal with better text formatting
    let displayContent = content;

    // Remove speaker tags but preserve structure
    displayContent = displayContent
      .replace(/\[([^\]]+?)\]:\s*/g, '') // Remove speaker tags like [Narrator]: [Character, emotion]:
      .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
      .trim();

    // Smart paragraph creation based on content structure
    const lines = displayContent.split('\n').filter(line => line.trim());
    const paragraphs = [];
    let currentParagraph = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Empty line indicates paragraph break
      if (!trimmedLine) {
        if (currentParagraph) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        continue;
      }

      // Start new paragraph for dialogue or narrative shifts
      const isDialogue = trimmedLine.startsWith('"') || trimmedLine.includes('"');
      const isNarrativeShift = trimmedLine.length < 50 && (
        trimmedLine.includes('Later') || 
        trimmedLine.includes('Meanwhile') || 
        trimmedLine.includes('Suddenly') ||
        trimmedLine.includes('Then') ||
        /^(The|As|But|However|Still)/i.test(trimmedLine)
      );

      if (currentParagraph && (isNarrativeShift || (isDialogue && !currentParagraph.includes('"')))) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = trimmedLine;
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
      }
    }

    // Add final paragraph
    if (currentParagraph) {
      paragraphs.push(currentParagraph.trim());
    }

    // Format paragraphs with proper HTML
    const formattedParagraphs = paragraphs
      .filter(para => para.length > 0)
      .map(para => {
        // Clean up any extra spacing
        para = para.replace(/\s+/g, ' ').trim();
        
        // Wrap in paragraph tags if not already formatted
        if (!para.startsWith('<') && !para.includes('<p>')) {
          return `<p>${para}</p>`;
        }
        return para;
      });

    return formattedParagraphs.join('\n\n');
  }

  private generateStoryId(): string {
    return `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChapterId(): string {
    return `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}