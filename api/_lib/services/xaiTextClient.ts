import axios from 'axios';
import { getXaiReasoningEffort, getXaiStoryModel, XAI_RESPONSES_API_URL, XaiReasoningEffort } from '../config/xaiConfig';
import { logApiError, logInfo, logPerformance, LogContext } from '../utils/logger';

export type XaiTextOperation = 'genesis' | 'continuation' | 'continuity_extraction' | 'evaluation' | 'smoke';

export interface XaiTextRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  timeoutMs: number;
  context?: LogContext;
  operation: XaiTextOperation;
}

export interface XaiTextResponse {
  text: string;
  model: string;
  reasoningEffort: XaiReasoningEffort;
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

    const model = getXaiStoryModel();
    const reasoningEffort = getXaiReasoningEffort();
    const startedAt = Date.now();

    logInfo('Calling xAI Responses API', request.context, {
      operation: request.operation,
      model,
      reasoningEffort,
      maxOutputTokens: request.maxOutputTokens
    });

    try {
      const response = await axios.post<XaiResponsesPayload>(
        this.apiUrl,
        {
          model,
          input: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user }
          ],
          reasoning: {
            effort: reasoningEffort
          },
          max_output_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          top_p: request.topP,
          store: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: request.timeoutMs
        }
      );

      const latencyMs = Date.now() - startedAt;
      const text = this.extractText(response.data);

      if (!text) {
        throw new Error('xAI response did not include output text.');
      }

      logPerformance('xAI Responses API call', latencyMs, request.context, {
        operation: request.operation,
        model: response.data.model || model,
        reasoningEffort,
        inputTokens: response.data.usage?.input_tokens,
        outputTokens: response.data.usage?.output_tokens
      });

      return {
        text,
        model: response.data.model || model,
        reasoningEffort,
        latencyMs,
        usage: {
          inputTokens: response.data.usage?.input_tokens,
          outputTokens: response.data.usage?.output_tokens,
          totalTokens: response.data.usage?.total_tokens
        }
      };
    } catch (error: any) {
      logApiError('xAI Responses API', error, request.context, {
        operation: request.operation,
        model,
        reasoningEffort,
        status: error.response?.status
      });

      const status = error.response?.status ? ` (${error.response.status})` : '';
      throw new Error(`xAI service temporarily unavailable${status}`);
    }
  }

  private extractText(payload: XaiResponsesPayload): string {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    return (payload.output ?? [])
      .flatMap(item => item.content ?? [])
      .filter(content => (content.type === 'output_text' || content.type === 'text' || !content.type) && typeof content.text === 'string')
      .map(content => content.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
}
