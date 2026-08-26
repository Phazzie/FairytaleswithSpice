// Created: 2026-08-25 14:05 UTC

/**
 * The size limits a story blueprint has to satisfy.
 *
 * These were written once, in the Angular `FormValidationService`, and enforced
 * nowhere else. The blueprint the browser assembles is not the only blueprint
 * the API sees: `/api/story-lab/stories` takes one as a POST body and
 * `/api/story-lab/stream/genesis` takes one as a query string, and every
 * free-text field on it — the logline, the world details, the narrative
 * directives, the Heat Contract's no-go list — is interpolated straight into
 * the Grok prompt. A caller that skips the form, or a stale tab running an
 * older bundle, could therefore send a megabyte of prose into a paid model
 * call: the request is billed by the token, it eats the function's whole time
 * budget, and nothing on the server ever said no. `STORY_EVALUATION_LIMITS`
 * below applies the same reasoning to `/api/story-lab/evaluate`.
 *
 * Defining them here rather than restating them on the server is what keeps a
 * later change to one of these numbers from splitting the two readings apart —
 * a form that accepts a 600-character logline against an API that refuses it is
 * worse than either limit alone, because the refusal arrives only after the
 * reader has written the thing.
 */
export const STORY_BLUEPRINT_LIMITS = {
  /** Thematic seeds the generator will weave into one story. */
  maxThemes: 5,
  maxLoglineLength: 420,
  maxWorldDetailsLength: 600,
  maxNarrativeDirectivesLength: 1200,
  maxNoGoContentLength: 320,
  /**
   * The three strings a theme seed is made of.
   *
   * `themes` was the one field above counted but never measured. The parser
   * checks that the array holds no more than `maxThemes` entries and that each
   * carries `id`, `label`, and `description` strings — and then accepts a
   * megabyte under any of the three, which is exactly the failure the paragraph
   * above says these numbers exist to prevent. It named "the logline, the world
   * details, the narrative directives, the Heat Contract's no-go list" and
   * stopped there, and a theme seed is free text arriving on the same two routes.
   *
   * Where it goes is worse than the other four. `buildContinuityPrompt`
   * interpolates `themes.map(theme => theme.label)` into the continuity
   * extraction prompt with no cap, beside `existingState.threads` — whose
   * `label` and `description` `buildInitialThreads` seeds from these same
   * strings. So an oversized seed is not spent once on the genesis call: it is
   * written into the story state, persisted with it, and re-sent on every
   * continuation of that story for as long as the serial runs. The chapter prose
   * beside it in that prompt is capped at 2,200 code points precisely because
   * prompt size is billed and bounded; the theme text next to it was not capped
   * at all.
   *
   * The numbers are the ones the repository already chose for these fields
   * rather than new ones: 80 and 280 are `StoryService`'s own
   * `STORY_LAB_THEME_LABEL_MAX_LENGTH` and
   * `STORY_LAB_THEME_DESCRIPTION_MAX_LENGTH`, which it truncates seeds to before
   * building a prompt, and 80 is what `STORY_EVALUATION_LIMITS` below already
   * calls "one theme id or creature name, not a paragraph wearing the field's
   * name". Refusing at the route what the prompt builder would silently cut is
   * the difference between a caller being told their seed is too long and a
   * caller being billed for a story generated from a seed they cannot see the
   * end of.
   */
  maxThemeIdLength: 80,
  maxThemeLabelLength: 80,
  maxThemeDescriptionLength: 280
} as const;

export type StoryBlueprintLimits = typeof STORY_BLUEPRINT_LIMITS;

/**
 * Say whether an assembled `narrativeDirectives` value will clear the cap the
 * blueprint routes enforce, and by how much it misses.
 *
 * A caller that assembles this field from parts rather than from a textarea has
 * no field length in front of the reader to warn them with. Proving Grounds is
 * that caller: it packs the selected prompt template's system and user prompts —
 * and, once the reader has asked to see it, the generation-logic summary — into
 * this one field, which is thousands of characters for the template the page
 * opens on. The route answers `400 INVALID_INPUT` for every one of those, so the
 * page's own default configuration could not generate, and the round trip it
 * spent to find that out told the reader only that generation had failed.
 *
 * `.trim().length` is not incidental: the parser reads this field through a
 * helper that trims before it measures, so a value whose surrounding whitespace
 * is what pushes it over the cap is one the API accepts. Measuring it any other
 * way here would refuse a request the route would have taken — the mirror of the
 * failure this exists to prevent.
 */
export function describeNarrativeDirectivesOverflow(directives: string): string | null {
  const limit = STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength;
  const length = directives.trim().length;

  return length <= limit
    ? null
    : `Narrative directives are ${length} characters and this API accepts ${limit}.`;
}

/**
 * The size limits an evaluation request has to satisfy.
 *
 * `/api/story-lab/evaluate` checked that `storyContent` was a non-empty string
 * and then interpolated the whole of it into the Grok prompt, with the
 * configuration's `creature` and every entry of `themes` beside it. Nothing
 * bounded any of the three, so the one route in this repository that takes
 * arbitrary prose from the caller — rather than generating it — was also the
 * one route that would forward any amount of it to a model billed by the
 * token. The blueprint routes have refused an oversized field since
 * `STORY_BLUEPRINT_LIMITS` was introduced; this route was described in the
 * comment above as if it did the same, and did not.
 *
 * The story cap is the loose one on purpose. A caller evaluates a whole
 * accumulated saga, not one batch, so the number has to clear a long story
 * comfortably — 60,000 characters is roughly ten thousand words — while still
 * being a number. The theme and creature caps match what the blueprint routes
 * already accept, because these fields name the same things.
 */
export const STORY_EVALUATION_LIMITS = {
  maxStoryContentLength: 60_000,
  maxThemes: STORY_BLUEPRINT_LIMITS.maxThemes,
  /** One theme id or creature name, not a paragraph wearing the field's name. */
  maxConfigurationValueLength: 80
} as const;

export type StoryEvaluationLimits = typeof STORY_EVALUATION_LIMITS;
