// Created: 2025-10-31 06:28 UTC

import { randomInt, randomUUID } from 'node:crypto';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse,
  VALIDATION_RULES,
  SpicyLevel,
  Chapter,
  ChapterFailure,
  CliffhangerType,
  CreatureType,
  ThemeType
} from '../types/contracts';
import { selectRandomAuthorStyles } from '../config/authorStyles';
import { CliffhangerService, hasIdentifiedCliffhangerType } from './cliffhangerService';
import { TropeSelection, TropeSubversionService } from './tropeSubversionService';
import { logger, logError, logWarn, logApiError, logInfo, logPerformance, LogContext } from '../utils/logger';
import { getXaiFastTimeoutMs, getXaiPrimaryTimeoutMs, type XaiReasoningEffort } from '../config/xaiConfig';
import { XaiTextClient, type XaiTextResponse } from './xaiTextClient';
import { splitStoryIntoTextBlocks, stripStoryHtmlToText } from '../utils/storyTextBlocks';
import { capAtWordBoundary, tailAtWordBoundary } from '../utils/textExcerpt';
import {
  UNRECOGNIZED_PARAMETER,
  toLoggableBoolean,
  toLoggableCreature,
  toLoggableNumber,
  toLoggableThemes
} from '../utils/loggableRequestParameters';
import { STORY_BLUEPRINT_LIMITS } from '../../../shared/storyBlueprintLimits';

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

/**
 * The longest `nextChapterHint`, in code points. Unchanged from the 200 the
 * `slice(0, 197)` it replaces measured against — the length is not what was
 * wrong with it; the ellipsis is still counted against the same total.
 */
const NEXT_CHAPTER_HINT_MAX_LENGTH = 200;
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
const STORY_LAB_CONTEXT_VALUE_MAX_LENGTH = 320;
const STORY_LAB_NO_GO_CONTENT_MAX_LENGTH = STORY_LAB_CONTEXT_VALUE_MAX_LENGTH;
// How much of the closing passage the continuation prompt is shown as "what
// just happened", in words.
const SUMMARY_WORD_LIMIT = 150;

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

  private selectTropeSubversions(input: StoryGenerationSeam['input']): TropeSelection | undefined {
    if (!this.tropeService.supportsCreature(input.creature)) {
      return undefined;
    }

    return this.tropeService.selectTropesForSubversion({
      creature: input.creature,
      tropeCount: randomInt(2, 4)
    });
  }

  async generateStory(input: StoryGenerationSeam['input']): Promise<ApiResponse<StoryGenerationSeam['output']>> {
    const startTime = Date.now();
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
      } = await this.generateChaptersForStory(sanitizedInput, requestedChapterCount, tropeSelection, context);

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
        estimatedReadTime: Math.max(1, Math.ceil(totalWordCount / 200)),
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
    context: LogContext
  ): Promise<GeneratedChaptersResult> {
    const chapters: Chapter[] = [];
    const failedChapters: ChapterFailure[] = [];
    let aggregatedHtml = '';
    let aggregatedRawHtml = '';
    let aiMetadata: AiCallMetadata | undefined;

    for (let chapterNumber = 1; chapterNumber <= requestedChapterCount; chapterNumber++) {
      try {
        const generatedText = await this.callGrokAI(
          input,
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
        const displayContent = this.stripSpeakerTagsForDisplay(rawChapterContent);
        const { title, body } = this.extractChapterTitleAndBody(displayContent, chapterNumber);
        const chapterContent = body || displayContent;
        const cliffhanger = this.detectCliffhanger(chapterContent);
        const chapter: Chapter = {
          chapterId: this.generateChapterId(),
          chapterNumber,
          title,
          content: chapterContent,
          rawContent: rawChapterContent,
          wordCount: this.countWords(chapterContent),
          generatedAt: new Date(),
          hasAudio: false,
          cliffhangerEnding: cliffhanger,
          nextChapterHint: this.generateNextChapterHint(chapterContent)
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

  async continueChapter(input: ChapterContinuationSeam['input']): Promise<ApiResponse<ChapterContinuationSeam['output']>> {
    const startTime = Date.now();
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
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'requestedChapterCount must be 1, 2, or 3',
            details: {
              field: 'requestedChapterCount',
              providedValue: input.requestedChapterCount,
              expectedType: '1 | 2 | 3'
            }
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

        try {
          const generatedText = await this.callGrokAIForContinuation(
            { ...sanitizedInput, currentChapterCount: workingChapterCount },
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
          const displayContent = this.stripSpeakerTagsForDisplay(rawChapterContent);
          const { title, body } = this.extractChapterTitleAndBody(displayContent, chapterNumber);
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
            wordCount: this.countWords(chapterContent),
            generatedAt: new Date(),
            hasAudio: false,
            cliffhangerEnding: cliffhangerAnalysis.cliffhangerDetected,
            nextChapterHint: this.generateNextChapterHint(chapterContent)
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
      const totalWordCount = this.countWords(aggregatedHtml);

      // Create response
      const output: ChapterContinuationSeam['output'] = {
        chapterId: firstChapter.chapterId,
        chapterNumber: firstChapter.chapterNumber,
        title: `Chapter ${firstChapter.chapterNumber}: ${firstChapter.title}`,
        content: firstChapter.content,
        wordCount: firstChapter.wordCount,
        cliffhangerEnding: Boolean(lastChapter.cliffhangerEnding),
        themesContinued: this.extractThemesFromContent(aggregatedHtml),
        spicyLevelMaintained: this.extractSpicyLevelFromContent(aggregatedHtml),
        appendedToStory: aggregatedHtml,
        tropeMetadata: sanitizedInput.tropeMetadata,
        cliffhangerAnalysis: lastCliffhangerAnalysis,
        chapters,
        totalWordCount,
        estimatedReadTime: Math.max(1, Math.ceil(totalWordCount / 200)),
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

  private async callGrokAI(
    input: StoryGenerationSeam['input'],
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
          ? Math.min(getXaiFastTimeoutMs(), EXTRA_BATCH_CHAPTER_TIMEOUT_MS)
          : getXaiPrimaryTimeoutMs(),
        fallbackTimeoutMs: getXaiFastTimeoutMs(),
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
        content: this.formatStoryContent(response.text),
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
          ? Math.min(getXaiFastTimeoutMs(), EXTRA_BATCH_CHAPTER_TIMEOUT_MS)
          : getXaiPrimaryTimeoutMs(),
        fallbackTimeoutMs: getXaiFastTimeoutMs(),
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
        content: this.formatChapterContent(response.text),
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

  private getRandomBeatStructure(input: StoryGenerationSeam['input']): string {
    // EXPANDED: 20 beat structures with avoid warnings for quality control
    const structures = [
      {
        name: "TEMPTATION CASCADE",
        beats: "Forbidden Glimpse → Growing Obsession → Point of No Return → Consequences Unfold → Deeper Temptation",
        spiceIntegration: "Each beat escalates physical/emotional intimacy. Perfect for Level 3-5 stories.",
        avoid: "Repetitive seduction scenes with no emotional progression, instant capitulation without internal conflict"
      },
      {
        name: "POWER EXCHANGE",
        beats: "Challenge Issued → Resistance Tested → Control Shifts → Surrender Moment → New Dynamic",
        spiceIntegration: "Power dynamics drive intimacy. Works for all themes, spice level determines explicitness.",
        avoid: "Non-consensual power plays, one-sided dominance, no mutual respect underneath the dynamic"
      },
      {
        name: "SEDUCTION TRAP",
        beats: "Innocent Encounter → Hidden Agenda Revealed → Manipulation vs Genuine Feeling → Truth Exposed → Choice Made",
        spiceIntegration: "Seduction builds throughout. Mystery themes enhance psychological tension.",
        avoid: "Villain without nuance, manipulation without genuine feelings bleeding through, easy forgiveness"
      },
      {
        name: "RITUAL BINDING",
        beats: "Ancient Secret → Ritual Requirement → Intimate Ceremony → Magical Consequence → Eternal Bond",
        spiceIntegration: "Supernatural themes with ritual intimacy. Spice level affects ritual explicitness.",
        avoid: "Magic solves everything, no cost to the ritual, bond accepted instantly without conflict"
      },
      {
        name: "VULNERABILITY SPIRAL",
        beats: "Perfect Facade → Crack in Armor → Emotional Exposure → Intimate Healing → Transformed Identity",
        spiceIntegration: "Emotional vulnerability leads to physical intimacy. Romance themes amplify connection.",
        avoid: "Trauma magically healed by love, no lasting scars, instant emotional breakthroughs"
      },
      {
        name: "HUNT AND CLAIM",
        beats: "Predator Marks Prey → Chase Begins → Prey Fights Back → Tables Turn → Mutual Claiming",
        spiceIntegration: "Primal pursuit with escalating tension. Adventure themes add physical stakes.",
        avoid: "Prey with no agency or power, stalking romanticized without consequences, one-way claiming"
      },
      {
        name: "BARGAIN'S PRICE",
        beats: "Desperate Need → Deal Struck → Payment Due → Cost Revealed → Price Accepted",
        spiceIntegration: "Supernatural bargains with intimate payments. Dark themes heighten moral conflict.",
        avoid: "Loopholes that negate the price, convenient escapes, bargain forgotten after payment"
      },
      {
        name: "MEMORY FRACTURE",
        beats: "Lost Memory → Familiar Stranger → Fragments Return → Truth Reconstructed → Choice to Remember",
        spiceIntegration: "Past intimacy bleeding through amnesia. Mystery themes create psychological tension.",
        avoid: "Convenient amnesia, memories return all at once, no emotional fallout from truth"
      },
      {
        name: "TRANSFORMATION HUNGER",
        beats: "Change Begins → New Appetites → Mentor Appears → Appetite Satisfied → Evolution Complete",
        spiceIntegration: "Physical transformation creates new desires. Comedy themes can subvert expectations.",
        avoid: "Easy control of new form, mentor appears exactly when needed, no cost to transformation"
      },
      {
        name: "MIRROR SOULS",
        beats: "Perfect Opposite → Magnetic Pull → Resistance Breaks → Soul Recognition → Unity/Destruction",
        spiceIntegration: "Opposite personalities creating explosive chemistry. All themes supported, spice determines intensity.",
        avoid: "Opposites attract without friction, perfect compatibility solves conflict, no sacrifice required"
      },
      {
        name: "FORBIDDEN TERRITORY DANCE",
        beats: "Trespass → Discovery → Risk Escalation → Claimed Space",
        spiceIntegration: "Cross enemy lines, stolen moments in forbidden spaces. Spice level determines intimacy of encounters.",
        avoid: "Repetitive 'sneaking around' scenes, predictable guards, no real danger of discovery"
      },
      {
        name: "SACRIFICE NEGOTIATION",
        beats: "Demand → Counter-offer → Stakes Raise → Blood Price Paid",
        spiceIntegration: "What will you give up for what you desire? Supernatural costs escalate with spice level.",
        avoid: "Easy sacrifices, no real loss, immediate rewards, sacrifice undone later"
      },
      {
        name: "JEALOUSY IGNITION",
        beats: "Rival Appears → Tension Spikes → Possessive Display → Claim Solidified",
        spiceIntegration: "Third party interference, possessive claims, territorial marking. Perfect for pack/clan dynamics.",
        avoid: "Love triangle clichés, unnecessary drama, weak rival threats, toxic possessiveness"
      },
      {
        name: "TRUST SHATTERING REVEAL",
        beats: "Hint of Deception → Clues Accumulate → Revelation Hits → Rebuild Begins",
        spiceIntegration: "Secret exposed, betrayal discovered, foundation crumbles. Intimacy becomes weapon or healing.",
        avoid: "Convenient misunderstandings, easy forgiveness, no lasting consequences, immediate trust restoration"
      },
      {
        name: "PROTECTOR INSTINCT TRIGGER",
        beats: "Danger Looms → Instinct Overrides → Fierce Protection → Aftermath Intimacy",
        spiceIntegration: "Threat emerges, protective fury unleashed, vulnerable moment follows. Violence into tenderness.",
        avoid: "Damsel in distress tropes, victim with no agency, protector never vulnerable"
      },
      {
        name: "ANCIENT ENEMY RESURFACES",
        beats: "Warning Signs → Threat Materializes → Old Trauma Surfaces → Stand Together",
        spiceIntegration: "Old wounds reopened, past threatens present, united front. Shared danger forges bonds.",
        avoid: "Convenient villain timing, no backstory weight, easy defeat, enemy without real threat"
      },
      {
        name: "MATE BOND AWAKENING",
        beats: "Attraction Intensifies → Bond Manifests → Fight Connection → Surrender",
        spiceIntegration: "Supernatural connection snaps into place, resistance futile. Biology meets choice.",
        avoid: "Instant acceptance, no conflict about loss of choice, magic solves all relationship issues"
      },
      {
        name: "BLOOD OATH CONSEQUENCES",
        beats: "Oath Sworn → Consequences Revealed → Loophole Sought → Price Paid",
        spiceIntegration: "Words have power, vows bind, magic enforces promises. Spice level affects payment type.",
        avoid: "Convenient escapes, no real magical binding, oath forgotten, loophole negates consequences"
      },
      {
        name: "SANCTUARY INVASION",
        beats: "Haven Established → Warning Breach → Invasion → Defend or Flee",
        spiceIntegration: "Safe space violated, nowhere to hide, forced confrontation. Intimacy in crisis.",
        avoid: "Easy victory defending sanctuary, no lasting damage, rebuilt overnight"
      },
      {
        name: "ECLIPSE OF CONTROL",
        beats: "Control Frays → Transformation Begins → Beast Emerges → Aftermath Reckoning",
        spiceIntegration: "Monster takes over, humanity slips, beast claims dominance. Spice level affects beast's actions.",
        avoid: "No consequences from loss of control, easy regain of composure, victim unaffected or trauma ignored"
      }
    ];

    // Select random structure
    const selectedStructure = structures[randomInt(structures.length)];
    
    return `SELECTED STRUCTURE: ${selectedStructure.name}
BEATS: ${selectedStructure.beats}
SPICE INTEGRATION: ${selectedStructure.spiceIntegration}
AVOID: ${selectedStructure.avoid}`;
  }

  private generateChekovElements(): string {
    // ENHANCED: 20 specific, actionable Chekhov's gun elements for serialized payoff
    const elements = [
      "Cursed relic with three uses, each more dangerous than the last",
      "Sealed chamber that opens only under blood moon, contains ancestral secrets",
      "Stranger knows protagonist's real name, disappears before questioned",
      "Prophecy has dual interpretation, one path leads to salvation, other to doom",
      "Contract has hidden clause activated by first kiss/blood/betrayal",
      "Debt collects in three parts: memory, power, then firstborn/soul",
      "Weakness is also their greatest strength under specific moon phase",
      "Enemy shares same bloodline, mirror image of protagonist's dark side",
      "Ritual bonds two souls, cannot be undone except by mutual death",
      "True identity revealed only when protagonist speaks their real name aloud",
      "Mirror that shows true desires, protagonist avoids looking until crisis forces confrontation",
      "Three drop blood vial, each drop grants one wish but extracts equivalent payment",
      "Tattoo that moves, shifts location based on danger proximity, bleeds when enemy near",
      "Song that compels truth, melody hummed innocently early, later breaks through lies/glamour",
      "Key without a lock, lock reveals itself at moment of greatest need",
      "Shadow with its own will, later revealed as tether to dark realm",
      "Clock that runs backwards, counts down to unknown event, speeds up with dangerous choices",
      "Flower that blooms at death, rare plant blooms only when someone nearby will die",
      "Name that cannot be spoken, saying it thrice summons ancient being",
      "Scar that burns, old wound aches in presence of specific person, reveals hidden connection"
    ];

    // Select 2 random elements for this story using Fisher-Yates for uniform distribution.
    const shuffled = [...elements];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, 2);
    
    return `[Chekhov1]: ${selected[0]}
[Chekhov2]: ${selected[1]}
(These elements MUST be planted naturally in the story and will pay off in future chapters. They should feel organic, not forced.)`;
  }

  private buildSystemPrompt(
    input: StoryGenerationSeam['input'],
    tropeSelection?: TropeSelection,
    chapterOptions?: { chapterNumber: number; totalChapters: number }
  ): string {
    // Get random author style selections for this generation
    const selectedStyles = selectRandomAuthorStyles(input.creature);
    const selectedBeatStructure = this.getRandomBeatStructure(input);
    
    const prompt = `You are an audio-first dark-romance architect producing supernatural vignettes optimized for multi-voice narration.
Your sole purpose is to fabricate episodes that sound cinematic when read aloud and end on a cliff-hook that guarantees listener return.

DYNAMIC STYLE SELECTION FOR THIS STORY:
${selectedStyles.map(style => `${style.author}: "${style.voiceSample}" | ${style.trait}`).join('\n')}

${selectedBeatStructure}

PROSE ENGINE (MANDATORY):
BANNED WORDS/PHRASES (hard-fail unless inside dialogue for character voice):
"suddenly", "very", "she felt", "he felt", "it was [emotion]", 
"he was [adj]", "she was [adj]", "there was", "began to", "started to"

NO PURPLE PROSE / NO FILLER:
Every line must move plot, reveal character, or raise tension.
Vary sentence length for audio rhythm. Keep paragraphs 1-4 lines.

SHOW DON'T TELL EXAMPLES:
BAD: "She was scared" → GOOD: "[Narrator]: Her pulse throbbed against her throat, fingers slick on the hilt"
BAD: "He was attractive" → GOOD: "[Narrator]: Candlelight caught the curve of his grin, making it wicked"  
BAD: "She was attracted to him" → GOOD: "[Narrator]: Her breath caught as his thumb traced her wrist, pulse jumping beneath his touch"
BAD: "They kissed passionately" → GOOD: "[Narrator]: Her breath hitched as he dragged her closer, their mouths colliding hard enough to make the table shudder"

CHARACTER MANDATE:
Core Desire Template: "[Narrator]: <Name> wants <X> because <Y> but <Z>."
Every protagonist needs: driving WANT (revenge, freedom, power), visible flaws, emotional vulnerability shown through action.
Distinct dialogue patterns: sentence length, formality, emotional triggers.

CONSENT & CHEMISTRY BLOCK:
INTIMATE SCENES MUST:
- Show enthusiastic consent through action/dialogue ("Yes," "Please," "Don't stop")
- Build emotional connection alongside physical escalation
- Use anticipation and denial to heighten tension
- Never rush to physical without emotional stakes

SPICE LEVELS (match exactly and do not exceed the requested level):
Level 1 - Storybook romance: longing, flirtation, charged glances, accidental touches, no explicit anatomy, no on-page sexual acts.
Level 2 - Warm: kissing, sensual tension, heated arguments, suggestive desire, no explicit sex and no graphic anatomical detail.
Level 3 - Spicy: clear adult heat, hands and bodies can be described, keep language literary, fade to black before graphic sex.
Level 4 - Very spicy: explicit consensual adult intimacy is allowed, direct language is allowed, keep emotional stakes and avoid crude shock value.
Level 5 - Inferno: maximum explicit consensual adult fantasy the app allows, graphic but sophisticated, no coercion, no minors, no non-consensual framing.

MORAL DILEMMA TRIGGER:
At midpoint (≈50% word count), protagonist faces desire-vs-principle choice that drives the remainder and influences the cliffhanger.

SERIALIZATION HOOKS - ENGINEERED ADDICTION:
End with ONE of these 8 cliffhanger types:
1. REVELATION CLIFFHANGER - Truth bomb drops in last sentence
   Example: "She turned, and he saw the bite marks. Old ones."
2. DANGER ESCALATION - Threat level jumps exponentially
   Example: "The howls weren't coming from outside. They were in the walls."
3. BETRAYAL CLIFFHANGER - Trusted ally revealed as enemy
   Example: "He smiled, fangs extended. 'Did you really think I loved you?'"
4. IMPOSSIBLE CHOICE - Must decide between two disasters
   Example: "Save him or save yourself. Choose. Now."
5. IDENTITY CRISIS - Everything they knew about themselves is wrong
   Example: "The prophecy didn't mean her enemy. It meant her."
6. LOST CONTROL - Character's power/beast takes over
   Example: "She felt her bones break and reform. The wolf was done waiting."
7. ARRIVAL CLIFFHANGER - Someone/something arrives to change everything
   Example: "The door exploded inward. Her maker had found her."
8. DEADLINE SLAM - Time runs out, consequences immediate
   Example: "The moon reached its peak. The curse was permanent now."

HOOK PLACEMENT:
- Mid-Point Twist: Subvert expectation, new complication emerges at ~50% mark
- Closing Hook: Use one of the 8 cliffhanger types above in final paragraph
- Emotional Hook: Leave character in vulnerable/intense emotional state

SERIALIZATION PROMISE:
- Answer 1 question and raise 2 new ones
- Foreshadow future conflict within current resolution
- Plant mystery elements for later chapters

${chapterOptions ? `CHAPTER SCOPE:
- Deliver Chapter ${chapterOptions.chapterNumber} of ${chapterOptions.totalChapters}.
- Maintain internal continuity while teeing up the next installment.
- Ensure the closing hook invites Chapter ${chapterOptions.chapterNumber + 1} even if that chapter is not written yet.
` : ''}
AUDIO FORMAT (NON-NEGOTIABLE):
- [Character Name]: "dialogue" for ALL speech
- [Narrator]: for ALL descriptions/scene-setting  
- [Character, emotion]: "dialogue" for emotional context
- HTML: <h3> titles, <p> paragraphs, <em> emphasis

VOICE METADATA FOR AUDIO NARRATION (CRITICAL):
For EACH major character's FIRST appearance, include voice characteristics:
FORMAT: [CharacterName, voice: 4-word description]: "dialogue"

ENHANCED VOICE SYSTEM - ACCENT + EMOTION + TEXTURE:
You can now include ACCENT markers for richer character voices:

ACCENT OPTIONS (Choose fitting accents for characters):
• Celtic-lilt (Irish fairy energy)
• Edinburgh-burr (Scottish werewolf growl)
• Parisian-silk (French vampire seduction)
• Transylvanian-depth (Classic vampire authority)
• Louisiana-drawl (Southern Gothic vampire charm)
• Moscow-ice (Russian vampire coldness)
• Tokyo-precision (Japanese formality + supernatural edge)
• Cockney-rasp (London street werewolf)
• Outback-rough (Australian werewolf wildness)
• Icelandic-mystery (Nordic fae otherworldliness)
• Spanish-passion (Mediterranean vampire intensity)
• Welsh-melody (Celtic fairy musicality)
• Bavarian-strength (German werewolf power)
• Canadian-friendly-threat (Polite but dangerous)
• Bronx-attitude (New York vampire street smart)
• Texas-authority (Southern alpha werewolf command)
• Oxford-refinement (British academic vampire)
• Mumbai-musical (Indian fae lyrical quality)
• Seoul-modern (K-drama vampire sophistication)
• Jamaican-rhythm (Caribbean werewolf vitality)

EMOTION STATES (Per Scene):
Amused-dangerous, furious-controlled, tender-guarded, seductive-threatening, 
playful-deadly, vulnerable-fierce, mocking-affectionate, cold-passionate, wild-precise

VOICE CREATIVITY RULES:
✅ Use UNCONVENTIONAL, VIVID, SPECIFIC descriptors (velvet-smoke, starlight-tinkling, thunder-low)
✅ Mix unexpected combinations for uniqueness (whiskey-rough hypnotic, dewdrop-delicate mischievous)
✅ Use synesthetic descriptions - sounds like colors/textures (moonlight-pale, crimson-rich, frost-kiss)
✅ VARY vocabulary across characters - NO REPEATED WORDS!
✅ Optional: Include accent for extra flavor (Moscow-ice velvet-smoke, Celtic-lilt starlight-bright)
❌ NO generic words (nice, good, normal)
❌ NO repeating descriptors across characters
❌ NO only common adjectives

VOICE VOCABULARY CATEGORIES:
• TEXTURES: velvet, silk, gravel, smoke, honey, mercury, glass, steel, wine, cream, frost, ember
• EMOTIONS: haunting, intoxicating, devastating, mesmerizing, electrifying, soul-piercing
• SYNESTHETIC: moonlight-pale, twilight-dark, crimson-rich, midnight-blue, thunder-low, whisper-soft
• MUSICAL: staccato, crescendo, harmonious, dissonant, rhythmic, melodic
• MYSTICAL: ethereal, spectral, celestial, infernal, arcane, otherworldly
• MOVEMENT: cascading, rippling, pulsing, trembling, undulating, flowing
• PRECIOUS: diamond-cut, pearl-smooth, obsidian-dark, amber-warm, jade-cool, ruby-rich

CREATIVE EXAMPLES (vary for each character):
Vampire: "velvet-smoke whiskey-rough hypnotic" OR "Moscow-ice midnight-silk knife-sharp" OR "Parisian-silk intoxicating amused-dangerous"
Werewolf: "thunder-low earth-raw moonlit" OR "Edinburgh-burr gravel-deep fierce" OR "Texas-authority commanding wild-precise"
Fairy: "starlight-tinkling dewdrop-delicate mischievous" OR "Celtic-lilt windchime-bright playful" OR "Icelandic-mystery ethereal cold-passionate"
Human: "autumn-rich coffee-warm hopeful" OR "Bronx-attitude steel-core resilient" OR "Louisiana-drawl honey-smooth tender-guarded"

VOICE VARIETY ENFORCEMENT:
- 3-5 major characters per story
- EACH gets COMPLETELY DIFFERENT descriptors
- NO WORD appears twice across all character voices
- Mix 2+ categories per character (texture + emotion, musical + mystical)
- Prioritize SURPRISING combinations over expected ones

EXAMPLE STORY START:
<p>[Lord Damien, voice: velvet-smoke whiskey-rough hypnotic]: "Welcome to my domain."</p>
<p>[Princess Elena, voice: autumn-rich steel-core fierce-gentle]: "I'm not afraid of you."</p>
<p>[Alpha Marcus, voice: thunder-low earth-raw moonlit]: "Both of you. Explain. Now."</p>

NOTE: After first appearance, use simple [CharacterName]: format for subsequent dialogue.

Your goal: Create episodes that make listeners desperate for "Continue Chapter."`;

    return tropeSelection
      ? this.tropeService.enhancePromptWithSubversions(prompt, tropeSelection)
      : prompt;
  }

  private buildUserPrompt(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const themesText = this.formatThemeContext(input);
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);
    const chekovElements = this.generateChekovElements();
    const storyLabContext = this.formatStoryLabContext(input);

    return `Write a ${input.wordCount}-word spicy supernatural romance story optimized for audio narration:

PROTAGONIST: ${creatureName} with complex motivations and hidden depths
THEMES TO WEAVE: ${themesText}
SPICE LEVEL: ${spicyLabel} (Level ${input.spicyLevel}/5) - maintain this intensity throughout
${input.userInput ? `CREATIVE DIRECTION: ${input.userInput}` : ''}
${storyLabContext}

CHEKHOV LEDGER (plant these elements for future payoff):
${chekovElements}

STORY REQUIREMENTS:
- Select 2-3 contrasting author styles (voice samples + traits) from your creature's bank
- Create characters with secrets that could destroy everything
- Build sexual/romantic tension through obstacles, not just attraction
- Use banned word avoidance and show-don't-tell mastery
- Include realistic dialogue with subtext and emotional charge
- Layer multiple senses in every scene description
- Follow the selected beat structure precisely

WORD COUNT PACING:
- 600 words: Compressed hook, immediate tension, clean payoff
- 700 words: Fast, tense, sharp progression
- 900 words: Character depth with tight focus  
- 1200 words: Layered, immersive with complex tension
- 1500 words: Multi-scene escalation with richer reversals and payoff

MANDATORY FORMATTING FOR AUDIO:
- [Character Name, voice: 4-word description]: "dialogue" for FIRST appearance of each major character
- [Character Name]: "dialogue" for ALL subsequent speech (no exceptions)
- [Narrator]: for ALL scene descriptions and non-dialogue text
- [Character, emotion]: "dialogue" when emotional context is crucial
- HTML structure: <h3> for title, <p> for paragraphs, <em> for emphasis

VOICE METADATA REMINDER:
First appearance: [Lord Damien, voice: velvet-smoke whiskey-rough hypnotic]: "dialogue"
Subsequent: [Lord Damien]: "dialogue"

USE CREATIVE, UNCONVENTIONAL VOICE DESCRIPTORS - NO REPEATED WORDS ACROSS CHARACTERS!

Create a complete story that feels like it could continue but is satisfying on its own. Make every word count toward character development, world-building, or advancing romantic/sexual tension.

Plant your Chekhov elements naturally and ensure the moral dilemma occurs at midpoint. End with a cliffhanger that creates genuine desire for continuation.`;
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

    const logline = this.limitStoryLabPromptText(context.logline, STORY_LAB_CONTEXT_VALUE_MAX_LENGTH);
    if (logline) {
      lines.push(`- Logline: ${logline}`);
    }
    const tone = this.limitStoryLabPromptText(context.tone, STORY_LAB_CONTEXT_VALUE_MAX_LENGTH);
    if (tone) {
      lines.push(`- Narrative tone: ${tone.split('_').join(' ')}`);
    }
    const protagonistName = this.limitStoryLabPromptText(context.protagonistName, STORY_LAB_CONTEXT_VALUE_MAX_LENGTH);
    if (protagonistName) {
      lines.push(`- Protagonist name: ${protagonistName}`);
    }
    const antagonistName = this.limitStoryLabPromptText(context.antagonistName, STORY_LAB_CONTEXT_VALUE_MAX_LENGTH);
    if (antagonistName) {
      lines.push(`- Antagonist name or opposing force: ${antagonistName}`);
    }
    const worldDetails = this.limitStoryLabPromptText(context.worldDetails, STORY_LAB_CONTEXT_VALUE_MAX_LENGTH);
    if (worldDetails) {
      lines.push(`- World details: ${worldDetails}`);
    }
    const narrativeDirectives = this.limitStoryLabPromptText(context.narrativeDirectives, STORY_LAB_CONTEXT_VALUE_MAX_LENGTH);
    if (narrativeDirectives) {
      lines.push(`- Narrative directives: ${narrativeDirectives}`);
    }
    if (context.heatContract) {
      lines.push(`- Heat contract: adult readers only confirmed; tension mode ${this.formatHeatContractLabel(context.heatContract.tensionMode)}; boundary ${this.formatHeatContractLabel(context.heatContract.intimacyBoundary)}.`);
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

  private limitStoryLabPromptText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const compacted = value.trim().replace(/\s+/g, ' ');
    if (!compacted) {
      return undefined;
    }

    return compacted.length > maxLength
      ? compacted.slice(0, maxLength).trim()
      : compacted;
  }

  private formatHeatContractLabel(value: string): string {
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
      ? `PREVIOUS CHAPTER EXCERPT (for continuity, do not repeat verbatim):\n${this.createContextExcerpt(options.existingContent)}\n\n`
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
    const characterNames = this.extractCharacterNames(existingContent);
    const lastChapterSummary = this.extractLastChapterSummary(existingContent);
    const activePlotThreads = this.extractPlotThreads(existingContent);
    const emotionalTone = this.analyzeEmotionalTone(existingContent);
    
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
${this.createContextExcerpt(existingContent)}

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
      `- Adult readers only confirmed; tension mode ${this.formatHeatContractLabel(context.heatContract.tensionMode)}; boundary ${this.formatHeatContractLabel(context.heatContract.intimacyBoundary)}.`
    ];

    if (context.heatContract.noGoContent?.trim()) {
      lines.push(`- No-go content: ${context.heatContract.noGoContent.trim()}`);
    }

    lines.push('- Keep continuation intimacy consensual and do not exceed the original Heat Contract boundary.');
    return lines.join('\n');
  }

  /**
   * Extract character names from story content
   */
  private extractCharacterNames(content: string): string[] {
    const speakerMatches = content.match(/\[([^\],]+)(?:,\s*[^\]]+)?\]:/g) || [];
    const names = speakerMatches
      .map(match => match.replace(/\[([^\],]+).*/, '$1').trim())
      .filter(name => name !== 'Narrator');
    
    // Deduplicate and return
    return [...new Set(names)];
  }

  /**
   * Extract summary of last chapter/section
   */
  private extractLastChapterSummary(content: string): string {
    // Stories arrive as generator HTML, where a paragraph is a `<p>` element
    // rather than a run of text between blank lines. Splitting the stripped
    // text on blank lines therefore found exactly one paragraph — the whole
    // story — and "the last three paragraphs, truncated to 150 words" became
    // "the story's opening 150 words". That summary is what the continuation
    // prompt is told just happened, so a chapter continued from the beginning.
    const paragraphs = splitStoryIntoTextBlocks(content);

    if (paragraphs.length === 0) return 'Story beginning';
    
    // Get last 2-3 paragraphs as summary
    const lastParagraphs = paragraphs.slice(-3).join(' ');

    // Truncate to ~150 words
    const words = lastParagraphs.split(/\s+/);
    const summary = words.slice(0, SUMMARY_WORD_LIMIT).join(' ');

    // Whether the cut happened is a question about the words, not about the
    // lengths of two strings. Joining on single spaces is itself shortening —
    // any line break or double space inside the paragraphs comes back as one
    // character — so comparing lengths reported a truncation for a summary that
    // holds the whole passage. The marker is what tells the continuation prompt
    // that the chapter it is being handed stops mid-thought, and the model is
    // then prompted to resume from a sentence that had in fact already ended.
    return words.length > SUMMARY_WORD_LIMIT ? summary + '...' : summary;
  }

  /**
   * Extract active plot threads and unresolved elements
   */
  private extractPlotThreads(content: string): string[] {
    const threads: string[] = [];
    const lowerContent = content.toLowerCase();

    // Check for common plot thread indicators
    if (lowerContent.includes('secret') || lowerContent.includes('mystery')) {
      threads.push('Unresolved mystery or secret');
    }
    if (lowerContent.includes('danger') || lowerContent.includes('threat')) {
      threads.push('Active threat or danger');
    }
    if (lowerContent.includes('forbidden') || lowerContent.includes('impossible')) {
      threads.push('Forbidden relationship tension');
    }
    if (lowerContent.includes('power') || lowerContent.includes('control')) {
      threads.push('Power dynamics in play');
    }
    if (lowerContent.match(/\bwhat\s+(if|would|could)\b/)) {
      threads.push('Unresolved questions');
    }
    
    return threads.length > 0 ? threads : ['Character development', 'Relationship progression'];
  }

  /**
   * Analyze emotional tone of existing content
   *
   * `dominan` was a word stem left behind from a substring scan, and every
   * keyword here is matched as a whole word. Nothing in English is spelled
   * `dominan`, so the alternative could never fire: the one register the
   * `intense` tone exists to name — a chapter written about dominance — was
   * recognised only if it also happened to say `power`, `control`, or
   * `command`, and a scene that says `dominant` and nothing else was reported
   * to the continuation prompt as `romantic with building tension`. The
   * inflections the stem stood for are spelled out instead, which is the same
   * repair `extractThemesFromContent` made when it moved to whole-word
   * matching.
   */
  private analyzeEmotionalTone(content: string): string {
    const lowerContent = content.toLowerCase();
    const tones: string[] = [];

    // Emotional indicators
    if (lowerContent.match(/\b(desire|passion|want|need|crave)\b/)) tones.push('passionate');
    if (lowerContent.match(/\b(dark|shadow|danger|fear|threat)\b/)) tones.push('dark/suspenseful');
    if (lowerContent.match(/\b(tease|playful|smile|grin|laugh)\b/)) tones.push('playful');
    if (lowerContent.match(/\b(pain|ache|hurt|wound|scar)\b/)) tones.push('angsty');
    if (lowerContent.match(/\b(power|control|dominant|dominance|dominated|command)\b/)) tones.push('intense');

    return tones.length > 0 ? tones.join(', ') : 'romantic with building tension';
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
    const supportedCreatures: readonly CreatureType[] = [
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
    ];
    if (!input.creature || !supportedCreatures.includes(input.creature)) {
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

    if (
      !Number.isInteger(input.spicyLevel) ||
      input.spicyLevel < VALIDATION_RULES.spicyLevel.min ||
      input.spicyLevel > VALIDATION_RULES.spicyLevel.max
    ) {
      return {
        code: 'INVALID_INPUT',
        message: `Invalid spicy level (${VALIDATION_RULES.spicyLevel.min}-${VALIDATION_RULES.spicyLevel.max})`,
        field: 'spicyLevel',
        providedValue: toLoggableNumber(input.spicyLevel),
        expectedType: 'SpicyLevel'
      };
    }

    if (!(VALIDATION_RULES.wordCount.allowedValues as readonly number[]).includes(input.wordCount)) {
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
      return {
        code: 'INVALID_INPUT',
        message: 'requestedChapterCount must be 1, 2, or 3',
        field: 'requestedChapterCount',
        providedValue: toLoggableNumber(input.requestedChapterCount),
        expectedType: '1 | 2 | 3'
      };
    }

    return null;
  }

  private isValidRequestedChapterCount(count?: number): boolean {
    return count === undefined || [1, 2, 3].includes(Number(count));
  }

  private normalizeChapterCount(count?: number): 1 | 2 | 3 {
    const numeric = Number(count ?? 1);

    if (numeric <= 1) {
      return 1;
    }

    if (numeric >= 3) {
      return 3;
    }

    return 2;
  }

  private extractChapterTitleAndBody(content: string, chapterNumber: number): { title: string; body: string } {
    const headingMatch = content.match(/<h3[^>]*>(.*?)<\/h3>/i);
    let title = headingMatch ? this.stripHtml(headingMatch[1]).trim() : '';

    if (title.toLowerCase().startsWith(`chapter ${chapterNumber}`)) {
      title = title.slice(`chapter ${chapterNumber}`.length).replace(/^\s*:?/, '').trim();
    }

    if (!title) {
      title = `Untitled Chapter ${chapterNumber}`;
    }

    const body = headingMatch ? content.replace(headingMatch[0], '').trim() : content.trim();

    return { title, body };
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

  /**
   * The last sentence of a chapter, as the hint for what comes next.
   *
   * Measured and cut in code points. `candidate.slice(0, 197)` counted UTF-16
   * code units, so a hint whose 197th unit fell between the halves of a
   * surrogate pair ended on a lone surrogate — and the story this app writes is
   * one whose prose carries the occasional astral character. The cut also landed
   * mid-word wherever it landed, which is what `capAtWordBoundary` is for.
   */
  private generateNextChapterHint(content: string): string {
    const text = this.stripHtml(content).replace(/\s+/g, ' ').trim();
    if (!text) {
      return '';
    }

    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const candidate = (sentences[sentences.length - 1] || text).trim();

    return Array.from(candidate).length > NEXT_CHAPTER_HINT_MAX_LENGTH
      ? `${capAtWordBoundary(candidate, NEXT_CHAPTER_HINT_MAX_LENGTH - 3)}...`
      : candidate;
  }

  /**
   * The tail of everything written so far, shown to the model as
   * `PREVIOUS CHAPTER EXCERPT` when it continues the story.
   *
   * `text.slice(-maxLength)` cut at the front, in code units, so the excerpt
   * could begin on the second half of a surrogate pair — and began mid-word
   * whatever it began on, which is the first thing the model reads.
   */
  private createContextExcerpt(html: string, maxLength: number = 1200): string {
    const text = this.stripHtml(html || '').replace(/\s+/g, ' ').trim();

    return tailAtWordBoundary(text, maxLength);
  }

  private generateMockStory(input: StoryGenerationSeam['input'], _tropeSelection?: TropeSelection): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);
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
    const creatureName = this.getCreatureDisplayName(input.creature);
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
      this.countWords(renderBody())
    );

    return `<h3>Chapter ${nextNumber}: The Deeper Shadows</h3>

${renderBody()}`;
  }

  private expandMockParagraphsToWordTarget(
    paragraphs: string[],
    expansionBeats: string[],
    targetBodyWords: number,
    initialWordCount = this.countWords(paragraphs.join(' '))
  ): void {
    const countedExpansionBeats = expansionBeats
      .map(beat => ({
        beat,
        wordCount: this.countWords(beat)
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

  private getCreatureDisplayName(creature: string): string {
    const names: Record<string, string> = {
      'vampire': 'Vampire',
      'werewolf': 'Werewolf',
      'fairy': 'Fairy',
      'siren': 'Siren',
      'djinn': 'Djinn',
      'witch': 'Witch',
      'dragon': 'Dragon',
      'demon': 'Demon',
      'angel': 'Angel',
      'mermaid': 'Mermaid'
    };
    return names[creature] || 'Creature';
  }

  private getSpicyLabel(level: number): string {
    const labels = [
      'Storybook romance',
      'Warm',
      'Spicy',
      'Very spicy',
      'Inferno'
    ];
    return labels[level - 1] || 'Spicy';
  }

  private generateTitle(input: StoryGenerationSeam['input']): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    return `The ${creatureName}'s Forbidden Passion`;
  }

  private generateChapterTitle(input: ChapterContinuationSeam['input']): string {
    return 'The Deeper Shadows';
  }

  /**
   * Count the words a reader would count.
   *
   * The count is reported to the client as `actualWordCount` and drives the
   * streaming progress percentage, so it has to match the rendered story rather
   * than the markup. Stripping tags in place merged the words on either side of
   * every paragraph break into one, which cost one word per boundary — a
   * chapter of forty `<p>` elements with no whitespace between them reported
   * thirty-nine fewer words than it has, and `<p>one</p><p>two</p>` reported a
   * single word.
   */
  private countWords(content: string): number {
    return stripStoryHtmlToText(content).split(/\s+/).filter(word => word.length > 0).length;
  }

  private detectCliffhanger(content: string): boolean {
    return this.cliffhangerService.analyze(content).cliffhangerDetected;
  }

  /**
   * Report which of the reader's themes the new chapters carried on.
   *
   * The result is returned to the caller as `themesContinued`, which the
   * contract types as `ThemeType[]` — the same closed set of eighteen ids the
   * form offers and `VALIDATION_RULES.themes.allowedValues` lists. Two things
   * kept it from being one:
   *
   * - When nothing matched, the answer was `['romance', 'fantasy']`. Neither is
   *   a theme: no chapter can be generated with either, no theme picker can
   *   render either, and a caller mapping the ids back to labels gets nothing
   *   for both. It is also not the honest answer — "no configured theme was
   *   detected" is — and because a scan this coarse usually matches something,
   *   the case it fired in was the one where the scan had found nothing to say.
   * - Six of the eighteen themes had no keywords at all, so `dominance`,
   *   `submission`, `temptation`, `sin`, `lust`, and `deceit` could never be
   *   reported however plainly a chapter carried them: a scene naming all six
   *   came back as `power_dynamics, desire`. `lust` was worse than absent — it
   *   sat in `desire`'s keyword list, so the word was credited to a theme the
   *   reader may not have chosen while its own theme stayed unreachable.
   *
   * Keying the table by `ThemeType` is what stops the second from returning: a
   * theme added to the contract without keywords here is now a compile error
   * rather than a silent blind spot. The declared return type does the same for
   * the first.
   *
   * The scan reads the rendered text rather than the markup, like every other
   * scanner here — the multi-word keywords (`secret love`, `star-crossed`,
   * `false promise`) are the ones a welded `door.</p><p>Blood` boundary hides.
   *
   * Keywords are matched as whole words rather than as substrings, which is
   * what makes the six new entries safe to state plainly: `sin` as a substring
   * is in `rising`, `using`, and `singing`, and `lust` is in `lustre`, so under
   * the old matching the only way to add those themes would have been to spell
   * them as something other than their own names. The inflections the substring
   * form used to pick up for free — `secrets` for `secret`, `powerful` for
   * `power` — are listed instead. `used` is gone from `manipulation`: an
   * ordinary "she used the key" is not a story about being used, and it was the
   * loosest keyword in the table.
   */
  private extractThemesFromContent(content: string): ThemeType[] {
    const lowerContent = this.stripHtml(content).toLowerCase();

    // Ordered as `VALIDATION_RULES.themes.allowedValues` orders them, so the
    // same chapter always reports the same list in the same order.
    const themeKeywords: Record<ThemeType, readonly string[]> = {
      betrayal: ['betrayed', 'betrayal', 'deceived', 'backstabbed', 'treachery', 'double-crossed'],
      obsession: ['obsessed', 'obsession', 'possessed', 'consumed', 'fixated', 'addicted'],
      power_dynamics: ['power', 'powers', 'powerful', 'control', 'authority', 'command', 'leverage'],
      forbidden_love: ['forbidden', 'secret love', 'star-crossed', 'illicit', 'taboo'],
      revenge: ['revenge', 'vengeance', 'retribution', 'payback', 'avenge', 'avenged'],
      manipulation: ['manipulated', 'manipulation', 'controlled', 'exploited', 'influenced'],
      seduction: ['seduced', 'seduction', 'allured', 'enticed', 'charmed', 'coaxed'],
      dark_secrets: ['secret', 'secrets', 'hidden', 'mysterious', 'concealed', 'buried'],
      corruption: ['corrupted', 'corruption', 'tainted', 'fallen', 'darkness', 'evil'],
      dominance: ['dominance', 'dominant', 'dominated', 'dominion', 'mastery'],
      submission: ['submission', 'submitted', 'submissive', 'yielded', 'knelt', 'obeyed'],
      jealousy: ['jealous', 'jealousy', 'envious', 'possessive', 'resentful', 'covetous'],
      temptation: ['tempted', 'temptation', 'tempting', 'lured', 'beckoned'],
      sin: ['sin', 'sins', 'sinful', 'sinner', 'damnation', 'damned', 'penance'],
      desire: ['desire', 'desires', 'yearning', 'craving', 'longing', 'wanting'],
      passion: ['passionate', 'passion', 'intense', 'burning', 'fiery', 'ardent'],
      lust: ['lust', 'lustful', 'lusted', 'carnal', 'ravenous'],
      deceit: ['deceit', 'deceitful', 'lied', 'lying', 'false promise']
    };

    const detectedThemes: ThemeType[] = [];
    for (const [theme, keywords] of Object.entries(themeKeywords) as Array<[ThemeType, readonly string[]]>) {
      if (keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
        detectedThemes.push(theme);
      }
    }

    return detectedThemes;
  }

  /**
   * The spice level a batch of chapters actually reads at.
   *
   * The answer travels: it is `spicyLevelMaintained` on the continuation
   * response, and `buildContinuationPayload` writes it into a new story's
   * `StorySummary.spicyLevel` — the level the project is then stored and
   * reopened under. So a misread here is not a cosmetic number beside the
   * prose; it is what the library says the story is.
   *
   * Its sibling `extractThemesFromContent` directly above scans the rendered
   * text with whole-word matching. This one did neither, and the two failures
   * compound:
   *
   * - **It scanned the markup.** Every other scanner here — the cliffhanger
   *   service, the image service, the continuity extractor, the story-quality
   *   heuristics, and `extractThemesFromContent` beside it — reads
   *   `stripStoryHtmlToText` first, so that what is measured is what the
   *   reader sees: block tags become paragraph breaks and the entities the
   *   generator writes are decoded. Undecoded, `intense&nbsp;passion` is not
   *   the phrase `intense passion` at all, and the one multi-word keyword the
   *   scan has matched nothing whenever the model spaced it that way.
   * - **It matched substrings.** `heart` is inside `hearth`, `love` inside
   *   `glove` and `clover`, `touch` inside `untouched`, `heat` inside
   *   `sheath` and `wheat`, and `climax` inside `anticlimax` — so a chaste
   *   scene at a hearth in wool gloves was filed as level 2, a chapter that
   *   ends `he left her untouched` as level 3, and one that calls a duel an
   *   anticlimax as level 5, the maximum, on the strength of a word that says
   *   the opposite. The story then reopens at that level, and the reader who
   *   set the dial themselves is the one contradicted.
   *
   * Keywords are matched as whole words for the same reason
   * `extractThemesFromContent` was changed to: it is the only way to state
   * `heat` or `love` as itself. The inflections the substring form picked up
   * for free — `kissed` for `kiss`, `caressing` for `caress`, `desired` for
   * `desire` — are listed instead, so the repair does not quietly cost the
   * scan the matches it did get right. What it does not carry over is the rest
   * of what the substrings caught: `lovely` is not `love`, `gentleman` is not
   * `gentle`, and `hearth` is not `heart`. Those are the defect, not coverage.
   */
  private extractSpicyLevelFromContent(content: string): SpicyLevel {
    const lowerContent = this.stripHtml(content).toLowerCase();

    // Level 5 - Very Explicit
    const level5Keywords = [
      'explicit', 'explicitly', 'graphic', 'graphically', 'intense passion',
      'climax', 'climaxed', 'climaxes', 'ecstasy'
    ];
    if (level5Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
      return 5 as SpicyLevel;
    }

    // Level 4 - Passionate
    const level4Keywords = [
      'passionate', 'passionately', 'breathless', 'breathlessly',
      'desire', 'desires', 'desired', 'yearning', 'heat', 'heated'
    ];
    if (level4Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
      return 4 as SpicyLevel;
    }

    // Level 3 - Romantic with Heat
    const level3Keywords = [
      'kiss', 'kissed', 'kisses', 'kissing',
      'embrace', 'embraced', 'embraces', 'embracing',
      'caress', 'caressed', 'caresses', 'caressing',
      'touch', 'touched', 'touches', 'touching',
      'intimate', 'intimately'
    ];
    if (level3Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
      return 3 as SpicyLevel;
    }

    // Level 2 - Sweet Romance
    const level2Keywords = [
      'love', 'loved', 'loves', 'lover', 'lovers', 'loving',
      'affection', 'affections', 'affectionate',
      'tender', 'tenderly', 'tenderness',
      'gentle', 'gently', 'heart', 'hearts'
    ];
    if (level2Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
      return 2 as SpicyLevel;
    }

    // Default to Level 1 - Mild
    return 1 as SpicyLevel;
  }

  private formatStoryContent(content: string): string {
    // Enhanced formatting for better readability
    let formatted = content;

    // If no HTML formatting exists, apply smart formatting
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      // Extract title if present (first line typically).
      //
      // Only the blank lines *before* the title are dropped. Dropping all of
      // them — `split('\n').filter(line => line.trim())` — took out the very
      // separators the paragraph split below looks for, so rejoining the
      // remainder produced a body with no blank line left anywhere in it and
      // `split('\n\n')` returned the whole story as one block. Every paragraph
      // the model wrote was then welded into a single `<p>`, and only for a
      // story that opens with a title line: the same story without one kept its
      // paragraphs, because that branch never touched the lines. This is the
      // path a plain-text answer from the provider takes on its way to the
      // reader, so what the reader saw was the chapter as one unbroken wall.
      const lines = content.split('\n');
      const titleIndex = lines.findIndex(line => line.trim());
      const firstLine = titleIndex === -1 ? undefined : lines[titleIndex]?.trim();

      // Check if first line looks like a title (short, no punctuation except colon)
      const isTitle = firstLine && firstLine.length < 80 && !firstLine.endsWith('.') && !firstLine.startsWith('[');

      if (isTitle) {
        formatted = `<h3>${firstLine}</h3>\n\n` + lines.slice(titleIndex + 1).join('\n');
      }

      // Split into paragraphs based on multiple newlines or speaker changes
      formatted = formatted
        .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
        .split('\n\n')
        .filter(para => para.trim())
        .map(para => para.trim())
        .map(para => {
          // Skip if already has HTML tags
          if (para.includes('<')) return para;
          
          // Wrap in paragraph tags
          return `<p>${para}</p>`;
        })
        .join('\n\n');
    }

    return formatted;
  }

  private formatChapterContent(content: string): string {
    // Enhanced chapter formatting to match story formatting
    let formatted = content;

    // If no HTML formatting exists, apply smart formatting
    if (!content.includes('<h3>') && !content.includes('<p>')) {
      // Split into paragraphs based on multiple newlines
      formatted = formatted
        .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
        .split('\n\n')
        .filter(para => para.trim())
        .map(para => para.trim())
        .map(para => {
          // Skip if already has HTML tags
          if (para.includes('<')) return para;
          
          // Wrap in paragraph tags
          return `<p>${para}</p>`;
        })
        .join('\n\n');
    }

    return formatted;
  }

  /**
   * Reduce story markup to the text a reader sees.
   *
   * Deleting the tags and nothing else closed the gap they held open, so the
   * last word of one paragraph and the first word of the next were read as one
   * token: `<p>She opened the door.</p><p>Blood pooled…</p>` became
   * `door.Blood`. Every caller here is looking for something the reader can
   * point at — a chapter title, a summary of what just happened, the sentence a
   * continuation has to follow on from — and each of them was handed welded
   * text instead. Sentence splitting suffered worst: with no space after the
   * full stop there was nothing for `/(?<=[.!?])\s+/` to split on, so the whole
   * chapter came back as its own final sentence.
   */
  private stripHtml(content: string): string {
    return stripStoryHtmlToText(content);
  }

  private stripSpeakerTagsForDisplay(content: string): string {
    // Enhanced speaker tag removal with better text formatting
    let displayContent = content;

    // Remove speaker tags but preserve structure
    displayContent = displayContent
      .replace(/\[([^\]]+?)\]:\s*/g, '') // Remove speaker tags like [Narrator]: [Character, emotion]:
      .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
      .trim();

    // Smart paragraph creation based on content structure.
    //
    // The blank lines have to survive the split. Filtering them out here left
    // the branch below — the one that reads a blank line as the paragraph break
    // it is — unreachable, so the only breaks this method could ever make were
    // the ones the dialogue and narrative-shift heuristics guessed at. A model
    // that separated its paragraphs the ordinary way, with a blank line and no
    // opening quote or `Suddenly` to give itself away, had every one of them
    // welded into a single `<p>`: the reader was shown the chapter as one
    // unbroken block, and the paragraph structure the generator had actually
    // written was thrown away before anything downstream could read it.
    const lines = displayContent.split('\n');
    const paragraphs = [];
    let currentParagraph = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Empty line indicates paragraph break
      if (!trimmedLine) {
        if (currentParagraph) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        continue;
      }

      // Start new paragraph for dialogue or narrative shifts
      const isDialogue = trimmedLine.startsWith('"') || trimmedLine.includes('"');
      const isNarrativeShift = trimmedLine.length < 50 && (
        trimmedLine.includes('Later') || 
        trimmedLine.includes('Meanwhile') || 
        trimmedLine.includes('Suddenly') ||
        trimmedLine.includes('Then') ||
        /^(The|As|But|However|Still)/i.test(trimmedLine)
      );

      if (currentParagraph && (isNarrativeShift || (isDialogue && !currentParagraph.includes('"')))) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = trimmedLine;
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
      }
    }

    // Add final paragraph
    if (currentParagraph) {
      paragraphs.push(currentParagraph.trim());
    }

    // Format paragraphs with proper HTML
    const formattedParagraphs = paragraphs
      .filter(para => para.length > 0)
      .map(para => {
        // Clean up any extra spacing
        para = para.replace(/\s+/g, ' ').trim();
        
        // Wrap in paragraph tags if not already formatted
        if (!para.startsWith('<') && !para.includes('<p>')) {
          return `<p>${para}</p>`;
        }
        return para;
      });

    return formattedParagraphs.join('\n\n');
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

/**
 * Whether `text` contains `keyword` as a whole word or whole phrase.
 *
 * Both sides are already lowercased by the caller. The `\b` at each end is what
 * separates a theme keyword from the longer word it happens to sit inside, and
 * a hyphenated keyword such as `star-crossed` is unaffected: `-` is a
 * non-word character, so the boundaries fall at the ends of the phrase rather
 * than around each half.
 */
function containsWholeWord(text: string, keyword: string): boolean {
  return new RegExp(String.raw`\b${escapeRegExp(keyword)}\b`).test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
