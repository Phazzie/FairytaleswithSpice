// Created: 2025-10-31 06:28 UTC

import { randomInt, randomUUID } from 'node:crypto';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse,
  VALIDATION_RULES,
  Chapter,
  ChapterFailure,
  CliffhangerType,
  isSupportedWordCount
} from '../types/contracts';
import { isCreatureArchetype } from '../../../shared/creatureVocabulary';
import {
  CHAPTER_BATCH_SIZES,
  clampToChapterBatchSize,
  formatChapterBatchSizeList,
  isChapterBatchSize,
  type ChapterBatchSize
} from '../../../shared/chapterBatchVocabulary';
import { formatSpicyLevelList, isSpicyLevel } from '../../../shared/spiceLevelVocabulary';
import { isClassicStoryTheme } from '../../../shared/themeVocabulary';
import {
  buildProductionChapterScopeBlock,
  buildProductionSystemPrompt,
  buildProductionUserPrompt,
  formatChekhovLedger
} from '../../../shared/productionStoryPrompt';
import { selectRandomAuthorStyles } from '../config/authorStyles';
import { CliffhangerService, hasIdentifiedCliffhangerType } from './cliffhangerService';
import { TropeSelection, TropeSubversionService } from './tropeSubversionService';
import { logger, logError, logWarn, logApiError, logInfo, logPerformance, LogContext } from '../utils/logger';
import { estimateReadTimeMinutes } from '../utils/readTime';
import { getRemainingRequestBudgetMs, getXaiFastTimeoutMs, getXaiPrimaryTimeoutMs, type XaiReasoningEffort } from '../config/xaiConfig';
import { MIN_XAI_FALLBACK_TIMEOUT_MS, XaiTextClient, type XaiTextResponse } from './xaiTextClient';
import {
  analyzeEmotionalTone,
  countWords,
  createContextExcerpt,
  extractCharacterNames,
  extractChapterTitleAndBody,
  extractLastChapterSummary,
  extractPlotThreads,
  extractSpicyLevelFromContent,
  extractThemesFromContent,
  formatChapterContent,
  formatStoryContent,
  generateNextChapterHint,
  getCreatureDisplayName,
  getSpicyLabel,
  stripHtml,
  stripSpeakerTagsForDisplay
} from './storyContentAnalysis';
import {
  UNRECOGNIZED_PARAMETER,
  toLoggableBoolean,
  toLoggableCreature,
  toLoggableNumber,
  toLoggableThemes
} from '../utils/loggableRequestParameters';
import { STORY_BLUEPRINT_LIMITS, STORY_EVALUATION_LIMITS } from '../../../shared/storyBlueprintLimits';
import { capAtWordBoundaryWithinCodeUnits } from '../utils/textExcerpt';
import { collapseWhitespace } from '../utils/whitespace';
import {
  STORY_BEAT_STRUCTURES,
  STORY_CHEKHOV_ELEMENTS,
  STORY_CHEKHOV_ELEMENTS_PER_STORY
} from '../../../shared/storyPromptTables';

interface AiCallMetadata {
  model?: string;
  reasoningEffort?: XaiReasoningEffort;
  fallbackFromModel?: string;
}

interface GeneratedTextResult {
  content: string;
  aiMetadata?: AiCallMetadata;
}

interface ChapterGenerationOptions {
  chapterNumber: number;
  totalChapters: number;
  existingContent?: string;
  preferFastModel?: boolean;
}

interface GeneratedChaptersResult {
  chapters: Chapter[];
  failedChapters: ChapterFailure[];
  aggregatedHtml: string;
  aggregatedRawHtml: string;
  aiMetadata?: AiCallMetadata;
}

const EXTRA_BATCH_CHAPTER_TIMEOUT_MS = 9000;
const MOCK_CONTINUATION_TARGET_BODY_WORDS = 450;
// The prompt boundary's own reading of a theme seed, taken from the shared
// blueprint limits rather than restated here. The routes now refuse a seed
// larger than this, and a cap the routes enforce and a cap the prompt applies
// have to be the same number or the guarantee is only as good as whichever is
// looser.
const STORY_LAB_THEME_SEED_LIMIT = STORY_BLUEPRINT_LIMITS.maxThemes;
const STORY_LAB_THEME_LABEL_MAX_LENGTH = STORY_BLUEPRINT_LIMITS.maxThemeLabelLength;
const STORY_LAB_THEME_DESCRIPTION_MAX_LENGTH = STORY_BLUEPRINT_LIMITS.maxThemeDescriptionLength;
/**
 * The rest of the blueprint's free-text fields, each at its own field's cap.
 *
 * The two seed caps above were moved onto the shared limits with the note that
 * "a cap the routes enforce and a cap the prompt applies have to be the same
 * number or the guarantee is only as good as whichever is looser". The six
 * fields below were left on one shared `320`, which is the same defect running
 * the other way: not looser than the route, but *tighter*, and silently.
 *
 * `parseStoryLabBlueprint` accepts a 420-character logline, 600 characters of
 * world details, and 1200 of narrative directives, and the form built on
 * `STORY_BLUEPRINT_LIMITS` tells the reader those are the limits — the logline
 * counter counts down from 420. Every one of them then arrived here and was cut
 * to 320 before the model ever saw it. Narrative directives lost three-quarters
 * of an accepted field; world details lost nearly half; a logline written to the
 * limit the form states lost its last hundred characters. The block those lines
 * are written into ends `- Treat these blueprint fields as binding story intent,
 * not as optional flavor`, and nothing in the response said a quarter of that
 * intent had been dropped.
 *
 * The cap itself is not removable, and that is why these are numbers rather than
 * nothing: `/api/story/generate` takes a `generationContext` too, and
 * `validateStoryInput` does not measure its fields, so this is the only boundary
 * on that path. It just has to be the boundary the blueprint routes already
 * publish for each field, one field at a time, rather than one number that
 * happens to be the smallest of them.
 *
 * `noGoContent` keeps `320` — it was always this field's own cap, which is what
 * `STORY_LAB_PROFILE_LIMITS.maxNoGoContentLength` reads it as too. `tone` takes
 * the evaluation limits' configuration-value cap, which is documented for
 * exactly this shape of field: "one theme id or creature name, not a paragraph
 * wearing the field's name". The blueprint parser checks `tone` against
 * `NARRATIVE_TONES`, so only the classic route can deliver anything else here.
 */
const STORY_LAB_LOGLINE_MAX_LENGTH = STORY_BLUEPRINT_LIMITS.maxLoglineLength;
const STORY_LAB_TONE_MAX_LENGTH = STORY_EVALUATION_LIMITS.maxConfigurationValueLength;
const STORY_LAB_CHARACTER_NAME_MAX_LENGTH = STORY_BLUEPRINT_LIMITS.maxCharacterNameLength;
const STORY_LAB_WORLD_DETAILS_MAX_LENGTH = STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength;
const STORY_LAB_NARRATIVE_DIRECTIVES_MAX_LENGTH = STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength;
const STORY_LAB_NO_GO_CONTENT_MAX_LENGTH = STORY_BLUEPRINT_LIMITS.maxNoGoContentLength;

export class StoryService {
  private readonly xaiClient = new XaiTextClient();
  private readonly cliffhangerService = new CliffhangerService();
  private readonly tropeService = new TropeSubversionService();

  constructor() {
    if (!this.xaiClient.hasApiKey()) {
      logWarn('XAI_API_KEY not found in environment variables', {
        endpoint: 'StoryService',
        method: 'constructor'
      });
    }
  }

  private isProductionRuntime(): boolean {
    return process.env['NODE_ENV'] === 'production' || process.env['VERCEL_ENV'] === 'production';
  }

  private missingProviderError(): Error {
    return new Error('The AI story engine is not configured for this deployment. Set XAI_API_KEY before generating stories.');
  }

  /**
   * Calculate optimal token allocation for story generation
   * Accounts for: word-to-token ratio, HTML overhead, speaker tags, safety buffer
   * Optimized to reduce token count and speed up generation
   */
  private calculateOptimalTokens(wordCount: number): number {
    const tokensPerWord = 1.5;        // English averages ~1.5 tokens per word
    const htmlOverhead = 1.15;        // HTML tags add ~15% overhead (reduced from 1.2)
    const speakerTagOverhead = 1.1;   // Speaker tags add ~10% overhead (reduced from 1.15)
    const safetyBuffer = 1.05;        // 5% safety margin (reduced from 1.1)
    
    return Math.ceil(
      wordCount * 
      tokensPerWord * 
      htmlOverhead * 
      speakerTagOverhead * 
      safetyBuffer
    );
  }

  /**
   * How many tropes one story is asked to subvert, decided where the range is
   * declared.
   *
   * `TropeSubversionService` owns that range — `minTropes` and `maxTropes`, with
   * `getRandomTropeCount` drawing from it, and `selectTropesForSubversion`
   * falling back to it when the caller names no count. This is that service's
   * only caller in the app, and it named a count every time: `randomInt(2, 4)`,
   * which is the same two-or-three drawn the same way, written out again on the
   * other side of the seam.
   *
   * So the two fields and the method they feed had no reachable reader at all —
   * a named range nothing consults is not a range, it is a note, which is the
   * argument `estimateReadTimeMinutes` was extracted under for
   * `READING_SPEED.WORDS_PER_MINUTE`. And it is the arrangement where retuning
   * the range does nothing: widening `maxTropes` to four would leave every
   * generated story on two or three, because the caller decides.
   *
   * Omitting the count is what gives the declaration back its reader. The draw
   * is unchanged — `getRandomTropeCount` is `randomInt(this.minTropes,
   * this.maxTropes + 1)`, which is `randomInt(2, 4)`.
   */
  private selectTropeSubversions(input: StoryGenerationSeam['input']): TropeSelection | undefined {
    if (!this.tropeService.supportsCreature(input.creature)) {
      return undefined;
    }

    return this.tropeService.selectTropesForSubversion({
      creature: input.creature
    });
  }

  /**
   * `requestStartedAtMs` defaults to "now" for any caller with nothing earlier
   * to give it, but the Story Lab job routes reach this well after the
   * invocation actually began — job-store creation, an owner lookup, and
   * content-boundary loading all run first (see `jobRouteHandlers.ts`). The
   * Story Lab engine (`generateStoryLabGenesis`) already captures its own
   * `requestStartedAtMs` ahead of those, the same one it feeds continuity
   * extraction's budget, and passes it through here so the chapter loop below
   * measures against that earlier point instead of resetting the clock. The
   * gap between the true Vercel invocation start and the engine's own
   * timestamp — the job-store work in `jobRouteHandlers.ts` — is not closed by
   * this; see the PR discussion for why threading it further is a larger,
   * separate change.
   */
  async generateStory(
    input: StoryGenerationSeam['input'],
    requestStartedAtMs: number = Date.now()
  ): Promise<ApiResponse<StoryGenerationSeam['output']>> {
    const startTime = requestStartedAtMs;
    const requestId = logger.generateRequestId();
    const requestedChapterCount = this.normalizeChapterCount(input.requestedChapterCount);
    const sanitizedInput: StoryGenerationSeam['input'] = {
      ...input,
      requestedChapterCount
    };
    
    const context: LogContext = {
      requestId,
      endpoint: 'generateStory',
      method: 'POST',
      requestParameters: {
        creature: toLoggableCreature(sanitizedInput.creature),
        // Only the ids on the documented allow-list: validation bounds the
        // number of themes but not their contents, so the array can hold
        // whatever the caller sent.
        ...toLoggableThemes(sanitizedInput.themes),
        spicyLevel: toLoggableNumber(sanitizedInput.spicyLevel),
        wordCount: toLoggableNumber(sanitizedInput.wordCount),
        requestedChapterCount: toLoggableNumber(input.requestedChapterCount ?? requestedChapterCount)
      }
    };

    logInfo('Story generation request received', context);

    try {
      // Validate input
      const validationError = this.validateStoryInput(input);
      if (validationError) {
        logWarn('Story input validation failed', context, { validationError });
        
        return {
          success: false,
          error: validationError,
          metadata: {
            requestId,
            processingTime: Date.now() - startTime,
            chaptersRequested: requestedChapterCount,
            chaptersGenerated: 0
          }
        };
      }

      const tropeSelection = this.selectTropeSubversions(sanitizedInput);
      const {
        chapters,
        failedChapters,
        aggregatedHtml,
        aggregatedRawHtml,
        aiMetadata
      } = await this.generateChaptersForStory(sanitizedInput, requestedChapterCount, tropeSelection, context, startTime);

      if (chapters.length === 0) {
        return {
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: failedChapters[0]?.message || 'Failed to generate requested chapters'
          },
          metadata: {
            requestId,
            processingTime: Date.now() - startTime,
            chaptersRequested: requestedChapterCount,
            chaptersGenerated: 0,
            partialFailures: failedChapters.length ? failedChapters : undefined
          }
        };
      }

      const totalWordCount = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
      const firstChapter = chapters[0];
      const lastChapter = chapters[chapters.length - 1];
      const displayContent = aggregatedHtml || firstChapter.content;
      const rawStoryContent = aggregatedRawHtml || firstChapter.rawContent || firstChapter.content;

      // Create response
      const output: StoryGenerationSeam['output'] = {
        storyId: this.generateStoryId(),
        title: firstChapter.title || this.generateTitle(sanitizedInput),
        content: displayContent, // Clean content for user display
        rawContent: rawStoryContent, // Tagged content for audio processing
        creature: sanitizedInput.creature,
        themes: sanitizedInput.themes,
        spicyLevel: sanitizedInput.spicyLevel,
        actualWordCount: totalWordCount,
        estimatedReadTime: estimateReadTimeMinutes(totalWordCount),
        hasCliffhanger: Boolean(lastChapter.cliffhangerEnding),
        generatedAt: new Date(),
        tropeMetadata: tropeSelection ? this.tropeService.serializeTropeSelection(tropeSelection) : undefined,
        chapters,
        totalWordCount,
        nextChapterHint: lastChapter.nextChapterHint,
        appendedToStory: displayContent,
        failedChapters: failedChapters.length ? failedChapters : undefined
      };

      const duration = Date.now() - startTime;
      logPerformance('Story generation', duration, {
        ...context,
        responseTime: duration
      }, {
        actualWordCount: output.actualWordCount,
        chaptersGenerated: chapters.length,
        hasCliffhanger: output.hasCliffhanger,
        failedChapters: failedChapters.length
      });

      return {
        success: true,
        data: output,
        metadata: {
          requestId,
          processingTime: Date.now() - startTime,
          chaptersRequested: requestedChapterCount,
          chaptersGenerated: chapters.length,
          partialFailures: failedChapters.length ? failedChapters : undefined,
          model: aiMetadata?.model,
          reasoningEffort: aiMetadata?.reasoningEffort,
          fallbackFromModel: aiMetadata?.fallbackFromModel
        }
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logError('Story generation failed', error, {
        ...context,
        responseTime: duration,
        statusCode: error.response?.status || 500
      }, {
        errorType: error.name,
        isApiError: !!error.response
      });

      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate story',
          details: error.message
        },
        metadata: {
          requestId,
          processingTime: Date.now() - startTime,
          chaptersRequested: requestedChapterCount,
          chaptersGenerated: 0
        }
      };
    }
  }

  private async generateChaptersForStory(
    input: StoryGenerationSeam['input'],
    requestedChapterCount: number,
    tropeSelection: TropeSelection | undefined,
    context: LogContext,
    requestStartedAtMs: number
  ): Promise<GeneratedChaptersResult> {
    const chapters: Chapter[] = [];
    const failedChapters: ChapterFailure[] = [];
    let aggregatedHtml = '';
    let aggregatedRawHtml = '';
    let aiMetadata: AiCallMetadata | undefined;

    for (let chapterNumber = 1; chapterNumber <= requestedChapterCount; chapterNumber++) {
      // Only the batch's first chapter is exempt: it already runs on the full
      // primary timeout and its own fallback retry, so there is nothing left
      // to check the window against before it starts. Every chapter after it
      // is optional relative to the invocation's own deadline — attempting one
      // that cannot finish risks a platform SIGKILL neither this loop nor
      // `runJobWork` above it can catch, rather than the ordinary chapter
      // failure this ends with instead.
      if (chapterNumber > 1 && !this.hasBudgetForAnotherChapter(requestStartedAtMs)) {
        logWarn('Stopping chapter batch early: insufficient time remaining in the request budget', context, {
          nextChapterNumber: chapterNumber,
          requestedChapterCount,
          remainingBudgetMs: getRemainingRequestBudgetMs(requestStartedAtMs)
        });
        failedChapters.push(...this.skippedChapterFailures(chapterNumber, requestedChapterCount));
        break;
      }

      try {
        const generatedText = await this.callGrokAI(
          input,
          requestStartedAtMs,
          context,
          tropeSelection,
          requestedChapterCount > 1
            ? {
                chapterNumber,
                totalChapters: requestedChapterCount,
                existingContent: aggregatedRawHtml,
                preferFastModel: chapterNumber > 1
              }
            : undefined
        );
        aiMetadata = this.mergeAiMetadata(aiMetadata, generatedText.aiMetadata);
        const rawChapterContent = generatedText.content;
        const displayContent = stripSpeakerTagsForDisplay(rawChapterContent);
        const { title, body } = extractChapterTitleAndBody(displayContent, chapterNumber);
        const chapterContent = body || displayContent;
        const cliffhanger = this.detectCliffhanger(chapterContent);
        const chapter: Chapter = {
          chapterId: this.generateChapterId(),
          chapterNumber,
          title,
          content: chapterContent,
          rawContent: rawChapterContent,
          wordCount: countWords(chapterContent),
          generatedAt: new Date(),
          hasAudio: false,
          cliffhangerEnding: cliffhanger,
          nextChapterHint: generateNextChapterHint(chapterContent)
        };

        chapters.push(chapter);

        const appendableChapter = requestedChapterCount === 1
          ? displayContent
          : this.renderChapterForAppend(chapter);
        aggregatedHtml = this.combineStoryContent(aggregatedHtml, appendableChapter);
        aggregatedRawHtml = this.combineStoryContent(
          aggregatedRawHtml,
          requestedChapterCount === 1
            ? rawChapterContent
            : this.renderChapterForAppend({ ...chapter, content: rawChapterContent })
        );

        logInfo('Chapter generated successfully', context, {
          chapterNumber,
          wordCount: chapter.wordCount,
          cliffhanger
        });
      } catch (chapterError: any) {
        logError('Chapter generation failed', chapterError, context, { chapterNumber });
        failedChapters.push({
          chapterNumber,
          message: chapterError?.message || 'Unknown chapter generation error'
        });
      }
    }

    return {
      chapters,
      failedChapters,
      aggregatedHtml,
      aggregatedRawHtml,
      aiMetadata
    };
  }

  /** See `generateStory`'s note on `requestStartedAtMs`; `continueStoryLab` passes the same kind of engine-level timestamp here. */
  async continueChapter(
    input: ChapterContinuationSeam['input'],
    requestStartedAtMs: number = Date.now()
  ): Promise<ApiResponse<ChapterContinuationSeam['output']>> {
    const startTime = requestStartedAtMs;
    const requestId = logger.generateRequestId();
    const requestedChapterCount = this.normalizeChapterCount(input.requestedChapterCount);
    const sanitizedInput: ChapterContinuationSeam['input'] = {
      ...input,
      requestedChapterCount
    };
    
    const context: LogContext = {
      requestId,
      endpoint: 'continueChapter',
      method: 'POST',
      requestParameters: {
        currentChapterCount: toLoggableNumber(sanitizedInput.currentChapterCount),
        existingContentLength: sanitizedInput.existingContent?.length || 0,
        maintainTone: toLoggableBoolean(sanitizedInput.maintainTone),
        requestedChapterCount: toLoggableNumber(input.requestedChapterCount ?? requestedChapterCount)
      }
    };

    logInfo('Chapter continuation request received', context);

    try {
      if (!this.isValidRequestedChapterCount(input.requestedChapterCount)) {
        const { code, message, ...refusalDetails } = this.chapterCountRefusal(input.requestedChapterCount);
        return {
          success: false,
          error: {
            code,
            message,
            details: refusalDetails
          },
          metadata: {
            requestId,
            processingTime: Date.now() - startTime,
            chaptersRequested: requestedChapterCount,
            chaptersGenerated: 0
          }
        };
      }

      const chapters: Chapter[] = [];
      const failedChapters: ChapterFailure[] = [];
      let aggregatedHtml = sanitizedInput.existingContent || '';
      let aggregatedRawHtml = sanitizedInput.existingContent || '';
      let workingChapterCount = sanitizedInput.currentChapterCount;
      let lastCliffhangerAnalysis = this.cliffhangerService.analyze('');
      // The hook types this batch has already written, which is what
      // `varietyScore` is measured against.
      //
      // `analyze` was called with one argument, so `previousCliffhangers`
      // defaulted to `[]` on every chapter and the score it produces could only
      // ever be 8 — "these hooks do not repeat" — including for a batch that
      // ends all three of its chapters on the same one. That number is not
      // internal: it travels back to the caller as
      // `cliffhangerAnalysis.varietyScore` on the continuation response, so the
      // one signal the response carries about repetition was a constant
      // asserting there was none. The types are right here in the loop that
      // generates them; the branch below is the only reason they were not being
      // collected.
      //
      // Only a classified hook is fed forward. A chapter that merely stops on
      // `!` reports the `plot_twist` placeholder, and pushing that would charge
      // the *next* chapter with repeating a twist nothing identified — the
      // failure `CliffhangerService` was just fixed for, rebuilt one chapter
      // later from outside.
      const previousCliffhangers: CliffhangerType[] = [];
      let aiMetadata: AiCallMetadata | undefined;

      for (let offset = 1; offset <= requestedChapterCount; offset++) {
        const chapterNumber = workingChapterCount + 1;

        // See the matching check in `generateChaptersForStory`: only the
        // batch's first chapter is exempt, and stopping here is what keeps a
        // chapter that cannot finish from risking an uncatchable platform
        // SIGKILL instead of the ordinary partial-failure this ends with.
        if (offset > 1 && !this.hasBudgetForAnotherChapter(startTime)) {
          logWarn('Stopping continuation batch early: insufficient time remaining in the request budget', context, {
            nextChapterNumber: chapterNumber,
            requestedChapterCount,
            remainingBudgetMs: getRemainingRequestBudgetMs(startTime)
          });
          failedChapters.push(
            ...this.skippedChapterFailures(chapterNumber, chapterNumber + (requestedChapterCount - offset))
          );
          break;
        }

        try {
          const generatedText = await this.callGrokAIForContinuation(
            { ...sanitizedInput, currentChapterCount: workingChapterCount },
            startTime,
            context,
            {
              chapterNumber,
              totalChapters: requestedChapterCount,
              existingContent: aggregatedRawHtml,
              preferFastModel: offset > 1
            }
          );
          aiMetadata = this.mergeAiMetadata(aiMetadata, generatedText.aiMetadata);
          const rawChapterContent = generatedText.content;
          const displayContent = stripSpeakerTagsForDisplay(rawChapterContent);
          const { title, body } = extractChapterTitleAndBody(displayContent, chapterNumber);
          const chapterContent = body || displayContent;
          const cliffhangerAnalysis = this.cliffhangerService.analyze(chapterContent, previousCliffhangers);
          lastCliffhangerAnalysis = cliffhangerAnalysis;
          if (hasIdentifiedCliffhangerType(cliffhangerAnalysis)) {
            previousCliffhangers.push(cliffhangerAnalysis.cliffhangerType);
          }

          const chapter: Chapter = {
            chapterId: this.generateChapterId(),
            chapterNumber,
            title,
            content: chapterContent,
            rawContent: rawChapterContent,
            wordCount: countWords(chapterContent),
            generatedAt: new Date(),
            hasAudio: false,
            cliffhangerEnding: cliffhangerAnalysis.cliffhangerDetected,
            nextChapterHint: generateNextChapterHint(chapterContent)
          };

          chapters.push(chapter);
          aggregatedHtml = this.combineStoryContent(aggregatedHtml, this.renderChapterForAppend(chapter));
          aggregatedRawHtml = this.combineStoryContent(
            aggregatedRawHtml,
            this.renderChapterForAppend({ ...chapter, content: rawChapterContent })
          );

          logInfo('Continuation chapter generated', context, {
            chapterNumber,
            wordCount: chapter.wordCount,
            cliffhanger: chapter.cliffhangerEnding
          });
        } catch (chapterError: any) {
          logError('Continuation chapter generation failed', chapterError, context, { chapterNumber });
          failedChapters.push({
            chapterNumber,
            message: chapterError?.message || 'Unknown chapter generation error'
          });
        }

        workingChapterCount = chapterNumber;
      }

      if (chapters.length === 0) {
        return {
          success: false,
          error: {
            code: 'CONTINUATION_FAILED',
            message: failedChapters[0]?.message || 'Failed to generate requested continuation chapters'
          },
          metadata: {
            requestId,
            processingTime: Date.now() - startTime,
            chaptersRequested: requestedChapterCount,
            chaptersGenerated: 0,
            partialFailures: failedChapters.length ? failedChapters : undefined
          }
        };
      }

      const firstChapter = chapters[0];
      const lastChapter = chapters[chapters.length - 1];
      const totalWordCount = countWords(aggregatedHtml);

      // Create response
      const output: ChapterContinuationSeam['output'] = {
        chapterId: firstChapter.chapterId,
        chapterNumber: firstChapter.chapterNumber,
        title: `Chapter ${firstChapter.chapterNumber}: ${firstChapter.title}`,
        content: firstChapter.content,
        wordCount: firstChapter.wordCount,
        cliffhangerEnding: Boolean(lastChapter.cliffhangerEnding),
        themesContinued: extractThemesFromContent(aggregatedHtml),
        spicyLevelMaintained: extractSpicyLevelFromContent(aggregatedHtml),
        appendedToStory: aggregatedHtml,
        tropeMetadata: sanitizedInput.tropeMetadata,
        cliffhangerAnalysis: lastCliffhangerAnalysis,
        chapters,
        totalWordCount,
        estimatedReadTime: estimateReadTimeMinutes(totalWordCount),
        nextChapterHint: lastChapter.nextChapterHint,
        failedChapters: failedChapters.length ? failedChapters : undefined
      };

      const duration = Date.now() - startTime;
      logPerformance('Chapter continuation', duration, {
        ...context,
        responseTime: duration
      }, {
        chaptersGenerated: chapters.length,
        totalWordCount: output.totalWordCount,
        failedChapters: failedChapters.length
      });

      return {
        success: true,
        data: output,
        metadata: {
          requestId,
          processingTime: duration,
          chaptersRequested: requestedChapterCount,
          chaptersGenerated: chapters.length,
          partialFailures: failedChapters.length ? failedChapters : undefined,
          model: aiMetadata?.model,
          reasoningEffort: aiMetadata?.reasoningEffort,
          fallbackFromModel: aiMetadata?.fallbackFromModel
        }
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logError('Chapter continuation failed', error, {
        ...context,
        responseTime: duration,
        statusCode: error.response?.status || 500
      });

      return {
        success: false,
        error: {
          code: 'CONTINUATION_FAILED',
          message: 'Failed to continue story',
          details: error.message
        },
        metadata: {
          requestId,
          processingTime: duration,
          chaptersRequested: requestedChapterCount,
          chaptersGenerated: 0
        }
      };
    }
  }

  /**
   * A batch chapter's own timeout has to fit inside what the invocation
   * actually has left, not just the static floor `EXTRA_BATCH_CHAPTER_TIMEOUT_MS`
   * assumed was always available.
   */
  private resolveBatchChapterTimeoutMs(remainingBudgetMs: number): number {
    return Math.min(getXaiFastTimeoutMs(), EXTRA_BATCH_CHAPTER_TIMEOUT_MS, remainingBudgetMs);
  }

  /**
   * Whether the invocation has enough of its window left to start another
   * batch chapter at all. Below this floor a call is not merely tight, it
   * cannot finish before the platform kills the whole function — a
   * termination `runJobWork`'s try/catch cannot see, since the process is
   * gone mid-await rather than throwing. Reusing the fast-profile retry's own
   * floor keeps this the one answer to "is there enough time left to start a
   * fast-profile Grok call", asked from two different callers.
   */
  private hasBudgetForAnotherChapter(requestStartedAtMs: number): boolean {
    return getRemainingRequestBudgetMs(requestStartedAtMs) >= MIN_XAI_FALLBACK_TIMEOUT_MS;
  }

  /**
   * The failures for every chapter number from `fromChapterNumber` through
   * `requestedChapterCount`, recorded as skipped rather than attempted. Used
   * when the loop stops itself for want of budget instead of after a call
   * actually failed, so a partial batch still accounts for every chapter the
   * caller asked for.
   */
  private skippedChapterFailures(fromChapterNumber: number, requestedChapterCount: number): ChapterFailure[] {
    const skipped: ChapterFailure[] = [];

    for (let chapterNumber = fromChapterNumber; chapterNumber <= requestedChapterCount; chapterNumber++) {
      skipped.push({
        chapterNumber,
        message: 'Skipped: insufficient time remaining in this request to safely generate this chapter'
      });
    }

    return skipped;
  }

  private async callGrokAI(
    input: StoryGenerationSeam['input'],
    requestStartedAtMs: number,
    context?: LogContext,
    tropeSelection?: TropeSelection,
    chapterOptions?: ChapterGenerationOptions
  ): Promise<GeneratedTextResult> {
    const targetWordCount = chapterOptions
      ? Math.max(200, Math.ceil(input.wordCount / Math.max(1, chapterOptions.totalChapters)))
      : input.wordCount;

    if (!this.xaiClient.hasApiKey()) {
      if (this.isProductionRuntime()) {
        throw this.missingProviderError();
      }

      logWarn('No API key found, using mock generation', context);
      // Fallback to mock generation if no API key
      return {
        content: chapterOptions
          ? this.generateMockInitialChapter(input, chapterOptions.chapterNumber, targetWordCount)
          : this.generateMockStory(input, tropeSelection)
      };
    }

    // Not just the batch chapters: this call's own primary attempt is exposed
    // to the same platform SIGKILL if enough of the invocation's window is
    // already gone by the time it starts — a slow validation/setup step ahead
    // of it, or a deployment configuring a smaller `STORY_LAB_FUNCTION_BUDGET_MS`,
    // both leave less than `getXaiPrimaryTimeoutMs()` actually safe to spend.
    // Refusing here, the same way `xaiTextClient` refuses a fallback retry it
    // has no room for, keeps a doomed call from ever reaching axios with a
    // timeout of `0` — which axios reads as "no timeout" rather than "expired".
    const remainingBudgetMs = getRemainingRequestBudgetMs(requestStartedAtMs);
    if (remainingBudgetMs < MIN_XAI_FALLBACK_TIMEOUT_MS) {
      throw new Error('Insufficient time remaining in the request budget to safely generate this chapter');
    }

    const systemPrompt = this.buildSystemPrompt(input, tropeSelection, chapterOptions);
    const userPrompt = chapterOptions
      ? this.buildChapterUserPrompt(input, chapterOptions)
      : this.buildUserPrompt(input);
    const modelPreference = chapterOptions?.preferFastModel ? 'fast' : 'primary';
    try {
      logInfo('Calling Grok API', context, {
        maxTokens: this.calculateOptimalTokens(targetWordCount),
        chapterNumber: chapterOptions?.chapterNumber,
        totalChapters: chapterOptions?.totalChapters,
        modelPreference
      });

      const response = await this.xaiClient.generateText({
        operation: 'genesis',
        system: systemPrompt,
        user: userPrompt,
        maxOutputTokens: this.calculateOptimalTokens(targetWordCount),
        temperature: 0.8,
        topP: 0.95,
        timeoutMs: chapterOptions?.preferFastModel
          ? this.resolveBatchChapterTimeoutMs(remainingBudgetMs)
          : Math.min(getXaiPrimaryTimeoutMs(), remainingBudgetMs),
        fallbackTimeoutMs: chapterOptions?.preferFastModel
          ? getXaiFastTimeoutMs()
          : Math.min(getXaiFastTimeoutMs(), remainingBudgetMs),
        modelPreference,
        allowFallback: !chapterOptions?.preferFastModel,
        context
      });

      logPerformance('Grok API call', response.latencyMs, {
        ...context,
        promptTokens: response.usage?.inputTokens,
        completionTokens: response.usage?.outputTokens
      }, {
        model: response.model,
        reasoningEffort: response.reasoningEffort,
        chapterNumber: chapterOptions?.chapterNumber,
        totalChapters: chapterOptions?.totalChapters
      });

      return {
        content: formatStoryContent(response.text),
        aiMetadata: this.toAiCallMetadata(response)
      };

    } catch (error: any) {
      logApiError('Grok AI', error, context, {
        wordCount: targetWordCount,
        creature: input.creature,
        spicyLevel: input.spicyLevel,
        chapterNumber: chapterOptions?.chapterNumber
      });
      
      throw new Error('AI service temporarily unavailable');
    }
  }

  private async callGrokAIForContinuation(
    input: ChapterContinuationSeam['input'],
    requestStartedAtMs: number,
    context?: LogContext,
    chapterOptions?: ChapterGenerationOptions
  ): Promise<GeneratedTextResult> {
    if (!this.xaiClient.hasApiKey()) {
      if (this.isProductionRuntime()) {
        throw this.missingProviderError();
      }

      logWarn('No API key found, using mock chapter generation', context);
      return {
        content: this.generateMockChapter(input, chapterOptions?.chapterNumber)
      };
    }

    // See the matching check in `callGrokAI`: this call's own primary attempt
    // is exposed to the same platform SIGKILL as a batch chapter's, and a
    // refusal here keeps a doomed call from reaching axios with a timeout of
    // `0` — which axios reads as "no timeout" rather than "expired".
    const remainingBudgetMs = getRemainingRequestBudgetMs(requestStartedAtMs);
    if (remainingBudgetMs < MIN_XAI_FALLBACK_TIMEOUT_MS) {
      throw new Error('Insufficient time remaining in the request budget to safely generate this chapter');
    }

    const chapterNumber = chapterOptions?.chapterNumber ?? input.currentChapterCount + 1;
    const prompt = this.buildContinuationPrompt(input, chapterNumber, chapterOptions?.existingContent);
    const modelPreference = chapterOptions?.preferFastModel ? 'fast' : 'primary';

    try {
      logInfo('Calling Grok API for chapter continuation', context, {
        chapterNumber,
        totalChapters: chapterOptions?.totalChapters,
        modelPreference
      });

      const response = await this.xaiClient.generateText({
        operation: 'continuation',
        system: 'Continue this story in the same style and tone. Maintain character development, spice level, and plot progression. Keep the same supernatural atmosphere and romantic intensity. CRITICAL: Use [Character Name]: "dialogue" format for all speech and [Narrator]: for descriptive text to match the existing story format.',
        user: prompt,
        maxOutputTokens: this.calculateOptimalTokens(500),
        temperature: 0.8,
        topP: 0.95,
        timeoutMs: chapterOptions?.preferFastModel
          ? this.resolveBatchChapterTimeoutMs(remainingBudgetMs)
          : Math.min(getXaiPrimaryTimeoutMs(), remainingBudgetMs),
        fallbackTimeoutMs: chapterOptions?.preferFastModel
          ? getXaiFastTimeoutMs()
          : Math.min(getXaiFastTimeoutMs(), remainingBudgetMs),
        modelPreference,
        allowFallback: !chapterOptions?.preferFastModel,
        context
      });
      
      logPerformance('Grok API continuation call', response.latencyMs, {
        ...context,
        promptTokens: response.usage?.inputTokens,
        completionTokens: response.usage?.outputTokens
      }, {
        model: response.model,
        reasoningEffort: response.reasoningEffort,
        chapterNumber,
        totalChapters: chapterOptions?.totalChapters
      });

      return {
        content: formatChapterContent(response.text),
        aiMetadata: this.toAiCallMetadata(response)
      };

    } catch (error: any) {
      logApiError('Grok AI (Continuation)', error, context, {
        chapterNumber
      });
      
      throw new Error('AI service temporarily unavailable');
    }
  }

  private toAiCallMetadata(response: XaiTextResponse): AiCallMetadata {
    return {
      model: response.model,
      reasoningEffort: response.reasoningEffort,
      fallbackFromModel: response.fallbackFromModel
    };
  }

  private mergeAiMetadata(existing: AiCallMetadata | undefined, next: AiCallMetadata | undefined): AiCallMetadata | undefined {
    if (!next) {
      return existing;
    }

    const modelChanged = Boolean(next.model && existing?.model && next.model !== existing.model);

    return {
      model: next.model ?? existing?.model,
      reasoningEffort: next.reasoningEffort ?? (modelChanged ? undefined : existing?.reasoningEffort),
      fallbackFromModel: existing?.fallbackFromModel ?? next.fallbackFromModel
    };
  }

  /**
   * One of the twenty beat structures, drawn uniformly.
   *
   * The table moved to `shared/storyPromptTables`, where the Proving Grounds
   * preview reads it too: it had kept a character-for-character copy, which is
   * the arrangement that had already let the author banks drift apart.
   *
   * This took the whole blueprint as a parameter and read nothing out of it.
   * That is not a harmless extra argument on a private method: every structure
   * in that table carries a `spiceIntegration` line naming the spice levels and
   * themes it suits — "Perfect for Level 3-5 stories", "Mystery themes enhance
   * psychological tension", "Comedy themes can subvert expectations" — so a
   * signature taking the blueprint reads, from the one call site, as the
   * selection weighing them. It does not, and has not; a Level 1 story is as
   * likely to be told to write TEMPTATION CASCADE as a Level 5 one.
   *
   * Dropping the parameter is not a decision that the draw should stay
   * uniform. It states that it currently is, so a later change that wants the
   * blueprint to matter has to add the argument and thread it into the choice,
   * rather than finding it already there and assuming it is already read.
   */
  private getRandomBeatStructure(): string {
    // Select random structure
    const selectedStructure = STORY_BEAT_STRUCTURES[randomInt(STORY_BEAT_STRUCTURES.length)];

    return `SELECTED STRUCTURE: ${selectedStructure.name}
BEATS: ${selectedStructure.beats}
SPICE INTEGRATION: ${selectedStructure.spiceIntegration}
AVOID: ${selectedStructure.avoid}`;
  }

  private generateChekovElements(): string {
    // Select 2 random elements for this story using Fisher-Yates for uniform distribution.
    const shuffled = [...STORY_CHEKHOV_ELEMENTS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, STORY_CHEKHOV_ELEMENTS_PER_STORY);

    return formatChekhovLedger(selected);
  }

  private buildSystemPrompt(
    input: StoryGenerationSeam['input'],
    tropeSelection?: TropeSelection,
    chapterOptions?: { chapterNumber: number; totalChapters: number }
  ): string {
    // Get random author style selections for this generation
    const selectedStyles = selectRandomAuthorStyles(input.creature);
    const selectedBeatStructure = this.getRandomBeatStructure();
    
    const prompt = buildProductionSystemPrompt({
      dynamicStyleSelection: selectedStyles
        .map(style => `${style.author}: "${style.voiceSample}" | ${style.trait}`)
        .join('\n'),
      beatStructure: selectedBeatStructure,
      chapterScope: chapterOptions
        ? buildProductionChapterScopeBlock(chapterOptions.chapterNumber, chapterOptions.totalChapters)
        : undefined
    });

    return tropeSelection
      ? this.tropeService.enhancePromptWithSubversions(prompt, tropeSelection)
      : prompt;
  }

  private buildUserPrompt(input: StoryGenerationSeam['input']): string {
    const creatureName = getCreatureDisplayName(input.creature);
    const themesText = this.formatThemeContext(input);
    const spicyLabel = getSpicyLabel(input.spicyLevel);
    const chekovElements = this.generateChekovElements();
    const storyLabContext = this.formatStoryLabContext(input);

    return buildProductionUserPrompt({
      wordCount: String(input.wordCount),
      creature: creatureName,
      themes: themesText,
      spicyLabel,
      spicyLevel: String(input.spicyLevel),
      creativeDirectionLine: input.userInput ? `CREATIVE DIRECTION: ${input.userInput}` : '',
      storyLabContextLine: storyLabContext,
      chekhovLedger: chekovElements
    });
  }

  private formatThemeContext(input: StoryGenerationSeam['input']): string {
    const themeSeeds = this.getSafeStoryLabThemeSeeds(input);
    if (themeSeeds.length > 0) {
      return themeSeeds
        .map(theme => `${theme.label} (${theme.description})`)
        .join('; ');
    }

    const themes = Array.isArray(input.themes)
      ? input.themes.filter(theme => typeof theme === 'string' && theme.trim().length > 0)
      : [];

    return themes.join(', ');
  }

  private formatStoryLabContext(input: StoryGenerationSeam['input']): string {
    const context = input.generationContext;
    if (context?.source !== 'story_lab') {
      return '';
    }

    const lines = [
      '',
      'STORY LAB BLUEPRINT - FIRST-CLASS CREATIVE CONSTRAINTS:'
    ];

    const logline = this.limitStoryLabPromptText(context.logline, STORY_LAB_LOGLINE_MAX_LENGTH);
    if (logline) {
      lines.push(`- Logline: ${logline}`);
    }
    const tone = this.limitStoryLabPromptText(context.tone, STORY_LAB_TONE_MAX_LENGTH);
    if (tone) {
      lines.push(`- Narrative tone: ${this.formatBlueprintIdLabel(tone)}`);
    }
    const protagonistName = this.limitStoryLabPromptText(context.protagonistName, STORY_LAB_CHARACTER_NAME_MAX_LENGTH);
    if (protagonistName) {
      lines.push(`- Protagonist name: ${protagonistName}`);
    }
    const antagonistName = this.limitStoryLabPromptText(context.antagonistName, STORY_LAB_CHARACTER_NAME_MAX_LENGTH);
    if (antagonistName) {
      lines.push(`- Antagonist name or opposing force: ${antagonistName}`);
    }
    const worldDetails = this.limitStoryLabPromptText(context.worldDetails, STORY_LAB_WORLD_DETAILS_MAX_LENGTH);
    if (worldDetails) {
      lines.push(`- World details: ${worldDetails}`);
    }
    const narrativeDirectives = this.limitStoryLabPromptText(context.narrativeDirectives, STORY_LAB_NARRATIVE_DIRECTIVES_MAX_LENGTH);
    if (narrativeDirectives) {
      lines.push(`- Narrative directives: ${narrativeDirectives}`);
    }
    if (context.heatContract) {
      lines.push(`- Heat contract: adult readers only confirmed; tension mode ${this.formatBlueprintIdLabel(context.heatContract.tensionMode)}; boundary ${this.formatBlueprintIdLabel(context.heatContract.intimacyBoundary)}.`);
      const noGoContent = this.limitStoryLabPromptText(context.heatContract.noGoContent, STORY_LAB_NO_GO_CONTENT_MAX_LENGTH);
      if (noGoContent) {
        lines.push(`- No-go content: ${noGoContent}`);
      }
      lines.push('- Keep intimate material consensual and do not exceed the Heat Contract boundary.');
    }
    const themeSeeds = this.getSafeStoryLabThemeSeeds(input);
    if (themeSeeds.length) {
      lines.push('- Theme seed intent:');
      for (const theme of themeSeeds) {
        lines.push(`  * ${theme.label}: ${theme.description}`);
      }
    }

    lines.push('- Treat these blueprint fields as binding story intent, not as optional flavor.');
    return lines.join('\n');
  }

  private getSafeStoryLabThemeSeeds(input: StoryGenerationSeam['input']): Array<{ label: string; description: string }> {
    const rawSeeds: unknown[] = Array.isArray(input.generationContext?.themeSeeds)
      ? input.generationContext.themeSeeds
      : [];

    return rawSeeds
      .map(seed => {
        if (!seed || typeof seed !== 'object') {
          return null;
        }

        const candidate = seed as { label?: unknown; description?: unknown };
        const label = this.limitStoryLabPromptText(candidate.label, STORY_LAB_THEME_LABEL_MAX_LENGTH);
        const description = this.limitStoryLabPromptText(candidate.description, STORY_LAB_THEME_DESCRIPTION_MAX_LENGTH);
        return label && description ? { label, description } : null;
      })
      .filter((seed): seed is { label: string; description: string } => Boolean(seed))
      .slice(0, STORY_LAB_THEME_SEED_LIMIT);
  }

  /**
   * Read one blueprint free-text field down to what the prompt will carry.
   *
   * Every Story Lab field that reaches a prompt goes through here — the
   * logline, the tone, both character names, the world details, the narrative
   * directives, the Heat Contract's no-go list, and each theme seed's label and
   * description — so the cut this makes is the cut the model sees, on nine
   * fields at once.
   *
   * It was `compacted.slice(0, maxLength)`, which is the defect `textExcerpt`
   * was written for and names three earlier instances of: "Three places still
   * cut with `String.prototype.slice` and a number, and all three feed a model
   * rather than a screen." This is the fourth, and it is the widest of them.
   * `slice` counts UTF-16 code units, so a cut landing between the halves of a
   * surrogate pair leaves a lone surrogate in the prompt — nothing throws,
   * because `JSON.stringify` escapes it rather than refusing it, so the request
   * simply carries a character the reader never typed in place of the emoji or
   * astral-script character that was there. And a cut at an arbitrary offset
   * ends mid-word, so a world-detail field is handed to the model as a
   * fragment.
   *
   * `capAtWordBoundaryWithinCodeUnits` rather than `capAtWordBoundary` because
   * the caps these are measured against are the route's, and the route measures
   * them with `.length`: `parseStoryLabBlueprint` refuses a `logline` whose
   * `.length` is past 420. Cutting in code points here would let a field of
   * astral characters pass the route and be measured differently at the prompt,
   * which is the drift the shared limits exist to prevent. A code point is
   * still never split — an astral character costs two units and is taken whole
   * or not at all.
   *
   * `collapseWhitespace` is the same operation the trim-and-`\s+` this replaces
   * performed, read from the module that already holds it rather than spelled
   * out a fifth time.
   */
  private limitStoryLabPromptText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const compacted = collapseWhitespace(value);
    if (!compacted) {
      return undefined;
    }

    return capAtWordBoundaryWithinCodeUnits(compacted, maxLength);
  }

  /**
   * Write a blueprint id the way the prompt reads it: `slow_burn` becomes
   * `slow burn`.
   *
   * Named for the Heat Contract when the two contract fields were its only
   * callers, and the narrative tone one line above spelled the same
   * `split('_').join(' ')` out again rather than asking for it. Three fields
   * from three closed vocabularies, one reading.
   */
  private formatBlueprintIdLabel(value: string): string {
    return value.split('_').join(' ');
  }

  private buildChapterUserPrompt(
    input: StoryGenerationSeam['input'],
    options: { chapterNumber: number; totalChapters: number; existingContent?: string }
  ): string {
    const perChapterWordCount = Math.max(200, Math.ceil(input.wordCount / Math.max(1, options.totalChapters)));
    const basePrompt = this.buildUserPrompt(input);
    const [, ...restLines] = basePrompt.split('\n');
    const contextExcerpt = options.existingContent
      ? `PREVIOUS CHAPTER EXCERPT (for continuity, do not repeat verbatim):\n${createContextExcerpt(options.existingContent)}\n\n`
      : '';

    return `Write Chapter ${options.chapterNumber} of ${options.totalChapters} continuing the same supernatural romance saga.
Target length: approximately ${perChapterWordCount} words.
Ensure this chapter resolves one beat while planting intrigue for Chapter ${options.chapterNumber + 1}.
${contextExcerpt}${restLines.join('\n')}`;
  }

  private buildContinuationPrompt(
    input: ChapterContinuationSeam['input'],
    chapterNumber: number = input.currentChapterCount + 1,
    existingContentOverride?: string
  ): string {
    // Extract intelligent context from previous chapters
    const existingContent = existingContentOverride || input.existingContent;
    const characterNames = extractCharacterNames(existingContent);
    const lastChapterSummary = extractLastChapterSummary(existingContent);
    const activePlotThreads = extractPlotThreads(existingContent);
    const emotionalTone = analyzeEmotionalTone(existingContent);
    
    const prompt = `Continue this story as Chapter ${chapterNumber}.

CONTEXT FROM PREVIOUS CHAPTERS:
- Established Characters: ${characterNames.join(', ') || 'Continue developing existing characters'}
- Last Chapter Summary: ${lastChapterSummary}
- Active Plot Threads: ${activePlotThreads.join(', ') || 'Develop new complications'}
- Emotional Tone: ${emotionalTone}

CONTINUATION REQUIREMENTS:
1. Resolve or escalate the previous cliffhanger within first 100 words
2. Advance at least one relationship dynamic or plot thread
3. Introduce one new complication, revelation, or twist
4. Maintain character voices and established dynamics
5. Build tension toward a new cliffhanger for next chapter
6. Use same audio format: [Character Name]: "dialogue" and [Narrator]: descriptions

CLIFFHANGER VARIETY TARGETS:
- romantic_tension: unresolved desire, interrupted intimacy, or a choice that delays surrender
- plot_twist: a revelation that changes the meaning of the prior chapter
- danger: an immediate supernatural or emotional threat
- mystery: one answered clue opening a sharper question
- character_revelation: a hidden identity, past wound, or confession
- emotional_conflict: desire colliding with duty, fear, loyalty, or power
- End with the type that best fits this chapter, but avoid repeating the exact emotional shape of the prior ending.

${input.userInput ? `CREATIVE DIRECTION: ${input.userInput}` : ''}
${this.formatContinuationStoryLabContext(input.generationContext)}

PREVIOUS CHAPTER(S) FOR CONTINUITY:
${createContextExcerpt(existingContent)}

Write 400-600 words for this chapter. Use HTML: <h3> for chapter title, <p> for paragraphs, <em> for emphasis.`;

    if (!input.tropeMetadata) {
      return prompt;
    }

    const tropeSelection = this.tropeService.deserializeTropeSelection(input.tropeMetadata);
    return tropeSelection
      ? this.tropeService.enhanceContinuationPrompt(prompt, tropeSelection)
      : prompt;
  }

  private formatContinuationStoryLabContext(context: ChapterContinuationSeam['input']['generationContext']): string {
    if (context?.source !== 'story_lab' || !context.heatContract) {
      return '';
    }

    const lines = [
      '',
      'STORY LAB HEAT CONTRACT - CONTINUATION CONSTRAINTS:',
      `- Adult readers only confirmed; tension mode ${this.formatBlueprintIdLabel(context.heatContract.tensionMode)}; boundary ${this.formatBlueprintIdLabel(context.heatContract.intimacyBoundary)}.`
    ];

    if (context.heatContract.noGoContent?.trim()) {
      lines.push(`- No-go content: ${context.heatContract.noGoContent.trim()}`);
    }

    lines.push('- Keep continuation intimacy consensual and do not exceed the original Heat Contract boundary.');
    return lines.join('\n');
  }

  /**
   * Reject a story request the service cannot serve, without repeating what the
   * caller sent.
   *
   * Every branch below used to answer with `providedValue: input.<field>` — the
   * raw value, verbatim. That object is both returned to the caller as the
   * response `error` and passed to `logWarn` by `generateStory`, so it reaches
   * the console, the log buffer the debug panel reads, and whatever sink the
   * logger is wired to. Three of the fields carry caller text: `creature` and
   * `themes` are typed as closed sets but arrive as whatever a raw POST or a
   * query string held, and `userInput` is the reader's own prose.
   *
   * The `userInput` branch is the worst of the three, because the condition that
   * fires it is the text being too long: the one rejection that exists to keep
   * an oversized brief out of the request is the one that copied all of it into
   * the log. `redactSensitiveLogData` cannot help — it blanks a *key* named like
   * `userInput`, and this arrives under `providedValue` — and token redaction
   * removes credentials and URLs, not prose.
   *
   * The request line these rejections sit beside already solved this: it reports
   * `creature`, `themes`, and the numbers through `toLoggableCreature`,
   * `toLoggableThemes`, and `toLoggableNumber`, which repeat a value only when
   * it is on the contract's own allow-list. Reusing them here keeps the whole
   * diagnostic — which field was wrong, and what was wrong with it — while the
   * text stops travelling. Free text has no allow-list to be recognised against,
   * so `userInput` is reported by its length, which is the only part of it the
   * rule is about.
   */
  private validateStoryInput(input: StoryGenerationSeam['input']): any {
    // The vocabulary itself is `shared/creatureVocabulary`, so the list this
    // route refuses a request against is the list the picker offers rather than
    // a copy of it that a new creature would have to be added to twice.
    if (!input.creature || !isCreatureArchetype(input.creature)) {
      return {
        code: 'INVALID_INPUT',
        message: 'Invalid creature type',
        field: 'creature',
        providedValue: toLoggableCreature(input.creature),
        expectedType: 'CreatureType'
      };
    }

    if (!Array.isArray(input.themes) || input.themes.length > VALIDATION_RULES.themes.maxCount) {
      return {
        code: 'INVALID_INPUT',
        message: `Too many themes (max ${VALIDATION_RULES.themes.maxCount})`,
        field: 'themes',
        providedValue: toLoggableThemes(input.themes),
        expectedType: 'ThemeType[]'
      };
    }

    /**
     * The contents of the array, not only how many of them there are.
     *
     * This rule counted the themes and stopped, and the log line above the
     * generation says so — "the number of themes but not their contents, so the
     * array can hold [...]". `creature` two checks up is measured against its
     * closed set by `isCreatureArchetype`, and `themes` is typed as the same
     * kind of closed set: the eighteen `ThemeType` ids that
     * `VALIDATION_RULES.themes.allowedValues` names in this file's own rules
     * object. Nothing read that list on the way in.
     *
     * This is not a live hole, and the note is here so nobody later reads it as
     * one. The only caller of `generateStory` is `generateStoryLabGenesis`, and
     * it arrives through `toClassicGenerationInput`, which filters the
     * blueprint's seed ids through `isClassicStoryTheme` and substitutes
     * `DEFAULT_CLASSIC_THEME` when a batch names none of them — so the array
     * this method is handed today has already been made valid by its one
     * caller, and no request the app can assemble is refused by this rule. What
     * the rule changes is where the guarantee lives: a validator that declares
     * a closed set and checks only the length of it is trusting a filter three
     * modules away that nothing states it depends on.
     *
     * What it would cost to be wrong is why it is worth stating here rather
     * than left to that filter. `formatThemeContext` is where an unchecked
     * value lands: it keeps every non-empty string in the array and joins them
     * into the `THEMES` line of the Grok prompt, at whatever length arrived. So
     * a second caller — a restored classic route, a job runner, a test harness
     * driving the service directly — that passed a caller's array through would
     * put arbitrary caller text into a paid model call, and nothing between
     * here and the provider would notice. The evidence that this is the failure
     * mode rather than a hypothetical is in this repository's own fixtures:
     * `tests/story-service-improved.test.ts` had been generating stories with
     * `themes: ['romance', 'dark']` since it was written — two narrative
     * *tones*, neither of them one of the eighteen — and reached the prompt
     * builder every time with nothing to say so.
     *
     * A closed set needs no length cap: an id is either one of the eighteen or
     * it is not, so membership bounds the field more tightly than a number
     * could. `toLoggableThemes` — which the count rule above already uses, and
     * which reduces an unrecognised id to a count rather than printing caller
     * prose — is what reports the refusal, so the answer names the field
     * without quoting what was sent.
     */
    if (!input.themes.every(isClassicStoryTheme)) {
      return {
        code: 'INVALID_INPUT',
        message: 'Invalid theme',
        field: 'themes',
        providedValue: toLoggableThemes(input.themes),
        expectedType: 'ThemeType[]'
      };
    }

    // Through the table's own guard rather than the integer-plus-range check
    // this replaces, for the reason the word-count rule below reads its table:
    // a level is either one of the five or it is not, and membership says that
    // without depending on the scale staying contiguous and whole-numbered.
    // The refusal names the levels it checked rather than the ends of a range,
    // the way `formatChapterBatchSizeList` does for the batch sizes.
    if (!isSpicyLevel(input.spicyLevel)) {
      return {
        code: 'INVALID_INPUT',
        message: `Invalid spicy level (must be ${formatSpicyLevelList()})`,
        field: 'spicyLevel',
        providedValue: toLoggableNumber(input.spicyLevel),
        expectedType: 'SpicyLevel'
      };
    }

    // Through the table's own guard rather than `allowedValues as readonly
    // number[]`. The cast was there because the restated literal had no
    // relationship to the `WordCount` union to check against; the list and the
    // union are one table now, so the guard narrows instead of widening.
    if (!isSupportedWordCount(input.wordCount)) {
      return {
        code: 'INVALID_INPUT',
        message: 'Invalid word count',
        field: 'wordCount',
        providedValue: toLoggableNumber(input.wordCount),
        expectedType: 'WordCount'
      };
    }

    if (input.userInput !== undefined && input.userInput !== null) {
      // A non-string is checked for on its own rather than left to fail the
      // length rule. `[]` has a `length` of 0, so a caller who sent an array
      // under this name used to pass the rule and reach the prompt, where it is
      // interpolated as text; and any other non-string was rejected only by
      // accident, through a comparison against `undefined`.
      if (typeof input.userInput !== 'string') {
        return {
          code: 'INVALID_INPUT',
          message: 'User input must be a string',
          field: 'userInput',
          providedValue: UNRECOGNIZED_PARAMETER,
          expectedType: 'string'
        };
      }

      if (input.userInput.length > VALIDATION_RULES.userInput.maxLength) {
        return {
          code: 'INVALID_INPUT',
          message: `User input too long (max ${VALIDATION_RULES.userInput.maxLength} characters)`,
          field: 'userInput',
          // The length, not the text: this branch fires *because* the text is
          // long, so repeating it here is repeating the whole of an oversized
          // brief into the response and the log.
          providedValue: `${input.userInput.length} characters`,
          expectedType: 'string'
        };
      }
    }

    if (!this.isValidRequestedChapterCount(input.requestedChapterCount)) {
      return this.chapterCountRefusal(toLoggableNumber(input.requestedChapterCount));
    }

    return null;
  }

  /**
   * Whether a caller named a batch this service runs, checked against the table
   * rather than against a literal list written out here.
   *
   * `Number(count)` is kept because this seam takes a `number | undefined` and
   * a query-string caller can still arrive with a numeric string; the table
   * holds numbers, so the coercion has to happen before the membership test and
   * not inside it.
   */
  private isValidRequestedChapterCount(count?: number): boolean {
    return count === undefined || isChapterBatchSize(Number(count));
  }

  private normalizeChapterCount(count?: number): ChapterBatchSize {
    return clampToChapterBatchSize(count);
  }

  /** The batch sizes as a refusal names them, and as it types them. */
  private chapterCountRefusal(providedValue: unknown) {
    return {
      code: 'INVALID_INPUT' as const,
      message: `requestedChapterCount must be ${formatChapterBatchSizeList()}`,
      field: 'requestedChapterCount',
      providedValue,
      expectedType: CHAPTER_BATCH_SIZES.join(' | ')
    };
  }

  private renderChapterForAppend(chapter: Pick<Chapter, 'chapterNumber' | 'title' | 'content'>): string {
    const heading = `<h3>Chapter ${chapter.chapterNumber}: ${chapter.title}</h3>`;
    const sanitizedContent = chapter.content.replace(/^\s*<h3[^>]*>.*?<\/h3>\s*/i, '').trim();

    if (!sanitizedContent) {
      return heading;
    }

    return `${heading}\n\n${sanitizedContent}`;
  }

  private combineStoryContent(existing: string, addition: string): string {
    const trimmedAddition = addition.trim();
    if (!trimmedAddition) {
      return existing;
    }

    if (!existing || existing.trim().length === 0) {
      return trimmedAddition;
    }

    return `${existing.trim()}\n\n<hr>\n\n${trimmedAddition}`;
  }

  private generateMockStory(input: StoryGenerationSeam['input'], _tropeSelection?: TropeSelection): string {
    const creatureName = getCreatureDisplayName(input.creature);
    const spicyLabel = getSpicyLabel(input.spicyLevel);
    const targetBodyWords = Math.max(200, Math.floor(input.wordCount * 0.9));
    const paragraphs = [
      `In the shadowed alleys of Victorian London, Lady Arabella Worthington found herself drawn to the mysterious stranger who haunted her dreams. His eyes, crimson as fresh-spilled wine, held secrets that both terrified and exhilarated her.`,
      `"You shouldn't be here," he whispered, his voice like velvet over steel. But Arabella, with her corset straining against propriety and her heart pounding with forbidden desire, stepped closer.`,
      `The ${creatureName.toLowerCase()} prince revealed himself slowly, each layer of deception peeling away like the petals of a night-blooming flower. His touch was electric, sending sparks through her veins that made her gasp with a pleasure bordering on pain.`,
      `As the gas lamps flickered in the fog-shrouded streets, their bodies entwined in a dance as old as time itself. Arabella discovered that some hungers could never be satisfied, only temporarily sated.`,
      `The ${spicyLabel.toLowerCase()} intensity of their encounter left her breathless, her skin flushed and marked by his passionate embrace. She knew she should run, should scream for help, but the pull was too strong.`,
      `In that moment, Lady Arabella Worthington ceased to be a proper Victorian lady and became something far more dangerous - the willing consort of a creature of the night.`
    ];
    const expansionBeats = [
      `By midnight, the first complication arrived: a sealed note from her father's solicitor, warning that the family estate had been promised to a rival suitor by dawn. Arabella folded the paper into her glove and understood that desire had become a legal problem as much as a spiritual one.`,
      `The prince led her through a chapel whose saints had no faces, only silver mirrors polished by generations of terrified lovers. In every reflection she saw a different version of herself: obedient daughter, ruined bride, hungry accomplice, and queen of a country no mapmaker dared to draw.`,
      `Their bargain gained shape between them. He would protect her name from the men who wanted to trade it like property; she would carry his secret through the morning world, where daylight made every supernatural promise look like madness or scandal.`,
      `Arabella asked what he truly wanted, and the question changed the room. The prince smiled as if nobody had asked him that in a century. When he answered, his voice held more loneliness than seduction, and that frightened her more than the fangs.`,
      `The rival suitor found them near the river, flanked by constables and carrying a priest's black book. He called Arabella compromised, cursed, and stolen. She surprised herself by laughing, because every word he chose was smaller than what had actually happened to her.`,
      `The ${creatureName.toLowerCase()} did not attack. He offered terms with a courtier's restraint, each sentence wrapped in threat and etiquette. Arabella watched the men recoil from politeness sharpened into a weapon and realized power could enter a room without raising its voice.`,
      `When the first bell of dawn sounded, the prince weakened. The color drained from his mouth, and for one terrible second Arabella saw what eternity cost him. She could leave then. She could step into respectable daylight and pretend the night had been an illness.`,
      `Instead, she took his signet ring and pressed it into her palm until the crest left a mark. It was not a wedding vow, not yet, but it was evidence. By sunrise everyone would know Lady Arabella had chosen the scandal herself, and chosen it with a steady hand.`
    ];

    const renderBody = () => paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('\n\n');
    this.expandMockParagraphsToWordTarget(paragraphs, expansionBeats, targetBodyWords);

    return `<h3>The ${creatureName}'s Forbidden Passion</h3>

${renderBody()}

<p><em>This is a mock story generated without AI. Add XAI_API_KEY to use real AI generation.</em></p>`;
  }

  private generateMockInitialChapter(input: StoryGenerationSeam['input'], chapterNumber: number, targetWordCount: number): string {
    const creatureName = getCreatureDisplayName(input.creature);
    const baseTitle = chapterNumber === 1
      ? `The ${creatureName}'s Forbidden Passion`
      : `Secrets of the ${creatureName} - Part ${chapterNumber}`;
    const targetBodyWords = Math.max(160, Math.floor(targetWordCount * 0.9));
    const paragraphs = [
      `[Narrator]: Moonlight dripped across the manor's stone balustrades as whispers of destiny curled around our lovers. The ${creatureName.toLowerCase()} aristocrat studied their prey with patient hunger, weighing desire against the oaths that bound their bloodline.`,
      `[Narrator]: Each chapter in this mock sequence leans into danger, seduction, and supernatural stakes. Expect clandestine meetings beneath stained glass, confessions that scorch the night air, and the steady escalation of ${creatureName.toLowerCase()} power games.`,
      `[Narrator]: This placeholder chapter lets the application exercise multi-chapter flows without live Grok calls. In production the AI will weave bespoke intrigue, but here we provide atmospheric beats and a tidy cliffhanger.`,
      `[Narrator]: Just before dawn, a coded message slips beneath the chamber door promising either salvation or ruin. Our heroes must decide whether to follow it, setting up the next chapter's peril.`
    ];
    const expansionBeats = [
      `[Narrator]: Chapter ${chapterNumber} also tracks a concrete emotional turn. One lover asks for trust, the other asks for proof, and neither request can be answered without giving the enemy a weakness to exploit.`,
      `[Narrator]: A secondary bargain tightens the plot. Servants move through the halls with lowered eyes, carrying letters, keys, and warnings that make the romance feel watched from every doorway.`,
      `[Narrator]: By the end of the scene, the ${creatureName.toLowerCase()} power dynamic has changed hands. What began as pursuit becomes negotiation, and what looked like surrender becomes a deliberate tactical choice.`,
      `[Narrator]: The chapter closes with a visible consequence: a torn glove, a missing signet, a witness who should have been asleep. The next chapter has something specific to answer.`
    ];

    const renderBody = () => paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('\n\n');
    this.expandMockParagraphsToWordTarget(paragraphs, expansionBeats, targetBodyWords);

    return `<h3>Chapter ${chapterNumber}: ${baseTitle}</h3>

${renderBody()}`;
  }

  private generateMockChapter(input: ChapterContinuationSeam['input'], chapterNumber?: number): string {
    const nextNumber = chapterNumber ?? input.currentChapterCount + 1;
    const paragraphs = [
      `The morning light pierced through heavy velvet curtains, but Arabella felt no warmth from its golden rays. Instead, a strange energy coursed through her veins, awakening senses she never knew existed.`,
      `Every sound was amplified - the distant clip-clop of carriage horses, the rustle of leaves in the garden, even the steady beat of her own heart. And beneath it all, a hunger that gnawed at her very soul.`,
      `Her reflection in the mirror showed a woman transformed. Her skin glowed with an otherworldly luminescence, her eyes held a predatory gleam. The creature had given her a gift... or was it a curse?`,
      `As night fell once more, she waited impatiently for his return. The hours stretched like taffy, each minute an eternity of anticipation. When he finally appeared at her balcony, silent as a shadow, Arabella knew there was no turning back.`,
      `Their second encounter was even more intense than the first. His hands explored her body with a possessiveness that made her arch and cry out. The passion burned hotter, threatening to consume them both.`,
      `But in the aftermath, as they lay entwined in sweat-dampened sheets, Arabella began to question the true cost of her transformation. What price would she pay for eternal passion?`
    ];
    const expansionBeats = [
      `The answer did not arrive as a grand prophecy. It came as a practical problem: a servant waiting outside the door with breakfast she could no longer stomach, a visiting aunt asking why the curtains stayed drawn, and a letter sealed in black wax on the breakfast tray.`,
      `Arabella broke the seal with fingers that still remembered his touch. The note named three debts: the ring she had accepted, the rival she had humiliated, and the family name she had placed between herself and the creature who now owned half her future.`,
      `She tried to rehearse a lie for the household, but every version sounded like a child covering a broken vase. The truth was worse and steadier. She had chosen this, and choice made a stronger cage than force ever could.`,
      `When dusk returned, he found her in the library with ledgers spread across the floor. She had traced the estate's debts to a lender who used no human bank. The supernatural world had not seduced her away from danger; it had merely given danger better handwriting.`,
      `He reached for the papers, and she stopped him with one hand on his wrist. The gesture startled them both. Last night she had been prey, guest, lover, and fool by turns. Tonight she needed to become someone whose questions could not be dismissed.`,
      `The chapter turned when she named the cost out loud. If he wanted her beside him, he would answer like a partner, not a prince visiting a distraction. The silence after that sentence felt sharper than any kiss they had shared.`,
      `Outside, the first carriage rolled through the fog. Someone had come early, and whoever waited below carried enough authority to make every servant in the house fall quiet. Arabella looked at him and understood the next choice would have witnesses.`,
      `He offered her one escape. She refused it before he finished speaking, because escape had started to sound too much like being managed. Instead she took the black-wax letter, folded it into her bodice, and walked toward the stairs.`
    ];

    const renderBody = () => [
      ...paragraphs.map(paragraph => `<p>${paragraph}</p>`),
      '<p><em>This is a mock chapter generated without AI.</em></p>'
    ].join('\n\n');
    this.expandMockParagraphsToWordTarget(
      paragraphs,
      expansionBeats,
      MOCK_CONTINUATION_TARGET_BODY_WORDS,
      countWords(renderBody())
    );

    return `<h3>Chapter ${nextNumber}: The Deeper Shadows</h3>

${renderBody()}`;
  }

  private expandMockParagraphsToWordTarget(
    paragraphs: string[],
    expansionBeats: string[],
    targetBodyWords: number,
    initialWordCount = countWords(paragraphs.join(' '))
  ): void {
    const countedExpansionBeats = expansionBeats
      .map(beat => ({
        beat,
        wordCount: countWords(beat)
      }))
      .filter(({ wordCount }) => wordCount > 0);
    let bodyWordCount = initialWordCount;
    let beatIndex = 0;

    while (bodyWordCount < targetBodyWords && countedExpansionBeats.length > 0) {
      const nextBeat = countedExpansionBeats[beatIndex % countedExpansionBeats.length];
      paragraphs.push(nextBeat.beat);
      bodyWordCount += nextBeat.wordCount;
      beatIndex += 1;
    }
  }

  private generateTitle(input: StoryGenerationSeam['input']): string {
    const creatureName = getCreatureDisplayName(input.creature);
    return `The ${creatureName}'s Forbidden Passion`;
  }

  private generateChapterTitle(input: ChapterContinuationSeam['input']): string {
    return 'The Deeper Shadows';
  }

  private detectCliffhanger(content: string): boolean {
    return this.cliffhangerService.analyze(content).cliffhangerDetected;
  }

  private generateStoryId(): string {
    return `story_${randomUUID()}`;
  }

  private generateChapterId(): string {
    return `chapter_${randomUUID()}`;
  }

  private generateRequestId(): string {
    return `req_${randomUUID()}`;
  }
}
