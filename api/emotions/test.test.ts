import testHandler from '../emotions/test';

// Mock the AudioService
jest.mock('../lib/services/audioService', () => ({
  AudioService: jest.fn().mockImplementation(() => ({
    testEmotionCombination: jest.fn(),
  })),
}));

import { AudioService } from '../lib/services/audioService';

describe('API Route: /api/emotions/test', () => {
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
      setHeader: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
    mockAudioService = {
      testEmotionCombination: jest.fn(),
    };
    (AudioService as jest.MockedClass<typeof AudioService>).mockImplementation(
      () => mockAudioService
    );
  });

  describe('Method validation', () => {
    it('should return 405 for non-POST requests', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockRequest.method = method;
        await testHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(405);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Method not allowed',
        });
      }
    });

    it('should accept POST requests', async () => {
      mockRequest.body = { emotion: 'happy' };
      mockAudioService.testEmotionCombination.mockReturnValue({
        isValid: true,
        emotion: 'happy',
      });

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockAudioService.testEmotionCombination).toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    it('should return 400 when emotion is missing', async () => {
      mockRequest.body = {};

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_EMOTION',
          message: 'Emotion string is required',
        },
      });
      expect(mockAudioService.testEmotionCombination).not.toHaveBeenCalled();
    });

    it('should return 400 when emotion is null', async () => {
      mockRequest.body = { emotion: null };

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockAudioService.testEmotionCombination).not.toHaveBeenCalled();
    });

    it('should return 400 when emotion is undefined', async () => {
      mockRequest.body = { emotion: undefined };

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockAudioService.testEmotionCombination).not.toHaveBeenCalled();
    });

    it('should return 400 when emotion is empty string', async () => {
      mockRequest.body = { emotion: '' };

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockAudioService.testEmotionCombination).not.toHaveBeenCalled();
    });

    it('should accept valid emotion strings', async () => {
      const validEmotions = [
        'happy',
        'sad',
        'excited+happy',
        'mysterious+romantic',
        'dramatic+sad+calm',
      ];

      for (const emotion of validEmotions) {
        mockRequest.body = { emotion };
        mockAudioService.testEmotionCombination.mockReturnValue({
          isValid: true,
          emotion,
        });

        await testHandler(mockRequest, mockResponse);

        expect(mockAudioService.testEmotionCombination).toHaveBeenCalledWith(emotion);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });
  });

  describe('Service integration', () => {
    it('should return test result for valid emotion', async () => {
      const emotion = 'happy+excited';
      const mockTestResult = {
        isValid: true,
        emotion: 'happy+excited',
        parsedEmotions: ['happy', 'excited'],
        suggestedVoiceSettings: {
          speed: 1.2,
          pitch: '+5%',
          emphasis: 'moderate',
        },
        compatibleVoices: ['female', 'neutral'],
        estimatedProcessingTime: 120,
      };

      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockTestResult);

      await testHandler(mockRequest, mockResponse);

      expect(mockAudioService.testEmotionCombination).toHaveBeenCalledWith(emotion);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTestResult,
      });
    });

    it('should return test result for invalid emotion', async () => {
      const emotion = 'invalid+unknown';
      const mockTestResult = {
        isValid: false,
        emotion: 'invalid+unknown',
        errors: ['Unknown emotion: invalid', 'Unknown emotion: unknown'],
        suggestions: ['happy+excited', 'mysterious+romantic'],
      };

      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockTestResult);

      await testHandler(mockRequest, mockResponse);

      expect(mockAudioService.testEmotionCombination).toHaveBeenCalledWith(emotion);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTestResult,
      });
    });

    it('should handle single emotion test', async () => {
      const emotion = 'romantic';
      const mockTestResult = {
        isValid: true,
        emotion: 'romantic',
        parsedEmotions: ['romantic'],
        suggestedVoiceSettings: {
          speed: 0.9,
          pitch: '-2%',
          emphasis: 'soft',
        },
        compatibleVoices: ['female', 'male'],
        estimatedProcessingTime: 90,
      };

      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockTestResult);

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTestResult,
      });
    });

    it('should handle complex emotion combinations', async () => {
      const emotion = 'mysterious+romantic+dramatic';
      const mockTestResult = {
        isValid: true,
        emotion: 'mysterious+romantic+dramatic',
        parsedEmotions: ['mysterious', 'romantic', 'dramatic'],
        warnings: ['Complex combination may increase processing time'],
        suggestedVoiceSettings: {
          speed: 1.0,
          pitch: '0%',
          emphasis: 'variable',
        },
        compatibleVoices: ['female', 'male'],
        estimatedProcessingTime: 180,
      };

      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockTestResult);

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTestResult,
      });
    });

    it('should handle service throwing exceptions', async () => {
      const emotion = 'happy';
      const error = new Error('Emotion processing failed');
      
      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockImplementation(() => {
        throw error;
      });

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EMOTION_TEST_ERROR',
          message: error.message,
        },
      });
    });

    it('should handle service returning null or undefined', async () => {
      const emotion = 'happy';
      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(null);

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle emotion with special characters', async () => {
      const emotion = 'happy-excited';
      const mockTestResult = {
        isValid: false,
        emotion: 'happy-excited',
        errors: ['Invalid separator: use + instead of -'],
        suggestions: ['happy+excited'],
      };

      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockTestResult);

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTestResult,
      });
    });

    it('should handle very long emotion strings', async () => {
      const emotion = 'happy+excited+mysterious+romantic+dramatic+calm+energetic+sad';
      const mockTestResult = {
        isValid: false,
        emotion,
        errors: ['Too many emotions: maximum 3 allowed'],
        suggestions: ['happy+excited+mysterious', 'romantic+dramatic+calm'],
      };

      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockTestResult);

      await testHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTestResult,
      });
    });

    it('should handle emotion with leading/trailing spaces', async () => {
      const emotion = '  happy+excited  ';
      const mockTestResult = {
        isValid: true,
        emotion: 'happy+excited',
        parsedEmotions: ['happy', 'excited'],
        normalized: true,
      };

      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockTestResult);

      await testHandler(mockRequest, mockResponse);

      expect(mockAudioService.testEmotionCombination).toHaveBeenCalledWith(emotion);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Error logging', () => {
    it('should log errors when service throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const emotion = 'happy';
      const error = new Error('Test error');
      
      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockImplementation(() => {
        throw error;
      });

      await testHandler(mockRequest, mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Error testing emotion combination:', error);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Response format validation', () => {
    it('should return consistent success response format', async () => {
      const emotion = 'happy';
      const mockData = { isValid: true, emotion };
      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockReturnValue(mockData);

      await testHandler(mockRequest, mockResponse);

      const callArgs = mockResponse.json.mock.calls[0][0];
      
      expect(callArgs).toHaveProperty('success', true);
      expect(callArgs).toHaveProperty('data', mockData);
      expect(callArgs).not.toHaveProperty('error');
    });

    it('should return consistent error response format', async () => {
      const emotion = 'happy';
      mockRequest.body = { emotion };
      mockAudioService.testEmotionCombination.mockImplementation(() => {
        throw new Error('Test error');
      });

      await testHandler(mockRequest, mockResponse);

      const callArgs = mockResponse.json.mock.calls[0][0];
      
      expect(callArgs).toHaveProperty('success', false);
      expect(callArgs).toHaveProperty('error');
      expect(callArgs.error).toHaveProperty('code');
      expect(callArgs.error).toHaveProperty('message');
      expect(callArgs).not.toHaveProperty('data');
    });
  });
});