// Created: 2025-10-31 06:28
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, SecurityContext, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  ChapterBatchSize,
  CreatureArchetype,
  GeneratedChapter,
  EvaluationCriteria,
  SpicyLevel,
  StoryGenerationSeam,
  StoryIterationPayload,
  ThemeSeed,
  WordBudget
} from '../contracts';
import { StoryService } from '../story.service';
import { GenerationLogic, GenerationLogicService } from './generation-logic.service';
import { PromptEvaluationService } from './prompt-evaluation.service';
import { PromptTemplate, PromptTemplatesService } from './prompt-templates.service';

interface TestConfiguration {
  creature: CreatureArchetype;
  themes: ThemeSeed[];
  spicyLevel: SpicyLevel;
  wordCount: WordBudget;
  userInput: string;
  promptTemplate: PromptTemplate;
  promptPreview: {
    system: string;
    user: string;
  };
}

interface TestResult {
  id: string;
  timestamp: Date;
  configuration: TestConfiguration;
  generatedStory: string;
  generationTime: number;
  chapterCount: number;
  totalWordCount: number;
  aiEvaluation?: EvaluationCriteria;
}

type StoredTestResult = Omit<TestResult, 'timestamp'> & { timestamp: string };

@Component({
  selector: 'app-proving-grounds',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './proving-grounds.html',
  styleUrl: './proving-grounds.css',
  standalone: true
})
export class ProvingGroundsComponent implements OnInit {
  private readonly storyService = inject(StoryService);
  private readonly promptTemplatesService = inject(PromptTemplatesService);
  private readonly evaluationService = inject(PromptEvaluationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly generationLogicService = inject(GenerationLogicService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private idSequence = 0;

  readonly isGenerating = signal(false);
  readonly isEvaluating = signal(false);
  readonly currentTest = signal<TestResult | null>(null);
  readonly testHistory = signal<TestResult[]>([]);
  readonly selectedPromptTemplate = signal<PromptTemplate | null>(null);
  readonly comparisonMode = signal(false);
  readonly selectedComparisons = signal<TestResult[]>([]);
  readonly currentGenerationLogic = signal<GenerationLogic | null>(null);

  creature: CreatureArchetype = 'vampire';
  selectedThemeIds: string[] = ['forbidden_love', 'obsession'];
  spicyLevel: SpicyLevel = 3;
  wordCount: WordBudget = 900;
  chapterBatchSize: ChapterBatchSize = 1;
  userInput = '';

  customSystemPrompt = '';
  customUserPrompt = '';
  useCustomPrompts = false;
  showGenerationLogic = false;
  statusMessage = 'Configure a prompt test and generate a Story Lab sample.';

  readonly creatureOptions: CreatureArchetype[] = [
    'vampire',
    'werewolf',
    'fairy',
    'siren',
    'djinn',
    'witch',
    'dragon',
    'demon',
    'angel',
    'mermaid'
  ];
  readonly themeOptions: ThemeSeed[] = [
    { id: 'betrayal', label: 'Betrayal', description: 'Trust becomes leverage.' },
    { id: 'obsession', label: 'Obsession', description: 'Desire narrows into fixation.' },
    { id: 'power_dynamics', label: 'Power Dynamics', description: 'Control shifts between rivals.' },
    { id: 'forbidden_love', label: 'Forbidden Love', description: 'Rules make romance dangerous.' },
    { id: 'revenge', label: 'Revenge', description: 'Old wounds drive present choices.' },
    { id: 'manipulation', label: 'Manipulation', description: 'Truth is shaped as a weapon.' },
    { id: 'seduction', label: 'Seduction', description: 'Attraction becomes strategy.' },
    { id: 'dark_secrets', label: 'Dark Secrets', description: 'Hidden history threatens the bond.' },
    { id: 'temptation', label: 'Temptation', description: 'The wrong choice feels inevitable.' },
    { id: 'desire', label: 'Desire', description: 'Longing pushes the scene forward.' }
  ];
  readonly spicyLevelOptions: SpicyLevel[] = [1, 2, 3, 4, 5];
  readonly wordCountOptions: WordBudget[] = [600, 900, 1200, 1500];
  readonly chapterBatchOptions: ChapterBatchSize[] = [1, 2, 3];
  promptTemplates: PromptTemplate[] = [];

  ngOnInit(): void {
    this.promptTemplates = this.promptTemplatesService.getTemplates();
    this.loadTestHistory();

    const defaultTemplate = this.promptTemplates[0];
    if (defaultTemplate) {
      this.selectPromptTemplate(defaultTemplate);
    }
  }

  get selectedThemes(): ThemeSeed[] {
    return this.themeOptions.filter(theme => this.selectedThemeIds.includes(theme.id));
  }

  toggleTheme(theme: ThemeSeed): void {
    if (this.selectedThemeIds.includes(theme.id)) {
      this.selectedThemeIds = this.selectedThemeIds.filter(id => id !== theme.id);
      return;
    }

    this.selectedThemeIds = [...this.selectedThemeIds, theme.id].slice(-3);
  }

  isThemeSelected(theme: ThemeSeed): boolean {
    return this.selectedThemeIds.includes(theme.id);
  }

  selectPromptTemplate(template: PromptTemplate): void {
    this.selectedPromptTemplate.set(template);
    if (!this.useCustomPrompts) {
      this.customSystemPrompt = template.systemPrompt;
      this.customUserPrompt = template.userPromptTemplate;
    }
  }

  getFilledPrompts(): { system: string; user: string } | null {
    const template = this.selectedPromptTemplate();
    if (!template) {
      return null;
    }

    const filled = this.promptTemplatesService.fillTemplate(template, {
      creature: this.creature,
      themes: this.selectedThemes,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount,
      userInput: this.userInput
    });

    if (!this.useCustomPrompts) {
      return filled;
    }

    return {
      system: this.customSystemPrompt || filled.system,
      user: this.promptTemplatesService.fillUserTemplate(this.customUserPrompt || template.userPromptTemplate, {
        creature: this.creature,
        themes: this.selectedThemes,
        spicyLevel: this.spicyLevel,
        wordCount: this.wordCount,
        userInput: this.userInput
      })
    };
  }

  viewPrompts(): void {
    const prompts = this.getFilledPrompts();
    if (!prompts || !this.isBrowser) {
      return;
    }

    globalThis.alert(`SYSTEM PROMPT:\n\n${prompts.system}\n\n${'='.repeat(80)}\n\nUSER PROMPT:\n\n${prompts.user}`);
  }

  sanitizeHtml(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  viewGenerationLogic(): void {
    if (!this.currentGenerationLogic()) {
      this.regenerateLogic();
      return;
    }

    this.showGenerationLogic = !this.showGenerationLogic;
  }

  regenerateLogic(): void {
    this.currentGenerationLogic.set(this.generationLogicService.generateRandomLogic(this.creature));
    this.showGenerationLogic = true;
  }

  generateStory(): void {
    if (this.isGenerating()) {
      return;
    }

    const template = this.selectedPromptTemplate();
    const prompts = this.getFilledPrompts();
    const themes = this.selectedThemes;
    if (!template || !prompts || !themes.length) {
      this.statusMessage = 'Choose a prompt template and at least one theme.';
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage = 'Generating Story Lab sample...';
    const startTime = Date.now();
    const input = this.buildGenerationInput(prompts, themes);

    this.storyService.beginStory(input).subscribe({
      next: result => {
        if (!result.success || !result.data) {
          this.statusMessage = result.error?.message ?? 'Story generation failed.';
          this.isGenerating.set(false);
          return;
        }

        const testResult = this.createTestResult(result.data, template, prompts, Date.now() - startTime);
        this.currentTest.set(testResult);
        this.addToHistory(testResult);
        this.statusMessage = `Generated ${testResult.chapterCount} chapter${testResult.chapterCount === 1 ? '' : 's'} for comparison.`;
        this.isGenerating.set(false);
      },
      error: error => {
        console.error('Error generating story:', error);
        this.statusMessage = 'Story generation failed. Check the debug panel or console for details.';
        this.isGenerating.set(false);
      }
    });
  }

  async evaluateStory(testResult: TestResult): Promise<void> {
    if (this.isEvaluating()) {
      return;
    }

    this.isEvaluating.set(true);

    try {
      const evaluation = await this.evaluationService.evaluateStory({
        storyContent: testResult.generatedStory,
        configuration: {
          creature: testResult.configuration.creature,
          themes: testResult.configuration.themes.map(theme => theme.id),
          spicyLevel: testResult.configuration.spicyLevel,
          wordCount: testResult.configuration.wordCount
        }
      });

      const updated = { ...testResult, aiEvaluation: evaluation };
      this.updateTestInHistory(updated);
      if (this.currentTest()?.id === updated.id) {
        this.currentTest.set(updated);
      }
      this.selectedComparisons.set(this.selectedComparisons().map(test => test.id === updated.id ? updated : test));
    } catch (error) {
      console.error('Error evaluating story:', error);
      this.statusMessage = 'Evaluation failed; mock scoring remains available when the API is unavailable.';
    } finally {
      this.isEvaluating.set(false);
    }
  }

  toggleComparison(testResult: TestResult): void {
    const selected = this.selectedComparisons();

    if (selected.some(test => test.id === testResult.id)) {
      this.selectedComparisons.set(selected.filter(test => test.id !== testResult.id));
      return;
    }

    if (selected.length < 3) {
      this.selectedComparisons.set([...selected, testResult]);
    }
  }

  isSelectedForComparison(testResult: TestResult): boolean {
    return this.selectedComparisons().some(test => test.id === testResult.id);
  }

  clearComparisons(): void {
    this.selectedComparisons.set([]);
  }

  exportTestResults(): void {
    if (!this.isBrowser) {
      return;
    }

    const dataStr = JSON.stringify(this.testHistory(), null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `proving-grounds-results-${Date.now()}.json`);
    linkElement.click();
  }

  deleteTest(testId: string): void {
    const history = this.testHistory().filter(test => test.id !== testId);
    this.testHistory.set(history);
    this.saveTestHistory();

    if (this.currentTest()?.id === testId) {
      this.currentTest.set(null);
    }

    this.selectedComparisons.set(this.selectedComparisons().filter(test => test.id !== testId));
  }

  themeSummary(themes: ThemeSeed[]): string {
    return themes.map(theme => theme.label).join(', ');
  }

  private buildGenerationInput(
    prompts: { system: string; user: string },
    themes: ThemeSeed[]
  ): StoryGenerationSeam['input'] {
    const logline = this.userInput.trim()
      || `${this.creature} romance exploring ${themes.map(theme => theme.label.toLowerCase()).join(', ')}`;
    const logic = this.currentGenerationLogic();

    return {
      creature: this.creature,
      themes,
      logline,
      spicyLevel: Number(this.spicyLevel) as SpicyLevel,
      tone: 'dark_romance',
      desiredWordBudget: this.wordCount,
      chapterBatchSize: this.chapterBatchSize,
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'fade_to_black',
        noGoContent: ''
      },
      narrativeDirectives: [
        'PROVING GROUNDS TEST',
        prompts.system,
        prompts.user,
        logic ? this.generationLogicService.summarizeLogic(logic) : ''
      ].filter(Boolean).join('\n\n')
    };
  }

  private createTestResult(
    payload: StoryIterationPayload,
    template: PromptTemplate,
    prompts: { system: string; user: string },
    generationTime: number
  ): TestResult {
    const chapters = payload.batch.chapters;
    return {
      id: this.generateId(),
      timestamp: new Date(),
      configuration: {
        creature: this.creature,
        themes: [...this.selectedThemes],
        spicyLevel: Number(this.spicyLevel) as SpicyLevel,
        wordCount: this.wordCount,
        userInput: this.userInput,
        promptTemplate: template,
        promptPreview: prompts
      },
      generatedStory: this.renderChapters(chapters),
      generationTime,
      chapterCount: chapters.length,
      totalWordCount: payload.batch.totalWordCount
    };
  }

  private renderChapters(chapters: GeneratedChapter[]): string {
    return chapters
      .map(chapter => `<section><h3>${chapter.title}</h3>${chapter.htmlContent}<p><strong>Summary:</strong> ${chapter.summary}</p></section>`)
      .join('\n');
  }

  private generateId(): string {
    return `test_${Date.now()}_${this.idSequence++}`;
  }

  private addToHistory(testResult: TestResult): void {
    this.testHistory.set([testResult, ...this.testHistory()].slice(0, 25));
    this.saveTestHistory();
  }

  private updateTestInHistory(testResult: TestResult): void {
    this.testHistory.set(this.testHistory().map(test => test.id === testResult.id ? testResult : test));
    this.saveTestHistory();
  }

  private saveTestHistory(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.setItem('provingGrounds_testHistory', JSON.stringify(this.testHistory()));
    } catch (error) {
      console.error('Failed to save test history:', error);
    }
  }

  private loadTestHistory(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const saved = localStorage.getItem('provingGrounds_testHistory');
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as StoredTestResult[];
      this.testHistory.set(parsed.map(test => ({
        ...test,
        timestamp: new Date(test.timestamp)
      })));
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  }
}
