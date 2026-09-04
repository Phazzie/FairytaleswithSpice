import { TestBed } from '@angular/core/testing';

import { ErrorLoggingService } from './error-logging';

describe('ErrorLoggingService', () => {
  let service: ErrorLoggingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorLoggingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should log errors with correct severity', () => {
    const testError = new Error('Test error');
    const result = service.logError(testError, 'Test Context', 'error');
    
    expect(result.logged).toBe(true);
    expect(result.severity).toBe('error');
    expect(service.getErrorCount()).toBe(1);
  });

  it('should clear errors', () => {
    service.logError(new Error('Test'), 'Test', 'error');
    expect(service.getErrorCount()).toBe(1);
    
    service.clearErrors();
    expect(service.getErrorCount()).toBe(0);
  });

  it('should get latest errors', () => {
    for (let i = 0; i < 15; i++) {
      service.logError(new Error(`Error ${i}`), 'Test', 'error');
    }
    
    const latest = service.getLatestErrors(10);
    expect(latest.length).toBe(10);
    expect(latest[0].message).toBe('Error 14'); // Most recent first
  });

  it('should filter errors by severity', () => {
    service.logError(new Error('Critical'), 'Test', 'critical');
    service.logError(new Error('Warning'), 'Test', 'warning');
    service.logError(new Error('Info'), 'Test', 'info');
    
    expect(service.getErrorsBySeverity('critical').length).toBe(1);
    expect(service.getErrorsBySeverity('warning').length).toBe(1);
    expect(service.getErrorsBySeverity('info').length).toBe(1);
  });

  it('should redact private story, prompt, auth, email, and artifact URL details', () => {
    const storyText = 'Elena opened the forbidden grimoire and confessed the secret ending.';
    const prompt = 'Write a spicy supernatural chapter using the entire private blueprint.';
    const email = 'reader@example.com';
    const apiKey = 'xai-secret-key-123';
    const artifactUrl = 'https://blob.vercel-storage.com/story/export.html?token=private-token';
    // Carries a Clerk session token on the Story Lab generation/job routes
    // (auth.interceptor.ts) instead of Authorization, so it needs its own
    // entry in SENSITIVE_KEY_PATTERNS rather than reusing the Authorization
    // match.
    const clerkSessionToken = 'clerk-session-jwt-abc123';

    service.logError(
      {
        message: `${email} failed while generating ${storyText}`,
        url: artifactUrl,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Story-Lab-Session': clerkSessionToken
        },
        error: {
          prompt,
          storyText
        }
      },
      'Privacy Test',
      'error',
      {
        prompt,
        email,
        apiKey,
        artifactUrl
      }
    );

    const latest = service.getLatestErrors(1)[0];
    const serialized = JSON.stringify(latest);

    expect(serialized).not.toContain(storyText);
    expect(serialized).not.toContain(prompt);
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain(artifactUrl);
    expect(serialized).not.toContain(clerkSessionToken);
    expect(serialized).toContain('[REDACTED]');
  });

  it('should keep the true original error when additional details include originalError', () => {
    const realError = new Error('real root cause');

    service.logError(
      realError,
      'Override Test',
      'error',
      { originalError: new Error('forged root cause') }
    );

    const latest = service.getLatestErrors(1)[0];
    const details = JSON.stringify(latest.details);

    expect(latest.message).toBe('real root cause');
    expect(details).toContain('real root cause');
    expect(details).not.toContain('forged root cause');
  });

  it('should keep a value that two branches share rather than calling it circular', () => {
    // What `StoryService.handleHttpError` logs: the response body is reachable
    // both as `payload` and as `originalError.error`, and nothing about that is
    // a cycle. A visited-everything walk replaced whichever the key order
    // reached second with `[Circular]`, dropping the response body from the
    // error entry it belongs to.
    const responseBody = { code: 'STORY_NOT_FOUND', hint: 'retry with a fresh id' };
    const httpError = { status: 404, url: '/api/story-lab/stories/abc', error: responseBody };

    service.logError(httpError, 'Shared Reference Test', 'error', {
      status: httpError.status,
      url: httpError.url,
      payload: responseBody
    });

    const details = service.getLatestErrors(1)[0].details as any;

    expect(details.payload.code).toBe('STORY_NOT_FOUND');
    expect(details.originalError.error.code).toBe('STORY_NOT_FOUND');
    expect(JSON.stringify(details)).not.toContain('[Circular]');
  });

  it('should redact a value that is only named as sensitive on its second path', () => {
    // One array, reached first under a harmless key and then under a sensitive
    // one. A visited-everything walk skipped the second visit, so the token was
    // never collected — and an uncollected value is not removed from the message
    // and stack text it also appears in. This one carries no recognisable key
    // prefix, so the key it hangs under is the only thing that identifies it.
    const sessionToken = 'q7f3a9c21d4e8b6a0';
    const sharedTokens = [sessionToken];

    service.logError(
      { message: `upload rejected for ${sessionToken}` },
      'Second Path Test',
      'error',
      { auditTrail: sharedTokens, accessTokens: sharedTokens }
    );

    const serialized = JSON.stringify(service.getLatestErrors(1)[0]);

    expect(serialized).not.toContain(sessionToken);
    expect(serialized).toContain('[REDACTED]');
  });

  it('should serialize circular Error causes without recursion', () => {
    const circularError = new Error('loop root') as Error & { cause?: unknown };
    circularError.cause = circularError;

    const result = service.logError(circularError, 'Cause Loop', 'error');

    const latest = service.getLatestErrors(1)[0];
    const details = JSON.stringify(latest.details);
    expect(result.logged).toBeTrue();
    expect(details).toContain('loop root');
    expect(details).toContain('[Circular]');
  });
});
