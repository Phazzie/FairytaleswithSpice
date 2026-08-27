// Created: 2025-10-31 06:28 UTC

import { randomInt, randomUUID } from 'node:crypto';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse,
  VALIDATION_RULES,
  Chapter,
  ChapterFailure,
  CliffhangerType
} from '../types/contracts';
import { isCreatureArchetype } from '../../../shared/creatureVocabulary';
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
import { getXaiFastTimeoutMs, getXaiPrimaryTimeoutMs, type XaiReasoningEffort } from '../config/xaiConfig';
import { XaiTextClient, type XaiTextResponse } from './xaiTextClient';
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
import { STORY_BLUEPRINT_LIMITS } from '../../../shared/storyBlueprintLimits';
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
const STORY_LAB_CONTEXT_VALUE_MAX_LENGTH = 320;
const STORY_LAB_NO_GO_CONTENT_MAX_LENGTH = STORY_LAB_CONTEXT_VALUE_MAX_LENGTH;

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
      `- Adult readers only confirmed; tension mode ${this.formatHeatContractLabel(context.heatContract.tensionMode)}; boundary ${this.formatHeatContractLabel(context.heatContract.intimacyBoundary)}.`
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
