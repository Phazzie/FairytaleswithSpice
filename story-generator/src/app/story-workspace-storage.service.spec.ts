import { TestBed } from '@angular/core/testing';
import { SavedStoryProject, StoryGenerationSeam } from './contracts';
import { StoryWorkspaceStorageService } from './story-workspace-storage.service';

const STORAGE_KEY = 'fairytales_story_lab_projects_v1';

function createBlueprint(): StoryGenerationSeam['input'] {
  return {
    creature: 'siren',
    themes: [{
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'A romance that breaks supernatural law.'
    }],
    logline: 'A siren diplomat risks exile to save a forbidden lover.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 2,
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    },
    protagonistName: 'Mira',
    antagonistName: 'Lord Brine',
    worldDetails: 'A reef court ruled by vow-binding songs.',
    narrativeDirectives: ''
  };
}

function createProject(overrides: Partial<SavedStoryProject> = {}): SavedStoryProject {
  const now = new Date().toISOString();
  const storyId = overrides.storyId ?? 'story-storage';

  return {
    id: overrides.id ?? storyId,
    storyId,
    title: overrides.title ?? 'Reefbound Vow',
    synopsis: overrides.synopsis ?? 'A siren diplomat risks exile for love.',
    blueprint: overrides.blueprint ?? createBlueprint(),
    summary: overrides.summary ?? {
      storyId,
      title: overrides.title ?? 'Reefbound Vow',
      synopsis: 'A siren diplomat risks exile for love.',
      tone: 'dark_romance',
      spicyLevel: 3,
      createdAt: now,
      updatedAt: now
    },
    state: overrides.state ?? {
      storyId,
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      beats: [],
      continuityWarnings: [],
      narrativeVoice: 'Lush, tense, and romantic.',
      lastUpdatedAt: now
    },
    chapters: overrides.chapters ?? [{
      chapterId: 'chapter-1',
      chapterNumber: 1,
      title: 'Reefbound Vow',
      htmlContent: '<p>Mira entered the court.</p>',
      rawContent: 'Mira entered the court.',
      summary: 'Mira enters the reef court.',
      wordCount: 5,
      hasCliffhanger: true,
      delta: {
        introducedCharacters: [],
        resolvedThreads: [],
        escalatedThreads: [],
        foreshadowedArtifacts: [],
        continuityFlags: []
      }
    }],
    telemetry: overrides.telemetry,
    continuityExtraction: overrides.continuityExtraction,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

describe('StoryWorkspaceStorageService', () => {
  let service: StoryWorkspaceStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StoryWorkspaceStorageService);
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('saves and loads browser-local story projects', () => {
    const project = createProject();

    const result = service.saveProject(project);

    expect(result.success).toBeTrue();
    expect(service.listProjects().length).toBe(1);
    expect(service.loadProject(project.id)?.title).toBe('Reefbound Vow');
  });

  it('updates an existing project instead of duplicating it', () => {
    const project = createProject();

    service.saveProject(project);
    service.saveProject({ ...project, title: 'Reef Court Rewritten' });

    const projects = service.listProjects();
    expect(projects.length).toBe(1);
    expect(projects[0].title).toBe('Reef Court Rewritten');
  });

  it('caps saved projects to the most recent twelve', () => {
    for (let index = 0; index < 14; index += 1) {
      service.saveProject(createProject({
        id: `story-${index}`,
        storyId: `story-${index}`,
        title: `Story ${index}`,
        updatedAt: new Date(2026, 0, index + 1).toISOString()
      }));
    }

    const projects = service.listProjects();
    expect(projects.length).toBe(12);
    expect(projects.some(project => project.id === 'story-0')).toBeFalse();
    expect(projects[0].id).toBe('story-13');
  });

  it('surfaces localStorage write failures', () => {
    const setItemSpy = spyOn(Storage.prototype, 'setItem').and.throwError('quota');

    const result = service.saveProject(createProject());

    expect(result.success).toBeFalse();
    expect(setItemSpy).toHaveBeenCalled();
  });
});
