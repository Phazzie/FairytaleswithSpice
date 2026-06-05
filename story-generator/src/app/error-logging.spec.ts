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

    service.logError(
      {
        message: `${email} failed while generating ${storyText}`,
        url: artifactUrl,
        headers: {
          Authorization: `Bearer ${apiKey}`
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
    expect(serialized).toContain('[REDACTED]');
  });
});
