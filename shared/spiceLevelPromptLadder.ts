// Created: 2026-08-27 UTC

/**
 * The five spice levels as the story prompt states them to the model, and as
 * the Proving Grounds preview of that prompt has to state them back.
 *
 * Both halves of the ladder existed twice, and both copies had drifted.
 *
 * The label — the value substituted into the user prompt's
 * `SPICE LEVEL: {{SPICY_LABEL}} (Level {{SPICY_LEVEL}}/5)` line — was
 * `getSpicyLabel` in `storyContentAnalysis` on the production path and
 * `PromptTemplatesService.getSpicyLabel` in the preview. They agreed on nothing:
 * level 4 reached the model as `Very spicy` and was previewed as
 * `Scorching & Explicit`, and the same is true of the other four.
 *
 * The system-prompt block was worse, because it is what actually constrains the
 * chapter. `StoryService.buildSystemPrompt` sends the ladder below, headed
 * `SPICE LEVELS (match exactly and do not exceed the requested level)`, naming
 * for each level what is and is not allowed on the page. The Proving Grounds
 * `productionSystemPrompt` — the text that page presents to the reader as
 * "Current Production" — carried an earlier revision: a shorter heading with no
 * ceiling instruction, and five one-line descriptions ("Yearning looks,
 * accidental touches, sweet anticipation") that name none of the boundaries the
 * real prompt names.
 *
 * So a Proving Grounds comparison run at any spice level was measuring the
 * distance between the two prompts rather than the variant under test, which is
 * the failure `getProductionUserPrompt`'s own note already records for the word
 * budgets it had gone stale on, and the rule `storyPromptTables` was created to
 * keep: a prompt-comparison tool that shows a prompt the run did not use is
 * worse than one that shows nothing, because the reader has no way to tell.
 *
 * Kept in `shared/` beside `storyPromptTables`, for the reason that module
 * gives: it sits below both trees and can import neither.
 */

/** One rung of the ladder. */
export interface SpiceLevelPromptRung {
  /** 1 through 5, as the seams, the picker, and the prompt all number them. */
  readonly level: number;
  /** The name written into the user prompt's `SPICE LEVEL:` line. */
  readonly label: string;
  /** What the system prompt tells the model that level permits and forbids. */
  readonly guidance: string;
}

export const SPICE_LEVEL_PROMPT_RUNGS: readonly SpiceLevelPromptRung[] = [
  {
    level: 1,
    label: 'Storybook romance',
    guidance: 'longing, flirtation, charged glances, accidental touches, no explicit anatomy, no on-page sexual acts.'
  },
  {
    level: 2,
    label: 'Warm',
    guidance: 'kissing, sensual tension, heated arguments, suggestive desire, no explicit sex and no graphic anatomical detail.'
  },
  {
    level: 3,
    label: 'Spicy',
    guidance: 'clear adult heat, hands and bodies can be described, keep language literary, fade to black before graphic sex.'
  },
  {
    level: 4,
    label: 'Very spicy',
    guidance: 'explicit consensual adult intimacy is allowed, direct language is allowed, keep emotional stakes and avoid crude shock value.'
  },
  {
    level: 5,
    label: 'Inferno',
    guidance: 'maximum explicit consensual adult fantasy the app allows, graphic but sophisticated, no coercion, no minors, no non-consensual framing.'
  }
];

/**
 * What a level outside the ladder is called.
 *
 * `spicyLevel` is validated against 1-5 before a story is generated, so this is
 * the same kind of unreachable-but-kept fallback as
 * `UNKNOWN_CREATURE_DISPLAY_NAME`: it is what the API's `getSpicyLabel` has
 * always returned, and naming the middle rung is safer in a prompt than naming
 * the hottest one.
 */
export const UNKNOWN_SPICE_LEVEL_PROMPT_LABEL = 'Spicy';

const LABELS_BY_LEVEL = new Map(SPICE_LEVEL_PROMPT_RUNGS.map(rung => [rung.level, rung.label]));

/** The name this level goes into the user prompt under. */
export function readSpiceLevelPromptLabel(level: number): string {
  return LABELS_BY_LEVEL.get(level) ?? UNKNOWN_SPICE_LEVEL_PROMPT_LABEL;
}

/**
 * The `SPICE LEVELS` section of the system prompt, heading included.
 *
 * The heading travels with the rungs because it is half of what had drifted:
 * "and do not exceed the requested level" is the instruction that turns a
 * description of five levels into a ceiling on one, and it was present in
 * production and absent from the preview.
 */
export const SPICE_LEVEL_PROMPT_BLOCK: string = [
  'SPICE LEVELS (match exactly and do not exceed the requested level):',
  ...SPICE_LEVEL_PROMPT_RUNGS.map(rung => `Level ${rung.level} - ${rung.label}: ${rung.guidance}`)
].join('\n');
