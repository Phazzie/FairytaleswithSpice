import saveHandler from '../export/save';
import { TestDataFactory } from '../test-setup';

// Mock the ExportService
jest.mock('../lib/services/exportService', () => ({
  ExportService: jest.fn().mockImplementation(() => ({
    saveAndExport: jest.fn(),
  })),
}));

import { ExportService } from '../lib/services/exportService';

describe('API Route: /api/export/save', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockExportService: any;

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
    mockExportService = {
      saveAndExport: jest.fn(),
    };
    (ExportService as jest.MockedClass<typeof ExportService>).mockImplementation(
      () => mockExportService
    );
  });

  describe('CORS handling', () => {
    it('should set proper CORS headers', async () => {
      mockRequest.body = TestDataFactory.createValidExportRequest();
      mockExportService.saveAndExport.mockResolvedValue({
        success: true,
        data: { exportId: 'export-123', downloadUrl: 'https://example.com/file.pdf' },
      });

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:4200');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    });

    it('should handle OPTIONS preflight requests', async () => {
      mockRequest.method = 'OPTIONS';

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.end).toHaveBeenCalled();
      expect(mockExportService.saveAndExport).not.toHaveBeenCalled();
    });
  });

  describe('Method validation', () => {
    it('should return 405 for non-POST requests', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockRequest.method = method;
        await saveHandler(mockRequest, mockResponse);

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
        title: 'Test Story',
        format: 'pdf',
      };

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, title, format',
        },
      });
      expect(mockExportService.saveAndExport).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing content', async () => {
      mockRequest.body = {
        storyId: 'story-123',
        title: 'Test Story',
        format: 'pdf',
      };

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockExportService.saveAndExport).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing title', async () => {
      mockRequest.body = {
        storyId: 'story-123',
        content: '<p>Test content</p>',
        format: 'pdf',
      };

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockExportService.saveAndExport).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing format', async () => {
      mockRequest.body = {
        storyId: 'story-123',
        content: '<p>Test content</p>',
        title: 'Test Story',
      };

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockExportService.saveAndExport).not.toHaveBeenCalled();
    });

    it('should accept valid input with all required fields', async () => {
      const validRequest = TestDataFactory.createValidExportRequest();
      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockResolvedValue({
        success: true,
        data: { exportId: 'export-123' },
      });

      await saveHandler(mockRequest, mockResponse);

      expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should accept all valid export formats', async () => {
      const formats = ['pdf', 'txt', 'html', 'epub', 'docx'];
      
      for (const format of formats) {
        const validRequest = TestDataFactory.createValidExportRequest({ format });
        mockRequest.body = validRequest;
        mockExportService.saveAndExport.mockResolvedValue({
          success: true,
          data: { exportId: `export-${format}` },
        });

        await saveHandler(mockRequest, mockResponse);

        expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should accept optional includeMetadata field', async () => {
      const validRequest = TestDataFactory.createValidExportRequest({
        includeMetadata: false,
      });
      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockResolvedValue({
        success: true,
        data: { exportId: 'export-123' },
      });

      await saveHandler(mockRequest, mockResponse);

      expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should accept optional includeChapters field', async () => {
      const validRequest = TestDataFactory.createValidExportRequest({
        includeChapters: false,
      });
      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockResolvedValue({
        success: true,
        data: { exportId: 'export-123' },
      });

      await saveHandler(mockRequest, mockResponse);

      expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Service integration', () => {
    it('should handle successful export', async () => {
      const validRequest = TestDataFactory.createValidExportRequest();
      const mockSuccessResponse = {
        success: true,
        data: {
          exportId: 'export_101',
          storyId: 'story-123',
          downloadUrl: 'https://storage.example.com/export_101.pdf',
          filename: 'test-story-title.pdf',
          format: 'pdf',
          fileSize: 524288,
          expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
          exportedAt: new Date(),
        },
      };

      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockResolvedValue(mockSuccessResponse);

      await saveHandler(mockRequest, mockResponse);

      expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSuccessResponse);
    });

    it('should handle service failure responses', async () => {
      const validRequest = TestDataFactory.createValidExportRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Export failed',
          format: 'pdf',
        },
      };

      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockResolvedValue(mockErrorResponse);

      await saveHandler(mockRequest, mockResponse);

      expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle format not supported errors', async () => {
      const validRequest = TestDataFactory.createValidExportRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'FORMAT_NOT_SUPPORTED',
          message: 'Format not supported',
          requestedFormat: 'invalid',
          supportedFormats: ['pdf', 'txt', 'html', 'epub', 'docx'],
        },
      };

      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockResolvedValue(mockErrorResponse);

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle storage quota exceeded errors', async () => {
      const validRequest = TestDataFactory.createValidExportRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'STORAGE_QUOTA_EXCEEDED',
          message: 'Storage quota exceeded',
          quotaRemaining: 0,
        },
      };

      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockResolvedValue(mockErrorResponse);

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle service throwing exceptions', async () => {
      const validRequest = TestDataFactory.createValidExportRequest();
      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockRejectedValue(new Error('Service crashed'));

      await saveHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Export failed',
        },
      });
    });
  });

  describe('Contract validation', () => {
    it('should pass through valid SaveExportSeam input', async () => {
      const validInput = TestDataFactory.createValidExportRequest();
      mockRequest.body = validInput;
      mockExportService.saveAndExport.mockResolvedValue({ success: true, data: {} });

      await saveHandler(mockRequest, mockResponse);

      expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validInput);
    });

    it('should handle different content types', async () => {
      const contentTypes = [
        '<p>Simple text content</p>',
        '<h3>Chapter 1</h3><p>Story with <em>formatting</em></p>',
        '<div><h3>Title</h3><p>Multiple</p><p>paragraphs</p></div>',
        '<h1>Book Title</h1><h3>Chapter 1</h3><p>Complex structure</p><h3>Chapter 2</h3><p>More content</p>',
      ];
      
      for (const content of contentTypes) {
        const validInput = TestDataFactory.createValidExportRequest({ content });
        mockRequest.body = validInput;
        mockExportService.saveAndExport.mockResolvedValue({ success: true, data: {} });

        await saveHandler(mockRequest, mockResponse);

        expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validInput);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should handle different title formats', async () => {
      const titles = [
        'Simple Title',
        'Title with Special Characters: &amp; Symbols!',
        'Very Long Title That Might Need Truncation in Some Systems',
        'Title With "Quotes" and \'Apostrophes\'',
      ];
      
      for (const title of titles) {
        const validInput = TestDataFactory.createValidExportRequest({ title });
        mockRequest.body = validInput;
        mockExportService.saveAndExport.mockResolvedValue({ success: true, data: {} });

        await saveHandler(mockRequest, mockResponse);

        expect(mockExportService.saveAndExport).toHaveBeenCalledWith(validInput);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should handle missing optional fields gracefully', async () => {
      const baseRequest = {
        storyId: 'story-123',
        content: '<p>Test content</p>',
        title: 'Test Title',
        format: 'pdf',
      };
      
      mockRequest.body = baseRequest;
      mockExportService.saveAndExport.mockResolvedValue({ success: true, data: {} });

      await saveHandler(mockRequest, mockResponse);

      expect(mockExportService.saveAndExport).toHaveBeenCalledWith(baseRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Error logging', () => {
    it('should log errors when service throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const validRequest = TestDataFactory.createValidExportRequest();
      const error = new Error('Test error');
      
      mockRequest.body = validRequest;
      mockExportService.saveAndExport.mockRejectedValue(error);

      await saveHandler(mockRequest, mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Export serverless function error:', error);
      
      consoleSpy.mockRestore();
    });
  });
});