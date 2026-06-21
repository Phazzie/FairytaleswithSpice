// Created: 2026-05-28 02:39 UTC

import type {
  ApiResponse,
  CharacterProfile,
  ChapterDelta,
  GenerationTelemetry,
  GeneratedChapter,
  LoreArtifact,
  PlotThread,
  StoryContinuationSeam as LabContinuationSeam,
  StoryGenerationSeam as LabGenerationSeam,
  StoryIterationPayload,
  StoryStateDelta,
  StoryStateSnapshot,
  StorySummary
} from './contracts';
import type {
  Chapter as ClassicChapter,
  ChapterContinuationSeam as ClassicContinuationSeam,
  ChapterFailure,
  ApiResponseMetadata,
  StoryGenerationSeam as ClassicGenerationSeam,
  ThemeType
} from '../types/contracts';
import { StoryService } from '../services/storyService';
import { buildContinuationResponse, buildGenesisResponse } from './mockData';
import { getTransientStorySnapshot, persistStoryIteration } from './stateStore';
import { extractContinuity } from './continuityExtractor';
import { getXaiReasoningEffort, getXaiStoryModel } from '../config/xaiConfig';

type ClassicStoryOutput = ClassicGenerationSeam['output'];
type ClassicContinuationOutput = ClassicContinuationSeam['output'];
type StoryServiceLike = Pick<StoryService, 'generateStory' | 'continueChapter'>;
type StoryLabErrorResponse = Extract<ApiResponse<never>, { success: false }>;

interface StoryLabEngineOptions {
  serviceFactory?: () => StoryServiceLike;
}

export interface StoryLabContinuationGuidancePreview {
  originalBrief: string;
  providerBrief: string;
  hiddenGuidance: string;
  anchorHeadings: string[];
  contextSourceMap: StoryLabContinuationSourceMapEntry[];
  characterCount: number;
}

type StoryLabContinuationSourceKind = 'thread' | 'relationship' | 'artifact' | 'warning';

export interface StoryLabContinuationSourceMapEntry {
  kind: StoryLabContinuationSourceKind;
  label: string;
  anchorLabel: string;
  reason: string;
  activationScore: number;
}

const MOCK_FLAG_VALUES = new Set(['1', 'true', 'yes']);
const CONTINUITY_COURTROOM_MAX_THREADS = 3;
const CONTINUITY_COURTROOM_MAX_ARTIFACTS = 2;
const CONTINUITY_COURTROOM_MAX_WARNINGS = 2;
const CONTINUITY_COURTROOM_MAX_DETAIL_LENGTH = 180;
const WORLD_ARTIFACT_MAX_NAME_WORDS = 4;
type ChapterEndingPressureId = 'emotional_reveal' | 'danger_escalation' | 'secret_exposed';
type ScenePressureLabel = 'Emotional' | 'Secret' | 'Deadline' | 'Social' | 'Setting';
interface ChapterEndingPressure {
  id: ChapterEndingPressureId;
  label: string;
  candidateLabel: string;
  instruction: string;
}
const CHAPTER_ENDING_PRESSURES: readonly ChapterEndingPressure[] = [
  {
    id: 'emotional_reveal',
    label: 'Emotional reveal',
    candidateLabel: 'emotional reveal',
    instruction: 'end on a private truth the characters cannot comfortably take back.'
  },
  {
    id: 'danger_escalation',
    label: 'Danger escalation',
    candidateLabel: 'danger escalation',
    instruction: 'end with the outside threat entering the scene in a way that forces motion.'
  },
  {
    id: 'secret_exposed',
    label: 'Secret exposed',
    candidateLabel: 'secret exposed',
    instruction: 'expose a secret that changes the next chapter.'
  }
];
const SCENE_PRESSURE_VARIANTS: Record<ScenePressureLabel, readonly string[]> = {
  Emotional: ['private truth costs status', 'want changes the bargain', 'affection becomes leverage'],
  Secret: ['truth changes leverage', 'hidden motive costs safety', 'named lie changes power'],
  Deadline: ['clock forces choice', 'delay costs safety', 'time makes refusal visible'],
  Social: ['witnesses make retreat costly', 'status turns into pressure', 'audience changes the bargain'],
  Setting: ['place enforces cost', 'room becomes leverage', 'world rule tightens']
};
const CLASSIC_THEME_TYPES: readonly ThemeType[] = [
  'betrayal',
  'obsession',
  'power_dynamics',
  'forbidden_love',
  'revenge',
  'manipulation',
  'seduction',
  'dark_secrets',
  'corruption',
  'dominance',
  'submission',
  'jealousy',
  'temptation',
  'sin',
  'desire',
  'passion',
  'lust',
  'deceit'
];
const CLASSIC_THEME_SET = new Set<string>(CLASSIC_THEME_TYPES);
const DEFAULT_CLASSIC_THEME: ThemeType = 'forbidden_love';

export function shouldUseMockStoryLab(): boolean {
  const forceMock = process.env['STORY_LAB_FORCE_MOCK'] ?? '';
  return !isProductionRuntime() && (MOCK_FLAG_VALUES.has(forceMock.toLowerCase()) || !process.env['XAI_API_KEY']);
}

export function previewStoryLabContinuationGuidance(input: {
  continuationBrief?: string;
  storyState: StoryStateSnapshot;
}): StoryLabContinuationGuidancePreview {
  const originalBrief = input.continuationBrief?.trim() ?? '';
  const providerBrief = withContinuationStrategyBrief(input.continuationBrief, input.storyState) ?? originalBrief;
  const hiddenGuidance = extractHiddenContinuationGuidance(providerBrief, originalBrief);
  return {
    originalBrief,
    providerBrief,
    hiddenGuidance,
    anchorHeadings: extractAnchorHeadings(hiddenGuidance),
    contextSourceMap: buildContinuationContextSourceMap(input.storyState, originalBrief),
    characterCount: providerBrief.length
  };
}

function isProductionRuntime(): boolean {
  return process.env['NODE_ENV'] === 'production' || process.env['VERCEL_ENV'] === 'production';
}

function shouldFailClosedForMissingProvider(): boolean {
  return isProductionRuntime() && !process.env['XAI_API_KEY'];
}

function missingProviderResponse(): StoryLabErrorResponse {
  return {
    success: false,
    error: {
      code: 'AI_UNAVAILABLE',
      message: 'The AI story engine is not configured for this deployment. Set XAI_API_KEY before generating stories.'
    }
  };
}

function validateHeatContract(input: LabGenerationSeam['input']): StoryLabErrorResponse | null {
  if (!input.heatContract || input.heatContract.adultOnlyConfirmed !== true) {
    return {
      success: false,
      error: {
        code: 'CONTENT_POLICY_VIOLATION',
        message: 'Story Lab requires adult-reader and consensual-fantasy confirmation before generating this Heat Contract.'
      }
    };
  }

  return null;
}

function toClassicThemes(themeIds: string[]): ThemeType[] {
  const classicThemes = themeIds
    .map(themeId => themeId.split('-').join('_'))
    .filter(isThemeType)
    .slice(0, 5);

  return classicThemes.length ? classicThemes : [DEFAULT_CLASSIC_THEME];
}

function isThemeType(themeId: string): themeId is ThemeType {
  return CLASSIC_THEME_SET.has(themeId);
}

export function toClassicGenerationInput(input: LabGenerationSeam['input']): ClassicGenerationSeam['input'] {
  return {
    creature: input.creature,
    themes: toClassicThemes(input.themes.map(theme => theme.id)),
    userInput: input.logline,
    spicyLevel: input.spicyLevel,
    wordCount: input.desiredWordBudget,
    requestedChapterCount: input.chapterBatchSize,
    generationContext: {
      source: 'story_lab',
      logline: input.logline,
      tone: input.tone,
      protagonistName: input.protagonistName,
      antagonistName: input.antagonistName,
      worldDetails: input.worldDetails,
      narrativeDirectives: input.narrativeDirectives,
      heatContract: input.heatContract,
      themeSeeds: input.themes
    }
  };
}

export async function generateStoryLabGenesis(
  input: LabGenerationSeam['input'],
  options: StoryLabEngineOptions = {}
): Promise<ApiResponse<StoryIterationPayload>> {
  const heatContractError = validateHeatContract(input);
  if (heatContractError) {
    return heatContractError;
  }

  if (shouldFailClosedForMissingProvider()) {
    return missingProviderResponse();
  }

  if (shouldUseMockStoryLab()) {
    return withMockTelemetry(buildGenesisResponse(input));
  }

  const service = options.serviceFactory?.() ?? new StoryService();
  const result = await service.generateStory(toClassicGenerationInput(input));

  if (!result.success) {
    return {
      success: false,
      error: {
        code: result.error.code ?? 'GENERATION_FAILED',
        message: result.error.message,
        details: result.error.details
      }
    };
  }

  const partialError = getPartialGenerationError(
    input.chapterBatchSize,
    result.metadata?.chaptersGenerated ?? result.data.chapters?.length ?? 1,
    result.metadata?.partialFailures ?? result.data.failedChapters
  );
  if (partialError) {
    return partialError;
  }

  const payload = await enrichContinuity(
    buildStoryLabPayloadFromGeneratedStory(input, result.data, result.metadata),
    input,
    !options.serviceFactory
  );
  payload.persistence = persistStoryIteration(payload);

  return {
    success: true,
    data: payload
  };
}

export async function continueStoryLab(
  input: LabContinuationSeam['input'],
  options: StoryLabEngineOptions = {}
): Promise<ApiResponse<StoryIterationPayload & { appendedChapterNumbers: number[] }>> {
  if (shouldFailClosedForMissingProvider()) {
    return missingProviderResponse();
  }

  const transientSnapshot = getTransientStorySnapshot(input.storyId);
  const previousChapters = input.previouslyGeneratedChapters.length
    ? input.previouslyGeneratedChapters
    : transientSnapshot?.chapters ?? [];
  const storyState = input.storyState ?? transientSnapshot?.state;
  const existingSummary = input.existingSummary ?? transientSnapshot?.summary;

  if (shouldUseMockStoryLab()) {
    return withMockTelemetry(buildContinuationResponse({
      ...input,
      storyState: storyState ?? input.storyState,
      previouslyGeneratedChapters: previousChapters,
      existingSummary
    }));
  }

  if (!storyState || previousChapters.length === 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Real continuation requires story state and previous chapters.'
      }
    };
  }

  const service = options.serviceFactory?.() ?? new StoryService();
  const currentChapterCount = Math.max(...previousChapters.map(chapter => chapter.chapterNumber));
  const existingContent = previousChapters.map(chapter => chapter.rawContent || chapter.htmlContent).join('\n\n');
  const continuationBrief = withContinuationStrategyBrief(input.continuationBrief, storyState);
  const result = await service.continueChapter({
    storyId: input.storyId,
    currentChapterCount,
    existingContent,
    userInput: continuationBrief,
    maintainTone: true,
    tropeMetadata: existingSummary?.tropeMetadata,
    requestedChapterCount: input.chapterBatchSize,
    generationContext: input.heatContract ? {
      source: 'story_lab',
      heatContract: input.heatContract
    } : undefined
  });

  if (!result.success) {
    return {
      success: false,
      error: {
        code: result.error.code ?? 'CONTINUATION_FAILED',
        message: result.error.message,
        details: result.error.details
      }
    };
  }

  const partialError = getPartialGenerationError(
    input.chapterBatchSize,
    result.metadata?.chaptersGenerated ?? result.data.chapters?.length ?? 1,
    result.metadata?.partialFailures ?? result.data.failedChapters
  );
  if (partialError) {
    return partialError;
  }

  const payload = await enrichContinuity(
    buildStoryLabPayloadFromContinuation(input, result.data, storyState, existingSummary, previousChapters, result.metadata),
    undefined,
    !options.serviceFactory
  );
  payload.persistence = persistStoryIteration(payload, previousChapters);

  return {
    success: true,
    data: payload
  };
}

export function buildStoryLabPayloadFromGeneratedStory(
  input: LabGenerationSeam['input'],
  story: ClassicStoryOutput,
  metadata?: ApiResponseMetadata
): StoryIterationPayload {
  const now = new Date().toISOString();
  const chapters = toStoryLabChapters(story.storyId, story.chapters, story.content, story.rawContent, input.chapterBatchSize);
  const summary: StorySummary = {
    storyId: story.storyId,
    title: story.title,
    synopsis: input.logline,
    tone: input.tone,
    spicyLevel: input.spicyLevel,
    createdAt: now,
    updatedAt: now,
    tropeMetadata: story.tropeMetadata
  };
  const state = buildStateSnapshot(input, story.storyId, chapters, null, now);

  return {
    summary,
    batch: {
      chapters,
      totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      suggestedNextPrompts: buildSuggestedPrompts(input, story.nextChapterHint)
    },
    state,
    stateDelta: buildStateDelta(story.storyId, null, state, chapters),
    telemetry: buildGrokTelemetry(metadata, chapters.length)
  };
}

function withContinuationStrategyBrief(continuationBrief: string | undefined, storyState: StoryStateSnapshot): string | undefined {
  const trimmedBrief = continuationBrief?.trim();
  return [
    trimmedBrief,
    buildContinuityCourtroomBrief(storyState, trimmedBrief),
    buildChapterEndingStressTestBrief(storyState, trimmedBrief),
    buildClicheAlarmBrief(storyState, trimmedBrief)
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n') || undefined;
}

function extractHiddenContinuationGuidance(providerBrief: string, originalBrief: string): string {
  if (!originalBrief || !providerBrief.startsWith(originalBrief)) {
    return providerBrief.trim();
  }

  return providerBrief.slice(originalBrief.length).trim();
}

function extractAnchorHeadings(hiddenGuidance: string): string[] {
  return hiddenGuidance
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[A-Za-z][A-Za-z ]+:$/.test(line))
    .map(line => line.slice(0, -1));
}

function buildContinuityCourtroomBrief(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string | undefined {
  const lines: string[] = [];

  for (const thread of selectCourtroomThreads(storyState, continuationBrief)) {
    lines.push(`- ${formatThreadDebtLabel(thread)}: ${compactPromptLine(thread.label)}${formatCourtroomDetail(thread.description)}`);
  }

  const relationshipPressure = selectRelationshipPressure(storyState, continuationBrief);
  if (relationshipPressure) {
    lines.push(formatRelationshipPressureLine(relationshipPressure));
  }

  for (const artifact of selectCourtroomArtifacts(storyState, continuationBrief)) {
    lines.push(`- World clue: ${compactPromptLine(artifact.name)}${formatCourtroomDetail(artifact.significance)}`);
  }

  for (const warning of selectCourtroomWarnings(storyState, continuationBrief)) {
    lines.push(`- Continuity note: ${compactPromptLine(warning)}`);
  }

  if (lines.length === 0) {
    return undefined;
  }

  return [
    'Continuity Courtroom:',
    ...lines
  ].join('\n');
}

function buildContinuationContextSourceMap(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined
): StoryLabContinuationSourceMapEntry[] {
  const entries: StoryLabContinuationSourceMapEntry[] = [];

  for (const item of selectScoredCourtroomThreads(storyState, continuationBrief)) {
    entries.push({
      kind: 'thread',
      label: item.thread.label,
      anchorLabel: formatThreadDebtLabel(item.thread),
      reason: formatActivationReason(item.activationScore, continuationBrief, getThreadActivationCandidates(item.thread)),
      activationScore: item.activationScore
    });
  }

  const relationshipPressure = selectRelationshipPressure(storyState, continuationBrief);
  if (relationshipPressure) {
    entries.push({
      kind: 'relationship',
      label: `${relationshipPressure.sourceCharacter.displayName} and ${relationshipPressure.targetCharacter.displayName}`,
      anchorLabel: 'Relationship pressure',
      reason: formatActivationReason(
        relationshipPressure.activationScore,
        continuationBrief,
        getRelationshipActivationCandidates(
          relationshipPressure.sourceCharacter,
          relationshipPressure.targetCharacter,
          relationshipPressure.relationship
        )
      ),
      activationScore: relationshipPressure.activationScore
    });
  }

  for (const item of selectScoredCourtroomArtifacts(storyState, continuationBrief)) {
    entries.push({
      kind: 'artifact',
      label: item.artifact.name,
      anchorLabel: 'World clue',
      reason: formatActivationReason(item.activationScore, continuationBrief, getArtifactActivationCandidates(item.artifact)),
      activationScore: item.activationScore
    });
  }

  for (const item of selectScoredCourtroomWarnings(storyState, continuationBrief)) {
    entries.push({
      kind: 'warning',
      label: item.warning,
      anchorLabel: 'Continuity note',
      reason: formatActivationReason(item.activationScore, continuationBrief, getWarningActivationCandidates(item.warning)),
      activationScore: item.activationScore
    });
  }

  return entries;
}

function formatActivationReason(
  activationScore: number,
  continuationBrief: string | undefined,
  activationCandidates: string[]
): string {
  if (activationScore <= 0) {
    return 'Included by unresolved-story priority.';
  }

  return hasAcceptedMemoryCardActivation(continuationBrief, activationCandidates)
    ? 'Matched words from accepted memory card text.'
    : 'Matched words from the continuation brief.';
}

function selectCourtroomThreads(storyState: StoryStateSnapshot, continuationBrief: string | undefined): PlotThread[] {
  return selectScoredCourtroomThreads(storyState, continuationBrief).map(item => item.thread);
}

function selectScoredCourtroomThreads(storyState: StoryStateSnapshot, continuationBrief: string | undefined): Array<{
  thread: PlotThread;
  index: number;
  activationScore: number;
}> {
  const source = normalizeActivationText(continuationBrief ?? '');
  return storyState.threads
    .filter(isUnresolvedThread)
    .map((thread, index) => ({
      thread,
      index,
      activationScore: scoreThreadActivation(thread, source)
    }))
    .sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))
    .slice(0, CONTINUITY_COURTROOM_MAX_THREADS);
}

function selectCourtroomArtifacts(storyState: StoryStateSnapshot, continuationBrief: string | undefined): LoreArtifact[] {
  return selectScoredCourtroomArtifacts(storyState, continuationBrief).map(item => item.artifact);
}

function selectScoredCourtroomArtifacts(storyState: StoryStateSnapshot, continuationBrief: string | undefined): Array<{
  artifact: LoreArtifact;
  index: number;
  activationScore: number;
}> {
  const source = normalizeActivationText(continuationBrief ?? '');
  return storyState.artifacts
    .filter(artifact => !artifact.resolvedInChapter)
    .map((artifact, index) => ({
      artifact,
      index,
      activationScore: scoreArtifactActivation(artifact, source)
    }))
    .sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))
    .slice(0, CONTINUITY_COURTROOM_MAX_ARTIFACTS);
}

function scoreThreadActivation(thread: PlotThread, source: string): number {
  return scoreActivationCandidates(getThreadActivationCandidates(thread), source);
}

function getThreadActivationCandidates(thread: PlotThread): string[] {
  return [
    thread.label,
    thread.description,
    ...thread.foreshadowedDevices
  ];
}

function scoreArtifactActivation(artifact: LoreArtifact, source: string): number {
  return scoreActivationCandidates(getArtifactActivationCandidates(artifact), source);
}

function getArtifactActivationCandidates(artifact: LoreArtifact): string[] {
  return [
    artifact.name,
    artifact.significance
  ];
}

function selectCourtroomWarnings(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string[] {
  return selectScoredCourtroomWarnings(storyState, continuationBrief).map(item => item.warning);
}

function selectScoredCourtroomWarnings(storyState: StoryStateSnapshot, continuationBrief: string | undefined): Array<{
  warning: string;
  index: number;
  activationScore: number;
}> {
  const source = normalizeActivationText(continuationBrief ?? '');
  return storyState.continuityWarnings
    .map((warning, index) => ({
      warning,
      index,
      activationScore: scoreWarningActivation(warning, source)
    }))
    .sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))
    .slice(0, CONTINUITY_COURTROOM_MAX_WARNINGS);
}

function scoreWarningActivation(warning: string, source: string): number {
  return scoreActivationCandidates(getWarningActivationCandidates(warning), source);
}

function getWarningActivationCandidates(warning: string): string[] {
  return [warning];
}

function normalizeActivationText(value: string): string {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUnresolvedThread(thread: PlotThread): boolean {
  return thread.status !== 'resolved';
}

function formatThreadDebtLabel(thread: PlotThread): string {
  if (thread.status === 'escalating') {
    return 'Pressure rising';
  }
  if (thread.status === 'dormant') {
    return 'Quiet promise';
  }
  return 'Open promise';
}

interface RelationshipPressureSelection {
  sourceCharacter: CharacterProfile;
  targetCharacter: CharacterProfile;
  relationship: CharacterProfile['relationships'][number];
  index: number;
  activationScore: number;
}

function selectRelationshipPressure(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined
): RelationshipPressureSelection | undefined {
  const source = normalizeActivationText(continuationBrief ?? '');
  const candidates: RelationshipPressureSelection[] = [];

  for (const sourceCharacter of storyState.characters) {
    for (const relationship of sourceCharacter.relationships) {
      const targetCharacter = storyState.characters.find(candidate => candidate.id === relationship.characterId);
      if (targetCharacter) {
        candidates.push({
          sourceCharacter,
          targetCharacter,
          relationship,
          index: candidates.length,
          activationScore: scoreRelationshipActivation(sourceCharacter, targetCharacter, relationship, source)
        });
      }
    }
  }

  return candidates.sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))[0];
}

function formatRelationshipPressureLine(selected: RelationshipPressureSelection): string {
  return `- Relationship pressure: ${compactPromptLine(selected.sourceCharacter.displayName)} and ${compactPromptLine(selected.targetCharacter.displayName)}.`;
}

function scoreRelationshipActivation(
  sourceCharacter: CharacterProfile,
  targetCharacter: CharacterProfile,
  relationship: CharacterProfile['relationships'][number],
  source: string
): number {
  return scoreActivationCandidates(
    getRelationshipActivationCandidates(sourceCharacter, targetCharacter, relationship),
    source
  );
}

function getRelationshipActivationCandidates(
  sourceCharacter: CharacterProfile,
  targetCharacter: CharacterProfile,
  relationship: CharacterProfile['relationships'][number]
): string[] {
  return [
    sourceCharacter.displayName,
    targetCharacter.displayName,
    relationship.relationship,
    relationship.notes
  ];
}

function scoreActivationCandidates(candidates: string[], source: string): number {
  if (!source) {
    return 0;
  }

  const normalizedCandidates = candidates.map(normalizeActivationText).filter(Boolean);
  let score = 0;

  for (const candidate of normalizedCandidates) {
    if (source.includes(candidate)) {
      score += 6;
    }

    for (const token of candidate.split(' ').filter(value => value.length > 3)) {
      if (source.includes(token)) {
        score += 1;
      }
    }
  }

  return score;
}

function hasAcceptedMemoryCardActivation(continuationBrief: string | undefined, activationCandidates: string[]): boolean {
  const acceptedMemoryText = extractAcceptedMemoryCardSection(continuationBrief);
  if (!acceptedMemoryText) {
    return false;
  }

  return scoreActivationCandidates(activationCandidates, normalizeActivationText(acceptedMemoryText)) > 0;
}

function extractAcceptedMemoryCardSection(continuationBrief: string | undefined): string {
  const acceptedHeading = 'Accepted Memory Cards:';
  const source = continuationBrief ?? '';
  const acceptedStart = source.indexOf(acceptedHeading);
  if (acceptedStart === -1) {
    return '';
  }

  const acceptedText = source.slice(acceptedStart + acceptedHeading.length);
  const pinnedStart = acceptedText.indexOf('\nPinned Memory Cards:');
  return pinnedStart === -1 ? acceptedText : acceptedText.slice(0, pinnedStart);
}

function formatCourtroomDetail(value: string): string {
  const detail = compactPromptLine(value);
  return detail ? ` - ${detail}` : '';
}

function compactPromptLine(value: string): string {
  const compacted = collapseWhitespace(value).trim();
  if (compacted.length <= CONTINUITY_COURTROOM_MAX_DETAIL_LENGTH) {
    return compacted;
  }

  return `${compacted.slice(0, CONTINUITY_COURTROOM_MAX_DETAIL_LENGTH - 3).trim()}...`;
}

function buildChapterEndingStressTestBrief(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const selectedPressure = chooseChapterEndingPressure(storyState, continuationBrief);
  return [
    'Chapter Ending Stress Test:',
    `- Endings: ${CHAPTER_ENDING_PRESSURES.map(pressure => pressure.candidateLabel).join(', ')}.`,
    `- Chosen: ${selectedPressure.label} - ${selectedPressure.instruction}`,
    `- Scene pressure mix: ${chooseScenePressureMix(storyState, continuationBrief, selectedPressure)}.`,
    '- Answer one question; leave one sharper.'
  ].join('\n');
}

function chooseChapterEndingPressure(storyState: StoryStateSnapshot, continuationBrief: string | undefined): ChapterEndingPressure {
  const unresolvedThreads = storyState.threads.filter(isUnresolvedThread);
  const unresolvedArtifacts = storyState.artifacts.filter(artifact => !artifact.resolvedInChapter);
  const pressureSource = buildContinuationPressureSource(storyState, continuationBrief);
  const scores: Record<ChapterEndingPressureId, number> = {
    emotional_reveal: 1,
    danger_escalation: 1,
    secret_exposed: 1
  };

  if (containsAny(pressureSource, ['love', 'kiss', 'desire', 'choose', 'confess', 'heart', 'boundary', 'want', 'betray'])) {
    scores.emotional_reveal += 2;
  }

  if (containsAny(pressureSource, ['danger', 'attack', 'threat', 'trap', 'hunt', 'deadline', 'demand', 'force', 'blood'])) {
    scores.danger_escalation += 2;
  }

  if (unresolvedThreads.some(thread => thread.status === 'escalating')) {
    scores.danger_escalation += 2;
  }

  if (containsAny(pressureSource, ['secret', 'hidden', 'truth', 'lie', 'name', 'bargain', 'debt', 'payment', 'price', 'vow'])) {
    scores.secret_exposed += 3;
  }

  if (unresolvedArtifacts.length > 0 || storyState.continuityWarnings.length > 0) {
    scores.secret_exposed += 2;
  }

  return CHAPTER_ENDING_PRESSURES.reduce((best, candidate) =>
    scores[candidate.id] > scores[best.id] ? candidate : best
  );
}

function chooseScenePressureMix(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined,
  selectedPressure: ChapterEndingPressure
): string {
  const primary = mapEndingPressureToScenePressure(selectedPressure.id);
  const pressureSource = buildContinuationPressureSource(storyState, continuationBrief);
  const secondaryCandidates: ScenePressureLabel[] = [];

  if (containsAny(pressureSource, ['deadline', 'clock', 'tonight', 'hour', 'sunrise'])) {
    secondaryCandidates.push('Deadline');
  }

  if (storyState.artifacts.some(artifact => !artifact.resolvedInChapter)
    || containsAny(pressureSource, ['court', 'room', 'place', 'reef', 'shell', 'song', 'door', 'hall'])) {
    secondaryCandidates.push('Setting');
  }

  if (storyState.characters.length > 1
    || containsAny(pressureSource, ['family', 'crowd', 'witness', 'lord', 'queen', 'council'])) {
    secondaryCandidates.push('Social');
  }

  if (containsAny(pressureSource, ['secret', 'hidden', 'truth', 'lie', 'bargain', 'debt', 'payment', 'price', 'vow'])) {
    secondaryCandidates.push('Secret');
  }

  if (containsAny(pressureSource, ['love', 'kiss', 'desire', 'choose', 'confess', 'heart', 'betray'])) {
    secondaryCandidates.push('Emotional');
  }

  const secondary = secondaryCandidates.find(candidate => candidate !== primary)
    ?? (primary === 'Setting' ? 'Social' : 'Setting');
  return `${primary} + ${secondary}; ${chooseScenePressureVariant(storyState, continuationBrief, primary, secondary)}`;
}

function mapEndingPressureToScenePressure(pressureId: ChapterEndingPressureId): ScenePressureLabel {
  if (pressureId === 'emotional_reveal') {
    return 'Emotional';
  }
  if (pressureId === 'danger_escalation') {
    return 'Deadline';
  }
  return 'Secret';
}

function chooseScenePressureVariant(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined,
  primary: ScenePressureLabel,
  secondary: ScenePressureLabel
): string {
  const variants = SCENE_PRESSURE_VARIANTS[secondary];
  const seed = `${storyState.storyId}|${storyState.revision}|${continuationBrief ?? ''}|${primary}|${secondary}`;
  return variants[stableSeedIndex(seed, variants.length)] ?? variants[0];
}

function stableSeedIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (const char of seed) {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some(needle => value.includes(needle));
}

function buildContinuationPressureSource(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const unresolvedThreads = storyState.threads.filter(isUnresolvedThread);
  const unresolvedArtifacts = storyState.artifacts.filter(artifact => !artifact.resolvedInChapter);
  return [
    continuationBrief ?? '',
    ...unresolvedThreads.flatMap(thread => [thread.label, thread.description, ...thread.foreshadowedDevices]),
    ...unresolvedArtifacts.map(artifact => `${artifact.name} ${artifact.significance}`),
    ...storyState.continuityWarnings
  ].join(' ').toLowerCase();
}

function buildClicheAlarmBrief(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  return [
    'Cliche Alarm:',
    `- Avoid: ${chooseClicheAlarmPath(storyState, continuationBrief)}`,
    `- Freshness: turn ${chooseFreshnessTarget(storyState)} with visible cost.`,
    `- Subtext receipt: prove ${chooseSubtextReceiptTarget(storyState, continuationBrief)} by behavior before explanation.`
  ].join('\n');
}

function chooseClicheAlarmPath(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const source = buildContinuationPressureSource(storyState, continuationBrief);
  if (containsAny(source, ['debt', 'payment', 'price', 'bargain', 'vow', 'court', 'demand'])) {
    return 'formal demand with no personal cost.';
  }

  if (containsAny(source, ['love', 'kiss', 'desire', 'choose', 'confess', 'heart', 'want'])) {
    return 'confession of what they already know.';
  }

  if (containsAny(source, ['danger', 'attack', 'threat', 'trap', 'hunt', 'deadline', 'force', 'blood'])) {
    return 'threat that changes no relationship.';
  }

  return 'repeat of the last chapter without new cost.';
}

function chooseFreshnessTarget(storyState: StoryStateSnapshot): string {
  const thread = storyState.threads.find(candidate => candidate.status === 'escalating')
    ?? storyState.threads.find(candidate => candidate.status === 'active')
    ?? storyState.threads.find(isUnresolvedThread);
  if (thread) {
    return compactPromptLine(thread.label);
  }

  const artifact = storyState.artifacts.find(candidate => !candidate.resolvedInChapter);
  if (artifact) {
    return compactPromptLine(artifact.name);
  }

  return 'the most recent unresolved choice';
}

function chooseSubtextReceiptTarget(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const relationshipPressure = selectRelationshipPressure(storyState, continuationBrief);
  if (relationshipPressure) {
    return `${compactPromptLine(relationshipPressure.sourceCharacter.displayName)} and ${compactPromptLine(relationshipPressure.targetCharacter.displayName)}`;
  }

  return chooseFreshnessTarget(storyState);
}

function buildStoryLabPayloadFromContinuation(
  input: LabContinuationSeam['input'],
  continuation: ClassicContinuationOutput,
  previousState: StoryStateSnapshot,
  existingSummary: StorySummary | undefined,
  previousChapters: GeneratedChapter[],
  metadata?: ApiResponseMetadata
): StoryIterationPayload & { appendedChapterNumbers: number[] } {
  const now = new Date().toISOString();
  const chapters = toStoryLabChapters(
    input.storyId,
    continuation.chapters,
    continuation.content,
    undefined,
    input.chapterBatchSize,
    previousChapters.length ? Math.max(...previousChapters.map(chapter => chapter.chapterNumber)) + 1 : continuation.chapterNumber
  );
  const summary: StorySummary = {
    ...(existingSummary ?? {
      storyId: input.storyId,
      title: continuation.title,
      synopsis: input.continuationBrief ?? 'Continuation batch',
      tone: 'dark_romance',
      spicyLevel: continuation.spicyLevelMaintained,
      createdAt: now,
      tropeMetadata: continuation.tropeMetadata
    }),
    tropeMetadata: existingSummary?.tropeMetadata ?? continuation.tropeMetadata,
    updatedAt: now
  };
  const state = buildStateSnapshot(undefined, input.storyId, chapters, previousState, now);
  const payload: StoryIterationPayload & { appendedChapterNumbers: number[] } = {
    summary,
    batch: {
      chapters,
      totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      suggestedNextPrompts: buildContinuationPrompts(input, continuation.nextChapterHint)
    },
    state,
    stateDelta: buildStateDelta(input.storyId, previousState, state, chapters),
    telemetry: buildGrokTelemetry(metadata, chapters.length),
    appendedChapterNumbers: chapters.map(chapter => chapter.chapterNumber)
  };

  return payload;
}

function toStoryLabChapters(
  storyId: string,
  classicChapters: ClassicChapter[] | undefined,
  fallbackHtml: string,
  fallbackRawHtml: string | undefined,
  batchSize: number,
  firstChapterNumber = 1
): GeneratedChapter[] {
  const sourceChapters = classicChapters?.length
    ? classicChapters
    : [{
        chapterId: `${storyId}-chapter-${firstChapterNumber}`,
        chapterNumber: firstChapterNumber,
        title: 'Chapter 1',
        content: fallbackHtml,
        rawContent: fallbackRawHtml,
        wordCount: countWords(fallbackHtml),
        generatedAt: new Date(),
        hasAudio: false,
        cliffhangerEnding: false
      } satisfies ClassicChapter];

  return sourceChapters.map((chapter, index) => {
    const chapterNumber = chapter.chapterNumber || firstChapterNumber + index;
    const htmlContent = chapter.content || fallbackHtml;

    return {
      chapterId: chapter.chapterId || `${storyId}-chapter-${chapterNumber}`,
      chapterNumber,
      title: normalizeChapterTitle(chapter.title, chapterNumber),
      htmlContent,
      rawContent: chapter.rawContent,
      summary: summarizeHtml(htmlContent),
      wordCount: chapter.wordCount || countWords(htmlContent),
      hasCliffhanger: Boolean(chapter.cliffhangerEnding),
      delta: buildChapterDelta(storyId, chapterNumber, batchSize, Boolean(chapter.cliffhangerEnding))
    };
  });
}

function buildStateSnapshot(
  input: LabGenerationSeam['input'] | undefined,
  storyId: string,
  chapters: GeneratedChapter[],
  previousState: StoryStateSnapshot | null,
  now: string
): StoryStateSnapshot {
  const revision = previousState ? previousState.revision + 1 : 1;
  const generatedCharacters = input ? buildInitialCharacters(storyId, input) : [];
  const generatedThreads = input ? buildInitialThreads(storyId, input) : [];
  const generatedArtifacts = input?.worldDetails ? [buildWorldArtifact(storyId, input.worldDetails)] : [];
  const previousBeats = previousState?.beats ?? [];
  const previousSpicyLevel = previousBeats.length
    ? previousBeats[previousBeats.length - 1]?.spicyLevel
    : undefined;

  return {
    storyId,
    revision,
    characters: mergeUniqueById(previousState?.characters ?? [], [
      ...generatedCharacters,
      ...chapters.flatMap(chapter => chapter.delta.introducedCharacters)
    ]),
    threads: mergeThreads(previousState?.threads ?? generatedThreads, chapters),
    artifacts: mergeUniqueById(previousState?.artifacts ?? [], [
      ...generatedArtifacts,
      ...chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts)
    ]),
    beats: [
      ...(previousState?.beats ?? []),
      ...chapters.map(chapter => ({
        id: `${storyId}-beat-${chapter.chapterNumber}`,
        chapterNumber: chapter.chapterNumber,
        summary: chapter.summary,
        beatType: chapter.chapterNumber === 1 ? 'inciting_incident' as const : 'rising_action' as const,
        tensionLevel: Math.min(5, 2 + (chapter.chapterNumber % 4)) as 1 | 2 | 3 | 4 | 5,
        spicyLevel: input?.spicyLevel ?? previousSpicyLevel ?? 3
      }))
    ],
    continuityWarnings: uniqueStrings([
      ...(previousState?.continuityWarnings ?? []),
      ...chapters.flatMap(chapter => chapter.delta.continuityFlags)
    ]),
    narrativeVoice: input?.tone?.split('_').join(' ') ?? previousState?.narrativeVoice ?? 'dark romance',
    lastUpdatedAt: now
  };
}

function buildInitialCharacters(storyId: string, input: LabGenerationSeam['input']): CharacterProfile[] {
  const protagonistName = input.protagonistName?.trim() || `${capitalize(input.creature)} protagonist`;
  const antagonistName = input.antagonistName?.trim();
  const protagonistId = `${storyId}-protagonist`;
  const antagonistId = `${storyId}-antagonist`;
  const characters: CharacterProfile[] = [
    {
      id: protagonistId,
      displayName: protagonistName,
      archetype: 'protagonist',
      summary: `${protagonistName} anchors the ${input.creature} story promised by the blueprint.`,
      currentGoal: input.logline,
      internalConflict: 'Desire and self-protection pull in opposite directions.',
      externalConflict: antagonistName || 'The supernatural world resists the romance.',
      secrets: [],
      relationships: antagonistName ? [{
        characterId: antagonistId,
        relationship: 'rival',
        notes: `${antagonistName} pressures ${protagonistName} into a costly choice.`
      }] : [],
      spiceCompatibilities: [input.spicyLevel]
    }
  ];

  if (antagonistName) {
    characters.push({
      id: antagonistId,
      displayName: antagonistName,
      archetype: 'antagonist',
      summary: 'An opposing force named in the Story Lab blueprint.',
      currentGoal: 'Pressure the protagonist into a costly choice.',
      internalConflict: 'Their own desire complicates the threat they represent.',
      externalConflict: input.logline,
      secrets: [],
      relationships: [{
        characterId: protagonistId,
        relationship: 'rival',
        notes: `${protagonistName} can expose or refuse the costly choice.`
      }],
      spiceCompatibilities: [input.spicyLevel]
    });
  }

  return characters;
}

function buildInitialThreads(storyId: string, input: LabGenerationSeam['input']): PlotThread[] {
  const themeThreads = input.themes.length
    ? input.themes.map((theme, index) => ({
        id: `${storyId}-thread-${index + 1}`,
        label: theme.label,
        status: 'active' as const,
        description: theme.description,
        foreshadowedDevices: [],
        lifetime: 'series' as const
      }))
    : [];

  return themeThreads.length ? themeThreads : [{
    id: `${storyId}-thread-1`,
    label: 'Central romance',
    status: 'active',
    description: input.logline,
    foreshadowedDevices: [],
    lifetime: 'series'
  }];
}

function buildWorldArtifact(storyId: string, worldDetails: string): LoreArtifact {
  return {
    id: `${storyId}-world-details`,
    name: deriveWorldArtifactName(worldDetails),
    significance: worldDetails,
    introducedInChapter: 1,
    lifetime: 'series'
  };
}

function deriveWorldArtifactName(worldDetails: string): string {
  const compacted = collapseWhitespace(worldDetails).replace(/[.!?]+$/g, '').trim();
  const whereMatch = compacted.match(/\bwhere\s+(.+?)(?:\s+(?:record|records|rule|rules|bind|binds|hold|holds|keep|keeps|hide|hides|guard|guards|demand|demands|remember|remembers|change|changes|cost|costs|make|makes)\b|$)/i);
  if (whereMatch?.[1]) {
    return formatWorldArtifactName(whereMatch[1]);
  }

  const byMatch = compacted.match(/\b(?:ruled|bound|guarded|haunted|recorded|kept|protected)\s+by\s+(.+?)(?:[.,;:]|$)/i);
  if (byMatch?.[1]) {
    return formatWorldArtifactName(byMatch[1]);
  }

  const withoutArticle = compacted.replace(/^(?:a|an|the)\s+/i, '');
  const beforeRelation = withoutArticle.split(/\b(?:where|ruled by|bound by|guarded by|with|whose|that)\b/i)[0] ?? withoutArticle;
  return formatWorldArtifactName(beforeRelation);
}

function formatWorldArtifactName(value: string): string {
  const cleaned = value
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, WORLD_ARTIFACT_MAX_NAME_WORDS);
  if (!words.length) {
    return 'World Texture';
  }

  return words.map(formatWorldArtifactWord).join(' ');
}

function formatWorldArtifactWord(word: string): string {
  return word.split('-').map(capitalize).join('-');
}

function buildChapterDelta(
  storyId: string,
  chapterNumber: number,
  batchSize: number,
  hasCliffhanger: boolean
): ChapterDelta {
  const continuityFlags = batchSize > 1 && chapterNumber % batchSize === 0
    ? [`Review Chapter ${chapterNumber} ending for payoff before expanding the next batch.`]
    : [];

  return {
    introducedCharacters: [],
    resolvedThreads: [],
    escalatedThreads: hasCliffhanger ? [`${storyId}-thread-1`] : [],
    foreshadowedArtifacts: [],
    continuityFlags
  };
}

function buildStateDelta(
  storyId: string,
  fromState: StoryStateSnapshot | null,
  toState: StoryStateSnapshot,
  chapters: GeneratedChapter[]
): StoryStateDelta {
  const addedChapterNumbers = chapters.map(chapter => chapter.chapterNumber);

  return {
    storyId,
    fromRevision: fromState?.revision ?? null,
    toRevision: toState.revision,
    addedChapterNumbers,
    introducedCharacters: chapters.flatMap(chapter => chapter.delta.introducedCharacters),
    updatedCharacters: [],
    resolvedThreads: uniqueStrings(chapters.flatMap(chapter => chapter.delta.resolvedThreads)),
    escalatedThreads: toState.threads.filter(thread =>
      chapters.some(chapter => chapter.delta.escalatedThreads.includes(thread.id))
    ),
    foreshadowedArtifacts: chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts),
    continuityWarnings: uniqueStrings(chapters.flatMap(chapter => chapter.delta.continuityFlags)),
    beatIds: addedChapterNumbers.map(chapterNumber => `${storyId}-beat-${chapterNumber}`),
    summary: `Added chapter${addedChapterNumbers.length === 1 ? '' : 's'} ${addedChapterNumbers.join(', ')} from the real story engine.`
  };
}

function mergeThreads(existingThreads: PlotThread[], chapters: GeneratedChapter[]): PlotThread[] {
  const escalatedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.escalatedThreads));
  return existingThreads.map(thread =>
    escalatedThreadIds.has(thread.id) && thread.status !== 'resolved'
      ? { ...thread, status: 'escalating' as const }
      : thread
  );
}

function mergeUniqueById<T extends { id: string }>(existing: T[], additions: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of additions) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function buildSuggestedPrompts(input: LabGenerationSeam['input'], nextChapterHint?: string): string[] {
  return [
    nextChapterHint,
    input.antagonistName ? `Let ${input.antagonistName} force a dangerous bargain.` : undefined,
    input.worldDetails ? 'Reveal how the world rules make the romance more costly.' : undefined,
    'Escalate the central desire-vs-duty conflict.'
  ].filter((prompt): prompt is string => Boolean(prompt));
}

function buildContinuationPrompts(input: LabContinuationSeam['input'], nextChapterHint?: string): string[] {
  return [
    nextChapterHint,
    input.continuationBrief ? `Pay off: ${input.continuationBrief}` : undefined,
    'Answer one open question and raise a sharper one.'
  ].filter((prompt): prompt is string => Boolean(prompt));
}

function buildGrokTelemetry(metadata: ApiResponseMetadata | undefined, chapterCount: number): GenerationTelemetry {
  const totalLatencyMs = metadata?.processingTime ?? 0;
  const model = metadata?.model ?? getXaiStoryModel();
  const reasoningEffort = metadata ? metadata.reasoningEffort : getXaiReasoningEffort();

  return {
    engine: 'grok',
    model,
    reasoningEffort,
    fallbackFromModel: metadata?.fallbackFromModel,
    totalLatencyMs,
    averageChapterLatencyMs: chapterCount > 0 ? Math.round(totalLatencyMs / chapterCount) : totalLatencyMs,
    tokensConsumed: 0,
    retryCount: metadata?.fallbackFromModel ? 1 : 0
  };
}

async function enrichContinuity<T extends StoryIterationPayload>(
  payload: T,
  blueprint: LabGenerationSeam['input'] | undefined,
  useAi: boolean
): Promise<T> {
  const extraction = await extractContinuity({
    storyId: payload.summary.storyId,
    currentState: payload.state,
    chapters: payload.batch.chapters,
    summary: payload.summary,
    blueprint,
    useAi
  });

  return {
    ...payload,
    state: extraction.state,
    stateDelta: payload.stateDelta ? {
      ...payload.stateDelta,
      continuityWarnings: extraction.state.continuityWarnings
    } : payload.stateDelta,
    continuityExtraction: extraction.receipt
  };
}

function getPartialGenerationError(
  requestedChapterCount: number,
  generatedChapterCount: number,
  partialFailures: ChapterFailure[] | undefined
): StoryLabErrorResponse | null {
  const failures = partialFailures ?? [];
  if (generatedChapterCount >= requestedChapterCount && failures.length === 0) {
    return null;
  }

  return {
    success: false,
    error: {
      code: 'PARTIAL_GENERATION_FAILED',
      message: `Generated ${generatedChapterCount} of ${requestedChapterCount} requested chapter${requestedChapterCount === 1 ? '' : 's'}.`,
      details: {
        chaptersRequested: requestedChapterCount,
        chaptersGenerated: generatedChapterCount,
        partialFailures: failures
      }
    }
  };
}

function withMockTelemetry<T extends StoryIterationPayload>(response: ApiResponse<T>): ApiResponse<T> {
  if (!response.success) {
    return response;
  }

  return {
    success: true,
    data: {
      ...response.data,
      telemetry: {
        ...response.data.telemetry,
        engine: 'custom'
      }
    }
  };
}

function normalizeChapterTitle(title: string | undefined, chapterNumber: number): string {
  if (!title) {
    return `Chapter ${chapterNumber}`;
  }

  return title.replace(/^Chapter\s+\d+:\s*/i, '').trim() || `Chapter ${chapterNumber}`;
}

function summarizeHtml(html: string): string {
  const words = wordsFromHtml(html);
  return `${words.slice(0, 28).join(' ')}${words.length > 28 ? '...' : ''}`;
}

function countWords(html: string): number {
  return wordsFromHtml(html).length;
}

function wordsFromHtml(html: string): string[] {
  const text = stripHtml(html);
  return text ? text.split(' ') : [];
}

function stripHtml(html: string): string {
  const withoutTags = stripMarkupTags(html);
  const withoutSpeakerTags = stripSpeakerTags(withoutTags);
  return collapseWhitespace(withoutSpeakerTags).trim();
}

function stripMarkupTags(value: string): string {
  let result = '';
  let insideTag = false;

  for (const char of value) {
    if (char === '<') {
      insideTag = true;
      result += ' ';
      continue;
    }

    if (insideTag) {
      if (char === '>') {
        insideTag = false;
        result += ' ';
      }
      continue;
    }

    result += char;
  }

  return result;
}

function stripSpeakerTags(value: string): string {
  let result = '';
  let index = 0;

  while (index < value.length) {
    if (value[index] === '[') {
      const closingIndex = value.indexOf(']:', index + 1);
      if (closingIndex >= 0) {
        index = closingIndex + 2;
        continue;
      }
    }

    result += value[index];
    index += 1;
  }

  return result;
}

function collapseWhitespace(value: string): string {
  let result = '';
  let previousWasWhitespace = false;

  for (const char of value) {
    if (isWhitespace(char)) {
      if (!previousWasWhitespace) {
        result += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }

    result += char;
    previousWasWhitespace = false;
  }

  return result;
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f' || char === '\v';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}
