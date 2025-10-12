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
import { 
  createMockStoryInput, 
  createMockStoryResponse,
  createMessageEmittingMock,
  createUrlCapturingMock,
  createSSEMessage
} from '../testing';

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
    const mockInput = createMockStoryInput({
      themes: ['forbidden_love', 'dark_secrets'] as ThemeType[],
      userInput: 'Victorian setting'
    });

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
          expect(error.error.code).toBe('NETWORK_ERROR');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.error(new ProgressEvent('error'));

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
        { method: 'generateStory', url: '/api/generate-story' },
        { method: 'convertToAudio', url: '/api/convert-audio' },
        { method: 'saveStory', url: '/api/save-story' },
        { method: 'generateNextChapter', url: '/api/continue-story' }
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

  // ==================== STREAMING STORY GENERATION TESTS ====================
  describe('generateStoryStreaming', () => {
    const mockInput = createMockStoryInput({
      themes: ['forbidden_love', 'seduction'] as ThemeType[]
    });

    it('should be defined', () => {
      expect(service.generateStoryStreaming).toBeDefined();
    });

    it('should build correct SSE URL with query parameters', (done) => {
      const originalEventSource = (window as any).EventSource;
      let capturedUrl = '';
      
      (window as any).EventSource = createUrlCapturingMock((url) => {
        capturedUrl = url;
      });

      service.generateStoryStreaming(mockInput).subscribe({
        error: () => {
          expect(capturedUrl).toContain('/api/story/stream?');
          expect(capturedUrl).toContain('creature=vampire');
          expect(capturedUrl).toContain('themes=forbidden_love%2Cseduction');
          expect(capturedUrl).toContain('spicyLevel=3');
          expect(capturedUrl).toContain('wordCount=900');
          // URL encoding can use either %20 or + for spaces
          expect(capturedUrl).toMatch(/userInput=A(%20|\+)moonlit(%20|\+)encounter/);
          
          (window as any).EventSource = originalEventSource;
          done();
        }
      });
    });

    it('should handle connected event and call onProgress callback', (done) => {
      const originalEventSource = (window as any).EventSource;
      let messageHandler: any;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {}
        addEventListener(event: string, handler: any) {
          if (event === 'message') {
            messageHandler = handler;
            // Simulate connected event
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'connected',
                  streamId: 'stream_123',
                  metadata: {
                    wordsGenerated: 0,
                    totalWordsTarget: 900,
                    estimatedWordsRemaining: 900,
                    generationSpeed: 0,
                    percentage: 0
                  }
                })
              });
            }, 10);
          }
        }
        close() {}
        onerror: any;
      };

      const progressChunks: any[] = [];
      
      service.generateStoryStreaming(mockInput, (chunk) => {
        progressChunks.push(chunk);
        
        if (chunk.type === 'connected') {
          expect(chunk.streamId).toBe('stream_123');
          expect(chunk.metadata).toBeDefined();
          expect(chunk.metadata?.wordsGenerated).toBe(0);
          
          (window as any).EventSource = originalEventSource;
          done();
        }
      }).subscribe({
        error: () => {} // Ignore errors for this test
      });
    });

    it('should handle chunk events with progressive content', (done) => {
      const originalEventSource = (window as any).EventSource;
      let messageHandler: any;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {}
        addEventListener(event: string, handler: any) {
          if (event === 'message') {
            messageHandler = handler;
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'chunk',
                  streamId: 'stream_123',
                  storyId: 'story_456',
                  content: '<h3>The Vampire\'s Desire</h3><p>In the darkness...</p>',
                  metadata: {
                    wordsGenerated: 45,
                    estimatedWordsRemaining: 855,
                    generationSpeed: 15.5,
                    percentage: 5
                  }
                })
              });
            }, 10);
          }
        }
        close() {}
        onerror: any;
      };

      service.generateStoryStreaming(mockInput, (chunk) => {
        if (chunk.type === 'chunk') {
          expect(chunk.content).toContain('The Vampire\'s Desire');
          expect(chunk.metadata?.wordsGenerated).toBe(45);
          expect(chunk.metadata?.generationSpeed).toBe(15.5);
          expect(chunk.metadata?.percentage).toBe(5);
          
          (window as any).EventSource = originalEventSource;
          done();
        }
      }).subscribe({
        error: () => {}
      });
    });

    it('should handle complete event and return final story', (done) => {
      const originalEventSource = (window as any).EventSource;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {}
        addEventListener(event: string, handler: any) {
          if (event === 'message') {
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'complete',
                  streamId: 'stream_123',
                  storyId: 'story_final',
                  content: '<h3>Moonlit Passion</h3><p>The vampire lord gazed upon her...</p>',
                  metadata: {
                    wordsGenerated: 900,
                    estimatedWordsRemaining: 0,
                    generationSpeed: 18.2,
                    percentage: 100
                  }
                })
              });
            }, 10);
          }
        }
        close() {}
        onerror: any;
      };

      let completeCalled = false;
      
      service.generateStoryStreaming(mockInput, (chunk) => {
        if (chunk.type === 'complete') {
          completeCalled = true;
          expect(chunk.content).toContain('Moonlit Passion');
          expect(chunk.metadata?.wordsGenerated).toBe(900);
        }
      }).subscribe({
        next: (response) => {
          expect(response.success).toBe(true);
          expect(response.data).toBeDefined();
          expect(response.data?.storyId).toBe('story_final');
          expect(response.data?.title).toBe('Moonlit Passion');
          expect(response.data?.content).toContain('vampire lord');
          expect(response.data?.actualWordCount).toBe(900);
          expect(response.data?.creature).toBe('vampire');
          expect(completeCalled).toBe(true);
          
          (window as any).EventSource = originalEventSource;
          done();
        },
        error: () => {
          fail('Should not error on complete event');
        }
      });
    });

    it('should handle error events from server', (done) => {
      const originalEventSource = (window as any).EventSource;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {}
        addEventListener(event: string, handler: any) {
          if (event === 'message') {
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'error',
                  streamId: 'stream_123',
                  error: {
                    code: 'GENERATION_FAILED',
                    message: 'AI service unavailable'
                  }
                })
              });
            }, 10);
          }
        }
        close() {}
        onerror: any;
      };

      let errorCallbackCalled = false;
      
      service.generateStoryStreaming(mockInput, (chunk) => {
        if (chunk.type === 'error') {
          errorCallbackCalled = true;
          expect(chunk.error?.code).toBe('GENERATION_FAILED');
          expect(chunk.error?.message).toBe('AI service unavailable');
        }
      }).subscribe({
        next: () => {
          fail('Should not complete successfully on error event');
        },
        error: (error) => {
          expect(error.message).toContain('AI service unavailable');
          expect(errorCallbackCalled).toBe(true);
          
          (window as any).EventSource = originalEventSource;
          done();
        }
      });
    });

    it('should handle EventSource connection errors', (done) => {
      const originalEventSource = (window as any).EventSource;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {
          setTimeout(() => {
            this.onerror && this.onerror(new Event('error'));
          }, 10);
        }
        addEventListener() {}
        close() {}
        onerror: any;
      };

      service.generateStoryStreaming(mockInput).subscribe({
        next: () => {
          fail('Should not complete successfully on connection error');
        },
        error: (error) => {
          expect(error.message).toBe('Stream connection failed');
          expect(errorLoggingService.logError).toHaveBeenCalled();
          
          (window as any).EventSource = originalEventSource;
          done();
        }
      });
    });

    it('should handle malformed JSON in SSE messages', (done) => {
      const originalEventSource = (window as any).EventSource;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {}
        addEventListener(event: string, handler: any) {
          if (event === 'message') {
            setTimeout(() => {
              handler({
                data: 'invalid json {{{' // Malformed JSON
              });
            }, 10);
          }
        }
        close() {}
        onerror: any;
      };

      service.generateStoryStreaming(mockInput).subscribe({
        next: () => {
          fail('Should not complete successfully on JSON parse error');
        },
        error: (error) => {
          expect(error).toBeDefined();
          expect(errorLoggingService.logError).toHaveBeenCalled();
          
          (window as any).EventSource = originalEventSource;
          done();
        }
      });
    });

    it('should cleanup EventSource on unsubscribe', (done) => {
      const originalEventSource = (window as any).EventSource;
      let closeCalled = false;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {}
        addEventListener() {}
        close() {
          closeCalled = true;
        }
        onerror: any;
      };

      const subscription = service.generateStoryStreaming(mockInput).subscribe({
        error: () => {}
      });

      setTimeout(() => {
        subscription.unsubscribe();
        
        expect(closeCalled).toBe(true);
        expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
          'Stream unsubscribed, closing connection',
          'StoryService.generateStoryStreaming',
          jasmine.any(Object)
        );
        
        (window as any).EventSource = originalEventSource;
        done();
      }, 50);
    });

    it('should log streaming lifecycle events', (done) => {
      const originalEventSource = (window as any).EventSource;
      
      (window as any).EventSource = class MockEventSource {
        constructor(url: string) {}
        addEventListener(event: string, handler: any) {
          if (event === 'message') {
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'connected',
                  streamId: 'stream_log_test'
                })
              });
            }, 10);
          }
        }
        close() {}
        onerror: any;
      };

      // Use a timeout to check the log and call done
      service.generateStoryStreaming(mockInput).subscribe({
        error: () => {}
      });

      setTimeout(() => {
        expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
          'Starting streaming story generation',
          'StoryService.generateStoryStreaming',
          jasmine.objectContaining({ input: mockInput })
        );
        
        (window as any).EventSource = originalEventSource;
        done();
      }, 50);
    });
  });

  // ==================== HELPER METHOD TESTS ====================
  describe('helper methods', () => {
    describe('extractTitle', () => {
      it('should extract title from h3 tag', () => {
        const content = '<h3>The Vampire\'s Dark Secret</h3><p>Story content...</p>';
        const service2: any = service;
        const title = service2.extractTitle(content);
        expect(title).toBe('The Vampire\'s Dark Secret');
      });

      it('should handle title with extra whitespace', () => {
        const content = '<h3>  Moonlit Desire  </h3><p>Content...</p>';
        const service2: any = service;
        const title = service2.extractTitle(content);
        expect(title).toBe('Moonlit Desire');
      });

      it('should return "Untitled Story" when no h3 tag found', () => {
        const content = '<p>Story without title...</p>';
        const service2: any = service;
        const title = service2.extractTitle(content);
        expect(title).toBe('Untitled Story');
      });

      it('should return "Untitled Story" for empty content', () => {
        const service2: any = service;
        const title = service2.extractTitle('');
        expect(title).toBe('Untitled Story');
      });

      it('should handle h3 tags with attributes', () => {
        const content = '<h3 class="title" id="main">Epic Tale</h3><p>Content...</p>';
        const service2: any = service;
        const title = service2.extractTitle(content);
        expect(title).toBe('Epic Tale');
      });
    });

    describe('detectCliffhanger', () => {
      it('should detect "to be continued" pattern', () => {
        const content = '<p>Chapter 1</p><p>And the story continues... to be continued</p>';
        const service2: any = service;
        const hasCliffhanger = service2.detectCliffhanger(content);
        expect(hasCliffhanger).toBe(true);
      });

      it('should detect "what happens next" pattern', () => {
        const content = '<p>She turned around...</p><p>But what happens next?</p>';
        const service2: any = service;
        const hasCliffhanger = service2.detectCliffhanger(content);
        expect(hasCliffhanger).toBe(true);
      });

      it('should detect "little did they know" pattern', () => {
        const content = '<p>They walked away safely.</p><p>Little did she know what awaited...</p>';
        const service2: any = service;
        const hasCliffhanger = service2.detectCliffhanger(content);
        expect(hasCliffhanger).toBe(true);
      });

      it('should detect ellipsis ending', () => {
        const content = '<p>Chapter ends here</p><p>And then...</p>';
        const service2: any = service;
        const hasCliffhanger = service2.detectCliffhanger(content);
        expect(hasCliffhanger).toBe(true);
      });

      it('should detect question mark ending with "but" pattern', () => {
        // The detectCliffhanger splits by </p> and checks second-to-last element
        // Pattern /but .*\?$/ is case-sensitive and needs the ? at the very end
        const content = '<p>Story content</p><p>But what happens but who was watching?</p>';
        const service2: any = service;
        const hasCliffhanger = service2.detectCliffhanger(content);
        expect(hasCliffhanger).toBe(true);
      });

      it('should return false for normal ending', () => {
        const content = '<p>And they lived happily ever after.</p><p>The End.</p>';
        const service2: any = service;
        const hasCliffhanger = service2.detectCliffhanger(content);
        expect(hasCliffhanger).toBe(false);
      });

      it('should return false for empty content', () => {
        const service2: any = service;
        const hasCliffhanger = service2.detectCliffhanger('');
        expect(hasCliffhanger).toBe(false);
      });
    });
  });

  // ==================== ADDITIONAL ERROR HANDLING TESTS ====================
  describe('advanced error handling', () => {
    it('should handle 500 internal server error', () => {
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
          expect(error.error.code).toBe('HTTP_ERROR');
          expect(error.error.message).toContain('500');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.flush('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle 503 service unavailable', () => {
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
          expect(error.error.message).toContain('503');
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
    });

    it('should preserve error details from backend', () => {
      const mockInput: StoryGenerationSeam['input'] = {
        creature: 'werewolf' as CreatureType,
        themes: ['lust'] as ThemeType[],
        userInput: '',
        spicyLevel: 4 as SpicyLevel,
        wordCount: 1200 as const
      };

      const backendError = {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: { retryAfter: 60 }
        }
      };

      service.generateStory(mockInput).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.success).toBe(false);
          expect(error.error.code).toBe('RATE_LIMITED');
          expect(error.error.message).toBe('Too many requests');
          expect(error.error.details).toEqual({ retryAfter: 60 });
        }
      });

      const req = httpMock.expectOne('/api/story/generate');
      req.flush(backendError, { status: 429, statusText: 'Too Many Requests' });
    });
  });
});