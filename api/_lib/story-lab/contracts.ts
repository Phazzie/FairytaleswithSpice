// Created: 2025-10-29 08:27 UTC

export type {
  CreatureArchetype,
  NarrativeTone,
  SpicyLevel,
  ChapterBatchSize,
  WordBudget,
  ThemeSeed,
  StoryBlueprint,
  RelationshipEdge,
  CharacterProfile,
  PlotThread,
  LoreArtifact,
  StoryBeat,
  StoryStateSnapshot,
  StorySummary,
  ChapterDelta,
  GeneratedChapter,
  ChapterBatchEnvelope,
  StoryStateDelta,
  StoryPersistenceReceipt,
  GenerationTelemetry,
  StoryIterationPayload,
  StoryGenerationSeam,
  StoryContinuationSeam,
  StoryPersistenceSeam,
  StreamingProgressChunk,
  EvaluationCriteria,
  EvaluationRequest,
  StoryWorkbenchSession,
  ContinuityPanelViewModel,
  ChapterTimelineEntry,
  ErrorSeverity,
  ErrorLog,
  ErrorLoggingSeam
} from '../../../story-generator/src/app/contracts';

export type ApiResponse<T> = import('../../../story-generator/src/app/contracts').ApiResponse<T>;
export type ApiEnvelope<T> = ApiResponse<T>;
