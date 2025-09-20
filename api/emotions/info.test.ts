import infoHandler from '../emotions/info';

// Mock the AudioService
jest.mock('../lib/services/audioService', () => ({
  AudioService: jest.fn().mockImplementation(() => ({
    getEmotionInfo: jest.fn(),
  })),
}));

import { AudioService } from '../lib/services/audioService';

describe('API Route: /api/emotions/info', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockAudioService: any;

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

    jest.clearAllMocks();
    mockAudioService = {
      getEmotionInfo: jest.fn(),
    };
    (AudioService as jest.MockedClass<typeof AudioService>).mockImplementation(
      () => mockAudioService
    );
  });

  describe('Method validation', () => {
    it('should return 405 for non-GET requests', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockRequest.method = method;
        await infoHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(405);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Method not allowed',
        });
      }
    });

    it('should accept GET requests', async () => {
      mockAudioService.getEmotionInfo.mockReturnValue({
        emotions: ['happy', 'sad', 'excited'],
        combinations: ['happy+excited', 'sad+calm'],
      });

      await infoHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockAudioService.getEmotionInfo).toHaveBeenCalled();
    });
  });

  describe('Service integration', () => {
    it('should return emotion info successfully', async () => {
      const mockEmotionInfo = {
        availableEmotions: [
          'happy', 'sad', 'excited', 'calm', 'mysterious', 'romantic', 'dramatic'
        ],
        combinations: [
          'happy+excited',
          'mysterious+romantic',
          'dramatic+sad',
          'calm+happy'
        ],
        usage: {
          maxCombinations: 3,
          separator: '+',
          examples: ['happy', 'mysterious+romantic', 'dramatic+sad+calm']
        }
      };

      mockAudioService.getEmotionInfo.mockReturnValue(mockEmotionInfo);

      await infoHandler(mockRequest, mockResponse);

      expect(mockAudioService.getEmotionInfo).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEmotionInfo,
      });
    });

    it('should handle empty emotion info', async () => {
      const mockEmotionInfo = {
        availableEmotions: [],
        combinations: [],
        usage: {
          maxCombinations: 0,
          separator: '+',
          examples: []
        }
      };

      mockAudioService.getEmotionInfo.mockReturnValue(mockEmotionInfo);

      await infoHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEmotionInfo,
      });
    });

    it('should handle service throwing exceptions', async () => {
      const error = new Error('Failed to get emotion info');
      mockAudioService.getEmotionInfo.mockImplementation(() => {
        throw error;
      });

      await infoHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EMOTION_INFO_ERROR',
          message: error.message,
        },
      });
    });

    it('should handle service returning null or undefined', async () => {
      mockAudioService.getEmotionInfo.mockReturnValue(null);

      await infoHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });
  });

  describe('Error handling', () => {
    it('should provide proper error structure on service failure', async () => {
      const specificError = new Error('Database connection failed');
      mockAudioService.getEmotionInfo.mockImplementation(() => {
        throw specificError;
      });

      await infoHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EMOTION_INFO_ERROR',
          message: 'Database connection failed',
        },
      });
    });

    it('should handle generic errors', async () => {
      mockAudioService.getEmotionInfo.mockImplementation(() => {
        throw new Error();
      });

      await infoHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: 'EMOTION_INFO_ERROR',
            message: '',
          },
        })
      );
    });
  });

  describe('Error logging', () => {
    it('should log errors when service throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');
      
      mockAudioService.getEmotionInfo.mockImplementation(() => {
        throw error;
      });

      await infoHandler(mockRequest, mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Error getting emotion info:', error);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Response format validation', () => {
    it('should return consistent success response format', async () => {
      const mockData = { emotions: ['happy'] };
      mockAudioService.getEmotionInfo.mockReturnValue(mockData);

      await infoHandler(mockRequest, mockResponse);

      const callArgs = mockResponse.json.mock.calls[0][0];
      
      expect(callArgs).toHaveProperty('success', true);
      expect(callArgs).toHaveProperty('data', mockData);
      expect(callArgs).not.toHaveProperty('error');
    });

    it('should return consistent error response format', async () => {
      mockAudioService.getEmotionInfo.mockImplementation(() => {
        throw new Error('Test error');
      });

      await infoHandler(mockRequest, mockResponse);

      const callArgs = mockResponse.json.mock.calls[0][0];
      
      expect(callArgs).toHaveProperty('success', false);
      expect(callArgs).toHaveProperty('error');
      expect(callArgs.error).toHaveProperty('code');
      expect(callArgs.error).toHaveProperty('message');
      expect(callArgs).not.toHaveProperty('data');
    });
  });
});