// Created: 2026-09-04 00:00 UTC

import type { AuthPort, AuthRequestLike } from './auth/authPort';
import type { StoryLabProfileStore } from './profile/storyLabProfileStore';
import type { HeatContract } from './contracts';
import { capAtWordBoundaryWithinCodeUnits } from '../utils/textExcerpt';
import { STORY_LAB_PROFILE_LIMITS } from '../../../shared/storyBlueprintLimits';

/**
 * The minimum a caller needs to look up a signed-in reader's stored content
 * boundaries. Every route that generates a story already builds one of these
 * — the Story Lab job route context is a superset of it — so this is the
 * narrowest shape that lets the direct genesis and continuation routes share
 * it too, instead of each inventing its own.
 */
export interface ContentBoundariesContext {
  authPort: AuthPort;
  profileStore: StoryLabProfileStore;
}

/**
 * A signed-in caller's content boundaries, folded into generation.
 *
 * `StoryLabProfilePreferences.contentBoundaries` is validated and persisted by
 * the account routes, but nothing has ever read it back — a reader who wrote
 * "no humiliation" into their profile got no different a story than one who
 * left it blank. This never requires auth (`requireUser`) the way the account
 * routes do; a caller with no signed-in identity, which is every caller today
 * since no `STORY_LAB_AUTH_PROVIDER` is configured, simply gets no boundaries
 * to fold in, and generation proceeds exactly as it does now. Any failure
 * along the way — no user, no profile, a store error — is silently treated as
 * "nothing to add"; a reader's boundary is a courtesy layered onto generation,
 * not a gate that should ever turn a working request into a failed one.
 */
export async function loadAuthenticatedContentBoundaries(
  context: ContentBoundariesContext,
  req: AuthRequestLike
): Promise<string | undefined> {
  try {
    const user = await context.authPort.getCurrentUser(req);
    if (!user) {
      return undefined;
    }

    const loadResult = await context.profileStore.loadProfile(user);
    return loadResult.success === true
      ? loadResult.data?.profile.preferences.contentBoundaries
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Folds a profile's content boundaries into an already-accepted Heat Contract.
 *
 * Never called on an absent contract, and never changes `adultOnlyConfirmed`
 * or any other field: `heatContractPolicyError` treats any *present* contract
 * whose `adultOnlyConfirmed` is not `true` as a policy violation, required or
 * not, so manufacturing a contract here for a request that supplied none
 * would turn one that used to succeed into one that fails the adult-reader
 * gate it never actually asked for. Only `noGoContent` — the free-text field
 * this is the profile-wide counterpart of — is touched, joined onto whatever
 * the request itself already carried rather than replacing it.
 *
 * Exported so the value the prompt is actually built from can be asserted on
 * directly, the way `buildSceneDescriptionFromStory` is: the widest merge this
 * produces is what the prompt's bound on that field is measured against, and
 * reconstructing the join in a test would prove the bound against a string this
 * function does not build.
 *
 * **Each half is held to its own cap before the join, which is what makes the
 * merge safe to bound at the sum of them.**
 * `STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH` is that sum, and it is only the
 * right number if neither source can be wider than the cap it is the sum of.
 * Both can:
 *
 * - **The request's half is capped by nothing on this path.**
 *   `parseStoryLabBlueprint` refuses a `noGoContent` past
 *   `maxNoGoContentLength`, and no continuation route parses a blueprint. So a
 *   continuation job supplying 700 characters produced a 1,021-character merge,
 *   which the prompt's bound then cut to 641 — the request's half, and **none**
 *   of the profile's. That is exactly the deletion the merged bound was
 *   introduced to stop, reappearing one source further up.
 * - **The profile's half can predate its cap.** `describeOversizedStoryLabProfileField`
 *   refuses an oversized `contentBoundaries` on `PUT`, but
 *   `normalizeStoryLabProfilePreferences` deliberately does not, because it
 *   "runs on every *read* as well as every write — a profile that predates this
 *   cap has to keep loading". A stored profile wider than the cap is therefore
 *   a shape this function must expect rather than assume away.
 *
 * Capping here rather than at the prompt is what keeps both halves: the two
 * sources are still separate at this point, so each can be held to its own
 * limit, and neither can spend the other's share. By the time the prompt reads
 * the field it is one string, and any bound on it has to choose a half to lose.
 *
 * This is a floor, not the boundary these fields should have. The honest
 * answer for the request's half is a route that refuses it the way genesis
 * does, and that is the open follow-up recorded with `continuationBrief`;
 * until it exists, truncating here is strictly better than deleting the
 * reader's standing boundaries.
 */
export function withMergedContentBoundaries(
  heatContract: HeatContract,
  contentBoundaries: string | undefined
): HeatContract {
  const boundaries = capNoGoSource(contentBoundaries);
  if (!boundaries) {
    return heatContract;
  }

  const existing = capNoGoSource(heatContract.noGoContent);
  return {
    ...heatContract,
    noGoContent: existing ? `${existing}\n${boundaries}` : boundaries
  };
}

/**
 * What a continuation's Heat Contract should be once a signed-in caller's
 * content boundaries are known — `ok: false` when they cannot be honored.
 */
export type ContinuationHeatContractResolution =
  | { ok: true; heatContract: HeatContract | undefined }
  | { ok: false };

/**
 * Resolves a continuation's Heat Contract against a signed-in caller's
 * content boundaries, refusing rather than silently dropping them.
 *
 * Never manufactures a contract: a continuation that supplied none stays
 * that way when there is nothing to fold in, for the reason
 * `withMergedContentBoundaries` never manufactures one either —
 * `heatContractPolicyError` treats any *present* contract as needing
 * `adultOnlyConfirmed: true`, so inventing one here would turn a
 * continuation that used to succeed into one that fails a gate it never
 * asked for.
 *
 * But a signed-in caller who *does* have stored boundaries and supplies *no*
 * Heat Contract is a different case: `withMergedContentBoundaries` has
 * nothing to merge them into, so proceeding unchanged would mean the
 * boundary silently never reaches the model — indistinguishable, from the
 * generated story, from a caller with no boundary set at all. That is the
 * exact failure this module exists to close, one step further in: a reader's
 * "no-go content" honored on some requests and not others, this time based on
 * whether the caller happened to include a Heat Contract rather than which
 * route served the request. Refusing is the fail-closed answer until a
 * Heat-Contract-independent carrier for these boundaries exists — the reader
 * can resupply the same continuation with a Heat Contract attached, which
 * every continuation caller is already equipped to do.
 */
export function resolveContinuationHeatContract(
  heatContract: HeatContract | undefined,
  contentBoundaries: string | undefined
): ContinuationHeatContractResolution {
  // Trimmed before the presence check, the same way `capNoGoSource` treats
  // the field everywhere else it's read: a stored profile can carry a
  // whitespace-only `contentBoundaries` (the normalizer preserves it, and the
  // `PUT` length check accepts it), and `withMergedContentBoundaries` would
  // fold that in as nothing. Refusing over a boundary that resolves to
  // nothing would reject continuations this same module treats as unrestricted
  // everywhere else.
  if (!contentBoundaries?.trim()) {
    return { ok: true, heatContract };
  }

  if (!heatContract) {
    return { ok: false };
  }

  return { ok: true, heatContract: withMergedContentBoundaries(heatContract, contentBoundaries) };
}

/**
 * One no-go source, trimmed and held to the cap published for it.
 *
 * Measured in UTF-16 code units and cut at a word boundary, which is how
 * `limitStoryLabPromptText` reads the same field: the routes measure these caps
 * with `.length`, so cutting in code points here would disagree with the
 * refusal the genesis route gives.
 */
function capNoGoSource(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '';
  }

  return capAtWordBoundaryWithinCodeUnits(trimmed, STORY_LAB_PROFILE_LIMITS.maxNoGoContentLength);
}
