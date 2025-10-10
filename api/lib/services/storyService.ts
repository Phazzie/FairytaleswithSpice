import axios from 'axios';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse,
  VALIDATION_RULES,
  SpicyLevel
} from '../types/contracts';

/**
 * Interface for Grok API response structure
 */
interface GrokApiResponse {
  data: {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  };
}

export class StoryService {
  private grokApiUrl = 'https://api.x.ai/v1/chat/completions';
  private grokApiKey = process.env['XAI_API_KEY'];

  constructor() {
    if (!this.grokApiKey) {
      console.warn('⚠️  XAI_API_KEY not found in environment variables');
    }
  }

  /**
   * Calculate optimal token allocation for story generation
   * Accounts for: word-to-token ratio, HTML overhead, speaker tags, safety buffer
   */
  private calculateOptimalTokens(wordCount: number): number {
    const tokensPerWord = 1.5;        // English averages ~1.5 tokens per word
    const htmlOverhead = 1.2;         // HTML tags add ~20% overhead
    const speakerTagOverhead = 1.15;  // Speaker tags add ~15% overhead
    const safetyBuffer = 1.1;         // 10% safety margin for quality
    
    return Math.ceil(
      wordCount * 
      tokensPerWord * 
      htmlOverhead * 
      speakerTagOverhead * 
      safetyBuffer
    );
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
          model: 'grok-4-fast-reasoning', // Use same model for consistency
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true, // Enable streaming
          stream_options: {
            include_usage: true
          },
          temperature: 0.8,
          max_tokens: this.calculateOptimalTokens(input.wordCount),
          top_p: 0.95,
          frequency_penalty: 0.3
          // Note: Grok-4 doesn't support presence_penalty parameter
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
        model: 'grok-4-fast-reasoning',
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
        max_tokens: this.calculateOptimalTokens(input.wordCount),
        temperature: 0.8,
        top_p: 0.95,              // Focus on high-quality tokens
        frequency_penalty: 0.3    // Reduce repetitive phrasing
        // Note: Grok-4 doesn't support presence_penalty parameter
      }, {
        headers: {
          'Authorization': `Bearer ${this.grokApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000 // 45 second timeout
      });

      // Validate response structure before accessing
      return this.validateAndExtractGrokResponse(response, 'story');

    } catch (error: any) {
      console.error('Grok API error:', error.response?.data || error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  /**
   * Validate Grok API response structure and extract content safely
   * @param response - The API response to validate
   * @param type - 'story' for story generation, 'chapter' for chapter continuation
   */
  private validateAndExtractGrokResponse(response: GrokApiResponse, type: 'story' | 'chapter' = 'story'): string {
    // Validate response exists
    if (!response) {
      throw new Error('No response received from AI service');
    }
    
    // Validate data property
    if (!response.data) {
      console.error('Invalid response structure:', response);
      throw new Error('Invalid response structure from AI service');
    }
    
    // Validate choices array
    if (!Array.isArray(response.data.choices)) {
      console.error('Response missing choices array:', response.data);
      throw new Error('AI service returned invalid response format');
    }
    
    if (response.data.choices.length === 0) {
      console.error('Response has empty choices array:', response.data);
      throw new Error('AI service returned no content choices');
    }
    
    // Validate first choice
    const firstChoice = response.data.choices[0];
    if (!firstChoice) {
      throw new Error('AI service returned invalid choice format');
    }
    
    // Validate message
    if (!firstChoice.message) {
      console.error('Choice missing message:', firstChoice);
      throw new Error('AI service response missing message');
    }
    
    // Validate content
    if (typeof firstChoice.message.content !== 'string') {
      console.error('Message content is not a string:', firstChoice.message);
      throw new Error('AI service returned invalid content type');
    }
    
    if (!firstChoice.message.content.trim()) {
      throw new Error('AI service returned empty content');
    }
    
    // Success - format and return using appropriate formatter
    return type === 'chapter' 
      ? this.formatChapterContent(firstChoice.message.content)
      : this.formatStoryContent(firstChoice.message.content);
  }

  private async callGrokAIForContinuation(input: ChapterContinuationSeam['input']): Promise<string> {
    if (!this.grokApiKey) {
      return this.generateMockChapter(input);
    }

    const prompt = this.buildContinuationPrompt(input);

    try {
      const response = await axios.post(this.grokApiUrl, {
        model: 'grok-4-fast-reasoning',
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
        max_tokens: this.calculateOptimalTokens(500), // ~500 words per chapter
        temperature: 0.8,
        top_p: 0.95,
        frequency_penalty: 0.3
        // Note: Grok-4 doesn't support presence_penalty parameter
      }, {
        headers: {
          'Authorization': `Bearer ${this.grokApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout for continuations
      });

      return this.validateAndExtractGrokResponse(response, 'chapter');

    } catch (error: any) {
      console.error('Grok API error:', error.response?.data || error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  private selectRandomAuthorStyles(creature: string): Array<{author: string, voiceSample: string, trait: string}> {
    // EXPANDED: 12 authors per creature type for massive style variety
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
      },
      {
        author: 'Charlaine Harris',
        voiceSample: '"Sugar, in the South, we don\'t hide our fangs behind pretty words. We smile real sweet and strike when you least expect it."',
        trait: 'Southern charm masking vampire politics and cozy mystery'
      },
      {
        author: 'Sherrilyn Kenyon',
        voiceSample: 'Eleven thousand years of existence, and nothing—nothing—had prepared him for the way she looked at him like he might still be worth saving.',
        trait: 'Dark-Hunter mythology with tortured immortal warriors'
      },
      {
        author: 'Gena Showalter',
        voiceSample: '"Oh, you want to play?" Her grin was pure mischief. "Lords of the Underworld Rule #1: Never challenge what you can\'t handle."',
        trait: 'Playful banter masking Lords of the Underworld intensity'
      },
      {
        author: 'L.J. Smith',
        voiceSample: 'The triangle between them crackled with impossible tension—human, vampire, and the question of who would claim her heart first.',
        trait: 'Teen angst meets vampire romance with love triangle mastery'
      },
      {
        author: 'Kim Harrison',
        voiceSample: '"I\'m a bounty hunter who dates a vampire and pisses off ancient demons before breakfast. What could possibly go wrong?"',
        trait: 'Urban fantasy vampire world-building with sassy protagonist'
      },
      {
        author: 'Laurell K. Hamilton',
        voiceSample: 'Power and blood and dark eroticism wound between them like a living thing, necromancy and vampirism dancing on the edge of corruption.',
        trait: 'Dark eroticism blending vampire power dynamics with necromancy'
      },
      {
        author: 'Richelle Mead',
        voiceSample: 'Dhampir guardian or forbidden vampire lover? The academy taught her to stake first and ask questions never. But he made her want to break every rule.',
        trait: 'Vampire academy vibes with forbidden romance and dhampir tension'
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
      },
      {
        author: 'Carrie Ann Ryan',
        voiceSample: 'The mating bond snapped into place like fate clicking its final lock, and suddenly "mine" wasn\'t just a word—it was a destiny.',
        trait: 'Fated mates with pack loyalty and emotional werewolf bonds'
      },
      {
        author: 'Shelly Laurenston',
        voiceSample: '"Did you just challenge me to an alpha battle in the middle of brunch? Honey, I haven\'t even had my coffee yet."',
        trait: 'Comedic werewolf chaos with irreverent alpha battles'
      },
      {
        author: 'Suzanne Wright',
        voiceSample: 'Possessive didn\'t begin to cover it. His wolf wanted to wrap around her, claim her, make sure every shifter within a hundred miles knew she was his.',
        trait: 'Possessive alpha wolves with pack mentality and steamy romance'
      },
      {
        author: 'Faith Hunter',
        voiceSample: 'The skinwalker magic crawled across her skin, werewolf and vampire scents mixing in the humid Southern night like a supernatural storm brewing.',
        trait: 'Southern Gothic werewolves with vampire-werewolf tension and skinwalker magic'
      },
      {
        author: 'Keri Arthur',
        voiceSample: 'Werewolf detective, vampire lover, and a murder case that smelled like death and dark magic. Just another night in the Riley Jenson universe.',
        trait: 'Werewolf detective noir with Riley Jenson vibes and hybrid powers'
      },
      {
        author: 'Rachel Vincent',
        voiceSample: 'Territory. Dominance. Pride. The werecat politics translated perfectly to werewolf pack law—fight for your place or lose everything.',
        trait: 'Werecats/shifter politics crossover with territorial dominance and family saga'
      },
      {
        author: 'Chloe Neill',
        voiceSample: '"Chicago werewolf packs play by different rules. Less howling at the moon, more political maneuvering with a side of violence."',
        trait: 'Chicago werewolf packs with urban fantasy setting and political intrigue'
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
      },
      {
        author: 'Karen Marie Moning',
        voiceSample: '"Welcome to Dublin, where the Unseelie princes play and humans are just pretty toys to break." She should run. She should definitely run.',
        trait: 'Fever series Fae with dark Unseelie princes and Dublin setting'
      },
      {
        author: 'Elise Kova',
        voiceSample: 'Air magic sang through her veins, elemental power awakening with each breath, the fairy prince watching like he knew exactly what she was becoming.',
        trait: 'Air Awakens fairy magic with elemental powers and fantasy romance'
      },
      {
        author: 'Jennifer Estep',
        voiceSample: '"Mythos Academy Rule #1: Never trust a fairy. Rule #2: Especially not one who offers to teach you assassination techniques."',
        trait: 'Mythos Academy fae with assassin protagonist and snarky tone'
      },
      {
        author: 'Cassandra Clare',
        voiceSample: 'Shadowhunter meets Seelie Court, and the lines between ally and enemy blur like glamour in moonlight—forbidden and intoxicating.',
        trait: 'Shadowhunter fae crossover with Seelie/Unseelie courts and forbidden romance'
      },
      {
        author: 'Sylvia Mercedes',
        voiceSample: 'Bride of the Shadow King—the bargain was simple: her life for her kingdom. What she didn\'t expect was wanting to stay in the darkness.',
        trait: 'Bride of the Shadow King vibes with dark fairy bargains and enemies-to-lovers'
      },
      {
        author: 'Roshani Chokshi',
        voiceSample: 'Indian mythology wove through the fairy realm like silk and starlight, lush magic painting the air in colors that had no earthly names.',
        trait: 'Indian mythology fae with lush descriptions and magical realism'
      },
      {
        author: 'Laura Thalassa',
        voiceSample: '"The Bargainer collects debts, siren. And you\'ve owed me for a very long time." His smile promised wicked payments and dangerous pleasures.',
        trait: 'Bargainer series vibes with siren fae, debts and deals'
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


    // Select 2 from matching creature
    const shuffledPrimary = this.fisherYatesShuffle(primaryStyles);
    const selectedPrimary = shuffledPrimary.slice(0, 2);

    // Select 1 from different creatures  
    const shuffledOther = this.fisherYatesShuffle(otherStyles);
    const selectedOther = shuffledOther.slice(0, 1);

    return [...selectedPrimary, ...selectedOther];
  }

  private getRandomBeatStructure(input: StoryGenerationSeam['input']): string {
    // EXPANDED: 20 beat structures with avoid warnings for quality control
    const structures = [
      {
        name: "TEMPTATION CASCADE",
        beats: "Forbidden Glimpse → Growing Obsession → Point of No Return → Consequences Unfold → Deeper Temptation",
        spiceIntegration: "Each beat escalates physical/emotional intimacy. Perfect for Level 3-5 stories.",
        avoid: "Repetitive seduction scenes with no emotional progression, instant capitulation without internal conflict"
      },
      {
        name: "POWER EXCHANGE",
        beats: "Challenge Issued → Resistance Tested → Control Shifts → Surrender Moment → New Dynamic",
        spiceIntegration: "Power dynamics drive intimacy. Works for all themes, spice level determines explicitness.",
        avoid: "Non-consensual power plays, one-sided dominance, no mutual respect underneath the dynamic"
      },
      {
        name: "SEDUCTION TRAP",
        beats: "Innocent Encounter → Hidden Agenda Revealed → Manipulation vs Genuine Feeling → Truth Exposed → Choice Made",
        spiceIntegration: "Seduction builds throughout. Mystery themes enhance psychological tension.",
        avoid: "Villain without nuance, manipulation without genuine feelings bleeding through, easy forgiveness"
      },
      {
        name: "RITUAL BINDING",
        beats: "Ancient Secret → Ritual Requirement → Intimate Ceremony → Magical Consequence → Eternal Bond",
        spiceIntegration: "Supernatural themes with ritual intimacy. Spice level affects ritual explicitness.",
        avoid: "Magic solves everything, no cost to the ritual, bond accepted instantly without conflict"
      },
      {
        name: "VULNERABILITY SPIRAL",
        beats: "Perfect Facade → Crack in Armor → Emotional Exposure → Intimate Healing → Transformed Identity",
        spiceIntegration: "Emotional vulnerability leads to physical intimacy. Romance themes amplify connection.",
        avoid: "Trauma magically healed by love, no lasting scars, instant emotional breakthroughs"
      },
      {
        name: "HUNT AND CLAIM",
        beats: "Predator Marks Prey → Chase Begins → Prey Fights Back → Tables Turn → Mutual Claiming",
        spiceIntegration: "Primal pursuit with escalating tension. Adventure themes add physical stakes.",
        avoid: "Prey with no agency or power, stalking romanticized without consequences, one-way claiming"
      },
      {
        name: "BARGAIN'S PRICE",
        beats: "Desperate Need → Deal Struck → Payment Due → Cost Revealed → Price Accepted",
        spiceIntegration: "Supernatural bargains with intimate payments. Dark themes heighten moral conflict.",
        avoid: "Loopholes that negate the price, convenient escapes, bargain forgotten after payment"
      },
      {
        name: "MEMORY FRACTURE",
        beats: "Lost Memory → Familiar Stranger → Fragments Return → Truth Reconstructed → Choice to Remember",
        spiceIntegration: "Past intimacy bleeding through amnesia. Mystery themes create psychological tension.",
        avoid: "Convenient amnesia, memories return all at once, no emotional fallout from truth"
      },
      {
        name: "TRANSFORMATION HUNGER",
        beats: "Change Begins → New Appetites → Mentor Appears → Appetite Satisfied → Evolution Complete",
        spiceIntegration: "Physical transformation creates new desires. Comedy themes can subvert expectations.",
        avoid: "Easy control of new form, mentor appears exactly when needed, no cost to transformation"
      },
      {
        name: "MIRROR SOULS",
        beats: "Perfect Opposite → Magnetic Pull → Resistance Breaks → Soul Recognition → Unity/Destruction",
        spiceIntegration: "Opposite personalities creating explosive chemistry. All themes supported, spice determines intensity.",
        avoid: "Opposites attract without friction, perfect compatibility solves conflict, no sacrifice required"
      },
      {
        name: "FORBIDDEN TERRITORY DANCE",
        beats: "Trespass → Discovery → Risk Escalation → Claimed Space",
        spiceIntegration: "Cross enemy lines, stolen moments in forbidden spaces. Spice level determines intimacy of encounters.",
        avoid: "Repetitive 'sneaking around' scenes, predictable guards, no real danger of discovery"
      },
      {
        name: "SACRIFICE NEGOTIATION",
        beats: "Demand → Counter-offer → Stakes Raise → Blood Price Paid",
        spiceIntegration: "What will you give up for what you desire? Supernatural costs escalate with spice level.",
        avoid: "Easy sacrifices, no real loss, immediate rewards, sacrifice undone later"
      },
      {
        name: "JEALOUSY IGNITION",
        beats: "Rival Appears → Tension Spikes → Possessive Display → Claim Solidified",
        spiceIntegration: "Third party interference, possessive claims, territorial marking. Perfect for pack/clan dynamics.",
        avoid: "Love triangle clichés, unnecessary drama, weak rival threats, toxic possessiveness"
      },
      {
        name: "TRUST SHATTERING REVEAL",
        beats: "Hint of Deception → Clues Accumulate → Revelation Hits → Rebuild Begins",
        spiceIntegration: "Secret exposed, betrayal discovered, foundation crumbles. Intimacy becomes weapon or healing.",
        avoid: "Convenient misunderstandings, easy forgiveness, no lasting consequences, immediate trust restoration"
      },
      {
        name: "PROTECTOR INSTINCT TRIGGER",
        beats: "Danger Looms → Instinct Overrides → Fierce Protection → Aftermath Intimacy",
        spiceIntegration: "Threat emerges, protective fury unleashed, vulnerable moment follows. Violence into tenderness.",
        avoid: "Damsel in distress tropes, victim with no agency, protector never vulnerable"
      },
      {
        name: "ANCIENT ENEMY RESURFACES",
        beats: "Warning Signs → Threat Materializes → Old Trauma Surfaces → Stand Together",
        spiceIntegration: "Old wounds reopened, past threatens present, united front. Shared danger forges bonds.",
        avoid: "Convenient villain timing, no backstory weight, easy defeat, enemy without real threat"
      },
      {
        name: "MATE BOND AWAKENING",
        beats: "Attraction Intensifies → Bond Manifests → Fight Connection → Surrender",
        spiceIntegration: "Supernatural connection snaps into place, resistance futile. Biology meets choice.",
        avoid: "Instant acceptance, no conflict about loss of choice, magic solves all relationship issues"
      },
      {
        name: "BLOOD OATH CONSEQUENCES",
        beats: "Oath Sworn → Consequences Revealed → Loophole Sought → Price Paid",
        spiceIntegration: "Words have power, vows bind, magic enforces promises. Spice level affects payment type.",
        avoid: "Convenient escapes, no real magical binding, oath forgotten, loophole negates consequences"
      },
      {
        name: "SANCTUARY INVASION",
        beats: "Haven Established → Warning Breach → Invasion → Defend or Flee",
        spiceIntegration: "Safe space violated, nowhere to hide, forced confrontation. Intimacy in crisis.",
        avoid: "Easy victory defending sanctuary, no lasting damage, rebuilt overnight"
      },
      {
        name: "ECLIPSE OF CONTROL",
        beats: "Control Frays → Transformation Begins → Beast Emerges → Aftermath Reckoning",
        spiceIntegration: "Monster takes over, humanity slips, beast claims dominance. Spice level affects beast's actions.",
        avoid: "No consequences from loss of control, easy regain of composure, victim unaffected or trauma ignored"
      }
    ];

    // Select random structure
    const selectedStructure = structures[Math.floor(Math.random() * structures.length)];
    
    return `SELECTED STRUCTURE: ${selectedStructure.name}
BEATS: ${selectedStructure.beats}
SPICE INTEGRATION: ${selectedStructure.spiceIntegration}
AVOID: ${selectedStructure.avoid}`;
  }

  private generateChekovElements(): string {
    // ENHANCED: 20 specific, actionable Chekhov's gun elements for serialized payoff
    const elements = [
      "Cursed relic with three uses, each more dangerous than the last",
      "Sealed chamber that opens only under blood moon, contains ancestral secrets",
      "Stranger knows protagonist's real name, disappears before questioned",
      "Prophecy has dual interpretation, one path leads to salvation, other to doom",
      "Contract has hidden clause activated by first kiss/blood/betrayal",
      "Debt collects in three parts: memory, power, then firstborn/soul",
      "Weakness is also their greatest strength under specific moon phase",
      "Enemy shares same bloodline, mirror image of protagonist's dark side",
      "Ritual bonds two souls, cannot be undone except by mutual death",
      "True identity revealed only when protagonist speaks their real name aloud",
      "Mirror that shows true desires, protagonist avoids looking until crisis forces confrontation",
      "Three drop blood vial, each drop grants one wish but extracts equivalent payment",
      "Tattoo that moves, shifts location based on danger proximity, bleeds when enemy near",
      "Song that compels truth, melody hummed innocently early, later breaks through lies/glamour",
      "Key without a lock, lock reveals itself at moment of greatest need",
      "Shadow with its own will, later revealed as tether to dark realm",
      "Clock that runs backwards, counts down to unknown event, speeds up with dangerous choices",
      "Flower that blooms at death, rare plant blooms only when someone nearby will die",
      "Name that cannot be spoken, saying it thrice summons ancient being",
      "Scar that burns, old wound aches in presence of specific person, reveals hidden connection"
    ];

    // Select 2 random elements for this story using Fisher-Yates shuffle
    const shuffled = this.fisherYatesShuffle(elements);
    const selected = shuffled.slice(0, 2);
    
    return `[Chekhov1]: ${selected[0]}
[Chekhov2]: ${selected[1]}
(These elements MUST be planted naturally in the story and will pay off in future chapters. They should feel organic, not forced.)`;
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

SERIALIZATION HOOKS - ENGINEERED ADDICTION:
End with ONE of these 8 cliffhanger types:
1. REVELATION CLIFFHANGER - Truth bomb drops in last sentence
   Example: "She turned, and he saw the bite marks. Old ones."
2. DANGER ESCALATION - Threat level jumps exponentially
   Example: "The howls weren't coming from outside. They were in the walls."
3. BETRAYAL CLIFFHANGER - Trusted ally revealed as enemy
   Example: "He smiled, fangs extended. 'Did you really think I loved you?'"
4. IMPOSSIBLE CHOICE - Must decide between two disasters
   Example: "Save him or save yourself. Choose. Now."
5. IDENTITY CRISIS - Everything they knew about themselves is wrong
   Example: "The prophecy didn't mean her enemy. It meant her."
6. LOST CONTROL - Character's power/beast takes over
   Example: "She felt her bones break and reform. The wolf was done waiting."
7. ARRIVAL CLIFFHANGER - Someone/something arrives to change everything
   Example: "The door exploded inward. Her maker had found her."
8. DEADLINE SLAM - Time runs out, consequences immediate
   Example: "The moon reached its peak. The curse was permanent now."

HOOK PLACEMENT:
- Mid-Point Twist: Subvert expectation, new complication emerges at ~50% mark
- Closing Hook: Use one of the 8 cliffhanger types above in final paragraph
- Emotional Hook: Leave character in vulnerable/intense emotional state

SERIALIZATION PROMISE:
- Answer 1 question and raise 2 new ones
- Foreshadow future conflict within current resolution
- Plant mystery elements for later chapters

AUDIO FORMAT (NON-NEGOTIABLE):
- [Character Name]: "dialogue" for ALL speech
- [Narrator]: for ALL descriptions/scene-setting  
- [Character, emotion]: "dialogue" for emotional context
- HTML: <h3> titles, <p> paragraphs, <em> emphasis

VOICE METADATA FOR AUDIO NARRATION (CRITICAL):
For EACH major character's FIRST appearance, include voice characteristics:
FORMAT: [CharacterName, voice: 4-word description]: "dialogue"

ENHANCED VOICE SYSTEM - ACCENT + EMOTION + TEXTURE:
You can now include ACCENT markers for richer character voices:

ACCENT OPTIONS (Choose fitting accents for characters):
• Celtic-lilt (Irish fairy energy)
• Edinburgh-burr (Scottish werewolf growl)
• Parisian-silk (French vampire seduction)
• Transylvanian-depth (Classic vampire authority)
• Louisiana-drawl (Southern Gothic vampire charm)
• Moscow-ice (Russian vampire coldness)
• Tokyo-precision (Japanese formality + supernatural edge)
• Cockney-rasp (London street werewolf)
• Outback-rough (Australian werewolf wildness)
• Icelandic-mystery (Nordic fae otherworldliness)
• Spanish-passion (Mediterranean vampire intensity)
• Welsh-melody (Celtic fairy musicality)
• Bavarian-strength (German werewolf power)
• Canadian-friendly-threat (Polite but dangerous)
• Bronx-attitude (New York vampire street smart)
• Texas-authority (Southern alpha werewolf command)
• Oxford-refinement (British academic vampire)
• Mumbai-musical (Indian fae lyrical quality)
• Seoul-modern (K-drama vampire sophistication)
• Jamaican-rhythm (Caribbean werewolf vitality)

EMOTION STATES (Per Scene):
Amused-dangerous, furious-controlled, tender-guarded, seductive-threatening, 
playful-deadly, vulnerable-fierce, mocking-affectionate, cold-passionate, wild-precise

VOICE CREATIVITY RULES:
✅ Use UNCONVENTIONAL, VIVID, SPECIFIC descriptors (velvet-smoke, starlight-tinkling, thunder-low)
✅ Mix unexpected combinations for uniqueness (whiskey-rough hypnotic, dewdrop-delicate mischievous)
✅ Use synesthetic descriptions - sounds like colors/textures (moonlight-pale, crimson-rich, frost-kiss)
✅ VARY vocabulary across characters - NO REPEATED WORDS!
✅ Optional: Include accent for extra flavor (Moscow-ice velvet-smoke, Celtic-lilt starlight-bright)
❌ NO generic words (nice, good, normal)
❌ NO repeating descriptors across characters
❌ NO only common adjectives

VOICE VOCABULARY CATEGORIES:
• TEXTURES: velvet, silk, gravel, smoke, honey, mercury, glass, steel, wine, cream, frost, ember
• EMOTIONS: haunting, intoxicating, devastating, mesmerizing, electrifying, soul-piercing
• SYNESTHETIC: moonlight-pale, twilight-dark, crimson-rich, midnight-blue, thunder-low, whisper-soft
• MUSICAL: staccato, crescendo, harmonious, dissonant, rhythmic, melodic
• MYSTICAL: ethereal, spectral, celestial, infernal, arcane, otherworldly
• MOVEMENT: cascading, rippling, pulsing, trembling, undulating, flowing
• PRECIOUS: diamond-cut, pearl-smooth, obsidian-dark, amber-warm, jade-cool, ruby-rich

CREATIVE EXAMPLES (vary for each character):
Vampire: "velvet-smoke whiskey-rough hypnotic" OR "Moscow-ice midnight-silk knife-sharp" OR "Parisian-silk intoxicating amused-dangerous"
Werewolf: "thunder-low earth-raw moonlit" OR "Edinburgh-burr gravel-deep fierce" OR "Texas-authority commanding wild-precise"
Fairy: "starlight-tinkling dewdrop-delicate mischievous" OR "Celtic-lilt windchime-bright playful" OR "Icelandic-mystery ethereal cold-passionate"
Human: "autumn-rich coffee-warm hopeful" OR "Bronx-attitude steel-core resilient" OR "Louisiana-drawl honey-smooth tender-guarded"

VOICE VARIETY ENFORCEMENT:
- 3-5 major characters per story
- EACH gets COMPLETELY DIFFERENT descriptors
- NO WORD appears twice across all character voices
- Mix 2+ categories per character (texture + emotion, musical + mystical)
- Prioritize SURPRISING combinations over expected ones

EXAMPLE STORY START:
<p>[Lord Damien, voice: velvet-smoke whiskey-rough hypnotic]: "Welcome to my domain."</p>
<p>[Princess Elena, voice: autumn-rich steel-core fierce-gentle]: "I'm not afraid of you."</p>
<p>[Alpha Marcus, voice: thunder-low earth-raw moonlit]: "Both of you. Explain. Now."</p>

NOTE: After first appearance, use simple [CharacterName]: format for subsequent dialogue.

Your goal: Create episodes that make listeners desperate for "Continue Chapter."`;
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
${input.userInput ? `CREATIVE DIRECTION: ${this.sanitizeUserInput(input.userInput)}` : ''}

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
- [Character Name, voice: 4-word description]: "dialogue" for FIRST appearance of each major character
- [Character Name]: "dialogue" for ALL subsequent speech (no exceptions)
- [Narrator]: for ALL scene descriptions and non-dialogue text
- [Character, emotion]: "dialogue" when emotional context is crucial
- HTML structure: <h3> for title, <p> for paragraphs, <em> for emphasis

VOICE METADATA REMINDER:
First appearance: [Lord Damien, voice: velvet-smoke whiskey-rough hypnotic]: "dialogue"
Subsequent: [Lord Damien]: "dialogue"

USE CREATIVE, UNCONVENTIONAL VOICE DESCRIPTORS - NO REPEATED WORDS ACROSS CHARACTERS!

Create a complete story that feels like it could continue but is satisfying on its own. Make every word count toward character development, world-building, or advancing romantic/sexual tension.

Plant your Chekhov elements naturally and ensure the moral dilemma occurs at midpoint. End with a cliffhanger that creates genuine desire for continuation.`;
  }

  private buildContinuationPrompt(input: ChapterContinuationSeam['input']): string {
    // Extract intelligent context from previous chapters
    const characterNames = this.extractCharacterNames(input.existingContent);
    const lastChapterSummary = this.extractLastChapterSummary(input.existingContent);
    const activePlotThreads = this.extractPlotThreads(input.existingContent);
    const emotionalTone = this.analyzeEmotionalTone(input.existingContent);
    
    return `Continue this story as Chapter ${input.currentChapterCount + 1}.

CONTEXT FROM PREVIOUS CHAPTERS:
- Established Characters: ${characterNames.join(', ') || 'Continue developing existing characters'}
- Last Chapter Summary: ${lastChapterSummary}
- Active Plot Threads: ${activePlotThreads.join(', ') || 'Develop new complications'}
- Emotional Tone: ${emotionalTone}

CONTINUATION REQUIREMENTS:
1. Resolve or escalate the previous cliffhanger within first 100 words
2. Advance at least one relationship dynamic or plot thread
3. Introduce one new complication, revelation, or twist
4. Maintain character voices and established dynamics
5. Build tension toward a new cliffhanger for next chapter
6. Use same audio format: [Character Name]: "dialogue" and [Narrator]: descriptions

${input.userInput ? `CREATIVE DIRECTION: ${this.sanitizeUserInput(input.userInput)}` : ''}

PREVIOUS CHAPTER(S) FOR CONTINUITY:
${this.stripHtml(input.existingContent).slice(-1500)} // Last ~300 words for immediate context

Write 400-600 words for this chapter. Use HTML: <h3> for chapter title, <p> for paragraphs, <em> for emphasis.`;
  }

  /**
   * Extract character names from story content
   */
  private extractCharacterNames(content: string): string[] {
    const speakerMatches = content.match(/\[([^\],]+)(?:,\s*[^\]]+)?\]:/g) || [];
    const names = speakerMatches
      .map(match => match.replace(/\[([^\],]+).*/, '$1').trim())
      .filter(name => name !== 'Narrator');
    
    // Deduplicate and return
    return [...new Set(names)];
  }

  /**
   * Extract summary of last chapter/section
   */
  private extractLastChapterSummary(content: string): string {
    const stripped = this.stripHtml(content);
    const paragraphs = stripped.split('\n\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) return 'Story beginning';
    
    // Get last 2-3 paragraphs as summary
    const lastParagraphs = paragraphs.slice(-3).join(' ');
    
    // Truncate to ~150 words
    const words = lastParagraphs.split(/\s+/);
    const summary = words.slice(0, 150).join(' ');
    
    return summary.length < lastParagraphs.length ? summary + '...' : summary;
  }

  /**
   * Extract active plot threads and unresolved elements
   */
  private extractPlotThreads(content: string): string[] {
    const threads: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Check for common plot thread indicators
    if (lowerContent.includes('secret') || lowerContent.includes('mystery')) {
      threads.push('Unresolved mystery or secret');
    }
    if (lowerContent.includes('danger') || lowerContent.includes('threat')) {
      threads.push('Active threat or danger');
    }
    if (lowerContent.includes('forbidden') || lowerContent.includes('impossible')) {
      threads.push('Forbidden relationship tension');
    }
    if (lowerContent.includes('power') || lowerContent.includes('control')) {
      threads.push('Power dynamics in play');
    }
    if (lowerContent.match(/\bwhat\s+(if|would|could)\b/)) {
      threads.push('Unresolved questions');
    }
    
    return threads.length > 0 ? threads : ['Character development', 'Relationship progression'];
  }

  /**
   * Analyze emotional tone of existing content
   */
  private analyzeEmotionalTone(content: string): string {
    const lowerContent = content.toLowerCase();
    const tones: string[] = [];
    
    // Emotional indicators
    if (lowerContent.match(/\b(desire|passion|want|need|crave)\b/)) tones.push('passionate');
    if (lowerContent.match(/\b(dark|shadow|danger|fear|threat)\b/)) tones.push('dark/suspenseful');
    if (lowerContent.match(/\b(tease|playful|smile|grin|laugh)\b/)) tones.push('playful');
    if (lowerContent.match(/\b(pain|ache|hurt|wound|scar)\b/)) tones.push('angsty');
    if (lowerContent.match(/\b(power|control|dominan|command)\b/)) tones.push('intense');
    
    return tones.length > 0 ? tones.join(', ') : 'romantic with building tension';
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

  /**
   * Sanitize user input to prevent prompt injection attacks
   * Uses a whitelist approach and validates semantic sense of input.
   * Implements basic rate limiting for repeated failed attempts.
   */
  private sanitizeUserInput(input: string, userId?: string): string {
    if (!input) return '';

    // Whitelist: allow only letters, numbers, basic punctuation, and spaces
    const whitelistPattern = /[^a-zA-Z0-9 .,!?'"()-]/g;
    let sanitized = input.replace(whitelistPattern, '');

    // Ensure length limit (defense in depth)
    sanitized = sanitized.slice(0, VALIDATION_RULES.userInput.maxLength);
    sanitized = sanitized.trim();

    // Semantic validation: must not be empty or just punctuation/whitespace
    if (!sanitized || !/[a-zA-Z0-9]/.test(sanitized)) {
      this.registerFailedSanitizationAttempt(userId);
      return '';
    }

    return sanitized;
  }

  // Basic in-memory rate limiting for failed sanitization attempts
  private static failedSanitizationAttempts: Map<string, { count: number, lastAttempt: number }> = new Map();

  private registerFailedSanitizationAttempt(userId?: string) {
    if (!userId) return;
    const now = Date.now();
    const entry = StoryService.failedSanitizationAttempts.get(userId) || { count: 0, lastAttempt: 0 };
    if (now - entry.lastAttempt > 10 * 60 * 1000) { // reset after 10 minutes
      entry.count = 1;
    } else {
      entry.count += 1;
    }
    entry.lastAttempt = now;
    StoryService.failedSanitizationAttempts.set(userId, entry);
    // If too many failed attempts, could throw or block further input
    if (entry.count > 5) {
      throw new Error('Too many failed input attempts. Please try again later.');
    }
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
    let displayContent: string = content;

    // Remove speaker tags manually without regex
    const rawLines = content.split('\n');
    const cleanedLines: string[] = [];
    
    for (const line of rawLines) {
      // Remove [Speaker]: pattern
      let cleaned = line;
      const bracketIndex = cleaned.indexOf('[');
      if (bracketIndex !== -1) {
        const closeBracketIndex = cleaned.indexOf(']:', bracketIndex);
        if (closeBracketIndex !== -1) {
          cleaned = cleaned.substring(0, bracketIndex) + cleaned.substring(closeBracketIndex + 2);
        }
      }
      cleanedLines.push(cleaned.trim());
    }
    
    displayContent = cleanedLines.join('\n').trim();
    
    // Normalize multiple newlines
    while (displayContent.includes('\n\n\n')) {
      displayContent = displayContent.replace('\n\n\n', '\n\n');
    }
    
    const paragraphs: string[] = [];
    let currentParagraph: string = '';
    const lines: string[] = displayContent.split('\n').filter((l: string) => l.trim());

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
   * Fisher-Yates shuffle algorithm for uniform random distribution
   */
  private fisherYatesShuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}