import axios from 'axios';
import {
  getXaiFastModel,
  getXaiFastTimeoutMs,
  getXaiReasoningEffortForModel,
  getXaiStoryModel,
  XAI_RESPONSES_API_URL,
  type XaiReasoningEffort
} from '../config/xaiConfig';
import { logApiError, logInfo, logPerformance, logWarn, LogContext } from '../utils/logger';

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
      const usesDifferentFastProfile = fastModel !== preferredModel || fastReasoningEffort !== preferredReasoningEffort;

      if (allowFallback && usesDifferentFastProfile && this.isRetryableProviderError(error)) {
        logWarn('Primary xAI profile attempt did not finish in the live request window; retrying with fast profile.', request.context, {
          operation: request.operation,
          primaryModel: preferredModel,
          fallbackModel: fastModel,
          primaryReasoningEffort: preferredReasoningEffort,
          fastReasoningEffort,
          status: error.response?.status,
          errorCode: error.code
        });

        try {
          const fallbackResponse = await this.callResponsesApi(
            request,
            fastModel,
            request.fallbackTimeoutMs ?? getXaiFastTimeoutMs(),
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
    logApiError('xAI Responses API', error, request.context, {
      operation: request.operation,
      model,
      status: error.response?.status,
      errorCode: error.code
    });
  }

  private isRetryableProviderError(error: any): boolean {
    const status = error.response?.status;
    if (status === undefined) {
      return error.code === 'ECONNABORTED'
        || error.code === 'ETIMEDOUT'
        || error.code === 'ECONNRESET'
        || error.message?.toLowerCase().includes('timeout');
    }

    return status === 408 || status === 429 || status >= 500;
  }

  private toUnavailableError(error: any): Error {
    const status = error.response?.status ? ` (${error.response.status})` : '';
    return new Error(`xAI service temporarily unavailable${status}`);
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
