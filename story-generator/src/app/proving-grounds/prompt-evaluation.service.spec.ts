import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EvaluationCriteria, EvaluationRequest } from '../contracts';
import { PromptEvaluationService } from './prompt-evaluation.service';

describe('PromptEvaluationService', () => {
  let service: PromptEvaluationService;
  let httpMock: HttpTestingController;

  const request: EvaluationRequest = {
    storyContent: '<p>The vampire lord waited in the dark.</p>',
    configuration: {
      creature: 'vampire',
      themes: ['obsession'],
      spicyLevel: 3,
      wordCount: 900
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(PromptEvaluationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns the server evaluation untouched when the API call succeeds', async () => {
    const serverEvaluation: EvaluationCriteria = {
      score: 91,
      strengths: ['Vivid opening.'],
      weaknesses: ['Pacing lags mid-scene.'],
      suggestions: ['Trim the middle beat.'],
      overallFeedback: 'Strong draft overall.'
    };

    const evaluationPromise = service.evaluateStory(request);

    const req = httpMock.expectOne('/api/story-lab/evaluate');
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: serverEvaluation });

    const result = await evaluationPromise;

    expect(result).toEqual(serverEvaluation);
    expect(result.isMockEvaluation).toBeUndefined();
  });

  it('falls back to a clearly-marked mock evaluation when the API call errors', async () => {
    const evaluationPromise = service.evaluateStory(request);

    const req = httpMock.expectOne('/api/story-lab/evaluate');
    req.error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });

    const result = await evaluationPromise;

    expect(result.isMockEvaluation).toBeTrue();
    expect(result.score).toBe(75);
    expect(result.strengths.length).toBeGreaterThan(0);
  });

  it('falls back to a clearly-marked mock evaluation when the API reports success: false', async () => {
    const evaluationPromise = service.evaluateStory(request);

    const req = httpMock.expectOne('/api/story-lab/evaluate');
    req.flush({ success: false, error: { code: 'EVALUATION_FAILED', message: 'no evaluator configured' } });

    const result = await evaluationPromise;

    expect(result.isMockEvaluation).toBeTrue();
    expect(result.mockEvaluationReason).toBe('no evaluator configured');
  });

  // The route refuses an oversized story, an unauthenticated caller, and one
  // past its budget, each with a sentence the reader can act on. Dropping it
  // left the page reporting all three as "the evaluation API was unavailable".
  it('carries the refusal message from a non-2xx answer onto the placeholder', async () => {
    const evaluationPromise = service.evaluateStory(request);

    httpMock.expectOne('/api/story-lab/evaluate').flush(
      {
        success: false,
        error: {
          code: 'INVALID_EVALUATION_REQUEST',
          message: 'storyContent must be 60000 characters or fewer.'
        }
      },
      { status: 400, statusText: 'Bad Request' }
    );

    const result = await evaluationPromise;

    expect(result.isMockEvaluation).toBeTrue();
    expect(result.mockEvaluationReason).toBe('storyContent must be 60000 characters or fewer.');
  });

  // A request that never reached the API has nothing to quote, and inventing a
  // reason would be the same failure in the other direction.
  it('leaves the reason absent when the call never reached the API', async () => {
    const evaluationPromise = service.evaluateStory(request);

    httpMock.expectOne('/api/story-lab/evaluate')
      .error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });

    const result = await evaluationPromise;

    expect(result.isMockEvaluation).toBeTrue();
    expect(result.mockEvaluationReason).toBeUndefined();
  });

  it('falls back to a clearly-marked mock evaluation when the API reports success but omits data', async () => {
    const evaluationPromise = service.evaluateStory(request);

    const req = httpMock.expectOne('/api/story-lab/evaluate');
    req.flush({ success: true });

    const result = await evaluationPromise;

    expect(result.isMockEvaluation).toBeTrue();
  });

  it('returns the same fixed mock evaluation content every time it falls back', async () => {
    const first = service.evaluateStory(request);
    httpMock.expectOne('/api/story-lab/evaluate').error(new ProgressEvent('network error'));
    const firstResult = await first;

    const second = service.evaluateStory(request);
    httpMock.expectOne('/api/story-lab/evaluate').error(new ProgressEvent('network error'));
    const secondResult = await second;

    expect(firstResult).toEqual(secondResult);
  });
});
