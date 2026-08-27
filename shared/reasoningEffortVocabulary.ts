// Created: 2026-08-27 UTC

/**
 * How hard the provider is asked to think, and therefore the only value any
 * `reasoningEffort` in this repository carries.
 *
 * The five efforts were written out four times, with no table anywhere:
 *
 * - `XaiReasoningEffort` in `api/_lib/config/xaiConfig.ts`, the union the whole
 *   API tree types the field with;
 * - `VALID_REASONING_EFFORTS` beside it, a `Set` of the same five strings,
 *   which exists because a union is not something `getXaiReasoningEffort` can
 *   check `XAI_STORY_REASONING_EFFORT` against — and which needed two
 *   `as XaiReasoningEffort` casts to bridge back to the union it was copied
 *   from;
 * - `ApiResponseMetadata.reasoningEffort` in the API contract, spelled out
 *   inline rather than typed with the union three files away;
 * - `GenerationTelemetry.reasoningEffort` in the Angular contract, spelled out
 *   inline again — and it is the one a reader sees, since `app.ts` prints it in
 *   the telemetry panel.
 *
 * Two identical unions are structurally assignable, so nothing would have
 * reported the drift. A sixth effort added to `xaiConfig` — the file that
 * decides what is sent — type-checks all the way to the provider and is then
 * refused by neither contract's declaration but by nothing at all: the value
 * simply travels under a type that says it cannot exist, and the two contracts
 * describe a response shape the API does not produce. The `Set` is worse in the
 * other direction: it is what `XAI_STORY_REASONING_EFFORT` is validated
 * against, so an effort dropped from it is silently replaced by the default on
 * a deployment that configured it.
 *
 * Kept in `shared/` beside the other vocabularies, for the reason those give:
 * it sits below both trees, so the config that sends the value and the two
 * contracts that report it read one list.
 */
export const XAI_REASONING_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh'] as const;

/** The union, read from the table rather than restated beside it. */
export type XaiReasoningEffort = typeof XAI_REASONING_EFFORTS[number];

const XAI_REASONING_EFFORT_SET: ReadonlySet<unknown> = new Set<unknown>(XAI_REASONING_EFFORTS);

/**
 * Whether `value` is an effort the provider is asked for, checked against the
 * table.
 *
 * A guard rather than a `Set.has` at the call site, so the narrowing the two
 * `as XaiReasoningEffort` casts in `getXaiReasoningEffort` were standing in for
 * is done by the check itself.
 */
export function isXaiReasoningEffort(value: unknown): value is XaiReasoningEffort {
  return XAI_REASONING_EFFORT_SET.has(value);
}
