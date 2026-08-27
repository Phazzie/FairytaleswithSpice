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
  /**
   * One theme seed's own text, not a paragraph wearing a seed's field names.
   *
   * `maxThemes` bounded how many seeds a blueprint may carry and nothing
   * bounded how large one is. A seed is `{ id, label, description }`, and the
   * parser checked only that all three are strings — so five seeds was five
   * unbounded free-text fields, on the same routes and for the same reasons as
   * the two names below.
   *
   * They travel further than the names do. `buildContinuityPrompt` puts every
   * `theme.label` into the JSON payload the continuity extractor sends,
   * verbatim and at whatever length arrived; `buildInitialThreads` writes each
   * seed's `label` and `description` into a `PlotThread` on the story state,
   * which travels back to the caller and is stored with the project, so the
   * text outlives the request that sent it. `formatThemeContext` and
   * `buildStoryLabContext` in `StoryService` cap them at their own prompt
   * boundary — the same reason this never showed up as a genesis bill — and
   * the continuity call and the state have no such guard.
   *
   * The numbers are that prompt boundary's, so the two readings cannot
   * disagree about how much of a seed is worth sending; `StoryService` reads
   * them from here now rather than restating them. The label is
   * `maxCharacterNameLength`'s 80, because a label names one thing the way
   * those fields name one person; the description is wider because it is a
   * sentence — the twelve the picker offers run to about forty characters.
   *
   * `id` is not capped here: it never reaches a prompt or the state. It is
   * matched against the classic-theme table, which drops anything it does not
   * recognise, and reported through `toLoggableThemes`, which reduces an
   * unrecognised id to a count rather than logging it.
   */
  maxThemeLabelLength: 80,
  maxThemeDescriptionLength: 280,
  maxLoglineLength: 420,
  maxWorldDetailsLength: 600,
  maxNarrativeDirectivesLength: 1200,
  maxNoGoContentLength: 320,
  /**
   * One character name, not a paragraph wearing the field's name.
   *
   * `protagonistName` and `antagonistName` were the two free-text blueprint
   * fields this object did not cover, and the comment above describes them
   * anyway: both are interpolated straight into a paid model call.
   * `buildContinuityPrompt` puts each of them into the JSON payload the
   * continuity extractor sends, verbatim and at whatever length arrived, and
   * `deriveInitialContinuity` builds a character's `summary`, an
   * `externalConflict`, and a relationship `note` out of them — text that then
   * travels back to the caller as story state and is stored with the project.
   * `buildStoryLabContext` in `StoryService` caps them at its own prompt
   * boundary, which is why this never showed up as a genesis bill; the
   * continuity call has no such guard, and the state does not either.
   *
   * The number is `STORY_EVALUATION_LIMITS.maxConfigurationValueLength`'s, and
   * for the same reason it gives there: these fields name one person.
   */
  maxCharacterNameLength: 80
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

/**
 * The size limits an image generation request has to satisfy.
 *
 * `imagePrompt` is the last free-text field in this repository that reaches a
 * paid model call with nothing measuring it. `ImageService.buildImagePrompt`
 * takes it in preference to the story when it is present and hands it to
 * `enhancePromptWithStyle`, which interpolates the whole of it into the
 * `grok-2-image` request — so a caller could send a megabyte of prose under that
 * name and have it billed by the token and given the function's whole time
 * budget, which is the failure the two objects above were written for.
 *
 * The cap the other branch of that same method already lives under is what fixes
 * the number. When no `imagePrompt` is sent, the prompt's scene half is
 * `buildSceneDescriptionFromStory`, capped at
 * `IMAGE_SCENE_DESCRIPTION_MAX_LENGTH` — 200 characters — so the two ways of
 * describing one picture disagreed by however much the caller felt like sending.
 * 1200 leaves a custom prompt real room to be more specific than three sentences
 * of the story without leaving the field open, and matches
 * `maxNarrativeDirectivesLength`, the blueprint's own "describe how to write
 * this" field.
 *
 * `/api/image/generate` is the route; the check lives in `ImageService`'s
 * validator beside the creature, theme, style, and aspect-ratio checks, so it
 * answers `INVALID_INPUT` naming the field rather than
 * `IMAGE_GENERATION_FAILED` after the request has been sent.
 */
export const IMAGE_GENERATION_LIMITS = {
  maxImagePromptLength: 1200,
  /**
   * Thematic seeds one picture may be asked for.
   *
   * Capping `imagePrompt` closed the larger of the two ways a caller decides
   * how big this route's provider request is, and left the other one open.
   * `enhancePromptWithStyle` maps *every* entry of `themes` through
   * `mapThemeToVisualElement` and joins the results into the same
   * `grok-2-image` prompt the capped field lands in — so the field that was
   * measured is one sentence long and the field beside it was however many
   * sentences the caller cared to ask for. `validateImageInput` checked only
   * that the array is an array, is not empty, and holds strings.
   *
   * The arithmetic is the whole of it: each entry contributes about thirty
   * characters of visual phrasing, and nothing bounded the entry count, so a
   * body within the platform's own 4.5MB limit — a JSON array of one-character
   * ids is four bytes an entry — reaches the provider as a prompt of tens of
   * megabytes, billed by the token, on the route this app pays per call for.
   * `themes` is also the field a caller is least likely to be stopped at by
   * anything else: `content` is read only through
   * `IMAGE_SCENE_DESCRIPTION_MAX_LENGTH`'s 200-character excerpt, and
   * `creature`, `style`, and `aspectRatio` are each one value from a closed set.
   *
   * The number is `STORY_BLUEPRINT_LIMITS.maxThemes`, read from there rather
   * than restated, for the reason `STORY_EVALUATION_LIMITS.maxThemes` reads it
   * from there: this is the same picture the same blueprint asked for, and the
   * three routes should not disagree about how many seeds one story carries.
   * `validateStoryInput` has enforced it on `/api/story/generate` since
   * `VALIDATION_RULES` was written, with the same value; this route was the one
   * that never did.
   */
  maxThemes: STORY_BLUEPRINT_LIMITS.maxThemes
} as const;

export type ImageGenerationLimits = typeof IMAGE_GENERATION_LIMITS;
