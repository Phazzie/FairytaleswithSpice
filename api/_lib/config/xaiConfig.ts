export const DEFAULT_XAI_STORY_MODEL = 'grok-4.20-multi-agent';
export const DEFAULT_XAI_REASONING_EFFORT = 'medium';
export const XAI_RESPONSES_API_URL = 'https://api.x.ai/v1/responses';

export type XaiReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

const VALID_REASONING_EFFORTS = new Set<XaiReasoningEffort>(['low', 'medium', 'high', 'xhigh']);

export function getXaiStoryModel(): string {
  return process.env['XAI_STORY_MODEL']?.trim() || DEFAULT_XAI_STORY_MODEL;
}

export function getXaiReasoningEffort(): XaiReasoningEffort {
  const configuredEffort = process.env['XAI_STORY_REASONING_EFFORT']?.trim().toLowerCase();

  if (configuredEffort && VALID_REASONING_EFFORTS.has(configuredEffort as XaiReasoningEffort)) {
    return configuredEffort as XaiReasoningEffort;
  }

  return DEFAULT_XAI_REASONING_EFFORT;
}

export function isHighAgentEffort(effort: XaiReasoningEffort = getXaiReasoningEffort()): boolean {
  return effort === 'high' || effort === 'xhigh';
}
