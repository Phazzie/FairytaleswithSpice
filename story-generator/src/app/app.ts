import { CommonModule } from '@angular/common';
import { Component, SecurityContext, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BlueprintValidationField, FormValidationService } from './form-validation.service';
import {
  BatchProgressState,
  ChapterBatchSize,
  ChapterTimelineEntry,
  ContinuityPanelViewModel,
  GeneratedChapter,
  SavedStoryProject,
  StoryBlueprint,
  StoryIterationPayload,
  StoryWorkbenchSession,
  ThemeSeed
} from './contracts';
import { StoryService } from './story.service';
import { StoryWorkspaceStorageService } from './story-workspace-storage.service';
import { ErrorLoggingService } from './error-logging';
import { DebugPanel } from './debug-panel/debug-panel';
import { NotificationService } from './notification.service';
import { NotificationsComponent } from './notifications.component';

type BlueprintForm = StoryBlueprint & {
  chapterBatchSize: ChapterBatchSize;
  narrativeDirectives?: string;
};

type ChapterGroupViewModel = {
  id: number;
  label: string;
  chapters: GeneratedChapter[];
};

@Component({
  selector: 'app-story-lab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NotificationsComponent, DebugPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly storyService = inject(StoryService);
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly formValidation = inject(FormValidationService);
  private readonly notificationService = inject(NotificationService);
  private readonly workspaceStorage = inject(StoryWorkspaceStorageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private batchIdSequence = 0;

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
    chapterBatchSize: 1,
    protagonistName: '',
    antagonistName: '',
    worldDetails: '',
    narrativeDirectives: ''
  });

  readonly workbench = signal<StoryWorkbenchSession>({
    story: null,
    state: null,
    chapterHistory: [],
    activeBatchSize: 2,
    lastSuggestedPrompts: [],
    batchQueue: []
  });

  readonly selectedChapterId = signal<string | null>(null);
  readonly collapsedChapterGroups = signal<Set<number>>(new Set());
  readonly isGenerating = signal(false);
  readonly statusMessage = signal<string>('Configure your spicy fairy-tale blueprint to begin.');
  readonly workspaceSaveStatus = signal<string>('No saved stories in this browser yet.');
  readonly savedProjects = signal<SavedStoryProject[]>([]);
  readonly showDebugPanel = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('debug') === '1')),
    { initialValue: false }
  );
  readonly validationErrors = computed(() => this.formValidation.validateBlueprint(this.blueprint()));
  readonly isBlueprintValid = computed(() => this.formValidation.isValid(this.validationErrors()));
  readonly firstValidationError = computed(() => this.formValidation.getFirstError(this.validationErrors()));

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
  readonly activeBatchQueue = computed<BatchProgressState[]>(() => this.workbench().batchQueue ?? []);
  readonly hasFinishedBatchQueueItems = computed(() =>
    this.activeBatchQueue().some(item => item.status === 'completed' || item.status === 'failed')
  );
  readonly suggestedNextPrompts = computed(() => this.workbench().lastSuggestedPrompts ?? []);
  readonly continuityExtraction = computed(() => this.workbench().lastContinuityExtraction ?? null);
  readonly modelBadge = computed(() => {
    const telemetry = this.workbench().lastTelemetry;
    if (!telemetry?.model) {
      return 'Grok 4.3';
    }

    const modelLabel = telemetry.fallbackFromModel
      ? `${telemetry.model} fallback`
      : telemetry.model;

    return telemetry.reasoningEffort
      ? `${modelLabel} · ${telemetry.reasoningEffort}`
      : modelLabel;
  });
  readonly chapterGroups = computed<ChapterGroupViewModel[]>(() => {
    const chapters = this.workbench().chapterHistory;
    if (!chapters.length) {
      return [];
    }

    const groupSize = this.getChapterGroupSize(chapters.length);
    const groups: ChapterGroupViewModel[] = [];

    for (let index = 0; index < chapters.length; index += groupSize) {
      const chunk = chapters.slice(index, index + groupSize);
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const label = chunk.length === 1
        ? `Chapter ${first.chapterNumber}`
        : `Chapters ${first.chapterNumber}-${last.chapterNumber}`;

      groups.push({
        id: index / groupSize,
        label,
        chapters: chunk
      });
    }

    return groups;
  });

  constructor() {
    this.restoreLatestProject();
  }

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
    const validationErrors = this.validationErrors();
    if (!this.formValidation.isValid(validationErrors)) {
      const message = this.formValidation.getFirstError(validationErrors) ?? 'Complete the required blueprint fields.';
      this.statusMessage.set(message);
      this.notificationService.error('Blueprint needs attention', message);
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage.set('Summoning the first batch of chapters...');
    this.setBatchQueue([]);
    const batchId = this.enqueueBatch('Genesis', blueprint.chapterBatchSize);

    this.storyService.beginStory(blueprint).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = response.error?.message ?? 'Unknown error while generating story.';
          this.statusMessage.set(message);
          this.markBatchFailed(batchId, response.error?.message ?? 'Unknown generation error.');
          this.notificationService.error('Generation failed', message);
          this.isGenerating.set(false);
          return;
        }

        this.applyIteration(response.data, blueprint.chapterBatchSize, batchId);
        this.statusMessage.set('Genesis batch complete. Continue weaving the saga!');
        this.notificationService.success(
          'Genesis complete',
          `Generated ${response.data.batch.chapters.length} chapter${response.data.batch.chapters.length === 1 ? '' : 's'}.`
        );
        this.isGenerating.set(false);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.startGenesis');
        const message = 'Story generation failed. Please try again in a moment. If it keeps failing, the story provider may be unavailable.';
        this.statusMessage.set(message);
        this.markBatchFailed(batchId, message);
        this.notificationService.error('Generation failed', message);
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
      const message = 'Generate a story before requesting continuations.';
      this.statusMessage.set(message);
      this.notificationService.warning('No active story', message);
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage.set('Extending the saga with a fresh batch...');
    const batchId = this.enqueueBatch('Continuation', this.blueprint().chapterBatchSize);

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
          const message = response.error?.message ?? 'Continuation request failed.';
          this.statusMessage.set(message);
          this.markBatchFailed(batchId, message);
          this.notificationService.error('Continuation failed', message);
          this.isGenerating.set(false);
          return;
        }

        this.applyIteration(response.data, request.chapterBatchSize, batchId);
        this.statusMessage.set('Continuation batch ready. Select a chapter to explore.');
        this.notificationService.success(
          'Continuation ready',
          `Added ${response.data.batch.chapters.length} chapter${response.data.batch.chapters.length === 1 ? '' : 's'} to the saga.`
        );
        this.isGenerating.set(false);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.continueSaga');
        const message = 'Continuation failed. Please try again; your existing chapters are still available.';
        this.statusMessage.set(message);
        this.markBatchFailed(batchId, message);
        this.notificationService.error('Continuation failed', message);
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
      activeBatchSize: this.blueprint().chapterBatchSize,
      lastSuggestedPrompts: [],
      batchQueue: []
    });
    this.selectedChapterId.set(null);
    this.collapsedChapterGroups.set(new Set());
    this.statusMessage.set('Blueprint reset. Ready for a brand new legend.');
    this.notificationService.info('Workbench reset', 'Story Lab is ready for a new blueprint.');
  }

  saveActiveProject() {
    const savedProjectId = this.persistSession(this.workbench());
    if (savedProjectId) {
      this.workbench.update(current => ({
        ...current,
        savedProjectId
      }));
    }
  }

  loadSavedProject(projectId: string) {
    const project = this.workspaceStorage.loadProject(projectId);
    if (!project) {
      const message = 'That saved story could not be found in this browser.';
      this.workspaceSaveStatus.set(message);
      this.notificationService.warning('Story not found', message);
      this.refreshSavedProjects();
      return;
    }

    this.hydrateSavedProject(project, true);
  }

  deleteSavedProject(projectId: string) {
    const result = this.workspaceStorage.deleteProject(projectId);
    if (!result.success) {
      this.workspaceSaveStatus.set(result.message);
      this.notificationService.warning('Delete failed', result.message);
      return;
    }

    this.refreshSavedProjects();
    if (this.workbench().savedProjectId === projectId) {
      this.workbench.update(current => ({
        ...current,
        savedProjectId: undefined
      }));
    }
    this.workspaceSaveStatus.set('Saved story removed from this browser.');
  }

  private applyIteration(payload: StoryIterationPayload, batchSize: ChapterBatchSize, batchId?: string) {
    const existingQueue = this.activeBatchQueue();
    const batchQueue = batchId
      ? existingQueue.map(item => item.id === batchId
          ? {
              ...item,
              status: 'completed' as const,
              chaptersGenerated: payload.batch.chapters.length,
              completedAt: new Date().toISOString(),
              errorMessage: undefined
            }
          : item)
      : existingQueue;

    const nextSession: StoryWorkbenchSession = {
      story: payload.summary,
      state: payload.state,
      chapterHistory: [...(this.workbench().story?.storyId === payload.summary.storyId ? this.workbench().chapterHistory : []), ...payload.batch.chapters],
      activeBatchSize: batchSize,
      lastTelemetry: payload.telemetry,
      lastContinuityExtraction: payload.continuityExtraction,
      lastSuggestedPrompts: payload.batch.suggestedNextPrompts,
      batchQueue
    };

    const savedProjectId = this.persistSession(nextSession);
    this.workbench.set({
      ...nextSession,
      savedProjectId
    });
    this.collapsedChapterGroups.set(new Set());

    const newestChapter = payload.batch.chapters[payload.batch.chapters.length - 1];
    if (newestChapter) {
      this.selectedChapterId.set(newestChapter.chapterId);
    }
  }

  private enqueueBatch(label: string, batchSize: ChapterBatchSize): string {
    const id = `batch-${Date.now()}-${this.batchIdSequence++}`;
    const entry: BatchProgressState = {
      id,
      label,
      batchSize,
      status: 'in_progress',
      chaptersGenerated: 0,
      totalChapters: batchSize,
      submittedAt: new Date().toISOString()
    };

    this.setBatchQueue([...this.activeBatchQueue(), entry]);
    return id;
  }

  private markBatchFailed(batchId: string, errorMessage: string) {
    this.setBatchQueue(this.activeBatchQueue().map(item => item.id === batchId
      ? {
          ...item,
          status: 'failed' as const,
          completedAt: new Date().toISOString(),
          errorMessage
        }
      : item));
  }

  private setBatchQueue(batchQueue: BatchProgressState[]) {
    this.workbench.update(current => ({
      ...current,
      batchQueue
    }));
  }

  private restoreLatestProject() {
    this.refreshSavedProjects();
    const latestProject = this.savedProjects()[0];
    if (latestProject) {
      this.hydrateSavedProject(latestProject, false);
    }
  }

  private refreshSavedProjects() {
    this.savedProjects.set(this.workspaceStorage.listProjects());
  }

  private hydrateSavedProject(project: SavedStoryProject, shouldNotify: boolean) {
    this.blueprint.set({
      ...project.blueprint,
      narrativeDirectives: project.blueprint.narrativeDirectives ?? ''
    });
    this.workbench.set({
      story: project.summary,
      state: project.state,
      chapterHistory: project.chapters,
      activeBatchSize: project.blueprint.chapterBatchSize,
      lastTelemetry: project.telemetry,
      lastContinuityExtraction: project.continuityExtraction,
      lastSuggestedPrompts: [],
      batchQueue: [],
      savedProjectId: project.id
    });
    this.selectedChapterId.set(project.chapters.at(-1)?.chapterId ?? null);
    this.collapsedChapterGroups.set(new Set());
    this.workspaceSaveStatus.set(`Loaded "${project.title}" from this browser.`);
    this.statusMessage.set('Saved story loaded. Continue the saga whenever you are ready.');

    if (shouldNotify) {
      this.notificationService.info('Story loaded', project.title);
    }
  }

  private persistSession(session: StoryWorkbenchSession): string | undefined {
    if (!session.story || !session.state || !session.chapterHistory.length) {
      return undefined;
    }

    const now = new Date().toISOString();
    const currentProjectId = session.savedProjectId ?? session.story.storyId;
    const existingProject = this.workspaceStorage.loadProject(currentProjectId);
    const project: SavedStoryProject = {
      id: currentProjectId,
      storyId: session.story.storyId,
      title: session.story.title,
      synopsis: session.story.synopsis,
      blueprint: this.blueprint(),
      summary: session.story,
      state: session.state,
      chapters: session.chapterHistory,
      telemetry: session.lastTelemetry,
      continuityExtraction: session.lastContinuityExtraction,
      createdAt: existingProject?.createdAt ?? session.story.createdAt ?? now,
      updatedAt: now
    };
    const result = this.workspaceStorage.saveProject(project);

    if (!result.success) {
      this.workspaceSaveStatus.set(result.message);
      return undefined;
    }

    this.refreshSavedProjects();
    this.workspaceSaveStatus.set('Saved in this browser.');
    return result.data.id;
  }

  clearFinishedBatchQueue() {
    this.setBatchQueue(this.activeBatchQueue().filter(item => item.status !== 'completed' && item.status !== 'failed'));
  }

  toggleChapterGroup(groupId: number) {
    const next = new Set(this.collapsedChapterGroups());
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.collapsedChapterGroups.set(next);
  }

  isChapterGroupCollapsed(groupId: number): boolean {
    return this.collapsedChapterGroups().has(groupId);
  }

  private getChapterGroupSize(chapterCount: number): number {
    if (chapterCount >= 50) {
      return 10;
    }
    if (chapterCount >= 20) {
      return 5;
    }
    return 3;
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

  trackChapter(index: number, entry: Pick<ChapterTimelineEntry, 'chapterId'>) {
    return entry.chapterId;
  }

  trackTheme(index: number, theme: ThemeSeed) {
    return theme.id;
  }

  getFieldError(field: BlueprintValidationField): string | undefined {
    return this.validationErrors()[field];
  }

  hasFieldError(field: BlueprintValidationField): boolean {
    return Boolean(this.getFieldError(field));
  }
}
