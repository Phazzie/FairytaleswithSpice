// Created: 2026-06-21 08:56
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  CHAPTER_BATCH_SIZES,
  CREATURE_ARCHETYPES,
  ProvingGroundsTestResult,
  SPICY_LEVELS,
  StoryIterationPayload,
  WORD_BUDGETS
} from '../contracts';
import { ProvingGroundsComponent } from './proving-grounds';
import { ErrorLoggingService } from '../error-logging';
import { STORY_BLUEPRINT_LIMITS } from '../../../../shared/storyBlueprintLimits';
import { STORY_LAB_THEME_SEEDS } from '../../../../shared/storyLabThemeSeeds';

function createStoryIterationPayload(engine: 'gpt' | 'grok' | 'custom' = 'gpt'): StoryIterationPayload {
  const now = new Date().toISOString();
  return {
    summary: {
      storyId: 'story-123',
      title: 'Crimson Covenant',
      synopsis: 'A pact of blood entwines lovers and rivals.',
      tone: 'dark_romance',
      spicyLevel: 3,
      createdAt: now,
      updatedAt: now
    },
    batch: {
      chapters: [
        {
          chapterId: 'chapter-1',
          chapterNumber: 1,
          title: 'Moonlit Ultimatum',
          htmlContent: '<p>Content</p>',
          rawContent: '<p>Content</p>',
          summary: 'An impossible choice is presented.',
          wordCount: 900,
          hasCliffhanger: true,
          delta: {
            introducedCharacters: [],
            resolvedThreads: [],
            escalatedThreads: [],
            foreshadowedArtifacts: [],
            continuityFlags: []
          }
        }
      ],
      totalWordCount: 900,
      suggestedNextPrompts: []
    },
    state: {
      storyId: 'story-123',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      beats: [],
      continuityWarnings: [],
      narrativeVoice: 'Whispers in velvet',
      lastUpdatedAt: now
    },
    telemetry: {
      engine,
      totalLatencyMs: 2000,
      averageChapterLatencyMs: 2000,
      tokensConsumed: 1200,
      retryCount: 0
    }
  };
}

function createEvaluatedResult(): ProvingGroundsTestResult {
  return {
    id: 'test-quality-report',
    timestamp: new Date('2026-06-08T10:20:00.000Z'),
    configuration: {
      creature: 'siren',
      themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'Rules make romance dangerous.' }],
      spicyLevel: 3,
      wordCount: 900,
      userInput: '',
      promptTemplate: {
        id: 'template',
        name: 'Template',
        description: 'Template description.',
        systemPrompt: 'System',
        userPromptTemplate: 'User',
        category: 'experimental'
      },
      promptPreview: {
        system: 'System',
        user: 'User'
      }
    },
    generatedStory: '<p>Mira held the witness shell.</p>',
    generationTime: 1200,
    chapterCount: 1,
    totalWordCount: 900,
    isMockGeneration: false,
    aiEvaluation: {
      score: 82,
      strengths: ['Strong hook.'],
      weaknesses: ['Needs sharper voice.'],
      suggestions: ['Name the cost.'],
      overallFeedback: 'Useful draft.',
      heuristicReport: {
        source: 'heuristic',
        heuristicOnly: true,
        overallScore: 78,
        summary: 'Deterministic story-quality scan completed with 7 advisory dimensions.',
        dimensions: [
          {
            id: 'continuity',
            label: 'Continuity',
            score: 88,
            rationale: 'Story text repeats configured state.',
            signals: ['Creature appears: siren', 'Theme echo appears: forbidden_love']
          },
          {
            id: 'audio_readiness',
            label: 'Audio-readiness',
            score: 74,
            rationale: 'Audio-readiness checks dialogue tags and paragraph length.',
            signals: ['No overlong paragraphs detected.']
          }
        ]
      }
    }
  };
}

type TestResultFactoryOverrides = Omit<Partial<ProvingGroundsTestResult>, 'id' | 'timestamp' | 'configuration' | 'generatedStory' | 'generationTime' | 'chapterCount' | 'totalWordCount'>;

function createTestResult(
  id: string,
  overrides: TestResultFactoryOverrides = {}
): ProvingGroundsTestResult {
  const baseResult = createEvaluatedResult();
  const result: ProvingGroundsTestResult = {
    ...baseResult,
    id,
    ...overrides
  };
  return result;
}

function createBasicResult(id: string): ProvingGroundsTestResult {
  return createTestResult(id, { aiEvaluation: undefined });
}

function getByTestId(fixture: ComponentFixture<ProvingGroundsComponent>, testId: string): HTMLButtonElement {
  const button = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  expect(button).withContext(`Element with data-testid="${testId}" should exist`).toBeTruthy();
  return button as HTMLButtonElement;
}

function getAllByTestId(fixture: ComponentFixture<ProvingGroundsComponent>, testId: string): HTMLButtonElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`)) as HTMLButtonElement[];
}

function getGenerateButton(fixture: ComponentFixture<ProvingGroundsComponent>): HTMLButtonElement {
  return getByTestId(fixture, 'generate-story');
}

function getExportButton(fixture: ComponentFixture<ProvingGroundsComponent>): HTMLButtonElement {
  return getByTestId(fixture, 'export-results');
}

function getCurrentEvaluateButton(fixture: ComponentFixture<ProvingGroundsComponent>): HTMLButtonElement {
  return getByTestId(fixture, 'evaluate-story');
}

describe('ProvingGroundsComponent', () => {
  let fixture: ComponentFixture<ProvingGroundsComponent>;
  let component: ProvingGroundsComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProvingGroundsComponent, HttpClientTestingModule],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ProvingGroundsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('provingGrounds_testHistory');
    httpMock.verify();
  });

  it('renders deterministic heuristic report dimensions for evaluated stories', () => {
    component.currentTest.set(createEvaluatedResult());

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Deterministic Quality Scan');
    expect(text).toContain('78');
    expect(text).toContain('Continuity');
    expect(text).toContain('Audio-readiness');
    expect(text).toContain('Creature appears: siren');
  });

  it('summarizes deterministic heuristic scores in history cards', () => {
    component.testHistory.set([createEvaluatedResult()]);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quality 78');
  });

  it('disables export when no test history exists', () => {
    component.testHistory.set([]);

    fixture.detectChanges();

    const exportButton = getExportButton(fixture);
    expect(exportButton.disabled).toBeTrue();
  });

  it('disables generate button while generation is in progress', () => {
    component.isGenerating.set(true);

    fixture.detectChanges();

    const generateButton = getGenerateButton(fixture);
    expect(generateButton.disabled).toBeTrue();
  });

  it('disables generate button when no themes are selected', () => {
    component.selectedThemeIds = [];

    fixture.detectChanges();

    const generateButton = getGenerateButton(fixture);
    expect(generateButton.disabled).toBeTrue();
  });

  it('limits comparison selections to three tests', () => {
    const testOne = createBasicResult('comparison-one');
    const testTwo = createBasicResult('comparison-two');
    const testThree = createBasicResult('comparison-three');
    const testFour = createBasicResult('comparison-four');

    component.testHistory.set([testOne, testTwo, testThree, testFour]);
    component.comparisonMode.set(true);
    component.selectedComparisons.set([testOne, testTwo, testThree]);

    fixture.detectChanges();

    const selectButtons = getAllByTestId(fixture, 'select-comparison');
    const disabledSelectButton = selectButtons.find(button =>
      button.textContent?.trim() === 'Select'
    );
    expect(disabledSelectButton).withContext('Fourth comparison button should exist').toBeTruthy();
    expect(disabledSelectButton!.disabled).toBeTrue();
  });

  it('disables current evaluate button once a result already has AI evaluation', () => {
    component.currentTest.set(createEvaluatedResult());

    fixture.detectChanges();

    const evaluateButton = getCurrentEvaluateButton(fixture);
    expect(evaluateButton.disabled).toBeTrue();
    expect(evaluateButton.textContent).toContain('✅ Evaluated');
  });

  it('shows a mock-evaluation warning and keeps the evaluate button enabled for a mock result', () => {
    const mockResult = createTestResult('mock-evaluation', {
      aiEvaluation: {
        score: 75,
        strengths: ['Strong opening hook that captures attention'],
        weaknesses: ['Some dialogue feels generic or repetitive'],
        suggestions: ['Vary dialogue patterns between characters for distinct voices'],
        overallFeedback: 'Solid story with good fundamentals.',
        isMockEvaluation: true
      }
    });
    component.currentTest.set(mockResult);

    fixture.detectChanges();

    const badge = getByTestId(fixture, 'mock-evaluation-badge');
    expect(badge.textContent).toContain('Offline mock evaluation');

    const evaluateButton = getCurrentEvaluateButton(fixture);
    expect(evaluateButton.disabled).toBeFalse();
    expect(evaluateButton.textContent).toContain('Retry Evaluation');
  });

  it('does not show a mock-evaluation warning for a real AI evaluation', () => {
    component.currentTest.set(createEvaluatedResult());

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="mock-evaluation-badge"]')).toBeNull();
  });

  // The picker used to be its own list of ten classic `ThemeType` ids, so seven
  // of the app's twelve seeds could not be tested at all and five of the ids on
  // offer were ones no reader can send. Compared field by field rather than by
  // id, because a seed's `label` and `description` reach the generation prompt:
  // matching ids carrying this page's own wording would still test a prompt the
  // app never builds.
  it('offers exactly the thematic seeds the app picker offers', () => {
    expect(component.themeOptions).toEqual(STORY_LAB_THEME_SEEDS.map(seed => ({ ...seed })));
  });

  // The same argument as the seeds above, held on the four closed vocabularies
  // beside them. A picker that writes its own list is a second declaration of
  // what the values are, and the way it fails is silent: a creature or a word
  // budget added to the table is accepted by the parser, by the form, and by
  // both prompt builders, and simply never appears on the one screen built for
  // comparing prompts.
  it('offers exactly the vocabularies the blueprint routes accept', () => {
    expect(component.creatureOptions).toEqual(CREATURE_ARCHETYPES);
    expect(component.wordCountOptions).toEqual(WORD_BUDGETS);
    expect(component.chapterBatchOptions).toEqual(CHAPTER_BATCH_SIZES);
  });

  it('bounds the spice slider by the ladder rather than by a number in the markup', () => {
    expect(component.minSpicyLevel).toBe(Math.min(...SPICY_LEVELS));
    expect(component.maxSpicyLevel).toBe(Math.max(...SPICY_LEVELS));

    const slider: HTMLInputElement = fixture.nativeElement.querySelector('#pg-spice');
    expect(slider.min).toBe(String(component.minSpicyLevel));
    expect(slider.max).toBe(String(component.maxSpicyLevel));
  });

  // `title` and `summary` are model prose, and the preview document was built
  // by interpolating them into markup. A chapter called `<The Reckoning>` lost
  // its own name to an unknown element and took the paragraph after it into an
  // unclosed tag, so a comparison reported on prose that had been generated and
  // never shown.
  it('escapes a chapter title and summary into the preview document', () => {
    const rendered = component['renderChapters']([
      {
        chapterId: 'chapter-1',
        chapterNumber: 1,
        title: '<The Reckoning> & Roses',
        htmlContent: '<p>She counted the tide.</p>',
        summary: 'A bargain is struck & a door <closes>.',
        wordCount: 4,
        hasCliffhanger: false,
        delta: {
          introducedCharacters: [],
          resolvedThreads: [],
          escalatedThreads: [],
          foreshadowedArtifacts: [],
          continuityFlags: []
        }
      }
    ]);

    expect(rendered).toContain('<h3>&lt;The Reckoning&gt; &amp; Roses</h3>');
    expect(rendered).toContain('A bargain is struck &amp; a door &lt;closes&gt;.');
    // The chapter body is markup by contract and is sanitized where it renders.
    expect(rendered).toContain('<p>She counted the tide.</p>');
  });

  it('lets a test carry as many seeds as the blueprint route accepts', () => {
    component.selectedThemeIds = [];

    for (const theme of component.themeOptions) {
      component.toggleTheme(theme);
    }

    expect(component.selectedThemeIds.length).toBe(STORY_BLUEPRINT_LIMITS.maxThemes);
    // The most recent choices, since selecting past the cap drops the oldest.
    expect(component.selectedThemeIds).toEqual(
      component.themeOptions.slice(-STORY_BLUEPRINT_LIMITS.maxThemes).map(theme => theme.id)
    );
  });

  // The restore read `localStorage` as `StoredProvingGroundsTestResult[]` and
  // mapped over it, which asserts a shape rather than checking one. An entry
  // without a readable `timestamp` becomes `new Date(undefined)` — an
  // `Invalid Date` — and the history list renders it through
  // `{{ test.timestamp | date:'short' }}`. Angular's `DatePipe` throws on a date
  // it cannot convert, and it throws during change detection, so one bad entry
  // does not degrade a row: it takes the whole page down on every load, with the
  // delete button that would remove it on the page that will not render.
  it('drops stored history entries it cannot render instead of failing to load', () => {
    const good = createBasicResult('restored-good');
    localStorage.setItem('provingGrounds_testHistory', JSON.stringify([
      { ...good, timestamp: good.timestamp.toISOString() },
      // No timestamp at all: the `Invalid Date` the date pipe throws on.
      { ...good, id: 'restored-no-timestamp', timestamp: undefined },
      // A timestamp that is a string but not a date.
      { ...good, id: 'restored-bad-timestamp', timestamp: 'not a date' },
      // Shaped like a record but missing what the template dereferences.
      { id: 'restored-no-configuration', timestamp: good.timestamp.toISOString() },
      'not an object at all'
    ]));

    const restored = TestBed.createComponent(ProvingGroundsComponent);
    expect(() => restored.detectChanges()).not.toThrow();

    expect(restored.componentInstance.testHistory().map(test => test.id)).toEqual(['restored-good']);
    expect(restored.componentInstance.testHistory()[0].timestamp.getTime())
      .toBe(good.timestamp.getTime());
  });

  it('ignores a stored history that is not a list', () => {
    localStorage.setItem('provingGrounds_testHistory', JSON.stringify({ id: 'not-a-list' }));

    const restored = TestBed.createComponent(ProvingGroundsComponent);
    expect(() => restored.detectChanges()).not.toThrow();

    expect(restored.componentInstance.testHistory()).toEqual([]);
  });

  it('deletes the current history item when its delete action is clicked', () => {
    const firstResult = createBasicResult('delete-current');
    const secondResult = createBasicResult('delete-survivor');

    component.testHistory.set([firstResult, secondResult]);
    component.currentTest.set(firstResult);

    fixture.detectChanges();

    const deleteButtons = getAllByTestId(fixture, 'delete-test');
    deleteButtons[0].click();

    fixture.detectChanges();

    expect(component.currentTest()).toBeNull();
    expect(component.testHistory().length).toBe(1);
    expect(component.testHistory()[0].id).toBe('delete-survivor');
  });

  // The page opened on the "Current Production" template by default and packed
  // its whole system+user prompt into `narrativeDirectives`, which the
  // blueprint routes cap at 1,200 characters. The real prompt runs to about
  // 10,500 — so the very first thing a reader could do on this page, pressing
  // Generate with nothing changed, always hit that cap and never ran.
  it('sends no narrativeDirectives override for the unmodified "Current Production" baseline, so it can actually generate', () => {
    expect(component.selectedPromptTemplate()?.id).toBe('production');
    expect(component.narrativeDirectivesOverflowMessage()).toBeNull();

    const generateButton = getGenerateButton(fixture);
    expect(generateButton.disabled).toBeFalse();

    component.generateStory();

    const req = httpMock.expectOne('/api/story-lab/stories');
    expect(req.request.body.narrativeDirectives).toBeUndefined();
    req.flush({ success: true, data: createStoryIterationPayload() });
  });

  // Experimental templates still travel inside `narrativeDirectives` — the
  // route has no seam for a real system-prompt override — but the literal
  // `'PROVING GROUNDS TEST'` label and the generation-logic summary used to
  // ride along too, spending part of the same 1,200-character budget on text
  // that was not the prompt under test.
  it('sends only the system and user prompt as narrativeDirectives for an experimental template', () => {
    const concise = component.promptTemplates.find(template => template.id === 'concise')!;
    component.selectPromptTemplate(concise);
    fixture.detectChanges();

    const prompts = component.getFilledPrompts()!;
    component.generateStory();

    const req = httpMock.expectOne('/api/story-lab/stories');
    expect(req.request.body.narrativeDirectives).toBe(`${prompts.system}\n\n${prompts.user}`);
    expect(req.request.body.narrativeDirectives).not.toContain('PROVING GROUNDS TEST');
    req.flush({ success: true, data: createStoryIterationPayload() });
  });

  // `buildGenesisResponse()`'s canned mock chapters (served when no model
  // provider is configured) ignore whatever prompt was under test — Codex's
  // review caught that a mock result was stored and comparable exactly like
  // a real one, with nothing marking it as such.
  it('marks a result generated from mock chapters instead of comparing it as a real run', () => {
    component.generateStory();

    const req = httpMock.expectOne('/api/story-lab/stories');
    req.flush({ success: true, data: createStoryIterationPayload('custom') });

    const stored = component.currentTest();
    expect(stored!.isMockGeneration).toBeTrue();
    expect(component.statusMessage.toLowerCase()).toContain('mock');

    fixture.detectChanges();
    expect(getByTestId(fixture, 'mock-generation-badge')).withContext(
      'the current-test view should flag a mock generation'
    ).toBeTruthy();
  });

  it('does not mark a real generation as mock', () => {
    component.generateStory();

    const req = httpMock.expectOne('/api/story-lab/stories');
    req.flush({ success: true, data: createStoryIterationPayload('gpt') });

    expect(component.currentTest()!.isMockGeneration).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="mock-generation-badge"]')).toBeNull();
  });

  // `StoryService.beginStory()` already logs an HTTP failure through
  // `ErrorLoggingService` (`handleHttpError`) before rethrowing it — Codex's
  // review caught that this component's own error handler logged the same
  // error a second time, doubling every failed generation in the Debug
  // Errors panel.
  it('does not log a failed generation a second time on top of StoryService\'s own logging', () => {
    const errorLogging = TestBed.inject(ErrorLoggingService);
    spyOn(errorLogging, 'logError').and.callThrough();

    component.generateStory();

    const req = httpMock.expectOne('/api/story-lab/stories');
    req.flush({ success: false, error: { code: 'GENERATION_FAILED', message: 'boom' } }, { status: 500, statusText: 'Server Error' });

    // `logInfo` is itself a thin wrapper around `logError` (severity
    // 'info') — `StoryService.beginStory()` calls that once just to record
    // the request starting, unrelated to this failure. What must not
    // double is the *error*-severity call `handleHttpError` makes.
    const errorSeverityCalls = (errorLogging.logError as jasmine.Spy).calls.all()
      .filter(call => (call.args[2] ?? 'error') === 'error');
    expect(errorSeverityCalls.length).toBe(1);
    expect(errorSeverityCalls[0].args[1]).toBe('StoryService.beginStory');
  });

  // Editing the "Current Production" template's own text is what turns it from
  // a baseline into a variant: the reader is no longer comparing against what
  // the app actually sends, so it has to go through the same capped field
  // every other template does.
  it('treats "Current Production" as a variant once custom prompt editing is turned on, and reports the resulting overflow', () => {
    component.useCustomPrompts = true;
    fixture.detectChanges();

    const overflow = component.narrativeDirectivesOverflowMessage();
    expect(overflow).toContain(`this API accepts ${STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength}`);

    const generateButton = getGenerateButton(fixture);
    expect(generateButton.disabled).toBeTrue();

    const warning = getByTestId(fixture, 'narrative-directives-overflow');
    expect(warning.textContent).toContain(overflow);

    component.generateStory();
    httpMock.expectNone('/api/story-lab/stories');
  });

  // `viewPrompts()` used to hand a ~10,000-character prompt to
  // `globalThis.alert()`, which truncates on most platforms, cannot be
  // scrolled or selected, and is a no-op during SSR.
  it('shows a closable prompt preview panel instead of alert() when View Prompts is clicked', () => {
    spyOn(window, 'alert');

    getByTestId(fixture, 'view-prompts').click();
    fixture.detectChanges();

    expect(window.alert).not.toHaveBeenCalled();
    // Read back from the signal `viewPrompts()` set, not a second
    // `getFilledPrompts()` call: the "Current Production" template draws a
    // fresh random Chekhov ledger on every call, by design (see
    // `resolveNarrativeDirectives`'s doc), so a second call here would assert
    // the panel against a draw that never rendered.
    const preview = component.promptPreview();
    expect(preview).not.toBeNull();
    expect(getByTestId(fixture, 'prompt-preview-system').textContent).toBe(preview!.system);
    expect(getByTestId(fixture, 'prompt-preview-user').textContent).toBe(preview!.user);

    getByTestId(fixture, 'close-prompt-preview').click();
    fixture.detectChanges();

    expect(component.promptPreview()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="prompt-preview-system"]')).toBeNull();
  });

  // `aria-modal="true"` alone doesn't move focus, trap it, or support Escape.
  // Codex's review of the initial push flagged exactly this: opening the
  // panel left focus on the trigger button, so Tab kept walking through the
  // configuration controls behind the overlay before ever reaching Close.
  it('moves keyboard focus into the prompt preview panel on open, and restores it to the trigger on close', fakeAsync(() => {
    const viewPromptsButton = getByTestId(fixture, 'view-prompts');
    viewPromptsButton.focus();
    expect(document.activeElement).toBe(viewPromptsButton);

    viewPromptsButton.click();
    fixture.detectChanges();
    tick();

    const panel: HTMLElement | null = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(panel).withContext('the prompt preview panel should render').toBeTruthy();
    expect(document.activeElement).toBe(panel);

    getByTestId(fixture, 'close-prompt-preview').click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(viewPromptsButton);
  }));

  it('closes the prompt preview panel on Escape', fakeAsync(() => {
    getByTestId(fixture, 'view-prompts').click();
    fixture.detectChanges();
    tick();

    const panel: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component.promptPreview()).toBeNull();
  }));

  // Codex's review also caught that a stored result's `promptPreview` still
  // held the client's independently-filled prompt even for the unmodified
  // "Current Production" baseline, which — since this PR — sends no
  // `narrativeDirectives` override at all. That text was never sent to the
  // model, so attributing the generated story to it would be exactly the
  // "documented capability, no matching implementation" defect this whole
  // page exists to catch, one field deeper.
  it('records an honest baseline notice instead of the discarded client-drawn prompt for an unmodified production result', () => {
    expect(component.selectedPromptTemplate()?.id).toBe('production');

    component.generateStory();

    const req = httpMock.expectOne('/api/story-lab/stories');
    req.flush({ success: true, data: createStoryIterationPayload() });

    const stored = component.currentTest();
    expect(stored).not.toBeNull();
    expect(stored!.configuration.promptPreview.system).not.toContain('PROTAGONIST:');
    expect(stored!.configuration.promptPreview.system).toBe(stored!.configuration.promptPreview.user);
    expect(stored!.configuration.promptPreview.system.toLowerCase()).toContain('no narrativedirectives override');
  });
});
