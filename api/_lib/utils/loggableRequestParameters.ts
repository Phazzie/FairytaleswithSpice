// Created: 2026-08-25 05:20 UTC

import { VALIDATION_RULES } from '../types/contracts';

const ALLOWED_THEMES: readonly string[] = VALIDATION_RULES.themes.allowedValues;

/**
 * The creatures `CreatureType` names, listed so a value can be checked at run
 * time. `validateStoryInput` has its own copy and rejects anything outside it —
 * but it runs after the request line is written, and the route checks that
 * reach the log first test only that the field is present, so `creature` is
 * caller text at the moment it would be logged.
 */
const ALLOWED_CREATURES: readonly string[] = [
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

/** What is written in place of a value that is not on its allow-list. */
export const UNRECOGNIZED_PARAMETER = '[UNRECOGNIZED]';

/**
 * Log a creature only when it is one, so an unknown value is reported as
 * unknown rather than repeated. Unlike `themes` this is a single field with no
 * count to fall back on, so the marker stands in for it.
 */
export function toLoggableCreature(creature: unknown): string {
  return typeof creature === 'string' && ALLOWED_CREATURES.includes(creature)
    ? creature
    : UNRECOGNIZED_PARAMETER;
}

/**
 * The shape of an identifier this repository would have minted.
 *
 * Two weaker rules were tried first and both let prose through:
 *
 * - A length cap is not a filter. `Dana is in treatment at the clinic on
 *   Rosewood` is forty-five characters and fits inside any cap worth having.
 * - An alphabet is not a filter either. `Dana_is_in_treatment_at_Rosewood` is
 *   built entirely from letters and underscores, so a class of `[A-Za-z0-9_-]`
 *   admits it whole — the separators prose is written with when spaces are
 *   unavailable are the same ones an id uses.
 *
 * What every id here actually has is a UUID: `story_<uuid>` from
 * `generateStoryId`, `story_stream_<uuid>` from the stream route, `req_<uuid>`,
 * `img-<uuid>`. A UUID is thirty-two hex digits in a fixed grouping, which no
 * sentence produces by accident, so the pattern is an id-shaped prefix followed
 * by one. That is a property of the value rather than of its punctuation, and
 * it is the reason this rule holds where the other two did not.
 */
const LOGGABLE_IDENTIFIER_PATTERN =
  /^[A-Za-z0-9_-]{0,32}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LoggableThemes {
  themes: string[];
  unrecognizedThemeCount?: number;
}

/**
 * Reduce a caller's `themes` to the part of it a log may repeat.
 *
 * `themes` is documented as a closed set — `VALIDATION_RULES.themes.allowedValues`
 * — but `validateStoryInput` only ever checked that the array is an array and
 * that it holds at most five entries, never that the entries are on the list.
 * The streaming route builds the array by splitting a query string, so every
 * value in it is whatever the caller typed. That did not matter while these
 * parameters travelled under the `userInput` log key, because the redactor
 * blanked the whole object; under a key that is deliberately kept, it would put
 * caller prose in the console and the log buffer verbatim.
 *
 * So the log gets the theme ids it recognises and a count of what it did not,
 * which is the whole of the diagnostic value — which themes were asked for —
 * without any of the text. Filtering rather than redacting is what keeps the
 * ordinary request, whose themes are all on the list, logged exactly as it is.
 */
export function toLoggableThemes(themes: unknown): LoggableThemes {
  if (!Array.isArray(themes)) {
    return { themes: [] };
  }

  const recognized: string[] = [];
  let unrecognized = 0;

  for (const theme of themes) {
    if (typeof theme === 'string' && ALLOWED_THEMES.includes(theme)) {
      recognized.push(theme);
      continue;
    }

    unrecognized += 1;
  }

  return unrecognized > 0
    ? { themes: recognized, unrecognizedThemeCount: unrecognized }
    : { themes: recognized };
}

/**
 * Log a number only when it is one.
 *
 * `spicyLevel`, `wordCount`, `currentChapterCount`, and `requestedChapterCount`
 * are typed as numbers by the contract and are numbers in every request the app
 * itself makes — but a raw POST carries whatever JSON the caller wrote, and the
 * checks that run before these log calls test presence rather than type. The
 * stream route is the exception, having already parsed and range-checked its
 * two; running them through here as well costs nothing and means the guarantee
 * belongs to the log call rather than to the order of the checks above it.
 *
 * An absent value is omitted, so the marker means the caller sent a non-number
 * rather than nothing.
 */
export function toLoggableNumber(value: unknown): number | string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : UNRECOGNIZED_PARAMETER;
}

/** The same, for a flag. `maintainTone` is the one this repository logs. */
export function toLoggableBoolean(value: unknown): boolean | string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === 'boolean' ? value : UNRECOGNIZED_PARAMETER;
}

/**
 * Log an identifier only when it is shaped like one.
 *
 * A story id is the field that correlates a log line with the request it
 * belongs to, so it is worth keeping — but it arrives from the caller like
 * every other field, and nothing on the way here constrains it. Matching the
 * minted shape means a value either is an id this repository would have
 * produced, and is logged, or is not, and is reported as unrecognised without
 * its text.
 *
 * Missing is not the same as unrecognised: an absent id is omitted, so the
 * marker means "the caller sent something that was not an id" rather than
 * "there was no id".
 */
export function toLoggableIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const trimmed = value.trim();

  return LOGGABLE_IDENTIFIER_PATTERN.test(trimmed) ? trimmed : UNRECOGNIZED_PARAMETER;
}
