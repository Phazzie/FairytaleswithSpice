import healthHandler from './health';

describe('API Route: /api/health', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
  });

  describe('GET requests', () => {
    it('should return health status with service configuration', async () => {
      await healthHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          version: '1.0.0',
          environment: expect.any(String),
          services: expect.objectContaining({
            grok: expect.stringMatching(/^(configured|mock)$/),
            elevenlabs: expect.stringMatching(/^(configured|mock)$/),
          }),
          cors: expect.objectContaining({
            allowedOrigin: expect.any(String),
          }),
        })
      );
    });

    it('should indicate mock mode when API keys are not present', async () => {
      // Ensure no API keys are set
      delete process.env.XAI_API_KEY;
      delete process.env.ELEVENLABS_API_KEY;

      await healthHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          services: {
            grok: 'mock',
            elevenlabs: 'mock',
          },
        })
      );
    });

    it('should indicate configured mode when API keys are present', async () => {
      // Set mock API keys
      process.env.XAI_API_KEY = 'test-xai-key';
      process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';

      await healthHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          services: {
            grok: 'configured',
            elevenlabs: 'configured',
          },
        })
      );

      // Clean up
      delete process.env.XAI_API_KEY;
      delete process.env.ELEVENLABS_API_KEY;
    });

    it('should use default frontend URL when FRONTEND_URL is not set', async () => {
      delete process.env.FRONTEND_URL;

      await healthHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          cors: {
            allowedOrigin: 'http://localhost:4200',
          },
        })
      );
    });

    it('should use custom frontend URL when FRONTEND_URL is set', async () => {
      process.env.FRONTEND_URL = 'https://custom-domain.com';

      await healthHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          cors: {
            allowedOrigin: 'https://custom-domain.com',
          },
        })
      );

      delete process.env.FRONTEND_URL;
    });
  });

  describe('Method validation', () => {
    it('should return 405 for non-GET requests', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockRequest.method = method;
        await healthHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(405);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Method not allowed',
        });
      }
    });
  });

  describe('Error handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      await healthHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          environment: 'development', // Default value when NODE_ENV is undefined
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Response format validation', () => {
    it('should return consistent timestamp format', async () => {
      await healthHandler(mockRequest, mockResponse);

      const callArgs = mockResponse.json.mock.calls[0][0];
      const timestamp = callArgs.timestamp;

      // Should be a valid ISO string
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return proper environment indication', async () => {
      const originalEnv = process.env.NODE_ENV;

      // Test development environment
      process.env.NODE_ENV = 'development';
      mockResponse.json.mockClear();
      await healthHandler(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'development',
        })
      );

      // Test production environment
      process.env.NODE_ENV = 'production';
      mockResponse.json.mockClear();
      await healthHandler(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'production',
        })
      );

      // Restore original
      process.env.NODE_ENV = originalEnv;
    });
  });
});