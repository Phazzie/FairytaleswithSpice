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
  PromptTemplate,
  ProvingGroundsTestResult,
  SpicyLevel,
  StoryGenerationSeam,
  StoryIterationPayload,
  StoredProvingGroundsTestResult,
  ThemeSeed,
  WordBudget
} from '../contracts';
import { StoryService } from '../story.service';
import { GenerationLogic, GenerationLogicService } from './generation-logic.service';
import { PromptEvaluationService } from './prompt-evaluation.service';
import { PromptTemplatesService } from './prompt-templates.service';
import {
  createBrowserHtmlDownloadHost,
  downloadTextDocument
} from '../../../../shared/htmlDocumentDownload';
import {
  STORY_BLUEPRINT_LIMITS,
  describeNarrativeDirectivesOverflow
} from '../../../../shared/storyBlueprintLimits';
import { STORY_LAB_THEME_SEEDS } from '../../../../shared/storyLabThemeSeeds';

type TestResult = ProvingGroundsTestResult;
type StoredTestResult = StoredProvingGroundsTestResult;

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
  /**
   * The thematic seeds the app's own picker offers, so a test here is a test of
   * something a reader can actually generate.
   *
   * This was a thirteenth copy of the theme vocabulary, and it was the other
   * one: ten classic `ThemeType` ids with descriptions written for this page.
   * `app.ts` builds its picker from `STORY_LAB_THEME_SEEDS`, so those twelve
   * seeds are the only themes any request the app makes actually carries, and
   * the two lists overlap on five ids. That left seven of the app's themes —
   * `court_intrigue`, `blood_oaths`, `slow_burn`, `enemies_to_lovers`,
   * `magical_bargain`, `secret_identity`, `forced_proximity` — untestable in the
   * one screen built for testing prompts, while five of the ids this page did
   * offer (`betrayal`, `power_dynamics`, `manipulation`, `seduction`, `desire`)
   * are ones no reader can pick.
   *
   * The five shared ids were the worse half, because they looked right. A seed's
   * `label` and `description` are carried into the generation prompt, not just
   * printed beside a checkbox, so "Dark Secrets / Hidden history threatens the
   * bond." here and "Hidden Secrets / Someone is lying beautifully." in the app
   * are two different prompts under one id — a comparison tool reporting on
   * prose the app would never have asked for, with nothing in the output to say
   * so.
   */
  readonly themeOptions: ThemeSeed[] = STORY_LAB_THEME_SEEDS.map(seed => ({ ...seed }));
  /** The cap the picker enforces, so its label cannot state a different number. */
  readonly maxThemes = STORY_BLUEPRINT_LIMITS.maxThemes;
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

  /**
   * Selecting past the cap drops the oldest choice rather than refusing the new
   * one, which is this page's own behaviour and stays. The cap itself is the
   * blueprint's, read from the shared limits: it was three, against the five the
   * route accepts and `FormValidationService` enforces, so a prompt could not be
   * tested against as many seeds as a reader can send it.
   */
  toggleTheme(theme: ThemeSeed): void {
    if (this.selectedThemeIds.includes(theme.id)) {
      this.selectedThemeIds = this.selectedThemeIds.filter(id => id !== theme.id);
      return;
    }

    this.selectedThemeIds = [...this.selectedThemeIds, theme.id].slice(-this.maxThemes);
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

    const input = this.buildGenerationInput(prompts, themes);
    // The prompts under test travel to the API inside `narrativeDirectives`,
    // which the blueprint routes cap. Asking first is what keeps a test the
    // route is certain to refuse from being reported as a generation failure —
    // and names the two things the reader can actually change.
    const overflow = describeNarrativeDirectivesOverflow(input.narrativeDirectives ?? '');
    if (overflow) {
      this.statusMessage = `The "${template.name}" template does not fit: ${overflow} `
        + 'Choose a shorter template, trim the custom prompt, or leave the generation logic out of this run.';
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage = 'Generating Story Lab sample...';
    const startTime = Date.now();

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
        this.statusMessage = this.readApiErrorMessage(error)
          ?? 'Story generation failed. Check the debug panel or console for details.';
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

    // Through the shared download rather than a `data:` URI on a detached
    // anchor: Firefox does not dispatch a synthetic click on an anchor that is
    // not in the document, so this button did nothing there at all, and the
    // history it exports — up to twenty-five generated stories with their
    // prompts and evaluations — is far past what a browser will carry in a URL.
    downloadTextDocument(
      JSON.stringify(this.testHistory(), null, 2),
      `proving-grounds-results-${Date.now()}.json`,
      'application/json',
      createBrowserHtmlDownloadHost(document, URL)
    );
    this.statusMessage = 'Exported the test history as JSON.';
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

  scoreToneClass(score: number): 'score-high' | 'score-medium' | 'score-low' {
    if (score >= 80) {
      return 'score-high';
    }
    if (score >= 60) {
      return 'score-medium';
    }
    return 'score-low';
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

  /**
   * The message the API sent, when it sent one.
   *
   * A failed generation is a real status now, so `HttpClient` reports it through
   * the error path rather than as a `success: false` body on a `200` — and the
   * envelope that says which field the route refused travels with it, in
   * `HttpErrorResponse.error`. Reporting a fixed sentence instead threw that
   * away: "Story generation failed" for a blueprint the route named the invalid
   * field of, and the same sentence for a provider outage.
   */
  private readApiErrorMessage(error: unknown): string | null {
    const body = (error as { error?: unknown } | null | undefined)?.error;
    const envelope = (body as { error?: { message?: unknown } } | null | undefined)?.error;
    const message = envelope?.message;

    return typeof message === 'string' && message.trim().length > 0 ? message : null;
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
