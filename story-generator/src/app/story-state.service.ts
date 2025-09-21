import { Injectable, signal } from '@angular/core';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam } from '@fairytales-with-spice/contracts';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';

export interface StoryState {
  isGenerating: boolean;
  isConvertingAudio: boolean;
  isSaving: boolean;
  isGeneratingNext: boolean;
  currentStory: string;
  currentStoryId: string;
  currentStoryTitle: string;
  currentChapterCount: number;
  currentStoryThemes: string[];
  currentStorySpicyLevel: number;
  audioProgress: number;
  saveSuccess: boolean;
  audioSuccess: boolean;
  error: any;
}

@Injectable({
  providedIn: 'root'
})
export class StoryStateService {
  private readonly _state = signal<StoryState>({
    isGenerating: false,
    isConvertingAudio: false,
    isSaving: false,
    isGeneratingNext: false,
    currentStory: '',
    currentStoryId: '',
    currentStoryTitle: '',
    currentChapterCount: 0,
    currentStoryThemes: [],
    currentStorySpicyLevel: 3,
    audioProgress: 0,
    saveSuccess: false,
    audioSuccess: false,
    error: null
  });

  public readonly state = this._state.asReadonly();

  constructor(
    private storyService: StoryService,
    private errorLogging: ErrorLoggingService
  ) {}

  generateStory(request: StoryGenerationSeam['input']) {
    this._state.update(s => ({ ...s, isGenerating: true }));
    this.storyService.generateStory(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this._state.update(s => ({
            ...s,
            currentStory: response.data!.content,
            currentStoryId: response.data!.storyId,
            currentStoryTitle: response.data!.title,
            currentChapterCount: 1,
            currentStoryThemes: response.data!.themes,
            currentStorySpicyLevel: response.data!.spicyLevel,
            isGenerating: false
          }));
        } else {
          this.setError(response.error);
        }
      },
      error: (error) => this.setError(error)
    });
  }

  generateNextChapter() {
    this._state.update(s => ({ ...s, isGeneratingNext: true }));
    const request: ChapterContinuationSeam['input'] = {
      storyId: this.state().currentStoryId,
      currentChapterCount: this.state().currentChapterCount,
      existingContent: this.state().currentStory,
      userInput: '',
      maintainTone: true
    };
    this.storyService.generateNextChapter(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this._state.update(s => ({
            ...s,
            currentStory: response.data!.appendedToStory,
            currentChapterCount: response.data!.chapterNumber,
            isGeneratingNext: false
          }));
        } else {
          this.setError(response.error);
        }
      },
      error: (error) => this.setError(error)
    });
  }

  convertToAudio() {
    this._state.update(s => ({ ...s, isConvertingAudio: true }));
    const request: AudioConversionSeam['input'] = {
      storyId: this.state().currentStoryId,
      content: this.state().currentStory,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };
    this.storyService.convertToAudio(request).subscribe({
      next: (response) => {
        if (response.success) {
          this._state.update(s => ({ ...s, isConvertingAudio: false, audioSuccess: true }));
          setTimeout(() => this._state.update(s => ({ ...s, audioSuccess: false })), 3000);
        } else {
          this.setError(response.error);
        }
      },
      error: (error) => this.setError(error)
    });
  }

  saveStory() {
    this._state.update(s => ({ ...s, isSaving: true }));
    const request: SaveExportSeam['input'] = {
      storyId: this.state().currentStoryId,
      content: this.state().currentStory,
      title: this.state().currentStoryTitle,
      format: 'pdf',
      includeMetadata: true,
      includeChapters: true
    };
    this.storyService.saveStory(request).subscribe({
      next: (response) => {
        if (response.success) {
          this._state.update(s => ({ ...s, isSaving: false, saveSuccess: true }));
          setTimeout(() => this._state.update(s => ({ ...s, saveSuccess: false })), 3000);
        } else {
          this.setError(response.error);
        }
      },
      error: (error) => this.setError(error)
    });
  }

  setError(error: any) {
    this._state.update(s => ({ ...s, error, isGenerating: false, isGeneratingNext: false, isConvertingAudio: false, isSaving: false }));
    this.errorLogging.logError(error, 'StoryStateService', 'error');
  }
}
