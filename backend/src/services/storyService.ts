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
  private grokApiKey = process.env.XAI_AI_KEY;

  constructor() {
    if (!this.grokApiKey) {
      console.warn('⚠️  XAI_AI_KEY not found in environment variables');
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
      const storyContent = await this.callGrokAI(input);

      // Create response
      const output: StoryGenerationSeam['output'] = {
        storyId: this.generateStoryId(),
        title: this.generateTitle(input),
        content: storyContent,
        creature: input.creature,
        themes: input.themes,
        spicyLevel: input.spicyLevel,
        actualWordCount: this.countWords(storyContent),
        estimatedReadTime: Math.ceil(this.countWords(storyContent) / 200),
        hasCliffhanger: this.detectCliffhanger(storyContent),
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

    const prompt = this.buildStoryPrompt(input);

    try {
      const response = await axios.post(this.grokApiUrl, {
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a master storyteller specializing in spicy, romantic fantasy tales. Create engaging, well-structured stories with vivid descriptions and emotional depth.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: input.wordCount * 2, // Allow some buffer
        temperature: 0.8
      }, {
        headers: {
          'Authorization': `Bearer ${this.grokApiKey}`,
          'Content-Type': 'application/json'
        }
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
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'Continue this story in the same style and tone. Maintain character development and plot progression.'
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
        }
      });

      return this.formatChapterContent(response.data.choices[0].message.content);

    } catch (error: any) {
      console.error('Grok API error:', error.response?.data || error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  private buildStoryPrompt(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const themesText = input.themes.join(', ');
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);

    return `Write a ${input.wordCount}-word spicy romantic fantasy story featuring a ${creatureName} as the main character.

Key Requirements:
- Creature: ${creatureName}
- Themes: ${themesText}
- Spice Level: ${spicyLabel} (${input.spicyLevel}/5)
- Custom Ideas: ${input.userInput || 'None provided'}

Story Structure:
1. Introduction with atmospheric setting
2. Character introduction and initial attraction
3. Building tension and romantic development
4. Spicy intimate scenes with emotional depth
5. Climax with supernatural elements
6. Ending that could lead to continuation

Style Guidelines:
- Vivid, sensual descriptions
- Emotional depth and character development
- Victorian/Edwardian atmosphere
- Blend romance with supernatural elements
- Natural dialogue and internal monologue

Format the story with HTML tags for structure (h3 for chapter titles, p for paragraphs).`;
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

<p><em>This is a mock story generated without AI. Add XAI_AI_KEY to use real AI generation.</em></p>`;
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
    // Simple theme extraction - in real implementation, this would be more sophisticated
    return ['romance', 'dark'];
  }

  private extractSpicyLevelFromContent(content: string): SpicyLevel {
    // Simple spicy level extraction - in real implementation, this would analyze content
    // For now, return a default value that matches the SpicyLevel type
    return 4 as SpicyLevel;
  }

  private formatStoryContent(content: string): string {
    // Add basic HTML formatting if not already present
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      return `<h3>Generated Story</h3>\n\n<p>${content.replace(/\n\n/g, '</p>\n\n<p>')}</p>`;
    }
    return content;
  }

  private formatChapterContent(content: string): string {
    // Add basic HTML formatting if not already present
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      return `<p>${content.replace(/\n\n/g, '</p>\n\n<p>')}</p>`;
    }
    return content;
  }

  private stripHtml(content: string): string {
    return content.replace(/<[^>]*>/g, '');
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