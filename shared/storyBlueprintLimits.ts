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
 * budget, and nothing on the server ever said no. The same reasoning capped
 * `storyContent` on `/api/story-lab/evaluate`.
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
