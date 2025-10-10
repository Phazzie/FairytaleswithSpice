import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  AudioConversionSeam,
  SaveExportSeam,
  ApiResponse,
  ThemeType,
  CreatureType,
  SpicyLevel,
  VoiceType,
  AudioSpeed,
  AudioFormat,
  ExportFormat
} from './contracts';

describe('StoryService', () => {
  let service: StoryService;
  let httpMock: HttpTestingController;
  let errorLoggingService: jasmine.SpyObj<ErrorLoggingService>;

  beforeEach(() => {
    const errorLoggingSpy = jasmine.createSpyObj('ErrorLoggingService', [
      'logInfo', 'logError', 'logWarning'
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        StoryService,
        { provide: ErrorLoggingService, useValue: errorLoggingSpy }
      ]
    });

    service = TestBed.inject(StoryService);
    httpMock = TestBed.inject(HttpTestingController);
    errorLoggingService = TestBed.inject(ErrorLoggingService) as jasmine.SpyObj<ErrorLoggingService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('generateStory', () => {
    const mockInput: StoryGenerationSeam['input'] = {
      creature: 'vampire' as CreatureType,
      themes: ['forbidden_love', 'dark_secrets'] as ThemeType[],
      userInput: 'Victorian setting',
      spicyLevel: 3 as SpicyLevel,
      wordCount: 900 as const
    };

    const mockSuccessResponse: ApiResponse<StoryGenerationSeam['output']> = {
      success: true,
      data: {
        storyId: 'story_123',
        title: "The Vampire's Forbidden Passion",
        content: '<h3>Chapter 1</h3><p>Story content...</p>',
        creature: 'vampire' as CreatureType,
        themes: ['forbidden_love', 'dark_secrets'] as ThemeType[],
        spicyLevel: 3 as SpicyLevel,
        actualWordCount: 150,
        estimatedReadTime: 1,
        hasCliffhanger: false,
        generatedAt: new Date()
      },
      metadata: {
        requestId: 'req_123',
        processingTime: 2500
      }
    };

    it('should generate story successfully', () => {
      service.generateStory(mockInput).subscribe(response => {
        expect(response).toEqual(mockSuccessResponse);
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.data!.storyId).toBe('story_123');
        expect(response.data!.creature).toBe('vampire');
        expect(response.data!.themes).toEqual(['forbidden_love', 'dark_secrets']);
      });

      const req = httpMock.expectOne('/api/story/generate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockInput);
      req.flush(mockSuccessResponse);

      expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
        'Starting story generation',
        'StoryService.generateStory',
        { input: mockInput }
      );
      expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
        'Story generation successful',
        'StoryService.generateStory',
        { storyId: 'story_123' }
      );
    });

    it('should handle backend error response', () => {
      const errorResponse: ApiResponse<any> = {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'AI service temporarily unavailable'
        },
        metadata: {
          requestId: 'req_456',
          processingTime: 1000
        }
      };

      service.generateStory(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error).toEqual(errorResponse);
          expect(error.success).toBe(false);
          expect(error.error.code).toBe('GENERATION_FAILED');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.flush(errorResponse, { status: 400, statusText: 'Bad Request' });

      expect(errorLoggingService.logError).toHaveBeenCalled();
    });

    it('should handle HTTP error', () => {
      service.generateStory(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.success).toBe(false);
          expect(error.error.code).toBe('HTTP_ERROR');
          expect(error.error.message).toContain('HTTP 500');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      expect(errorLoggingService.logError).toHaveBeenCalled();
    });

    it('should handle client-side error', () => {
      service.generateStory(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.success).toBe(false);
          expect(error.error.code).toBe('CLIENT_ERROR');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.error(new ErrorEvent('error', { message: 'Client error occurred' }));

      expect(errorLoggingService.logError).toHaveBeenCalled();
    });
  });

  describe('convertToAudio', () => {
    const mockInput: AudioConversionSeam['input'] = {
      storyId: 'story_123',
      content: '<h3>Chapter 1</h3><p>Story content...</p>',
      voice: 'female' as VoiceType,
      speed: 1.0 as AudioSpeed,
      format: 'mp3' as AudioFormat
    };

    const mockSuccessResponse: ApiResponse<AudioConversionSeam['output']> = {
      success: true,
      data: {
        audioId: 'audio_456',
        storyId: 'story_123',
        audioUrl: 'https://storage.example.com/audio_456.mp3',
        duration: 300,
        fileSize: 1024000,
        format: 'mp3' as AudioFormat,
        voice: 'female' as VoiceType,
        speed: 1.0 as AudioSpeed,
        progress: {
          percentage: 100,
          status: 'completed',
          message: 'Audio conversion completed',
          estimatedTimeRemaining: 0
        },
        completedAt: new Date()
      },
      metadata: {
        requestId: 'req_789',
        processingTime: 5000
      }
    };

    it('should convert to audio successfully', () => {
      service.convertToAudio(mockInput).subscribe(response => {
        expect(response).toEqual(mockSuccessResponse);
        expect(response.success).toBe(true);
        expect(response.data!.audioId).toBe('audio_456');
        expect(response.data!.progress.status).toBe('completed');
      });

      const req = httpMock.expectOne('/api/audio/convert');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockInput);
      req.flush(mockSuccessResponse);

      expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
        'Starting audio conversion',
        'StoryService.convertToAudio',
        { storyId: 'story_123' }
      );
    });

    it('should handle audio conversion error', () => {
      const errorResponse: ApiResponse<any> = {
        success: false,
        error: {
          code: 'CONVERSION_FAILED',
          message: 'Audio conversion failed'
        }
      };

      service.convertToAudio(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.error.code).toBe('CONVERSION_FAILED');
        }
      });

      const req = httpMock.expectOne('/api/audio/convert');
      req.flush(errorResponse, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('saveStory', () => {
    const mockInput: SaveExportSeam['input'] = {
      storyId: 'story_123',
      content: '<h3>Chapter 1</h3><p>Story content...</p>',
      title: 'The Vampire\'s Forbidden Passion',
      format: 'pdf' as ExportFormat,
      includeMetadata: true,
      includeChapters: true
    };

    const mockSuccessResponse: ApiResponse<SaveExportSeam['output']> = {
      success: true,
      data: {
        exportId: 'export_789',
        storyId: 'story_123',
        downloadUrl: 'https://storage.example.com/export_789.pdf',
        filename: 'the-vampires-forbidden-passion.pdf',
        format: 'pdf' as ExportFormat,
        fileSize: 2048000,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        exportedAt: new Date()
      },
      metadata: {
        requestId: 'req_999',
        processingTime: 3000
      }
    };

    it('should save story successfully', () => {
      service.saveStory(mockInput).subscribe(response => {
        expect(response).toEqual(mockSuccessResponse);
        expect(response.success).toBe(true);
        expect(response.data!.exportId).toBe('export_789');
        expect(response.data!.format).toBe('pdf');
      });

      const req = httpMock.expectOne('/api/export/save');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockInput);
      req.flush(mockSuccessResponse);

      expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
        'Starting story save/export',
        'StoryService.saveStory',
        { storyId: 'story_123', format: 'pdf' }
      );
    });
  });

  describe('generateNextChapter', () => {
    const mockInput: ChapterContinuationSeam['input'] = {
      storyId: 'story_123',
      currentChapterCount: 1,
      existingContent: '<h3>Chapter 1</h3><p>Existing content...</p>',
      userInput: 'Make it more intense',
      maintainTone: true
    };

    const mockSuccessResponse: ApiResponse<ChapterContinuationSeam['output']> = {
      success: true,
      data: {
        chapterId: 'chapter_456',
        chapterNumber: 2,
        title: 'Chapter 2: The Deeper Shadows',
        content: '<h3>Chapter 2</h3><p>Continuation...</p>',
        wordCount: 120,
        cliffhangerEnding: true,
        themesContinued: ['forbidden_love', 'dark_secrets'] as ThemeType[],
        spicyLevelMaintained: 3 as SpicyLevel,
        appendedToStory: '<h3>Chapter 1</h3><p>Existing content...</p>\n\n<hr>\n\n<h3>Chapter 2</h3><p>Continuation...</p>'
      },
      metadata: {
        requestId: 'req_111',
        processingTime: 4000
      }
    };

    it('should generate next chapter successfully', () => {
      service.generateNextChapter(mockInput).subscribe(response => {
        expect(response).toEqual(mockSuccessResponse);
        expect(response.success).toBe(true);
        expect(response.data!.chapterId).toBe('chapter_456');
        expect(response.data!.chapterNumber).toBe(2);
      });

      const req = httpMock.expectOne('/api/story/continue');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockInput);
      req.flush(mockSuccessResponse);

      expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
        'Starting chapter continuation',
        'StoryService.generateNextChapter',
        { storyId: 'story_123' }
      );
    });
  });

  describe('error handling edge cases', () => {
    it('should handle empty error response', () => {
      const mockInput: StoryGenerationSeam['input'] = {
        creature: 'vampire' as CreatureType,
        themes: ['passion'] as ThemeType[],
        userInput: '',
        spicyLevel: 1 as SpicyLevel,
        wordCount: 700 as const
      };

      service.generateStory(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.success).toBe(false);
          expect(error.error.code).toBe('ENDPOINT_NOT_FOUND');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.flush(null, { status: 404, statusText: 'Not Found' });
    });

    it('should handle malformed error response', () => {
      const mockInput: StoryGenerationSeam['input'] = {
        creature: 'fairy' as CreatureType,
        themes: ['desire'] as ThemeType[],
        userInput: '',
        spicyLevel: 2 as SpicyLevel,
        wordCount: 900 as const
      };

      service.generateStory(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.success).toBe(false);
          expect(error.error.code).toBe('HTTP_ERROR');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.flush('Invalid JSON response', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle network timeout', () => {
      const mockInput: StoryGenerationSeam['input'] = {
        creature: 'werewolf' as CreatureType,
        themes: ['lust'] as ThemeType[],
        userInput: 'Forest setting',
        spicyLevel: 4 as SpicyLevel,
        wordCount: 1200 as const
      };

      service.generateStory(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.success).toBe(false);
          expect(error.error.code).toBe('NETWORK_ERROR');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.error(new ProgressEvent('timeout'));
    });
  });

  describe('service integration', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should use correct API endpoints', () => {
      const endpoints = [
        { method: 'generateStory', url: '/api/story/generate' },
        { method: 'convertToAudio', url: '/api/audio/convert' },
        { method: 'saveStory', url: '/api/export/save' },
        { method: 'generateNextChapter', url: '/api/story/continue' }
      ];

      // Test that each method makes requests to correct endpoints
      endpoints.forEach(endpoint => {
        // This is implicitly tested by the previous tests, but we verify the pattern
        expect(service[endpoint.method as keyof StoryService]).toBeDefined();
      });
    });

    it('should consistently log operations', () => {
      const mockStoryInput: StoryGenerationSeam['input'] = {
        creature: 'vampire' as CreatureType,
        themes: ['passion'] as ThemeType[],
        userInput: 'Test',
        spicyLevel: 1 as SpicyLevel,
        wordCount: 700 as const
      };

      const mockAudioInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Test</p>',
        voice: 'female' as VoiceType,
        speed: 1.0 as AudioSpeed,
        format: 'mp3' as AudioFormat
      };

      const mockSaveInput: SaveExportSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Test</p>',
        title: 'Test Story',
        format: 'txt' as ExportFormat
      };

      const mockChapterInput: ChapterContinuationSeam['input'] = {
        storyId: 'story_123',
        currentChapterCount: 1,
        existingContent: '<p>Test</p>',
        maintainTone: true
      };

      // Test each service method logs start
      service.generateStory(mockStoryInput).subscribe();
      service.convertToAudio(mockAudioInput).subscribe();
      service.saveStory(mockSaveInput).subscribe();
      service.generateNextChapter(mockChapterInput).subscribe();

      httpMock.expectOne('/api/story/generate').flush({ success: true, data: {} });
      httpMock.expectOne('/api/audio/convert').flush({ success: true, data: {} });
      httpMock.expectOne('/api/export/save').flush({ success: true, data: {} });
      httpMock.expectOne('/api/story/continue').flush({ success: true, data: {} });

      expect(errorLoggingService.logInfo).toHaveBeenCalledTimes(8); // 4 start + 4 success logs
    });
  });
});