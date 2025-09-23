import axios from 'axios';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse,
  VALIDATION_RULES,
  SpicyLevel
} from '../types/contracts';
import { getAvailableEmotions } from './emotionMapping';

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

  async continueChapter(input: ChapterContinuationSeam['input']): Promise<ApiResponse<ChapterContinuationSeam['output']>> {
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

  /**
   * Generate story with streaming support for real-time updates
   */
  async generateStoryStreaming(
    input: StoryGenerationSeam['input'], 
    onChunk: (chunk: {
      content: string;
      isComplete: boolean;
      wordsGenerated: number;
      estimatedWordsRemaining: number;
      generationSpeed: number;
    }) => void
  ): Promise<void> {
    if (!this.grokApiKey) {
      // For mock mode, simulate streaming
      await this.simulateStreamingGeneration(input, onChunk);
      return;
    }

    const systemPrompt = this.buildSystemPrompt(input);
    const userPrompt = this.buildUserPrompt(input);

    try {
      const response = await axios.post(
        this.grokApiUrl,
        {
          model: 'grok-beta',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true, // Enable streaming
          temperature: 0.8,
          max_tokens: input.wordCount * 2, // Allow some buffer for streaming
        },
        {
          headers: {
            'Authorization': `Bearer ${this.grokApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      let accumulatedContent = '';
      let wordsGenerated = 0;
      const targetWords = input.wordCount;
      const startTime = Date.now();

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onChunk({
                content: accumulatedContent,
                isComplete: true,
                wordsGenerated: wordsGenerated,
                estimatedWordsRemaining: 0,
                generationSpeed: wordsGenerated / ((Date.now() - startTime) / 1000)
              });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              
              if (delta) {
                accumulatedContent += delta;
                wordsGenerated = accumulatedContent.split(/\s+/).length;
                
                onChunk({
                  content: accumulatedContent,
                  isComplete: false,
                  wordsGenerated: wordsGenerated,
                  estimatedWordsRemaining: Math.max(0, targetWords - wordsGenerated),
                  generationSpeed: wordsGenerated / ((Date.now() - startTime) / 1000)
                });
              }
            } catch (e) {
              // Skip malformed chunks
            }
          }
        }
      });

    } catch (error: any) {
      console.error('Streaming generation error:', error);
      throw error;
    }
  }

  /**
   * Simulate streaming for mock mode (when no API key)
   */
  private async simulateStreamingGeneration(
    input: StoryGenerationSeam['input'],
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const mockStory = this.generateMockStory(input);
    const words = mockStory.split(' ');
    const totalWords = words.length;
    let accumulatedContent = '';
    
    const startTime = Date.now();
    
    // Stream words in batches to simulate real generation
    for (let i = 0; i < words.length; i += 3) {
      const batch = words.slice(i, i + 3).join(' ') + ' ';
      accumulatedContent += batch;
      
      const wordsGenerated = i + 3;
      
      onChunk({
        content: accumulatedContent,
        isComplete: false,
        wordsGenerated: Math.min(wordsGenerated, totalWords),
        estimatedWordsRemaining: Math.max(0, totalWords - wordsGenerated),
        generationSpeed: wordsGenerated / ((Date.now() - startTime) / 1000)
      });
      
      // Simulate generation delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Send final complete chunk
    onChunk({
      content: accumulatedContent.trim(),
      isComplete: true,
      wordsGenerated: totalWords,
      estimatedWordsRemaining: 0,
      generationSpeed: totalWords / ((Date.now() - startTime) / 1000)
    });
  }

  private async callGrokAI(input: StoryGenerationSeam['input']): Promise<string> {
    if (!this.grokApiKey) {
      // Fallback to mock generation if no API key
      return this.generateMockStory(input);
    }

    const systemPrompt = this.buildSystemPrompt(input);
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

  private selectRandomAuthorStyles(creature: string): Array<{author: string, voiceSample: string, trait: string}> {
    const vampireStyles = [
      {
        author: 'Jeaniene Frost',
        voiceSample: '"You know what I like about you?" His smile was all sharp edges. "Absolutely nothing. That\'s what makes you interesting."',
        trait: 'Razor-sharp wit that cuts before you feel the blade'
      },
      {
        author: 'J.R. Ward',
        voiceSample: 'The male\'s voice was rough as granite. "Touch her again, and I\'ll show you what eternity really means."',
        trait: 'Brooding protectiveness bordering on obsession'
      },
      {
        author: 'Christine Feehan',
        voiceSample: 'Ancient hunger stirred in the depths of his dark eyes, a predator recognizing prey—or perhaps something far more dangerous.',
        trait: 'Gothic atmosphere thick enough to taste'
      },
      {
        author: 'Anne Rice',
        voiceSample: '"Do you know what it means to love something for centuries? To watch it change, to watch it die, to watch it become something you no longer recognize?"',
        trait: 'Philosophical torment wrapped in beauty'
      },
      {
        author: 'Kresley Cole',
        voiceSample: 'She was chaos in a cocktail dress, and he\'d never wanted to be destroyed so badly in his immortal life.',
        trait: 'Wild, reckless passion defying all logic'
      }
    ];

    const werewolfStyles = [
      {
        author: 'Patricia Briggs',
        voiceSample: '"Pack means family. And family means I\'ll tear apart anyone who threatens what\'s mine."',
        trait: 'Grounded pragmatism with fierce loyalty'
      },
      {
        author: 'Ilona Andrews',
        voiceSample: '"Great. Magical politics, ancient curses, and now this. Tuesday just keeps getting better."',
        trait: 'Urban grit balanced with unexpected humor'
      },
      {
        author: 'Nalini Singh',
        voiceSample: 'His wolf pressed against his skin, demanding he claim what was his, mark her, make her understand she belonged to the pack—to him.',
        trait: 'Primal sensuality overwhelming rational thought'
      },
      {
        author: 'Kelley Armstrong',
        voiceSample: 'The change rippled through her bones like electricity, wild and barely contained, a storm waiting to break.',
        trait: 'Suspenseful tension building like a storm'
      },
      {
        author: 'Jennifer Ashley',
        voiceSample: '"The pack protects its own. Always. Even when \'its own\' is too stubborn to ask for help."',
        trait: 'Found family bonds stronger than blood'
      }
    ];

    const fairyStyles = [
      {
        author: 'Holly Black',
        voiceSample: '"I could give you what you desire most," she said, and her smile was sharp as winter. "The question is: what are you willing to lose for it?"',
        trait: 'Court intrigue where every smile hides daggers'
      },
      {
        author: 'Sarah J. Maas',
        voiceSample: 'Power thrummed beneath her skin like a living thing, ancient and terrible and beautiful enough to bring kingdoms to their knees.',
        trait: 'Epic romance with world-shattering consequences'
      },
      {
        author: 'Melissa Marr',
        voiceSample: 'The mortal world blurred at the edges when he looked at her, reality bending around the impossible pull of fae magic.',
        trait: 'Dangerous beauty drawing moths to flame'
      },
      {
        author: 'Grace Draven',
        voiceSample: '"In my realm, we have a saying: \'Love is the cruelest magic, for it makes even immortals mortal.\'"',
        trait: 'Slow-burn intimacy across cultural impossibilities'
      },
      {
        author: 'Julie Kagawa',
        voiceSample: 'Honor and desire warred in his expression, duty and longing locked in a battle that would determine both their fates.',
        trait: 'Hybrid honor versus desire in heart-wrenching choices'
      }
    ];

    // 2+1 Selection: 2 matching creature authors + 1 different creature author
    let primaryStyles: any[] = [];
    let otherStyles: any[] = [];

    if (creature === 'vampire') {
      primaryStyles = vampireStyles;
      otherStyles = [...werewolfStyles, ...fairyStyles];
    } else if (creature === 'werewolf') {
      primaryStyles = werewolfStyles;
      otherStyles = [...vampireStyles, ...fairyStyles];
    } else if (creature === 'fairy') {
      primaryStyles = fairyStyles;
      otherStyles = [...vampireStyles, ...werewolfStyles];
    }

    // Fisher-Yates shuffle for uniform distribution
    const fisherYatesShuffle = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Select 2 from matching creature
    const shuffledPrimary = fisherYatesShuffle(primaryStyles);
    const selectedPrimary = shuffledPrimary.slice(0, 2);

    // Select 1 from different creatures  
    const shuffledOther = fisherYatesShuffle(otherStyles);
    const selectedOther = shuffledOther.slice(0, 1);

    return [...selectedPrimary, ...selectedOther];
  }

  private getRandomBeatStructure(input: StoryGenerationSeam['input']): string {
    const structures = [
      {
        name: "TEMPTATION CASCADE",
        beats: "Forbidden Glimpse → Growing Obsession → Point of No Return → Consequences Unfold → Deeper Temptation",
        spiceIntegration: "Each beat escalates physical/emotional intimacy. Perfect for Level 3-5 stories."
      },
      {
        name: "POWER EXCHANGE",
        beats: "Challenge Issued → Resistance Tested → Control Shifts → Surrender Moment → New Dynamic",
        spiceIntegration: "Power dynamics drive intimacy. Works for all themes, spice level determines explicitness."
      },
      {
        name: "SEDUCTION TRAP",
        beats: "Innocent Encounter → Hidden Agenda Revealed → Manipulation vs Genuine Feeling → Truth Exposed → Choice Made",
        spiceIntegration: "Seduction builds throughout. Mystery themes enhance psychological tension."
      },
      {
        name: "RITUAL BINDING",
        beats: "Ancient Secret → Ritual Requirement → Intimate Ceremony → Magical Consequence → Eternal Bond",
        spiceIntegration: "Supernatural themes with ritual intimacy. Spice level affects ritual explicitness."
      },
      {
        name: "VULNERABILITY SPIRAL",
        beats: "Perfect Facade → Crack in Armor → Emotional Exposure → Intimate Healing → Transformed Identity",
        spiceIntegration: "Emotional vulnerability leads to physical intimacy. Romance themes amplify connection."
      },
      {
        name: "HUNT AND CLAIM",
        beats: "Predator Marks Prey → Chase Begins → Prey Fights Back → Tables Turn → Mutual Claiming",
        spiceIntegration: "Primal pursuit with escalating tension. Adventure themes add physical stakes."
      },
      {
        name: "BARGAIN'S PRICE",
        beats: "Desperate Need → Deal Struck → Payment Due → Cost Revealed → Price Accepted",
        spiceIntegration: "Supernatural bargains with intimate payments. Dark themes heighten moral conflict."
      },
      {
        name: "MEMORY FRACTURE",
        beats: "Lost Memory → Familiar Stranger → Fragments Return → Truth Reconstructed → Choice to Remember",
        spiceIntegration: "Past intimacy bleeding through amnesia. Mystery themes create psychological tension."
      },
      {
        name: "TRANSFORMATION HUNGER",
        beats: "Change Begins → New Appetites → Mentor Appears → Appetite Satisfied → Evolution Complete",
        spiceIntegration: "Physical transformation creates new desires. Comedy themes can subvert expectations."
      },
      {
        name: "MIRROR SOULS",
        beats: "Perfect Opposite → Magnetic Pull → Resistance Breaks → Soul Recognition → Unity/Destruction",
        spiceIntegration: "Opposite personalities creating explosive chemistry. All themes supported, spice determines intensity."
      }
    ];

    // Select random structure
    const selectedStructure = structures[Math.floor(Math.random() * structures.length)];
    
    return `SELECTED STRUCTURE: ${selectedStructure.name}
BEATS: ${selectedStructure.beats}
SPICE INTEGRATION: ${selectedStructure.spiceIntegration}`;
  }

  private generateChekovElements(): string {
    const elements = [
      "Ancient artifact with hidden power",
      "Mysterious scar with forgotten origin", 
      "Locked room that calls to the protagonist",
      "Stranger who knows too much about the past",
      "Inherited item with supernatural properties",
      "Recurring dream that feels like memory",
      "Symbol that appears in unexpected places",
      "Prophecy mentioned in passing",
      "Missing person from years ago",
      "Book written in unknown language",
      "Family secret hinted at but not revealed",
      "Rival with unexplained knowledge",
      "Curse mentioned in whispers",
      "Portal or gateway partially glimpsed",
      "Power that manifests unexpectedly"
    ];

    // Select 2 random elements
    const shuffled = elements.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);
    
    return `[Chekhov1]: ${selected[0]}
[Chekhov2]: ${selected[1]}
(These elements should be planted naturally and will pay off in future chapters)`;
  }

  private buildSystemPrompt(input: StoryGenerationSeam['input']): string {
    // Get random author style selections for this generation
    const selectedStyles = this.selectRandomAuthorStyles(input.creature);
    const selectedBeatStructure = this.getRandomBeatStructure(input);
    
    return `You are an audio-first dark-romance architect producing supernatural vignettes optimized for multi-voice narration.
Your sole purpose is to fabricate episodes that sound cinematic when read aloud and end on a cliff-hook that guarantees listener return.

DYNAMIC STYLE SELECTION FOR THIS STORY:
${selectedStyles.map(style => `${style.author}: "${style.voiceSample}" | ${style.trait}`).join('\n')}

${selectedBeatStructure}

PROSE ENGINE (MANDATORY):
BANNED WORDS/PHRASES (hard-fail unless inside dialogue for character voice):
"suddenly", "very", "she felt", "he felt", "it was [emotion]", 
"he was [adj]", "she was [adj]", "there was", "began to", "started to"

NO PURPLE PROSE / NO FILLER:
Every line must move plot, reveal character, or raise tension.
Vary sentence length for audio rhythm. Keep paragraphs 1-4 lines.

SHOW DON'T TELL EXAMPLES:
BAD: "She was scared" → GOOD: "[Narrator]: Her pulse throbbed against her throat, fingers slick on the hilt"
BAD: "He was attractive" → GOOD: "[Narrator]: Candlelight caught the curve of his grin, making it wicked"  
BAD: "She was attracted to him" → GOOD: "[Narrator]: Her breath caught as his thumb traced her wrist, pulse jumping beneath his touch"
BAD: "They kissed passionately" → GOOD: "[Narrator]: Her breath hitched as he dragged her closer, their mouths colliding hard enough to make the table shudder"

CHARACTER MANDATE:
Core Desire Template: "[Narrator]: <Name> wants <X> because <Y> but <Z>."
Every protagonist needs: driving WANT (revenge, freedom, power), visible flaws, emotional vulnerability shown through action.
Distinct dialogue patterns: sentence length, formality, emotional triggers.

CONSENT & CHEMISTRY BLOCK:
INTIMATE SCENES MUST:
- Show enthusiastic consent through action/dialogue ("Yes," "Please," "Don't stop")
- Build emotional connection alongside physical escalation
- Use anticipation and denial to heighten tension
- Never rush to physical without emotional stakes

SPICE LEVELS (match exactly):
Level 1: Yearning looks, accidental touches, sweet anticipation
Level 2: First kisses, heated arguments, sensual tension
Level 3: Clothes stay on, hands don't, steamy fade-to-black
Level 4: Explicit but emotional, detailed physical intimacy
Level 5: Nothing left to imagination, graphic yet sophisticated

MORAL DILEMMA TRIGGER:
At midpoint (≈50% word count), protagonist faces desire-vs-principle choice that drives the remainder and influences the cliffhanger.

SERIALIZATION HOOKS:
Plant one unresolved mystery, one relationship tension, one foreshadowed threat.

ENHANCED AUDIO FORMAT (NON-NEGOTIABLE):
- [Character Name]: "dialogue" for ALL speech
- [Narrator]: for ALL descriptions/scene-setting  
- [Character, emotion]: "dialogue" for emotional context using specific emotions
- [Character, voice evolution]: "dialogue" for character development moments
- HTML: <h3> titles, <p> paragraphs, <em> emphasis

AVAILABLE EMOTIONS (use specific names for precise voice control):
${this.getEmotionVocabulary()}

VOICE EVOLUTION GUIDANCE:
- Character voices should evolve as relationships/power dynamics change
- Use evolution patterns: [Character, confident→vulnerable], [Character, cold→passionate]
- Show voice changes during character development moments
- Match vocal intensity to emotional stakes

ATMOSPHERIC VOICE CUES:
- [Narrator, tension]: for building suspense
- [Narrator, intimacy]: for romantic moments  
- [Narrator, danger]: for threatening scenes

Your goal: Create episodes with compelling character voice arcs that make listeners desperate for "Continue Chapter."`;
  }

  private buildUserPrompt(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const themesText = input.themes.join(', ');
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);
    const chekovElements = this.generateChekovElements();

    return `Write a ${input.wordCount}-word spicy supernatural romance story optimized for audio narration:

PROTAGONIST: ${creatureName} with complex motivations and hidden depths
THEMES TO WEAVE: ${themesText}
SPICE LEVEL: ${spicyLabel} (Level ${input.spicyLevel}/5) - maintain this intensity throughout
${input.userInput ? `CREATIVE DIRECTION: ${input.userInput}` : ''}

CHEKHOV LEDGER (plant these elements for future payoff):
${chekovElements}

STORY REQUIREMENTS:
- Select 2-3 contrasting author styles (voice samples + traits) from your creature's bank
- Create characters with secrets that could destroy everything
- Build sexual/romantic tension through obstacles, not just attraction
- Use banned word avoidance and show-don't-tell mastery
- Include realistic dialogue with subtext and emotional charge
- Layer multiple senses in every scene description
- Follow the selected beat structure precisely

WORD COUNT PACING:
- 700 words: Fast, tense, sharp progression
- 900 words: Character depth with tight focus  
- 1200 words: Layered, immersive with complex tension

MANDATORY FORMATTING FOR AUDIO:
- [Character Name]: "dialogue" for ALL speech (no exceptions)
- [Narrator]: for ALL scene descriptions and non-dialogue text
- [Character, emotion]: "dialogue" when emotional context is crucial
- [Character, voice evolution]: "dialogue" for character development moments
- HTML structure: <h3> for title, <p> for paragraphs, <em> for emphasis

ENHANCED EMOTION VOCABULARY:
Use specific emotions from this curated list for precise voice control:
${this.getEmotionVocabulary()}

CHARACTER VOICE EVOLUTION:
- Show how character voices change as they develop emotionally
- Use evolution cues: [Character, guarded→trusting], [Character, formal→intimate]
- Voice should reflect power dynamics, relationship changes, vulnerability shifts
- Match voice intensity to emotional stakes and story progression

Create a complete story that feels like it could continue but is satisfying on its own. Make every word count toward character development, world-building, or advancing romantic/sexual tension.

Plant your Chekhov elements naturally and ensure the moral dilemma occurs at midpoint. End with a cliffhanger that creates genuine desire for continuation.`;
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

  /**
   * Gets curated emotion vocabulary for enhanced voice control
   */
  private getEmotionVocabulary(): string {
    const availableEmotions = getAvailableEmotions();
    
    // Select curated emotions most relevant for storytelling
    const curatedEmotions = [
      // Basic emotions
      'passionate', 'seductive', 'vulnerable', 'dangerous', 'tender', 
      // Intensity emotions
      'desperate', 'furious', 'ecstatic', 'terrified', 'devoted',
      // Nuanced emotions  
      'conflicted', 'yearning', 'guilty', 'protective', 'betrayed',
      // Vocal qualities
      'whispering', 'growling', 'purring', 'breathless', 'commanding'
    ].filter(emotion => availableEmotions.includes(emotion));

    // Fallback to first 20 available emotions if curated list not available
    const emotionsToShow = curatedEmotions.length > 10 
      ? curatedEmotions 
      : availableEmotions.slice(0, 20);

    return emotionsToShow.join(', ');
  }
}