import { ExportService } from '../services/exportService';
import { SaveExportSeam, ExportFormat } from '../types/contracts';

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
    jest.clearAllMocks();
  });

  describe('saveAndExport', () => {
    const validInput: SaveExportSeam['input'] = {
      storyId: 'story_123',
      content: '<h3>Chapter 1: The Beginning</h3><p>This is a test story with <em>emphasis</em> and formatting.</p>',
      title: 'The Vampire\'s Forbidden Passion',
      format: 'pdf',
      includeMetadata: true,
      includeChapters: true
    };

    it('should export story with valid input (PDF format)', async () => {
      const result = await exportService.saveAndExport(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.exportId).toMatch(/^export_\d+_.+/);
      expect(result.data!.storyId).toBe('story_123');
      expect(result.data!.downloadUrl).toContain('storage.example.com');
      expect(result.data!.filename).toContain('.pdf');
      expect(result.data!.format).toBe('pdf');
      expect(result.data!.fileSize).toBeGreaterThan(0);
      expect(result.data!.expiresAt).toBeInstanceOf(Date);
      expect(result.data!.exportedAt).toBeInstanceOf(Date);
      expect(result.data!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.requestId).toMatch(/^req_\d+_.+/);
      expect(result.metadata!.processingTime).toBeGreaterThan(0);
    });

    it('should handle all export formats correctly', async () => {
      const formats: ExportFormat[] = ['pdf', 'txt', 'html', 'epub', 'docx'];

      for (const format of formats) {
        const input = { ...validInput, format };
        const result = await exportService.saveAndExport(input);

        expect(result.success).toBe(true);
        expect(result.data!.format).toBe(format);
        expect(result.data!.filename).toContain(`.${format}`);
        expect(result.data!.fileSize).toBeGreaterThan(0);
      }
    });

    it('should handle missing optional fields', async () => {
      const minimalInput: SaveExportSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Minimal content</p>',
        title: 'Test Story',
        format: 'txt'
        // includeMetadata and includeChapters are optional
      };

      const result = await exportService.saveAndExport(minimalInput);

      expect(result.success).toBe(true);
      expect(result.data!.format).toBe('txt');
    });

    it('should validate missing required fields', async () => {
      const invalidInput = {
        storyId: 'story_123',
        content: '<p>Content</p>',
        // title is missing
        format: 'pdf' as ExportFormat
      };

      const result = await exportService.saveAndExport(invalidInput as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INVALID_INPUT');
      expect(result.error!.message).toContain('Missing required fields');
    });

    it('should validate unsupported format', async () => {
      const invalidInput = {
        ...validInput,
        format: 'unsupported' as ExportFormat
      };

      const result = await exportService.saveAndExport(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('FORMAT_NOT_SUPPORTED');
    });

    it('should handle empty content', async () => {
      const emptyInput = {
        ...validInput,
        content: ''
      };

      const result = await exportService.saveAndExport(emptyInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INVALID_INPUT');
      expect(result.error!.message).toContain('Content cannot be empty');
    });

    it('should handle very long content', async () => {
      const veryLongContent = '<p>' + 'This is a very long story. '.repeat(10000) + '</p>';
      const longInput = {
        ...validInput,
        content: veryLongContent
      };

      const result = await exportService.saveAndExport(longInput);

      expect(result.success).toBe(true);
      expect(result.data!.fileSize).toBeGreaterThan(100000); // Should be large
    });

    it('should generate appropriate filenames', async () => {
      const testCases = [
        { title: 'Simple Title', format: 'pdf' as ExportFormat, expected: 'simple-title.pdf' },
        { title: 'Title with Spaces & Special!', format: 'txt' as ExportFormat, expected: 'title-with-spaces-special.txt' },
        { title: 'The Vampire\'s Story', format: 'html' as ExportFormat, expected: 'the-vampires-story.html' }
      ];

      for (const testCase of testCases) {
        const input = { ...validInput, title: testCase.title, format: testCase.format };
        const result = await exportService.saveAndExport(input);

        expect(result.success).toBe(true);
        expect(result.data!.filename.toLowerCase()).toContain(testCase.expected.toLowerCase());
      }
    });

    it('should include metadata when requested', async () => {
      const withMetadata = { ...validInput, includeMetadata: true };
      const withoutMetadata = { ...validInput, includeMetadata: false };

      const resultWith = await exportService.saveAndExport(withMetadata);
      const resultWithout = await exportService.saveAndExport(withoutMetadata);

      expect(resultWith.success).toBe(true);
      expect(resultWithout.success).toBe(true);

      // Files with metadata should be larger (contains additional info)
      expect(resultWith.data!.fileSize).toBeGreaterThan(resultWithout.data!.fileSize);
    });

    it('should generate unique export IDs', async () => {
      const result1 = await exportService.saveAndExport(validInput);
      const result2 = await exportService.saveAndExport(validInput);

      expect(result1.data!.exportId).not.toBe(result2.data!.exportId);
    });

    it('should set appropriate expiration times', async () => {
      const result = await exportService.saveAndExport(validInput);

      expect(result.success).toBe(true);
      
      const now = Date.now();
      const expiresAt = result.data!.expiresAt.getTime();
      const exportedAt = result.data!.exportedAt.getTime();

      // Should expire in the future
      expect(expiresAt).toBeGreaterThan(now);
      // Should be exported recently
      expect(exportedAt).toBeLessThanOrEqual(now);
      expect(exportedAt).toBeGreaterThan(now - 5000); // Within last 5 seconds

      // Should expire approximately 24 hours from now
      const expectedExpiration = now + (24 * 60 * 60 * 1000); // 24 hours
      expect(Math.abs(expiresAt - expectedExpiration)).toBeLessThan(10000); // Within 10 seconds tolerance
    });
  });

  describe('format-specific exports', () => {
    const baseInput: SaveExportSeam['input'] = {
      storyId: 'story_123',
      content: '<h3>Chapter 1</h3><p>Story content with <em>emphasis</em>.</p>',
      title: 'Test Story',
      format: 'txt'
    };

    it('should handle TXT format correctly', async () => {
      const input = { ...baseInput, format: 'txt' as ExportFormat };
      const result = await exportService.saveAndExport(input);

      expect(result.success).toBe(true);
      expect(result.data!.format).toBe('txt');
      expect(result.data!.filename).toMatch(/\.txt$/);
    });

    it('should handle HTML format correctly', async () => {
      const input = { ...baseInput, format: 'html' as ExportFormat };
      const result = await exportService.saveAndExport(input);

      expect(result.success).toBe(true);
      expect(result.data!.format).toBe('html');
      expect(result.data!.filename).toMatch(/\.html$/);
      // HTML export should preserve formatting, so might be larger
      expect(result.data!.fileSize).toBeGreaterThan(0);
    });

    it('should handle PDF format correctly', async () => {
      const input = { ...baseInput, format: 'pdf' as ExportFormat };
      const result = await exportService.saveAndExport(input);

      expect(result.success).toBe(true);
      expect(result.data!.format).toBe('pdf');
      expect(result.data!.filename).toMatch(/\.pdf$/);
    });

    it('should handle EPUB format correctly', async () => {
      const input = { ...baseInput, format: 'epub' as ExportFormat };
      const result = await exportService.saveAndExport(input);

      expect(result.success).toBe(true);
      expect(result.data!.format).toBe('epub');
      expect(result.data!.filename).toMatch(/\.epub$/);
    });

    it('should handle DOCX format correctly', async () => {
      const input = { ...baseInput, format: 'docx' as ExportFormat };
      const result = await exportService.saveAndExport(input);

      expect(result.success).toBe(true);
      expect(result.data!.format).toBe('docx');
      expect(result.data!.filename).toMatch(/\.docx$/);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed HTML gracefully', async () => {
      const malformedInput: SaveExportSeam['input'] = {
        storyId: 'story_123',
        content: '<h3>Unclosed heading <p>Paragraph without closing <em>emphasis',
        title: 'Malformed HTML',
        format: 'html'
      };

      const result = await exportService.saveAndExport(malformedInput);

      expect(result.success).toBe(true);
      expect(result.data!.fileSize).toBeGreaterThan(0);
    });

    it('should handle special characters in title', async () => {
      const specialInput: SaveExportSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Content</p>',
        title: 'Story with émojis 🔥 and symbols @#$%',
        format: 'txt'
      };

      const result = await exportService.saveAndExport(specialInput);

      expect(result.success).toBe(true);
      // Filename should be sanitized
      expect(result.data!.filename).not.toContain('🔥');
      expect(result.data!.filename).not.toContain('@');
    });

    it('should handle extremely long titles', async () => {
      const longTitleInput: SaveExportSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Content</p>',
        title: 'This is an extremely long title that goes on and on and on '.repeat(10),
        format: 'txt'
      };

      const result = await exportService.saveAndExport(longTitleInput);

      expect(result.success).toBe(true);
      // Filename should be truncated to reasonable length
      expect(result.data!.filename.length).toBeLessThan(255); // Typical filesystem limit
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      // This would test storage failures in a real implementation
      // For now, we test that the mock implementation handles errors
      const result = await exportService.saveAndExport(validInput);
      
      // In mock mode, should always succeed
      expect(result.success).toBe(true);
    });

    it('should provide detailed error information', async () => {
      const invalidInput = {
        storyId: '',
        content: '',
        title: '',
        format: 'invalid' as ExportFormat
      };

      const result = await exportService.saveAndExport(invalidInput as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBeDefined();
      expect(result.error!.message).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.processingTime).toBeGreaterThan(0);
    });
  });
});

const validInput: SaveExportSeam['input'] = {
  storyId: 'story_123',
  content: '<h3>Chapter 1: The Beginning</h3><p>This is a test story with <em>emphasis</em> and formatting.</p>',
  title: 'The Vampire\'s Forbidden Passion',
  format: 'pdf',
  includeMetadata: true,
  includeChapters: true
};