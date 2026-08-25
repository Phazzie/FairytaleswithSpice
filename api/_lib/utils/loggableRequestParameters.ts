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
 * A length cap alone is not a filter: `Dana is in treatment at the clinic on
 * Rosewood` is forty-five characters and would have gone into the log intact.
 * What separates an id from a sentence is its alphabet, not its length — every
 * id here is `story_<uuid>`, `req_<uuid>`, or `img-<uuid>`, so letters, digits,
 * `_`, and `-` describe all of them and admit no spaces or punctuation for
 * prose to hide in. The length bound stays as a second limit so that a long run
 * of allowed characters cannot be used as one either.
 */
const LOGGABLE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

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
 * Log an identifier only when it is shaped like one.
 *
 * A story id is the field that correlates a log line with the request it
 * belongs to, so it is worth keeping — but it arrives from the caller like
 * every other field, and nothing on the way here constrains it. Truncating was
 * not enough: prose shorter than the cap passed through whole, which is most
 * prose. Matching the shape instead means a value either looks like an id this
 * repository would have minted, and is logged, or does not, and is reported as
 * unrecognised without its text.
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
