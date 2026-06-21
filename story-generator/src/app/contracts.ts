/**
 * Next-generation seam contracts for the Fairytales with Spice platform.
 *
 * The previous system tightly coupled a single-chapter response to the UI, which
 * made it impossible to expand into multi-chapter batches or maintain continuity
 * across long-running sagas. This file defines an entirely new set of contracts
 * that support batch generation, persistent story state tracking, and
 * downstream services such as audio and export pipelines.
 */

// ==================== CORE DOMAIN TYPES ====================

export type CreatureArchetype =
  | 'vampire'
  | 'werewolf'
  | 'fairy'
  | 'siren'
  | 'djinn'
  | 'witch'
  | 'dragon'
  | 'demon'
  | 'angel'
  | 'mermaid';
export type NarrativeTone = 'romance' | 'dark_romance' | 'mystery' | 'adventure' | 'comedy' | 'tragedy';
export type SpicyLevel = 1 | 2 | 3 | 4 | 5;
export type ChapterBatchSize = 1 | 2 | 3;
export type WordBudget = 600 | 900 | 1200 | 1500;
export type HeatTensionMode = 'slow_burn' | 'dangerous_proximity' | 'playful_banter' | 'devotional_longing';
export type HeatIntimacyBoundary = 'fade_to_black' | 'closed_door' | 'literary_on_page';

export const CREATURE_ARCHETYPES = [
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
] as const satisfies readonly CreatureArchetype[];

export const NARRATIVE_TONES = [
  'romance',
  'dark_romance',
  'mystery',
  'adventure',
  'comedy',
  'tragedy'
] as const satisfies readonly NarrativeTone[];

export const HEAT_TENSION_MODES = [
  'slow_burn',
  'dangerous_proximity',
  'playful_banter',
  'devotional_longing'
] as const satisfies readonly HeatTensionMode[];

export const HEAT_INTIMACY_BOUNDARIES = [
  'fade_to_black',
  'closed_door',
  'literary_on_page'
] as const satisfies readonly HeatIntimacyBoundary[];

export interface ThemeSeed {
  id: string;
  label: string;
  description: string;
}

export interface HeatContract {
  adultOnlyConfirmed: boolean;
  tensionMode: HeatTensionMode;
  intimacyBoundary: HeatIntimacyBoundary;
  noGoContent?: string;
}

export interface StoryBlueprint {
  creature: CreatureArchetype;
  themes: ThemeSeed[];
  logline: string;
  spicyLevel: SpicyLevel;
  tone: NarrativeTone;
  desiredWordBudget: WordBudget;
  heatContract: HeatContract;
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
  tropeMetadata?: string;
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

export interface StoryStateDelta {
  storyId: string;
  fromRevision: number | null;
  toRevision: number;
  addedChapterNumbers: number[];
  introducedCharacters: CharacterProfile[];
  updatedCharacters: CharacterProfile[];
  resolvedThreads: string[];
  escalatedThreads: PlotThread[];
  foreshadowedArtifacts: LoreArtifact[];
  continuityWarnings: string[];
  beatIds: string[];
  summary: string;
}

export interface StoryPersistenceReceipt {
  mode: 'client_carried' | 'transient_memory' | 'durable_storage';
  persistedRevision: number;
  persistedAt: string;
  warning?: string;
}

export interface GenerationTelemetry {
  engine: 'gpt' | 'grok' | 'custom';
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  fallbackFromModel?: string;
  totalLatencyMs: number;
  averageChapterLatencyMs: number;
  tokensConsumed: number;
  retryCount: number;
}

export type ContinuityExtractionSource = 'ai' | 'heuristic' | 'mixed';

export interface ContinuityExtractionReceipt {
  source: ContinuityExtractionSource;
  extractedAt: string;
  confidence: number;
  warning?: string;
}

export interface StoryIterationPayload {
  summary: StorySummary;
  batch: ChapterBatchEnvelope;
  state: StoryStateSnapshot;
  stateDelta?: StoryStateDelta;
  persistence?: StoryPersistenceReceipt;
  continuityExtraction?: ContinuityExtractionReceipt;
  telemetry: GenerationTelemetry;
}

export interface SavedStoryProject {
  id: string;
  storyId: string;
  title: string;
  synopsis: string;
  blueprint: StoryGenerationSeam['input'];
  summary: StorySummary;
  state: StoryStateSnapshot;
  chapters: GeneratedChapter[];
  telemetry?: GenerationTelemetry;
  continuityExtraction?: ContinuityExtractionReceipt;
  createdAt: string;
  updatedAt: string;
}

export type StoryLabLibrarySort = 'updated_desc' | 'created_desc' | 'title_asc';

export const STORY_LAB_LIBRARY_SORTS = [
  'updated_desc',
  'created_desc',
  'title_asc'
] as const satisfies readonly StoryLabLibrarySort[];

export interface StoryLabProfilePreferences {
  defaultHeatContract: HeatContract;
  favoriteCreatures: CreatureArchetype[];
  favoriteTones: NarrativeTone[];
  contentBoundaries?: string;
  librarySort: StoryLabLibrarySort;
}

export interface StoryLabUserProfile {
  userId: string;
  displayName: string;
  preferences: StoryLabProfilePreferences;
  createdAt: string;
  updatedAt: string;
}

export type CloudLibrarySyncMode = 'local_only' | 'cloud_synced' | 'sync_failed' | 'cloud_unavailable';

export interface CloudLibrarySyncState {
  mode: CloudLibrarySyncMode;
  lastSyncedAt?: string;
  message?: string;
}

export type CloudStoryProjectStorageMode = 'cloud_postgres' | 'non_durable_memory';

export interface CloudStoryProjectListItem {
  projectId: string;
  storyId: string;
  title: string;
  synopsis: string;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudStoryProjectList {
  ownerUserId: string;
  storageMode: CloudStoryProjectStorageMode;
  projects: CloudStoryProjectListItem[];
}

export interface CloudStoryProjectSaveReceipt {
  projectId: string;
  storyId: string;
  savedAt: string;
  syncState: CloudLibrarySyncState;
}

export interface CloudStoryProjectLoadResult {
  ownerUserId: string;
  storageMode: CloudStoryProjectStorageMode;
  projectId: string;
  storyId: string;
  project: SavedStoryProject;
  createdAt: string;
  updatedAt: string;
}

export interface CloudStoryProjectDeleteReceipt {
  ownerUserId: string;
  storageMode: CloudStoryProjectStorageMode;
  projectId: string;
  deleted: boolean;
}

export type BatchProgressStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export interface BatchProgressState {
  id: string;
  label: string;
  batchSize: ChapterBatchSize;
  status: BatchProgressStatus;
  chaptersGenerated: number;
  totalChapters: number;
  submittedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ==================== SEAM CONTRACTS ====================

export interface StoryGenerationSeam {
  seamName: 'Story Blueprint → Multi-Chapter Genesis';
  description: 'Transforms a high-level blueprint into 1-3 cohesive chapters and an initialized story state.';

  input: StoryBlueprint & {
    chapterBatchSize: ChapterBatchSize;
    allowExperimentalVoices?: boolean;
    narrativeDirectives?: string;
  };

  output: StoryIterationPayload;

  errors: {
    INVALID_BLUEPRINT: {
      code: 'INVALID_BLUEPRINT';
      message: string;
      invalidFields: (keyof StoryBlueprint)[];
    };
    GENERATION_FAILED: {
      code: 'GENERATION_FAILED';
      message: string;
      retryable: boolean;
    };
    CONTENT_POLICY_VIOLATION: {
      code: 'CONTENT_POLICY_VIOLATION';
      message: string;
      offendingFragments: string[];
    };
  };
}

export interface StoryContinuationSeam {
  seamName: 'Story State → Continuation Batch';
  description: 'Extends an existing story by 1-3 chapters while updating the persistent state snapshot.';

  input: {
    storyId: string;
    chapterBatchSize: ChapterBatchSize;
    storyState: StoryStateSnapshot;
    previouslyGeneratedChapters: GeneratedChapter[];
    continuationBrief?: string;
    forceCliffhanger?: boolean;
    existingSummary?: StorySummary;
    heatContract?: HeatContract;
  };

  output: StoryIterationPayload & {
    appendedChapterNumbers: number[];
  };

  errors: {
    STORY_NOT_FOUND: {
      code: 'STORY_NOT_FOUND';
      message: string;
      storyId: string;
    };
    STATE_DIVERGENCE: {
      code: 'STATE_DIVERGENCE';
      message: string;
      expectedRevision: number;
      actualRevision: number;
    };
    MAX_CHAPTER_LIMIT: {
      code: 'MAX_CHAPTER_LIMIT';
      message: string;
      maxChapters: number;
      attemptedChapterNumber: number;
    };
  };
}

export interface StoryPersistenceSeam {
  seamName: 'Story Snapshot ↔ Persistence Layer';
  description: 'Defines how story state and chapter metadata are stored in a Vercel-compatible persistence layer.';

  input: {
    story: StorySummary;
    state: StoryStateSnapshot;
    chapters: GeneratedChapter[];
  };

  output: {
    success: true;
    persistedRevision: number;
  } | {
    success: false;
    reason: 'VALIDATION_ERROR' | 'CONNECTION_ERROR' | 'CONFLICT';
    message: string;
  };
}

export interface StreamingProgressChunk {
  type: 'connected' | 'chapter_progress' | 'batch_complete' | 'error';
  storyId?: string;
  chapterNumber?: number;
  partialHtml?: string;
  percentage?: number;
  estimatedMsRemaining?: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> = {
  success: true;
  data: T;
  error?: never;
} | {
  success: false;
  data?: never;
  error: ApiErrorPayload;
};

export type ApiEnvelope<T> = ApiResponse<T>;

export type StoryLabJobKind = 'genesis' | 'continuation' | 'export' | 'audio';

export type StoryLabJobStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface StoryLabJobError {
  code: string;
  message: string;
  details?: unknown;
}

export interface StoryLabJob<TPublicResult = unknown> {
  jobId: string;
  kind: StoryLabJobKind;
  status: StoryLabJobStatus;
  currentStep: string;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  result?: TPublicResult;
  error?: StoryLabJobError;
}

export interface StoryLabJobPaths {
  statusPath: string;
  eventsPath: string;
}

export type StoryLabJobDurability =
  | {
      mode: 'non_durable_memory';
      durable: false;
      warning: string;
    }
  | {
      mode: 'postgres';
      durable: true;
      warning?: string;
    };

export interface StoryLabJobEvent<TPublicResult = unknown> {
  eventId: string;
  type: 'snapshot';
  emittedAt: string;
  job: StoryLabJob<TPublicResult>;
}

export type StoryLabJobCreationRequest =
  | {
      kind: 'genesis';
      blueprint: StoryGenerationSeam['input'];
      idempotencyKey?: string;
      projectId?: string;
      storyId?: string;
    }
  | {
      kind: 'continuation';
      continuation: StoryContinuationSeam['input'];
      idempotencyKey?: string;
      projectId?: string;
      storyId?: string;
    }
  | {
      kind: 'export' | 'audio';
      projectId?: string;
      storyId?: string;
      idempotencyKey?: string;
    };

export interface StoryLabJobCreationResponse<TPublicResult = unknown> {
  job: StoryLabJob<TPublicResult>;
  paths: StoryLabJobPaths;
  durability: StoryLabJobDurability;
}

export type StoryQualityDimensionId =
  | 'continuity'
  | 'cliffhanger_quality'
  | 'trope_freshness'
  | 'emotional_variety'
  | 'character_consistency'
  | 'prose_quality'
  | 'audio_readiness';

export interface StoryQualityDimensionScore {
  id: StoryQualityDimensionId;
  label: string;
  score: number;
  rationale: string;
  signals: string[];
}

export interface StoryQualityHeuristicReport {
  source: 'heuristic';
  heuristicOnly: true;
  overallScore: number;
  dimensions: StoryQualityDimensionScore[];
  summary: string;
}

export interface EvaluationCriteria {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overallFeedback: string;
  heuristicReport?: StoryQualityHeuristicReport;
}

export interface EvaluationRequest {
  storyContent: string;
  configuration: {
    creature: CreatureArchetype | string;
    themes: string[];
    spicyLevel: SpicyLevel | number;
    wordCount: WordBudget | number;
  };
}

// ==================== FRONTEND VIEW MODELS ====================

export interface StoryWorkbenchSession {
  story: StorySummary | null;
  state: StoryStateSnapshot | null;
  chapterHistory: GeneratedChapter[];
  activeBatchSize: ChapterBatchSize;
  lastTelemetry?: GenerationTelemetry;
  lastContinuityExtraction?: ContinuityExtractionReceipt;
  lastSuggestedPrompts?: string[];
  batchQueue?: BatchProgressState[];
  savedProjectId?: string;
}

export interface ContinuityPanelViewModel {
  characters: CharacterProfile[];
  activeThreads: PlotThread[];
  unresolvedArtifacts: LoreArtifact[];
  continuityWarnings: string[];
}

export interface ChapterTimelineEntry {
  chapterId: string;
  chapterNumber: number;
  title: string;
  summary: string;
  hasCliffhanger: boolean;
  createdAt: string;
}

// ==================== ERROR LOGGING CONTRACTS ====================

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorLog {
  id: string;
  timestamp: Date;
  message: string;
  context: string;
  severity: ErrorSeverity;
  stack?: string;
  details?: unknown;
}

export interface ErrorLoggingSeam {
  seamName: 'Client Error Logging';
  input: never;
  output: {
    errorId: string;
    logged: boolean;
    timestamp: Date;
    severity: ErrorSeverity;
  };
}
