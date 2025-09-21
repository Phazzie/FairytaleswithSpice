import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ErrorDisplayComponent } from './error-display/error-display';
import { DebugPanel } from './debug-panel/debug-panel';
import { StoryStateService } from './story-state.service';
import { creatures } from './config/creatures.config';
import { themes } from './config/themes.config';
import { wordCountOptions } from './config/word-count.config';
import { spicyLevelLabels } from './config/spicy-level.config';
import { StoryGenerationSeam } from '@fairytales-with-spice/contracts';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, ErrorDisplayComponent, DebugPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly state = this.storyStateService.state;
  protected readonly creatures = creatures;
  protected readonly themes = themes;
  protected readonly wordCountOptions = wordCountOptions;
  protected readonly spicyLevelLabels = spicyLevelLabels;

  // Form data
  selectedCreature: string = 'vampire';
  selectedThemes: Set<string> = new Set();
  userInput: string = '';
  spicyLevel: number = 3;
  wordCount: number = 900;

  constructor(private storyStateService: StoryStateService) {}

  generateStory() {
    const request: StoryGenerationSeam['input'] = {
      creature: this.selectedCreature as any,
      themes: Array.from(this.selectedThemes) as any,
      userInput: this.userInput,
      spicyLevel: this.spicyLevel as any,
      wordCount: this.wordCount as any
    };
    this.storyStateService.generateStory(request);
  }

  generateNextChapter() {
    this.storyStateService.generateNextChapter();
  }

  convertToAudio() {
    this.storyStateService.convertToAudio();
  }

  saveStory() {
    this.storyStateService.saveStory();
  }

  toggleTheme(theme: string) {
    if (this.selectedThemes.has(theme)) {
      this.selectedThemes.delete(theme);
    } else {
      this.selectedThemes.add(theme);
    }
  }

  isThemeSelected(theme: string): boolean {
    return this.selectedThemes.has(theme);
  }
}
