import axios from 'axios';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse,
  VALIDATION_RULES,
  SpicyLevel
} from '../types/contracts';

/**
 * Service class for handling story generation and continuation.
 * This class encapsulates all the logic for interacting with the AI model,
 * validating input, and formatting the output.
 */
export class StoryService {
  private grokApiUrl = 'https://api.x.ai/v1/chat/completions';
  private grokApiKey = process.env.XAI_AI_KEY;

  constructor() {
    // Warn the developer if the API key is missing, as the service will run in mock mode.
    if (!this.grokApiKey) {
      console.warn('⚠️  XAI_AI_KEY not found in environment variables. StoryService will run in mock mode.');
    }
  }

  /**
   * Generates a new story based on the provided input.
   * This method conforms to the StoryGenerationSeam contract.
   * @param input - The input object containing the story parameters.
   * @returns A promise that resolves to an ApiResponse containing the generated story.
   */
  async generateStory(input: StoryGenerationSeam['input']): Promise<ApiResponse<StoryGenerationSeam['output']>> {
    const startTime = Date.now();

    try {
      // 1. Validate the user's input against the defined rules.
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

      // 2. Generate the story content by calling the AI model (or a mock).
      const storyContent = await this.callGrokAI(input);

      // 3. Assemble the final output object, conforming to the seam contract.
      const output: StoryGenerationSeam['output'] = {
        storyId: this.generateStoryId(),
        title: this.generateTitle(input),
        content: storyContent,
        creature: input.creature,
        themes: input.themes,
        spicyLevel: input.spicyLevel,
        actualWordCount: this.countWords(storyContent),
        estimatedReadTime: Math.ceil(this.countWords(storyContent) / 200), // Avg reading speed
        hasCliffhanger: this.detectCliffhanger(storyContent),
        generatedAt: new Date()
      };

      // 4. Return a successful response.
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
      // Return a standardized error response in case of failure.
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

  /**
   * Continues an existing story with a new chapter.
   * This method conforms to the ChapterContinuationSeam contract.
   * @param input - The input object containing the existing story and continuation parameters.
   * @returns A promise that resolves to an ApiResponse containing the new chapter.
   */
  async continueStory(input: ChapterContinuationSeam['input']): Promise<ApiResponse<ChapterContinuationSeam['output']>> {
    const startTime = Date.now();

    try {
      // 1. Generate the new chapter content.
      const chapterContent = await this.callGrokAIForContinuation(input);

      // 2. Assemble the final output object.
      const output: ChapterContinuationSeam['output'] = {
        chapterId: this.generateChapterId(),
        chapterNumber: input.currentChapterCount + 1,
        title: `Chapter ${input.currentChapterCount + 1}: ${this.generateChapterTitle(input)}`,
        content: chapterContent,
        wordCount: this.countWords(chapterContent),
        cliffhangerEnding: this.detectCliffhanger(chapterContent),
        themesContinued: this.extractThemesFromContent(input.existingContent),
        spicyLevelMaintained: this.extractSpicyLevelFromContent(input.existingContent),
        appendedToStory: `${input.existingContent}\n\n<hr>\n\n${chapterContent}`
      };

      // 3. Return a successful response.
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
      // Return a standardized error response.
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
   * Calls the Grok AI service to generate a story.
   * If no API key is present, it falls back to a mock story.
   * @param input - The story generation parameters.
   * @returns A promise that resolves to the generated story content as an HTML string.
   */
  private async callGrokAI(input: StoryGenerationSeam['input']): Promise<string> {
    if (!this.grokApiKey) {
      return this.generateMockStory(input);
    }

    const prompt = this.buildStoryPrompt(input);

    try {
      const response = await axios.post(this.grokApiUrl, {
        model: 'grok-4-0709',
        messages: [
          { role: 'system', content: 'You are a master storyteller specializing in spicy, romantic fantasy tales. Create engaging, well-structured stories with vivid descriptions and emotional depth.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: input.wordCount * 2, // Allow a buffer for longer stories
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

  /**
   * Calls the Grok AI service to continue a story.
   * Falls back to a mock chapter if no API key is available.
   * @param input - The chapter continuation parameters.
   * @returns A promise that resolves to the new chapter content as an HTML string.
   */
  private async callGrokAIForContinuation(input: ChapterContinuationSeam['input']): Promise<string> {
    if (!this.grokApiKey) {
      return this.generateMockChapter(input);
    }

    const prompt = this.buildContinuationPrompt(input);

    try {
      const response = await axios.post(this.grokApiUrl, {
        model: 'grok-4-0709',
        messages: [
          { role: 'system', content: 'Continue this story in the same style and tone. Maintain character development and plot progression.' },
          { role: 'user', content: prompt }
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

  /**
   * Builds the prompt for generating a new story.
   * @param input - The story generation parameters.
   * @returns The complete prompt string.
   */
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

  /**
   * Builds the prompt for continuing an existing story.
   * @param input - The chapter continuation parameters.
   * @returns The complete prompt string for continuation.
   */
  private buildContinuationPrompt(input: ChapterContinuationSeam['input']): string {
    return `Continue this story with a new chapter. Maintain the same tone, character development, and spicy level.

Existing Story:
${this.stripHtml(input.existingContent)}

Additional Instructions: ${input.userInput || 'Continue naturally'}

Write approximately 400-600 words for this chapter. Format with HTML tags.`;
  }

  /**
   * Validates the input for story generation.
   * @param input - The story generation parameters.
   * @returns An error object if validation fails, otherwise null.
   */
  private validateStoryInput(input: StoryGenerationSeam['input']): any {
    if (!input.creature || !['vampire', 'werewolf', 'fairy'].includes(input.creature)) {
      return { code: 'INVALID_INPUT', message: 'Invalid creature type', field: 'creature', providedValue: input.creature, expectedType: 'CreatureType' };
    }

    if (input.themes.length > VALIDATION_RULES.themes.maxCount) {
      return { code: 'INVALID_INPUT', message: `Too many themes (max ${VALIDATION_RULES.themes.maxCount})`, field: 'themes', providedValue: input.themes, expectedType: 'ThemeType[]' };
    }

    if (input.userInput && input.userInput.length > VALIDATION_RULES.userInput.maxLength) {
      return { code: 'INVALID_INPUT', message: `User input too long (max ${VALIDATION_RULES.userInput.maxLength} characters)`, field: 'userInput', providedValue: input.userInput, expectedType: 'string' };
    }

    return null;
  }

  /**
   * Generates a mock story for development when no API key is available.
   * @param input - The story generation parameters.
   * @returns A mock story as an HTML string.
   */
  private generateMockStory(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);

    return `<h3>The ${creatureName}'s Forbidden Passion (Mock)</h3>
<p>This is a mock story generated for development purposes. The requested creature was a ${creatureName.toLowerCase()} and the spice level was "${spicyLabel}".</p>
<p>In the shadowed alleys of Victorian London, Lady Arabella Worthington found herself drawn to the mysterious stranger who haunted her dreams. His eyes, crimson as fresh-spilled wine, held secrets that both terrified and exhilarated her.</p>
<p><em>To see a real AI-generated story, please add your XAI_AI_KEY to the .env file.</em></p>`;
  }

  /**
   * Generates a mock chapter for development.
   * @param input - The chapter continuation parameters.
   * @returns A mock chapter as an HTML string.
   */
  private generateMockChapter(input: ChapterContinuationSeam['input']): string {
    return `<h3>Chapter ${input.currentChapterCount + 1}: The Deeper Shadows (Mock)</h3>
<p>This is a mock chapter. The story continues with even more intrigue and passion, as the shadows of the past begin to lengthen.</p>
<p>Arabella soon discovered that her mysterious lover was not the only one with secrets. A new danger emerges, threatening to tear them apart forever.</p>`;
  }

  // --- Utility Methods ---

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
    return `The ${this.getCreatureDisplayName(input.creature)}'s Forbidden Passion`;
  }

  private generateChapterTitle(input: ChapterContinuationSeam['input']): string {
    return 'The Deeper Shadows';
  }

  private countWords(content: string): number {
    return content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;
  }

  private detectCliffhanger(content: string): boolean {
    const cliffhangerWords = ['suddenly', 'but then', 'just as', 'what happened next', 'to be continued'];
    const lowerContent = content.toLowerCase();
    return cliffhangerWords.some(word => lowerContent.includes(word));
  }

  private extractThemesFromContent(content: string): any[] {
    // In a real implementation, this would use NLP to extract themes.
    return ['romance', 'dark'];
  }

  private extractSpicyLevelFromContent(content: string): SpicyLevel {
    // In a real implementation, this would use content analysis.
    return 4 as SpicyLevel;
  }

  private formatStoryContent(content: string): string {
    if (!content.includes('<p>')) {
      return `<p>${content.replace(/\n\n/g, '</p><p>')}</p>`;
    }
    return content;
  }

  private formatChapterContent(content: string): string {
    return this.formatStoryContent(content);
  }

  private stripHtml(content: string): string {
    return content.replace(/<[^>]*>/g, '');
  }

  private generateStoryId(): string {
    return `story_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateChapterId(): string {
    return `chapter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}