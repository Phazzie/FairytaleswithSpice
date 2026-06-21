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
  CloudLibrarySyncState,
  CloudStoryProjectListItem,
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

type NarrativeDialId = 'villain-pressure' | 'chapter-payload' | 'pacing' | 'ending-bet';

type NarrativeDialOption = {
  id: string;
  label: string;
  description: string;
  brief: string;
};

type NarrativeDialOptionDefinition<TId extends string = string> = readonly [
  id: TId,
  label: string,
  description: string,
  brief: string
];

type NarrativeDial = {
  id: NarrativeDialId;
  label: string;
  options: NarrativeDialOption[];
};

type NarrativeDialViewModel = NarrativeDial & {
  selectedOptionId: string;
  selectedDescription: string;
  selectedBrief: string;
};

type SelectedNarrativeDialOptions = Record<NarrativeDialId, string>;

type VillainPressureId = 'antagonist' | 'environment' | 'secret' | 'deadline' | 'inner-desire';

type VillainPressureOption = NarrativeDialOption & {
  id: VillainPressureId;
};

function defineNarrativeDialOptions<TId extends string>(
  definitions: readonly NarrativeDialOptionDefinition<TId>[]
): Array<NarrativeDialOption & { id: TId }> {
  return definitions.map(([id, label, description, brief]) => ({ id, label, description, brief }));
}

function defineNarrativeDial(
  id: NarrativeDialId,
  label: string,
  options: NarrativeDialOption[]
): NarrativeDial {
  return { id, label, options };
}

type DirectorRoomNoteId = 'desire-ledger' | 'continuity-keeper' | 'chapter-ending';

type DirectorRoomNoteStatus = 'pending' | 'accepted' | 'dismissed';

type DirectorRoomNote = {
  id: DirectorRoomNoteId;
  title: string;
  focus: string;
  suggestion: string;
  continuationBrief: string;
  status: DirectorRoomNoteStatus;
  chapterId: string;
};

type GenerationProgressState = {
  active: boolean;
  percent: number;
  stage: string;
  elapsedSeconds: number;
};

type ActiveStoryLabJobState = {
  jobId: string;
  kind: 'genesis' | 'continuation';
  batchId: string;
  batchSize: ChapterBatchSize;
  statusPath: string;
  startedAt: string;
  storyId?: string;
};

type JobStatusPanelState = {
  visible: boolean;
  kind: ActiveStoryLabJobState['kind'];
  tone: 'starting' | 'running' | 'recovering';
  label: string;
  title: string;
  description: string;
  progressPercent: number;
  stage: string;
  jobId?: string;
  statusPath?: string;
  startedAt?: string;
};

type ContinuationJobResult = StoryIterationPayload & { appendedChapterNumbers: number[] };

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
  private readonly activeJobStorageKey = 'fairytales_story_lab_active_job_v1';
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private progressStartedAt = 0;
  private jobDrivenProgress = false;
  private jobCreationSubscription: Subscription | null = null;
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

  readonly villainPressureOptions: VillainPressureOption[] = defineNarrativeDialOptions<VillainPressureId>([
    ['antagonist', 'Antagonist', 'Make the rival or villain act directly.', 'Villain Pressure: Let the antagonist directly raise the cost of the next choice.'],
    ['environment', 'Environment', 'Make the setting itself push back.', 'Villain Pressure: Let the environment itself become dangerous and force a decision.'],
    ['secret', 'Secret', 'Let hidden truth create pressure.', 'Villain Pressure: Let a secret create pressure before anyone fully explains it.'],
    ['deadline', 'Deadline', 'Put the scene under a clock.', 'Villain Pressure: Put the characters under a tight deadline that makes delay costly.'],
    ['inner-desire', 'Inner Desire', 'Make want itself the problem.', 'Villain Pressure: Let inner desire pressure the character into a dangerous choice.']
  ]);

  readonly chapterPayloadOptions: NarrativeDialOption[] = defineNarrativeDialOptions([
    ['romance', 'More romance', 'Put desire under pressure.', 'Chapter Payload: Put desire under pressure and reveal it through behavior, restraint, jealousy, protection, or sacrifice.'],
    ['danger', 'More danger', 'Move the threat close enough that it changes what the characters do next.', 'Chapter Payload: Move the threat close enough that it changes what the characters do next.'],
    ['lore', 'More lore', 'Reveal one world rule and make it personal.', 'Chapter Payload: Reveal one rule of the world, but make it personal and costly.'],
    ['intimacy', 'More intimacy', 'Deepen trust, vulnerability, or consent.', 'Chapter Payload: Deepen trust, vulnerability, or consent through behavior rather than explanation.'],
    ['plot', 'More plot', 'Change the situation in a way nobody can ignore.', 'Chapter Payload: Change the situation in a concrete way that nobody can ignore.']
  ]);

  readonly pacingOptions: NarrativeDialOption[] = defineNarrativeDialOptions([
    ['linger', 'Linger', 'Slow down for texture, longing, and consequence.', 'Pacing: Linger on texture, longing, and consequence before the next turn.'],
    ['balanced', 'Balanced', 'Move plot and emotion together.', 'Pacing: Balance external movement with emotional consequence.'],
    ['escalate', 'Escalate', 'Make each beat cost more than the last.', 'Pacing: Escalate so each beat costs more than the last.'],
    ['sprint', 'Sprint', 'Drive hard toward a cliffhanger.', 'Pacing: Sprint toward a cliffhanger without skipping the emotional cost.']
  ]);

  readonly endingBetOptions: NarrativeDialOption[] = defineNarrativeDialOptions([
    ['revelation', 'Revelation', 'End by making hidden truth visible.', 'Ending Bet: Build the ending around a revelation that changes what came before.'],
    ['betrayal', 'Betrayal', 'End where trust breaks or appears to break.', 'Ending Bet: Build the ending around betrayal, and let behavior make the rupture land.'],
    ['impossible-choice', 'Impossible choice', 'End with no clean option left.', 'Ending Bet: Build the ending around an impossible choice with no clean escape.'],
    ['arrival', 'Arrival', 'End with someone or something entering too late.', 'Ending Bet: End with an arrival that changes the room before anyone is ready.'],
    ['deadline', 'Deadline', 'End when the clock becomes impossible to ignore.', 'Ending Bet: End by making the deadline impossible to ignore.']
  ]);

  readonly narrativeDials: NarrativeDial[] = [
    defineNarrativeDial('villain-pressure', 'Villain Pressure', this.villainPressureOptions),
    defineNarrativeDial('chapter-payload', 'Chapter Payload', this.chapterPayloadOptions),
    defineNarrativeDial('pacing', 'Pacing', this.pacingOptions),
    defineNarrativeDial('ending-bet', 'Ending Bet', this.endingBetOptions)
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
  readonly selectedNarrativeDialOptionIds = signal<SelectedNarrativeDialOptions>({
    'villain-pressure': 'secret',
    'chapter-payload': 'plot',
    pacing: 'balanced',
    'ending-bet': 'revelation'
  });
  readonly directorRoomDecisions = signal<Record<string, DirectorRoomNoteStatus>>({});
  readonly isGenerating = signal(false);
  readonly statusMessage = signal<string>('Tell us what kind of enchanted, spicy story you want.');
  readonly workspaceSaveStatus = signal<string>('No saved stories in this browser yet.');
  readonly savedProjects = signal<SavedStoryProject[]>([]);
  readonly cloudProjects = signal<CloudStoryProjectListItem[]>([]);
  readonly cloudLibrarySyncState = signal<CloudLibrarySyncState>({
    mode: 'cloud_unavailable',
    message: 'Account sync is not connected yet.'
  });
  readonly isCloudLibraryBusy = signal(false);
  readonly generationProgress = signal<GenerationProgressState>({
    active: false,
    percent: 0,
    stage: 'Waiting for your story idea',
    elapsedSeconds: 0
  });
  readonly jobStatusPanel = signal<JobStatusPanelState>(this.createHiddenJobStatusPanel());
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
  readonly narrativeDialViewModels = computed<NarrativeDialViewModel[]>(() => {
    const selections = this.selectedNarrativeDialOptionIds();

    return this.narrativeDials.map(dial => {
      const selectedOption = this.getSelectedNarrativeDialOption(dial, selections);
      return {
        ...dial,
        selectedOptionId: selectedOption.id,
        selectedDescription: selectedOption.description,
        selectedBrief: selectedOption.brief
      };
    });
  });
  readonly selectedVillainPressureId = computed(() =>
    this.selectedNarrativeDialOptionIds()['villain-pressure'] as VillainPressureId
  );
  readonly selectedVillainPressure = computed(() =>
    this.villainPressureOptions.find(option => option.id === this.selectedVillainPressureId()) ?? this.villainPressureOptions[0]
  );

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
  readonly directorRoomNotes = computed<DirectorRoomNote[]>(() => {
    const chapter = this.selectedChapter();
    if (!chapter) {
      return [];
    }

    const blueprint = this.blueprint();
    const continuity = this.continuityPanel();
    const primaryCharacter = continuity.characters[0];
    const primaryThread = continuity.activeThreads[0];
    const primaryArtifact = continuity.unresolvedArtifacts[0];
    const protagonist = primaryCharacter?.displayName || blueprint.protagonistName?.trim() || 'the lead';
    const currentGoal = primaryCharacter?.currentGoal || `make the ${blueprint.creature} desire more costly`;
    const continuityLabel = primaryThread?.label || primaryArtifact?.name || 'the current story thread';
    const continuityDetail = primaryThread?.description || primaryArtifact?.significance || chapter.summary;
    const endingSuggestion = chapter.hasCliffhanger
      ? 'Pay off the current cliffhanger, then open a harder question before the chapter closes.'
      : 'End the next chapter on an impossible choice instead of a quiet fade-out.';
    const baseNotes: Omit<DirectorRoomNote, 'status'>[] = [
      {
        id: 'desire-ledger',
        title: 'Desire Ledger',
        focus: `${protagonist} wants: ${currentGoal}`,
        suggestion: 'Make the next scene force that desire to cost something visible.',
        continuationBrief: `Desire Ledger: Make ${protagonist} actively pursue ${currentGoal}, and make that desire cost something visible.`,
        chapterId: chapter.chapterId
      },
      {
        id: 'continuity-keeper',
        title: 'Continuity Keeper',
        focus: `${continuityLabel}: ${continuityDetail}`,
        suggestion: 'Carry this thread forward on page so the next chapter feels connected.',
        continuationBrief: `Continuity Keeper: Carry forward ${continuityLabel}. ${continuityDetail}`,
        chapterId: chapter.chapterId
      },
      {
        id: 'chapter-ending',
        title: 'Chapter Ending',
        focus: chapter.hasCliffhanger ? 'Current chapter already ends on a cliffhanger.' : 'Current chapter closes without a hard unresolved turn.',
        suggestion: endingSuggestion,
        continuationBrief: `Chapter Ending: ${endingSuggestion}`,
        chapterId: chapter.chapterId
      }
    ];
    const decisions = this.directorRoomDecisions();

    return baseNotes.map(note => ({
      ...note,
      status: decisions[this.getDirectorRoomDecisionKey(note)] ?? 'pending'
    }));
  });
  readonly acceptedDirectorRoomNotes = computed(() =>
    this.directorRoomNotes().filter(note => note.status === 'accepted')
  );
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
  readonly cloudLibraryStatusLabel = computed(() => {
    switch (this.cloudLibrarySyncState().mode) {
      case 'cloud_synced':
        return 'Cloud synced';
      case 'sync_failed':
        return 'Cloud sync failed';
      case 'local_only':
        return 'Local only';
      case 'cloud_unavailable':
        return 'Cloud unavailable';
    }
  });
  readonly cloudLibraryStatusMessage = computed(() => {
    const state = this.cloudLibrarySyncState();
    if (state.message) {
      return state.message;
    }

    if (state.mode === 'cloud_synced') {
      return state.lastSyncedAt
        ? `Last checked ${new Date(state.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
        : 'Cloud library is available.';
    }

    if (state.mode === 'sync_failed') {
      return 'Cloud sync failed. Local browser saves are still available.';
    }

    if (state.mode === 'local_only') {
      return 'This story is saved in this browser.';
    }

    return 'Account sync is not connected yet.';
  });
  readonly cloudAccountStatusLabel = computed(() => {
    switch (this.cloudLibrarySyncState().mode) {
      case 'cloud_synced':
        return 'Connected';
      case 'sync_failed':
        return 'Needs attention';
      case 'local_only':
      case 'cloud_unavailable':
        return 'Not connected';
    }
  });
  readonly cloudAccountActionLabel = computed(() => {
    switch (this.cloudLibrarySyncState().mode) {
      case 'cloud_synced':
        return 'Profile';
      case 'sync_failed':
        return 'Account status';
      case 'local_only':
      case 'cloud_unavailable':
        return 'Connect account';
    }
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
    this.restoreActiveStoryLabJob();
  }

  ngOnDestroy() {
    this.closeJobSubscriptions();
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
    this.showStartingJobStatus('genesis');
    this.setBatchQueue([]);
    this.closeJobSubscriptions();
    const batchId = this.enqueueBatch('Genesis', blueprint.chapterBatchSize);

    const jobCreationSubscription = this.storyService.createStoryLabJob<StoryIterationPayload>({
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
          this.storeActiveStoryLabJob({
            jobId: response.data.job.jobId,
            kind: 'genesis',
            batchId,
            batchSize: blueprint.chapterBatchSize,
            statusPath: response.data.paths.statusPath,
            startedAt: response.data.job.createdAt
          });
          this.openGenesisJobEventStream(response.data.job.jobId, batchId, blueprint.chapterBatchSize);
        }
      },
      error: error => {
        this.jobCreationSubscription = null;
        this.errorLogging.logError(error, 'App.startGenesis');
        const message = this.formatHttpError(error, 'Story generation failed. Please try again in a moment.');
        this.failGenesisJob(batchId, message);
      },
      complete: () => {
        this.jobCreationSubscription = null;
      }
    });
    this.jobCreationSubscription = jobCreationSubscription.closed ? null : jobCreationSubscription;
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
    this.showStartingJobStatus('continuation');
    this.closeJobSubscriptions();
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

    const jobCreationSubscription = this.storyService.createStoryLabJob<ContinuationJobResult>({
      kind: 'continuation',
      continuation: request
    }).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = this.formatApiError(response.error, 'Continuation request failed.');
          this.failContinuationJob(batchId, message);
          return;
        }

        const isTerminal = this.handleContinuationJobSnapshot(response.data.job, batchId, request.chapterBatchSize);
        if (!isTerminal) {
          this.storeActiveStoryLabJob({
            jobId: response.data.job.jobId,
            kind: 'continuation',
            batchId,
            batchSize: request.chapterBatchSize,
            statusPath: response.data.paths.statusPath,
            startedAt: response.data.job.createdAt,
            storyId: request.storyId
          });
          this.openContinuationJobEventStream(response.data.job.jobId, batchId, request.chapterBatchSize);
        }
      },
      error: error => {
        this.jobCreationSubscription = null;
        this.errorLogging.logError(error, 'App.continueSaga');
        const message = this.formatHttpError(error, 'Continuation failed. Your existing chapters are still available.');
        this.failContinuationJob(batchId, message);
      },
      complete: () => {
        this.jobCreationSubscription = null;
      }
    });
    this.jobCreationSubscription = jobCreationSubscription.closed ? null : jobCreationSubscription;
  }

  continueWithDirection(direction: ContinuationDirection) {
    this.continueSaga(this.withNarrativeDialBriefs(direction.brief));
  }

  continueWithCustomDirection() {
    const brief = this.customContinuationBrief().trim();
    if (!brief) {
      this.continueSaga(this.withNarrativeDialBriefs());
      return;
    }

    this.customContinuationBrief.set('');
    this.continueSaga(this.withNarrativeDialBriefs(brief));
  }

  selectNarrativeDialOption(dialId: NarrativeDialId, optionId: string) {
    const dial = this.narrativeDials.find(candidate => candidate.id === dialId);
    if (!dial?.options.some(option => option.id === optionId)) {
      return;
    }

    this.selectedNarrativeDialOptionIds.update(current => ({
      ...current,
      [dialId]: optionId
    }));
  }

  selectVillainPressure(pressureId: VillainPressureId) {
    this.selectNarrativeDialOption('villain-pressure', pressureId);
  }

  acceptDirectorRoomNote(note: DirectorRoomNote) {
    this.setDirectorRoomNoteStatus(note, 'accepted');
  }

  dismissDirectorRoomNote(note: DirectorRoomNote) {
    this.setDirectorRoomNoteStatus(note, 'dismissed');
  }

  useDirectorRoomNoteAsBrief(note: DirectorRoomNote) {
    this.setDirectorRoomNoteStatus(note, 'accepted');
    this.customContinuationBrief.set(note.continuationBrief);
    this.statusMessage.set('Director Room note moved into the custom continuation brief.');
  }

  continueWithDirectorRoomNotes() {
    const acceptedNotes = this.acceptedDirectorRoomNotes();
    if (!acceptedNotes.length) {
      this.notificationService.warning('No Director Room notes selected', 'Accept at least one note before continuing with notes.');
      return;
    }

    this.continueSaga(this.withNarrativeDialBriefs(this.buildDirectorRoomContinuationBrief(acceptedNotes)));
  }

  getSafeHtml(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  resetWorkbench() {
    this.clearActiveStoryLabJob();
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

  refreshCloudLibrary() {
    if (this.isCloudLibraryBusy()) {
      return;
    }

    this.isCloudLibraryBusy.set(true);
    this.storyService.listCloudStoryProjects().subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud library is unavailable.')
          });
          return;
        }

        this.cloudProjects.set(response.data.projects);
        this.cloudLibrarySyncState.set({
          mode: 'cloud_synced',
          lastSyncedAt: new Date().toISOString(),
          message: `${response.data.projects.length} cloud project${response.data.projects.length === 1 ? '' : 's'} loaded.`
        });
      },
      error: error => {
        this.errorLogging.logError(error, 'App.refreshCloudLibrary');
        this.cloudLibrarySyncState.set({
          mode: 'cloud_unavailable',
          message: this.formatHttpError(error, 'Cloud library is unavailable until account sync is configured.')
        });
        this.isCloudLibraryBusy.set(false);
      },
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
  }

  showCloudAccountSetupStatus() {
    if (this.isCloudLibraryBusy()) {
      return;
    }

    if (this.cloudLibrarySyncState().mode === 'cloud_synced') {
      this.cloudLibrarySyncState.update(state => ({
        ...state,
        message: state.message ?? 'Account is connected.'
      }));
      this.notificationService.info('Account connected', 'Cloud sync is available.');
      return;
    }

    this.cloudLibrarySyncState.set({
      mode: 'cloud_unavailable',
      message: 'Sign-in setup is not configured yet. Local browser saves are still available.'
    });
    this.notificationService.info('Account setup pending', 'Sign-in setup is not configured yet.');
  }

  saveActiveProjectToCloud() {
    if (this.isCloudLibraryBusy()) {
      return;
    }

    const project = this.buildSavedProjectFromSession(this.workbench());
    if (!project) {
      this.notificationService.warning('Nothing to save', 'Generate a story before saving to cloud.');
      this.cloudLibrarySyncState.set({
        mode: 'local_only',
        message: 'Generate a story before saving to cloud.'
      });
      return;
    }

    this.isCloudLibraryBusy.set(true);
    this.storyService.saveCloudStoryProject(project).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud save failed.')
          });
          return;
        }

        this.upsertCloudProject(project, response.data.projectId);
        this.cloudLibrarySyncState.set(response.data.syncState);
        this.notificationService.success('Cloud save requested', project.title);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.saveActiveProjectToCloud');
        this.cloudLibrarySyncState.set({
          mode: 'cloud_unavailable',
          message: this.formatHttpError(error, 'Cloud save is unavailable until account sync is configured.')
        });
        this.isCloudLibraryBusy.set(false);
      },
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
  }

  loadCloudProject(projectId: string) {
    if (this.isCloudLibraryBusy()) {
      return;
    }

    this.isCloudLibraryBusy.set(true);
    this.storyService.loadCloudStoryProject(projectId).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud story could not be loaded.')
          });
          return;
        }

        this.hydrateCloudProject(response.data.project);
        this.cloudLibrarySyncState.set({
          mode: 'cloud_synced',
          lastSyncedAt: new Date().toISOString(),
          message: `Loaded "${response.data.project.title}" from cloud.`
        });
      },
      error: error => {
        this.errorLogging.logError(error, 'App.loadCloudProject');
        this.cloudLibrarySyncState.set({
          mode: 'sync_failed',
          message: this.formatHttpError(error, 'Cloud story could not be loaded.')
        });
        this.isCloudLibraryBusy.set(false);
      },
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
  }

  deleteCloudProject(projectId: string) {
    if (this.isCloudLibraryBusy()) {
      return;
    }

    this.isCloudLibraryBusy.set(true);
    this.storyService.deleteCloudStoryProject(projectId).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud delete failed.')
          });
          return;
        }

        this.cloudProjects.set(this.cloudProjects().filter(project => project.projectId !== projectId));
        this.cloudLibrarySyncState.set({
          mode: 'cloud_synced',
          lastSyncedAt: new Date().toISOString(),
          message: response.data.deleted ? 'Cloud story deleted.' : 'Cloud story was already absent.'
        });
      },
      error: error => {
        this.errorLogging.logError(error, 'App.deleteCloudProject');
        this.cloudLibrarySyncState.set({
          mode: 'sync_failed',
          message: this.formatHttpError(error, 'Cloud delete failed.')
        });
        this.isCloudLibraryBusy.set(false);
      },
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
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
    this.updateJobStatusFromJob(job);

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
      this.clearActiveStoryLabJob();
      this.clearJobStatusPanel();
      this.closeJobEventSubscription();
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

  private handleContinuationJobSnapshot(
    job: StoryLabJob<ContinuationJobResult>,
    batchId: string,
    batchSize: ChapterBatchSize
  ): boolean {
    this.updateProgressFromJob(job);
    this.updateJobStatusFromJob(job);

    if (job.status === 'completed') {
      if (!this.hasRenderableIterationPayload(job.result)) {
        this.failContinuationJob(batchId, 'Continuation finished without a valid story payload. Please try again.');
        return true;
      }

      this.applyIteration(job.result, batchSize, batchId);
      this.statusMessage.set('Continuation batch ready. Select a chapter to explore.');
      this.notificationService.success(
        'Continuation ready',
        `Added ${job.result.batch.chapters.length} chapter${job.result.batch.chapters.length === 1 ? '' : 's'} to the saga.`
      );
      this.isGenerating.set(false);
      this.clearActiveStoryLabJob();
      this.clearJobStatusPanel();
      this.closeJobEventSubscription();
      this.stopProgress();
      return true;
    }

    if (job.status === 'failed') {
      this.failContinuationJob(
        batchId,
        this.formatApiError(job.error, 'Continuation failed. Your existing chapters are still available.')
      );
      return true;
    }

    if (job.status === 'cancelled') {
      this.failContinuationJob(batchId, 'Continuation was cancelled before it finished.');
      return true;
    }

    return false;
  }

  private openContinuationJobEventStream(jobId: string, batchId: string, batchSize: ChapterBatchSize) {
    this.closeJobEventSubscription();
    const jobEventSubscription = this.storyService.streamStoryLabJobEvents<ContinuationJobResult>(
      jobId,
      () => undefined
    ).subscribe({
      next: event => {
        this.handleContinuationJobSnapshot(event.job, batchId, batchSize);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.openContinuationJobEventStream');
        const message = this.formatHttpError(error, 'Continuation updates stopped. Your existing chapters are still available.');
        this.failContinuationJob(batchId, message);
      },
      complete: () => {
        this.jobEventSubscription = null;
      }
    });
    this.jobEventSubscription = jobEventSubscription.closed ? null : jobEventSubscription;
  }

  private updateProgressFromJob(job: StoryLabJob<unknown>) {
    const stage = this.formatJobStage(job.currentStep, job.status);
    const progressPercent = this.normalizeJobProgressPercent(job.progressPercent);
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
    this.clearActiveStoryLabJob();
    this.clearJobStatusPanel();
    this.closeJobEventSubscription();
    this.statusMessage.set(message);
    this.markBatchFailed(batchId, message);
    this.notificationService.error('Generation failed', message);
    this.isGenerating.set(false);
    this.stopProgress();
  }

  private hasRenderableIterationPayload(payload: StoryIterationPayload | undefined): payload is StoryIterationPayload {
    return Array.isArray(payload?.batch?.chapters);
  }

  private failContinuationJob(batchId: string, message: string) {
    this.clearActiveStoryLabJob();
    this.clearJobStatusPanel();
    this.closeJobEventSubscription();
    this.statusMessage.set(message);
    this.markBatchFailed(batchId, message);
    this.notificationService.error('Continuation failed', message);
    this.isGenerating.set(false);
    this.stopProgress();
  }

  private closeJobEventSubscription() {
    if (this.jobEventSubscription) {
      this.jobEventSubscription.unsubscribe();
      this.jobEventSubscription = null;
    }
  }

  private closeJobSubscriptions() {
    if (this.jobCreationSubscription) {
      this.jobCreationSubscription.unsubscribe();
      this.jobCreationSubscription = null;
    }

    this.closeJobEventSubscription();
  }

  private restoreActiveStoryLabJob() {
    const activeJob = this.readActiveStoryLabJob();
    if (!activeJob) {
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage.set(activeJob.kind === 'genesis'
      ? 'Restoring your story job...'
      : 'Restoring your continuation job...');
    this.startProgress(activeJob.kind);
    this.ensureRecoveredBatch(activeJob);
    this.showRecoveringJobStatus(activeJob);

    if (activeJob.kind === 'continuation') {
      this.restoreActiveContinuationJob(activeJob);
      return;
    }

    this.storyService.getStoryLabJob<StoryIterationPayload>(activeJob.jobId).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = this.formatApiError(response.error, 'That story job is no longer available.');
          this.failGenesisJob(activeJob.batchId, message);
          return;
        }

        const isTerminal = this.handleGenesisJobSnapshot(response.data.job, activeJob.batchId, activeJob.batchSize);
        if (!isTerminal) {
          this.openGenesisJobEventStream(activeJob.jobId, activeJob.batchId, activeJob.batchSize);
        }
      },
      error: error => {
        this.errorLogging.logError(error, 'App.restoreActiveStoryLabJob');
        const message = this.formatHttpError(error, 'That story job is no longer available.');
        this.failGenesisJob(activeJob.batchId, message);
      }
    });
  }

  private restoreActiveContinuationJob(activeJob: ActiveStoryLabJobState) {
    if (activeJob.storyId && this.workbench().story?.storyId !== activeJob.storyId) {
      const matchingProject = this.findSavedProjectByStoryId(activeJob.storyId);
      if (matchingProject) {
        this.hydrateSavedProject(matchingProject, false);
      }
    }

    const session = this.workbench();
    if (!session.story || !session.state || session.story.storyId !== activeJob.storyId) {
      const message = 'That continuation job needs a saved story before it can be restored.';
      this.statusMessage.set(message);
      this.markBatchFailed(activeJob.batchId, message);
      this.notificationService.warning('Continuation not restored', message);
      this.clearActiveStoryLabJob();
      this.clearJobStatusPanel();
      this.isGenerating.set(false);
      this.stopProgress();
      return;
    }

    this.storyService.getStoryLabJob<ContinuationJobResult>(activeJob.jobId).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = this.formatApiError(response.error, 'That continuation job is no longer available.');
          this.failContinuationJob(activeJob.batchId, message);
          return;
        }

        const isTerminal = this.handleContinuationJobSnapshot(response.data.job, activeJob.batchId, activeJob.batchSize);
        if (!isTerminal) {
          this.openContinuationJobEventStream(activeJob.jobId, activeJob.batchId, activeJob.batchSize);
        }
      },
      error: error => {
        this.errorLogging.logError(error, 'App.restoreActiveContinuationJob');
        const message = this.formatHttpError(error, 'That continuation job is no longer available.');
        this.failContinuationJob(activeJob.batchId, message);
      }
    });
  }

  private ensureRecoveredBatch(activeJob: ActiveStoryLabJobState) {
    if (this.activeBatchQueue().some(item => item.id === activeJob.batchId)) {
      return;
    }

    this.setBatchQueue([
      ...this.activeBatchQueue(),
      {
        id: activeJob.batchId,
        label: activeJob.kind === 'genesis' ? 'Genesis' : 'Continuation',
        batchSize: activeJob.batchSize,
        status: 'in_progress',
        chaptersGenerated: 0,
        totalChapters: activeJob.batchSize,
        submittedAt: activeJob.startedAt
      }
    ]);
  }

  private storeActiveStoryLabJob(activeJob: ActiveStoryLabJobState) {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    try {
      sessionStorage.setItem(this.activeJobStorageKey, JSON.stringify(activeJob));
    } catch {
      this.workspaceSaveStatus.set('Story job progress will last until this tab closes.');
    }
  }

  private readActiveStoryLabJob(): ActiveStoryLabJobState | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    let rawJob: string | null = null;
    try {
      rawJob = sessionStorage.getItem(this.activeJobStorageKey);
      if (!rawJob) {
        return null;
      }

      const parsed = JSON.parse(rawJob) as Partial<ActiveStoryLabJobState>;
      if (
        typeof parsed.jobId === 'string'
        && (parsed.kind === 'genesis' || parsed.kind === 'continuation')
        && typeof parsed.batchId === 'string'
        && this.isChapterBatchSize(parsed.batchSize)
        && typeof parsed.statusPath === 'string'
        && typeof parsed.startedAt === 'string'
        && (parsed.kind === 'genesis' || typeof parsed.storyId === 'string')
      ) {
        return {
          jobId: parsed.jobId,
          kind: parsed.kind,
          batchId: parsed.batchId,
          batchSize: parsed.batchSize,
          statusPath: parsed.statusPath,
          startedAt: parsed.startedAt,
          storyId: parsed.kind === 'continuation' ? parsed.storyId : undefined
        };
      }
    } catch {
      this.clearActiveStoryLabJob();
      return null;
    }

    this.clearActiveStoryLabJob();
    return null;
  }

  private clearActiveStoryLabJob() {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    try {
      sessionStorage.removeItem(this.activeJobStorageKey);
    } catch {
      // Ignore storage cleanup failures; the job state is only a reload hint.
    }
  }

  private isChapterBatchSize(value: unknown): value is ChapterBatchSize {
    return value === 1 || value === 2 || value === 3;
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

  private createHiddenJobStatusPanel(): JobStatusPanelState {
    return {
      visible: false,
      kind: 'genesis',
      tone: 'starting',
      label: '',
      title: '',
      description: '',
      progressPercent: 0,
      stage: ''
    };
  }

  private showStartingJobStatus(kind: ActiveStoryLabJobState['kind']) {
    this.setJobStatusPanel({
      kind,
      tone: 'starting',
      progressPercent: 8,
      stage: this.generationProgress().stage,
      startedAt: new Date().toISOString()
    });
  }

  private showRecoveringJobStatus(activeJob: ActiveStoryLabJobState) {
    this.setJobStatusPanel({
      kind: activeJob.kind,
      tone: 'recovering',
      progressPercent: this.generationProgress().percent || 8,
      stage: this.generationProgress().stage,
      jobId: this.formatShortJobId(activeJob.jobId),
      statusPath: activeJob.statusPath,
      startedAt: activeJob.startedAt
    });
  }

  private updateJobStatusFromJob(job: StoryLabJob<unknown>) {
    const kind: ActiveStoryLabJobState['kind'] = job.kind === 'continuation' ? 'continuation' : 'genesis';
    const current = this.jobStatusPanel();
    const tone = current.visible && current.tone === 'recovering' ? 'recovering' : 'running';
    const stage = this.formatJobStage(job.currentStep, job.status);
    const progressPercent = this.normalizeJobProgressPercent(job.progressPercent);

    this.setJobStatusPanel({
      kind,
      tone,
      progressPercent,
      stage,
      jobId: this.formatShortJobId(job.jobId),
      statusPath: current.visible ? current.statusPath : undefined,
      startedAt: job.createdAt
    });
  }

  private setJobStatusPanel(status: Pick<
    JobStatusPanelState,
    'kind' | 'tone' | 'progressPercent' | 'stage' | 'jobId' | 'statusPath' | 'startedAt'
  >) {
    this.jobStatusPanel.set({
      visible: true,
      ...status,
      label: this.formatJobStatusLabel(status.kind, status.tone),
      title: this.formatJobStatusTitle(status.kind, status.tone),
      description: this.formatJobStatusDescription(status.kind, status.tone)
    });
  }

  private formatJobStatusLabel(kind: ActiveStoryLabJobState['kind'], tone: JobStatusPanelState['tone']): string {
    if (tone === 'recovering') {
      return 'Recovered job';
    }

    return kind === 'genesis' ? 'Story generation' : 'Story continuation';
  }

  private formatJobStatusTitle(kind: ActiveStoryLabJobState['kind'], tone: JobStatusPanelState['tone']): string {
    if (tone === 'recovering') {
      if (kind === 'genesis') {
        return 'First chapter job recovered';
      }

      return 'Continuation job recovered';
    }

    if (tone === 'starting') {
      if (kind === 'genesis') {
        return 'First chapter job starting';
      }

      return 'Continuation job starting';
    }

    if (kind === 'genesis') {
      return 'First chapter job running';
    }

    return 'Continuation job running';
  }

  private formatJobStatusDescription(kind: ActiveStoryLabJobState['kind'], tone: JobStatusPanelState['tone']): string {
    if (tone === 'recovering') {
      if (kind === 'genesis') {
        return 'Resumed from this browser. Story Lab is reconnecting to the first chapter job.';
      }

      return 'Resumed from this browser. Story Lab found the saved story and reconnected to the continuation job.';
    }

    if (kind === 'genesis') {
      if (tone === 'starting') {
        return 'Story Lab is creating a background job for the opening batch.';
      }

      return 'Story Lab is writing the opening batch in a background job.';
    }

    if (tone === 'starting') {
      return 'Story Lab is creating a background job for the next batch.';
    }

    return 'Story Lab is extending the saved story in a background job.';
  }

  private clearJobStatusPanel() {
    this.jobStatusPanel.set(this.createHiddenJobStatusPanel());
  }

  private formatShortJobId(jobId: string | undefined): string | undefined {
    if (!jobId) {
      return undefined;
    }

    return jobId.length <= 16 ? jobId : `${jobId.slice(0, 8)}...${jobId.slice(-4)}`;
  }

  private normalizeJobProgressPercent(progressPercent: number | null | undefined): number {
    return Math.max(0, Math.min(100, Math.round(progressPercent ?? 0)));
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

  private hydrateCloudProject(project: SavedStoryProject) {
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
    this.statusMessage.set('Cloud story loaded. Continue the saga whenever you are ready.');
    this.notificationService.info('Cloud story loaded', project.title);
  }

  private findSavedProjectByStoryId(storyId: string): SavedStoryProject | null {
    return this.workspaceStorage.loadProject(storyId)
      ?? this.workspaceStorage.listProjects().find(project => project.storyId === storyId)
      ?? null;
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
    const project = this.buildSavedProjectFromSession(session);
    if (!project) {
      return undefined;
    }

    const result = this.workspaceStorage.saveProject(project);

    if (!result.success) {
      this.workspaceSaveStatus.set(result.message);
      return undefined;
    }

    this.refreshSavedProjects();
    this.workspaceSaveStatus.set('Saved in this browser.');
    return result.data.id;
  }

  private buildSavedProjectFromSession(session: StoryWorkbenchSession): SavedStoryProject | null {
    if (!session.story || !session.state || !session.chapterHistory.length) {
      return null;
    }

    const now = new Date().toISOString();
    const currentProjectId = session.savedProjectId ?? session.story.storyId;
    const existingProject = this.workspaceStorage.loadProject(currentProjectId);

    return {
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
  }

  private upsertCloudProject(project: SavedStoryProject, projectId = project.id) {
    const nextItem: CloudStoryProjectListItem = {
      projectId,
      storyId: project.storyId,
      title: project.title,
      synopsis: project.synopsis,
      chapterCount: project.chapters.length,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
    const existing = this.cloudProjects().filter(item => item.projectId !== projectId);
    this.cloudProjects.set([nextItem, ...existing]);
  }

  clearFinishedBatchQueue() {
    this.setBatchQueue(this.activeBatchQueue().filter(item => item.status !== 'completed' && item.status !== 'failed'));
  }

  trackBatch(_index: number, batch: BatchProgressState): string {
    return batch.id;
  }

  trackCloudProject(_index: number, project: CloudStoryProjectListItem): string {
    return project.projectId;
  }

  formatBatchStatus(status: BatchProgressState['status']): string {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
    }
  }

  formatBatchChapterProgress(batch: BatchProgressState): string {
    const noun = batch.totalChapters === 1 ? 'chapter' : 'chapters';
    return `${batch.chaptersGenerated} of ${batch.totalChapters} ${noun}`;
  }

  trackDirectorRoomNote(_index: number, note: DirectorRoomNote): string {
    return note.id;
  }

  trackVillainPressure(_index: number, option: VillainPressureOption): string {
    return option.id;
  }

  trackNarrativeDial(_index: number, dial: NarrativeDialViewModel): string {
    return dial.id;
  }

  trackNarrativeDialOption(_index: number, option: NarrativeDialOption): string {
    return option.id;
  }

  formatDirectorRoomNoteStatus(status: DirectorRoomNoteStatus): string {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'dismissed':
        return 'Dismissed';
      case 'pending':
        return 'Pending';
    }
  }

  private setDirectorRoomNoteStatus(note: DirectorRoomNote, status: DirectorRoomNoteStatus) {
    this.directorRoomDecisions.update(current => ({
      ...current,
      [this.getDirectorRoomDecisionKey(note)]: status
    }));
  }

  private getDirectorRoomDecisionKey(note: Pick<DirectorRoomNote, 'chapterId' | 'id'>): string {
    return `${note.chapterId}:${note.id}`;
  }

  private buildDirectorRoomContinuationBrief(notes: DirectorRoomNote[]): string {
    const customBrief = this.customContinuationBrief().trim();
    const directorBrief = [
      'Director Room notes:',
      ...notes.map(note => `- ${note.continuationBrief}`)
    ].join('\n');

    return customBrief ? `${customBrief}\n\n${directorBrief}` : directorBrief;
  }

  private getSelectedNarrativeDialOption(
    dial: NarrativeDial,
    selections: SelectedNarrativeDialOptions
  ): NarrativeDialOption {
    return dial.options.find(option => option.id === selections[dial.id]) ?? dial.options[0];
  }

  private withNarrativeDialBriefs(brief?: string): string {
    const trimmedBrief = brief?.trim();
    const dialBrief = this.narrativeDialViewModels()
      .map(dial => dial.selectedBrief)
      .join('\n');

    return trimmedBrief ? `${trimmedBrief}\n\n${dialBrief}` : dialBrief;
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
