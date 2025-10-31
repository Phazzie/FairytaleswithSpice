// Created: 2025-10-31 06:42
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EvaluationCriteria {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overallFeedback: string;
}

export interface EvaluationRequest {
  storyContent: string;
  configuration: {
    creature: string;
    themes: string[];
    spicyLevel: number;
    wordCount: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PromptEvaluationService {
  private grokApiUrl = 'https://api.x.ai/v1/chat/completions';
  private apiKey = '';

  constructor(private http: HttpClient) {
    // Check for API key in environment or localStorage
    this.apiKey = this.getApiKey();
  }

  private getApiKey(): string {
    // Try to get from localStorage first (for development/testing)
    const stored = localStorage.getItem('xai_api_key');
    if (stored) return stored;
    
    // In production, this would come from environment
    return '';
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('xai_api_key', key);
  }

  async evaluateStory(request: EvaluationRequest): Promise<EvaluationCriteria> {
    if (!this.apiKey) {
      // Return mock evaluation if no API key
      return this.getMockEvaluation();
    }

    const evaluationPrompt = this.buildEvaluationPrompt(request);

    try {
      const response = await fetch(this.grokApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-4-fast-reasoning',
          messages: [
            {
              role: 'system',
              content: `You are an expert evaluator of spicy supernatural romance stories. 
Provide constructive, specific feedback focusing on:
- Story structure and pacing
- Character development and chemistry
- Sensory detail and immersion
- Dialogue quality and voice distinction
- Cliffhanger effectiveness
- Adherence to spice level
- Audio-first writing quality

Format your response as valid JSON with this structure:
{
  "score": <number 0-100>,
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...],
  "overallFeedback": "<2-3 sentences>"
}`
            },
            {
              role: 'user',
              content: evaluationPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in API response');
      }

      // Parse the JSON response
      const evaluation = JSON.parse(content);
      return this.validateEvaluation(evaluation);

    } catch (error) {
      console.error('Error evaluating story:', error);
      // Fallback to mock evaluation on error
      return this.getMockEvaluation();
    }
  }

  private buildEvaluationPrompt(request: EvaluationRequest): string {
    return `Evaluate this spicy supernatural romance story:

STORY CONTENT:
${request.storyContent}

CONFIGURATION:
- Creature: ${request.configuration.creature}
- Themes: ${request.configuration.themes.join(', ')}
- Spice Level: ${request.configuration.spicyLevel}/5
- Target Word Count: ${request.configuration.wordCount}

Provide a detailed evaluation covering:
1. Overall quality score (0-100)
2. Top 3-5 strengths
3. Top 3-5 weaknesses or areas for improvement
4. 3-5 specific, actionable suggestions
5. Brief overall feedback (2-3 sentences)

Be specific and reference actual elements from the story. Focus on craft, not just content.`;
  }

  private validateEvaluation(evaluation: any): EvaluationCriteria {
    // Ensure the evaluation has all required fields
    return {
      score: typeof evaluation.score === 'number' ? evaluation.score : 75,
      strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
      weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : [],
      suggestions: Array.isArray(evaluation.suggestions) ? evaluation.suggestions : [],
      overallFeedback: typeof evaluation.overallFeedback === 'string' 
        ? evaluation.overallFeedback 
        : 'Evaluation completed.'
    };
  }

  private getMockEvaluation(): EvaluationCriteria {
    return {
      score: 75,
      strengths: [
        'Strong opening hook that captures attention',
        'Good sensory details throughout',
        'Effective pacing with appropriate tension building'
      ],
      weaknesses: [
        'Some dialogue feels generic or repetitive',
        'Voice descriptors could be more unique and varied',
        'Cliffhanger could be more impactful'
      ],
      suggestions: [
        'Use more unconventional voice descriptors (e.g., "velvet-smoke" instead of "deep")',
        'Vary dialogue patterns between characters for distinct voices',
        'Strengthen the final scene to increase stakes and reader investment'
      ],
      overallFeedback: 'Solid story with good fundamentals. The pacing works well and sensory details are effective. Main area for improvement is making character voices more distinct and memorable.'
    };
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }
}
