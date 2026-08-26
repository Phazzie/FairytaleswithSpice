// Created: 2025-10-31 06:42
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiResponse, EvaluationCriteria, EvaluationRequest } from '../contracts';

@Injectable({
  providedIn: 'root'
})
export class PromptEvaluationService {
  private readonly http = inject(HttpClient);

  async evaluateStory(request: EvaluationRequest): Promise<EvaluationCriteria> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<EvaluationCriteria>>('/api/story-lab/evaluate', request)
      );

      if (response.success && response.data) {
        return response.data;
      }

      return this.getMockEvaluation(readEvaluationRefusal(response));
    } catch (error) {
      console.warn('Server-side evaluation unavailable; using local mock evaluation.', error);
      return this.getMockEvaluation(readEvaluationRefusal((error as { error?: unknown } | null)?.error));
    }
  }

  /**
   * @param reason What the route said about why it would not evaluate, when it
   * said anything. Carried onto the placeholder so the page can print it: see
   * `EvaluationCriteria.mockEvaluationReason`.
   */
  private getMockEvaluation(reason?: string): EvaluationCriteria {
    return {
      ...(reason ? { mockEvaluationReason: reason } : {}),
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
      overallFeedback: 'Solid story with good fundamentals. The pacing works well and sensory details are effective. Main area for improvement is making character voices more distinct and memorable.',
      isMockEvaluation: true
    };
  }
}

/**
 * The message `/api/story-lab/evaluate` sent about a refusal, when it sent one.
 *
 * The fallback below it is honest — the page marks the placeholder and offers a
 * retry — but it was reached for every unsuccessful call alike, and the reasons
 * are not alike. That route refuses a `storyContent` past
 * `STORY_EVALUATION_LIMITS.maxStoryContentLength` with `400
 * INVALID_EVALUATION_REQUEST` naming the field, a caller with no API key with
 * `401`, and a caller past its budget with `429` and a `Retry-After`. Each of
 * those is something the reader can act on, and each was reported by
 * `proving-grounds.html` as "the evaluation API was unavailable" — the one thing
 * none of them is. The API answered; it said no, and said why.
 *
 * The `502 EVALUATION_FAILED` case really is an outage, and it carries its own
 * sentence ("Grok evaluation is temporarily unavailable."), so printing what the
 * route said covers that one too without a second branch.
 *
 * Reads the envelope out of either shape it arrives in: the parsed body of a
 * `success: false` answer, or `HttpErrorResponse.error` for a non-2xx one.
 * That is the same reading `ProvingGroundsComponent.readApiErrorMessage` gives
 * a failed generation, and `AppComponent.formatApiError` gives every other
 * refusal in this app.
 */
function readEvaluationRefusal(body: unknown): string | undefined {
  const envelope = (body as { error?: { message?: unknown } } | null | undefined)?.error;
  const message = envelope?.message;

  return typeof message === 'string' && message.trim().length > 0 ? message.trim() : undefined;
}
