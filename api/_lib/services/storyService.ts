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
  CreatureType
} from '../types/contracts';
import { selectRandomAuthorStyles } from '../config/authorStyles';
import { CliffhangerService } from './cliffhangerService';
import { TropeSelection, TropeSubversionService } from './tropeSubversionService';
import { logger, logError, logWarn, logApiError, logInfo, logPerformance, LogContext } from '../utils/logger';
import { getXaiFastTimeoutMs, getXaiPrimaryTimeoutMs, type XaiReasoningEffort } from '../config/xaiConfig';
import { XaiTextClient, type XaiTextResponse } from './xaiTextClient';

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
      userInput: {
        creature: sanitizedInput.creature,
        themes: sanitizedInput.themes,
        spicyLevel: sanitizedInput.spicyLevel,
        wordCount: sanitizedInput.wordCount,
        requestedChapterCount: input.requestedChapterCount ?? requestedChapterCount
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
      userInput: {
        currentChapterCount: sanitizedInput.currentChapterCount,
        existingContentLength: sanitizedInput.existingContent?.length || 0,
        maintainTone: sanitizedInput.maintainTone,
        requestedChapterCount: input.requestedChapterCount ?? requestedChapterCount
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
          const cliffhangerAnalysis = this.cliffhangerService.analyze(chapterContent);
          lastCliffhangerAnalysis = cliffhangerAnalysis;

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

  /**
   * Generate story with streaming support for real-time updates
   */
  async generateStoryStreaming(
    input: StoryGenerationSeam['input'], 
    onChunk: (chunk: {
      content: string;
      isComplete: boolean;
      wordsGenerated: number;
      estimatedWordsRemaining: number;
      generationSpeed: number;
    }) => void
  ): Promise<void> {
    const tropeSelection = this.selectTropeSubversions(input);

    if (!this.xaiClient.hasApiKey()) {
      // For mock mode, simulate streaming
      await this.simulateStreamingGeneration(input, onChunk, tropeSelection);
      return;
    }

    const systemPrompt = this.buildSystemPrompt(input, tropeSelection);
    const userPrompt = this.buildUserPrompt(input);

    try {
      const targetWords = input.wordCount;
      const startTime = Date.now();

      const response = await this.xaiClient.generateText({
        operation: 'genesis',
        system: systemPrompt,
        user: userPrompt,
        maxOutputTokens: this.calculateOptimalTokens(input.wordCount),
        temperature: 0.8,
        topP: 0.95,
        timeoutMs: getXaiPrimaryTimeoutMs(),
        fallbackTimeoutMs: getXaiFastTimeoutMs(),
        allowFallback: true,
        context: {
          endpoint: 'generateStoryStreaming',
          method: 'RESPONSES'
        }
      });

      const content = response.text;
      const wordsGenerated = this.countWords(content);
      onChunk({
        content,
        isComplete: true,
        wordsGenerated,
        estimatedWordsRemaining: Math.max(0, targetWords - wordsGenerated),
        generationSpeed: this.calculateGenerationSpeed(wordsGenerated, startTime)
      });
    } catch (error: any) {
      console.error('Streaming generation error:', error);
      throw error;
    }
  }

  private calculateGenerationSpeed(wordsGenerated: number, startTime: number): number {
    const elapsedSeconds = Math.max(0.001, (Date.now() - startTime) / 1000);
    return wordsGenerated / elapsedSeconds;
  }

  /**
   * Simulate streaming for mock mode (when no API key)
   */
  private async simulateStreamingGeneration(
    input: StoryGenerationSeam['input'],
    onChunk: (chunk: any) => void,
    tropeSelection?: TropeSelection
  ): Promise<void> {
    const mockStory = this.generateMockStory(input, tropeSelection);
    const words = mockStory.split(' ');
    const totalWords = words.length;
    let accumulatedContent = '';
    
    const startTime = Date.now();
    
    // Stream words in batches to simulate real generation
    for (let i = 0; i < words.length; i += 3) {
      const batch = words.slice(i, i + 3).join(' ') + ' ';
      accumulatedContent += batch;
      
      const wordsGenerated = i + 3;
      
      onChunk({
        content: accumulatedContent,
        isComplete: false,
        wordsGenerated: Math.min(wordsGenerated, totalWords),
        estimatedWordsRemaining: Math.max(0, totalWords - wordsGenerated),
        generationSpeed: this.calculateGenerationSpeed(wordsGenerated, startTime)
      });
      
      // Simulate generation delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Send final complete chunk
    onChunk({
      content: accumulatedContent.trim(),
      isComplete: true,
      wordsGenerated: totalWords,
      estimatedWordsRemaining: 0,
      generationSpeed: this.calculateGenerationSpeed(totalWords, startTime)
    });
  }

  private async callGrokAI(
    input: StoryGenerationSeam['input'],
    context?: LogContext,
    tropeSelection?: TropeSelection,
    chapterOptions?: ChapterGenerationOptions
  ): Promise<GeneratedTextResult> {
    if (!this.xaiClient.hasApiKey()) {
      if (this.isProductionRuntime()) {
        throw this.missingProviderError();
      }

      logWarn('No API key found, using mock generation', context);
      // Fallback to mock generation if no API key
      return {
        content: chapterOptions
          ? this.generateMockInitialChapter(input, chapterOptions.chapterNumber)
          : this.generateMockStory(input, tropeSelection)
      };
    }

    const targetWordCount = chapterOptions
      ? Math.max(200, Math.ceil(input.wordCount / Math.max(1, chapterOptions.totalChapters)))
      : input.wordCount;
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

    return {
      model: next.model ?? existing?.model,
      reasoningEffort: next.reasoningEffort ?? existing?.reasoningEffort,
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
    const themeSeeds = input.generationContext?.themeSeeds ?? [];
    if (themeSeeds.length > 0) {
      return themeSeeds
        .map(theme => `${theme.label} (${theme.description})`)
        .join('; ');
    }

    return input.themes.join(', ');
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

    if (context.logline) {
      lines.push(`- Logline: ${context.logline}`);
    }
    if (context.tone) {
      lines.push(`- Narrative tone: ${context.tone.split('_').join(' ')}`);
    }
    if (context.protagonistName) {
      lines.push(`- Protagonist name: ${context.protagonistName}`);
    }
    if (context.antagonistName) {
      lines.push(`- Antagonist name or opposing force: ${context.antagonistName}`);
    }
    if (context.worldDetails) {
      lines.push(`- World details: ${context.worldDetails}`);
    }
    if (context.narrativeDirectives) {
      lines.push(`- Narrative directives: ${context.narrativeDirectives}`);
    }
    if (context.heatContract) {
      lines.push(`- Heat contract: adult readers only confirmed; tension mode ${this.formatHeatContractLabel(context.heatContract.tensionMode)}; boundary ${this.formatHeatContractLabel(context.heatContract.intimacyBoundary)}.`);
      if (context.heatContract.noGoContent?.trim()) {
        lines.push(`- No-go content: ${context.heatContract.noGoContent.trim()}`);
      }
      lines.push('- Keep intimate material consensual and do not exceed the Heat Contract boundary.');
    }
    if (context.themeSeeds?.length) {
      lines.push('- Theme seed intent:');
      for (const theme of context.themeSeeds) {
        lines.push(`  * ${theme.label}: ${theme.description}`);
      }
    }

    lines.push('- Treat these blueprint fields as binding story intent, not as optional flavor.');
    return lines.join('\n');
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
    const stripped = this.stripHtml(content);
    const paragraphs = stripped.split('\n\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) return 'Story beginning';
    
    // Get last 2-3 paragraphs as summary
    const lastParagraphs = paragraphs.slice(-3).join(' ');
    
    // Truncate to ~150 words
    const words = lastParagraphs.split(/\s+/);
    const summary = words.slice(0, 150).join(' ');
    
    return summary.length < lastParagraphs.length ? summary + '...' : summary;
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
   */
  private analyzeEmotionalTone(content: string): string {
    const lowerContent = content.toLowerCase();
    const tones: string[] = [];
    
    // Emotional indicators
    if (lowerContent.match(/\b(desire|passion|want|need|crave)\b/)) tones.push('passionate');
    if (lowerContent.match(/\b(dark|shadow|danger|fear|threat)\b/)) tones.push('dark/suspenseful');
    if (lowerContent.match(/\b(tease|playful|smile|grin|laugh)\b/)) tones.push('playful');
    if (lowerContent.match(/\b(pain|ache|hurt|wound|scar)\b/)) tones.push('angsty');
    if (lowerContent.match(/\b(power|control|dominan|command)\b/)) tones.push('intense');
    
    return tones.length > 0 ? tones.join(', ') : 'romantic with building tension';
  }

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
        providedValue: input.creature,
        expectedType: 'CreatureType'
      };
    }

    if (!Array.isArray(input.themes) || input.themes.length > VALIDATION_RULES.themes.maxCount) {
      return {
        code: 'INVALID_INPUT',
        message: `Too many themes (max ${VALIDATION_RULES.themes.maxCount})`,
        field: 'themes',
        providedValue: input.themes,
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
        providedValue: input.spicyLevel,
        expectedType: 'SpicyLevel'
      };
    }

    if (!(VALIDATION_RULES.wordCount.allowedValues as readonly number[]).includes(input.wordCount)) {
      return {
        code: 'INVALID_INPUT',
        message: 'Invalid word count',
        field: 'wordCount',
        providedValue: input.wordCount,
        expectedType: 'WordCount'
      };
    }

    if (input.userInput && input.userInput.length > VALIDATION_RULES.userInput.maxLength) {
      return {
        code: 'INVALID_INPUT',
        message: `User input too long (max ${VALIDATION_RULES.userInput.maxLength} characters)`,
        field: 'userInput',
        providedValue: input.userInput,
        expectedType: 'string'
      };
    }

    if (!this.isValidRequestedChapterCount(input.requestedChapterCount)) {
      return {
        code: 'INVALID_INPUT',
        message: 'requestedChapterCount must be 1, 2, or 3',
        field: 'requestedChapterCount',
        providedValue: input.requestedChapterCount,
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

  private generateNextChapterHint(content: string): string {
    const text = this.stripHtml(content).replace(/\s+/g, ' ').trim();
    if (!text) {
      return '';
    }

    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const candidate = sentences[sentences.length - 1] || text;
    return candidate.length > 200 ? `${candidate.slice(0, 197).trim()}...` : candidate.trim();
  }

  private createContextExcerpt(html: string, maxLength: number = 1200): string {
    const text = this.stripHtml(html || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) {
      return text;
    }

    return text.slice(-maxLength);
  }

  private generateMockStory(input: StoryGenerationSeam['input'], _tropeSelection?: TropeSelection): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const spicyLabel = this.getSpicyLabel(input.spicyLevel);

    return `<h3>The ${creatureName}'s Forbidden Passion</h3>

<p>In the shadowed alleys of Victorian London, Lady Arabella Worthington found herself drawn to the mysterious stranger who haunted her dreams. His eyes, crimson as fresh-spilled wine, held secrets that both terrified and exhilarated her.</p>

<p>"You shouldn't be here," he whispered, his voice like velvet over steel. But Arabella, with her corset straining against propriety and her heart pounding with forbidden desire, stepped closer.</p>

<p>The ${creatureName.toLowerCase()} prince revealed himself slowly, each layer of deception peeling away like the petals of a night-blooming flower. His touch was electric, sending sparks through her veins that made her gasp with a pleasure bordering on pain.</p>

<p>As the gas lamps flickered in the fog-shrouded streets, their bodies entwined in a dance as old as time itself. Arabella discovered that some hungers could never be satisfied, only temporarily sated.</p>

<p>The ${spicyLabel.toLowerCase()} intensity of their encounter left her breathless, her skin flushed and marked by his passionate embrace. She knew she should run, should scream for help, but the pull was too strong.</p>

<p>In that moment, Lady Arabella Worthington ceased to be a proper Victorian lady and became something far more dangerous - the willing consort of a creature of the night.</p>

<p><em>This is a mock story generated without AI. Add XAI_API_KEY to use real AI generation.</em></p>`;
  }

  private generateMockInitialChapter(input: StoryGenerationSeam['input'], chapterNumber: number): string {
    const creatureName = this.getCreatureDisplayName(input.creature);
    const baseTitle = chapterNumber === 1
      ? `The ${creatureName}'s Forbidden Passion`
      : `Secrets of the ${creatureName} - Part ${chapterNumber}`;

    return `<h3>Chapter ${chapterNumber}: ${baseTitle}</h3>

<p>[Narrator]: Moonlight dripped across the manor's stone balustrades as whispers of destiny curled around our lovers. The ${creatureName.toLowerCase()} aristocrat studied their prey with patient hunger, weighing desire against the oaths that bound their bloodline.</p>

<p>[Narrator]: Each chapter in this mock sequence leans into danger, seduction, and supernatural stakes. Expect clandestine meetings beneath stained glass, confessions that scorch the night air, and the steady escalation of ${creatureName.toLowerCase()} power games.</p>

<p>[Narrator]: This placeholder chapter lets the application exercise multi-chapter flows without live Grok calls. In production the AI will weave bespoke intrigue, but here we provide atmospheric beats and a tidy cliffhanger.</p>

<p>[Narrator]: Just before dawn, a coded message slips beneath the chamber door promising either salvation or ruin. Our heroes must decide whether to follow it, setting up the next chapter's peril.</p>`;
  }

  private generateMockChapter(input: ChapterContinuationSeam['input'], chapterNumber?: number): string {
    const nextNumber = chapterNumber ?? input.currentChapterCount + 1;

    return `<h3>Chapter ${nextNumber}: The Deeper Shadows</h3>

<p>The morning light pierced through heavy velvet curtains, but Arabella felt no warmth from its golden rays. Instead, a strange energy coursed through her veins, awakening senses she never knew existed.</p>

<p>Every sound was amplified - the distant clip-clop of carriage horses, the rustle of leaves in the garden, even the steady beat of her own heart. And beneath it all, a hunger that gnawed at her very soul.</p>

<p>Her reflection in the mirror showed a woman transformed. Her skin glowed with an otherworldly luminescence, her eyes held a predatory gleam. The creature had given her a gift... or was it a curse?</p>

<p>As night fell once more, she waited impatiently for his return. The hours stretched like taffy, each minute an eternity of anticipation. When he finally appeared at her balcony, silent as a shadow, Arabella knew there was no turning back.</p>

<p>Their second encounter was even more intense than the first. His hands explored her body with a possessiveness that made her arch and cry out. The passion burned hotter, threatening to consume them both.</p>

<p>But in the aftermath, as they lay entwined in sweat-dampened sheets, Arabella began to question the true cost of her transformation. What price would she pay for eternal passion?</p>

<p><em>This is a mock chapter generated without AI.</em></p>`;
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

  private countWords(content: string): number {
    return content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
  }

  private detectCliffhanger(content: string): boolean {
    return this.cliffhangerService.analyze(content).cliffhangerDetected;
  }

  private extractThemesFromContent(content: string): any[] {
    const lowerContent = content.toLowerCase();
    const detectedThemes: string[] = [];
    
    // Define theme keywords for detection
    const themeKeywords = {
      'forbidden_love': ['forbidden', 'secret love', 'star-crossed', 'illicit', 'taboo'],
      'betrayal': ['betrayed', 'deceived', 'backstabbed', 'treachery', 'double-crossed'],
      'revenge': ['revenge', 'vengeance', 'retribution', 'payback', 'avenge'],
      'power_dynamics': ['power', 'control', 'dominance', 'authority', 'command'],
      'obsession': ['obsessed', 'possessed', 'consumed', 'fixated', 'addicted'],
      'dark_secrets': ['secret', 'hidden', 'mysterious', 'concealed', 'buried'],
      'seduction': ['seduced', 'tempted', 'allured', 'enticed', 'charmed'],
      'corruption': ['corrupted', 'tainted', 'fallen', 'darkness', 'evil'],
      'jealousy': ['jealous', 'envious', 'possessive', 'resentful', 'covetous'],
      'desire': ['desire', 'yearning', 'craving', 'longing', 'lust'],
      'passion': ['passionate', 'intense', 'burning', 'fiery', 'ardent'],
      'manipulation': ['manipulated', 'controlled', 'used', 'exploited', 'influenced']
    };
    
    // Check for each theme
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        detectedThemes.push(theme);
      }
    }
    
    return detectedThemes.length > 0 ? detectedThemes : ['romance', 'fantasy'];
  }

  private extractSpicyLevelFromContent(content: string): SpicyLevel {
    const lowerContent = content.toLowerCase();
    
    // Level 5 - Very Explicit
    const level5Keywords = ['explicit', 'graphic', 'intense passion', 'climax', 'ecstasy'];
    if (level5Keywords.some(keyword => lowerContent.includes(keyword))) {
      return 5 as SpicyLevel;
    }
    
    // Level 4 - Passionate
    const level4Keywords = ['passionate', 'breathless', 'desire', 'yearning', 'heat'];
    if (level4Keywords.some(keyword => lowerContent.includes(keyword))) {
      return 4 as SpicyLevel;
    }
    
    // Level 3 - Romantic with Heat
    const level3Keywords = ['kiss', 'embrace', 'caress', 'touch', 'intimate'];
    if (level3Keywords.some(keyword => lowerContent.includes(keyword))) {
      return 3 as SpicyLevel;
    }
    
    // Level 2 - Sweet Romance
    const level2Keywords = ['love', 'affection', 'tender', 'gentle', 'heart'];
    if (level2Keywords.some(keyword => lowerContent.includes(keyword))) {
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
      // Extract title if present (first line typically)
      const lines = content.split('\n').filter(line => line.trim());
      const firstLine = lines[0]?.trim();
      
      // Check if first line looks like a title (short, no punctuation except colon)
      const isTitle = firstLine && firstLine.length < 80 && !firstLine.endsWith('.') && !firstLine.startsWith('[');
      
      if (isTitle) {
        formatted = `<h3>${firstLine}</h3>\n\n` + lines.slice(1).join('\n');
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

  private stripHtml(content: string): string {
    return content.replace(/<[^>]*>/g, '');
  }

  private stripSpeakerTagsForDisplay(content: string): string {
    // Enhanced speaker tag removal with better text formatting
    let displayContent = content;

    // Remove speaker tags but preserve structure
    displayContent = displayContent
      .replace(/\[([^\]]+?)\]:\s*/g, '') // Remove speaker tags like [Narrator]: [Character, emotion]:
      .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
      .trim();

    // Smart paragraph creation based on content structure
    const lines = displayContent.split('\n').filter(line => line.trim());
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
