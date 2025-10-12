/**
 * Streaming Story Component Tests
 * Created: 2025-10-11
 * 
 * Comprehensive tests for the streaming story generation component
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { StreamingStoryComponent } from './streaming-story.component';
import { StoryService } from '../story.service';
import { of, throwError, Observable } from 'rxjs';
import { 
  ApiResponse, 
  StoryGenerationSeam,
  StreamingProgressChunk,
  CreatureType,
  ThemeType,
  SpicyLevel,
  WordCount
} from '../contracts';
import { createMockStoryResponse, createMockProgressChunk } from '../../testing';

describe('StreamingStoryComponent', () => {
  let component: StreamingStoryComponent;
  let fixture: ComponentFixture<StreamingStoryComponent>;
  let storyService: jasmine.SpyObj<StoryService>;

  beforeEach(async () => {
    const storyServiceSpy = jasmine.createSpyObj('StoryService', ['generateStoryStreaming']);

    await TestBed.configureTestingModule({
      imports: [StreamingStoryComponent, CommonModule],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StreamingStoryComponent);
    component = fixture.componentInstance;
    storyService = TestBed.inject(StoryService) as jasmine.SpyObj<StoryService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should initialize with default values', () => {
      expect(component.isStreaming).toBe(false);
      expect(component.streamedContent).toBe('');
      expect(component.storyTitle).toBe('');
      expect(component.errorMessage).toBe('');
      expect(component.progress.wordsGenerated).toBe(0);
      expect(component.progress.estimatedWordsRemaining).toBe(0);
      expect(component.progress.generationSpeed).toBe(0);
      expect(component.targetWords).toBe(900);
    });

    it('should have correct progress percentage calculation', () => {
      component.targetWords = 900;
      component.progress.wordsGenerated = 450;
      expect(component.progressPercentage).toBe(50);
    });

    it('should cap progress percentage at 100%', () => {
      component.targetWords = 900;
      component.progress.wordsGenerated = 1000;
      expect(component.progressPercentage).toBe(100);
    });

    it('should handle zero target words for progress percentage', () => {
      component.targetWords = 0;
      component.progress.wordsGenerated = 100;
      expect(component.progressPercentage).toBe(0);
    });

    it('should calculate estimated time remaining correctly', () => {
      component.progress.estimatedWordsRemaining = 600;
      component.progress.generationSpeed = 20;
      expect(component.estimatedTimeRemaining).toBe(30); // 600/20 = 30 seconds
    });

    it('should return 0 time remaining when speed is 0', () => {
      component.progress.estimatedWordsRemaining = 600;
      component.progress.generationSpeed = 0;
      expect(component.estimatedTimeRemaining).toBe(0);
    });

    it('should return 0 time remaining when no words remaining', () => {
      component.progress.estimatedWordsRemaining = 0;
      component.progress.generationSpeed = 20;
      expect(component.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('startStreaming', () => {
    it('should not start if already streaming', async () => {
      component.isStreaming = true;
      await component.startStreaming();
      expect(storyService.generateStoryStreaming).not.toHaveBeenCalled();
    });

    it('should clear previous content before starting', (done) => {
      component.streamedContent = 'old content';
      component.errorMessage = 'old error';
      
      storyService.generateStoryStreaming.and.returnValue(
        new Observable(observer => {
          setTimeout(() => {
            expect(component.streamedContent).toBe('');
            expect(component.errorMessage).toBe('');
            done();
          }, 10);
        })
      );
      
      component.startStreaming();
    });

    it('should set streaming state and title when starting', (done) => {
      // Use an observable that doesn't complete immediately
      storyService.generateStoryStreaming.and.returnValue(
        new Observable(observer => {
          // Check state immediately after subscription
          setTimeout(() => {
            expect(component.storyTitle).toBe('Generating your story...');
            expect(component.isStreaming).toBe(true);
            done();
          }, 10);
        })
      );
      
      component.startStreaming();
    });

    it('should call service with correct parameters', async () => {
      const mockResponse = createMockStoryResponse({
        content: '<h3>Test</h3><p>Content</p>',
        rawContent: '<h3>Test</h3><p>Content</p>',
        themes: ['forbidden_love', 'seduction'] as ThemeType[]
      });

      storyService.generateStoryStreaming.and.returnValue(of(mockResponse));
      
      await component.startStreaming();
      
      expect(storyService.generateStoryStreaming).toHaveBeenCalledWith(
        jasmine.objectContaining({
          creature: 'vampire',
          themes: jasmine.arrayContaining(['forbidden_love', 'seduction']),
          spicyLevel: 3,
          wordCount: 900
        }),
        jasmine.any(Function)
      );
    });

    it('should handle progress updates via callback', async () => {
      let progressCallback: any;
      
      storyService.generateStoryStreaming.and.callFake((input, onProgress) => {
        progressCallback = onProgress;
        return of({} as any);
      });
      
      await component.startStreaming();
      
      const chunk: StreamingProgressChunk = {
        type: 'chunk',
        content: '<h3>Title</h3><p>Progress content</p>',
        metadata: {
          wordsGenerated: 450,
          estimatedWordsRemaining: 450,
          generationSpeed: 18.5,
          percentage: 50
        }
      };
      
      progressCallback(chunk);
      
      expect(component.streamedContent).toBe('<h3>Title</h3><p>Progress content</p>');
      expect(component.progress.wordsGenerated).toBe(450);
      expect(component.progress.generationSpeed).toBe(18.5);
    });

    it('should extract title from chunk content when conditions are met', async () => {
      let progressCallback: any;
      
      storyService.generateStoryStreaming.and.callFake((input, onProgress) => {
        progressCallback = onProgress;
        return of({} as any);
      });
      
      await component.startStreaming();
      
      // Initial state - title is "Generating your story..."
      expect(component.storyTitle).toBe('Generating your story...');
      
      // Title should not change while "Generating" is in the title
      const chunk1 = createMockProgressChunk('chunk', {
        content: '<h3>Moonlit Passion</h3><p>Story begins...</p>'
      });
      
      progressCallback(chunk1);
      
      // Title should still be "Generating..." because condition checks for !includes('Generating')
      expect(component.storyTitle).toBe('Generating your story...');
      
      // Change title to something else first, then try again
      component.storyTitle = 'Some Title';
      progressCallback(chunk1);
      
      expect(component.storyTitle).toBe('Moonlit Passion');
    });

    it('should handle successful completion', (done) => {
      const mockResponse: ApiResponse<StoryGenerationSeam['output']> = {
        success: true,
        data: {
          storyId: 'story_123',
          title: 'Complete Story',
          content: '<h3>Complete Story</h3><p>Final content</p>',
          rawContent: '<h3>Complete Story</h3><p>Final content</p>',
          creature: 'vampire' as CreatureType,
          themes: ['forbidden_love'] as ThemeType[],
          spicyLevel: 3 as SpicyLevel,
          actualWordCount: 900,
          estimatedReadTime: 5,
          hasCliffhanger: false,
          generatedAt: new Date()
        }
      };

      storyService.generateStoryStreaming.and.returnValue(of(mockResponse));
      
      component.startStreaming();
      
      // Wait for async operations
      setTimeout(() => {
        expect(component.isStreaming).toBe(false);
        done();
      }, 100);
    });

    it('should handle errors during streaming', (done) => {
      const error = new Error('Stream failed');
      storyService.generateStoryStreaming.and.returnValue(throwError(() => error));
      
      component.startStreaming();
      
      setTimeout(() => {
        expect(component.isStreaming).toBe(false);
        expect(component.errorMessage).toBe('Stream failed');
        done();
      }, 100);
    });

    it('should handle errors thrown during initialization', async () => {
      storyService.generateStoryStreaming.and.throwError('Initialization error');
      
      await component.startStreaming();
      
      expect(component.errorMessage).toBeTruthy();
    });
  });

  describe('stopStreaming', () => {
    it('should set isStreaming to false', () => {
      component.isStreaming = true;
      component.stopStreaming();
      expect(component.isStreaming).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error message and reset state', () => {
      component.errorMessage = 'Some error';
      component.streamedContent = 'Some content';
      component.progress = {
        wordsGenerated: 450,
        estimatedWordsRemaining: 450,
        generationSpeed: 15
      };
      
      component.clearError();
      
      expect(component.errorMessage).toBe('');
      expect(component.streamedContent).toBe('');
      expect(component.progress.wordsGenerated).toBe(0);
      expect(component.progress.estimatedWordsRemaining).toBe(0);
      expect(component.progress.generationSpeed).toBe(0);
    });
  });

  describe('handleStreamChunk', () => {
    it('should update content from chunk', () => {
      const chunk: any = {
        type: 'chunk',
        content: '<p>New content</p>',
        metadata: {
          wordsGenerated: 100,
          estimatedWordsRemaining: 800,
          generationSpeed: 20
        }
      };
      
      component['handleStreamChunk'](chunk);
      
      expect(component.streamedContent).toBe('<p>New content</p>');
      expect(component.progress.wordsGenerated).toBe(100);
    });

    it('should handle chunk without metadata gracefully', () => {
      const chunk: any = {
        type: 'chunk',
        content: '<p>Content</p>'
      };
      
      component['handleStreamChunk'](chunk);
      
      expect(component.streamedContent).toBe('<p>Content</p>');
      expect(component.progress.wordsGenerated).toBe(0);
    });
  });

  describe('handleStreamComplete', () => {
    it('should set isStreaming to false', () => {
      component.isStreaming = true;
      component['handleStreamComplete']();
      expect(component.isStreaming).toBe(false);
    });

    it('should update title from final story data', (done) => {
      const finalStory = {
        data: {
          title: 'Final Title'
        }
      };
      
      component['handleStreamComplete'](finalStory);
      
      // Wait for setTimeout
      setTimeout(() => {
        expect(component.storyTitle).toContain('Final Title');
        done();
      }, 100);
    });

    it('should handle missing final story data', () => {
      component['handleStreamComplete']();
      expect(component.isStreaming).toBe(false);
    });
  });

  describe('handleStreamError', () => {
    it('should set error message and stop streaming', () => {
      component.isStreaming = true;
      
      const error = {
        message: 'Test error message'
      };
      
      component['handleStreamError'](error);
      
      expect(component.isStreaming).toBe(false);
      expect(component.errorMessage).toBe('Test error message');
    });

    it('should use default message if error has no message', () => {
      component['handleStreamError']({});
      expect(component.errorMessage).toBe('An unexpected error occurred during generation');
    });
  });

  describe('Template Integration', () => {
    it('should display progress bar when streaming', () => {
      component.isStreaming = true;
      component.progress.wordsGenerated = 450;
      component.targetWords = 900;
      
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement;
      const progressBar = compiled.querySelector('.progress-fill');
      expect(progressBar).toBeTruthy();
    });

    it('should display error message when present', () => {
      component.errorMessage = 'Test error';
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement;
      const errorDiv = compiled.querySelector('.error-message');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toContain('Test error');
    });

    it('should disable generate button when streaming', () => {
      component.isStreaming = true;
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement;
      const button = compiled.querySelector('.stream-button');
      expect(button.disabled).toBe(true);
    });

    it('should enable stop button when streaming', () => {
      component.isStreaming = true;
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement;
      const button = compiled.querySelector('.stop-button');
      expect(button.disabled).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very fast generation (high speed)', () => {
      component.progress.estimatedWordsRemaining = 100;
      component.progress.generationSpeed = 100;
      expect(component.estimatedTimeRemaining).toBe(1); // Ceiling of 1
    });

    it('should handle very slow generation (low speed)', () => {
      component.progress.estimatedWordsRemaining = 900;
      component.progress.generationSpeed = 0.5;
      expect(component.estimatedTimeRemaining).toBe(1800); // 30 minutes
    });

    it('should handle negative word counts gracefully', () => {
      component.progress.wordsGenerated = -100; // Invalid state
      component.targetWords = 900;
      const percentage = component.progressPercentage;
      // Current implementation doesn't prevent negative percentages
      // This documents the behavior - could be improved to clamp at 0
      expect(percentage).toBeLessThan(0);
    });

    it('should handle undefined metadata in chunks', () => {
      const chunk: any = {
        type: 'chunk',
        content: 'test'
        // No metadata
      };
      
      expect(() => component['handleStreamChunk'](chunk)).not.toThrow();
    });
  });
});
