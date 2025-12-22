import { authenticateRequest, checkRateLimit, AuthenticatedRequest } from './security';

describe('Security Middleware', () => {
  describe('authenticateRequest', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should reject request without API key', async () => {
      const req: AuthenticatedRequest = {
        method: 'POST',
        headers: {},
        body: {}
      };

      const result = await authenticateRequest(req);

      expect(result.authenticated).toBe(false);
      expect(result.error?.code).toBe('MISSING_API_KEY');
    });

    it('should accept request with valid API key in X-API-Key header', async () => {
      process.env['API_KEYS'] = 'test-key-1,test-key-2';
      
      const req: AuthenticatedRequest = {
        method: 'POST',
        headers: {
          'x-api-key': 'test-key-1'
        },
        body: {}
      };

      const result = await authenticateRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBeDefined();
    });

    it('should accept request with valid API key in Authorization header', async () => {
      process.env['API_KEYS'] = 'test-key-1,test-key-2';
      
      const req: AuthenticatedRequest = {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-key-1'
        },
        body: {}
      };

      const result = await authenticateRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBeDefined();
    });

    it('should reject request with invalid API key', async () => {
      process.env['API_KEYS'] = 'test-key-1,test-key-2';
      
      const req: AuthenticatedRequest = {
        method: 'POST',
        headers: {
          'x-api-key': 'invalid-key'
        },
        body: {}
      };

      const result = await authenticateRequest(req);

      expect(result.authenticated).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_KEY');
    });

    it('should allow requests in development mode when no API keys configured', async () => {
      delete process.env['API_KEYS'];
      
      const req: AuthenticatedRequest = {
        method: 'POST',
        headers: {
          'x-api-key': 'any-key'
        },
        body: {}
      };

      const result = await authenticateRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('development_user');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store between tests
      jest.clearAllMocks();
    });

    it('should allow requests within rate limit', () => {
      const result1 = checkRateLimit('user1', 'generate', 10, 60000);
      const result2 = checkRateLimit('user1', 'generate', 10, 60000);
      const result3 = checkRateLimit('user1', 'generate', 10, 60000);

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(8);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(7);
    });

    it('should block requests exceeding rate limit', () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit('user1', 'generate', 10, 60000);
        expect(result.allowed).toBe(true);
      }

      // 11th request should be blocked
      const result = checkRateLimit('user1', 'generate', 10, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different users separately', () => {
      const result1 = checkRateLimit('user1', 'generate', 10, 60000);
      const result2 = checkRateLimit('user2', 'generate', 10, 60000);

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(9); // user2 has full quota
    });

    it('should track different endpoints separately', () => {
      const result1 = checkRateLimit('user1', 'generate', 10, 60000);
      const result2 = checkRateLimit('user1', 'audio', 5, 60000);

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(4); // Different endpoint, different limit
    });

    it('should reset count after time window', () => {
      jest.useFakeTimers();
      
      // Make requests
      for (let i = 0; i < 10; i++) {
        checkRateLimit('user1', 'generate', 10, 60000);
      }

      // Should be blocked
      let result = checkRateLimit('user1', 'generate', 10, 60000);
      expect(result.allowed).toBe(false);

      // Advance time past window
      jest.advanceTimersByTime(60001);

      // Should be allowed again
      result = checkRateLimit('user1', 'generate', 10, 60000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);

      jest.useRealTimers();
    });

    it('should include reset time in response', () => {
      const now = Date.now();
      const result = checkRateLimit('user1', 'generate', 10, 60000);

      expect(result.resetTime).toBeGreaterThan(now);
      expect(result.resetTime).toBeLessThanOrEqual(now + 60000);
    });
  });
});
