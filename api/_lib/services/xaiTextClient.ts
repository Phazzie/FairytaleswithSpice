import axios from 'axios';
import {
  getRemainingRequestBudgetMs,
  getXaiFastModel,
  getXaiFastTimeoutMs,
  getXaiReasoningEffortForModel,
  getXaiStoryModel,
  XAI_RESPONSES_API_URL,
  type XaiReasoningEffort
} from '../config/xaiConfig';
import { logApiError, logInfo, logPerformance, logWarn, LogContext } from '../utils/logger';

/**
 * The shortest window worth starting a fast-profile retry in. Below it the
 * retry is certain to be cut off by the invocation's own deadline, so the
 * caller is better served by the failure it can still be told about.
 */
export const MIN_XAI_FALLBACK_TIMEOUT_MS = 5000;

export type XaiTextOperation = 'genesis' | 'continuation' | 'continuity_extraction' | 'evaluation' | 'smoke';
export type XaiModelPreference = 'primary' | 'fast';

export interface XaiTextRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  timeoutMs: number;
  fallbackTimeoutMs?: number;
  context?: LogContext;
  operation: XaiTextOperation;
  modelPreference?: XaiModelPreference;
  allowFallback?: boolean;
  /**
   * The true request-level clock the fallback retry's own remaining-budget
   * check should measure against, when the caller has one.
   *
   * Without it, `resolveFallbackTimeoutMs` measures elapsed time from this
   * call's own start rather than the request's, so it under-counts whatever
   * ran before this call — not just before the whole invocation, but before
   * *this* provider call specifically. A caller whose own pre-call work
   * (earlier chapters in a batch, route-level overhead) already spent most of
   * the true window still has that window measured as if it started fresh
   * here, so a primary attempt that spends its own (correctly capped) timeout
   * failing can still be followed by a retry the true deadline has no room
   * for at all. Passing the caller's own request start closes that gap;
   * omitting it keeps today's under-counting behavior for callers with
   * nothing better to give it.
   */
  requestStartedAtMs?: number;
}

export interface XaiTextResponse {
  text: string;
  model: string;
  reasoningEffort?: XaiReasoningEffort;
  fallbackFromModel?: string;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

interface XaiResponsesPayload {
  model?: string;
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

export class XaiTextClient {
  private readonly apiKey = process.env['XAI_API_KEY'];
  private readonly apiUrl = process.env['XAI_RESPONSES_API_URL']?.trim() || XAI_RESPONSES_API_URL;

  hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  async generateText(request: XaiTextRequest): Promise<XaiTextResponse> {
    if (!this.apiKey) {
      throw new Error('XAI_API_KEY is required for live Grok generation.');
    }

    // Falls back to this call's own start when the caller has no earlier
    // clock to give it — see `XaiTextRequest.requestStartedAtMs`.
    const startedAtMs = request.requestStartedAtMs ?? Date.now();
    const preferredModel = request.modelPreference === 'fast'
      ? getXaiFastModel()
      : getXaiStoryModel();
    const allowFallback = request.allowFallback ?? (request.operation !== 'smoke' && request.modelPreference !== 'fast');

    try {
      return await this.callResponsesApi(request, preferredModel, request.timeoutMs, request.modelPreference ?? 'primary');
    } catch (error: any) {
      const fastModel = getXaiFastModel();
      const preferredReasoningEffort = getXaiReasoningEffortForModel(preferredModel, request.modelPreference ?? 'primary');
      const fastReasoningEffort = getXaiReasoningEffortForModel(fastModel, 'fast');
      const requestedFallbackTimeoutMs = request.fallbackTimeoutMs ?? getXaiFastTimeoutMs();

      if (this.shouldAttemptFastProfileFallback({
        allowFallback,
        error,
        preferredModel,
        fastModel,
        preferredReasoningEffort,
        fastReasoningEffort,
        primaryTimeoutMs: request.timeoutMs,
        fallbackTimeoutMs: requestedFallbackTimeoutMs
      })) {
        // What the retry may spend, rather than what it asked for: see
        // `resolveFallbackTimeoutMs` for the invocation deadline the two of them
        // together used to run past.
        const fallbackTimeoutMs = this.resolveFallbackTimeoutMs(requestedFallbackTimeoutMs, startedAtMs);

        if (fallbackTimeoutMs === 0) {
          logWarn('Primary xAI profile attempt did not finish and the invocation has no room left for a fast profile retry.', request.context, {
            operation: request.operation,
            primaryModel: preferredModel,
            fallbackModel: fastModel,
            primaryTimeoutMs: request.timeoutMs,
            requestedFallbackTimeoutMs,
            remainingBudgetMs: getRemainingRequestBudgetMs(startedAtMs),
            status: error.response?.status,
            errorCode: error.code
          });

          this.logProviderFailure(error, request, preferredModel);
          throw this.toUnavailableError(error);
        }

        logWarn('Primary xAI profile attempt did not finish in the live request window; retrying with fast profile.', request.context, {
          operation: request.operation,
          primaryModel: preferredModel,
          fallbackModel: fastModel,
          primaryReasoningEffort: preferredReasoningEffort,
          fastReasoningEffort,
          fallbackTimeoutMs,
          status: error.response?.status,
          errorCode: error.code
        });

        try {
          const fallbackResponse = await this.callResponsesApi(
            request,
            fastModel,
            fallbackTimeoutMs,
            'fast'
          );

          return {
            ...fallbackResponse,
            fallbackFromModel: preferredModel
          };
        } catch (fallbackError: any) {
          this.logProviderFailure(fallbackError, request, fastModel);
          throw this.toUnavailableError(fallbackError);
        }
      }

      this.logProviderFailure(error, request, preferredModel);
      throw this.toUnavailableError(error);
    }
  }

  /**
   * How long the fast-profile retry may run, given what the primary attempt
   * already spent.
   *
   * The retry used to be given `fallbackTimeoutMs` whatever the primary attempt
   * had cost, and the two defaults are 40 seconds each against an invocation the
   * platform kills at 60. A deployment that points `XAI_FAST_MODEL` at a
   * different model from `XAI_STORY_MODEL` — which is what the fallback is for,
   * and the only configuration `shouldAttemptFastProfileFallback` does not
   * already refuse on the timeouts alone — therefore had a primary timeout and a
   * retry that could not both fit: the primary attempt timed out at 40 seconds,
   * the retry was handed another 40, and the function was terminated at 60 with
   * the retry still in flight. The caller got the platform's timeout instead of
   * the `AI_UNAVAILABLE` envelope this client exists to produce, the reader got
   * a generic failure page in place of "Grok is temporarily unavailable, try
   * again in a minute", and nothing downstream ran at all — including the
   * continuity extraction that measures itself against this same window.
   *
   * So the retry is given what is actually left. Below
   * `MIN_XAI_FALLBACK_TIMEOUT_MS` there is no point starting one: a generation
   * cannot finish in it, and spending the remainder of the window on a call that
   * will be cut off costs the honest answer the caller could have had at once.
   *
   * `startedAtMs` is the caller's own `requestStartedAtMs` when it supplied
   * one, so this measures elapsed time against the true request clock rather
   * than this call's own start — a caller with pre-call work of its own
   * (earlier batch chapters, route-level overhead) has that work counted
   * here too, not just the time this specific attempt spent. A caller with
   * nothing earlier to give falls back to this call's own start, which
   * under-counts whatever ran before it the way this always has; that
   * remaining gap still errs toward attempting the retry, which is the
   * direction that keeps a story being generated.
   */
  private resolveFallbackTimeoutMs(requestedTimeoutMs: number, startedAtMs: number): number {
    const remainingMs = getRemainingRequestBudgetMs(startedAtMs);

    if (remainingMs < MIN_XAI_FALLBACK_TIMEOUT_MS) {
      return 0;
    }

    return Math.min(requestedTimeoutMs, remainingMs);
  }

  private shouldAttemptFastProfileFallback(input: {
    allowFallback: boolean;
    error: any;
    preferredModel: string;
    fastModel: string;
    preferredReasoningEffort?: XaiReasoningEffort;
    fastReasoningEffort?: XaiReasoningEffort;
    primaryTimeoutMs: number;
    fallbackTimeoutMs: number;
  }): boolean {
    const preferredModelKey = input.preferredModel.toLowerCase();
    const fastModelKey = input.fastModel.toLowerCase();
    const usesDifferentFastProfile =
      fastModelKey !== preferredModelKey || input.fastReasoningEffort !== input.preferredReasoningEffort;
    const usesSameModelFastProfile = fastModelKey === preferredModelKey;
    const hasBoundedSameModelFallback = !usesSameModelFastProfile || input.fallbackTimeoutMs < input.primaryTimeoutMs;

    return (
      input.allowFallback &&
      usesDifferentFastProfile &&
      hasBoundedSameModelFallback &&
      input.error &&
      typeof input.error === 'object' &&
      this.isRetryableProviderError(input.error)
    );
  }

  private async callResponsesApi(
    request: XaiTextRequest,
    model: string,
    timeoutMs: number,
    modelPreference: XaiModelPreference
  ): Promise<XaiTextResponse> {
    const startedAt = Date.now();
    const reasoningEffort = getXaiReasoningEffortForModel(model, modelPreference);

    logInfo('Calling xAI Responses API', request.context, {
      operation: request.operation,
      model,
      reasoningEffort,
      maxOutputTokens: request.maxOutputTokens,
      timeoutMs
    });

    const payload: Record<string, unknown> = {
      model,
      input: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user }
      ],
      max_output_tokens: request.maxOutputTokens,
      temperature: request.temperature,
      top_p: request.topP,
      store: false
    };

    if (reasoningEffort) {
      payload['reasoning'] = {
        effort: reasoningEffort
      };
    }

    const response = await axios.post<XaiResponsesPayload>(
      this.apiUrl,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: timeoutMs
      }
    );

    const latencyMs = Date.now() - startedAt;
    const text = this.extractText(response.data);

    if (!text) {
      throw new Error('xAI response did not include output text.');
    }

    logPerformance('xAI Responses API call', latencyMs, request.context, {
      operation: request.operation,
      model,
      reasoningEffort,
      inputTokens: response.data.usage?.input_tokens,
      outputTokens: response.data.usage?.output_tokens
    });

    return {
      text,
      model,
      reasoningEffort,
      latencyMs,
      usage: {
        inputTokens: response.data.usage?.input_tokens,
        outputTokens: response.data.usage?.output_tokens,
        totalTokens: response.data.usage?.total_tokens
      }
    };
  }

  private logProviderFailure(error: any, request: XaiTextRequest, model: string): void {
    const providerError = this.getProviderError(error);

    logApiError('xAI Responses API', error, request.context, {
      operation: request.operation,
      model,
      status: providerError.response?.status,
      errorCode: providerError.code
    });
  }

  private isRetryableProviderError(error: any): boolean {
    const providerError = this.getProviderError(error);
    const status = providerError.response?.status;
    if (status === undefined) {
      return providerError.code === 'ECONNABORTED'
        || providerError.code === 'ETIMEDOUT'
        || providerError.code === 'ECONNRESET'
        || providerError.message?.toLowerCase().includes('timeout') === true;
    }

    return status === 408 || status === 429 || status >= 500;
  }

  private toUnavailableError(error: any): Error {
    const providerError = this.getProviderError(error);
    const status = providerError.response?.status ? ` (${providerError.response.status})` : '';
    return new Error(`xAI service temporarily unavailable${status}`);
  }

  private getProviderError(error: any): { response?: { status?: number }; code?: string; message?: string } {
    return error && typeof error === 'object' ? error : {};
  }

  private extractText(payload: XaiResponsesPayload): string {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    return (payload.output ?? [])
      .flatMap(item => item?.content ?? [])
      .filter(content => content && (content.type === 'output_text' || content.type === 'text' || !content.type) && typeof content.text === 'string')
      .map(content => content.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
}
