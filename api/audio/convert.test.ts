import convertHandler from '../audio/convert';
import { TestDataFactory } from '../test-setup';

// Mock the AudioService
jest.mock('../lib/services/audioService', () => ({
  AudioService: jest.fn().mockImplementation(() => ({
    convertToAudio: jest.fn(),
  })),
}));

import { AudioService } from '../lib/services/audioService';

describe('API Route: /api/audio/convert', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockAudioService: any;

  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      body: {},
      headers: { 'content-type': 'application/json' },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
    mockAudioService = {
      convertToAudio: jest.fn(),
    };
    (AudioService as jest.MockedClass<typeof AudioService>).mockImplementation(
      () => mockAudioService
    );
  });

  describe('CORS handling', () => {
    it('should set proper CORS headers', async () => {
      mockRequest.body = TestDataFactory.createValidAudioRequest();
      mockAudioService.convertToAudio.mockResolvedValue({
        success: true,
        data: { audioId: 'audio-123', audioUrl: 'https://example.com/audio.mp3' },
      });

      await convertHandler(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:4200');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    });

    it('should handle OPTIONS preflight requests', async () => {
      mockRequest.method = 'OPTIONS';

      await convertHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.end).toHaveBeenCalled();
      expect(mockAudioService.convertToAudio).not.toHaveBeenCalled();
    });
  });

  describe('Method validation', () => {
    it('should return 405 for non-POST requests', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockRequest.method = method;
        await convertHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(405);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only POST requests are allowed',
          },
        });
      }
    });
  });

  describe('Input validation', () => {
    it('should validate required fields - missing storyId', async () => {
      mockRequest.body = {
        content: '<p>Test content</p>',
      };

      await convertHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content',
        },
      });
      expect(mockAudioService.convertToAudio).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing content', async () => {
      mockRequest.body = {
        storyId: 'story-123',
      };

      await convertHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockAudioService.convertToAudio).not.toHaveBeenCalled();
    });

    it('should accept valid input with required fields only', async () => {
      const validRequest = {
        storyId: 'story-123',
        content: '<p>Test story content</p>',
      };
      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockResolvedValue({
        success: true,
        data: { audioId: 'audio-123' },
      });

      await convertHandler(mockRequest, mockResponse);

      expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should accept valid input with all optional fields', async () => {
      const validRequest = TestDataFactory.createValidAudioRequest();
      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockResolvedValue({
        success: true,
        data: { audioId: 'audio-123' },
      });

      await convertHandler(mockRequest, mockResponse);

      expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should accept all valid voice types', async () => {
      const voices = ['female', 'male', 'neutral'];
      
      for (const voice of voices) {
        const validRequest = TestDataFactory.createValidAudioRequest({ voice });
        mockRequest.body = validRequest;
        mockAudioService.convertToAudio.mockResolvedValue({
          success: true,
          data: { audioId: `audio-${voice}` },
        });

        await convertHandler(mockRequest, mockResponse);

        expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should accept all valid audio speeds', async () => {
      const speeds = [0.5, 0.75, 1.0, 1.25, 1.5];
      
      for (const speed of speeds) {
        const validRequest = TestDataFactory.createValidAudioRequest({ speed });
        mockRequest.body = validRequest;
        mockAudioService.convertToAudio.mockResolvedValue({
          success: true,
          data: { audioId: `audio-${speed}` },
        });

        await convertHandler(mockRequest, mockResponse);

        expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should accept all valid audio formats', async () => {
      const formats = ['mp3', 'wav', 'aac'];
      
      for (const format of formats) {
        const validRequest = TestDataFactory.createValidAudioRequest({ format });
        mockRequest.body = validRequest;
        mockAudioService.convertToAudio.mockResolvedValue({
          success: true,
          data: { audioId: `audio-${format}` },
        });

        await convertHandler(mockRequest, mockResponse);

        expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });
  });

  describe('Service integration', () => {
    it('should handle successful audio conversion', async () => {
      const validRequest = TestDataFactory.createValidAudioRequest();
      const mockSuccessResponse = {
        success: true,
        data: {
          audioId: 'audio_789',
          storyId: 'story-123',
          audioUrl: 'https://storage.example.com/audio_789.mp3',
          duration: 245,
          fileSize: 3932160,
          format: 'mp3',
          voice: 'female',
          speed: 1.0,
          progress: {
            percentage: 100,
            status: 'completed',
            message: 'Audio conversion completed',
          },
          completedAt: new Date(),
        },
      };

      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockResolvedValue(mockSuccessResponse);

      await convertHandler(mockRequest, mockResponse);

      expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSuccessResponse);
    });

    it('should handle service failure responses', async () => {
      const validRequest = TestDataFactory.createValidAudioRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'CONVERSION_FAILED',
          message: 'Audio conversion failed',
          stage: 'audio_generation',
        },
      };

      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockResolvedValue(mockErrorResponse);

      await convertHandler(mockRequest, mockResponse);

      expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle unsupported content errors', async () => {
      const validRequest = TestDataFactory.createValidAudioRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'UNSUPPORTED_CONTENT',
          message: 'Content contains unsupported elements',
          unsupportedElements: ['<script>', '<iframe>'],
        },
      };

      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockResolvedValue(mockErrorResponse);

      await convertHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle audio quota exceeded errors', async () => {
      const validRequest = TestDataFactory.createValidAudioRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'AUDIO_QUOTA_EXCEEDED',
          message: 'Audio quota exceeded',
          quotaRemaining: 0,
          resetTime: new Date(),
        },
      };

      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockResolvedValue(mockErrorResponse);

      await convertHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle service throwing exceptions', async () => {
      const validRequest = TestDataFactory.createValidAudioRequest();
      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockRejectedValue(new Error('Service crashed'));

      await convertHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Audio conversion failed',
        },
      });
    });
  });

  describe('Contract validation', () => {
    it('should pass through valid AudioConversionSeam input', async () => {
      const validInput = TestDataFactory.createValidAudioRequest();
      mockRequest.body = validInput;
      mockAudioService.convertToAudio.mockResolvedValue({ success: true, data: {} });

      await convertHandler(mockRequest, mockResponse);

      expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validInput);
    });

    it('should handle different content types', async () => {
      const contentTypes = [
        '<p>Simple text content</p>',
        '<h3>Chapter 1</h3><p>Story with <em>formatting</em></p>',
        '<div><h3>Title</h3><p>Multiple</p><p>paragraphs</p></div>',
        '<p>Content with "special" characters & symbols!</p>',
      ];
      
      for (const content of contentTypes) {
        const validInput = TestDataFactory.createValidAudioRequest({ content });
        mockRequest.body = validInput;
        mockAudioService.convertToAudio.mockResolvedValue({ success: true, data: {} });

        await convertHandler(mockRequest, mockResponse);

        expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(validInput);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should handle missing optional fields gracefully', async () => {
      const baseRequest = {
        storyId: 'story-123',
        content: '<p>Test content</p>',
      };
      
      mockRequest.body = baseRequest;
      mockAudioService.convertToAudio.mockResolvedValue({ success: true, data: {} });

      await convertHandler(mockRequest, mockResponse);

      expect(mockAudioService.convertToAudio).toHaveBeenCalledWith(baseRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Error logging', () => {
    it('should log errors when service throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const validRequest = TestDataFactory.createValidAudioRequest();
      const error = new Error('Test error');
      
      mockRequest.body = validRequest;
      mockAudioService.convertToAudio.mockRejectedValue(error);

      await convertHandler(mockRequest, mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Audio conversion serverless function error:', error);
      
      consoleSpy.mockRestore();
    });
  });
});