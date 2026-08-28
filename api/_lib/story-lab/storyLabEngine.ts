// Created: 2026-05-28 02:39 UTC

import type {
  ApiResponse,
  GenerationTelemetry,
  GeneratedChapter,
  HeatContract,
  StoryContinuationSeam as LabContinuationSeam,
  StoryGenerationSeam as LabGenerationSeam,
  StoryIterationPayload,
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
import { isClassicStoryTheme } from '../../../shared/themeVocabulary';
import { StoryService } from '../services/storyService';
import { buildContinuationResponse, buildGenesisResponse } from './mockData';
import { getTransientStorySnapshot, persistStoryIteration } from './stateStore';
import { extractContinuity } from './continuityExtractor';
import { getXaiReasoningEffort, getXaiStoryModel } from '../config/xaiConfig';
import { getStoryLabContinuityTimeoutMs } from './continuityBudget';
import { withContinuationStrategyBrief, stripStoryMemoryCardSections } from './continuationGuidance';
import { buildChapterDelta, buildStateDelta, buildStateSnapshot } from './storyStateBuilder';
import { collapseWhitespace } from '../utils/whitespace';
import { stripStoryHtmlToText } from '../../../shared/storyTextBlocks';
import { STORY_BLUEPRINT_LIMITS } from '../../../shared/storyBlueprintLimits';

export { getStoryLabContinuityTimeoutMs } from './continuityBudget';
export {
  previewStoryLabContinuationGuidance,
  type StoryLabContinuationGuidancePreview,
  type StoryLabContinuationSourceMapEntry
} from './continuationGuidance';

type ClassicStoryOutput = ClassicGenerationSeam['output'];
type ClassicContinuationOutput = ClassicContinuationSeam['output'];
type StoryServiceLike = Pick<StoryService, 'generateStory' | 'continueChapter'>;
type StoryLabErrorResponse = Extract<ApiResponse<never>, { success: false }>;

interface StoryLabEngineOptions {
  serviceFactory?: () => StoryServiceLike;
}

const MOCK_FLAG_VALUES = new Set(['1', 'true', 'yes']);
/**
 * The theme this route sends when none of the reader's seeds is a classic
 * theme. It is a `ThemeType` and not a seed id: this is the value handed to the
 * classic generator, which knows only the eighteen.
 */
const DEFAULT_CLASSIC_THEME: ThemeType = 'forbidden_love';

export function shouldUseMockStoryLab(): boolean {
  const forceMock = process.env['STORY_LAB_FORCE_MOCK'] ?? '';
  return !isProductionRuntime() && (MOCK_FLAG_VALUES.has(forceMock.toLowerCase()) || !process.env['XAI_API_KEY']);
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

function storyLabErrorResponse(error: unknown, fallbackCode: string): StoryLabErrorResponse {
  const record = error && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown }
    : {};
  const trimmedCode = typeof record.code === 'string' ? record.code.trim() : '';
  const trimmedMessage = typeof record.message === 'string' ? record.message.trim() : '';
  const code = trimmedCode
    ? trimmedCode
    : fallbackCode;
  const message = trimmedMessage
    ? trimmedMessage
    : 'Story Lab request failed before completing.';

  return {
    success: false,
    error: {
      code,
      message
    }
  };
}

/**
 * Refuse a Heat Contract that withholds the adult-reader confirmation.
 *
 * `adultOnlyConfirmed` is the whole of the gate: the contract beside it names a
 * tension mode and an intimacy boundary — `literary_on_page` among them — and
 * both are written into the generation context the prompt is built from. So the
 * contract is what decides how explicit the chapter is, and this flag is the
 * reader's confirmation that they may be shown it.
 *
 * `required` is what separates the two callers. Genesis has to have a contract
 * before there is a story at all, and refuses an absent one. A continuation
 * carries the contract as an optional field, and one that omits it is asking for
 * more of the story it already has under whatever terms that story was begun on
 * — so an absent contract stays what it has always been there, and only a
 * supplied one is held to its own confirmation.
 */
function heatContractPolicyError(
  heatContract: HeatContract | undefined,
  options: { required: boolean }
): StoryLabErrorResponse | null {
  if (!heatContract) {
    return options.required ? contentPolicyViolation() : null;
  }

  return heatContract.adultOnlyConfirmed === true ? null : contentPolicyViolation();
}

function contentPolicyViolation(): StoryLabErrorResponse {
  return {
    success: false,
    error: {
      code: 'CONTENT_POLICY_VIOLATION',
      message: 'Story Lab requires adult-reader and consensual-fantasy confirmation before generating this Heat Contract.'
    }
  };
}

function validateHeatContract(input: LabGenerationSeam['input']): StoryLabErrorResponse | null {
  return heatContractPolicyError(input.heatContract, { required: true });
}

/**
 * The blueprint's seeds as the classic generator's themes.
 *
 * The cap is `STORY_BLUEPRINT_LIMITS.maxThemes` rather than the bare `5` it
 * was, because this is the seam where the two numbers meet: the blueprint that
 * reaches here has already been bounded by that limit at the form and at
 * `parseStoryLabBlueprint`, and the array this returns is bounded again by
 * `VALIDATION_RULES.themes.maxCount` at `validateStoryInput` — which now reads
 * the same limit. Written as a literal, this line was the one place a raised
 * limit would have been silently un-raised: five themes reaching the generator
 * out of the six the reader had chosen and the two validators either side had
 * accepted, with nothing in the response saying which one was dropped.
 */
function toClassicThemes(themeIds: string[]): ThemeType[] {
  const classicThemes = themeIds
    .map(themeId => themeId.split('-').join('_'))
    .filter(isClassicStoryTheme)
    .slice(0, STORY_BLUEPRINT_LIMITS.maxThemes);

  return classicThemes.length ? classicThemes : [DEFAULT_CLASSIC_THEME];
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
  const requestStartedAtMs = Date.now();
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
  const result = await service.generateStory(toClassicGenerationInput(input), requestStartedAtMs);

  if (!result.success) {
    return storyLabErrorResponse(result.error, 'GENERATION_FAILED');
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
    !options.serviceFactory,
    requestStartedAtMs
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
  const requestStartedAtMs = Date.now();
  // The same gate genesis applies, on the route that writes every chapter after
  // the first. It was only ever on genesis, so the adult-reader confirmation
  // covered chapter 1 of a story and nothing else: a continuation could carry
  // `adultOnlyConfirmed: false` and still be generated, with the tension mode
  // and intimacy boundary the same rejected contract named handed to the prompt
  // through `generationContext` below. The Angular form refuses to submit
  // without the confirmation, but the form is not the enforcement point — the
  // route is, and it is the route that serves the continuation the reader
  // actually reads most of the story through.
  const heatContractError = heatContractPolicyError(input.heatContract, { required: false });
  if (heatContractError) {
    return heatContractError;
  }

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

  const unnumberedChapterIndex = findUnnumberedChapterIndex(previousChapters);
  if (unnumberedChapterIndex >= 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: `Every previously generated chapter must carry a numeric chapterNumber; entry ${unnumberedChapterIndex} does not.`
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
  }, requestStartedAtMs);

  if (!result.success) {
    return storyLabErrorResponse(result.error, 'CONTINUATION_FAILED');
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
    !options.serviceFactory,
    requestStartedAtMs
  );
  payload.persistence = persistStoryIteration(payload, previousChapters);

  return {
    success: true,
    data: payload
  };
}

/**
 * The first previously generated chapter whose number cannot be read, or `-1`.
 *
 * `previouslyGeneratedChapters` arrives in the request body, and the routes that
 * reach this function check that it is an array and nothing about what is in it.
 * Both of this module's readings of that array are `Math.max` over
 * `chapter.chapterNumber`, and `Math.max` answers `NaN` for a single entry that
 * has no number on it — a chapter saved by an older shape of the record, a
 * hand-written body, a client that sent its own summaries.
 *
 * `NaN` then travels the whole way through a paid generation without ever
 * throwing. `currentChapterCount: NaN` reaches `StoryService.continueChapter`,
 * which numbers what it writes `input.currentChapterCount + 1` — so the model is
 * asked to continue from chapter `NaN`, and `toStoryLabChapters` numbers every
 * chapter it hands back `NaN` too, since `NaN` is falsy and its `||` fallback is
 * `NaN + index`. The response then serializes those as `null`: a batch of
 * chapters titled `Chapter NaN`, with `chapterId`s of `…-chapter-NaN`, and an
 * `appendedChapterNumbers` of `[null]` for the client to append to a project by.
 *
 * It is the request that is malformed and only the caller can fix it, so the
 * answer is the same `INVALID_REQUEST` the check above gives, named to the
 * entry, and given before the generation is billed rather than after it has
 * produced an unusable batch. The index is reported rather than any of the
 * entry's own text, which is the caller's.
 *
 * `Number.isFinite` rather than `Number.isFinite(Number(...))`, because the
 * coercing form answers the wrong question here: `Math.max` coerces too, so
 * `null` and `''` survive it as `0` rather than as `NaN` — a chapter that names
 * no number at all, accepted, and the batch numbered from one as if the story
 * had not started. The contract types this field as a number and every chapter
 * this repository mints carries one, so a value that is not a number is the same
 * caller error whichever way it would have failed.
 */
function findUnnumberedChapterIndex(chapters: readonly GeneratedChapter[]): number {
  return chapters.findIndex(chapter => !Number.isFinite(chapter?.chapterNumber));
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
        title: `Chapter ${firstChapterNumber}`,
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
      rawContent: chapter.rawContent ?? htmlContent,
      summary: summarizeHtml(htmlContent),
      wordCount: chapter.wordCount || countWords(htmlContent),
      hasCliffhanger: Boolean(chapter.cliffhangerEnding),
      delta: buildChapterDelta(storyId, chapterNumber, batchSize, Boolean(chapter.cliffhangerEnding))
    };
  });
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
  const publicContinuationBrief = stripStoryMemoryCardSections(input.continuationBrief);
  return [
    nextChapterHint,
    publicContinuationBrief ? `Pay off: ${publicContinuationBrief}` : undefined,
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
  useAi: boolean,
  requestStartedAtMs: number
): Promise<T> {
  const extraction = await extractContinuity({
    storyId: payload.summary.storyId,
    currentState: payload.state,
    chapters: payload.batch.chapters,
    summary: payload.summary,
    blueprint,
    useAi,
    timeoutMs: getStoryLabContinuityTimeoutMs(requestStartedAtMs)
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

/** How much of a chapter its library and workbench excerpt shows. */
const CHAPTER_SUMMARY_MAX_WORDS = 28;

function summarizeHtml(html: string): string {
  const words = wordsFromHtml(html);
  const excerpt = words.slice(0, CHAPTER_SUMMARY_MAX_WORDS).join(' ');
  return `${excerpt}${words.length > CHAPTER_SUMMARY_MAX_WORDS ? '...' : ''}`;
}

function countWords(html: string): number {
  return wordsFromHtml(html).length;
}

function wordsFromHtml(html: string): string[] {
  const text = stripHtml(html);
  return text ? text.split(' ') : [];
}

/**
 * Render a chapter's markup as the text a reader sees, then drop its speaker
 * tags.
 *
 * The markup half was a hand-rolled `stripMarkupTags` loop here — the last
 * private HTML stripper in the repository, and the one `shared/storyTextBlocks`
 * was written for. It differed from that module in the way that is hardest to
 * see from the code and easiest to see in the product: it decoded no entities.
 * `&nbsp;`, `&quot;`, `&#39;`, `&amp;` and `&lt;`/`&gt;` all survived it as
 * their literal source text, and both of this file's readers hand that straight
 * to the reader.
 *
 * - `countWords` is every Story Lab chapter's `wordCount`. A generator that
 *   spaced a phrase as `intense&nbsp;passion` — one of the two ways it can
 *   write a non-breaking space, and the one this repository has already been
 *   bitten by in `extractSpicyLevelFromContent` — produced a single token
 *   there, so the chapter was reported a word short for each one. The count
 *   is what the batch progress and the word-budget report are read against.
 * - `summarizeHtml` is the chapter excerpt shown in the library and the
 *   workbench, cut to its first 28 words. A chapter whose opening line is
 *   `she said &quot;no&quot;` was previewed with the entities showing, and
 *   `&quot;no&quot;` spent two of those 28 words on markup.
 *
 * `stripStoryHtmlToText` also puts a paragraph break where the markup put one
 * rather than a bare space, which is the `door.Blood` welding that module
 * exists to prevent — the old loop happened to avoid it by emitting a space for
 * every `<` and `>`, but only because every boundary it could not name got the
 * same treatment as every one it could.
 *
 * The speaker-tag pass stays here: `[Narrator]:` is this app's own convention
 * rather than markup, and the shared module deliberately knows nothing about
 * it.
 */
function stripHtml(html: string): string {
  const readerText = stripStoryHtmlToText(html);
  return collapseWhitespace(stripSpeakerTags(readerText));
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
