// Created: 2026-06-04 00:00 EDT

import type {
  ChapterBatchSize,
  CreatureArchetype,
  HeatContract,
  NarrativeTone,
  SpicyLevel,
  StoryGenerationSeam,
  ThemeSeed,
  WordBudget
} from '../contracts';

type QueryValue = string | string[] | number | boolean | object | undefined;
type QuerySource = Record<string, QueryValue>;

export interface StoryLabBlueprintParseError {
  code: 'INVALID_BLUEPRINT';
  message: string;
  invalidFields: string[];
}

export type StoryLabBlueprintParseResult =
  | { blueprint: StoryGenerationSeam['input']; error?: undefined }
  | { blueprint?: undefined; error: StoryLabBlueprintParseError };

const VALID_CREATURES: readonly CreatureArchetype[] = [
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
const VALID_TONES: readonly NarrativeTone[] = ['romance', 'dark_romance', 'mystery', 'adventure', 'comedy', 'tragedy'];
const VALID_SPICY_LEVELS: readonly SpicyLevel[] = [1, 2, 3, 4, 5];
const VALID_WORD_BUDGETS: readonly WordBudget[] = [600, 900, 1200, 1500];
const VALID_BATCH_SIZES: readonly ChapterBatchSize[] = [1, 2, 3];

export function parseStoryLabBlueprintFromBody(body: unknown): StoryLabBlueprintParseResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return buildError(['body'], ['Request body is required.']);
  }

  return parseStoryLabBlueprint(body as QuerySource, 'body');
}

export function parseStoryLabBlueprintFromQuery(query: QuerySource): StoryLabBlueprintParseResult {
  return parseStoryLabBlueprint(query, 'query');
}

function parseStoryLabBlueprint(source: QuerySource, mode: 'body' | 'query'): StoryLabBlueprintParseResult {
  const invalidFields: string[] = [];
  const messages: string[] = [];

  const rawCreature = getString(source.creature);
  const creature = parseOneOf(VALID_CREATURES, rawCreature);
  if (!creature) {
    invalidFields.push('creature');
    messages.push(`creature must be one of: ${VALID_CREATURES.join(', ')}.`);
  }

  const rawTone = getString(source.tone) ?? 'dark_romance';
  const tone = parseOneOf(VALID_TONES, rawTone);
  if (!tone) {
    invalidFields.push('tone');
    messages.push('tone is not supported.');
  }

  const spicyLevel = parseOneOf(VALID_SPICY_LEVELS, parseNumber(source.spicyLevel));
  if (!spicyLevel) {
    invalidFields.push('spicyLevel');
    messages.push('spicyLevel must be between 1 and 5.');
  }

  const desiredWordBudget = parseOneOf(VALID_WORD_BUDGETS, parseNumber(source.desiredWordBudget));
  if (!desiredWordBudget) {
    invalidFields.push('desiredWordBudget');
    messages.push('desiredWordBudget must be 600, 900, 1200, or 1500.');
  }

  const chapterBatchSize = parseOneOf(VALID_BATCH_SIZES, parseNumber(source.chapterBatchSize));
  if (!chapterBatchSize) {
    invalidFields.push('chapterBatchSize');
    messages.push('chapterBatchSize must be 1, 2, or 3.');
  }

  const logline = getString(source.logline)?.trim() ?? '';
  if (!logline) {
    invalidFields.push('logline');
    messages.push('logline is required.');
  }

  const themes = parseThemes(source.themes, mode);
  if (themes.error) {
    invalidFields.push('themes');
    messages.push(themes.error);
  }

  const heatContract = parseHeatContract(source.heatContract, mode);
  if (heatContract.error) {
    invalidFields.push('heatContract');
    messages.push(heatContract.error);
  }

  if (invalidFields.length > 0) {
    return buildError(invalidFields, messages);
  }

  return {
    blueprint: {
      creature: creature!,
      tone: tone!,
      logline,
      spicyLevel: spicyLevel!,
      desiredWordBudget: desiredWordBudget!,
      chapterBatchSize: chapterBatchSize!,
      themes: themes.value,
      heatContract: heatContract.value,
      narrativeDirectives: optionalString(source.narrativeDirectives),
      protagonistName: optionalString(source.protagonistName),
      antagonistName: optionalString(source.antagonistName),
      worldDetails: optionalString(source.worldDetails)
    }
  };
}

function buildError(invalidFields: string[], messages: string[]): StoryLabBlueprintParseResult {
  return {
    error: {
      code: 'INVALID_BLUEPRINT',
      message: messages.join(' '),
      invalidFields
    }
  };
}

function parseThemes(value: QueryValue, mode: 'body' | 'query'): { value: ThemeSeed[]; error?: undefined } | { value: ThemeSeed[]; error: string } {
  if (value === undefined || value === null || value === '') {
    return { value: [] };
  }

  const parsed = mode === 'query' ? parseJsonValue(value) : value;
  if (!Array.isArray(parsed)) {
    return { value: [], error: 'themes must be an array of theme seeds.' };
  }

  if (!parsed.every(isThemeSeed)) {
    return { value: [], error: 'themes must include id, label, and description strings.' };
  }

  return { value: parsed };
}

function parseHeatContract(
  value: QueryValue,
  mode: 'body' | 'query'
): { value?: HeatContract; error?: undefined } | { value?: undefined; error: string } {
  if (value === undefined || value === null || value === '') {
    return { value: undefined };
  }

  const parsed = mode === 'query' ? parseJsonValue(value) : value;
  if (!isHeatContract(parsed)) {
    return { error: 'heatContract must include adult confirmation, tension mode, intimacy boundary, and optional no-go content.' };
  }

  return { value: parsed };
}

function parseJsonValue(value: QueryValue): unknown {
  const raw = getString(value);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function getString(value: QueryValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function optionalString(value: QueryValue): string | undefined {
  const raw = getString(value)?.trim();
  return raw ? raw : undefined;
}

function parseNumber(value: QueryValue): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const raw = getString(value);
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOneOf<T extends string | number>(allowed: readonly T[], value: unknown): T | undefined {
  return allowed.includes(value as T) ? value as T : undefined;
}

function isThemeSeed(value: unknown): value is ThemeSeed {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.description === 'string';
}

function isHeatContract(value: unknown): value is HeatContract {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.adultOnlyConfirmed === 'boolean'
    && parseOneOf(['slow_burn', 'dangerous_proximity', 'playful_banter', 'devotional_longing'] as const, candidate.tensionMode) !== undefined
    && parseOneOf(['fade_to_black', 'closed_door', 'literary_on_page'] as const, candidate.intimacyBoundary) !== undefined
    && (candidate.noGoContent === undefined || typeof candidate.noGoContent === 'string');
}
