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

import type { CreatureArchetype } from '../../../shared/creatureVocabulary';
import type {
  HeatIntimacyBoundary,
  HeatTensionMode,
  NarrativeTone,
  SpicyLevel
} from '../../../api/_lib/types/contracts';

// `CreatureArchetype` and its table come from `shared/creatureVocabulary`,
// which sits below both trees: the union used to be written out here and again
// as `CreatureType` in the API's contract, with the table below them and four
// more copies in the readers that validate, log, and name a creature. See that
// module for what each copy broke on its own.
export type { CreatureArchetype };
export { CREATURE_ARCHETYPES } from '../../../shared/creatureVocabulary';

// These four were declared here *and*, character for character, in the API's
// contract — which is the one that describes the wire: `StoryGenerationContext`
// and `HeatContractIntent` there are what a generation request actually
// carries, and `tensionMode` and `intimacyBoundary` are fields of the second.
// Two identical unions are structurally assignable to each other, so nothing
// would have reported the drift; the first value added to one of them and not
// the other would simply have been refused at the route, after the form let the
// reader choose it. Re-exported for the same reason `ExportFormat` and
// `ImageStyle` below already are, with the runtime tables that go with them
// kept here, where the picker and `FormValidationService` read them.
export type { HeatIntimacyBoundary, HeatTensionMode, NarrativeTone, SpicyLevel };
export type ChapterBatchSize = 1 | 2 | 3;
export type WordBudget = 600 | 900 | 1200 | 1500;
// `ExportFormat` and `SaveExportSeam` are re-exported from the backend's own
// contract rather than redeclared here: the export pipeline runs entirely in
// `api/_lib`, so its seam has exactly one definition instead of two that could
// drift the way the classic `/api/story/*` routes already had (see
// `expressApiRoutes.ts`).
export type { ExportFormat, SaveExportSeam } from '../../../api/_lib/types/contracts';
// The runtime list travels with the type, for the same reason: the export
// picker used to restate it and dropped `html`, the one format the route
// renders that no reader could then choose.
export { EXPORT_FORMATS } from '../../../api/_lib/types/contracts';

// `ImageStyle`, `IMAGE_STYLES`, and `ImageGenerationSeam` for the same reason,
// after the second declarations of the first and the last had already drifted
// from these: the image pipeline runs entirely in `api/_lib` too. See
// `IMAGE_STYLES` and `ImageGenerationSeam` there for what the copies cost.
export type { ImageStyle, ImageGenerationSeam } from '../../../api/_lib/types/contracts';
export { IMAGE_STYLES } from '../../../api/_lib/types/contracts';

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

/**
 * The three numeric blueprint vocabularies, which had no runtime list at all.
 *
 * The four tables above each exist because a type is not something a route can
 * check a request against: `parseStoryLabBlueprint` has to compare the value it
 * was sent to a list of the values it accepts, and `FormValidationService` has
 * to compare the same value to the same list before the reader presses
 * generate. Those two lists have to be the one list, or the form accepts what
 * the route refuses and the refusal arrives after the request, naming a field
 * by its wire name, on a form that never said there was a limit — which is the
 * failure `maxCharacterNameLength` in the shared blueprint limits was added to
 * end for the free-text fields.
 *
 * Spicy level, word budget, and batch size were the three vocabularies with no
 * table to read, so both sides wrote their own out — twice each, in a parser
 * and in a form, with the word budgets restated a third time in the parser's
 * error message and a fourth in the template's `<option>` values. These are the
 * list; everything that checks one of these fields reads it.
 */
export const SPICY_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly SpicyLevel[];

export const WORD_BUDGETS = [600, 900, 1200, 1500] as const satisfies readonly WordBudget[];

export const CHAPTER_BATCH_SIZES = [1, 2, 3] as const satisfies readonly ChapterBatchSize[];

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

export type StoryMemoryLifetime = 'scene' | 'chapter' | 'series';

export interface PlotThread {
  id: string;
  label: string;
  status: 'active' | 'escalating' | 'resolved' | 'dormant';
  description: string;
  foreshadowedDevices: string[];
  lifetime?: StoryMemoryLifetime;
}

export interface LoreArtifact {
  id: string;
  name: string;
  significance: string;
  introducedInChapter?: number;
  resolvedInChapter?: number;
  lifetime?: StoryMemoryLifetime;
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
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
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

export interface StoryMemoryCard {
  id: string;
  label: string;
  title: string;
  detail: string;
  triggerLabel: string;
  acceptedAt: string;
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
  pinnedMemoryCardDraftIds?: string[];
  acceptedMemoryCards?: StoryMemoryCard[];
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
  acceptedMemoryCardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudStoryProjectList {
  ownerUserId: string;
  storageMode: CloudStoryProjectStorageMode;
  /**
   * At most `STORY_LAB_LIBRARY_MAX_ITEMS` of them, taken from the front of the
   * order the owner's `librarySort` puts their library in.
   */
  projects: CloudStoryProjectListItem[];
  /**
   * How many projects the owner has, which is not always how many `projects`
   * carries.
   *
   * The listing is capped, and a capped listing that reports only what it
   * carries is indistinguishable from a complete one: a reader with fifty-one
   * projects was shown fifty and told nothing, so "the story I saved yesterday
   * is gone" and "the story I saved yesterday is on page two" looked the same
   * from the response. This is the number that separates them.
   */
  totalProjectCount: number;
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

/**
 * The statuses a job does not leave.
 *
 * Three places decided this independently, each with its own copy of the same
 * three names beside a union that has six:
 *
 * - `StoryService.streamStoryLabJobEvents` closed the `EventSource` and
 *   completed the observable on `['completed', 'failed', 'cancelled']`;
 * - `AppComponent.handleJobSnapshot` reported "still running" for anything its
 *   three `if` branches did not name, which is what keeps the progress timer
 *   turning and the reader waiting;
 * - `postgresStoryLabJobStore`'s `UPDATE_JOB_SQL` stamped `completed_at` when
 *   `$3 in ('completed', 'failed', 'cancelled')`.
 *
 * They agree today. What they cannot do is disagree usefully: a status added to
 * the union — `waiting_for_review` is already there, and it is the only one of
 * the six that arrived after the other five — has three unrelated files to be
 * remembered in, in two languages, and being forgotten in any one of them fails
 * quietly. Forgotten in the stream, the browser holds a connection open for a
 * job that is over; forgotten in the component, the reader watches a progress
 * bar for a batch that will never arrive; forgotten in the SQL, the row's
 * `completed_at` stays null forever.
 *
 * So this is the list, and all three read it. `satisfies` rather than a bare
 * `as const` so an entry that is not a status does not compile.
 */
export const STORY_LAB_TERMINAL_JOB_STATUSES = [
  'completed',
  'failed',
  'cancelled'
] as const satisfies readonly StoryLabJobStatus[];

/** Whether a job in `status` is finished, however it finished. */
export function isTerminalStoryLabJobStatus(status: StoryLabJobStatus): boolean {
  return (STORY_LAB_TERMINAL_JOB_STATUSES as readonly StoryLabJobStatus[]).includes(status);
}

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
  /**
   * Set when this evaluation never reached the server — the evaluate call
   * failed or errored, and `PromptEvaluationService` fell back to its fixed
   * placeholder scoring. Distinguishes that placeholder from both a real AI
   * score and the server's own honest `heuristicReport` fallback, so the UI
   * never shows a fabricated score as if it were real feedback.
   */
  isMockEvaluation?: boolean;
  /**
   * Why the placeholder was used, in the route's own words, when the route gave
   * a reason.
   *
   * `isMockEvaluation` says the score is not real; on its own it does not say
   * whether the reader can do anything about that. `/api/story-lab/evaluate`
   * refuses an oversized `storyContent` with the field named, an unauthenticated
   * caller with `401`, and one past its budget with `429` — all actionable, all
   * previously rendered as "the evaluation API was unavailable".
   *
   * Absent when there was nothing to quote: a network failure that never reached
   * the API, or a keyless deployment answering `success: true` with the server's
   * own honest placeholder, which sets `isMockEvaluation` and has no refusal
   * behind it.
   */
  mockEvaluationReason?: string;
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

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  category: 'production' | 'experimental' | 'custom';
}

export interface ProvingGroundsTestConfiguration {
  creature: CreatureArchetype;
  themes: ThemeSeed[];
  spicyLevel: SpicyLevel;
  wordCount: WordBudget;
  userInput: string;
  promptTemplate: PromptTemplate;
  promptPreview: {
    system: string;
    user: string;
  };
}

export interface ProvingGroundsTestResult {
  id: string;
  timestamp: Date;
  configuration: ProvingGroundsTestConfiguration;
  generatedStory: string;
  generationTime: number;
  chapterCount: number;
  totalWordCount: number;
  aiEvaluation?: EvaluationCriteria;
}

export type StoredProvingGroundsTestResult = Omit<ProvingGroundsTestResult, 'timestamp'> & {
  timestamp: string;
};

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
