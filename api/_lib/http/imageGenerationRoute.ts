// Created: 2026-08-25 13:05 UTC

import { getApiResponseStatus } from './apiResponseStatus';
import { readJsonObjectBody } from './jsonRequestBody';
import { applyRequestId } from './requestId';
import { ImageService } from '../services/imageService';
import type { ImageGenerationSeam } from '../types/contracts';

/**
 * `/api/image/generate`, the one route with no serverless counterpart.
 *
 * It has no Vercel function by design — the route budget consolidation removed
 * it, and `AGENTS.md` records that image-generation code lives under `api/_lib`
 * or on the Node server. It was written inline in `story-generator/src/server.ts`
 * for that reason, which is also why it was the only route in the repository
 * that never got the body reading every other route now shares:
 *
 * ```ts
 * const input = req.body;
 * if (!input.storyId || !input.content || …) { … }
 * ```
 *
 * Express 5's body parser leaves `req.body` as `undefined` for a request with no
 * body, or one sent without `Content-Type: application/json` — it no longer
 * initialises it to `{}` the way Express 4 did. Reading `input.storyId` off that
 * throws a `TypeError`, which the route's own catch block answers with
 * `500 INTERNAL_ERROR`: the caller is told the image service failed and that
 * retrying might help, when it is the request that is malformed and only the
 * caller can fix it. `readJsonObjectBody` exists for exactly this and is used by
 * every other route; this one was missed.
 *
 * The presence check it did have was also a weaker duplicate of
 * `ImageService.validateImageInput`, which checks the same fields plus their
 * types, the style, and the aspect ratio, and names which one is wrong. Letting
 * the service validate means one answer to "is this request usable" instead of
 * two that can drift, and `getApiResponseStatus` maps its refusal to a 400.
 *
 * Living here rather than in `server.ts` adds no Vercel function — everything
 * under `api/_lib` is pruned by `check-vercel-function-count.sh` and excluded by
 * Vercel itself — and it is what lets the route be driven by a test without
 * standing up the Angular SSR server.
 */
export async function handleImageGenerationRoute(req: any, res: any): Promise<void> {
  const requestId = applyRequestId(req, res);

  try {
    const input = readJsonObjectBody<ImageGenerationSeam['input']>(req?.body);
    if (!input) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'A JSON object body is required with storyId, content, creature, themes, and style'
        }
      });
      return;
    }

    const imageService = new ImageService();
    const result = await imageService.generateImage(input);

    // An unsuccessful envelope is not a `200`: an unsupported style or an image
    // provider outage was served as OK with `success: false` inside it, which
    // only a client that reads the body can tell from a generated image.
    res.status(getApiResponseStatus(result)).json(result);
  } catch (error) {
    console.error(`[${requestId}] Image generation route failed`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Image generation failed'
      }
    });
  }
}

export default handleImageGenerationRoute;
