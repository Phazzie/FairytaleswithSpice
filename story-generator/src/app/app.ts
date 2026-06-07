import { CommonModule } from '@angular/common';
import { Component, OnDestroy, SecurityContext, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, map } from 'rxjs';
import { BlueprintValidationField, FormValidationService } from './form-validation.service';
import {
  BatchProgressState,
  ChapterBatchSize,
  ChapterTimelineEntry,
  ContinuityPanelViewModel,
  CreatureArchetype,
  GeneratedChapter,
  HeatContract,
  HeatIntimacyBoundary,
  HeatTensionMode,
  SavedStoryProject,
  SpicyLevel,
  StoryBlueprint,
  StoryIterationPayload,
  StoryLabJob,
  StoryLabJobStatus,
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

type StorySkinId = 'bookshop' | 'conservatory' | 'writing-desk';

type StorySkinOption = {
  id: StorySkinId;
  label: string;
  mood: string;
};

type CreatureOption = {
  id: CreatureArchetype;
  label: string;
  description: string;
};

type SpiceOption = {
  level: SpicyLevel;
  label: string;
  description: string;
};

type HeatContractOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};

type ContinuationDirection = {
  label: string;
  brief: string;
};

type GenerationProgressState = {
  active: boolean;
  percent: number;
  stage: string;
  elapsedSeconds: number;
};

@Component({
  selector: 'app-story-lab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NotificationsComponent, DebugPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private readonly storyService = inject(StoryService);
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly formValidation = inject(FormValidationService);
  private readonly notificationService = inject(NotificationService);
  private readonly workspaceStorage = inject(StoryWorkspaceStorageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private batchIdSequence = 0;
  private readonly skinStorageKey = 'fairytales_story_lab_skin_v1';
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private progressStartedAt = 0;
  private jobDrivenProgress = false;
  private jobEventSubscription: Subscription | null = null;

  readonly skinOptions: StorySkinOption[] = [
    { id: 'bookshop', label: 'Enchanted Bookshop', mood: 'Warm, nostalgic, whimsical' },
    { id: 'conservatory', label: 'Moonlit Conservatory', mood: 'Romantic, mysterious, gothic' },
    { id: 'writing-desk', label: 'Cozy Witchy Writing Desk', mood: 'Intimate, earthy, creative' }
  ];

  readonly creatureOptions: CreatureOption[] = [
    { id: 'vampire', label: 'Vampire', description: 'Immortal desire, old secrets, dangerous elegance.' },
    { id: 'werewolf', label: 'Werewolf', description: 'Pack bonds, moonlit hunger, protective intensity.' },
    { id: 'fairy', label: 'Fairy', description: 'Fae bargains, beautiful traps, glittering menace.' },
    { id: 'siren', label: 'Siren', description: 'Songs, saltwater vows, temptation with teeth.' },
    { id: 'djinn', label: 'Djinn', description: 'Wishes, bargains, heat shimmer magic.' },
    { id: 'witch', label: 'Witch', description: 'Spellwork, grimoires, familiar old power.' },
    { id: 'dragon', label: 'Dragon', description: 'Treasure, pride, scale-deep obsession.' },
    { id: 'demon', label: 'Demon', description: 'Temptation, contracts, wicked devotion.' },
    { id: 'angel', label: 'Angel', description: 'Forbidden grace, falling, sacred desire.' },
    { id: 'mermaid', label: 'Mermaid', description: 'Tides, curses, pearl-lit longing.' }
  ];

  readonly availableThemes: ThemeSeed[] = [
    { id: 'forbidden_love', label: 'Forbidden Love', description: 'Desire has consequences.' },
    { id: 'dark_secrets', label: 'Hidden Secrets', description: 'Someone is lying beautifully.' },
    { id: 'court_intrigue', label: 'Court Intrigue', description: 'Power games under candlelight.' },
    { id: 'blood_oaths', label: 'Blood Oaths', description: 'Promises that bite back.' },
    { id: 'slow_burn', label: 'Slow Burn', description: 'Tension before surrender.' },
    { id: 'enemies_to_lovers', label: 'Enemies to Lovers', description: 'Sparks from mutual danger.' },
    { id: 'revenge', label: 'Revenge', description: 'A debt comes due.' },
    { id: 'obsession', label: 'Obsession', description: 'Want sharp enough to wound.' },
    { id: 'temptation', label: 'Temptation', description: 'The wrong door keeps opening.' },
    { id: 'magical_bargain', label: 'Magical Bargain', description: 'Every wish has a price.' },
    { id: 'secret_identity', label: 'Secret Identity', description: 'The lover is not who they seem.' },
    { id: 'forced_proximity', label: 'Forced Proximity', description: 'No escape from chemistry.' }
  ];

  readonly spiceOptions: SpiceOption[] = [
    { level: 1, label: 'Storybook Romance', description: 'Longing, flirtation, no explicit detail.' },
    { level: 2, label: 'Warm', description: 'Kissing, sensual tension, restrained heat.' },
    { level: 3, label: 'Spicy', description: 'Adult heat, literary, fade-to-black before graphic detail.' },
    { level: 4, label: 'Very Spicy', description: 'Explicit consensual intimacy with emotional stakes.' },
    { level: 5, label: 'Inferno', description: 'Maximum explicit consensual adult fantasy.' }
  ];

  readonly heatTensionOptions: HeatContractOption<HeatTensionMode>[] = [
    { id: 'slow_burn', label: 'Slow burn', description: 'Longing, restraint, charged pauses.' },
    { id: 'dangerous_proximity', label: 'Danger close', description: 'Threat, protection, forced proximity.' },
    { id: 'playful_banter', label: 'Banter', description: 'Teasing, challenge, mischief.' },
    { id: 'devotional_longing', label: 'Devotion', description: 'Reverence, sacrifice, tenderness.' }
  ];

  readonly heatBoundaryOptions: HeatContractOption<HeatIntimacyBoundary>[] = [
    { id: 'fade_to_black', label: 'Fade to black', description: 'Build heat, close the door early.' },
    { id: 'closed_door', label: 'Closed door', description: 'Romance stays implied off-page.' },
    { id: 'literary_on_page', label: 'Literary on-page', description: 'Consensual heat with polished language.' }
  ];

  readonly continuationDirections: ContinuationDirection[] = [
    { label: 'Deepen the romance', brief: 'Deepen the romantic tension and make the emotional stakes more intimate.' },
    { label: 'Raise the danger', brief: 'Raise the external danger and force the characters into a sharper choice.' },
    { label: 'Reveal a secret', brief: 'Reveal a secret that changes how the previous chapter should be understood.' },
    { label: 'Add a twist', brief: 'Add a twist that complicates the romance without breaking continuity.' },
    { label: 'Slow down and linger', brief: 'Slow down for atmosphere, longing, and character intimacy before the next plot turn.' }
  ];

  readonly blueprint = signal<BlueprintForm>({
    creature: 'vampire',
    themes: [],
    logline: '',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 1,
    heatContract: {
      adultOnlyConfirmed: false,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    },
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
  readonly activeSkin = signal<StorySkinId>('writing-desk');
  readonly customContinuationBrief = signal('');
  readonly isGenerating = signal(false);
  readonly statusMessage = signal<string>('Tell us what kind of enchanted, spicy story you want.');
  readonly workspaceSaveStatus = signal<string>('No saved stories in this browser yet.');
  readonly savedProjects = signal<SavedStoryProject[]>([]);
  readonly generationProgress = signal<GenerationProgressState>({
    active: false,
    percent: 0,
    stage: 'Waiting for your story idea',
    elapsedSeconds: 0
  });
  readonly showDebugPanel = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('debug') === '1')),
    { initialValue: false }
  );
  readonly validationErrors = computed(() => this.formValidation.validateBlueprint(this.blueprint()));
  readonly isBlueprintValid = computed(() => this.formValidation.isValid(this.validationErrors()));
  readonly firstValidationError = computed(() => this.formValidation.getFirstError(this.validationErrors()));
  readonly currentSkin = computed(() =>
    this.skinOptions.find(skin => skin.id === this.activeSkin()) ?? this.skinOptions[0]
  );
  readonly activeSpiceOption = computed(() =>
    this.spiceOptions.find(option => option.level === Number(this.blueprint().spicyLevel)) ?? this.spiceOptions[2]
  );
  readonly activeHeatContract = computed(() => this.normalizeHeatContract(this.blueprint().heatContract));

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
    this.restoreSkin();
    this.restoreLatestProject();
  }

  ngOnDestroy() {
    this.closeJobEventSubscription();
    this.stopProgress();
  }

  updateBlueprint<K extends keyof BlueprintForm>(field: K, value: BlueprintForm[K]) {
    this.blueprint.update(current => ({
      ...current,
      [field]: value
    }));
  }

  updateHeatContract<K extends keyof HeatContract>(field: K, value: HeatContract[K]) {
    this.blueprint.update(current => ({
      ...current,
      heatContract: {
        ...this.normalizeHeatContract(current.heatContract),
        [field]: value
      }
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

  selectSkin(skinId: StorySkinId) {
    this.activeSkin.set(skinId);
    try {
      localStorage.setItem(this.skinStorageKey, skinId);
    } catch {
      this.workspaceSaveStatus.set('Theme choice will last until this tab closes.');
    }
  }

  updateCustomContinuationBrief(value: string) {
    this.customContinuationBrief.set(value);
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
    this.statusMessage.set('Sending your story ingredients to Grok...');
    this.startProgress('genesis');
    this.setBatchQueue([]);
    this.closeJobEventSubscription();
    const batchId = this.enqueueBatch('Genesis', blueprint.chapterBatchSize);

    this.storyService.createStoryLabJob<StoryIterationPayload>({
      kind: 'genesis',
      blueprint
    }).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = this.formatApiError(response.error, 'Unknown error while generating story.');
          this.failGenesisJob(batchId, message);
          return;
        }

        const isTerminal = this.handleGenesisJobSnapshot(response.data.job, batchId, blueprint.chapterBatchSize);
        if (!isTerminal) {
          this.openGenesisJobEventStream(response.data.job.jobId, batchId, blueprint.chapterBatchSize);
        }
      },
      error: error => {
        this.errorLogging.logError(error, 'App.startGenesis');
        const message = this.formatHttpError(error, 'Story generation failed. Please try again in a moment.');
        this.failGenesisJob(batchId, message);
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
    this.statusMessage.set('Asking Grok to continue the next chapter...');
    this.startProgress('continuation');
    const batchId = this.enqueueBatch('Continuation', this.blueprint().chapterBatchSize);

    const request = {
      storyId: session.story.storyId,
      chapterBatchSize: this.blueprint().chapterBatchSize,
      storyState: session.state,
      previouslyGeneratedChapters: session.chapterHistory,
      continuationBrief: brief ?? undefined,
      existingSummary: session.story,
      heatContract: this.activeHeatContract()
    } as const;

    this.storyService.continueStory(request).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = this.formatApiError(response.error, 'Continuation request failed.');
          this.statusMessage.set(message);
          this.markBatchFailed(batchId, message);
          this.notificationService.error('Continuation failed', message);
          this.isGenerating.set(false);
          this.stopProgress();
          return;
        }

        this.applyIteration(response.data, request.chapterBatchSize, batchId);
        this.statusMessage.set('Continuation batch ready. Select a chapter to explore.');
        this.notificationService.success(
          'Continuation ready',
          `Added ${response.data.batch.chapters.length} chapter${response.data.batch.chapters.length === 1 ? '' : 's'} to the saga.`
        );
        this.isGenerating.set(false);
        this.stopProgress();
      },
      error: error => {
        this.errorLogging.logError(error, 'App.continueSaga');
        const message = this.formatHttpError(error, 'Continuation failed. Your existing chapters are still available.');
        this.statusMessage.set(message);
        this.markBatchFailed(batchId, message);
        this.notificationService.error('Continuation failed', message);
        this.isGenerating.set(false);
        this.stopProgress();
      }
    });
  }

  continueWithDirection(direction: ContinuationDirection) {
    this.continueSaga(direction.brief);
  }

  continueWithCustomDirection() {
    const brief = this.customContinuationBrief().trim();
    if (!brief) {
      this.continueSaga();
      return;
    }

    this.customContinuationBrief.set('');
    this.continueSaga(brief);
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
    this.statusMessage.set('Start a fresh tale whenever you are ready.');
    this.notificationService.info('Workbench reset', 'Story Lab is ready for a new blueprint.');
  }

  async copyStory() {
    const text = this.buildPlainStoryText();
    if (!text) {
      this.notificationService.warning('Nothing to copy', 'Generate a story first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.notificationService.success('Story copied', 'The story text is on your clipboard.');
      this.statusMessage.set('Story copied to your clipboard.');
    } catch {
      this.notificationService.error('Copy failed', 'Your browser did not allow clipboard access.');
      this.statusMessage.set('Copy failed. Your browser did not allow clipboard access.');
    }
  }

  downloadStory() {
    const session = this.workbench();
    if (!session.story || !session.chapterHistory.length) {
      this.notificationService.warning('Nothing to download', 'Generate a story first.');
      return;
    }

    const safeTitle = this.safeFileName(session.story.title);
    const chapters = session.chapterHistory
      .map(chapter => {
        const body = this.getSafeHtml(chapter.htmlContent);
        return `<section><h2>Chapter ${chapter.chapterNumber}: ${this.escapeHtml(chapter.title)}</h2>${body}</section>`;
      })
      .join('\n');
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${this.escapeHtml(session.story.title)}</title>
<style>
body{font-family:Georgia,serif;line-height:1.65;max-width:760px;margin:40px auto;padding:0 20px;color:#251914;background:#fff8ee}
h1,h2{line-height:1.15}hr{border:0;border-top:1px solid #d8c5aa;margin:28px 0}
</style>
</head>
<body>
<h1>${this.escapeHtml(session.story.title)}</h1>
<p>${this.escapeHtml(session.story.synopsis)}</p>
<hr>
${chapters}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.statusMessage.set('Story download created.');
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

  private handleGenesisJobSnapshot(
    job: StoryLabJob<StoryIterationPayload>,
    batchId: string,
    batchSize: ChapterBatchSize
  ): boolean {
    this.updateProgressFromJob(job);

    if (job.status === 'completed') {
      if (!job.result) {
        this.failGenesisJob(batchId, 'Story generation finished without a story payload. Please try again.');
        return true;
      }

      this.applyIteration(job.result, batchSize, batchId);
      this.statusMessage.set('Your first chapter is ready. Choose where the story goes next.');
      this.notificationService.success(
        'Genesis complete',
        `Generated ${job.result.batch.chapters.length} chapter${job.result.batch.chapters.length === 1 ? '' : 's'}.`
      );
      this.isGenerating.set(false);
      this.stopProgress();
      return true;
    }

    if (job.status === 'failed') {
      this.failGenesisJob(
        batchId,
        this.formatApiError(job.error, 'Story generation failed. Please try again in a moment.')
      );
      return true;
    }

    if (job.status === 'cancelled') {
      this.failGenesisJob(batchId, 'Story generation was cancelled before it finished.');
      return true;
    }

    return false;
  }

  private openGenesisJobEventStream(jobId: string, batchId: string, batchSize: ChapterBatchSize) {
    this.closeJobEventSubscription();
    this.jobEventSubscription = this.storyService.streamStoryLabJobEvents<StoryIterationPayload>(
      jobId,
      () => undefined
    ).subscribe({
      next: event => {
        this.handleGenesisJobSnapshot(event.job, batchId, batchSize);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.openGenesisJobEventStream');
        const message = this.formatHttpError(error, 'Story generation updates stopped. Please try again in a moment.');
        this.failGenesisJob(batchId, message);
      },
      complete: () => {
        this.jobEventSubscription = null;
      }
    });
  }

  private updateProgressFromJob(job: StoryLabJob<StoryIterationPayload>) {
    const stage = this.formatJobStage(job.currentStep, job.status);
    const progressPercent = Math.max(0, Math.min(100, Math.round(job.progressPercent)));
    this.jobDrivenProgress = true;
    this.statusMessage.set(stage);
    this.generationProgress.update(current => ({
      active: true,
      percent: progressPercent,
      stage,
      elapsedSeconds: current.elapsedSeconds
    }));
  }

  private failGenesisJob(batchId: string, message: string) {
    this.statusMessage.set(message);
    this.markBatchFailed(batchId, message);
    this.notificationService.error('Generation failed', message);
    this.isGenerating.set(false);
    this.stopProgress();
  }

  private closeJobEventSubscription() {
    if (this.jobEventSubscription) {
      this.jobEventSubscription.unsubscribe();
      this.jobEventSubscription = null;
    }
  }

  private formatJobStage(currentStep: string, status: StoryLabJobStatus): string {
    if (status === 'queued') {
      return 'Story job queued.';
    }

    if (status === 'waiting_for_review') {
      return 'Story job is waiting for review.';
    }

    switch (currentStep) {
      case 'queued':
        return 'Story job queued.';
      case 'generating_story':
        return 'Grok is writing your first chapter.';
      case 'continuing_story':
        return 'Grok is continuing the saga.';
      case 'completed':
        return 'Binding the pages.';
      case 'failed':
        return 'Generation failed.';
      default:
        return this.humanizeIdentifier(currentStep);
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
      heatContract: this.normalizeHeatContract(project.blueprint.heatContract),
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

  private restoreSkin() {
    try {
      const savedSkin = localStorage.getItem(this.skinStorageKey) as StorySkinId | null;
      if (savedSkin && this.skinOptions.some(skin => skin.id === savedSkin)) {
        this.activeSkin.set(savedSkin);
      }
    } catch {
      this.activeSkin.set('writing-desk');
    }
  }

  private startProgress(mode: 'genesis' | 'continuation') {
    const stages = mode === 'genesis'
      ? [
          'Preparing your story ingredients',
          'Sending them to Grok',
          'Writing the first chapter',
          'Checking the story thread',
          'Binding the pages'
        ]
      : [
          'Reading the last chapter',
          'Sending your direction to Grok',
          'Writing the next turn',
          'Checking continuity',
          'Binding the next pages'
        ];

    this.stopProgress();
    this.jobDrivenProgress = false;
    this.progressStartedAt = Date.now();
    this.generationProgress.set({
      active: true,
      percent: 8,
      stage: stages[0],
      elapsedSeconds: 0
    });

    this.progressTimer = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - this.progressStartedAt) / 1000);
      const stageIndex = Math.min(stages.length - 1, Math.floor(elapsedSeconds / 6));
      this.generationProgress.update(current => ({
        active: true,
        percent: this.jobDrivenProgress
          ? current.percent
          : Math.min(92, current.percent + (current.percent < 55 ? 7 : 3)),
        stage: this.jobDrivenProgress ? current.stage : stages[stageIndex],
        elapsedSeconds
      }));
    }, 1000);
  }

  private stopProgress() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    this.generationProgress.update(current => ({
      ...current,
      active: false,
      percent: current.percent > 0 ? 100 : 0
    }));
    this.jobDrivenProgress = false;
  }

  private formatApiError(error: { code?: string; message?: string; details?: unknown } | undefined, fallback: string): string {
    const code = error?.code ?? '';
    const message = error?.message ?? fallback;

    if (code === 'AI_UNAVAILABLE') {
      return 'The AI story engine is unavailable because this deployment is missing its Grok configuration.';
    }

    if (code.includes('TIMEOUT') || message.toLowerCase().includes('timeout')) {
      return 'Grok took too long to finish this story. Try a shorter chapter or try again in a minute.';
    }

    if (message.toLowerCase().includes('temporarily unavailable') || message.toLowerCase().includes('provider')) {
      return 'Grok is temporarily unavailable. Try again in a minute.';
    }

    return message;
  }

  private formatHttpError(error: any, fallback: string): string {
    return this.formatApiError(error?.error?.error ?? error?.error, fallback);
  }

  private buildPlainStoryText(): string {
    const session = this.workbench();
    if (!session.story || !session.chapterHistory.length) {
      return '';
    }

    const chapters = session.chapterHistory
      .map(chapter => `Chapter ${chapter.chapterNumber}: ${chapter.title}\n\n${this.stripHtml(chapter.htmlContent)}`)
      .join('\n\n---\n\n');

    return `${session.story.title}\n\n${session.story.synopsis}\n\n${chapters}`;
  }

  private stripHtml(html: string): string {
    let text = '';
    let insideTag = false;

    for (const char of html) {
      if (char === '<') {
        insideTag = true;
        text += ' ';
        continue;
      }
      if (char === '>') {
        insideTag = false;
        continue;
      }
      if (!insideTag) {
        text += char;
      }
    }

    return this.normalizeInlineWhitespace(text);
  }

  private safeFileName(value: string): string {
    let safeName = '';
    let needsSeparator = false;

    for (const char of value.toLowerCase()) {
      if (this.isAsciiLetterOrDigit(char)) {
        if (needsSeparator && safeName.length > 0) {
          safeName += '-';
        }
        safeName += char;
        needsSeparator = false;
        continue;
      }

      needsSeparator = safeName.length > 0;
    }

    return safeName || 'fairytales-story';
  }

  private escapeHtml(value: string): string {
    let escaped = '';

    for (const char of value) {
      switch (char) {
        case '&':
          escaped += '&amp;';
          break;
        case '<':
          escaped += '&lt;';
          break;
        case '>':
          escaped += '&gt;';
          break;
        case '"':
          escaped += '&quot;';
          break;
        case '\'':
          escaped += '&#39;';
          break;
        default:
          escaped += char;
      }
    }

    return escaped;
  }

  private normalizeInlineWhitespace(value: string): string {
    let normalized = '';
    let pendingSpace = false;

    for (const char of value) {
      if (this.isWhitespace(char)) {
        pendingSpace = normalized.length > 0;
        continue;
      }

      if (pendingSpace) {
        normalized += ' ';
      }
      normalized += char;
      pendingSpace = false;
    }

    return normalized.trim();
  }

  private humanizeIdentifier(value: string): string {
    const normalized = this.normalizeInlineWhitespace(value.replace(/[_-]+/g, ' '));
    return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}.` : 'Story job is running.';
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f' || char === '\v';
  }

  private isAsciiLetterOrDigit(char: string): boolean {
    const code = char.codePointAt(0) ?? 0;
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
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

  trackSkin(index: number, skin: StorySkinOption) {
    return skin.id;
  }

  trackCreature(index: number, creature: CreatureOption) {
    return creature.id;
  }

  trackSpice(index: number, spice: SpiceOption) {
    return spice.level;
  }

  trackHeatTensionOption(index: number, option: HeatContractOption<HeatTensionMode>) {
    return option.id;
  }

  trackHeatBoundaryOption(index: number, option: HeatContractOption<HeatIntimacyBoundary>) {
    return option.id;
  }

  trackContinuationDirection(index: number, direction: ContinuationDirection) {
    return direction.label;
  }

  getFieldError(field: BlueprintValidationField): string | undefined {
    return this.validationErrors()[field];
  }

  hasFieldError(field: BlueprintValidationField): boolean {
    return Boolean(this.getFieldError(field));
  }

  private normalizeHeatContract(contract: HeatContract | undefined): HeatContract {
    return {
      adultOnlyConfirmed: contract?.adultOnlyConfirmed === true,
      tensionMode: contract?.tensionMode ?? 'slow_burn',
      intimacyBoundary: contract?.intimacyBoundary ?? 'fade_to_black',
      noGoContent: contract?.noGoContent ?? ''
    };
  }
}
