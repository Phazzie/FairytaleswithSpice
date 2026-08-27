// Created: 2026-08-27 UTC

/**
 * The five heat levels every `spicyLevel` in this repository carries.
 *
 * Spice level was one of the three numeric blueprint vocabularies given a table
 * when the Story Lab picker and `parseStoryLabBlueprint` were caught writing
 * their own copies out; the table went into the Angular contract, where the
 * picker and `FormValidationService` read it, and everything on the Story Lab
 * side has read it since. The classic side kept the copy it had, and it is the
 * copy that decides what the wire accepts: `VALIDATION_RULES.spicyLevel` was
 * `{ min: 1, max: 5 }`, two bare numbers with no relationship to the scale,
 * read by `StoryService.validateStoryInput` as a range check and rendered into
 * its own refusal as the prose `(1-5)`.
 *
 * That copy is the last statement of the scale on the path a request actually
 * takes, and each way it could drift fails silently in its own direction. A
 * sixth level added to the table is offered by the picker, accepted by the
 * blueprint parser, and then refused by the classic seam the Story Lab hands
 * its blueprint to — a level the app taught itself to offer, rejected as
 * `INVALID_INPUT` after the reader pressed generate, by a rule naming a ceiling
 * nobody told it had moved. Narrow the table without narrowing the rule and the
 * failure is the quieter one: the request is accepted at a level no rung of
 * `SPICE_LEVEL_PROMPT_RUNGS` describes, so `readSpiceLevelPromptLabel` falls
 * back to `Spicy` and the model is sent a `SPICE LEVEL:` line naming a rung the
 * system prompt beside it never defines.
 *
 * The range check is why membership is what this module answers. A range is
 * only the same question as membership while the table is contiguous and
 * whole-numbered — which is exactly the property nothing anywhere states — and
 * `Number.isInteger` was doing half of that work at one of the two callers and
 * nowhere else.
 *
 * Kept in `shared/` beside `creatureVocabulary`, `themeVocabulary`, and
 * `chapterBatchVocabulary`, for the reason those give: this module sits below
 * both trees and can import neither, which is what lets the API's contract and
 * the Angular picker read one list.
 */
export const SPICY_LEVELS = [1, 2, 3, 4, 5] as const;

/**
 * The union, read from the table rather than restated beside it.
 *
 * Derived rather than declared-and-`satisfies`-checked for the reason
 * `ChapterBatchSize` gives: a `satisfies` clause catches a *wrong* entry, and
 * every copy of this list could only ever go wrong by being short one.
 */
export type SpicyLevel = typeof SPICY_LEVELS[number];

const SPICY_LEVEL_SET: ReadonlySet<unknown> = new Set<unknown>(SPICY_LEVELS);

/** Whether `value` is a level this app writes at, checked against the table. */
export function isSpicyLevel(value: unknown): value is SpicyLevel {
  return SPICY_LEVEL_SET.has(value);
}

/**
 * The levels as a refusal names them, read from the table it checks.
 *
 * Rendered as a list rather than the `1-5` range the message used, for the
 * reason `formatChapterBatchSizeList` gives: a range is only honest while the
 * table is contiguous and a list is honest either way. Today it reads
 * `1, 2, 3, 4, or 5`.
 */
export function formatSpicyLevelList(): string {
  const levels: readonly number[] = SPICY_LEVELS;

  return levels.length > 1
    ? `${levels.slice(0, -1).join(', ')}, or ${levels[levels.length - 1]}`
    : levels.join('');
}
