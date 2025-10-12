import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { App } from './app';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { DebugPanel } from './debug-panel/debug-panel';
import { of, throwError } from 'rxjs';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  AudioConversionSeam,
  SaveExportSeam,
  ApiResponse,
  ThemeType,
  CreatureType,
  SpicyLevel
} from './contracts';
import { createMockStoryResponse } from '../testing';

describe('App', () => {
  let component: App;
  let fixture: any;
  let storyService: jasmine.SpyObj<StoryService>;
  let errorLoggingService: jasmine.SpyObj<ErrorLoggingService>;

  beforeEach(async () => {
    const storyServiceSpy = jasmine.createSpyObj('StoryService', [
      'generateStory', 'generateNextChapter', 'convertToAudio', 'saveStory'
    ]);
    const errorLoggingSpy = jasmine.createSpyObj('ErrorLoggingService', [
      'logInfo', 'logError', 'logWarning', 'logCritical', 'getErrors', 'clearErrors'
    ]);
    // Mock getErrors to return an observable
    errorLoggingSpy.getErrors.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy },
        { provide: ErrorLoggingService, useValue: errorLoggingSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    storyService = TestBed.inject(StoryService) as jasmine.SpyObj<StoryService>;
    errorLoggingService = TestBed.inject(ErrorLoggingService) as jasmine.SpyObj<ErrorLoggingService>;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial default values', () => {
    expect(component.selectedCreature).toBe('vampire');
    expect(component.selectedThemes.size).toBe(0);
    expect(component.userInput).toBe('');
    expect(component.spicyLevel).toBe(3);
    expect(component.wordCount).toBe(900);
    expect(component.isGenerating).toBe(false);
    expect(component.currentStory).toBe('');
    expect(component.currentStoryId).toBe('');
  });

  describe('theme selection', () => {
    it('should toggle themes correctly', () => {
      expect(component.selectedThemes.size).toBe(0);
      
      component.toggleTheme('forbidden_love');
      expect(component.selectedThemes.has('forbidden_love')).toBe(true);
      expect(component.selectedThemes.size).toBe(1);
      
      component.toggleTheme('forbidden_love');
      expect(component.selectedThemes.has('forbidden_love')).toBe(false);
      expect(component.selectedThemes.size).toBe(0);
    });

    it('should not allow more than 5 themes', () => {
      const themes = ['forbidden_love', 'dark_secrets', 'passion', 'desire', 'lust', 'obsession'];
      
      themes.forEach(theme => component.toggleTheme(theme));
      
      expect(component.selectedThemes.size).toBe(5);
      expect(component.canSelectMoreThemes()).toBe(false);
    });

    it('should check theme selection status', () => {
      component.toggleTheme('passion');
      expect(component.isThemeSelected('passion')).toBe(true);
      expect(component.isThemeSelected('desire')).toBe(false);
    });

    it('should return correct selected themes count', () => {
      expect(component.getSelectedThemesCount()).toBe(0);
      component.toggleTheme('passion');
      component.toggleTheme('desire');
      expect(component.getSelectedThemesCount()).toBe(2);
    });
  });

  describe('story generation validation', () => {
    it('should not allow story generation without themes', () => {
      expect(component.canGenerateStory()).toBe(false);
    });

    it('should allow story generation with themes', () => {
      component.toggleTheme('passion');
      expect(component.canGenerateStory()).toBe(true);
    });

    it('should not generate story if canGenerateStory returns false', () => {
      component.generateStory();
      expect(storyService.generateStory).not.toHaveBeenCalled();
    });
  });

  describe('generateStory', () => {
    beforeEach(() => {
      component.toggleTheme('forbidden_love');
      component.toggleTheme('dark_secrets');
    });

    it('should generate story successfully', () => {
      const mockResponse: ApiResponse<StoryGenerationSeam['output']> = {
        success: true,
        data: {
          storyId: 'story_123',
          title: 'Test Story',
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

      storyService.generateStory.and.returnValue(of(mockResponse));

      component.generateStory();

      expect(storyService.generateStory).toHaveBeenCalledWith({
        creature: 'vampire',
        themes: ['forbidden_love', 'dark_secrets'],
        userInput: '',
        spicyLevel: 3,
        wordCount: 900
      });

      // Wait for async operation
      setTimeout(() => {
        expect(component.isGenerating).toBe(false);
        expect(component.currentStory).toBe('<h3>Chapter 1</h3><p>Story content...</p>');
        expect(component.currentStoryId).toBe('story_123');
        expect(component.currentStoryTitle).toBe('Test Story');
        expect(component.currentChapterCount).toBe(1);
        expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
          'Story generation completed successfully',
          'App.generateStory',
          jasmine.objectContaining({ storyId: 'story_123' })
        );
      }, 0);
    });

    it('should handle story generation error', () => {
      const mockError = { success: false, error: { code: 'GENERATION_FAILED', message: 'Test error' } };
      storyService.generateStory.and.returnValue(throwError(() => mockError));

      component.generateStory();

      // Wait for async operation
      setTimeout(() => {
        expect(component.isGenerating).toBe(false);
        expect(errorLoggingService.logError).toHaveBeenCalled();
      }, 0);
    });
  });

  describe('generateNextChapter', () => {
    beforeEach(() => {
      // Setup current story state
      component.currentStoryId = 'story_123';
      component.currentStory = '<h3>Chapter 1</h3><p>Existing content...</p>';
      // Set up chapters array instead of readonly property
      component.chapters = [{
        chapterNumber: 1,
        chapterId: 'chapter_1',
        title: 'Chapter 1',
        content: '<p>Existing content...</p>',
        wordCount: 100,
        generatedAt: new Date(),
        hasAudio: false
      }];
    });

    it('should generate next chapter successfully', () => {
      const mockResponse: ApiResponse<ChapterContinuationSeam['output']> = {
        success: true,
        data: {
          chapterId: 'chapter_456',
          chapterNumber: 2,
          title: 'Chapter 2: Continuation',
          content: '<h3>Chapter 2</h3><p>New content...</p>',
          wordCount: 120,
          cliffhangerEnding: true,
          themesContinued: ['forbidden_love'] as ThemeType[],
          spicyLevelMaintained: 3 as SpicyLevel,
          appendedToStory: '<h3>Chapter 1</h3><p>Existing content...</p><hr><h3>Chapter 2</h3><p>New content...</p>'
        },
        metadata: {
          requestId: 'req_456',
          processingTime: 3000
        }
      };

      storyService.generateNextChapter.and.returnValue(of(mockResponse));

      component.generateNextChapter();

      expect(storyService.generateNextChapter).toHaveBeenCalledWith({
        storyId: 'story_123',
        currentChapterCount: 1,
        existingContent: '<p>Existing content...</p>',
        userInput: '',
        maintainTone: true
      });

      // Wait for async operation
      setTimeout(() => {
        expect(component.isGeneratingNext).toBe(false);
        expect(component.currentStory).toContain('Chapter 2');
        expect(component.currentChapterCount).toBe(2);
      }, 0);
    });

    it('should handle chapter generation error', () => {
      const mockError = { success: false, error: { code: 'CONTINUATION_FAILED', message: 'Test error' } };
      storyService.generateNextChapter.and.returnValue(throwError(() => mockError));

      component.generateNextChapter();

      // Wait for async operation
      setTimeout(() => {
        expect(component.isGeneratingNext).toBe(false);
        expect(errorLoggingService.logError).toHaveBeenCalled();
      }, 0);
    });
  });

  describe('convertToAudio', () => {
    beforeEach(() => {
      component.currentStoryId = 'story_123';
      // Initialize chapters array so currentStory setter works
      component.chapters = [{
        chapterId: 'chapter_1',
        chapterNumber: 1,
        title: 'Chapter 1',
        content: '<h3>Chapter 1</h3><p>Story content...</p>',
        wordCount: 150,
        generatedAt: new Date(),
        hasAudio: false
      }];
      component.currentChapterIndex = 0;
    });

    it('should convert to audio successfully', () => {
      const mockResponse: ApiResponse<AudioConversionSeam['output']> = {
        success: true,
        data: {
          audioId: 'audio_456',
          storyId: 'story_123',
          audioUrl: 'https://storage.example.com/audio_456.mp3',
          duration: 300,
          fileSize: 1024000,
          format: 'mp3',
          voice: 'female',
          speed: 1.0,
          progress: {
            percentage: 100,
            status: 'completed',
            message: 'Audio conversion completed'
          },
          completedAt: new Date()
        },
        metadata: {
          requestId: 'req_789',
          processingTime: 5000
        }
      };

      storyService.convertToAudio.and.returnValue(of(mockResponse));

      component.convertToAudio();

      expect(storyService.convertToAudio).toHaveBeenCalledWith({
        storyId: 'story_123',
        content: '<h3>Chapter 1</h3><p>Story content...</p>',
        voice: 'female',
        speed: 1.0,
        format: 'mp3'
      });

      // Wait for async operation
      setTimeout(() => {
        expect(component.isConvertingAudio).toBe(false);
        expect(component.audioSuccess).toBe(true);
      }, 0);
    });
  });

  describe('saveStory', () => {
    beforeEach(() => {
      component.currentStoryId = 'story_123';
      component.currentStoryTitle = 'Test Story';
      // Initialize chapters array so currentStory setter works
      component.chapters = [{
        chapterId: 'chapter_1',
        chapterNumber: 1,
        title: 'Chapter 1',
        content: '<h3>Chapter 1</h3><p>Story content...</p>',
        wordCount: 150,
        generatedAt: new Date(),
        hasAudio: false
      }];
      component.currentChapterIndex = 0;
    });

    it('should save story successfully', () => {
      const mockResponse: ApiResponse<SaveExportSeam['output']> = {
        success: true,
        data: {
          exportId: 'export_789',
          storyId: 'story_123',
          downloadUrl: 'https://storage.example.com/export_789.pdf',
          filename: 'test-story.pdf',
          format: 'pdf',
          fileSize: 2048000,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          exportedAt: new Date()
        },
        metadata: {
          requestId: 'req_999',
          processingTime: 3000
        }
      };

      storyService.saveStory.and.returnValue(of(mockResponse));

      component.saveStory();

      expect(storyService.saveStory).toHaveBeenCalledWith({
        storyId: 'story_123',
        content: '<h3>Chapter 1</h3><p>Story content...</p>',
        title: 'Test Story',
        format: 'pdf',
        includeMetadata: true,
        includeChapters: true
      });

      // Wait for async operation
      setTimeout(() => {
        expect(component.isSaving).toBe(false);
        expect(component.saveSuccess).toBe(true);
      }, 0);
    });
  });

  describe('utility methods', () => {
    it('should get creature name correctly', () => {
      component.selectedCreature = 'vampire';
      expect(component.getCreatureName()).toBe('Vampire');
      
      component.selectedCreature = 'werewolf';
      expect(component.getCreatureName()).toBe('Werewolf');
      
      component.selectedCreature = 'fairy';
      expect(component.getCreatureName()).toBe('Fairy');
      
      component.selectedCreature = 'unknown';
      expect(component.getCreatureName()).toBe('Creature');
    });

    it('should have trackBy functions for performance', () => {
      const creature = { value: 'vampire', label: '🧛 Vampire' };
      const theme = { value: 'passion', label: '❤️‍🔥 Passion' };
      
      expect(component.trackByCreature(0, creature)).toBe('vampire');
      expect(component.trackByTheme(0, theme)).toBe('passion');
    });
  });

  describe('debug methods', () => {
    it('should test error logging', () => {
      component.testErrorLogging();
      
      expect(errorLoggingService.logInfo).toHaveBeenCalledWith(
        'Demo info message',
        'App.testErrorLogging',
        { action: 'demo_test' }
      );
      expect(errorLoggingService.logWarning).toHaveBeenCalledWith(
        'Demo warning message',
        'App.testErrorLogging',
        { action: 'demo_test' }
      );
      expect(errorLoggingService.logError).toHaveBeenCalled();
      expect(errorLoggingService.logCritical).toHaveBeenCalled();
    });

    it('should simulate HTTP error', () => {
      component.simulateHttpError();
      
      expect(errorLoggingService.logError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          status: 404,
          statusText: 'Not Found',
          message: 'Simulated HTTP 404 error'
        }),
        'App.simulateHttpError',
        'error',
        jasmine.objectContaining({
          type: 'simulated_http_error',
          endpoint: '/api/fake-endpoint'
        })
      );
    });
  });

  describe('form validation and options', () => {
    it('should have correct creature options', () => {
      expect(component.creatures.length).toBe(3);
      expect(component.creatures[0]).toEqual({ value: 'vampire', label: '🧛 Vampire' });
      expect(component.creatures[1]).toEqual({ value: 'werewolf', label: '🐺 Werewolf' });
      expect(component.creatures[2]).toEqual({ value: 'fairy', label: '🧚 Fairy' });
    });

    it('should have correct theme options', () => {
      expect(component.themes.length).toBe(18);
      expect(component.themes.some(t => t.value === 'forbidden_love')).toBe(true);
      expect(component.themes.some(t => t.value === 'passion')).toBe(true);
    });

    it('should have correct word count options', () => {
      expect(component.wordCountOptions.length).toBe(3);
      expect(component.wordCountOptions.map(o => o.value)).toEqual([700, 900, 1200]);
    });

    it('should have spicy level labels', () => {
      expect(component.spicyLevelLabels.length).toBe(5);
      expect(component.spicyLevelLabels[0]).toBe('Mild');
      expect(component.spicyLevelLabels[4]).toBe('Fire 🔥');
    });
  });

  describe('lifecycle methods', () => {
    it('should setup keyboard shortcuts on init', () => {
      spyOn(document, 'addEventListener');
      component.ngOnInit();
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', jasmine.any(Function));
    });

    it('should cleanup on destroy', () => {
      spyOn(document, 'removeEventListener');
      component.ngOnDestroy();
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', jasmine.any(Function));
    });
  });
});
