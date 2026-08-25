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
 * The longest an identifier is allowed to be before the log keeps only its
 * head. Every id this repository mints — `story_<uuid>`, `req_<uuid>`,
 * `img-<uuid>` — is well under it, so a real id is never touched; the cap is
 * here for a caller that sends something else under the name of one.
 */
const MAX_LOGGABLE_IDENTIFIER_LENGTH = 64;

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
 * Keep an identifier loggable without letting it become a paragraph.
 *
 * A story id is the one field that correlates a log line with the request it
 * belongs to, so it is worth keeping — but it arrives from the caller like any
 * other field, and nothing constrains its shape. An id fits well inside the
 * cap; prose sent in its place does not, and is cut to a length that is
 * useless as a hiding place while still identifying the request.
 */
export function toLoggableIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > MAX_LOGGABLE_IDENTIFIER_LENGTH
    ? `${trimmed.slice(0, MAX_LOGGABLE_IDENTIFIER_LENGTH)}…`
    : trimmed;
}
