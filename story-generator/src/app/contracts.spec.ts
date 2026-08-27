// Created: 2026-08-27 UTC
//
// The API envelope was declared twice — once in `api/_lib/types/contracts.ts`
// and once here — and the two had drifted. The API's carries `metadata`; this
// tree's did not. Every classic route attaches one, and `partialFailures` in it
// is the only place a chapter that failed inside an otherwise successful batch
// is reported, so the Angular tree's own type said the field did not exist.
//
// The declaration here is now the backend's, re-exported. These are compile-time
// assertions as much as runtime ones: if the envelope is redeclared without
// `metadata`, this file stops building.

import type { ApiResponse, ApiErrorPayload } from './contracts';

describe('the API envelope', () => {
  it('carries the metadata every route attaches', () => {
    const response: ApiResponse<{ storyId: string }> = {
      success: true,
      data: { storyId: 'story-1' },
      metadata: {
        requestId: 'req-1',
        processingTime: 1200,
        model: 'grok-4',
        rateLimitRemaining: 9
      }
    };

    expect(response.metadata?.requestId).toBe('req-1');
  });

  it('reports the chapters a successful batch could not generate', () => {
    const response: ApiResponse<{ storyId: string }> = {
      success: true,
      data: { storyId: 'story-1' },
      metadata: {
        requestId: 'req-2',
        processingTime: 4200,
        chaptersRequested: 3,
        chaptersGenerated: 2,
        partialFailures: [{ chapterNumber: 3, message: 'The provider timed out.', errorCode: 'AI_SERVICE_UNAVAILABLE' }]
      }
    };

    expect(response.metadata?.partialFailures?.[0]?.chapterNumber).toBe(3);
  });

  it('carries the request id beside a failure, so a client can name it in a report', () => {
    const error: ApiErrorPayload = { code: 'GENERATION_FAILED', message: 'The story could not be generated.' };
    const response: ApiResponse<never> = {
      success: false,
      error,
      metadata: { requestId: 'req-3', processingTime: 90 }
    };

    expect(response.success).toBeFalse();
    expect(response.metadata?.requestId).toBe('req-3');
  });
});
