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
  maxNoGoContentLength: 320
} as const;

export type StoryBlueprintLimits = typeof STORY_BLUEPRINT_LIMITS;

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
