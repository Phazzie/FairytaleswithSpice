// Created: 2026-06-21 08:56
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProvingGroundsTestResult } from '../contracts';
import { ProvingGroundsComponent } from './proving-grounds';
import { STORY_BLUEPRINT_LIMITS } from '../../../../shared/storyBlueprintLimits';
import { STORY_LAB_THEME_SEEDS } from '../../../../shared/storyLabThemeSeeds';

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProvingGroundsComponent, HttpClientTestingModule],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ProvingGroundsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('provingGrounds_testHistory');
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
});
