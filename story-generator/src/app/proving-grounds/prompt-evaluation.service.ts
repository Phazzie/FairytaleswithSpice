// Created: 2025-10-31 06:42
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiEnvelope } from '../contracts';

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
  private readonly http = inject(HttpClient);

  async evaluateStory(request: EvaluationRequest): Promise<EvaluationCriteria> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiEnvelope<EvaluationCriteria>>('/api/story-lab/evaluate', request)
      );

      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.warn('Server-side evaluation unavailable; using local mock evaluation.', error);
    }

    return this.getMockEvaluation();
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
        'Use more unconventional voice descriptors such as texture plus mood combinations',
        'Vary dialogue patterns between characters for distinct voices',
        'Strengthen the final scene to increase stakes and reader investment'
      ],
      overallFeedback: 'Solid story with good fundamentals. The pacing works well and sensory details are effective. Main area for improvement is making character voices more distinct and memorable.'
    };
  }
}
