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
  CharacterArchetype,
  PlotThreadStatus,
  RelationshipKind,
  StoryMemoryLifetime
} from '../../../shared/storyStateVocabulary';
import type {
  HeatIntimacyBoundary,
  HeatTensionMode,
  NarrativeTone,
  SpicyLevel
} from '../../../api/_lib/types/contracts';
import type { ChapterBatchSize } from '../../../shared/chapterBatchVocabulary';
import type { XaiReasoningEffort } from '../../../shared/reasoningEffortVocabulary';

// `CreatureArchetype` and its table come from `shared/creatureVocabulary`,
// which sits below both trees: the union used to be written out here and again
// as `CreatureType` in the API's contract, with the table below them and four
// more copies in the readers that validate, log, and name a creature. See that
// module for what each copy broke on its own.
export type { CreatureArchetype };
export { CREATURE_ARCHETYPES } from '../../../shared/creatureVocabulary';

// The four vocabularies a continuity state is written in — a character's
// archetype, a thread's status, a thread or artifact's lifetime, and a
// relationship edge's kind — come from `shared/storyStateVocabulary` for the
// same reason. They were the last closed sets in this file declared as inline
// unions on the interfaces, with no runtime list anywhere; every reader that
// had to check one of them wrote the list out again, and the continuity
// extractor alone held four such copies. See that module for what each drop
// costs.
export type {
  CharacterArchetype,
  PlotThreadStatus,
  RelationshipKind,
  StoryMemoryLifetime
};
export {
  CHARACTER_ARCHETYPES,
  PLOT_THREAD_STATUSES,
  RELATIONSHIP_KINDS,
  STORY_MEMORY_LIFETIMES
} from '../../../shared/storyStateVocabulary';

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
// `ChapterBatchSize` and its table come from `shared/chapterBatchVocabulary`,
// which sits below both trees. The union used to be written out here, and the
// same bound six more times inside the classic seam the Story Lab hands this
// field to — `storyLabEngine` passes `chapterBatchSize` straight into
// `requestedChapterCount`, so they are one value. See that module for what each
// copy cost.
export type { ChapterBatchSize };
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

// `AudioFormat` and `AudioConversionSeam` for the same reason: the narration
// pipeline runs entirely in `api/_lib`, so this is the one definition rather
// than a second copy that could drift the way `ExportFormat` and
// `ImageGenerationSeam` above already had.
export type { AudioFormat, AudioConversionSeam } from '../../../api/_lib/types/contracts';
export { AUDIO_FORMATS } from '../../../api/_lib/types/contracts';

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
// Spice level's table has moved to `shared/spiceLevelVocabulary` and is
// re-exported here, where the picker and `FormValidationService` already read
// it. It was declared in this tree and read all over it, and the classic seam
// the Story Lab hands its blueprint to — the one place a request is actually
// refused — could not see it: `VALIDATION_RULES.spicyLevel` restated the scale
// as `{ min: 1, max: 5 }`. See that module for what each direction of drift
// costs.
export { SPICY_LEVELS } from '../../../shared/spiceLevelVocabulary';

export const WORD_BUDGETS = [600, 900, 1200, 1500] as const satisfies readonly WordBudget[];

/**
 * Batch size, and the three readings of it, from the module below both trees.
 *
 * The table was declared here and the checkers beside it, which was enough for
 * everything on the Story Lab side — the picker, the parser, and both
 * continuation routes read it — and reached nothing on the classic side, where
 * the same bound was written out six more times inside the seam the Story Lab
 * hands its blueprint to. `shared/chapterBatchVocabulary` is what lets
 * `api/_lib/types/contracts` read this list too; see it for what each of those
 * copies broke on its own.
 */
export {
  CHAPTER_BATCH_SIZES,
  clampToChapterBatchSize,
  formatChapterBatchSizeList,
  isChapterBatchSize
} from '../../../shared/chapterBatchVocabulary';

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
  relationship: RelationshipKind;
  notes: string;
}

export interface CharacterProfile {
  id: string;
  displayName: string;
  archetype: CharacterArchetype;
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
  status: PlotThreadStatus;
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
  // The same union `ApiResponseMetadata.reasoningEffort` carries, from the
  // shared table rather than a fourth spelling of it. `app.ts` prints this
  // field in the telemetry panel, so a value the API can send and this
  // declaration does not name is one a reader sees under a type that says it
  // cannot exist.
  reasoningEffort?: XaiReasoningEffort;
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
  /**
   * Generated chapter illustrations, keyed by `GeneratedChapter.chapterId`.
   *
   * Without this field a save/load round trip silently dropped every
   * illustration a reader had generated: `buildSavedProjectFromSession` never
   * wrote them and `hydrateProjectState` never read them, so an image
   * survived only until the next reload, cloud sync, or chapter switch.
   */
  chapterImages?: Record<string, BackendImageGenerationSeam['output']>;
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

/**
 * What the frontend is allowed to assume about signing in, from the one place
 * that actually knows: the deployment's own environment.
 *
 * `provider: 'clerk'` is a promise the backend can keep, not just a provider
 * name — the route behind this only reports it when `CLERK_SECRET_KEY` is
 * set as well as the publishable key, so a half-configured deployment (a
 * publishable key with no secret key, or vice versa) reads as `'none'`
 * rather than showing a sign-in button that is guaranteed to fail the moment
 * it is used.
 */
export interface StoryLabAuthConfig {
  provider: 'clerk' | 'none';
  publishableKey?: string;
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

// The envelope every route in this repository answers with, re-exported from
// the backend's own contract rather than redeclared here — the arrangement
// `ExportFormat` and `ImageGenerationSeam` above already have.
//
// The two declarations had drifted in the way that matters most for an
// envelope: the API's carries `metadata`, and this one did not. Every classic
// route attaches one — `requestId`, `processingTime`, the model that answered,
// `rateLimitRemaining`, and `partialFailures`, the only place a chapter that
// failed inside a successful batch is reported — and the Story Lab engine reads
// `result.metadata?.partialFailures` off it. None of that was reachable from
// the Angular tree: a client that wanted to log the server's own `requestId`
// beside a failed export, or to tell the reader which chapters of a batch did
// not arrive, was reading a field its type said did not exist. The two
// interfaces were also not assignable to each other, so nothing would have
// reported the drift.
export type { ApiErrorPayload, ApiResponseMetadata } from '../../../api/_lib/types/contracts';
import type { ApiResponse as BackendApiResponse, ImageGenerationSeam as BackendImageGenerationSeam } from '../../../api/_lib/types/contracts';

export type ApiResponse<T> = BackendApiResponse<T>;
export type ApiEnvelope<T> = ApiResponse<T>;

export type StoryLabJobKind = 'genesis' | 'continuation' | 'export' | 'audio';

/**
 * The two job kinds this scaffold actually runs, and the two it defers.
 *
 * `StoryLabJobKind` has four members and the job routes serve two of them:
 * `POST /api/story-lab/jobs` answers `export` and `audio` with
 * `UNSUPPORTED_JOB_KIND` and reserves them for the durable runner. That split
 * is the real vocabulary, and until now it had no name — so the pair was
 * written out by hand everywhere it was needed, three times in two trees:
 *
 * - `runJobWork` in `jobRouteHandlers.ts` took `kind: 'genesis' | 'continuation'`;
 * - the route's refusal branch matched `'export'` and `'audio'` as two literals;
 * - `AppComponent` declared its *own* `type StoryLabJobKind = 'genesis' |
 *   'continuation'` — the same name as this one, three hundred lines below the
 *   import block, shadowing the contract's four-member union for the whole
 *   file. Nothing reports that: a narrower union is assignable to a wider one,
 *   so `JobStatusPanelState.kind` looked like the contract's type and was not,
 *   and `updateJobStatusFromJob` quietly coerces any non-`continuation` job to
 *   `genesis` to satisfy it — which is why an `export` job snapshot would have
 *   been announced to the reader as "Story generation".
 *
 * Splitting the union in two named halves is what makes a fifth kind a decision
 * rather than an omission: it has to be added to one of these tables, and
 * `story-lab-job-contracts` fails if it is in neither.
 */
export const STORY_LAB_GENERATION_JOB_KINDS = [
  'genesis',
  'continuation'
] as const satisfies readonly StoryLabJobKind[];

/** The kinds the non-durable scaffold refuses, reserved for the durable runner. */
export const STORY_LAB_DEFERRED_JOB_KINDS = [
  'export',
  'audio'
] as const satisfies readonly StoryLabJobKind[];

/** A job kind the Story Lab job routes run rather than defer. */
export type StoryLabGenerationJobKind = typeof STORY_LAB_GENERATION_JOB_KINDS[number];

/**
 * A job kind these routes defer to the durable runner.
 *
 * The half of the split that had no name. `StoryLabJobCreationRequest`'s third
 * variant went on spelling `kind: 'export' | 'audio'` by hand — the fifth
 * spelling of a pair the table above had already been written to end, and the
 * last one left after the previous slice took the other four.
 */
export type StoryLabDeferredJobKind = typeof STORY_LAB_DEFERRED_JOB_KINDS[number];

/** Whether `kind` is one the durable runner owns rather than these routes. */
export function isDeferredStoryLabJobKind(kind: StoryLabJobKind): boolean {
  return (STORY_LAB_DEFERRED_JOB_KINDS as readonly StoryLabJobKind[]).includes(kind);
}

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
 * Two places decided this independently, each with its own copy of the same
 * three names beside a union that has six:
 *
 * - `AppComponent.handleJobSnapshot` reported "still running" for anything its
 *   three `if` branches did not name, which is what keeps the progress timer
 *   turning and the reader waiting;
 * - `postgresStoryLabJobStore`'s `UPDATE_JOB_SQL` stamped `completed_at` when
 *   `$3 in ('completed', 'failed', 'cancelled')`.
 *
 * They agree today. What they cannot do is disagree usefully: a status added to
 * the union — `waiting_for_review` is already there, and it is the only one of
 * the six that arrived after the other five — has two unrelated files to be
 * remembered in, in two languages, and being forgotten in either of them fails
 * quietly. Forgotten in the component, the reader watches a progress bar for a
 * batch that will never arrive; forgotten in the SQL, the row's `completed_at`
 * stays null forever.
 *
 * So this is the list, and both read it. `satisfies` rather than a bare
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

/**
 * The steps a Story Lab job reports itself to be on.
 *
 * `status` is where a job is in its lifecycle and had a union and a table;
 * `currentStep` is what the job is *doing*, and it had neither. It was declared
 * `currentStep: string` on the job, `currentStep?: string` on the store's create
 * input, and `currentStep: string` on its update input — an open type for a set
 * with exactly five members, every one of them a literal written by hand at the
 * five places `jobRouteHandlers` moves a job along, plus `'queued'` twice more
 * as the two stores' default.
 *
 * The reader is where an open type costs. `AppComponent.formatJobStage` is the
 * only one, and it switches on the step to choose the sentence the reader
 * watches — "Grok is writing your first chapter." — with `humanizeIdentifier`
 * beneath as the fallback. That fallback cannot fail loudly, because it is built
 * to make *any* identifier presentable: a sixth step would title-case its own
 * wire name and render, so `extracting_continuity` reaches the reader as
 * "Extracting continuity." and no test, type, or log records that the sentence
 * written for that moment was never written. Both sides said `string`, so
 * TypeScript had nothing to compare.
 *
 * These are the five. `STORY_LAB_JOB_STEP_LABELS` beside them is a total
 * `Record`, so a sixth step is a compile error in the reader that would
 * otherwise have quietly humanized it.
 */
export const STORY_LAB_JOB_STEPS = [
  'queued',
  'generating_story',
  'continuing_story',
  'completed',
  'failed'
] as const;

export type StoryLabJobStep = typeof STORY_LAB_JOB_STEPS[number];

/**
 * What each step is called where a reader can see it.
 *
 * Total by type. `queued` reads as the status line of the same name because a
 * job that is queued is queued whichever field says so, and `formatJobStage`
 * answered both with that sentence before this record existed.
 */
export const STORY_LAB_JOB_STEP_LABELS: Record<StoryLabJobStep, string> = {
  queued: 'Story job queued.',
  generating_story: 'Grok is writing your first chapter.',
  continuing_story: 'Grok is continuing the saga.',
  completed: 'Binding the pages.',
  failed: 'Generation failed.'
};

/**
 * Whether `value` is a step this app writes.
 *
 * Needed because `currentStep` also arrives from outside this app's writers —
 * off the wire at the client, and out of `current_step` at the Postgres store,
 * where a row written by an older deployment may name a step this build has
 * never heard of. Those readers keep a fallback; what they no longer do is use
 * it for the app's own steps.
 */
export function isStoryLabJobStep(value: unknown): value is StoryLabJobStep {
  return typeof value === 'string' && (STORY_LAB_JOB_STEPS as readonly string[]).includes(value);
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
  /**
   * The step the job last reported, as `STORY_LAB_JOB_STEPS` names them.
   *
   * Deliberately still `string` and not `StoryLabJobStep`: this is a snapshot
   * off the wire, and a durable job row written by an older deployment can name
   * a step this build has retired. Narrowing it here would be a promise the
   * network cannot keep. What the table does guarantee is the other direction —
   * `UpdateStoryLabJobInput.currentStep` is a `StoryLabJobStep`, so nothing in
   * this repository can *write* a step the reader has not been taught, and
   * `isStoryLabJobStep` is how a reader tells a step it knows from one it does
   * not. Same arrangement as `BatchProgressState['status'] | string` at
   * `formatBatchStatus`.
   */
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
      kind: StoryLabDeferredJobKind;
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

/**
 * The four severities, ordered loudest first — the order the debug panel's
 * count row reads in.
 *
 * This was the last closed vocabulary in this file with no runtime list, and
 * the debug panel wrote it out twice more: `getErrorCounts` returned an object
 * literal with one hand-written key per severity, and the template rendered one
 * hand-written `<span *ngIf>` per severity beside it, each carrying an emoji
 * that `getSeverityIcon`'s `switch` in the same component already decided. So
 * the icon for a severity was declared in two files, and the day they disagree
 * the same error is one glyph in the list and another in the count beside it.
 *
 * A fifth severity failed worse and more quietly: `ErrorLoggingService.logError`
 * would accept it, `getSeverityIcon` would fall through its `switch` to the
 * `default` — a `📝` that exists only to satisfy a `switch` that is already
 * total — and the counts row, which is the only place the panel says how many
 * of something there are, would not count it at all.
 */
export const ERROR_SEVERITIES = [
  'critical',
  'error',
  'warning',
  'info'
] as const satisfies readonly ErrorSeverity[];

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
