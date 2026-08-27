// Created: 2026-08-25 05:20 UTC

import { STORY_LAB_THEME_SEED_IDS } from '../../../shared/storyLabThemeSeeds';
import { EXPORT_FORMATS, VALIDATION_RULES } from '../types/contracts';

/**
 * The theme ids a log line may repeat, which is both vocabularies the seams
 * accept — not just the classic one.
 *
 * `VALIDATION_RULES.themes.allowedValues` names the eighteen `ThemeType`s, and
 * on its own that is the wrong list to filter a log against: no screen in this
 * repository sends those. `app.ts` builds its picker from the twelve Story Lab
 * seeds and passes `theme.id` through unchanged, and seven of the twelve —
 * `court_intrigue`, `blood_oaths`, `slow_burn`, `enemies_to_lovers`,
 * `magical_bargain`, `secret_identity`, and `forced_proximity` — are on neither
 * the classic list nor any of its synonyms.
 *
 * So the filter below was rejecting the app's own traffic. A reader who picked
 * "Court Intrigue" and "Blood Oaths" and generated a chapter image produced the
 * request line `themes: [], unrecognizedThemeCount: 2` — the marker that exists
 * to say "the caller sent something that is not a theme", written about the two
 * themes the picker itself offered. The diagnostic this whole module exists to
 * preserve, which themes were asked for, was blanked for exactly the requests
 * that matter, and left intact only for a vocabulary nothing sends.
 *
 * Both are legitimate input — the seams type `themes` as `string[]`, and
 * `ImageService.mapThemeToVisualElement` answers both for the same reason — so
 * both are recognised here. `unrecognizedThemeCount` goes back to meaning what
 * it says: a value that came from neither picker.
 */
const ALLOWED_THEMES: readonly string[] = [
  ...VALIDATION_RULES.themes.allowedValues,
  ...STORY_LAB_THEME_SEED_IDS
];

/**
 * The image styles `ImageStyle` names, listed so a value can be checked at run
 * time — the same arrangement as `ALLOWED_CREATURES`, and for the same reason.
 * `ImageService.validateImageInput` holds its own copy and refuses anything
 * outside it, but that runs after `/api/image/generate` has written its request
 * line, and the route's own guard tests only that the field is present.
 */
const ALLOWED_IMAGE_STYLES: readonly string[] = VALIDATION_RULES.imageStyle.allowedValues;

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
 * Log an image style only when it is one.
 *
 * `/api/image/generate` writes `style: input.style` on its request line, and
 * `style` reaches that line as whatever JSON the caller wrote: the route's
 * guard tests the field for truthiness, and the closed-set check lives in
 * `ImageService`, which has not run yet. So a body of
 * `{"style": "Dana is in treatment at the clinic on Rosewood", …}` put that
 * sentence in the console and in the log buffer verbatim — the one field on
 * that line still carrying caller text, beside `creature`, `themes`, and
 * `storyId`, each of which is on this module precisely so it cannot.
 *
 * The redaction every logged string still passes through does not cover it:
 * that removes credentials, addresses, and URLs, not prose.
 *
 * `ImageStyle` is five values, so there is a list to be recognised against, and
 * a request the app itself makes — which always sends one of the five — is
 * logged exactly as it was.
 */
export function toLoggableImageStyle(style: unknown): string {
  return typeof style === 'string' && ALLOWED_IMAGE_STYLES.includes(style)
    ? style
    : UNRECOGNIZED_PARAMETER;
}

/**
 * Log an export format only when it is one.
 *
 * The same reading `toLoggableImageStyle` gets above, for the same position in
 * the same kind of route: `/api/export/save` checks `format` for presence and
 * leaves the closed-set check to `ExportService.validateExportInput`, which runs
 * after the request line would be written. `EXPORT_FORMATS` is five values, so
 * every export the app itself makes is logged exactly as it was.
 */
export function toLoggableExportFormat(format: unknown): string {
  return typeof format === 'string' && (EXPORT_FORMATS as readonly string[]).includes(format)
    ? format
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
 * - A UUID with a free prefix is not a filter either, for the third time in the
 *   same shape: `Dana_at_Rosewood_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f` carries
 *   a real UUID and thirty-two characters of caller text in front of it. What
 *   the prefix is has to be decided, not merely bounded.
 *
 * So the rule is the whole minted form, not a description of one. A story id is
 * written in exactly three places — `story_<uuid>` in `StoryService`,
 * `story_stream_<uuid>` in the stream route, and `story-<uuid>` in the Story Lab
 * mock data — and this helper is only ever asked about story ids, so those three
 * are the alternatives. Nothing precedes the `story` and nothing follows the
 * UUID, which leaves no room for text to travel alongside the part that looks
 * legitimate.
 */
const LOGGABLE_STORY_ID_PATTERN =
  /^story(?:_|-|_stream_)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LoggableThemes {
  themes: string[];
  unrecognizedThemeCount?: number;
}

/**
 * The field names each malformed-request log line may repeat, taken from the
 * seam contracts the routes serve.
 *
 * They are listed rather than derived because a contract is a TypeScript type
 * and has no run-time form to read; keeping them here puts them beside the
 * other allow-lists in this module rather than in three route files that would
 * each drift on their own.
 */
export const STORY_GENERATION_REQUEST_FIELDS: readonly string[] = [
  'creature',
  'themes',
  'userInput',
  'spicyLevel',
  'wordCount',
  'requestedChapterCount',
  'generationContext'
];

export const CHAPTER_CONTINUATION_REQUEST_FIELDS: readonly string[] = [
  'storyId',
  'currentChapterCount',
  'existingContent',
  'userInput',
  'maintainTone',
  'tropeMetadata',
  'requestedChapterCount',
  'generationContext'
];

export const IMAGE_GENERATION_REQUEST_FIELDS: readonly string[] = [
  'storyId',
  'content',
  'imagePrompt',
  'creature',
  'themes',
  'style',
  'aspectRatio'
];

/** `SaveExportSeam['input']`, for `/api/export/save`'s refusal line. */
export const EXPORT_REQUEST_FIELDS: readonly string[] = [
  'storyId',
  'content',
  'title',
  'format',
  'includeMetadata',
  'includeChapters',
  'creature',
  'themes'
];

export interface LoggableFieldNames {
  receivedFields: string[];
  unrecognizedFieldCount?: number;
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
 * Reduce the field names of a caller's request body to the part a log may
 * repeat.
 *
 * The three legacy story routes each answered a malformed body with
 * `logWarn('Invalid input - missing required fields', …, { receivedFields:
 * Object.keys(input) })`. A JSON object's keys are chosen by whoever wrote the
 * body, so that is the caller's own text — the same text `toLoggableThemes` and
 * `toLoggableStoryId` exist to keep out of the log, arriving through the one
 * door nobody had checked. A request body of
 * `{"Dana is in treatment at Rosewood": 1}` put that sentence in the console and
 * in the log buffer verbatim, and it is the *malformed* requests — the ones a
 * caller is most likely to have hand-written — that take this path.
 *
 * The token redaction every logged string still goes through does not help
 * here: it removes credentials, addresses, and URLs, not prose.
 *
 * So the line gets the field names it recognises and a count of what it did
 * not. That is the whole of the diagnostic value — which required fields the
 * caller actually sent — without any of the text, and a body whose fields are
 * all on the contract, which is every request the app itself makes, is logged
 * exactly as it was.
 */
export function toLoggableFieldNames(body: unknown, knownFields: readonly string[]): LoggableFieldNames {
  if (!body || typeof body !== 'object') {
    return { receivedFields: [] };
  }

  const present = new Set(Object.keys(body));
  // Emitted in the contract's order rather than the caller's, so two requests
  // carrying the same fields produce the same line.
  const receivedFields = knownFields.filter(field => present.has(field));
  const unrecognized = present.size - receivedFields.length;

  return unrecognized > 0
    ? { receivedFields, unrecognizedFieldCount: unrecognized }
    : { receivedFields };
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
 * Log a story id only when it is one.
 *
 * A story id is the field that correlates a log line with the request it
 * belongs to, so it is worth keeping — but it arrives from the caller like
 * every other field, and nothing on the way here constrains it. Matching the
 * minted forms means a value either is a story id this repository would have
 * produced, and is logged, or is not, and is reported as unrecognised without
 * its text.
 *
 * Missing is not the same as unrecognised: an absent id is omitted, so the
 * marker means "the caller sent something that was not an id" rather than
 * "there was no id".
 */
export function toLoggableStoryId(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const trimmed = value.trim();

  return LOGGABLE_STORY_ID_PATTERN.test(trimmed) ? trimmed : UNRECOGNIZED_PARAMETER;
}
