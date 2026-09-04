// Created: 2025-10-29 08:27 UTC

import type { ApiResponse, StoryIterationPayload } from '../_lib/story-lab/contracts';
import { beginPostRoute } from '../_lib/http/postRoutePreamble';
import { RATE_LIMITS } from '../_lib/constants';
import { getStoryLabResponseStatus } from '../_lib/story-lab/routeStatus';
import { generateStoryLabGenesis } from '../_lib/story-lab/storyLabEngine';
import { parseStoryLabBlueprintFromBody } from '../_lib/story-lab/validation/blueprintParser';
import { logError, logInfo, logWarn } from '../_lib/utils/logger';
import { toLoggableThemes } from '../_lib/utils/loggableRequestParameters';
import type { AuthPort } from '../_lib/story-lab/auth/authPort';
import { configuredAuthPort } from '../_lib/story-lab/auth/configuredAuthPort';
import type { StoryLabProfileStore } from '../_lib/story-lab/profile/storyLabProfileStore';
import { createStoryLabCloudStorage } from '../_lib/story-lab/storage/storyLabCloudStorageConfig';
import { loadAuthenticatedContentBoundaries, withMergedContentBoundaries } from '../_lib/story-lab/contentBoundaries';

type GenerateStoryLabGenesis = typeof generateStoryLabGenesis;

const ENDPOINT = '/api/story-lab/stories';

const unexpectedStoryLabErrorResponse: ApiResponse<never> = {
  success: false,
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Story Lab request failed unexpectedly.'
  }
};

export interface StoryLabGenesisRouteDependencies {
  generateGenesis?: GenerateStoryLabGenesis;
  authPort?: AuthPort;
  profileStore?: StoryLabProfileStore;
}

export function createStoryLabGenesisHandler(
  generateGenesisOrDependencies: GenerateStoryLabGenesis | StoryLabGenesisRouteDependencies = generateStoryLabGenesis
) {
  // `generateGenesis` alone used to be the whole dependency surface, and every
  // existing caller — tests included — passes just that function. Accepting
  // the dependencies object as an alternative, rather than replacing the
  // parameter, is what keeps those call sites working unchanged while still
  // letting this route fold a signed-in caller's content boundaries the same
  // way the job route does.
  const dependencies: StoryLabGenesisRouteDependencies =
    typeof generateGenesisOrDependencies === 'function'
      ? { generateGenesis: generateGenesisOrDependencies }
      : generateGenesisOrDependencies;

  const generateGenesis = dependencies.generateGenesis ?? generateStoryLabGenesis;
  const authPort = dependencies.authPort ?? configuredAuthPort;
  const profileStore = dependencies.profileStore ?? createStoryLabCloudStorage().profileStore;

  return async function handler(req: any, res: any) {
    // Correlation id, `X-Request-ID`, CORS, method, and access control, in the
    // one place the other paid POST routes already state them.
    const start = await beginPostRoute(req, res, 'story-lab/stories', RATE_LIMITS.STORY_LAB_GENESIS);
    if (!start) {
      return;
    }

    const requestId = start.requestId;

    try {
      const parsed = parseStoryLabBlueprintFromBody(req.body);
      if (parsed.error) {
        // `invalidFields` is the whole reason the parser collects every failure
        // rather than returning at the first one, and it is what the seam
        // contract declares an `INVALID_BLUEPRINT` carries. This route dropped it
        // and sent the joined prose alone, so a caller that wanted to mark the
        // fields a reader has to fix had to parse the message back apart. The
        // Story Lab job route, which validates the same blueprint through the
        // same parser, has always sent it; this is that answer.
        //
        // `invalidFields` is safe to log verbatim: it is the parser's own list of
        // known field names, never caller-controlled text.
        logWarn('Story Lab genesis request rejected', {
          requestId,
          endpoint: ENDPOINT,
          method: 'POST'
        }, { invalidFields: parsed.error.invalidFields });

        res.status(400).json({
          success: false,
          error: {
            code: parsed.error.code,
            message: parsed.error.message,
            details: {
              invalidFields: parsed.error.invalidFields
            }
          }
        });
        return;
      }

      const blueprint = parsed.blueprint;

      // Every field logged here has already passed the parser's closed-set
      // validation except `themes`, which is only checked for shape — `id` is
      // not constrained to a recognised value — so it still goes through
      // `toLoggableThemes`. The free-text fields (`logline`,
      // `narrativeDirectives`, `worldDetails`, the character names, and
      // `heatContract.noGoContent`) are never logged, not even redacted; only
      // `logline`'s length is worth keeping.
      logInfo('Story Lab genesis endpoint called', {
        requestId,
        endpoint: ENDPOINT,
        method: 'POST',
        requestParameters: {
          creature: blueprint.creature,
          tone: blueprint.tone,
          spicyLevel: blueprint.spicyLevel,
          desiredWordBudget: blueprint.desiredWordBudget,
          chapterBatchSize: blueprint.chapterBatchSize,
          loglineLength: blueprint.logline.length,
          ...toLoggableThemes(blueprint.themes.map(theme => theme.id))
        }
      });

      // A signed-in caller's stored content boundaries, folded into the
      // blueprint's Heat Contract the same way the Story Lab job route already
      // does — this is the direct genesis path the Proving Grounds UI actually
      // calls, and it used to skip this entirely.
      const contentBoundaries = await loadAuthenticatedContentBoundaries({ authPort, profileStore }, req);
      const genesisInput = contentBoundaries
        ? { ...blueprint, heatContract: withMergedContentBoundaries(blueprint.heatContract, contentBoundaries) }
        : blueprint;

      // The correlation id goes with the request. It is what this handler's own
      // lines are stamped with and what the caller was echoed as `X-Request-ID`;
      // passing it on is what makes the generation's own log lines — the prompt
      // sizes, the provider call, the failure a reader would be asking about —
      // answer to the same id, instead of to a second one minted in the service.
      const payload: ApiResponse<StoryIterationPayload> = await generateGenesis(genesisInput, { requestId });

      logInfo(`Story Lab genesis ${payload.success ? 'succeeded' : 'failed'}`, {
        requestId,
        endpoint: ENDPOINT,
        method: 'POST',
        statusCode: getStoryLabResponseStatus(payload)
      });

      res.status(getStoryLabResponseStatus(payload)).json(payload);
    } catch (error) {
      logError('Story Lab genesis endpoint error', error, {
        requestId,
        endpoint: ENDPOINT,
        method: 'POST',
        statusCode: 500
      });

      res.status(500).json(unexpectedStoryLabErrorResponse);
    }
  };
}

export default createStoryLabGenesisHandler();
