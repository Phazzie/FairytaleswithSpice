export const DEFAULT_XAI_STORY_MODEL = 'grok-4.3';
export const DEFAULT_XAI_FAST_MODEL = 'grok-4.3';
export const DEFAULT_XAI_REASONING_EFFORT = 'medium';
export const XAI_RESPONSES_API_URL = 'https://api.x.ai/v1/responses';
export const DEFAULT_XAI_PRIMARY_TIMEOUT_MS = 40000;
export const DEFAULT_XAI_FAST_TIMEOUT_MS = 40000;

export type XaiReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

const VALID_REASONING_EFFORTS = new Set<XaiReasoningEffort>(['none', 'low', 'medium', 'high', 'xhigh']);

export function getXaiStoryModel(): string {
  return process.env['XAI_STORY_MODEL']?.trim() || DEFAULT_XAI_STORY_MODEL;
}

export function getXaiFastModel(): string {
  return process.env['XAI_FAST_MODEL']?.trim() || DEFAULT_XAI_FAST_MODEL;
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

export function supportsXaiReasoningParameter(model: string | null | undefined): boolean {
  if (!model) {
    return false;
  }

  const normalizedModel = model.toLowerCase();
  return normalizedModel.includes('grok-4.3') || normalizedModel.includes('multi-agent');
}

export function getXaiFastReasoningEffort(): XaiReasoningEffort {
  return 'none';
}

export function getXaiReasoningEffortForModel(model: string, modelPreference: 'primary' | 'fast' = 'primary'): XaiReasoningEffort | undefined {
  if (!supportsXaiReasoningParameter(model)) {
    return undefined;
  }

  const normalizedModel = model.toLowerCase();
  if (modelPreference === 'fast' && normalizedModel.includes('grok-4.3')) {
    return getXaiFastReasoningEffort();
  }

  const configuredEffort = getXaiReasoningEffort();
  if (normalizedModel.includes('grok-4.3') && configuredEffort === 'xhigh') {
    return 'high';
  }

  if (normalizedModel.includes('multi-agent') && configuredEffort === 'none') {
    return DEFAULT_XAI_REASONING_EFFORT;
  }

  return configuredEffort;
}

export function getXaiPrimaryTimeoutMs(): number {
  return getPositiveIntegerEnv(['XAI_STORY_PRIMARY_TIMEOUT_MS', 'XAI_PRIMARY_TIMEOUT_MS'], DEFAULT_XAI_PRIMARY_TIMEOUT_MS);
}

export function getXaiFastTimeoutMs(): number {
  return getPositiveIntegerEnv(['XAI_STORY_FAST_TIMEOUT_MS', 'XAI_FAST_TIMEOUT_MS'], DEFAULT_XAI_FAST_TIMEOUT_MS);
}

function getPositiveIntegerEnv(names: string[], fallback: number): number {
  for (const name of names) {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
      continue;
    }

    const parsed = Number(rawValue);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}
