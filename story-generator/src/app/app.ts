import { CommonModule } from '@angular/common';
import { Component, SecurityContext, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ChapterBatchSize,
  ChapterTimelineEntry,
  ContinuityPanelViewModel,
  StoryBlueprint,
  StoryIterationPayload,
  StoryWorkbenchSession,
  ThemeSeed
} from './contracts';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { DebugPanel } from './debug-panel/debug-panel';

type BlueprintForm = StoryBlueprint & {
  chapterBatchSize: ChapterBatchSize;
  narrativeDirectives?: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, DebugPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly storyService = inject(StoryService);
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly availableThemes: ThemeSeed[] = [
    { id: 'forbidden_love', label: 'Forbidden Love', description: 'Lovers defy expectations and social rules.' },
    { id: 'ancient_curses', label: 'Ancient Curses', description: 'Long-forgotten vows twist fate.' },
    { id: 'court_intrigue', label: 'Court Intrigue', description: 'Schemes and power plays simmer in shadow.' },
    { id: 'blood_oaths', label: 'Blood Oaths', description: 'Unbreakable promises bind every action.' },
    { id: 'slow_burn', label: 'Slow Burn', description: 'Tension builds across chapters before erupting.' },
    { id: 'enemies_to_lovers', label: 'Enemies to Lovers', description: 'Bitterness melts into desire.' }
  ];

  readonly blueprint = signal<BlueprintForm>({
    creature: 'vampire',
    themes: [],
    logline: '',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 2,
    protagonistName: '',
    antagonistName: '',
    worldDetails: '',
    narrativeDirectives: ''
  });

  readonly workbench = signal<StoryWorkbenchSession>({
    story: null,
    state: null,
    chapterHistory: [],
    activeBatchSize: 2
  });

  readonly selectedChapterId = signal<string | null>(null);
  readonly isGenerating = signal(false);
  readonly statusMessage = signal<string>('Configure your spicy fairy-tale blueprint to begin.');

  readonly timeline = computed<ChapterTimelineEntry[]>(() => {
    const session = this.workbench();
    return session.chapterHistory.map(chapter => ({
      chapterId: chapter.chapterId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      summary: chapter.summary,
      hasCliffhanger: chapter.hasCliffhanger,
      createdAt: session.story?.updatedAt ?? new Date().toISOString()
    }));
  });

  readonly continuityPanel = computed<ContinuityPanelViewModel>(() => {
    const session = this.workbench();
    if (!session.state) {
      return {
        characters: [],
        activeThreads: [],
        unresolvedArtifacts: [],
        continuityWarnings: []
      };
    }

    return {
      characters: session.state.characters,
      activeThreads: session.state.threads.filter(thread => thread.status !== 'resolved'),
      unresolvedArtifacts: session.state.artifacts.filter(artifact => !artifact.resolvedInChapter),
      continuityWarnings: session.state.continuityWarnings
    };
  });

  readonly selectedChapter = computed(() => {
    const id = this.selectedChapterId();
    if (!id) {
      return this.workbench().chapterHistory.at(-1) ?? null;
    }

    return this.workbench().chapterHistory.find(chapter => chapter.chapterId === id) ?? null;
  });

  readonly selectedChapterIndex = computed(() => {
    const chapter = this.selectedChapter();
    if (!chapter) {
      return -1;
    }

    return this.workbench().chapterHistory.findIndex(entry => entry.chapterId === chapter.chapterId);
  });

  readonly activeBatchSize = computed<ChapterBatchSize>(() => this.blueprint().chapterBatchSize);

  updateBlueprint<K extends keyof BlueprintForm>(field: K, value: BlueprintForm[K]) {
    this.blueprint.update(current => ({
      ...current,
      [field]: value
    }));
  }

  isThemeSelected(theme: ThemeSeed): boolean {
    return this.blueprint().themes.some(item => item.id === theme.id);
  }

  toggleTheme(theme: ThemeSeed) {
    const current = this.blueprint();
    const isSelected = current.themes.some(item => item.id === theme.id);
    const updatedThemes = isSelected
      ? current.themes.filter(item => item.id !== theme.id)
      : [...current.themes, theme];

    this.blueprint.set({ ...current, themes: updatedThemes });
  }

  selectChapter(chapterId: string) {
    this.selectedChapterId.set(chapterId);
  }

  async startGenesis() {
    if (this.isGenerating()) {
      return;
    }

    const blueprint = this.blueprint();
    if (!blueprint.logline?.trim()) {
      this.statusMessage.set('Please provide a concise logline to anchor the story.');
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage.set('Summoning the first batch of chapters...');

    this.storyService.beginStory(blueprint).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.statusMessage.set(response.error?.message ?? 'Unknown error while generating story.');
          this.isGenerating.set(false);
          return;
        }

        this.applyIteration(response.data, blueprint.chapterBatchSize);
        this.statusMessage.set('Genesis batch complete. Continue weaving the saga!');
        this.isGenerating.set(false);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.startGenesis');
        this.statusMessage.set('Story generation failed. Check the debug panel for details.');
        this.isGenerating.set(false);
      }
    });
  }

  async continueSaga(brief?: string) {
    if (this.isGenerating()) {
      return;
    }

    const session = this.workbench();
    if (!session.story || !session.state) {
      this.statusMessage.set('Generate a story before requesting continuations.');
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage.set('Extending the saga with a fresh batch...');

    const request = {
      storyId: session.story.storyId,
      chapterBatchSize: this.blueprint().chapterBatchSize,
      storyState: session.state,
      previouslyGeneratedChapters: session.chapterHistory,
      continuationBrief: brief ?? undefined,
      existingSummary: session.story
    } as const;

    this.storyService.continueStory(request).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.statusMessage.set(response.error?.message ?? 'Continuation request failed.');
          this.isGenerating.set(false);
          return;
        }

        this.applyIteration(response.data, request.chapterBatchSize);
        this.statusMessage.set('Continuation batch ready. Select a chapter to explore.');
        this.isGenerating.set(false);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.continueSaga');
        this.statusMessage.set('Continuation failed. Inspect logged errors for more detail.');
        this.isGenerating.set(false);
      }
    });
  }

  getSafeHtml(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  resetWorkbench() {
    this.workbench.set({
      story: null,
      state: null,
      chapterHistory: [],
      activeBatchSize: this.blueprint().chapterBatchSize
    });
    this.selectedChapterId.set(null);
    this.statusMessage.set('Blueprint reset. Ready for a brand new legend.');
  }

  private applyIteration(payload: StoryIterationPayload, batchSize: ChapterBatchSize) {
    const nextSession: StoryWorkbenchSession = {
      story: payload.summary,
      state: payload.state,
      chapterHistory: [...(this.workbench().story?.storyId === payload.summary.storyId ? this.workbench().chapterHistory : []), ...payload.batch.chapters],
      activeBatchSize: batchSize,
      lastTelemetry: payload.telemetry
    };

    this.workbench.set(nextSession);

    const newestChapter = payload.batch.chapters.at(-1);
    if (newestChapter) {
      this.selectedChapterId.set(newestChapter.chapterId);
    }
  }

  get currentChapterContent(): string {
    return this.selectedChapter()?.htmlContent ?? '';
  }

  get currentChapterSummary(): string {
    return this.selectedChapter()?.summary ?? '';
  }

  get totalChapterCount(): number {
    return this.workbench().chapterHistory.length;
  }

  get continuityWarnings(): string[] {
    return this.continuityPanel().continuityWarnings;
  }

  get activeThreadsLabel(): string {
    const threads = this.continuityPanel().activeThreads;
    if (!threads.length) {
      return 'No active plot threads';
    }
    return `${threads.length} active plot ${threads.length === 1 ? 'thread' : 'threads'}`;
  }

  get selectedThemes(): string {
    const blueprint = this.blueprint();
    if (!blueprint.themes.length) {
      return 'No themes selected';
    }
    return blueprint.themes.map(theme => theme.label).join(', ');
  }

  trackChapter(index: number, entry: ChapterTimelineEntry) {
    return entry.chapterId;
  }

  trackTheme(index: number, theme: ThemeSeed) {
    return theme.id;
  }
}
