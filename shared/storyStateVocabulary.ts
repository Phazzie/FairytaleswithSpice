// Created: 2026-08-27 UTC

/**
 * The four closed vocabularies a continuity state is written in, and the only
 * values `CharacterProfile`, `PlotThread`, `LoreArtifact`, and
 * `RelationshipEdge` carry for them.
 *
 * Every other closed set in this repository reached a table eventually —
 * creatures, themes, tones, heat dials, spice levels, word budgets, batch
 * sizes, export formats, image styles, library sorts. These four never did.
 * They were declared as inline unions on the interfaces in the Angular contract
 * and then written out again, by hand, wherever something had to *check* a
 * value rather than declare one:
 *
 * - `normalizeArchetype`, `normalizeThreadStatus`, and
 *   `normalizeStoryMemoryLifetime` in `continuityExtractor.ts`, each a chain of
 *   `value === '…' || value === '…'` restating one union;
 * - `RELATIONSHIP_KINDS` in the same file, the same list a fourth time as a
 *   `Set` of bare strings;
 * - `PlotThreadStatus` in `shared/continuityActivation.ts`, a fifth copy of the
 *   thread statuses declared as its own union because that module sits below
 *   the Angular tree and could not reach the contract's.
 *
 * A union and a hand-written membership check are not the same statement, and
 * TypeScript relates them only through the cast each check needed to be written
 * with — `RELATIONSHIP_KINDS.has(edge.relationship as string)` compares model
 * output to a `Set<string>`, which would still compile and still be wrong the
 * day a sixth relationship kind is added to the type. What each copy does when
 * it falls behind is silent in the way this repository has learned to watch
 * for: the extractor does not reject an unrecognised value, it *drops* it and
 * keeps the previous one, so a continuity fact the model correctly reported is
 * discarded and the state simply never changes.
 *
 * Kept in `shared/` beside `creatureVocabulary` and `storyLabThemeSeeds`, for
 * the reason those give: this module sits below both trees and imports neither,
 * which is what lets the Angular contract derive its interfaces' field types
 * from the same tables the API's validators check against — and lets
 * `continuityActivation` stop declaring its own.
 */

/** What a character is to the story, as `CharacterProfile.archetype` declares it. */
export const CHARACTER_ARCHETYPES = [
  'protagonist',
  'antagonist',
  'supporting',
  'narrator'
] as const;

/**
 * The union, read from the table rather than restated beside it.
 *
 * Derived rather than declared-and-`satisfies`-checked for the reason
 * `CreatureArchetype` gives: a `satisfies` clause catches a *wrong* entry, and
 * every copy of these lists could only ever go wrong by being short one.
 */
export type CharacterArchetype = typeof CHARACTER_ARCHETYPES[number];

/** Where a plot thread stands, as `PlotThread.status` declares it. */
export const PLOT_THREAD_STATUSES = [
  'active',
  'escalating',
  'resolved',
  'dormant'
] as const;

export type PlotThreadStatus = typeof PLOT_THREAD_STATUSES[number];

/**
 * How long a thread or artifact is expected to matter, as
 * `StoryMemoryLifetime` declares it.
 */
export const STORY_MEMORY_LIFETIMES = [
  'scene',
  'chapter',
  'series'
] as const;

export type StoryMemoryLifetime = typeof STORY_MEMORY_LIFETIMES[number];

/** How two characters stand to each other, as `RelationshipEdge.relationship` declares it. */
export const RELATIONSHIP_KINDS = [
  'ally',
  'lover',
  'rival',
  'family',
  'unknown'
] as const;

export type RelationshipKind = typeof RELATIONSHIP_KINDS[number];

/**
 * Whether `value` is one of `vocabulary`, narrowed to the vocabulary's own
 * union.
 *
 * The four normalizers this replaces were four spellings of one question, and
 * each had to be written with the cast that made it compile: a chain of
 * `value === '…'` comparisons against `unknown`, or `Set<string>.has(value as
 * string)`. `readonly T[]` cannot be asked `.includes(unknown)` either — the
 * argument is typed as the element — so the cast moves here, once, where the
 * predicate's return type is what states the guarantee and the table decides
 * the answer.
 */
export function isVocabularyMember<T extends string>(
  vocabulary: readonly T[],
  value: unknown
): value is T {
  return typeof value === 'string' && (vocabulary as readonly string[]).includes(value);
}
