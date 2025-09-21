import { StoryGenerationSeam, ChapterContinuationSeam } from '@fairytales-with-spice/contracts';
import { AIService } from './AIService';
import { HttpClient } from '../../lib/http/HttpClient';

export class GrokAIService implements AIService {
  private grokApiUrl = 'https://api.x.ai/v1/chat/completions';
  private grokApiKey: string;
  private httpClient: HttpClient;

  constructor(apiKey: string | undefined, httpClient: HttpClient) {
    if (!apiKey) {
      throw new Error('Grok AI API key is required.');
    }
    this.grokApiKey = apiKey;
    this.httpClient = httpClient;
  }

  async generateStoryContent(input: StoryGenerationSeam['input']): Promise<string> {
    const prompt = this.buildStoryPrompt(input);

    try {
      const response = await this.httpClient.post<any>(this.grokApiUrl, {
        model: 'grok-4-0709',
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

      return this.formatStoryContent(response.choices[0].message.content);

    } catch (error: any) {
      console.error('Grok API error:', error.response?.data || error.message);
      throw new Error('AI service temporarily unavailable');
    }
  }

  async generateChapterContent(input: ChapterContinuationSeam['input']): Promise<string> {
    const prompt = this.buildContinuationPrompt(input);

    try {
      const response = await this.httpClient.post<any>(this.grokApiUrl, {
        model: 'grok-4-0709',
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

      return this.formatChapterContent(response.choices[0].message.content);

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

  private formatStoryContent(content: string): string {
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      return `<h3>Generated Story</h3>\n\n<p>${content.replace(/\n\n/g, '</p>\n\n<p>')}</p>`;
    }
    return content;
  }

  private formatChapterContent(content: string): string {
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      return `<p>${content.replace(/\n\n/g, '</p>\n\n<p>')}</p>`;
    }
    return content;
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

  private stripHtml(content: string): string {
    return content.replace(/<[^>]*>/g, '');
  }
}
