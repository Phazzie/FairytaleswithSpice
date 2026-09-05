import { ComponentFixture, DeferBlockState, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, NEVER, of, Subject, throwError } from 'rxjs';
import { App } from './app';
import { StoryService } from './story.service';
import { AuthService, CLERK_CLIENT_FACTORY, ClerkClient } from './auth.service';
import { CloudLibraryService } from './cloud-library.service';
import { ErrorLoggingService } from './error-logging';
import { NotificationService } from './notification.service';
import { OBJECT_URL_REVOKE_DELAY_MS } from '../../../shared/htmlDocumentDownload';
import {
  ApiResponse,
  AudioConversionSeam,
  CloudStoryProjectDeleteReceipt,
  StoryIterationPayload,
  StoryLabJob,
  StoryLabJobCreationResponse,
  StoryLabJobEvent,
  StoryStateSnapshot,
  StorySummary,
  CloudStoryProjectList,
  CloudStoryProjectLoadResult,
  CloudStoryProjectSaveReceipt,
  CHAPTER_BATCH_SIZES,
  CREATURE_ARCHETYPES,
  EXPORT_FORMATS,
  GeneratedChapter,
  HEAT_INTIMACY_BOUNDARIES,
  HEAT_TENSION_MODES,
  ImageGenerationSeam,
  NARRATIVE_TONES,
  SPICY_LEVELS,
  STORY_LAB_JOB_STEP_LABELS,
  SaveExportSeam,
  SavedStoryProject,
  WORD_BUDGETS
} from './contracts';

const STORAGE_KEY = 'fairytales_story_lab_projects_v1';
const SKIN_STORAGE_KEY = 'fairytales_story_lab_skin_v1';
type GenesisJobOverrides = Partial<StoryLabJobCreationResponse<StoryIterationPayload>['job']>;
type ContinuationJobResult = StoryIterationPayload & { appendedChapterNumbers: number[] };
type ContinuationJobOverrides = Partial<StoryLabJobCreationResponse<ContinuationJobResult>['job']>;
type JobKindForTest = StoryLabJobCreationResponse<unknown>['job']['kind'];

function createChapter(overrides: Partial<GeneratedChapter> = {}): GeneratedChapter {
  return {
    chapterId: overrides.chapterId ?? 'chapter-1',
    chapterNumber: overrides.chapterNumber ?? 1,
    title: overrides.title ?? 'Chapter One',
    htmlContent: overrides.htmlContent ?? '<p>Sample content</p>',
    rawContent: overrides.rawContent ?? '<p>Sample content</p>',
    summary: overrides.summary ?? 'Summary of chapter one.',
    wordCount: overrides.wordCount ?? 900,
    hasCliffhanger: overrides.hasCliffhanger ?? false,
    delta: overrides.delta ?? {
      introducedCharacters: [],
      resolvedThreads: [],
      escalatedThreads: [],
      foreshadowedArtifacts: [],
      continuityFlags: []
    }
  };
}

function createSummary(overrides: Partial<StorySummary> = {}): StorySummary {
  const now = new Date().toISOString();
  return {
    storyId: overrides.storyId ?? 'story-123',
    title: overrides.title ?? 'Crimson Pact',
    synopsis: overrides.synopsis ?? 'A dark romance entwined with ancient oaths.',
    tone: overrides.tone ?? 'dark_romance',
    spicyLevel: overrides.spicyLevel ?? 3,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

/**
 * Seeds a workbench with one story and one chapter — the minimum the
 * download and export actions need to have something to act on. Several of
 * their tests differ only in the story's title/synopsis, which this takes as
 * an override rather than each test rebuilding the whole session shape.
 */
function seedWorkbenchWithSingleChapter(component: App, storyOverrides: Partial<StorySummary> = {}): void {
  component.workbench.set({
    story: createSummary(storyOverrides),
    state: createState(),
    chapterHistory: [createChapter({ title: 'First Ember', htmlContent: '<p>Heat rose.</p>' })],
    activeBatchSize: 1
  });
}

/**
 * Both the story-download and story-export tests drive the same
 * attached-anchor-object-URL mechanic; sharing the spy setup keeps them from
 * drifting into two slightly different fakes of the same browser API.
 */
function spyOnAttachedAnchorDownload(objectUrl: string): { anchor: HTMLAnchorElement; clickSpy: jasmine.Spy } {
  const originalCreateElement = document.createElement.bind(document);
  const anchor = originalCreateElement('a') as HTMLAnchorElement;
  const clickSpy = spyOn(anchor, 'click');
  spyOn(document, 'createElement').and.callFake((tagName: string) => {
    return tagName.toLowerCase() === 'a' ? anchor : originalCreateElement(tagName);
  });
  spyOn(URL, 'createObjectURL').and.returnValue(objectUrl);
  spyOn(URL, 'revokeObjectURL');

  return { anchor, clickSpy };
}

function createState(overrides: Partial<StoryStateSnapshot> = {}): StoryStateSnapshot {
  const now = new Date().toISOString();
  return {
    storyId: overrides.storyId ?? 'story-123',
    revision: overrides.revision ?? 1,
    characters: overrides.characters ?? [],
    threads: overrides.threads ?? [],
    artifacts: overrides.artifacts ?? [],
    beats: overrides.beats ?? [],
    continuityWarnings: overrides.continuityWarnings ?? [],
    narrativeVoice: overrides.narrativeVoice ?? 'Velvet noir',
    lastUpdatedAt: overrides.lastUpdatedAt ?? now
  };
}

function createGenesisJobResponse(
  payload?: StoryIterationPayload,
  overrides: Partial<StoryLabJobCreationResponse<StoryIterationPayload>['job']> = {}
): StoryLabJobCreationResponse<StoryIterationPayload> {
  return createJobResponse({
    kind: 'genesis',
    defaultJobId: 'job_123e4567-e89b-12d3-a456-426614174000',
    payload,
    overrides
  });
}

function createJobResponse<TResult>({
  kind,
  defaultJobId,
  payload,
  overrides = {}
}: {
  kind: JobKindForTest;
  defaultJobId: string;
  payload?: TResult;
  overrides?: Partial<StoryLabJobCreationResponse<TResult>['job']>;
}): StoryLabJobCreationResponse<TResult> {
  const now = new Date().toISOString();
  const jobId = overrides.jobId ?? defaultJobId;

  return {
    job: {
      jobId,
      kind,
      status: overrides.status ?? 'completed',
      currentStep: overrides.currentStep ?? 'completed',
      progressPercent: overrides.progressPercent ?? 100,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
      result: payload,
      error: overrides.error,
      ...overrides
    },
    paths: {
      statusPath: `/api/story-lab/jobs/${jobId}`,
      eventsPath: `/api/story-lab/jobs/${jobId}/events`
    },
    durability: {
      mode: 'non_durable_memory',
      durable: false,
      warning: 'Jobs are held in memory for this deployment.'
    }
  };
}

function createContinuationPayload(
  genesisPayload: StoryIterationPayload,
  overrides: Partial<ContinuationJobResult> = {}
): ContinuationJobResult {
  return {
    ...genesisPayload,
    state: createState({ revision: 2 }),
    batch: {
      chapters: [createChapter({ chapterId: 'chapter-2', chapterNumber: 2 })],
      totalWordCount: 900,
      suggestedNextPrompts: []
    },
    telemetry: {
      engine: 'gpt',
      totalLatencyMs: 1700,
      averageChapterLatencyMs: 850,
      tokensConsumed: 880,
      retryCount: 0
    },
    appendedChapterNumbers: [2],
    ...overrides
  };
}

function createContinuationJobResponse(
  payload?: ContinuationJobResult,
  overrides: ContinuationJobOverrides = {}
): StoryLabJobCreationResponse<ContinuationJobResult> {
  return createJobResponse({
    kind: 'continuation',
    defaultJobId: 'job_223e4567-e89b-12d3-a456-426614174000',
    payload,
    overrides
  });
}

function makePayloadForStory(storyId: string, title: string): Partial<StoryIterationPayload> {
  return {
    summary: createSummary({ storyId, title }),
    state: createState({ storyId }),
    batch: {
      chapters: [createChapter({ chapterId: `${storyId}-chapter-1` })],
      totalWordCount: 900,
      suggestedNextPrompts: []
    }
  };
}

function createMaraMemoryCardState(options: {
  includeThread?: boolean;
  includeArtifact?: boolean;
  artifactName?: string;
  artifactSignificance?: string;
} = {}): StoryStateSnapshot {
  return createState({
    characters: [{
      id: 'mara',
      displayName: 'Mara',
      archetype: 'protagonist',
      summary: 'A siren archivist guarding a forbidden oath.',
      currentGoal: 'Keep the moonlit bargain from consuming her archive.',
      internalConflict: 'She wants the duke and fears the cost.',
      externalConflict: 'Duke Vale wants the same vow.',
      secrets: [],
      relationships: [],
      spiceCompatibilities: [3]
    }],
    threads: options.includeThread === false ? [] : [{
      id: 'oath',
      label: 'Moonlit oath',
      status: 'escalating',
      description: 'The bargain demands a public sacrifice.',
      foreshadowedDevices: []
    }],
    artifacts: options.includeArtifact ? [{
      id: 'memory-artifact',
      name: options.artifactName ?? 'Witness Shell',
      significance: options.artifactSignificance ?? 'The shell repeats any vow spoken near the reef court.',
      introducedInChapter: 1
    }] : []
  });
}

function expectTextOrder(text: string, expectedItems: string[]): void {
  let previousIndex = -1;
  for (const item of expectedItems) {
    const itemIndex = text.indexOf(item);
    expect(itemIndex).withContext(`${item} should be rendered`).toBeGreaterThanOrEqual(0);
    expect(itemIndex).withContext(`${item} should follow the previous memory card`).toBeGreaterThan(previousIndex);
    previousIndex = itemIndex;
  }
}

const confirmedHeatContract = {
  adultOnlyConfirmed: true,
  tensionMode: 'slow_burn' as const,
  intimacyBoundary: 'fade_to_black' as const,
  noGoContent: 'No coercion.'
};

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let component: App;
  let storyService: jasmine.SpyObj<StoryService>;
  let queryParamMap$: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SKIN_STORAGE_KEY);

    const storyServiceSpy = jasmine.createSpyObj<StoryService>('StoryService', [
      'beginStory',
      'continueStory',
      'createStoryLabJob',
      'streamStoryLabJobEvents',
      'getStoryLabAuthConfig',
      'listCloudStoryProjects',
      'saveCloudStoryProject',
      'loadCloudStoryProject',
      'deleteCloudStoryProject',
      'generateImage',
      'convertChapterToAudio',
      'exportStory'
    ]);
    // Every test here constructs `App`, and `App`'s constructor now calls
    // `AuthService.initialize()` unconditionally — this is what that resolves
    // to unless a test overrides it, matching every real deployment that has
    // not configured Clerk.
    storyServiceSpy.getStoryLabAuthConfig.and.returnValue(of({ success: true, data: { provider: 'none' } }));
    // A quiet default for any test that stubs a `running` job creation
    // response without caring about the job-watching path itself — an
    // observable that never emits keeps `watchJobUntilTerminal` harmlessly
    // idle rather than throwing on `undefined.subscribe`. Tests below that do
    // care override this per case.
    storyServiceSpy.streamStoryLabJobEvents.and.returnValue(NEVER);
    const errorLoggingSpy = jasmine.createSpyObj<ErrorLoggingService>('ErrorLoggingService', [
      'logInfo',
      'logError',
      'getErrors'
    ]);
    errorLoggingSpy.getErrors.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy },
        { provide: ErrorLoggingService, useValue: errorLoggingSpy },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$.asObservable() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    storyService = TestBed.inject(StoryService) as jasmine.SpyObj<StoryService>;
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SKIN_STORAGE_KEY);
  });

  function configureValidBlueprint(logline: string) {
    component.blueprint.set({
      ...component.blueprint(),
      logline,
      themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'Forbidden romance.' }],
      heatContract: confirmedHeatContract
    });
  }

  function stubRunningGenesisJob(overrides: GenesisJobOverrides = {}) {
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(undefined, {
        status: 'running',
        currentStep: 'generating_story',
        progressPercent: 32,
        ...overrides
      })
    }));
  }

  function startGenesisJobFlow(logline: string, initialJobOverrides: GenesisJobOverrides = {}) {
    stubRunningGenesisJob(initialJobOverrides);
    configureValidBlueprint(logline);
    component.startGenesis();
  }

  function seedWorkbenchForContinuation(overrides: Partial<StoryIterationPayload> = {}): StoryIterationPayload {
    const payload: StoryIterationPayload = {
      summary: createSummary(),
      batch: {
        chapters: [createChapter()],
        totalWordCount: 900,
        suggestedNextPrompts: []
      },
      state: createState(),
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 1800,
        averageChapterLatencyMs: 900,
        tokensConsumed: 900,
        retryCount: 0
      },
      ...overrides
    };

    component.workbench.set({
      story: payload.summary,
      state: payload.state,
      chapterHistory: payload.batch.chapters,
      activeBatchSize: 1,
      lastTelemetry: payload.telemetry
    });

    return payload;
  }

  function seedMaraMemoryCardWorkbench(options: Parameters<typeof createMaraMemoryCardState>[0] = {}): StoryIterationPayload {
    return seedWorkbenchForContinuation({ state: createMaraMemoryCardState(options) });
  }

  function stubCompletedContinuationJob(genesisPayload: StoryIterationPayload): void {
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));
  }

  function clickFirstMemoryCardDraftAction(testId: 'accept-memory-card-draft' | 'pin-memory-card-draft'): HTMLButtonElement | null {
    const button = renderedMemoryCardDraftsPanel()?.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null;
    button?.click();
    fixture.detectChanges();
    return button;
  }

  function acceptAllMemoryCardDrafts(): void {
    const acceptButtons = Array.from(
      renderedMemoryCardDraftsPanel()?.querySelectorAll('[data-testid="accept-memory-card-draft"]') ?? []
    ) as HTMLButtonElement[];
    expect(acceptButtons.length).toBe(3);
    acceptButtons.forEach(button => button.click());
    fixture.detectChanges();
  }

  function latestContinuationBrief(): string {
    const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
      kind: 'continuation';
      continuation: { continuationBrief?: string };
    };
    expect(jobRequest.kind).toBe('continuation');
    return jobRequest.continuation.continuationBrief ?? '';
  }

  function renderedJobStatusText(targetFixture: ComponentFixture<App> = fixture): string | null {
    targetFixture.detectChanges();
    const panel = targetFixture.nativeElement.querySelector('[data-testid="job-status-panel"]') as HTMLElement | null;
    return panel?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedBatchQueuePanel(targetFixture: ComponentFixture<App> = fixture): HTMLElement | null {
    targetFixture.detectChanges();
    return targetFixture.nativeElement.querySelector('[data-testid="batch-queue-panel"]') as HTMLElement | null;
  }

  function renderedBatchQueueText(targetFixture: ComponentFixture<App> = fixture): string | null {
    return renderedBatchQueuePanel(targetFixture)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedDirectorRoomPanel(targetFixture: ComponentFixture<App> = fixture): HTMLElement | null {
    targetFixture.detectChanges();
    return targetFixture.nativeElement.querySelector('[data-testid="director-room-panel"]') as HTMLElement | null;
  }

  function renderedDirectorRoomText(targetFixture: ComponentFixture<App> = fixture): string | null {
    return renderedDirectorRoomPanel(targetFixture)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedVillainPressureDial(targetFixture: ComponentFixture<App> = fixture): HTMLElement | null {
    targetFixture.detectChanges();
    return targetFixture.nativeElement.querySelector('[data-testid="villain-pressure-dial"]') as HTMLElement | null;
  }

  function renderedVillainPressureText(targetFixture: ComponentFixture<App> = fixture): string | null {
    return renderedVillainPressureDial(targetFixture)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedNarrativeDial(dialId: string, targetFixture: ComponentFixture<App> = fixture): HTMLElement | null {
    targetFixture.detectChanges();
    return targetFixture.nativeElement.querySelector(`[data-testid="narrative-dial"][data-dial-id="${dialId}"]`) as HTMLElement | null;
  }

  function renderedNarrativeDialText(dialId: string, targetFixture: ComponentFixture<App> = fixture): string | null {
    return renderedNarrativeDial(dialId, targetFixture)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedContinuityPreviewText(targetFixture: ComponentFixture<App> = fixture): string | null {
    targetFixture.detectChanges();
    const panel = targetFixture.nativeElement.querySelector('[data-testid="continuity-preview-panel"]') as HTMLElement | null;
    return panel?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedMemoryCardDraftsPanel(targetFixture: ComponentFixture<App> = fixture): HTMLElement | null {
    targetFixture.detectChanges();
    return targetFixture.nativeElement.querySelector('[data-testid="memory-card-drafts-panel"]') as HTMLElement | null;
  }

  function renderedMemoryCardDraftsText(targetFixture: ComponentFixture<App> = fixture): string | null {
    return renderedMemoryCardDraftsPanel(targetFixture)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedAcceptedMemoryCardsPanel(targetFixture: ComponentFixture<App> = fixture): HTMLElement | null {
    targetFixture.detectChanges();
    return targetFixture.nativeElement.querySelector('[data-testid="accepted-memory-cards-panel"]') as HTMLElement | null;
  }

  function renderedAcceptedMemoryCardsText(targetFixture: ComponentFixture<App> = fixture): string | null {
    return renderedAcceptedMemoryCardsPanel(targetFixture)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  function renderedAcceptedMemoryContinuationPreviewText(targetFixture: ComponentFixture<App> = fixture): string | null {
    targetFixture.detectChanges();
    const panel = targetFixture.nativeElement.querySelector('[data-testid="accepted-memory-continuation-preview"]') as HTMLElement | null;
    return panel?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  it('creates the workbench with default blueprint values', () => {
    expect(component.blueprint().creature).toBe('vampire');
    expect(component.blueprint().tone).toBe('dark_romance');
    expect(component.blueprint().spicyLevel).toBe(3);
    expect(component.activeHeatContract().adultOnlyConfirmed).toBeFalse();
    expect(component.workbench().chapterHistory.length).toBe(0);
  });

  it('hides the debug panel unless debug mode is requested', () => {
    expect(component.showDebugPanel()).toBeFalse();
  });

  it('enables the debug panel with the debug query parameter', () => {
    queryParamMap$.next(convertToParamMap({ debug: '1' }));
    expect(component.showDebugPanel()).toBeTrue();
  });

  it('hides the error display panel unless debug mode is requested', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="story-lab-error-display"]')).toBeNull();
  });

  it('mounts the error display panel with the debug query parameter', async () => {
    queryParamMap$.next(convertToParamMap({ debug: '1' }));
    fixture.detectChanges();
    const [deferBlock] = await fixture.getDeferBlocks();
    await deferBlock.render(DeferBlockState.Complete);
    expect(fixture.nativeElement.querySelector('[data-testid="story-lab-error-display"]')).not.toBeNull();
  });

  // Before this, the creature/spice/heat-contract-detail/mood/length/batch
  // controls were shown with the same weight as the fields that actually
  // block generation, even though `FormValidationService.validateBlueprint`
  // never fails on any of them (they all ship with defaults). This is the
  // focused surface — logline, theme picker, adult-confirmation — the reader
  // is actually asked to act on before generating.
  it('shows a focused creation surface with only the fields required to generate', () => {
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('[data-testid="creation-empty-state"]') as HTMLElement | null;
    expect(emptyState).not.toBeNull();
    expect(emptyState?.querySelector('[data-testid="blueprint-logline"]')).not.toBeNull();
    expect(emptyState?.querySelector('[data-testid="theme-chip"]')).not.toBeNull();
    expect(emptyState?.querySelector('[data-testid="heat-contract-adult"]')).not.toBeNull();
    expect(emptyState?.querySelector('[data-testid="creature-card"]')).toBeNull();
    expect(emptyState?.querySelector('[data-testid="spice-card"]')).toBeNull();
  });

  // The creature/spice/heat-contract-detail/mood/length/batch controls all
  // ship with valid defaults, so they are collapsed the same way
  // `<details class="story-details">` already collapses the fully-optional
  // name/world/special-request fields.
  it('keeps the advanced controls collapsed until the reader asks for them', () => {
    fixture.detectChanges();

    const advanced = fixture.nativeElement.querySelector('[data-testid="advanced-controls"]') as HTMLElement | null;
    const toggle = fixture.nativeElement.querySelector('[data-testid="advanced-controls-toggle"]') as HTMLButtonElement | null;

    expect(advanced?.hidden).toBeTrue();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(advanced?.querySelector('[data-testid="creature-card"]')).not.toBeNull();
    expect(advanced?.querySelector('[data-testid="spice-card"]')).not.toBeNull();
    expect(advanced?.querySelector('[data-testid="heat-tension-option"]')).not.toBeNull();
    expect(advanced?.querySelector('[data-testid="blueprint-tone"]')).not.toBeNull();

    toggle?.click();
    fixture.detectChanges();

    expect(advanced?.hidden).toBeFalse();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');

    toggle?.click();
    fixture.detectChanges();

    expect(advanced?.hidden).toBeTrue();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  // Moving these controls behind a disclosure must not change what the form
  // requires — `FormValidationService` is untouched by this, and the toggle
  // is layout only.
  it('still validates and generates using the collapsed advanced controls\' current values', () => {
    stubRunningGenesisJob();
    configureValidBlueprint('A vampire princess bound by forbidden vows.');
    fixture.detectChanges();

    component.startGenesis();

    expect(storyService.createStoryLabJob).toHaveBeenCalled();
    expect(storyService.createStoryLabJob.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      kind: 'genesis',
      blueprint: jasmine.objectContaining({
        creature: 'vampire',
        spicyLevel: 3
      })
    }));
  });

  it('toggles theme selections', () => {
    expect(component.blueprint().themes.length).toBe(0);

    component.toggleTheme({ id: 'forbidden_love', label: 'Forbidden Love', description: '' });
    expect(component.blueprint().themes.length).toBe(1);

    component.toggleTheme({ id: 'forbidden_love', label: 'Forbidden Love', description: '' });
    expect(component.blueprint().themes.length).toBe(0);
  });

  it('selects and persists a visual skin without changing story inputs', () => {
    const initialBlueprint = component.blueprint();

    component.selectSkin('bookshop');

    expect(component.activeSkin()).toBe('bookshop');
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('bookshop');
    expect(component.blueprint()).toEqual(initialBlueprint);
  });

  it('supports the expanded creature set and spice labels', () => {
    expect(component.creatureOptions.map(option => option.id)).toContain('dragon');
    expect(component.creatureOptions.map(option => option.id)).toContain('mermaid');

    component.updateBlueprint('creature', 'dragon');
    component.updateBlueprint('spicyLevel', 5);

    expect(component.blueprint().creature).toBe('dragon');
    expect(component.activeSpiceOption().label).toBe('Inferno');
  });

  // The pickers are what a reader may actually send, so a value the
  // vocabularies name and the form does not offer is accepted by the parser,
  // by `FormValidationService`, and by every prompt builder, and can be chosen
  // nowhere — with nothing to fail and nothing on the page to say it is
  // missing. Compared as ordered lists so a picker cannot satisfy this by
  // offering the values in an order the vocabulary does not state.
  it('offers every value of every blueprint vocabulary', () => {
    expect(component.creatureOptions.map(option => option.id)).toEqual([...CREATURE_ARCHETYPES]);
    expect(component.spiceOptions.map(option => option.level)).toEqual([...SPICY_LEVELS]);
    expect(component.heatTensionOptions.map(option => option.id)).toEqual([...HEAT_TENSION_MODES]);
    expect(component.heatBoundaryOptions.map(option => option.id)).toEqual([...HEAT_INTIMACY_BOUNDARIES]);
    expect(component.toneOptions.map(option => option.id)).toEqual([...NARRATIVE_TONES]);
    expect(component.wordBudgetOptions.map(option => option.id)).toEqual([...WORD_BUDGETS]);
    expect(component.chapterBatchOptions.map(option => option.id)).toEqual([...CHAPTER_BATCH_SIZES]);
  });

  // The three `<select>`s were hand-written `<option>` elements, which is the
  // same second declaration one layer further from anything that can check it.
  it('renders one option per value in the three blueprint selects', () => {
    fixture.detectChanges();

    for (const [testId, expected] of [
      ['blueprint-tone', NARRATIVE_TONES],
      ['blueprint-word-budget', WORD_BUDGETS],
      ['blueprint-chapter-batch-size', CHAPTER_BATCH_SIZES]
    ] as const) {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
      expect(select.options.length).toBe(expected.length);
    }
  });

  it('does not render story actions before a story exists', () => {
    fixture.detectChanges();

    const storyPanel = fixture.nativeElement.querySelector('[data-testid="story-panel"]') as HTMLElement | null;
    const storyActions = fixture.nativeElement.querySelector('[data-testid="story-header-actions"]') as HTMLElement | null;

    expect(storyPanel).toBeNull();
    expect(storyActions).toBeNull();
  });

  it('shows story actions when a story is active and adds action labels', () => {
    seedWorkbenchForContinuation();
    fixture.detectChanges();

    const storyPanel = fixture.nativeElement.querySelector('[data-testid="story-panel"]') as HTMLElement | null;
    const storyActions = fixture.nativeElement.querySelector('[data-testid="story-header-actions"]') as HTMLElement | null;
    const copyButton = storyActions?.querySelector('[data-testid="copy-story"]') as HTMLButtonElement | null;
    const downloadButton = storyActions?.querySelector('[data-testid="download-story"]') as HTMLButtonElement | null;
    const saveButton = storyActions?.querySelector('[data-testid="save-story"]') as HTMLButtonElement | null;
    const generateImageButton = storyActions?.querySelector('[data-testid="generate-image"]') as HTMLButtonElement | null;

    expect(storyPanel).not.toBeNull();
    expect(storyActions).not.toBeNull();
    expect(copyButton?.getAttribute('aria-label')).toBe('Copy story');
    expect(downloadButton?.getAttribute('aria-label')).toBe('Download story');
    expect(saveButton?.getAttribute('aria-label')).toBe('Save story locally');
    expect(generateImageButton?.getAttribute('aria-label')).toBe('Generate a scene image for this chapter');
    expect(generateImageButton?.disabled).toBeFalse();
  });

  it('generates and displays a scene image for the selected chapter', () => {
    const payload = seedWorkbenchForContinuation();
    const chapter = payload.batch.chapters[0];
    const image: ImageGenerationSeam['output'] = {
      imageId: 'img-1',
      storyId: payload.summary.storyId,
      imageUrl: 'https://images.example/scene.png',
      prompt: 'A gothic vampire scene',
      style: 'dark',
      aspectRatio: '16:9',
      width: 1792,
      height: 1024,
      fileSize: 0,
      generatedAt: new Date()
    };
    storyService.generateImage.and.returnValue(of({ success: true, data: image }));
    fixture.detectChanges();

    const generateImageButton = fixture.nativeElement.querySelector('[data-testid="generate-image"]') as HTMLButtonElement;
    generateImageButton.click();
    fixture.detectChanges();

    expect(storyService.generateImage).toHaveBeenCalledWith(jasmine.objectContaining({
      storyId: payload.summary.storyId,
      content: chapter.htmlContent,
      creature: component.blueprint().creature,
      style: 'artistic'
    }));
    expect(component.isGeneratingImage()).toBeFalse();

    const preview = fixture.nativeElement.querySelector('[data-testid="chapter-image-preview"]') as HTMLImageElement | null;
    expect(preview?.src).toBe(image.imageUrl);
  });

  it('keeps each chapter\'s generated image independent of the others', () => {
    seedWorkbenchForContinuation({
      batch: {
        chapters: [
          createChapter({ chapterId: 'chapter-1', chapterNumber: 1 }),
          createChapter({ chapterId: 'chapter-2', chapterNumber: 2, title: 'Chapter Two' })
        ],
        totalWordCount: 1800,
        suggestedNextPrompts: []
      }
    });

    const imageOne: ImageGenerationSeam['output'] = {
      imageId: 'img-1',
      storyId: 'story-123',
      imageUrl: 'https://images.example/chapter-one.png',
      prompt: 'Chapter one scene',
      style: 'dark',
      aspectRatio: '16:9',
      width: 1792,
      height: 1024,
      fileSize: 0,
      generatedAt: new Date()
    };
    const imageTwo: ImageGenerationSeam['output'] = {
      ...imageOne,
      imageId: 'img-2',
      imageUrl: 'https://images.example/chapter-two.png'
    };

    component.selectChapter('chapter-1');
    storyService.generateImage.and.returnValue(of({ success: true, data: imageOne }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="generate-image"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    component.selectChapter('chapter-2');
    storyService.generateImage.and.returnValue(of({ success: true, data: imageTwo }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="generate-image"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('[data-testid="chapter-image-preview"]') as HTMLImageElement).src)
      .toBe(imageTwo.imageUrl);

    component.selectChapter('chapter-1');
    fixture.detectChanges();

    const chapterOnePreview = fixture.nativeElement.querySelector('[data-testid="chapter-image-preview"]') as HTMLImageElement | null;
    expect(chapterOnePreview?.src).toBe(imageOne.imageUrl);
  });

  it('restores generated chapter images from a browser-local saved project', () => {
    const payload = seedWorkbenchForContinuation();
    const chapter = payload.batch.chapters[0];
    const image: ImageGenerationSeam['output'] = {
      imageId: 'img-1',
      storyId: payload.summary.storyId,
      imageUrl: 'https://images.example/restored-scene.png',
      prompt: 'A gothic vampire scene',
      style: 'dark',
      aspectRatio: '16:9',
      width: 1792,
      height: 1024,
      fileSize: 0,
      generatedAt: new Date()
    };
    storyService.generateImage.and.returnValue(of({ success: true, data: image }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="generate-image"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[data-testid="chapter-image-preview"]') as HTMLImageElement | null)?.src)
      .toBe(image.imageUrl);

    component.saveActiveProject();
    component.resetWorkbench();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="chapter-image-preview"]')).toBeNull();

    component.loadSavedProject(payload.summary.storyId);
    component.selectChapter(chapter.chapterId);
    fixture.detectChanges();

    const restoredPreview = fixture.nativeElement.querySelector('[data-testid="chapter-image-preview"]') as HTMLImageElement | null;
    expect(restoredPreview?.src).toBe(image.imageUrl);
  });

  it('shows an error instead of an image when generation fails', () => {
    seedWorkbenchForContinuation();
    storyService.generateImage.and.returnValue(of({
      success: false,
      error: { code: 'IMAGE_GENERATION_FAILED', message: 'AI image service temporarily unavailable', retryable: true, reason: 'service_error' }
    }));
    fixture.detectChanges();

    const generateImageButton = fixture.nativeElement.querySelector('[data-testid="generate-image"]') as HTMLButtonElement;
    generateImageButton.click();
    fixture.detectChanges();

    const errorText = fixture.nativeElement.querySelector('[data-testid="chapter-image-error"]') as HTMLElement | null;
    const preview = fixture.nativeElement.querySelector('[data-testid="chapter-image-preview"]') as HTMLImageElement | null;
    expect(errorText?.textContent?.trim()).toBe('AI image service temporarily unavailable');
    expect(preview).toBeNull();
  });

  // The image panel belongs to the chapter on screen, and the `<img>` has
  // always known it: the preview is drawn only when the stored image names the
  // selected chapter. The error had no such check and nothing cleared it, so a
  // refusal earned by one chapter stayed pinned under every chapter the reader
  // opened afterwards, describing a request that was never made for them.
  it('keeps an image failure under the chapter that earned it', () => {
    seedWorkbenchForContinuation({
      batch: {
        chapters: [
          createChapter({ chapterId: 'chapter-1', chapterNumber: 1 }),
          createChapter({ chapterId: 'chapter-2', chapterNumber: 2, title: 'Chapter Two' })
        ],
        totalWordCount: 1800,
        suggestedNextPrompts: []
      }
    });
    component.selectChapter('chapter-1');
    storyService.generateImage.and.returnValue(of({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Themes are required and must be a non-empty array' }
    }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="generate-image"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const failedChapterError = fixture.nativeElement.querySelector('[data-testid="chapter-image-error"]') as HTMLElement | null;
    expect(failedChapterError?.textContent?.trim()).toBe('Themes are required and must be a non-empty array');

    component.selectChapter('chapter-2');
    fixture.detectChanges();

    expect(component.imageGenerationError()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="chapter-image-error"]')).toBeNull();

    component.selectChapter('chapter-1');
    fixture.detectChanges();

    expect(component.imageGenerationError()).toBe('Themes are required and must be a non-empty array');
  });

  it('narrates and plays back audio for the selected chapter', () => {
    const payload = seedWorkbenchForContinuation();
    const chapter = payload.batch.chapters[0];
    const audio: AudioConversionSeam['output'] = {
      audioId: 'audio-1',
      storyId: payload.summary.storyId,
      audioUrl: 'data:audio/wav;base64,UklGRg==',
      format: 'wav',
      duration: 4.2,
      voiceUsed: ['mock_voice_abc123'],
      generatedAt: new Date()
    };
    storyService.convertChapterToAudio.and.returnValue(of({ success: true, data: audio }));
    fixture.detectChanges();

    const narrateButton = fixture.nativeElement.querySelector('[data-testid="generate-audio"]') as HTMLButtonElement;
    narrateButton.click();
    fixture.detectChanges();

    expect(storyService.convertChapterToAudio).toHaveBeenCalledWith(jasmine.objectContaining({
      storyId: payload.summary.storyId,
      chapterId: chapter.chapterId
    }));
    expect(component.isGeneratingAudio()).toBeFalse();

    const player = fixture.nativeElement.querySelector('[data-testid="chapter-audio-player"]') as HTMLAudioElement | null;
    expect(player?.src).toBe(audio.audioUrl);
  });

  // A retry used to leave a prior success's player on screen underneath a
  // new failure message, where it read as this attempt's result rather than
  // a stale leftover from before.
  it('clears a previous player when a retry fails', () => {
    seedWorkbenchForContinuation();
    const audio: AudioConversionSeam['output'] = {
      audioId: 'audio-1',
      storyId: 'story-123',
      audioUrl: 'data:audio/wav;base64,UklGRg==',
      format: 'wav',
      duration: 4.2,
      voiceUsed: ['mock_voice_abc123'],
      generatedAt: new Date()
    };
    storyService.convertChapterToAudio.and.returnValue(of({ success: true, data: audio }));
    fixture.detectChanges();

    const narrateButton = fixture.nativeElement.querySelector('[data-testid="generate-audio"]') as HTMLButtonElement;
    narrateButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="chapter-audio-player"]')).not.toBeNull();

    storyService.convertChapterToAudio.and.returnValue(of({
      success: false,
      error: { code: 'AUDIO_GENERATION_FAILED', message: 'AI audio narration service temporarily unavailable', retryable: true }
    }));
    narrateButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="chapter-audio-player"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="chapter-audio-error"]')?.textContent?.trim())
      .toBe('AI audio narration service temporarily unavailable');
  });

  it('shows an error instead of a player when narration fails', () => {
    seedWorkbenchForContinuation();
    storyService.convertChapterToAudio.and.returnValue(of({
      success: false,
      error: { code: 'AUDIO_GENERATION_FAILED', message: 'AI audio narration service temporarily unavailable', retryable: true }
    }));
    fixture.detectChanges();

    const narrateButton = fixture.nativeElement.querySelector('[data-testid="generate-audio"]') as HTMLButtonElement;
    narrateButton.click();
    fixture.detectChanges();

    const errorText = fixture.nativeElement.querySelector('[data-testid="chapter-audio-error"]') as HTMLElement | null;
    const player = fixture.nativeElement.querySelector('[data-testid="chapter-audio-player"]') as HTMLAudioElement | null;
    expect(errorText?.textContent?.trim()).toBe('AI audio narration service temporarily unavailable');
    expect(player).toBeNull();
  });

  it('disables the narrate button while a request is in flight', () => {
    seedWorkbenchForContinuation();
    const pending = new Subject<ApiResponse<AudioConversionSeam['output']>>();
    storyService.convertChapterToAudio.and.returnValue(pending.asObservable());
    fixture.detectChanges();

    const narrateButton = fixture.nativeElement.querySelector('[data-testid="generate-audio"]') as HTMLButtonElement;
    narrateButton.click();
    fixture.detectChanges();

    expect(component.isGeneratingAudio()).toBeTrue();
    expect(narrateButton.disabled).toBeTrue();
    expect(narrateButton.textContent?.trim()).toBe('Narrating…');
  });

  // `/api/audio/convert` answers `AUDIO_GENERATION_FAILED` as a real HTTP
  // status, not a `200` with `success: false`, so a provider failure arrives
  // on the error channel — the same shape the export test above covers.
  // `formatApiError` used to rewrite any "temporarily unavailable" message
  // into "Grok is temporarily unavailable", telling the reader the wrong
  // service had failed; it must now pass this seam's own message through.
  it('reports the audio service\'s own failure rather than blaming Grok', () => {
    seedWorkbenchForContinuation();
    storyService.convertChapterToAudio.and.returnValue(throwError(() => ({
      status: 500,
      error: {
        success: false,
        error: {
          code: 'AUDIO_GENERATION_FAILED',
          message: 'AI audio narration service temporarily unavailable',
          retryable: true
        }
      }
    })));

    component.generateChapterAudio();

    expect(component.isGeneratingAudio()).toBeFalse();
    expect(component.audioGenerationError()).toBe('AI audio narration service temporarily unavailable');
  });

  // `storyLabEngine` deliberately preserves an empty `rawContent` as a
  // supported chapter state; narrating from it with `??` used to select that
  // empty string over the visible `htmlContent` and refuse the request as
  // missing content instead of narrating the chapter the reader can see.
  it('narrates from htmlContent when rawContent is blank', () => {
    seedWorkbenchForContinuation({
      batch: {
        chapters: [createChapter({ rawContent: '', htmlContent: '<p>She opened the door.</p>' })],
        totalWordCount: 900,
        suggestedNextPrompts: []
      }
    });
    storyService.convertChapterToAudio.and.returnValue(of({
      success: true,
      data: {
        audioId: 'audio-1',
        storyId: 'story-123',
        audioUrl: 'data:audio/wav;base64,UklGRg==',
        format: 'wav',
        duration: 1,
        voiceUsed: ['mock_voice_abc123'],
        generatedAt: new Date()
      }
    }));

    component.generateChapterAudio();

    expect(storyService.convertChapterToAudio).toHaveBeenCalledWith(jasmine.objectContaining({
      content: '<p>She opened the door.</p>'
    }));
  });

  // A word-boundary slice can still land inside a multiword speaker tag —
  // `[Lord Damien, voice: velvet-smoke]:` split after `[Lord` used to reach
  // the backend as an unrecognizable bracket fragment, spoken aloud in the
  // preceding speaker's voice instead of read as a tag.
  it('drops a speaker tag split by the excerpt boundary instead of sending the fragment', () => {
    const filler = new Array(397).fill('filler').join(' ');
    const tail = new Array(60).fill('more').join(' ');
    const rawContent = `${filler} [Lord Damien, voice: velvet-smoke]: "Stop," she said. ${tail}`;

    seedWorkbenchForContinuation({
      batch: {
        chapters: [createChapter({ rawContent, htmlContent: rawContent })],
        totalWordCount: 900,
        suggestedNextPrompts: []
      }
    });
    storyService.convertChapterToAudio.and.returnValue(of({
      success: true,
      data: {
        audioId: 'audio-1',
        storyId: 'story-123',
        audioUrl: 'data:audio/wav;base64,UklGRg==',
        format: 'wav',
        duration: 1,
        voiceUsed: ['mock_voice_abc123'],
        generatedAt: new Date()
      }
    }));

    component.generateChapterAudio();

    const sentContent = (storyService.convertChapterToAudio.calls.mostRecent().args[0] as { content: string }).content;
    expect(sentContent).not.toContain('[');
    expect(sentContent.trim().split(/\s+/)).toEqual(new Array(397).fill('filler'));
  });

  // The picker used to restate the export format list by hand and had lost
  // `html` — the one format the export route renders that no reader could then
  // ask for.
  it('offers every export format the route renders', () => {
    fixture.detectChanges();

    expect(component.exportFormats).toEqual(EXPORT_FORMATS);
    expect(component.exportFormats).toContain('html');
  });

  it('disables cloud save before an active story exists', () => {
    fixture.detectChanges();

    const cloudPanel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const cloudActions = cloudPanel?.querySelector('[data-testid="cloud-library-actions"]') as HTMLElement | null;
    const cloudSaveButton = cloudActions?.querySelector('[data-testid="cloud-save"]') as HTMLButtonElement | null;

    expect(cloudSaveButton?.disabled).toBeTrue();
    expect(cloudSaveButton?.getAttribute('aria-label')).toBe('Save story to cloud');
  });

  it('renders cloud library as unavailable without replacing local browser saves', () => {
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const accountState = panel?.querySelector('[data-testid="cloud-account-state"]') as HTMLElement | null;
    const text = panel?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const accountText = accountState?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const fullText = fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();

    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(text).toContain('Cloud account');
    expect(text).toContain('Cloud unavailable');
    expect(accountText).toContain('Account Not connected');
    expect(fullText).toContain('Saved here');
  });

  it('shows an honest account setup action before sign-in is configured', async () => {
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const accountAction = panel?.querySelector('[data-testid="cloud-account-action"]') as HTMLButtonElement | null;

    expect(accountAction?.textContent?.trim()).toBe('Connect account');

    accountAction?.click();
    // `showCloudAccountSetupStatus()` now awaits `AuthService.signIn()`
    // (which itself awaits `initialize()`) before deciding the deployment
    // is unconfigured, so the message lands a couple of microtask turns
    // after the click rather than synchronously with it.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const fullText = fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
    expect(storyService.listCloudStoryProjects).not.toHaveBeenCalled();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(fullText).toContain('Sign-in setup is not configured yet.');
    expect(fullText).toContain('Saved here');
  });

  it('blocks cloud save until the account is connected', async () => {
    seedWorkbenchForContinuation();
    storyService.saveCloudStoryProject.and.returnValue(of({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Account required.'
      }
    } as ApiResponse<CloudStoryProjectSaveReceipt>));

    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const saveButton = Array.from(panel?.querySelectorAll('button') ?? [])
      .find(button => button.textContent?.includes('Save to cloud')) as HTMLButtonElement | undefined;

    expect(saveButton?.disabled).toBeTrue();

    component.saveActiveProjectToCloud();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const fullText = fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
    expect(storyService.saveCloudStoryProject).not.toHaveBeenCalled();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(fullText).toContain('Sign-in setup is not configured yet.');
  });

  it('blocks cloud load and delete until the account is connected', async () => {
    component.cloudProjects.set([{
      projectId: 'project-cloud',
      storyId: 'story-cloud',
      title: 'Cloud Chapel',
      synopsis: 'A cloud-synced oath.',
      chapterCount: 2,
      acceptedMemoryCardCount: 0,
      createdAt: '2026-06-08T08:37:00.000Z',
      updatedAt: '2026-06-08T08:38:00.000Z'
    }]);
    storyService.loadCloudStoryProject.and.returnValue(of({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Account required.'
      }
    } as ApiResponse<any>));
    storyService.deleteCloudStoryProject.and.returnValue(of({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Account required.'
      }
    } as ApiResponse<any>));

    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const loadButton = panel?.querySelector('.saved-load') as HTMLButtonElement | null;
    const deleteButton = panel?.querySelector('.saved-delete') as HTMLButtonElement | null;

    expect(loadButton?.disabled).toBeTrue();
    expect(deleteButton?.disabled).toBeTrue();

    component.loadCloudProject('project-cloud');
    component.deleteCloudProject('project-cloud');
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const fullText = fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
    expect(storyService.loadCloudStoryProject).not.toHaveBeenCalled();
    expect(storyService.deleteCloudStoryProject).not.toHaveBeenCalled();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(fullText).toContain('Sign-in setup is not configured yet.');
  });

  it('refreshes visible cloud projects through the account service', () => {
    const cloudList: CloudStoryProjectList = {
      ownerUserId: 'user-owner',
      storageMode: 'cloud_postgres',
      projects: [{
        projectId: 'project-cloud',
        storyId: 'story-cloud',
        title: 'Cloud Chapel',
        synopsis: 'A cloud-synced oath.',
        chapterCount: 2,
        acceptedMemoryCardCount: 0,
        createdAt: '2026-06-08T08:37:00.000Z',
        updatedAt: '2026-06-08T08:38:00.000Z'
      }],
      totalProjectCount: 1
    };
    storyService.listCloudStoryProjects.and.returnValue(of({ success: true, data: cloudList }));

    component.refreshCloudLibrary();
    fixture.detectChanges();

    expect(storyService.listCloudStoryProjects).toHaveBeenCalled();
    expect(component.cloudProjects().length).toBe(1);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_synced');
    expect(component.cloudLibrarySyncState().message).toBe('1 cloud project loaded.');
    expect(fixture.nativeElement.textContent).toContain('Cloud Chapel');
  });

  // The account route caps the listing at `STORY_LAB_LIBRARY_MAX_ITEMS`, so a
  // page that reports only its own length reads exactly like a complete
  // library — "the story I saved yesterday is gone" and "it is past the cap"
  // looked the same. `totalProjectCount` is what separates them, and this is
  // the only place a reader ever sees the difference.
  it('says how many cloud projects the account holds when the listing is capped', () => {
    const cloudList: CloudStoryProjectList = {
      ownerUserId: 'user-owner',
      storageMode: 'cloud_postgres',
      projects: [{
        projectId: 'project-cloud',
        storyId: 'story-cloud',
        title: 'Cloud Chapel',
        synopsis: 'A cloud-synced oath.',
        chapterCount: 2,
        acceptedMemoryCardCount: 0,
        createdAt: '2026-06-08T08:37:00.000Z',
        updatedAt: '2026-06-08T08:38:00.000Z'
      }],
      totalProjectCount: 61
    };
    storyService.listCloudStoryProjects.and.returnValue(of({ success: true, data: cloudList }));

    component.refreshCloudLibrary();
    fixture.detectChanges();

    expect(component.cloudLibrarySyncState().message).toBe('1 of 61 cloud projects loaded.');
  });

  it('does not mark cloud library synced when account storage is non-durable', () => {
    const cloudList: CloudStoryProjectList = {
      ownerUserId: 'user-owner',
      storageMode: 'non_durable_memory',
      projects: [{
        projectId: 'project-cloud',
        storyId: 'story-cloud',
        title: 'Cloud Chapel',
        synopsis: 'A cloud route backed by non-durable memory.',
        chapterCount: 2,
        acceptedMemoryCardCount: 0,
        createdAt: '2026-06-08T08:37:00.000Z',
        updatedAt: '2026-06-08T08:38:00.000Z'
      }],
      totalProjectCount: 1
    };
    storyService.listCloudStoryProjects.and.returnValue(of({ success: true, data: cloudList }));

    component.refreshCloudLibrary();
    fixture.detectChanges();

    expect(component.cloudProjects().length).toBe(1);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(component.cloudLibrarySyncState().message).toContain('non-durable account storage');
    expect(fixture.nativeElement.textContent).toContain('Cloud unavailable');
    expect(fixture.nativeElement.textContent).toContain('Cloud Chapel');
  });

  it('renders accepted memory counts in cloud and local library rows without card text', () => {
    const cloudList: CloudStoryProjectList = {
      ownerUserId: 'user-owner',
      storageMode: 'cloud_postgres',
      projects: [{
        projectId: 'project-cloud',
        storyId: 'story-cloud',
        title: 'Cloud Chapel',
        synopsis: 'A cloud-synced oath.',
        chapterCount: 2,
        acceptedMemoryCardCount: 2,
        createdAt: '2026-06-08T08:37:00.000Z',
        updatedAt: '2026-06-08T08:38:00.000Z'
      }],
      totalProjectCount: 1
    };
    storyService.listCloudStoryProjects.and.returnValue(of({ success: true, data: cloudList }));
    component.refreshCloudLibrary();

    seedWorkbenchForContinuation();
    component.acceptedMemoryCards.set([{
      id: 'accepted-card-private',
      label: 'Promise',
      title: 'Moonlit Oath',
      detail: 'Private accepted memory detail should not appear in project list metadata.',
      triggerLabel: 'Trigger: oath',
      acceptedAt: '2026-06-08T08:39:00.000Z'
    }]);
    component.saveActiveProject();
    fixture.detectChanges();

    const cloudMeta = fixture.nativeElement.querySelector('[data-testid="cloud-project-meta"]') as HTMLElement | null;
    const localMeta = fixture.nativeElement.querySelector('[data-testid="local-project-meta"]') as HTMLElement | null;

    expect(cloudMeta?.textContent).toContain('2 memory cards');
    expect(localMeta?.textContent).toContain('1 memory card');
    expect(cloudMeta?.textContent).not.toContain('Private accepted memory detail');
    expect(localMeta?.textContent).not.toContain('Private accepted memory detail');
  });

  it('renders zero accepted memory counts when project metadata is present', () => {
    const cloudList: CloudStoryProjectList = {
      ownerUserId: 'user-owner',
      storageMode: 'cloud_postgres',
      projects: [{
        projectId: 'project-cloud',
        storyId: 'story-cloud',
        title: 'Cloud Chapel',
        synopsis: 'A cloud-synced oath.',
        chapterCount: 2,
        acceptedMemoryCardCount: 0,
        createdAt: '2026-06-08T08:37:00.000Z',
        updatedAt: '2026-06-08T08:38:00.000Z'
      }],
      totalProjectCount: 1
    };
    storyService.listCloudStoryProjects.and.returnValue(of({ success: true, data: cloudList }));
    component.refreshCloudLibrary();

    seedWorkbenchForContinuation();
    component.acceptedMemoryCards.set([]);
    component.saveActiveProject();
    fixture.detectChanges();

    const cloudMeta = fixture.nativeElement.querySelector('[data-testid="cloud-project-meta"]') as HTMLElement | null;
    const localMeta = fixture.nativeElement.querySelector('[data-testid="local-project-meta"]') as HTMLElement | null;

    expect(cloudMeta?.textContent).toContain('0 memory cards');
    expect(localMeta?.textContent).toContain('0 memory cards');
  });

  it('renders malformed browser-local accepted memory metadata as zero count', () => {
    seedWorkbenchForContinuation();
    component.saveActiveProject();

    const savedProjects = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>;
    savedProjects[0]['acceptedMemoryCards'] = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProjects));

    const recoveredFixture = TestBed.createComponent(App);

    expect(() => recoveredFixture.detectChanges()).not.toThrow();
    const localMeta = recoveredFixture.nativeElement.querySelector('[data-testid="local-project-meta"]') as HTMLElement | null;
    expect(localMeta?.textContent).toContain('0 memory cards');
  });

  it('saves the active workbench project to cloud without disabling local save', () => {
    const payload = seedWorkbenchForContinuation();
    const receipt: CloudStoryProjectSaveReceipt = {
      projectId: payload.summary.storyId,
      storyId: payload.summary.storyId,
      savedAt: payload.summary.updatedAt,
      syncState: {
        mode: 'cloud_synced',
        lastSyncedAt: payload.summary.updatedAt
      }
    };
    storyService.saveCloudStoryProject.and.returnValue(of({ success: true, data: receipt }));
    component.cloudLibrarySyncState.set({
      mode: 'cloud_synced',
      lastSyncedAt: payload.summary.updatedAt
    });

    component.saveActiveProjectToCloud();

    expect(storyService.saveCloudStoryProject).toHaveBeenCalledWith(jasmine.objectContaining({
      id: payload.summary.storyId,
      storyId: payload.summary.storyId,
      title: payload.summary.title
    }));
    expect(component.workspaceSaveStatus()).not.toContain('Cloud');
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_synced');
  });

  it('keeps connected cloud state when there is no active workbench project to save', () => {
    component.cloudLibrarySyncState.set({
      mode: 'cloud_synced',
      lastSyncedAt: '2026-06-08T08:38:00.000Z'
    });

    component.saveActiveProjectToCloud();

    expect(storyService.saveCloudStoryProject).not.toHaveBeenCalled();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_synced');
    expect(component.cloudLibrarySyncState().message).toBe('Generate a story before saving to cloud.');
  });

  it('keeps non-durable loaded projects out of cloud-synced state', () => {
    const payload = seedWorkbenchForContinuation({
      summary: createSummary({ storyId: 'story-cloud', title: 'Cloud Chapel' }),
      state: createState({ storyId: 'story-cloud' }),
      batch: {
        chapters: [createChapter({ chapterId: 'chapter-cloud' })],
        totalWordCount: 900,
        suggestedNextPrompts: []
      }
    });
    const project: SavedStoryProject = {
      id: 'project-cloud',
      storyId: payload.summary.storyId,
      title: payload.summary.title,
      synopsis: payload.summary.synopsis,
      blueprint: component.blueprint(),
      summary: payload.summary,
      state: payload.state,
      chapters: payload.batch.chapters,
      telemetry: payload.telemetry,
      createdAt: payload.summary.createdAt,
      updatedAt: payload.summary.updatedAt
    };
    const loadResult: CloudStoryProjectLoadResult = {
      ownerUserId: 'user-owner',
      storageMode: 'non_durable_memory',
      projectId: project.id,
      storyId: project.storyId,
      project,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
    storyService.loadCloudStoryProject.and.returnValue(of({ success: true, data: loadResult }));
    component.cloudLibrarySyncState.set({ mode: 'cloud_synced' });

    component.loadCloudProject(project.id);

    expect(storyService.loadCloudStoryProject).toHaveBeenCalledWith(project.id);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(component.cloudLibrarySyncState().message).toContain('non-durable account storage');
    expect(component.selectedChapter()?.chapterId).toBe('chapter-cloud');
  });

  it('keeps non-durable deleted projects out of cloud-synced state', () => {
    const receipt: CloudStoryProjectDeleteReceipt = {
      ownerUserId: 'user-owner',
      storageMode: 'non_durable_memory',
      projectId: 'project-cloud',
      deleted: true
    };
    component.cloudProjects.set([{
      projectId: 'project-cloud',
      storyId: 'story-cloud',
      title: 'Cloud Chapel',
      synopsis: 'A cloud route backed by non-durable memory.',
      chapterCount: 2,
      acceptedMemoryCardCount: 0,
      createdAt: '2026-06-08T08:37:00.000Z',
      updatedAt: '2026-06-08T08:38:00.000Z'
    }]);
    storyService.deleteCloudStoryProject.and.returnValue(of({ success: true, data: receipt }));
    component.cloudLibrarySyncState.set({ mode: 'cloud_synced' });

    component.deleteCloudProject('project-cloud');

    expect(storyService.deleteCloudStoryProject).toHaveBeenCalledWith('project-cloud');
    expect(component.cloudProjects().length).toBe(0);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(component.cloudLibrarySyncState().message).toContain('non-durable account storage');
  });

  it('re-enables cloud controls after an account route error', () => {
    storyService.listCloudStoryProjects.and.returnValue(throwError(() => new Error('offline')));

    component.refreshCloudLibrary();
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const checkButton = Array.from(panel?.querySelectorAll('button') ?? [])
      .find(button => button.textContent?.includes('Check cloud')) as HTMLButtonElement | undefined;
    const fullText = fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();

    expect(component.isCloudLibraryBusy()).toBeFalse();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(checkButton?.disabled).toBeFalse();
    expect(fullText).toContain('Saved here');
  });

  it('updates the Heat Contract without changing the rest of the blueprint', () => {
    component.updateHeatContract('adultOnlyConfirmed', true);
    component.updateHeatContract('tensionMode', 'dangerous_proximity');
    component.updateHeatContract('intimacyBoundary', 'literary_on_page');
    component.updateHeatContract('noGoContent', 'No humiliation.');

    expect(component.activeHeatContract().adultOnlyConfirmed).toBeTrue();
    expect(component.activeHeatContract().tensionMode).toBe('dangerous_proximity');
    expect(component.activeHeatContract().intimacyBoundary).toBe('literary_on_page');
    expect(component.activeHeatContract().noGoContent).toBe('No humiliation.');
    expect(component.blueprint().creature).toBe('vampire');
  });

  it('prevents genesis without a logline', () => {
    component.startGenesis();
    expect(storyService.beginStory).not.toHaveBeenCalled();
    expect(storyService.createStoryLabJob).not.toHaveBeenCalled();
  });

  it('starts genesis through a Story Lab job and hydrates the workbench on completion', () => {
    const payload: StoryIterationPayload = {
      summary: createSummary(),
      batch: {
        chapters: [createChapter(), createChapter({ chapterId: 'chapter-2', chapterNumber: 2 })],
        totalWordCount: 1800,
        suggestedNextPrompts: ['Explore the rival court.']
      },
      state: createState(),
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 2100,
        averageChapterLatencyMs: 1050,
        tokensConsumed: 1420,
        retryCount: 0
      }
    };
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(payload)
    }));
    configureValidBlueprint('A vampire princess bound by forbidden vows.');
    component.startGenesis();

    expect(storyService.beginStory).not.toHaveBeenCalled();
    expect(storyService.createStoryLabJob).toHaveBeenCalled();
    expect(storyService.createStoryLabJob.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      kind: 'genesis',
      blueprint: jasmine.objectContaining({
        logline: 'A vampire princess bound by forbidden vows.',
        chapterBatchSize: 1
      })
    }));

    expect(component.workbench().story?.storyId).toBe('story-123');
    expect(component.workbench().chapterHistory.length).toBe(2);
    expect(component.selectedChapter()?.chapterNumber).toBe(2);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('completed');
    expect(component.suggestedNextPrompts()).toEqual(['Explore the rival court.']);
    expect(component.savedProjects().length).toBe(1);
    expect(component.workspaceSaveStatus()).toBe('Saved in this browser.');
  });

  // The continuation twin of this has been asserted since the guard was written
  // — "keeps existing chapters when a completed continuation job has a malformed
  // story payload" below. Genesis only asked whether `job.result` was present at
  // all, so a result that is merely *there* reached `applyIteration`, which
  // reads `summary.storyId` and `batch.chapters` straight through. The throw
  // lands inside the job creation subscription's `next` callback, where nothing
  // catches it: the batch stays in progress, the progress timer keeps running,
  // and the reader is told nothing.
  const malformedGenesisPayloads: Array<[string, StoryIterationPayload]> = [
    ['no batch', { summary: createSummary(), state: createState() } as unknown as StoryIterationPayload],
    ['no summary', {
      state: createState(),
      batch: { chapters: [createChapter()], totalWordCount: 900, suggestedNextPrompts: [] }
    } as unknown as StoryIterationPayload]
  ];

  for (const [label, malformedPayload] of malformedGenesisPayloads) {
    it(`fails the genesis batch when a completed job has a malformed story payload (${label})`, () => {
      storyService.createStoryLabJob.and.returnValue(of({
        success: true,
        data: createGenesisJobResponse(malformedPayload)
      }));
      configureValidBlueprint('A vampire princess bound by forbidden vows.');

      expect(() => component.startGenesis()).not.toThrow();

      expect(component.workbench().story).toBeNull();
      expect(component.workbench().chapterHistory).toEqual([]);
      expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
      expect(component.statusMessage()).toContain('without a story payload');
      expect(component.isGenerating()).toBeFalse();
      expect(component.generationProgress().active).toBeFalse();
    });
  }

  it('updates genesis progress from a running Story Lab job snapshot', () => {
    startGenesisJobFlow(
      'A siren archivist bargains with a moonlit duke.',
      {
        status: 'running',
        currentStep: 'generating_story',
        progressPercent: 47
      }
    );

    expect(component.generationProgress().active).toBeTrue();
    expect(component.generationProgress().percent).toBe(47);
    expect(component.generationProgress().stage).toContain('Grok');
    expect(component.statusMessage()).toContain('Grok');
  });

  it('renders the active genesis job status panel while a story job is running', () => {
    startGenesisJobFlow('A siren archivist bargains with a moonlit duke.');

    const statusText = renderedJobStatusText();
    expect(statusText).toContain('First chapter job running');
    expect(statusText).toContain('32%');
    expect(statusText).toContain('job_123e...4000');
    expect(statusText).toContain('Grok is writing your first chapter.');
  });

  it('renders the active batch queue while a genesis job is running', () => {
    startGenesisJobFlow('A siren archivist bargains with a moonlit duke.');

    const queueText = renderedBatchQueueText();
    expect(queueText).toContain('Story Lab queue');
    expect(queueText).toContain('Genesis');
    expect(queueText).toContain('In Progress');
    expect(queueText).toContain('0 of 1 chapter');
  });

  // These cover the "still running" branch of `handleJobSnapshot`: it
  // returns `false` specifically so the caller keeps watching the job. Job
  // watching moved from polling `getStoryLabJobStatus` on a fixed interval to
  // subscribing to `StoryService.streamStoryLabJobEvents` (a mocked
  // Observable here — `story.service.spec.ts` drives the real `fetch`-based
  // reconnect/auth/dedup wiring against `testing/fetch-stream-mock.ts`), so
  // there is no interval to `tick()` through: the mocked Observable is
  // subscribed synchronously, in the same call stack as `startGenesis()`.
  // Two cases from the retired poll loop have no analogue here and are not
  // replaced 1:1:
  // - "a single request that hangs" doesn't apply to one persistent
  //   subscription the way it did to a poll loop's individual HTTP requests.
  // - "keeps polling through a transient error" is now the job event
  //   stream's own concern — `story.service.spec.ts`'s transient-status and
  //   network-error retry cases cover the reconnect logic that keeps a
  //   benign disconnect from ever reaching this component as an `error` at
  //   all.
  describe('watching a Story Lab job that is not yet terminal', () => {
    const eventsPath = '/api/story-lab/jobs/job_123e4567-e89b-12d3-a456-426614174000/events';
    const POLL_TIMEOUT_MS = 5 * 60 * 1000;

    function completedGenesisPayload(): StoryIterationPayload {
      return {
        summary: createSummary(),
        batch: {
          chapters: [createChapter()],
          totalWordCount: 900,
          suggestedNextPrompts: []
        },
        state: createState(),
        telemetry: {
          engine: 'gpt',
          totalLatencyMs: 1800,
          averageChapterLatencyMs: 1800,
          tokensConsumed: 900,
          retryCount: 0
        }
      };
    }

    function runningJobSnapshot(overrides: Partial<StoryLabJob<StoryIterationPayload>> = {}): StoryLabJob<StoryIterationPayload> {
      return {
        jobId: 'job_123e4567-e89b-12d3-a456-426614174000',
        kind: 'genesis',
        status: 'running',
        currentStep: 'generating_story',
        progressPercent: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
      };
    }

    function jobEvent<T>(job: StoryLabJob<T>): StoryLabJobEvent<T> {
      return {
        eventId: `event_${job.jobId}_${job.updatedAt}`,
        type: 'snapshot',
        emittedAt: job.updatedAt,
        job
      };
    }

    it('opens the job event stream at its eventsPath and applies a completed snapshot', fakeAsync(() => {
      const completedJob = createGenesisJobResponse(completedGenesisPayload()).job;
      storyService.streamStoryLabJobEvents.and.returnValue(of(jobEvent(completedJob)));

      startGenesisJobFlow('A siren archivist bargains with a moonlit duke.');

      expect(storyService.streamStoryLabJobEvents.calls.mostRecent().args[0]).toBe(eventsPath);
      expect(storyService.streamStoryLabJobEvents.calls.mostRecent().args[1]).toEqual(jasmine.any(Function));
      expect(storyService.streamStoryLabJobEvents.calls.count()).toBe(1);
      expect(component.isGenerating()).toBeFalse();
      expect(component.workbench().chapterHistory.length).toBe(1);
      expect(component.jobStatusPanel().visible).toBeFalse();

      // Terminal now — nothing re-opens the stream.
      tick(POLL_TIMEOUT_MS);
      expect(storyService.streamStoryLabJobEvents.calls.count()).toBe(1);
    }));

    it('keeps applying every snapshot emitted on the stream until the job finishes', fakeAsync(() => {
      const completedJob = createGenesisJobResponse(completedGenesisPayload()).job;
      const events = new Subject<StoryLabJobEvent<StoryIterationPayload>>();
      storyService.streamStoryLabJobEvents.and.returnValue(events.asObservable());

      startGenesisJobFlow('A siren archivist bargains with a moonlit duke.');
      expect(storyService.streamStoryLabJobEvents.calls.count()).toBe(1);

      events.next(jobEvent(runningJobSnapshot({ progressPercent: 65 })));
      expect(component.isGenerating()).toBeTrue();
      expect(component.generationProgress().percent).toBe(65);

      events.next(jobEvent(runningJobSnapshot({ progressPercent: 80 })));
      expect(component.generationProgress().percent).toBe(80);

      events.next(jobEvent(completedJob));
      expect(component.isGenerating()).toBeFalse();
    }));

    it('fails the job with a dedicated message once the overall watch timeout elapses', fakeAsync(() => {
      storyService.streamStoryLabJobEvents.and.returnValue(NEVER);

      startGenesisJobFlow('A siren archivist bargains with a moonlit duke.');

      tick(POLL_TIMEOUT_MS);

      expect(component.isGenerating()).toBeFalse();
      expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
      // Distinct from the stream-error message below — a reader hitting the
      // 5-minute cap should be told it took too long, not that "updates
      // stopped".
      expect(component.statusMessage()).toContain('taking longer than expected');
    }));

    it('fails the job immediately when the event stream ends in a terminal error', fakeAsync(() => {
      // A reconnect-shaped disconnect (a transient status, a network blip)
      // never reaches this Observable as an error at all — retried
      // internally by `StoryService.streamStoryLabJobEvents` instead (see
      // `story.service.spec.ts`). Only a definitive failure does, via
      // `subscriber.error`.
      storyService.streamStoryLabJobEvents.and.returnValue(throwError(() => new Error('Story Lab job event stream closed.')));

      startGenesisJobFlow('A siren archivist bargains with a moonlit duke.');

      expect(component.isGenerating()).toBeFalse();
      expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
    }));

    it('stops watching the job stream once the component is destroyed', () => {
      const events = new Subject<StoryLabJobEvent<StoryIterationPayload>>();
      storyService.streamStoryLabJobEvents.and.returnValue(events.asObservable());

      startGenesisJobFlow('A siren archivist bargains with a moonlit duke.');
      expect(storyService.streamStoryLabJobEvents).toHaveBeenCalled();
      expect(events.observed).toBeTrue();

      // `ngOnDestroy` calls `closeJobSubscriptions()`, which must actually
      // unsubscribe the live stream — not silently no-op the way it did
      // while `jobEventSubscription` was declared but never assigned to
      // anything.
      fixture.destroy();
      expect(events.observed).toBeFalse();
    });

    it('also streams a running continuation job\'s events at its own eventsPath until it completes', () => {
      const genesisPayload = seedWorkbenchForContinuation();
      const runningContinuationJob = createContinuationJobResponse(undefined, {
        status: 'running',
        currentStep: 'continuing_story',
        progressPercent: 40
      });
      storyService.createStoryLabJob.and.returnValue(of({ success: true, data: runningContinuationJob }));

      const continuationPayload = createContinuationPayload(genesisPayload);
      const completedJob = createContinuationJobResponse(continuationPayload).job;
      storyService.streamStoryLabJobEvents.and.returnValue(of(jobEvent(completedJob)));

      component.continueSaga('Focus on the betrayal arc.');

      expect(storyService.streamStoryLabJobEvents.calls.mostRecent().args[0]).toBe(runningContinuationJob.paths.eventsPath);
      expect(component.isGenerating()).toBeFalse();
      expect(component.workbench().chapterHistory.length).toBe(2);
    });
  });

  it('formats unknown batch statuses defensively', () => {
    expect(component.formatBatchStatus('in_progress')).toBe('In Progress');
    expect(component.formatBatchStatus('paused' as any)).toBe('paused');
    expect(component.formatBatchStatus(undefined)).toBe('Unknown');
  });

  it('clears finished batches from the visible batch queue', () => {
    const payload: StoryIterationPayload = {
      summary: createSummary(),
      batch: {
        chapters: [createChapter()],
        totalWordCount: 900,
        suggestedNextPrompts: []
      },
      state: createState(),
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 1200,
        averageChapterLatencyMs: 1200,
        tokensConsumed: 900,
        retryCount: 0
      }
    };
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(payload)
    }));
    configureValidBlueprint('A siren archivist bargains with a moonlit duke.');

    component.startGenesis();

    expect(renderedBatchQueueText()).toContain('Completed');
    const clearButton = renderedBatchQueuePanel()?.querySelector('[data-testid="clear-finished-batches"]') as HTMLButtonElement | null;
    clearButton?.click();
    fixture.detectChanges();

    expect(component.activeBatchQueue().length).toBe(0);
    expect(renderedBatchQueueText()).toBeNull();
  });

  it('hides the Director Room before a chapter exists', () => {
    expect(renderedDirectorRoomText()).toBeNull();
  });

  it('renders Director Room craft notes for the selected chapter', () => {
    seedWorkbenchForContinuation({
      state: createState({
        characters: [
          {
            id: 'heroine',
            displayName: 'Mara',
            archetype: 'protagonist',
            summary: 'A siren archivist guarding a forbidden oath.',
            currentGoal: 'Keep the moonlit bargain from consuming her archive.',
            internalConflict: 'She wants the duke and fears the cost.',
            externalConflict: 'The rival court wants the same oath.',
            secrets: [],
            relationships: [],
            spiceCompatibilities: [3]
          }
        ],
        threads: [
          {
            id: 'oath',
            label: 'Moonlit oath',
            status: 'escalating',
            description: '',
            foreshadowedDevices: []
          }
        ],
        artifacts: [
          {
            id: 'witness-shell',
            name: 'Witness Shell',
            significance: 'The shell repeats any vow spoken near the reef court.',
            introducedInChapter: 1
          }
        ]
      })
    });

    const directorText = renderedDirectorRoomText();

    expect(directorText).toContain('Director');
    expect(directorText).toContain('Desire Ledger');
    expect(directorText).toContain('Continuity Keeper');
    expect(directorText).toContain('Chapter Ending');
    expect(directorText).toContain('Mara');
    expect(directorText).toContain('Moonlit oath');
    expect(directorText).toContain('Summary of chapter one.');
    expect(directorText).not.toContain('The shell repeats any vow spoken near the reef court.');
  });

  it('renders a read-only Continuity Preview from current story state', () => {
    seedWorkbenchForContinuation({
      state: createState({
        characters: [
          {
            id: 'mara',
            displayName: 'Mara',
            archetype: 'protagonist',
            summary: 'A siren archivist guarding a forbidden oath.',
            currentGoal: 'Keep the moonlit bargain from consuming her archive.',
            internalConflict: 'She wants the duke and fears the cost.',
            externalConflict: 'Duke Vale wants the same vow.',
            secrets: [],
            relationships: [
              {
                characterId: 'duke-vale',
                relationship: 'rival',
                notes: 'Duke Vale can turn the vow into leverage.'
              }
            ],
            spiceCompatibilities: [3]
          },
          {
            id: 'duke-vale',
            displayName: 'Duke Vale',
            archetype: 'antagonist',
            summary: 'A moonlit duke with a claim on the reef archive.',
            currentGoal: 'Turn Mara toward the court bargain.',
            internalConflict: 'His desire compromises his strategy.',
            externalConflict: 'Mara can refuse him in public.',
            secrets: [],
            relationships: [],
            spiceCompatibilities: [3]
          }
        ],
        threads: [
          {
            id: 'oath',
            label: 'Moonlit oath',
            status: 'escalating',
            description: 'The bargain demands a public sacrifice.',
            foreshadowedDevices: [],
            lifetime: 'series'
          }
        ],
        artifacts: [
          {
            id: 'shell',
            name: 'Witness Shell',
            significance: 'The shell repeats any vow spoken near the reef court.',
            introducedInChapter: 1,
            lifetime: 'chapter'
          }
        ],
        continuityWarnings: ['Resolve the vow before changing courts.']
      })
    });

    const previewText = renderedContinuityPreviewText() ?? '';

    expect(previewText).toContain('Continuity Preview');
    expect(previewText).toContain('Pressure rising');
    expect(previewText).toContain('Moonlit oath');
    expect(previewText).toContain('Active story thread');
    expect(previewText).toContain('Series memory');
    expect(previewText).toContain('Relationship pressure');
    expect(previewText).toContain('Mara and Duke Vale');
    expect(previewText).toContain('Current relationship edge');
    expect(previewText).toContain('World clue');
    expect(previewText).toContain('Witness Shell');
    expect(previewText).toContain('Unresolved world clue');
    expect(previewText).toContain('Chapter memory');
    expect(previewText).toContain('Continuity note');
    expect(previewText).toContain('Resolve the vow');
    expect(previewText).toContain('Continuity note to honor');
  });

  // `mergeCharacters` in the continuity extractor asserted the model's
  // `relationships` array into `RelationshipEdge[]` rather than checking it, so
  // state stored before that was fixed can still hold `null`, a bare name
  // string, or an object with no `characterId`. This component read
  // `relationship.characterId` off every entry, so one `null` among them threw
  // while rendering and the panel did not draw at all — for a story whose
  // chapters the reader can still see. The API tree has always read the same
  // array through a filter; this is that guard on the reader that lacked one.
  it('renders the Continuity Preview around malformed stored relationship edges', () => {
    seedWorkbenchForContinuation({
      state: createState({
        characters: [
          {
            id: 'mara',
            displayName: 'Mara',
            archetype: 'protagonist',
            summary: 'A siren archivist guarding a forbidden oath.',
            currentGoal: 'Keep the moonlit bargain from consuming her archive.',
            internalConflict: 'She wants the duke and fears the cost.',
            externalConflict: 'Duke Vale wants the same vow.',
            secrets: [],
            relationships: [
              null,
              'Duke Vale',
              { relationship: 'rival', notes: 'No character id at all.' },
              {
                characterId: 'duke-vale',
                relationship: 'rival',
                notes: 'Duke Vale can turn the vow into leverage.'
              }
            ] as never,
            spiceCompatibilities: [3]
          },
          {
            id: 'duke-vale',
            displayName: 'Duke Vale',
            archetype: 'antagonist',
            summary: 'A moonlit duke with a claim on the reef archive.',
            currentGoal: 'Turn Mara toward the court bargain.',
            internalConflict: 'His desire compromises his strategy.',
            externalConflict: 'Mara can refuse him in public.',
            secrets: [],
            relationships: [],
            spiceCompatibilities: [3]
          }
        ],
        continuityWarnings: []
      })
    });

    const previewText = renderedContinuityPreviewText() ?? '';

    // The panel draws at all, which is the part the throw took away.
    expect(previewText).toContain('Continuity Preview');
    // And the one well-formed edge among the malformed entries is still read.
    expect(previewText).toContain('Relationship pressure');
    expect(previewText).toContain('Mara and Duke Vale');
  });

  // `RelationshipEdge.relationship` is declared `RelationshipKind`, and this
  // reader checked it with `typeof === 'string'` — so a kind outside the five
  // the vocabulary lists was handed on wearing the union's type, and the
  // preview's detail table, which is keyed by that union, had nothing written
  // for it. The kind normalizes to `unknown` now: the pair and the note are a
  // relationship the story really established, and only the kind is the part
  // nobody can vouch for.
  it('reads a stored relationship kind outside the vocabulary as unknown', () => {
    seedWorkbenchForContinuation({
      state: createState({
        characters: [
          {
            id: 'mara',
            displayName: 'Mara',
            archetype: 'protagonist',
            summary: 'A siren archivist guarding a forbidden oath.',
            currentGoal: 'Keep the moonlit bargain from consuming her archive.',
            internalConflict: 'She wants the duke and fears the cost.',
            externalConflict: 'Duke Vale wants the same vow.',
            secrets: [],
            relationships: [
              { characterId: 'duke-vale', relationship: 'mentor', notes: '' }
            ] as never,
            spiceCompatibilities: [3]
          },
          {
            id: 'duke-vale',
            displayName: 'Duke Vale',
            archetype: 'antagonist',
            summary: 'A moonlit duke with a claim on the reef archive.',
            currentGoal: 'Turn Mara toward the court bargain.',
            internalConflict: 'His desire compromises his strategy.',
            externalConflict: 'Mara can refuse him in public.',
            secrets: [],
            relationships: [],
            spiceCompatibilities: [3]
          }
        ],
        continuityWarnings: []
      })
    });

    const previewText = renderedContinuityPreviewText() ?? '';

    // The edge survives — dropping it would take a real relationship out of the
    // panel whose job is to show them.
    expect(previewText).toContain('Mara and Duke Vale');
    // And it reads the line `unknown` was written for, rather than one of the
    // four characterized kinds.
    expect(previewText).toContain('This connection should change the next scene.');
  });

  it('prioritizes custom-brief matches in the Continuity Preview', () => {
    seedWorkbenchForContinuation({
      state: createState({
        characters: [
          {
            id: 'mara',
            displayName: 'Mara',
            archetype: 'protagonist',
            summary: 'A siren archivist guarding a forbidden oath.',
            currentGoal: 'Keep the moonlit bargain from consuming her archive.',
            internalConflict: 'She wants the truth and fears the cost.',
            externalConflict: 'Duke Vale wants the same vow.',
            secrets: [],
            relationships: [
              {
                characterId: 'duke-vale',
                relationship: 'rival',
                notes: 'Duke Vale can turn the vow into leverage.'
              },
              {
                characterId: 'coral-scribe',
                relationship: 'ally',
                notes: 'Coral Scribe knows where Mara hid the archive ledger.'
              }
            ],
            spiceCompatibilities: [3]
          },
          {
            id: 'duke-vale',
            displayName: 'Duke Vale',
            archetype: 'antagonist',
            summary: 'A moonlit duke with a claim on the reef archive.',
            currentGoal: 'Turn Mara toward the court bargain.',
            internalConflict: 'His desire compromises his strategy.',
            externalConflict: 'Mara can refuse him in public.',
            secrets: [],
            relationships: [],
            spiceCompatibilities: [3]
          },
          {
            id: 'coral-scribe',
            displayName: 'Coral Scribe',
            archetype: 'supporting',
            summary: 'A court archivist who knows the dangerous ledger path.',
            currentGoal: 'Make the ledger truth impossible to ignore.',
            internalConflict: 'He owes two courts and one truth.',
            externalConflict: 'The reef court can silence him.',
            secrets: [],
            relationships: [],
            spiceCompatibilities: [2]
          }
        ],
        threads: [
          {
            id: 'moonlit-oath',
            label: 'Moonlit oath',
            status: 'escalating',
            description: 'The bargain demands a public sacrifice.',
            foreshadowedDevices: []
          },
          {
            id: 'reef-trial',
            label: 'Reef trial',
            status: 'active',
            description: 'The court wants testimony before dawn.',
            foreshadowedDevices: []
          },
          {
            id: 'blood-oath',
            label: 'Blood Oath',
            status: 'active',
            description: 'The old promise makes the next confession costly.',
            foreshadowedDevices: []
          }
        ],
        artifacts: [
          {
            id: 'witness-shell',
            name: 'Witness Shell',
            significance: 'The shell repeats any vow spoken near the reef court.',
            introducedInChapter: 1
          },
          {
            id: 'glass-key',
            name: 'Glass Key',
            significance: 'The key opens the forbidden tide door beneath the ledger room.',
            introducedInChapter: 1
          }
        ],
        continuityWarnings: [
          'Resolve the duke wager before changing courts.',
          'Make Coral Scribe honor the ledger warning before the court leaves.'
        ]
      })
    });
    component.customContinuationBrief.set('Bring the blood oath, glass key, and Coral Scribe ledger into the next scene.');

    const previewText = renderedContinuityPreviewText() ?? '';

    expect(previewText).toContain('Blood Oath');
    expect(previewText).toContain('Glass Key');
    expect(previewText).toContain('Mara and Coral Scribe');
    expect(previewText).toContain('Coral Scribe honor the ledger warning');
    expect(previewText).toContain('Matched continuation guidance');
    expect(previewText).not.toContain('Witness Shell');
  });

  it('renders suggested memory card drafts from current story state', () => {
    seedMaraMemoryCardWorkbench({ includeArtifact: true });

    const cardDraftText = renderedMemoryCardDraftsText() ?? '';

    expect(cardDraftText).toContain('Memory Card Drafts');
    expect(cardDraftText).toContain('Character card');
    expect(cardDraftText).toContain('Mara');
    expect(cardDraftText).toContain('Trigger: Mara');
    expect(cardDraftText).toContain('Promise card');
    expect(cardDraftText).toContain('Moonlit oath');
    expect(cardDraftText).toContain('Trigger: Moonlit oath, oath');
    expect(cardDraftText).toContain('World card');
    expect(cardDraftText).toContain('Witness Shell');
    expect(cardDraftText).toContain('Trigger: Witness Shell, shell');
  });

  it('keeps Unicode words intact in continuity matching and memory-card triggers', () => {
    seedWorkbenchForContinuation({
      state: createState({
        characters: [{
          id: 'corazon',
          displayName: 'Corazón Encantado',
          archetype: 'protagonist',
          summary: 'A witch guarding a vow written in salt.',
          currentGoal: 'Keep the corazón promise alive.',
          internalConflict: 'She fears the promise will name her desire.',
          externalConflict: 'The court wants the vow erased.',
          secrets: [],
          relationships: [],
          spiceCompatibilities: [3]
        }],
        threads: [{
          id: 'promesa',
          label: 'Promesa del Corazón',
          status: 'active',
          description: 'The promise binds the next confession.',
          foreshadowedDevices: []
        }]
      })
    });
    component.customContinuationBrief.set('Recuerda el corazón antes del baile.');

    const previewText = renderedContinuityPreviewText() ?? '';
    const draftText = renderedMemoryCardDraftsText() ?? '';

    expect(previewText).toContain('Matched continuation guidance');
    expect(draftText).toContain('Trigger: Corazón Encantado, encantado');
    expect(draftText).toContain('Trigger: Promesa del Corazón, corazón');
  });

  it('uses accepted memory cards when scoring the continuity preview', () => {
    seedWorkbenchForContinuation({
      state: createState({
        threads: [
          {
            id: 'reef-trial',
            label: 'Reef trial',
            status: 'active',
            description: 'The court wants testimony before dawn.',
            foreshadowedDevices: []
          },
          {
            id: 'moonlit-oath',
            label: 'Moonlit oath',
            status: 'active',
            description: 'Mara promised the duke a ledger that would cost her the archive.',
            foreshadowedDevices: []
          }
        ]
      })
    });
    component.customContinuationBrief.set('Raise pressure somewhere else.');
    component.acceptedMemoryCards.set([{
      id: 'memory-card-thread-moonlit-oath',
      label: 'Promise card',
      title: 'Moonlit oath',
      detail: 'Mara will burn the moonlit ledger before she lets the duke own the vow.',
      triggerLabel: 'Trigger: Moonlit oath, ledger',
      acceptedAt: '2026-06-21T11:35:00.000Z'
    }]);

    const previewText = renderedContinuityPreviewText() ?? '';

    expect(previewText).toContain('Moonlit oath');
    expect(previewText).toContain('Matched continuation guidance');
  });

  // The panel used to score activation with a formula of its own: three
  // characters rather than the guidance builder's four, so any short word the
  // brief and a thread label happened to share was reported as a match. `vow`
  // is three characters, and the words a story's promises are named with are
  // mostly this short — vow, oath, key, debt. The guidance scores this brief
  // against this thread at zero and orders it by story position like everything
  // else, so `Matched continuation guidance` was the panel's judgement rather
  // than the run's.
  it('does not claim a continuity match the guidance builder would not make', () => {
    seedWorkbenchForContinuation({
      state: createState({
        threads: [{
          id: 'broken-vow',
          label: 'Broken vow',
          status: 'active',
          description: 'Someone will have to answer for it.',
          foreshadowedDevices: []
        }]
      })
    });
    component.customContinuationBrief.set('Honour the vow she made.');

    const previewText = renderedContinuityPreviewText() ?? '';

    expect(previewText).toContain('Broken vow');
    expect(previewText).toContain('Active story thread');
    expect(previewText).not.toContain('Matched continuation guidance');
  });

  // The other half of the same disagreement. The guidance adds up what a
  // thread's label, description, and foreshadowed devices each contribute; the
  // panel took the best single one of them and did not read the devices at all.
  // So a thread the brief echoes three times over ranked below one it echoes
  // twice in a single label — the prompt carries the first, and the panel put
  // the second above it.
  it('ranks continuity the way the guidance builder ranks it', () => {
    seedWorkbenchForContinuation({
      state: createState({
        threads: [
          {
            id: 'ledger-debt',
            label: 'Ledger debt',
            status: 'active',
            description: 'A crown waits.',
            foreshadowedDevices: ['Harbor bells']
          },
          {
            id: 'dawn-trial',
            label: 'Trial at dawn',
            status: 'active',
            description: 'Nothing else matters.',
            foreshadowedDevices: []
          }
        ]
      })
    });
    component.customContinuationBrief.set(
      'Bring the ledger, the crown, and the harbor. The dawn will not wait, and the trial cannot.'
    );

    const previewText = renderedContinuityPreviewText() ?? '';

    expect(previewText).toContain('Ledger debt');
    expect(previewText).toContain('Trial at dawn');
    expect(previewText.indexOf('Ledger debt')).toBeLessThan(previewText.indexOf('Trial at dawn'));
  });

  it('pins a memory card draft in the current session', () => {
    seedMaraMemoryCardWorkbench();

    const pinButton = renderedMemoryCardDraftsPanel()?.querySelector('[data-testid="pin-memory-card-draft"]') as HTMLButtonElement | null;
    expect(pinButton?.textContent?.trim()).toBe('Pin');

    pinButton?.click();
    fixture.detectChanges();

    const pinnedText = renderedMemoryCardDraftsText() ?? '';
    const pinnedButton = renderedMemoryCardDraftsPanel()?.querySelector('[data-testid="pin-memory-card-draft"]') as HTMLButtonElement | null;
    expect(pinnedText).toContain('Pinned cards: 1');
    expect(pinnedButton?.textContent?.trim()).toBe('Unpin');
    expect(pinnedButton?.disabled).toBeFalse();

    pinnedButton?.click();
    fixture.detectChanges();

    const unpinnedText = renderedMemoryCardDraftsText() ?? '';
    const unpinnedButton = renderedMemoryCardDraftsPanel()?.querySelector('[data-testid="pin-memory-card-draft"]') as HTMLButtonElement | null;
    expect(unpinnedText).not.toContain('Pinned cards: 1');
    expect(unpinnedButton?.textContent?.trim()).toBe('Pin');
  });

  it('restores pinned memory card drafts from a browser-local saved project', () => {
    seedMaraMemoryCardWorkbench();

    clickFirstMemoryCardDraftAction('pin-memory-card-draft');

    component.saveActiveProject();
    component.resetWorkbench();
    component.loadSavedProject('story-123');

    const restoredText = renderedMemoryCardDraftsText() ?? '';
    const restoredButton = renderedMemoryCardDraftsPanel()?.querySelector('[data-testid="pin-memory-card-draft"]') as HTMLButtonElement | null;
    expect(restoredText).toContain('Pinned cards: 1');
    expect(restoredButton?.textContent?.trim()).toBe('Unpin');
    expect(restoredButton?.disabled).toBeFalse();
  });

  it('accepts memory card draft records into browser-local saved projects', () => {
    seedMaraMemoryCardWorkbench();

    const acceptButton = renderedMemoryCardDraftsPanel()?.querySelector('[data-testid="accept-memory-card-draft"]') as HTMLButtonElement | null;
    expect(acceptButton).not.toBeNull();

    acceptButton?.click();
    fixture.detectChanges();

    const acceptedText = renderedAcceptedMemoryCardsText() ?? '';
    const acceptedButton = renderedMemoryCardDraftsPanel()?.querySelector('[data-testid="accept-memory-card-draft"]') as HTMLButtonElement | null;
    expect(acceptedText).toContain('Accepted Memory Cards');
    expect(acceptedText).toContain('Character card');
    expect(acceptedText).toContain('Mara');
    expect(acceptedText).toContain('Keep the moonlit bargain from consuming her archive.');
    expect(acceptedButton?.textContent?.trim()).toBe('Accepted');
    expect(acceptedButton?.disabled).toBeTrue();

    component.saveActiveProject();
    component.resetWorkbench();
    component.loadSavedProject('story-123');

    const restoredAcceptedText = renderedAcceptedMemoryCardsText() ?? '';
    const restoredAcceptedButton = renderedMemoryCardDraftsPanel()?.querySelector('[data-testid="accept-memory-card-draft"]') as HTMLButtonElement | null;
    expect(restoredAcceptedText).toContain('Accepted Memory Cards');
    expect(restoredAcceptedText).toContain('Mara');
    expect(restoredAcceptedButton?.textContent?.trim()).toBe('Accepted');
    expect(restoredAcceptedButton?.disabled).toBeTrue();
  });

  it('does not leak memory-card state into a new App instance with nothing saved to restore', () => {
    // Simulates navigating away (e.g. to /proving-grounds) and back with no
    // saved project: Angular destroys this `App` and constructs a new one,
    // and `restoreLatestProject()` finds nothing to hydrate over it. Memory
    // cards must not survive that — MemoryCardService is provided on `App`
    // itself precisely so a fresh component gets a fresh service instance
    // instead of inheriting a root singleton's leftover state.
    seedMaraMemoryCardWorkbench();
    clickFirstMemoryCardDraftAction('pin-memory-card-draft');
    clickFirstMemoryCardDraftAction('accept-memory-card-draft');
    expect(component.acceptedMemoryCards().length).toBe(1);
    expect(component.pinnedMemoryCardDraftCount()).toBeGreaterThan(0);

    const freshFixture = TestBed.createComponent(App);
    freshFixture.detectChanges();

    expect(freshFixture.componentInstance.acceptedMemoryCards()).toEqual([]);
    expect(freshFixture.componentInstance.pinnedMemoryCardDraftCount()).toBe(0);
  });

  it('normalizes malformed saved memory metadata before hydrating browser-local projects', () => {
    seedMaraMemoryCardWorkbench();
    component.saveActiveProject();

    const savedProjects = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>;
    savedProjects[0]['pinnedMemoryCardDraftIds'] = {};
    savedProjects[0]['acceptedMemoryCards'] = {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProjects));

    component.resetWorkbench();

    expect(() => component.loadSavedProject('story-123')).not.toThrow();
    expect(renderedAcceptedMemoryCardsPanel()).toBeNull();
    expect(renderedMemoryCardDraftsText()).not.toContain('Pinned cards: 1');
  });

  it('shows accepted memory near continuation controls before continuing', () => {
    seedMaraMemoryCardWorkbench({ includeThread: false });

    expect(renderedAcceptedMemoryContinuationPreviewText()).toBeNull();

    clickFirstMemoryCardDraftAction('accept-memory-card-draft');

    const previewText = renderedAcceptedMemoryContinuationPreviewText() ?? '';
    expect(previewText).toContain('1 accepted memory card will be included');
    expect(previewText).toContain('Mara');
  });

  it('edits accepted memory cards and carries edited text into continuations', () => {
    const genesisPayload = seedMaraMemoryCardWorkbench();
    stubCompletedContinuationJob(genesisPayload);

    clickFirstMemoryCardDraftAction('accept-memory-card-draft');
    const editButton = renderedAcceptedMemoryCardsPanel()?.querySelector('[data-testid="edit-accepted-memory-card"]') as HTMLButtonElement | null;
    expect(editButton).not.toBeNull();

    editButton?.click();
    fixture.detectChanges();

    const titleInput = renderedAcceptedMemoryCardsPanel()?.querySelector('[data-testid="accepted-memory-card-title"]') as HTMLInputElement | null;
    const detailInput = renderedAcceptedMemoryCardsPanel()?.querySelector('[data-testid="accepted-memory-card-detail"]') as HTMLTextAreaElement | null;
    const triggerInput = renderedAcceptedMemoryCardsPanel()?.querySelector('[data-testid="accepted-memory-card-trigger"]') as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    expect(detailInput).not.toBeNull();
    expect(triggerInput).not.toBeNull();

    titleInput!.value = 'Mara the Archive Blade';
    titleInput!.dispatchEvent(new Event('input'));
    detailInput!.value = 'She will burn the moonlit ledger before she lets the duke own the vow.';
    detailInput!.dispatchEvent(new Event('input'));
    triggerInput!.value = 'Trigger: Mara, ledger';
    triggerInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveButton = renderedAcceptedMemoryCardsPanel()?.querySelector('[data-testid="save-accepted-memory-card"]') as HTMLButtonElement | null;
    saveButton?.click();
    fixture.detectChanges();

    const editedText = renderedAcceptedMemoryCardsText() ?? '';
    expect(editedText).toContain('Mara the Archive Blade');
    expect(editedText).toContain('She will burn the moonlit ledger before she lets the duke own the vow.');
    expect(editedText).toContain('Trigger: Mara, ledger');
    expect(editedText).not.toContain('Keep the moonlit bargain from consuming her archive.');

    component.saveActiveProject();
    component.resetWorkbench();
    component.loadSavedProject('story-123');

    const restoredText = renderedAcceptedMemoryCardsText() ?? '';
    expect(restoredText).toContain('Mara the Archive Blade');
    expect(restoredText).toContain('She will burn the moonlit ledger before she lets the duke own the vow.');

    component.continueSaga('Use the accepted card.');

    const continuationBrief = latestContinuationBrief();
    expect(continuationBrief).toContain('Accepted Memory Cards:');
    expect(continuationBrief).toContain('Mara the Archive Blade');
    expect(continuationBrief).toContain('moonlit ledger');
    expect(continuationBrief).toContain('Trigger: Mara, ledger');
  });

  it('reorders accepted memory cards across saved projects and continuation briefs', () => {
    const genesisPayload = seedMaraMemoryCardWorkbench({
      includeArtifact: true,
      artifactName: 'Glass Key',
      artifactSignificance: 'A brittle key that opens the forbidden tide door only once.'
    });
    stubCompletedContinuationJob(genesisPayload);
    acceptAllMemoryCardDrafts();

    const initialText = renderedAcceptedMemoryCardsText() ?? '';
    expectTextOrder(initialText, ['Mara', 'Moonlit oath', 'Glass Key']);

    const upButtons = Array.from(renderedAcceptedMemoryCardsPanel()?.querySelectorAll('[data-testid="move-accepted-memory-card-up"]') ?? []) as HTMLButtonElement[];
    const downButtons = Array.from(renderedAcceptedMemoryCardsPanel()?.querySelectorAll('[data-testid="move-accepted-memory-card-down"]') ?? []) as HTMLButtonElement[];
    expect(upButtons.length).toBe(3);
    expect(downButtons.length).toBe(3);
    expect(upButtons[0].disabled).toBeTrue();
    expect(downButtons[2].disabled).toBeTrue();

    downButtons[0].click();
    fixture.detectChanges();

    const reorderedText = renderedAcceptedMemoryCardsText() ?? '';
    expectTextOrder(reorderedText, ['Moonlit oath', 'Mara', 'Glass Key']);

    component.saveActiveProject();
    component.resetWorkbench();
    component.loadSavedProject('story-123');

    const restoredText = renderedAcceptedMemoryCardsText() ?? '';
    expectTextOrder(restoredText, ['Moonlit oath', 'Mara', 'Glass Key']);

    component.continueSaga('Use accepted memory order.');

    expectTextOrder(latestContinuationBrief(), ['Moonlit oath', 'Mara', 'Glass Key']);
  });

  it('deletes accepted memory cards from saved projects and continuation briefs', () => {
    const genesisPayload = seedMaraMemoryCardWorkbench();
    stubCompletedContinuationJob(genesisPayload);

    clickFirstMemoryCardDraftAction('pin-memory-card-draft');
    clickFirstMemoryCardDraftAction('accept-memory-card-draft');
    expect(renderedAcceptedMemoryCardsText()).toContain('Mara');

    const deleteButton = renderedAcceptedMemoryCardsPanel()?.querySelector('[data-testid="delete-accepted-memory-card"]') as HTMLButtonElement | null;
    expect(deleteButton).not.toBeNull();

    deleteButton?.click();
    fixture.detectChanges();

    expect(renderedAcceptedMemoryCardsPanel()).toBeNull();

    component.saveActiveProject();
    component.resetWorkbench();
    component.loadSavedProject('story-123');

    expect(renderedAcceptedMemoryCardsPanel()).toBeNull();

    component.continueSaga('Use only the fresh brief.');

    const continuationBrief = latestContinuationBrief();
    expect(continuationBrief).toContain('Use only the fresh brief.');
    expect(continuationBrief).not.toContain('Accepted Memory Cards:');
    expect(continuationBrief).not.toContain('Pinned Memory Cards:');
    expect(continuationBrief).not.toContain('Mara');
  });

  it('moves a Director Room note into the custom continuation brief and keeps dismissed notes visible', () => {
    seedWorkbenchForContinuation();

    const panel = renderedDirectorRoomPanel();
    const rewriteButton = panel?.querySelector('[data-testid="rewrite-director-note"]') as HTMLButtonElement | null;
    const dismissButton = panel?.querySelector('[data-testid="dismiss-director-note"]') as HTMLButtonElement | null;

    rewriteButton?.click();
    fixture.detectChanges();
    dismissButton?.click();
    fixture.detectChanges();

    expect(component.customContinuationBrief()).toContain('Desire Ledger');
    expect(renderedDirectorRoomText()).toContain('Dismissed');
  });

  it('continues with accepted Director Room notes through the existing job flow', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));

    const panel = renderedDirectorRoomPanel();
    const acceptButtons = panel?.querySelectorAll('[data-testid="accept-director-note"]') as NodeListOf<HTMLButtonElement> | undefined;
    acceptButtons?.[0]?.click();
    acceptButtons?.[1]?.click();
    fixture.detectChanges();
    component.customContinuationBrief.set('Bring the oath back before the next kiss.');

    const continueButton = renderedDirectorRoomPanel()?.querySelector('[data-testid="continue-with-director-notes"]') as HTMLButtonElement | null;
    continueButton?.click();

    expect(storyService.continueStory).not.toHaveBeenCalled();
    const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
      kind: 'continuation';
      continuation: { continuationBrief?: string };
    };
    expect(jobRequest.kind).toBe('continuation');
    expect(jobRequest.continuation.continuationBrief).toContain('Director Room notes');
    expect(jobRequest.continuation.continuationBrief).toContain('Bring the oath back before the next kiss.');
    expect(jobRequest.continuation.continuationBrief).toContain('Desire Ledger');
    expect(jobRequest.continuation.continuationBrief).toContain('Continuity Keeper');
    expect(component.customContinuationBrief()).toBe('');
  });

  it('renders a villain pressure dial after a story exists', () => {
    seedWorkbenchForContinuation();

    const pressureText = renderedVillainPressureText();

    expect(pressureText).toContain('Villain Pressure');
    expect(pressureText).toContain('Secret');
    expect(pressureText).toContain('Deadline');
  });

  it('renders compact narrative dials for continuation steering after a story exists', () => {
    seedWorkbenchForContinuation();
    fixture.detectChanges();

    const dials = fixture.nativeElement.querySelectorAll('[data-testid="narrative-dial"]') as NodeListOf<HTMLElement>;

    expect(dials.length).toBe(4);
    expect(renderedNarrativeDialText('villain-pressure')).toContain('Villain Pressure');
    expect(renderedNarrativeDialText('chapter-payload')).toContain('Chapter Payload');
    expect(renderedNarrativeDialText('pacing')).toContain('Pacing');
    expect(renderedNarrativeDialText('ending-bet')).toContain('Ending Bet');
    expect(renderedNarrativeDialText('chapter-payload')).toContain('More romance');
    expect(renderedNarrativeDialText('pacing')).toContain('Escalate');
    expect(renderedNarrativeDialText('ending-bet')).toContain('Betrayal');
  });

  it('updates selected narrative dial descriptions without exposing numeric levels', () => {
    seedWorkbenchForContinuation();

    const dangerButton = renderedNarrativeDial('chapter-payload')
      ?.querySelector('[data-dial-option-id="danger"]') as HTMLButtonElement | null;
    dangerButton?.click();
    fixture.detectChanges();

    const payloadText = renderedNarrativeDialText('chapter-payload') ?? '';
    expect(payloadText).toContain('Move the threat close enough');
    expect(payloadText).not.toContain('1/5');
    expect(payloadText).not.toContain('level 3');
  });

  it('continues with selected deadline pressure through the existing job flow', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));

    const deadlineButton = renderedVillainPressureDial()?.querySelector('[data-pressure-id="deadline"]') as HTMLButtonElement | null;
    deadlineButton?.click();
    fixture.detectChanges();
    const continueButton = fixture.nativeElement.querySelector('[data-testid="continue-saga"]') as HTMLButtonElement;
    continueButton.click();

    expect(storyService.continueStory).not.toHaveBeenCalled();
    const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
      kind: 'continuation';
      continuation: { continuationBrief?: string };
    };
    expect(jobRequest.kind).toBe('continuation');
    expect(jobRequest.continuation.continuationBrief).toContain('tight deadline');
  });

  it('adds selected narrative dial prose anchors to UI-driven continuation briefs', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));

    (renderedNarrativeDial('chapter-payload')?.querySelector('[data-dial-option-id="romance"]') as HTMLButtonElement | null)?.click();
    (renderedNarrativeDial('pacing')?.querySelector('[data-dial-option-id="sprint"]') as HTMLButtonElement | null)?.click();
    (renderedNarrativeDial('ending-bet')?.querySelector('[data-dial-option-id="betrayal"]') as HTMLButtonElement | null)?.click();
    (renderedVillainPressureDial()?.querySelector('[data-pressure-id="deadline"]') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
    const continueButton = fixture.nativeElement.querySelector('[data-testid="continue-saga"]') as HTMLButtonElement;
    continueButton.click();

    const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
      kind: 'continuation';
      continuation: { continuationBrief?: string };
    };
    expect(jobRequest.kind).toBe('continuation');
    expect(jobRequest.continuation.continuationBrief).toContain('Chapter Payload: Put desire under pressure');
    expect(jobRequest.continuation.continuationBrief).toContain('Pacing: Sprint toward a cliffhanger');
    expect(jobRequest.continuation.continuationBrief).toContain('Ending Bet: Build the ending around betrayal');
    expect(jobRequest.continuation.continuationBrief).toContain('Villain Pressure: Put the characters under a tight deadline');
  });

  it('adds pinned memory card prose anchors to continuation briefs', () => {
    const genesisPayload = seedMaraMemoryCardWorkbench();
    stubCompletedContinuationJob(genesisPayload);

    clickFirstMemoryCardDraftAction('pin-memory-card-draft');
    component.continueSaga('Focus on the betrayal arc.');

    const continuationBrief = latestContinuationBrief();
    expect(continuationBrief).toContain('Focus on the betrayal arc.');
    expect(continuationBrief).toContain('Pinned Memory Cards:');
    expect(continuationBrief).toContain('Character card: Mara');
    expect(continuationBrief).toContain('Keep the moonlit bargain from consuming her archive.');
    expect(continuationBrief).toContain('Trigger: Mara');
  });

  it('supports every narrative dial option in the UI and continuation brief', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));

    for (const dial of component.narrativeDials) {
      for (const option of dial.options) {
        const optionButton = renderedNarrativeDial(dial.id)
          ?.querySelector(`[data-dial-option-id="${option.id}"]`) as HTMLButtonElement | null;

        expect(optionButton)
          .withContext(`${dial.id} should render option ${option.id}`)
          .not.toBeNull();

        optionButton?.click();
        fixture.detectChanges();
        component.continueWithCustomDirection();

        const dialText = renderedNarrativeDialText(dial.id) ?? '';
        const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
          kind: 'continuation';
          continuation: { continuationBrief?: string };
        };

        expect(dialText).withContext(`${dial.id} should show option ${option.id} description`).toContain(option.description);
        expect(jobRequest.continuation.continuationBrief)
          .withContext(`${dial.id} should include option ${option.id} brief`)
          .toContain(option.brief);
      }
    }
  });

  it('adds selected pressure to Director Room continuation notes', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));

    const environmentButton = renderedVillainPressureDial()?.querySelector('[data-pressure-id="environment"]') as HTMLButtonElement | null;
    environmentButton?.click();
    fixture.detectChanges();
    const acceptButton = renderedDirectorRoomPanel()?.querySelector('[data-testid="accept-director-note"]') as HTMLButtonElement | null;
    acceptButton?.click();
    fixture.detectChanges();
    const continueButton = renderedDirectorRoomPanel()?.querySelector('[data-testid="continue-with-director-notes"]') as HTMLButtonElement | null;
    continueButton?.click();

    const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
      kind: 'continuation';
      continuation: { continuationBrief?: string };
    };
    expect(jobRequest.kind).toBe('continuation');
    expect(jobRequest.continuation.continuationBrief).toContain('Director Room notes');
    expect(jobRequest.continuation.continuationBrief).toContain('environment itself');
  });

  it('defaults missing job progress to zero instead of rendering NaN', () => {
    const response = createGenesisJobResponse(undefined, {
      status: 'running',
      currentStep: 'generating_story'
    });
    delete (response.job as Partial<typeof response.job>).progressPercent;
    storyService.createStoryLabJob.and.returnValue(of({ success: true, data: response }));
    configureValidBlueprint('A moonlit archivist bargains with a dangerous fae prince.');

    component.startGenesis();

    const statusText = renderedJobStatusText();
    expect(component.generationProgress().percent).toBe(0);
    expect(statusText).toContain('0%');
    expect(statusText).not.toContain('NaN%');
  });

  it('shows the job durability warning while a non-durable story job is running', () => {
    const response = createGenesisJobResponse(undefined, {
      status: 'running',
      currentStep: 'generating_story',
      progressPercent: 33
    });
    storyService.createStoryLabJob.and.returnValue(of({ success: true, data: response }));
    configureValidBlueprint('A selkie spy signs a forbidden library contract.');

    component.startGenesis();

    const statusText = renderedJobStatusText();
    expect(statusText).toContain('33%');
    expect(statusText).toContain('Jobs are held in memory for this deployment.');
  });

  it('reads the sentence written for a job step from the table', () => {
    const response = createGenesisJobResponse(undefined, {
      status: 'running',
      currentStep: 'generating_story',
      progressPercent: 25
    });
    storyService.createStoryLabJob.and.returnValue(of({ success: true, data: response }));
    configureValidBlueprint('A banshee negotiates one more verse before dawn.');

    component.startGenesis();

    expect(component.statusMessage()).toBe(STORY_LAB_JOB_STEP_LABELS.generating_story);
  });

  it('falls back to the humanized identifier only for a step outside the table', () => {
    // A durable row written by a deployment this build has not caught up with is
    // the one case the fallback is for. It used to be the case for the app's own
    // steps too: a sixth step reached `formatJobStage`, missed all five literals,
    // and rendered as its own title-cased wire name with nothing to report that
    // the sentence written for that moment was missing.
    const response = createGenesisJobResponse(undefined, {
      status: 'running',
      currentStep: 'extracting_continuity',
      progressPercent: 60
    });
    storyService.createStoryLabJob.and.returnValue(of({ success: true, data: response }));
    configureValidBlueprint('A kelpie is asked to explain the tide it did not turn.');

    component.startGenesis();

    expect(component.statusMessage()).toBe('Extracting continuity.');
    expect(Object.values(STORY_LAB_JOB_STEP_LABELS)).not.toContain('Extracting continuity.');
  });

  it('shows a friendly AI configuration error when a genesis job cannot use Grok', () => {
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(undefined, {
        status: 'failed',
        currentStep: 'failed',
        progressPercent: 100,
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'The AI story engine is not configured for this deployment.'
        }
      })
    }));
    configureValidBlueprint('A dragon guardian bargains for one night of forbidden mercy.');

    component.startGenesis();

    expect(component.statusMessage()).toContain('not configured for this deployment');
    expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
  });

  it('cancels an in-flight genesis job creation subscription on destroy', () => {
    const creation$ = new Subject<ApiResponse<StoryLabJobCreationResponse<StoryIterationPayload>>>();
    storyService.createStoryLabJob.and.returnValue(creation$.asObservable());
    configureValidBlueprint('A witch queen bargains with a haunted mirror.');

    component.startGenesis();

    expect(creation$.observed).toBeTrue();
    component.ngOnDestroy();
    expect(creation$.observed).toBeFalse();
  });

  it('cancels an in-flight genesis job creation subscription when creation fails', () => {
    const creation$ = new Subject<ApiResponse<StoryLabJobCreationResponse<StoryIterationPayload>>>();
    storyService.createStoryLabJob.and.returnValue(creation$.asObservable());
    configureValidBlueprint('A witch queen bargains with a haunted mirror.');

    component.startGenesis();

    expect(creation$.observed).toBeTrue();

    creation$.next({
      success: false,
      error: {
        code: 'STORY_LAB_JOB_FAILED',
        message: 'Story generation failed.'
      }
    });

    expect(creation$.observed).toBeFalse();
    expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
  });

  it('loads a saved browser-local project into the workbench', () => {
    const payload: StoryIterationPayload = {
      summary: createSummary({ title: 'Saved Pact' }),
      batch: {
        chapters: [createChapter()],
        totalWordCount: 900,
        suggestedNextPrompts: []
      },
      state: createState(),
      telemetry: {
        engine: 'grok',
        model: 'grok-4.3',
        totalLatencyMs: 1200,
        averageChapterLatencyMs: 1200,
        tokensConsumed: 900,
        retryCount: 0
      }
    };

    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(payload)
    }));
    component.blueprint.set({
      ...component.blueprint(),
      logline: 'A vampire princess bound by forbidden vows.',
      themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'Forbidden romance.' }],
      heatContract: confirmedHeatContract
    });
    component.startGenesis();
    component.resetWorkbench();
    component.loadSavedProject('story-123');

    expect(component.workbench().story?.title).toBe('Saved Pact');
    expect(component.workbench().chapterHistory.length).toBe(1);
    expect(component.modelBadge()).toBe('grok-4.3');
  });

  it('continues an existing saga and appends chapters', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));
    storyService.continueStory.and.returnValue(of({ success: true, data: continuationPayload }));

    component.continueSaga('Focus on the betrayal arc.');

    expect(storyService.continueStory).not.toHaveBeenCalled();
    expect(storyService.createStoryLabJob).toHaveBeenCalledWith(jasmine.objectContaining({
      kind: 'continuation',
      continuation: jasmine.objectContaining({
        storyId: 'story-123',
        continuationBrief: 'Focus on the betrayal arc.'
      })
    }));
    expect(component.workbench().chapterHistory.length).toBe(2);
    expect(component.selectedChapter()?.chapterNumber).toBe(2);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('completed');
  });

  it('continues with a selected direction brief', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));
    storyService.continueStory.and.returnValue(of({ success: true, data: continuationPayload }));

    component.continueWithDirection(component.continuationDirections[1]);

    expect(storyService.continueStory).not.toHaveBeenCalled();
    const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
      kind: 'continuation';
      continuation: { continuationBrief?: string };
    };
    expect(jobRequest.kind).toBe('continuation');
    expect(jobRequest.continuation.continuationBrief)
      .toContain('external danger');
  });

  it('updates continuation progress from a running Story Lab job snapshot', () => {
    seedWorkbenchForContinuation();
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(undefined, {
        status: 'running',
        currentStep: 'continuing_story',
        progressPercent: 28
      })
    }));

    component.continueSaga('Make the rival reveal dangerous.');

    expect(storyService.continueStory).not.toHaveBeenCalled();
    expect(component.generationProgress().percent).toBe(28);
    expect(component.statusMessage()).toContain('Grok');
  });

  it('keeps existing chapters when a continuation job fails', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(undefined, {
        status: 'failed',
        currentStep: 'failed',
        progressPercent: 100,
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'The AI story engine is not configured for this deployment.'
        }
      })
    }));
    storyService.continueStory.and.returnValue(of({ success: true, data: createContinuationPayload(genesisPayload) }));

    component.continueSaga();

    expect(storyService.continueStory).not.toHaveBeenCalled();
    expect(component.workbench().chapterHistory).toEqual(genesisPayload.batch.chapters);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
    expect(component.statusMessage()).toContain('not configured for this deployment');
  });

  it('keeps existing chapters when a completed continuation job has a malformed story payload', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const malformedPayload = {
      ...createContinuationPayload(genesisPayload),
      batch: undefined
    } as unknown as ContinuationJobResult;
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(malformedPayload)
    }));

    expect(() => component.continueSaga()).not.toThrow();
    expect(storyService.continueStory).not.toHaveBeenCalled();
    expect(component.workbench().chapterHistory).toEqual(genesisPayload.batch.chapters);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
    expect(component.statusMessage()).toContain('valid story payload');
  });

  it('copies generated story text to the clipboard', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    component.workbench.set({
      story: createSummary({ title: 'Copied Pact' }),
      state: createState(),
      chapterHistory: [createChapter({ title: 'First Ember', htmlContent: '<p>Heat rose.</p>' })],
      activeBatchSize: 1
    });

    await component.copyStory();

    expect(writeText).toHaveBeenCalled();
    expect(writeText.calls.mostRecent().args[0]).toContain('Copied Pact');
    expect(writeText.calls.mostRecent().args[0]).toContain('Heat rose.');
    expect(component.statusMessage()).toBe('Story copied to your clipboard.');
  });

  it('copies story text as paragraphs with decoded character references', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    component.workbench.set({
      story: createSummary({ title: 'Copied Pact' }),
      state: createState(),
      chapterHistory: [createChapter({
        title: 'First Ember',
        htmlContent: '<p>She opened the door.</p><p>Blood &amp; ash pooled on the &quot;floor&quot;.</p>'
      })],
      activeBatchSize: 1
    });

    await component.copyStory();

    const copied = writeText.calls.mostRecent().args[0] as string;
    // Collapsing the markup to a single line welded the paragraphs together and
    // left the generator's character references sitting in the prose as text.
    expect(copied).toContain('She opened the door.\n\nBlood & ash pooled on the "floor".');
    expect(copied).not.toContain('&amp;');
    expect(copied).not.toContain('door. Blood');
  });

  it('downloads generated story HTML locally', fakeAsync(() => {
    const { anchor, clickSpy } = spyOnAttachedAnchorDownload('blob:story-download');
    seedWorkbenchWithSingleChapter(component, { title: 'Downloaded Pact', synopsis: 'A pact worth keeping.' });

    component.downloadStory();

    expect(anchor.download).toBe('downloaded-pact.html');
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    // The same reading the export spec below records: the revoke is scheduled
    // `OBJECT_URL_REVOKE_DELAY_MS` out, so a bare `tick()` flushes 0ms and
    // never reaches it. This one kept the bare call when the delay was
    // introduced, which is why it has been failing.
    tick(OBJECT_URL_REVOKE_DELAY_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:story-download');
    expect(component.statusMessage()).toBe('Story download created.');
  }));

  it('names the download after a title written in any script', fakeAsync(() => {
    const { anchor } = spyOnAttachedAnchorDownload('blob:story-download');
    // The filename stem used to keep ASCII letters and digits and drop
    // everything else, so a title in any other script kept none of its
    // characters and every such story downloaded as the shared fallback name —
    // the second save landing beside the first as `fairytales-story (1).html`,
    // with nothing in either name to say which story it is.
    seedWorkbenchWithSingleChapter(component, { title: 'Мира и договор', synopsis: 'Договор стоит того.' });

    component.downloadStory();

    expect(anchor.download).toBe('мира-и-договор.html');
    tick(OBJECT_URL_REVOKE_DELAY_MS);
  }));

  it('keeps the download filename inside the filesystem limit', fakeAsync(() => {
    const { anchor } = spyOnAttachedAnchorDownload('blob:story-download');
    // Nothing bounded the stem, and `<stem>.html` has to fit inside the
    // 255-byte filename limit ext4 and APFS enforce: past it the save fails or
    // is silently truncated, on a button whose only failure mode is otherwise
    // silence.
    const longTitle = 'The Blood Oath and the Very Long Night That Followed It '.repeat(20);
    seedWorkbenchWithSingleChapter(component, { title: longTitle, synopsis: 'A pact worth keeping.' });

    component.downloadStory();

    expect(new TextEncoder().encode(anchor.download).length).toBeLessThanOrEqual(255);
    expect(anchor.download.endsWith('-.html')).toBe(false);
    tick(OBJECT_URL_REVOKE_DELAY_MS);
  }));

  it('exports the story in the selected format through the backend', fakeAsync(() => {
    const { anchor, clickSpy } = spyOnAttachedAnchorDownload('blob:story-export');

    seedWorkbenchWithSingleChapter(component, { title: 'Exported Pact', synopsis: 'A pact worth exporting.' });
    component.selectedExportFormat.set('epub');

    const exportOutput: SaveExportSeam['output'] = {
      exportId: 'export-1',
      storyId: component.workbench().story!.storyId,
      downloadUrl: 'data:application/epub+zip;base64,QUJD',
      filename: 'exported-pact.epub',
      format: 'epub',
      fileSize: 3,
      exportedAt: new Date()
    };
    storyService.exportStory.and.returnValue(of({ success: true, data: exportOutput }));

    component.exportStory();

    expect(storyService.exportStory).toHaveBeenCalledWith(jasmine.objectContaining({
      storyId: component.workbench().story!.storyId,
      title: 'Exported Pact',
      format: 'epub',
      creature: component.blueprint().creature
    }));
    expect(component.isExporting()).toBeFalse();
    expect(anchor.download).toBe('exported-pact.epub');
    expect(clickSpy).toHaveBeenCalled();
    // The revoke is scheduled `OBJECT_URL_REVOKE_DELAY_MS` out, not on the next
    // microtask — `tick()` with no argument only flushes 0ms and never reaches it.
    tick(OBJECT_URL_REVOKE_DELAY_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:story-export');
  }));

  it('reports an error instead of downloading when export fails', () => {
    const notificationService = TestBed.inject(NotificationService);
    seedWorkbenchWithSingleChapter(component, { title: 'Failed Pact' });
    storyService.exportStory.and.returnValue(of({
      success: false,
      error: { code: 'FORMAT_NOT_SUPPORTED', message: 'Format not supported', requestedFormat: 'epub', supportedFormats: ['pdf'] }
    }));

    component.exportStory();

    expect(component.isExporting()).toBeFalse();
    const notifications = notificationService.notifications();
    expect(notifications[0]?.type).toBe('error');
    expect(notifications[0]?.message).toBe('Format not supported');
  });

  // `/api/export/save` answers a real status for every refusal, so a rejected
  // export no longer arrives as the `success: false` body the spec above
  // describes — it arrives on the error channel with the same envelope inside
  // it. This subscription discarded that and reported all four of the route's
  // refusals as "Could not reach the export service.", which is the one thing
  // none of them is: the request reached the service and was answered.
  it('reports the reason the export route gave rather than a connection failure', () => {
    const notificationService = TestBed.inject(NotificationService);
    seedWorkbenchWithSingleChapter(component, { title: 'Oversized Pact' });
    storyService.exportStory.and.returnValue(throwError(() => ({
      status: 400,
      error: {
        success: false,
        error: {
          code: 'CONTENT_TOO_LARGE',
          message: 'Content exceeds maximum size of 500KB'
        }
      }
    })));

    component.exportStory();

    expect(component.isExporting()).toBeFalse();
    const notifications = notificationService.notifications();
    expect(notifications[0]?.type).toBe('error');
    expect(notifications[0]?.message).toBe('Content exceeds maximum size of 500KB');
    expect(component.statusMessage()).toBe('Content exceeds maximum size of 500KB');
  });

  // The one export failure the app could not describe: the file is built, the
  // route answered `success: true`, and only the decoding of the inline
  // `data:` URI went wrong. `dataUriToBlob` throws for that, and a throw inside
  // a `next` callback is not routed to the `error` handler below it — RxJS
  // reports it as an unhandled error and abandons the rest of the branch, so
  // the two lines that tell the reader the export is ready never ran either.
  // The spinner stopped, no file was saved, and nothing said why.
  it('reports an export the browser could not decode instead of failing silently', () => {
    const notificationService = TestBed.inject(NotificationService);
    const { clickSpy } = spyOnAttachedAnchorDownload('blob:story-export');
    seedWorkbenchWithSingleChapter(component, { title: 'Undecodable Pact' });

    storyService.exportStory.and.returnValue(of({
      success: true,
      data: {
        exportId: 'export-2',
        storyId: component.workbench().story!.storyId,
        downloadUrl: 'https://cdn.example.com/exports/undecodable-pact.epub',
        filename: 'undecodable-pact.epub',
        format: 'epub',
        fileSize: 3,
        exportedAt: new Date()
      } as SaveExportSeam['output']
    }));

    expect(() => component.exportStory()).not.toThrow();

    expect(component.isExporting()).toBeFalse();
    expect(clickSpy).not.toHaveBeenCalled();
    const notifications = notificationService.notifications();
    expect(notifications[0]?.type).toBe('error');
    expect(notifications[0]?.message).toBe('The export arrived in a form this browser could not save.');
    expect(component.statusMessage()).toBe('The export arrived in a form this browser could not save.');
  });

  // A transport failure has no envelope, so the connection wording is still the
  // right answer for the one case it actually describes.
  it('falls back to the connection message when the export request never reached the service', () => {
    const notificationService = TestBed.inject(NotificationService);
    seedWorkbenchWithSingleChapter(component, { title: 'Offline Pact' });
    storyService.exportStory.and.returnValue(throwError(() => ({
      status: 0,
      error: new ProgressEvent('error')
    })));

    component.exportStory();

    expect(component.isExporting()).toBeFalse();
    expect(notificationService.notifications()[0]?.message).toBe('Could not reach the export service.');
  });
});

// A sibling top-level suite, deliberately not nested inside `describe('App', ...)`
// above: that suite's `beforeEach` already calls `TestBed.configureTestingModule`
// and pins `getStoryLabAuthConfig` to `{ provider: 'none' }` for every one of its
// tests, and `App`'s constructor reads that response once, synchronously, on
// construction — there is no hook to swap it in after the fact, and nesting here
// would instantiate `TestBed` twice for the same test.
describe('App cloud account sign-in wiring', () => {
  interface FakeClerkClient extends ClerkClient {
    listeners: Array<() => void>;
    tokenValue: string;
    fireSessionChange(token: string): void;
  }

  function createFakeClerkClient(openSignIn: jasmine.Spy, signOut?: jasmine.Spy): FakeClerkClient {
    const client: FakeClerkClient = {
      listeners: [],
      tokenValue: 'fake-session-token',
      async load() {},
      openSignIn,
      async signOut() {
        await signOut?.();
      },
      // Reproduces the real `@clerk/clerk-js` client's documented behavior:
      // an immediate first call to `listener` upon registration unless
      // `options.skipInitialEmit` is `true` — see the matching comment in
      // `auth.service.spec.ts`'s fake for why this matters.
      addListener(listener: () => void, options?: { skipInitialEmit?: boolean }) {
        client.listeners.push(listener);
        if (!options?.skipInitialEmit) {
          listener();
        }
        return () => {
          client.listeners = client.listeners.filter(item => item !== listener);
        };
      },
      session: { getToken: async () => client.tokenValue },
      fireSessionChange(token: string) {
        client.tokenValue = token;
        client.listeners.forEach(listener => listener());
      }
    };
    return client;
  }

  async function createAppWithAuthConfig(
    config: ApiResponse<{ provider: 'clerk' | 'none'; publishableKey?: string }>,
    clientLoadError?: Error
  ) {
    const storyServiceSpy = jasmine.createSpyObj<StoryService>('StoryService', [
      'getStoryLabAuthConfig',
      'listCloudStoryProjects',
      'saveCloudStoryProject',
      'loadCloudStoryProject',
      'deleteCloudStoryProject'
    ]);
    storyServiceSpy.getStoryLabAuthConfig.and.returnValue(of(config as any));
    // A signed-in session — the `provider: 'clerk'` case below reaches this —
    // makes `App`'s constructor effect call `refreshCloudLibrary()`, the same
    // way a manual "Check cloud" click would. Stubbed rather than left
    // uncalled so that effect does not throw on a missing spy method.
    storyServiceSpy.listCloudStoryProjects.and.returnValue(of({
      success: true,
      data: {
        ownerUserId: 'user-test',
        storageMode: 'non_durable_memory',
        projects: [],
        totalProjectCount: 0
      }
    }));
    const errorLoggingSpy = jasmine.createSpyObj<ErrorLoggingService>('ErrorLoggingService', [
      'logInfo',
      'logError',
      'getErrors'
    ]);
    errorLoggingSpy.getErrors.and.returnValue(of([]));
    const openSignIn = jasmine.createSpy('openSignIn');
    const signOut = jasmine.createSpy('signOut');
    const clerkClient = createFakeClerkClient(openSignIn, signOut);
    const clientFactory = jasmine.createSpy('clerkClientFactory')
      .and.returnValue(clientLoadError ? Promise.reject(clientLoadError) : Promise.resolve(clerkClient));

    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy },
        { provide: ErrorLoggingService, useValue: errorLoggingSpy },
        { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject<ParamMap>(convertToParamMap({})) } },
        { provide: CLERK_CLIENT_FACTORY, useValue: clientFactory }
      ]
    }).compileComponents();

    const localFixture = TestBed.createComponent(App);
    // Deterministic settle, rather than guessing how many microtask turns the
    // constructor's fire-and-forget `initialize()` chain needs: this is the
    // same idempotent promise it is already running, so awaiting it here
    // waits for exactly that chain and nothing else.
    await TestBed.inject(AuthService).initialize();
    return {
      fixture: localFixture,
      component: localFixture.componentInstance,
      // `CloudLibraryService` is provided on `App` itself (see that
      // service's own doc comment), not root — `TestBed.inject` would hand
      // back an unrelated root-level instance, so callers that need the one
      // this component actually uses go through its injector instead.
      cloudLibraryService: localFixture.debugElement.injector.get(CloudLibraryService),
      openSignIn,
      signOut,
      storyServiceSpy,
      clerkClient
    };
  }

  // Shared by the two stale-load-response tests below: both need a
  // `CloudStoryProjectLoadResult` for an account that has just signed out,
  // and differ only in when the response arrives relative to sign-out.
  function createStalePreviousAccountLoadResponse(component: App): ApiResponse<CloudStoryProjectLoadResult> {
    const project: SavedStoryProject = {
      id: 'previous-account-project',
      storyId: 'story-previous-account',
      title: 'Should not load',
      synopsis: 'Belongs to the account that just signed out.',
      blueprint: component.blueprint(),
      summary: createSummary({ title: 'Should not load' }),
      state: createState(),
      chapters: [createChapter({ title: 'First Ember', htmlContent: '<p>Heat rose.</p>' })],
      createdAt: '2026-06-08T08:37:00.000Z',
      updatedAt: '2026-06-08T08:38:00.000Z'
    };
    return {
      success: true,
      data: {
        ownerUserId: 'previous-account',
        // `cloud_postgres` rather than `non_durable_memory`: a processed
        // response would flip `cloudLibrarySyncState` to `cloud_synced`, so
        // callers asserting on that mode actually distinguish "discarded"
        // from "processed" instead of matching either outcome.
        storageMode: 'cloud_postgres',
        projectId: project.id,
        storyId: project.storyId,
        project,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }
    };
  }

  // Shared by the five stale-load-request tests below: each needs a
  // signed-in, cloud-synced account with a `loadCloudProject()` call already
  // in flight before it drives whatever race it's actually testing.
  function beginPendingCloudLoadRequest(
    component: App,
    storyServiceSpy: jasmine.SpyObj<StoryService>
  ): Subject<ApiResponse<CloudStoryProjectLoadResult>> {
    component.cloudLibrarySyncState.set({ mode: 'cloud_synced' });
    const loadSubject = new Subject<ApiResponse<CloudStoryProjectLoadResult>>();
    storyServiceSpy.loadCloudStoryProject.and.returnValue(loadSubject.asObservable());
    component.loadCloudProject('previous-account-project');
    return loadSubject;
  }

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SKIN_STORAGE_KEY);
  });

  it('opens Clerk sign-in instead of the static message once the deployment reports it is configured', async () => {
    const { component, openSignIn } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_app_wiring' }
    });

    await component.showCloudAccountSetupStatus();

    expect(openSignIn).toHaveBeenCalled();
  });

  it('keeps the unconfigured message when the deployment reports no provider', async () => {
    const { component, openSignIn } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'none' }
    });

    await component.showCloudAccountSetupStatus();

    expect(openSignIn).not.toHaveBeenCalled();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(component.cloudLibrarySyncState().message).toBe(
      'Sign-in setup is not configured yet. Local browser saves are still available.'
    );
  });

  // Before this was fixed, `AuthService.isConfigured()` stayed true here
  // because it only reflected the auth-config response reporting `provider:
  // 'clerk'`, not whether the Clerk client itself ever actually loaded. A
  // deployment whose script was blocked or hit a network error would leave
  // this method returning without ever showing the message below, so
  // "Connect account" silently did nothing on every retry.
  it('shows the setup-pending message, not a silent no-op, when the Clerk client itself fails to load', async () => {
    const { component, openSignIn } = await createAppWithAuthConfig(
      {
        success: true,
        data: { provider: 'clerk', publishableKey: 'pk_test_client_load_failure' }
      },
      new Error('script blocked')
    );

    await component.showCloudAccountSetupStatus();

    expect(openSignIn).not.toHaveBeenCalled();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(component.cloudLibrarySyncState().message).toBe(
      'Sign-in setup is not configured yet. Local browser saves are still available.'
    );
  });

  // Before `signOutOfCloudAccount()` existed there was no path back out of a
  // signed-in session short of clearing cookies by hand — a real gap on a
  // shared device, since the next reader would keep the previous one's
  // authenticated cloud library.
  it('signs out of the Clerk session and clears cloud projects and sync state', async () => {
    const { component, signOut } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_sign_out_wiring' }
    });
    expect(component.isCloudAccountSignedIn()).toBeTrue();
    component.cloudProjects.set([{
      projectId: 'project-cloud',
      storyId: 'story-cloud',
      title: 'Cloud Chapel',
      synopsis: 'A cloud-synced oath.',
      chapterCount: 2,
      acceptedMemoryCardCount: 0,
      createdAt: '2026-06-08T08:37:00.000Z',
      updatedAt: '2026-06-08T08:38:00.000Z'
    }]);

    await component.signOutOfCloudAccount();

    expect(signOut).toHaveBeenCalled();
    expect(component.isCloudAccountSignedIn()).toBeFalse();
    // Clearing `cloudProjects`, not just `cloudLibrarySyncState`, is the
    // actual fix: before this, the account panel moved off `cloud_synced`
    // but the previous account's project titles and metadata stayed
    // rendered underneath it — a real privacy gap on a shared device.
    expect(component.cloudProjects()).toEqual([]);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
    expect(component.cloudLibrarySyncState().message).toBe('Signed out. Local browser saves are still available.');
  });

  // Before this was fixed, a `listCloudStoryProjects` response authenticated
  // just before sign-out could still arrive afterward, since nothing
  // cancelled the in-flight request — silently repopulating `cloudProjects`
  // with the account that just signed out, even though the panel already
  // said "disconnected".
  it('discards a cloud-library response that arrives after sign-out', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_stale_response' }
    });
    const projectsSubject = new Subject<ApiResponse<CloudStoryProjectList>>();
    storyServiceSpy.listCloudStoryProjects.and.returnValue(projectsSubject.asObservable());
    component.refreshCloudLibrary();

    await component.signOutOfCloudAccount();

    // The stale response for the request that was in flight when sign-out
    // happened, arriving late.
    projectsSubject.next({
      success: true,
      data: {
        ownerUserId: 'previous-account',
        storageMode: 'non_durable_memory',
        projects: [{
          projectId: 'previous-account-project',
          storyId: 'story-previous-account',
          title: 'Should not reappear',
          synopsis: 'Belongs to the account that just signed out.',
          chapterCount: 1,
          acceptedMemoryCardCount: 0,
          createdAt: '2026-06-08T08:37:00.000Z',
          updatedAt: '2026-06-08T08:38:00.000Z'
        }],
        totalProjectCount: 1
      }
    });

    expect(component.cloudProjects()).toEqual([]);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
  });

  // Same stale-response race as the listing above, but for a save that was
  // still in flight when the account signed out — before this was fixed, a
  // late save response would call `upsertCloudProject` and silently re-add
  // the previous account's project to the (now cleared) list.
  it('discards a cloud-save response that arrives after sign-out', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_stale_save_response' }
    });
    component.workbench.set({
      story: createSummary({ title: 'Stale Save Pact' }),
      state: createState(),
      chapterHistory: [createChapter({ title: 'First Ember', htmlContent: '<p>Heat rose.</p>' })],
      activeBatchSize: 1
    });
    component.cloudLibrarySyncState.set({ mode: 'cloud_synced' });
    const saveSubject = new Subject<ApiResponse<CloudStoryProjectSaveReceipt>>();
    storyServiceSpy.saveCloudStoryProject.and.returnValue(saveSubject.asObservable());
    component.saveActiveProjectToCloud();

    await component.signOutOfCloudAccount();

    saveSubject.next({
      success: true,
      data: {
        projectId: 'previous-account-project',
        storyId: 'story-previous-account',
        savedAt: '2026-06-08T08:38:00.000Z',
        syncState: { mode: 'cloud_synced', lastSyncedAt: '2026-06-08T08:38:00.000Z' }
      }
    });

    expect(component.cloudProjects()).toEqual([]);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
  });

  // Same stale-response race, but for a load — before this was fixed, a late
  // load response would hydrate the previous account's full story into the
  // UI after it had already cleared its signed-in state.
  it('discards a cloud-load response that arrives after sign-out', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_stale_load_response' }
    });
    const loadSubject = beginPendingCloudLoadRequest(component, storyServiceSpy);

    await component.signOutOfCloudAccount();

    loadSubject.next(createStalePreviousAccountLoadResponse(component));

    expect(component.workbench().story?.title).not.toBe('Should not load');
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
  });

  // Same stale-response race, but for a delete — a late delete response
  // completing after sign-out must not touch the (now cleared) project list
  // or overwrite the signed-out sync state.
  it('discards a cloud-delete response that arrives after sign-out', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_stale_delete_response' }
    });
    component.cloudProjects.set([{
      projectId: 'previous-account-project',
      storyId: 'story-previous-account',
      title: 'Should stay put',
      synopsis: 'Belongs to the account that just signed out.',
      chapterCount: 1,
      acceptedMemoryCardCount: 0,
      createdAt: '2026-06-08T08:37:00.000Z',
      updatedAt: '2026-06-08T08:38:00.000Z'
    }]);
    component.cloudLibrarySyncState.set({ mode: 'cloud_synced' });
    const deleteSubject = new Subject<ApiResponse<CloudStoryProjectDeleteReceipt>>();
    storyServiceSpy.deleteCloudStoryProject.and.returnValue(deleteSubject.asObservable());
    component.deleteCloudProject('previous-account-project');

    await component.signOutOfCloudAccount();

    deleteSubject.next({
      success: true,
      // `cloud_postgres` rather than `non_durable_memory`: a processed
      // response would flip `cloudLibrarySyncState` to `cloud_synced`, so
      // the mode assertion below actually distinguishes "discarded" from
      // "processed" instead of matching either outcome.
      data: {
        ownerUserId: 'previous-account',
        storageMode: 'cloud_postgres',
        projectId: 'previous-account-project',
        deleted: true
      }
    });

    expect(component.cloudProjects()).toEqual([]);
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
  });

  // Before this was fixed, `cancelInFlightCloudLibraryRequest()` ran only
  // *after* `await this.authService.signOut()` resolved. `client.signOut()`
  // is a network call — while it was still pending, a load already in flight
  // could complete and run its callback with nothing yet having cancelled
  // it, hydrating the previous account's full story into the UI even though
  // sign-out was already underway. This uses a deliberately-still-pending
  // Clerk sign-out to prove cancellation now happens before that await, not
  // after: the stale response arrives while `signOutOfCloudAccount()` is
  // still suspended on Clerk, and must still be discarded.
  it('cancels an in-flight cloud request before awaiting a slow Clerk sign-out', async () => {
    const { component, storyServiceSpy, signOut } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_slow_sign_out' }
    });
    const loadSubject = beginPendingCloudLoadRequest(component, storyServiceSpy);
    let resolveClerkSignOut!: () => void;
    signOut.and.returnValue(new Promise<void>(resolve => { resolveClerkSignOut = resolve; }));

    const signOutPromise = component.signOutOfCloudAccount();
    // `signOutOfCloudAccount()` has run synchronously up to its first
    // `await` by this point — including the cancellation, if it now happens
    // before that `await` as intended — while Clerk's own `signOut()` is
    // still unresolved.
    loadSubject.next(createStalePreviousAccountLoadResponse(component));
    resolveClerkSignOut();
    await signOutPromise;

    expect(component.workbench().story?.title).not.toBe('Should not load');
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_unavailable');
  });

  // Cancelling the one request that was already in flight (the test above)
  // isn't enough on its own: `cancelInFlightCloudLibraryRequest()` leaves
  // `isCloudLibraryBusy` false, and before this was fixed that reopened
  // every cloud control — including the template's own gating — for the
  // whole rest of a slow Clerk sign-out. A *new* load started in that window
  // could complete before sign-out did and hydrate the outgoing account's
  // story, which the sign-out cleanup (clearing only `cloudProjects`/
  // `cloudLibrarySyncState`) would never touch. This proves the controls
  // stay locked (`isCloudLibraryBusy()` true, `loadCloudProject` a no-op)
  // for the entire pending sign-out, not just up to the cancellation point.
  it('keeps cloud controls locked for the whole duration of a pending sign-out', async () => {
    const { component, storyServiceSpy, signOut } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_locked_during_sign_out' }
    });
    component.cloudLibrarySyncState.set({ mode: 'cloud_synced' });
    let resolveClerkSignOut!: () => void;
    signOut.and.returnValue(new Promise<void>(resolve => { resolveClerkSignOut = resolve; }));

    const signOutPromise = component.signOutOfCloudAccount();
    // Synchronous up to this point, same as the test above: cancellation and
    // the re-lock have already run, while Clerk's own `signOut()` is still
    // unresolved.
    expect(component.isCloudLibraryBusy()).toBeTrue();

    component.loadCloudProject('previous-account-project');

    expect(
      storyServiceSpy.loadCloudStoryProject
    ).not.toHaveBeenCalled();

    resolveClerkSignOut();
    await signOutPromise;

    expect(component.isCloudLibraryBusy()).toBeFalse();
  });

  // Cancelling the subscription (the tests above) is not a complete fix on
  // its own: Angular's constructor `effect()` is scheduled asynchronously,
  // so an external session change (Clerk revoking a session, or an account
  // switch in another tab) can leave a real window where an already-queued
  // response's callback runs *before* the effect ever gets to cancel it —
  // cancelling afterward stops nothing that already ran. This proves the
  // response is still discarded in exactly that ordering: the live
  // `AuthService` signal is changed directly, without going through
  // `signOutOfCloudAccount()` or the constructor effect at all, so nothing
  // in this test path has cancelled anything by the time the stale response
  // arrives — only the live-identity comparison inside the response
  // callback itself can be what discards it.
  it('discards a cloud response whose identity no longer matches the live signed-in state, independent of the constructor effect', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_live_identity_guard' }
    });
    const loadSubject = beginPendingCloudLoadRequest(component, storyServiceSpy);

    await TestBed.inject(AuthService).signOut();

    loadSubject.next(createStalePreviousAccountLoadResponse(component));

    expect(component.workbench().story?.title).not.toBe('Should not load');
  });

  // Before this was fixed, a stale `error`/`complete` was discarded the same
  // way a stale `next` payload is — but unlike `next`, nothing else ever
  // clears `isCloudLibraryBusy` for that request: dropping the callback
  // entirely left every cloud control disabled permanently, since no later
  // callback exists to release it. This proves the busy lock still releases
  // on a stale `error`, while the error's own state-mutating side effects
  // (logging, `cloudLibrarySyncState`) stay discarded.
  it('releases the busy lock on a stale error response, without applying its error state', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_stale_error_releases_lock' }
    });
    const loadSubject = beginPendingCloudLoadRequest(component, storyServiceSpy);

    await TestBed.inject(AuthService).signOut();
    const syncStateAfterSignOut = component.cloudLibrarySyncState();

    loadSubject.error(new Error('stale request failed'));

    expect(component.isCloudLibraryBusy()).toBeFalse();
    expect(component.cloudLibrarySyncState()).toEqual(syncStateAfterSignOut);
  });

  // Same fix, but for a stale `complete` with no `next`/`error` before it —
  // the shape an aborted or empty response takes.
  it('releases the busy lock on a stale completion', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_stale_complete_releases_lock' }
    });
    const loadSubject = beginPendingCloudLoadRequest(component, storyServiceSpy);

    await TestBed.inject(AuthService).signOut();

    loadSubject.complete();

    expect(component.isCloudLibraryBusy()).toBeFalse();
  });

  // Before this was fixed, a rejected `client.signOut()` was swallowed and
  // the local token cleared regardless, so the app would announce "signed
  // out" on a shared device even though Clerk's own session could still be
  // active and would be restored on the next reload.
  it('does not announce success or clear local session state when Clerk sign-out fails', async () => {
    const { component, signOut } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_sign_out_failure' }
    });
    signOut.and.rejectWith(new Error('clerk sign-out failed'));
    expect(component.isCloudAccountSignedIn()).toBeTrue();

    await component.signOutOfCloudAccount();

    expect(signOut).toHaveBeenCalled();
    expect(component.isCloudAccountSignedIn()).toBeTrue();
  });

  it('does nothing when asked to sign out while already signed out', async () => {
    const { component, signOut } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'none' }
    });

    await component.signOutOfCloudAccount();

    expect(signOut).not.toHaveBeenCalled();
  });

  // Before this was fixed, `ngOnDestroy()` closed only the job subscriptions
  // and the progress timer — a cloud list/save/load/delete request still in
  // flight when the reader navigated away (to `/proving-grounds`, say)
  // stayed subscribed. Angular does not unsubscribe a manually-created RxJS
  // subscription on component destruction, so that response could still
  // arrive and its callback mutate or persist the now-destroyed workbench.
  it('cancels an in-flight cloud-library request on destroy', async () => {
    const { component, storyServiceSpy } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_destroy_cancel' }
    });
    const loadSubject = beginPendingCloudLoadRequest(component, storyServiceSpy);
    expect(loadSubject.observed).toBeTrue();

    component.ngOnDestroy();

    expect(loadSubject.observed).toBeFalse();
  });

  // A multi-session Clerk client can replace one signed-in account with
  // another without an intermediate signed-out state — an account switch in
  // another tab, say. `isSignedIn()` stays `true` throughout that swap, so
  // the constructor effect had to start tracking `accountId()` too: before
  // this was fixed, the effect would never notice the swap at all, leaving
  // the outgoing account's in-flight request both uncancelled and its stale
  // response (once it arrived) free to populate data under the incoming
  // account.
  //
  // Exercised by calling `CloudLibraryService.syncWithAuthState` directly —
  // the method the constructor effect forwards `isSignedIn()`/`accountId()`
  // into — rather than by driving the effect itself through a second signal
  // change: this codebase's TestBed setup does not reliably rerun a
  // constructor effect a second time (see that method's own comment, and
  // the sign-out tests above, for why `fixture.detectChanges()`/
  // `TestBed.flushEffects()` are not options here). What's under test is
  // the *logic* this finding was about; that the effect itself forwards
  // both signals is a two-line, read-not-computed wiring visible entirely
  // at the call site in `App`'s constructor.
  it('discards a stale request and refreshes when the active account changes without a sign-out', async () => {
    const { component, storyServiceSpy, cloudLibraryService } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_account_switch' }
    });
    const sync = cloudLibraryService.syncWithAuthState.bind(cloudLibraryService);
    // Establishes the "already signed in as one account" baseline the
    // `accountChanged` branch requires — a fresh sign-in (`wasSignedIn`
    // still false) is not itself an account switch.
    sync(true, 'user_original_account');
    const loadSubject = beginPendingCloudLoadRequest(component, storyServiceSpy);
    expect(component.isCloudLibraryBusy()).toBeTrue();
    const refreshCallsBeforeSwitch = storyServiceSpy.listCloudStoryProjects.calls.count();

    // The account identity changing while still signed in — the swap this
    // finding was about.
    sync(true, 'user_incoming_account');

    // The incoming account's library was refreshed.
    expect(storyServiceSpy.listCloudStoryProjects.calls.count()).toBeGreaterThan(refreshCallsBeforeSwitch);

    // The outgoing account's in-flight load, arriving after the switch, must
    // still be discarded rather than hydrating the incoming account's view.
    loadSubject.next(createStalePreviousAccountLoadResponse(component));
    expect(component.workbench().story?.title).not.toBe('Should not load');
  });

  // `sessionEpoch` alone does not close this window: it has already advanced
  // by the time a request starting inside it captures it, so the epoch-based
  // guard on the *response* does not stop the *request* from ever going out.
  // A save built from account A's still-displayed story, started in that
  // window, could have its interceptor attach account B's fresh token —
  // persisting A's data under B with no response-level guard able to undo
  // the write. This proves the request itself never starts: `saveCloudStoryProject`
  // is not called while `identityTransitionPending()` is true, and proceeds
  // normally once the transition settles.
  it('blocks a save started while a listener-driven identity transition is still pending, then allows it once settled', async () => {
    const { component, storyServiceSpy, clerkClient } = await createAppWithAuthConfig({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_identity_transition_blocks_save' }
    });
    component.workbench.set({
      story: createSummary({ title: 'Pending Transition Pact' }),
      state: createState(),
      chapterHistory: [createChapter({ title: 'First Ember', htmlContent: '<p>Heat rose.</p>' })],
      activeBatchSize: 1
    });
    component.cloudLibrarySyncState.set({ mode: 'cloud_synced' });
    storyServiceSpy.saveCloudStoryProject.and.returnValue(of({
      success: true,
      data: {
        projectId: 'p1',
        storyId: 's1',
        savedAt: '2026-06-08T08:38:00.000Z',
        syncState: { mode: 'cloud_synced', lastSyncedAt: '2026-06-08T08:38:00.000Z' }
      }
    }));

    let resolveGetToken!: (token: string | null) => void;
    clerkClient.session!.getToken = () => new Promise<string | null>(resolve => {
      resolveGetToken = resolve;
    });
    clerkClient.fireSessionChange('account-b-token');
    expect(TestBed.inject(AuthService).identityTransitionPending()).toBeTrue();

    component.saveActiveProjectToCloud();
    expect(storyServiceSpy.saveCloudStoryProject).not.toHaveBeenCalled();

    resolveGetToken('account-b-token');
    await Promise.resolve();
    await Promise.resolve();
    expect(TestBed.inject(AuthService).identityTransitionPending()).toBeFalse();

    component.saveActiveProjectToCloud();
    expect(storyServiceSpy.saveCloudStoryProject).toHaveBeenCalled();
  });
});

