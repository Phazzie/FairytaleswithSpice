// Created: 2025-10-31 06:42
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiResponse, EvaluationCriteria, EvaluationRequest } from '../contracts';
import { buildStoryQualityHeuristicReport, StoryQualityDimensionScore } from '../../../../shared/storyQualityHeuristics';

const FALLBACK_DIMENSION_COUNT = 3;

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

      return this.getMockEvaluation(request, readEvaluationRefusal(response));
    } catch (error) {
      console.warn('Server-side evaluation unavailable; using local mock evaluation.', error);
      return this.getMockEvaluation(request, readEvaluationRefusal((error as { error?: unknown } | null)?.error));
    }
  }

  /**
   * The evaluation this service can honestly offer when `/api/story-lab/evaluate`
   * did not answer with a real one.
   *
   * This used to be five constants — the same score, the same three strengths,
   * the same three weaknesses, the same three suggestions, the same feedback
   * sentence, for every story, every time. Proving Grounds exists to A/B compare
   * two prompt variants by their evaluation, and the two most likely reasons
   * this fallback fires — the endpoint's own rate limit, tripped by exactly the
   * back-to-back evaluations an A/B session runs, and a missing `XAI_API_KEY` on
   * a preview deployment — are not rare. A reader hitting either saw two
   * variants score identically and read the tie as a result.
   *
   * `buildStoryQualityHeuristicReport` is the deterministic per-story scan the
   * server already attaches to every response, real or mocked, as
   * `heuristicReport` — moved to `shared/` so this client-side fallback can run
   * the exact same scan against the exact same story, rather than reaching for
   * static prose because the real scan lived in a Node-only tree. `score`,
   * `strengths`, and `weaknesses` are now read from it, so two different
   * variants produce two different placeholders instead of one indistinguishable
   * one.
   *
   * @param reason What the route said about why it would not evaluate, when it
   * said anything. Carried onto the placeholder so the page can print it: see
   * `EvaluationCriteria.mockEvaluationReason`.
   */
  private getMockEvaluation(request: EvaluationRequest, reason?: string): EvaluationCriteria {
    const heuristicReport = buildStoryQualityHeuristicReport(request);
    const rankedDimensions = [...heuristicReport.dimensions].sort((left, right) => right.score - left.score);
    const strongestDimensions = rankedDimensions.slice(0, FALLBACK_DIMENSION_COUNT);
    const weakestDimensions = rankedDimensions.slice(-FALLBACK_DIMENSION_COUNT).reverse();

    return {
      ...(reason ? { mockEvaluationReason: reason } : {}),
      score: heuristicReport.overallScore,
      strengths: strongestDimensions.map(describeDimension),
      weaknesses: weakestDimensions.map(describeDimension),
      suggestions: weakestDimensions.map(suggestImprovement),
      overallFeedback: `No AI evaluation is available right now, so this reflects only the deterministic heuristic scan: ${heuristicReport.summary}`,
      heuristicReport,
      isMockEvaluation: true
    };
  }
}

function describeDimension(dimension: StoryQualityDimensionScore): string {
  return `${dimension.label} (${dimension.score}/100): ${dimension.rationale}`;
}

function suggestImprovement(dimension: StoryQualityDimensionScore): string {
  return `Strengthen ${dimension.label.toLowerCase()} — ${dimension.rationale}`;
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
