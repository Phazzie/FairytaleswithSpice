export type CreatureArchetype = 'vampire' | 'werewolf' | 'fairy' | 'siren' | 'djinn';
export type NarrativeTone = 'romance' | 'dark_romance' | 'mystery' | 'adventure' | 'comedy' | 'tragedy';
export type SpicyLevel = 1 | 2 | 3 | 4 | 5;
export type ChapterBatchSize = 1 | 2 | 3;
export type WordBudget = 600 | 900 | 1200 | 1500;

export interface ThemeSeed {
  id: string;
  label: string;
  description: string;
}

export interface StoryBlueprint {
  creature: CreatureArchetype;
  themes: ThemeSeed[];
  logline: string;
  spicyLevel: SpicyLevel;
  tone: NarrativeTone;
  desiredWordBudget: WordBudget;
  protagonistName?: string;
  antagonistName?: string;
  worldDetails?: string;
}

export interface RelationshipEdge {
  characterId: string;
  relationship: 'ally' | 'lover' | 'rival' | 'family' | 'unknown';
  notes: string;
}

export interface CharacterProfile {
  id: string;
  displayName: string;
  archetype: 'protagonist' | 'antagonist' | 'supporting' | 'narrator';
  summary: string;
  currentGoal: string;
  internalConflict: string;
  externalConflict: string;
  secrets: string[];
  relationships: RelationshipEdge[];
  spiceCompatibilities: SpicyLevel[];
}

export interface PlotThread {
  id: string;
  label: string;
  status: 'active' | 'escalating' | 'resolved' | 'dormant';
  description: string;
  foreshadowedDevices: string[];
}

export interface LoreArtifact {
  id: string;
  name: string;
  significance: string;
  introducedInChapter?: number;
  resolvedInChapter?: number;
}

export interface StoryBeat {
  id: string;
  chapterNumber: number;
  summary: string;
  beatType: 'inciting_incident' | 'rising_action' | 'climax' | 'falling_action' | 'resolution' | 'interlude';
  tensionLevel: 1 | 2 | 3 | 4 | 5;
  spicyLevel: SpicyLevel;
}

export interface StoryStateSnapshot {
  storyId: string;
  revision: number;
  characters: CharacterProfile[];
  threads: PlotThread[];
  artifacts: LoreArtifact[];
  beats: StoryBeat[];
  continuityWarnings: string[];
  narrativeVoice: string;
  lastUpdatedAt: string;
}

export interface StorySummary {
  storyId: string;
  title: string;
  synopsis: string;
  tone: NarrativeTone;
  spicyLevel: SpicyLevel;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterDelta {
  introducedCharacters: CharacterProfile[];
  resolvedThreads: string[];
  escalatedThreads: string[];
  foreshadowedArtifacts: LoreArtifact[];
  continuityFlags: string[];
}

export interface GeneratedChapter {
  chapterId: string;
  chapterNumber: number;
  title: string;
  htmlContent: string;
  rawContent?: string;
  summary: string;
  wordCount: number;
  hasCliffhanger: boolean;
  delta: ChapterDelta;
}

export interface ChapterBatchEnvelope {
  chapters: GeneratedChapter[];
  totalWordCount: number;
  suggestedNextPrompts: string[];
}

export interface GenerationTelemetry {
  engine: 'gpt' | 'grok' | 'custom';
  totalLatencyMs: number;
  averageChapterLatencyMs: number;
  tokensConsumed: number;
  retryCount: number;
}

export interface StoryIterationPayload {
  summary: StorySummary;
  batch: ChapterBatchEnvelope;
  state: StoryStateSnapshot;
  telemetry: GenerationTelemetry;
}

export interface StoryGenerationSeam {
  input: StoryBlueprint & {
    chapterBatchSize: ChapterBatchSize;
    allowExperimentalVoices?: boolean;
    narrativeDirectives?: string;
  };

  output: StoryIterationPayload;
}

export interface StoryContinuationSeam {
  input: {
    storyId: string;
    chapterBatchSize: ChapterBatchSize;
    storyState: StoryStateSnapshot;
    previouslyGeneratedChapters: GeneratedChapter[];
    continuationBrief?: string;
    forceCliffhanger?: boolean;
  };

  output: StoryIterationPayload & {
    appendedChapterNumbers: number[];
  };
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
