// Created: 2026-06-04 00:00 EDT

import type {
  HeatContract,
  StoryGenerationSeam,
  ThemeSeed
} from '../contracts';
import {
  CHAPTER_BATCH_SIZES,
  CREATURE_ARCHETYPES,
  HEAT_INTIMACY_BOUNDARIES,
  HEAT_TENSION_MODES,
  NARRATIVE_TONES,
  SPICY_LEVELS,
  WORD_BUDGETS
} from '../contracts';
import { STORY_BLUEPRINT_LIMITS } from '../../../../shared/storyBlueprintLimits';

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

/**
 * What a blueprint may say, read from the contract rather than restated here.
 *
 * These five lists were written out again in this file and a third time in
 * `FormValidationService`, which validates the same blueprint in the browser
 * before it is sent. Two hand-kept copies of the same vocabulary is the
 * arrangement where the form accepts a value the route refuses, and the reader
 * learns which by pressing generate and being answered `400 INVALID_BLUEPRINT`
 * naming a field by its wire name. The contract's tables are the ones the
 * profile store already validates against; this is the same reading.
 */
const VALID_CREATURES = CREATURE_ARCHETYPES;
const VALID_TONES = NARRATIVE_TONES;
const VALID_SPICY_LEVELS = SPICY_LEVELS;
const VALID_WORD_BUDGETS = WORD_BUDGETS;
const VALID_BATCH_SIZES = CHAPTER_BATCH_SIZES;

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

  const rawCreature = getString(source['creature']);
  const creature = parseOneOf(VALID_CREATURES, rawCreature);
  if (!creature) {
    invalidFields.push('creature');
    messages.push(`creature must be one of: ${VALID_CREATURES.join(', ')}.`);
  }

  const rawTone = getString(source['tone']) ?? 'dark_romance';
  const tone = parseOneOf(VALID_TONES, rawTone);
  if (!tone) {
    invalidFields.push('tone');
    messages.push('tone is not supported.');
  }

  const spicyLevel = parseOneOf(VALID_SPICY_LEVELS, parseNumber(source['spicyLevel']));
  if (!spicyLevel) {
    invalidFields.push('spicyLevel');
    messages.push(`spicyLevel must be one of: ${VALID_SPICY_LEVELS.join(', ')}.`);
  }

  const desiredWordBudget = parseOneOf(VALID_WORD_BUDGETS, parseNumber(source['desiredWordBudget']));
  if (!desiredWordBudget) {
    invalidFields.push('desiredWordBudget');
    messages.push(`desiredWordBudget must be one of: ${VALID_WORD_BUDGETS.join(', ')}.`);
  }

  const chapterBatchSize = parseOneOf(VALID_BATCH_SIZES, parseNumber(source['chapterBatchSize']));
  if (!chapterBatchSize) {
    invalidFields.push('chapterBatchSize');
    messages.push(`chapterBatchSize must be one of: ${VALID_BATCH_SIZES.join(', ')}.`);
  }

  const logline = getString(source['logline'])?.trim() ?? '';
  if (!logline) {
    invalidFields.push('logline');
    messages.push('logline is required.');
  } else if (logline.length > STORY_BLUEPRINT_LIMITS.maxLoglineLength) {
    invalidFields.push('logline');
    messages.push(`logline must be ${STORY_BLUEPRINT_LIMITS.maxLoglineLength} characters or fewer.`);
  }

  const themes = parseThemes(source['themes'], mode);
  if (themes.error) {
    invalidFields.push('themes');
    messages.push(themes.error);
  } else if (themes.value.length > STORY_BLUEPRINT_LIMITS.maxThemes) {
    invalidFields.push('themes');
    messages.push(`themes must include no more than ${STORY_BLUEPRINT_LIMITS.maxThemes} theme seeds.`);
  } else {
    // How many seeds arrived was measured; how large one is was not. See
    // `maxThemeLabelLength` for where an uncapped seed ends up — the continuity
    // model call, and a plot thread stored with the project.
    const oversized = describeOversizedThemeSeed(themes.value);
    if (oversized) {
      invalidFields.push('themes');
      messages.push(oversized);
    }
  }

  // The optional free-text fields are read here rather than at the point they
  // are returned, because a value past its cap has to be reported as an invalid
  // field alongside every other one — the parser answers with the whole list of
  // what has to be fixed, not with the first thing it noticed.
  const narrativeDirectives = optionalString(source['narrativeDirectives']);
  if (isLongerThan(narrativeDirectives, STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength)) {
    invalidFields.push('narrativeDirectives');
    messages.push(`narrativeDirectives must be ${STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength} characters or fewer.`);
  }

  const worldDetails = optionalString(source['worldDetails']);
  if (isLongerThan(worldDetails, STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength)) {
    invalidFields.push('worldDetails');
    messages.push(`worldDetails must be ${STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength} characters or fewer.`);
  }

  // The two free-text fields that were read straight into the returned
  // blueprint without ever being measured, while the four above them were. The
  // cap is the point of the shared limits object: `buildContinuityPrompt`
  // stringifies both of these into the continuity model call exactly as they
  // arrived, so a caller that skips the form — the query-string genesis stream
  // takes the same blueprint — could put a megabyte of prose in a field named
  // for one person and have it billed by the token, then stored in the story
  // state the response carries back.
  const protagonistName = optionalString(source['protagonistName']);
  if (isLongerThan(protagonistName, STORY_BLUEPRINT_LIMITS.maxCharacterNameLength)) {
    invalidFields.push('protagonistName');
    messages.push(`protagonistName must be ${STORY_BLUEPRINT_LIMITS.maxCharacterNameLength} characters or fewer.`);
  }

  const antagonistName = optionalString(source['antagonistName']);
  if (isLongerThan(antagonistName, STORY_BLUEPRINT_LIMITS.maxCharacterNameLength)) {
    invalidFields.push('antagonistName');
    messages.push(`antagonistName must be ${STORY_BLUEPRINT_LIMITS.maxCharacterNameLength} characters or fewer.`);
  }

  // The blueprint contract types `heatContract` as required, and the engine
  // refuses every genesis without one before it generates anything — an absent
  // contract came back as `CONTENT_POLICY_VIOLATION` from the other side of the
  // route rather than as the named invalid field this parser exists to report.
  // Meanwhile the parser handed back a blueprint whose declared type said the
  // field was there and whose value was `undefined`, which the serverless
  // build's looser configuration did not catch and the Angular app's strict one
  // does. Naming it here answers the same 400 with the field that has to be
  // fixed, and makes the parsed blueprint match the type it is returned as.
  const heatContract = parseHeatContract(source['heatContract'], mode);
  if (heatContract.error) {
    invalidFields.push('heatContract');
    messages.push(heatContract.error);
  } else if (!heatContract.value) {
    invalidFields.push('heatContract');
    messages.push('heatContract is required and must include adult confirmation, tension mode, and intimacy boundary.');
  } else if (isLongerThan(heatContract.value.noGoContent, STORY_BLUEPRINT_LIMITS.maxNoGoContentLength)) {
    invalidFields.push('heatContract');
    messages.push(`heatContract.noGoContent must be ${STORY_BLUEPRINT_LIMITS.maxNoGoContentLength} characters or fewer.`);
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
      heatContract: heatContract.value!,
      narrativeDirectives,
      protagonistName,
      antagonistName,
      worldDetails
    }
  };
}

/**
 * Name the first theme seed whose own text is past its cap, or `null`.
 *
 * One message for the whole array rather than one per seed, because `themes`
 * is a single invalid field either way and the caller fixes the array. The
 * index is in it so the caller knows which seed, and the field name so they
 * know which half of it.
 */
function describeOversizedThemeSeed(themes: readonly ThemeSeed[]): string | null {
  const caps = [
    { field: 'label', limit: STORY_BLUEPRINT_LIMITS.maxThemeLabelLength },
    { field: 'description', limit: STORY_BLUEPRINT_LIMITS.maxThemeDescriptionLength }
  ] as const;

  for (const [index, theme] of themes.entries()) {
    for (const { field, limit } of caps) {
      if (theme[field].length > limit) {
        return `themes[${index}].${field} must be ${limit} characters or fewer.`;
      }
    }
  }

  return null;
}

/**
 * Whether an optional free-text field is past its cap. An absent field is not:
 * every one of these is optional, so "not provided" and "too long" are
 * different answers.
 */
function isLongerThan(value: string | undefined, limit: number): boolean {
  return value !== undefined && value.length > limit;
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

  // Size is measured by `describeOversizedThemeSeed` at the caller, where the
  // seed's index is in scope and the message can name which of the array's
  // entries has to be shortened.
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

/**
 * Read one blueprint field as a string, or answer that it is not one.
 *
 * The repeated-value form is read first because a query string carries one for
 * every parameter sent twice — and `value[0]` was handed straight back, typed
 * `string` on the strength of the `QueryValue` union rather than checked. On
 * the query path that holds: a runtime parses `?logline=a&logline=b` into an
 * array of strings. On the *body* path it does not. `parseStoryLabBlueprintFromBody`
 * casts a parsed JSON object to `QuerySource`, so an array field there holds
 * whatever the caller put in it, and `{"logline": [42]}` handed a `number` to
 * every caller that had been promised a string:
 * `getString(source['logline'])?.trim()` is a `TypeError`, `?.` being no help
 * against a value that is present and merely of the wrong type.
 *
 * That throw leaves this parser entirely. The route's own catch answers `500
 * INTERNAL_ERROR` — the service failed, try again — for a body only the caller
 * can fix, on the one field the parser exists to refuse with `400
 * INVALID_BLUEPRINT` and a message naming it. It is the same failure
 * `readJsonObjectBody` was written for one layer up, arriving through a field
 * rather than through the body itself: `logline`, `worldDetails`,
 * `narrativeDirectives`, `protagonistName`, `antagonistName`, and
 * `heatContract` are all read through this helper and a trim, so any one of
 * them wrapped in an array is a 500.
 *
 * So the first entry is read under the same rules as a bare value: a string is
 * itself, a number or a boolean is spelled out, and anything else — an object,
 * a nested array, `null` — is not a string and is reported as the missing or
 * invalid field it is.
 */
function getString(value: QueryValue): string | undefined {
  const scalar = Array.isArray(value) ? value[0] : value;

  if (typeof scalar === 'string') {
    return scalar;
  }
  if (typeof scalar === 'number' || typeof scalar === 'boolean') {
    return String(scalar);
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
  return typeof candidate['id'] === 'string'
    && typeof candidate['label'] === 'string'
    && typeof candidate['description'] === 'string';
}

function isHeatContract(value: unknown): value is HeatContract {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate['adultOnlyConfirmed'] === 'boolean'
    && parseOneOf(HEAT_TENSION_MODES, candidate['tensionMode']) !== undefined
    && parseOneOf(HEAT_INTIMACY_BOUNDARIES, candidate['intimacyBoundary']) !== undefined
    && (candidate['noGoContent'] === undefined || typeof candidate['noGoContent'] === 'string');
}
