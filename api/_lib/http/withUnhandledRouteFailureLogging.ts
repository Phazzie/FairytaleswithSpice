// Created: 2026-09-05 UTC
//
// Codex's review of PR #339 found that every backend `logCritical` call site
// — `expressApiRoutes.ts`'s `apiErrorHandler` and
// `unhandledProcessFailureLogger.ts` — is reachable only through the
// standalone Express/Docker server (`story-generator/src/server.ts`), which
// this app's README itself calls the recommended deployment. `vercel.json`'s
// `functions: { "api/**/*.ts": {...} }` deploys every file under `api/` as its
// own isolated serverless function instead: Vercel invokes each file's
// `export default` handler directly, with no Express error middleware wrapped
// around it. So on that deployment, `/api/health`'s new
// `services.criticalAlerting` field could report a fully configured, working
// webhook while zero backend code path was ever capable of calling it — the
// same "claims a capability with no reachable code path" defect this whole
// routine exists to catch.
//
// Every one of these entrypoints already wraps its own body in a try/catch
// that answers a graceful `500` via `logError` — this is deliberately *not* a
// replacement for that. It exists for what can still slip past it: a bug in
// code that runs before the handler's own try block (a CORS or method check,
// say), or one in the catch block itself. That gap is real regardless of
// deployment target, so this wrapper is applied uniformly — including on the
// Express/Docker deployment, where `expressApiRoutes.ts` imports these same
// default exports and mounts them directly (see that file's own comment on
// why), making `apiErrorHandler`'s `logCritical` call a second, now-genuinely-
// last-resort safety net there rather than the *only* one.
//
// Codex's re-review of the first cut of this file found two more issues:
// a fire-and-forget `logCritical` here had the same "may never leave the
// process" gap already fixed for the process-crash guard, and a mid-stream
// escape (an SSE route that already sent headers) was logged but left the
// connection open until the platform's own function timeout. Both are fixed
// below. A third re-review found the correlation id was read (and possibly
// minted) only after the 500 was already committed, so the id the critical
// log and webhook carried was never the one — or was never even the same
// value — echoed back to the caller: also fixed below.
import { logCriticalAndFlush } from '../utils/logger';
import { readRequestCorrelationId, settleRequestCorrelationId } from './requestCorrelationId';

export type ApiRouteHandler = (req: any, res: any) => unknown;

function readRequestPath(req: any): string | undefined {
  const path = req?.originalUrl ?? req?.url;
  return typeof path === 'string' ? path : undefined;
}

/**
 * Answers the generic `500` (or, for a response already streaming, closes the
 * connection instead — see below) synchronously, before the caller awaits the
 * critical-alert flush. Keeps the failing request's own latency independent
 * of however long alert delivery takes.
 */
function sendGenericFailureEnvelope(res: any): void {
  if (res?.headersSent) {
    // A route already streaming a response (Server-Sent Events, say) cannot
    // be given a new status and body now. Leaving the connection open would
    // strand the caller until the platform's own function timeout instead of
    // observing that the stream has ended — closing it here is what actually
    // signals that.
    res.end?.();
    return;
  }

  res.setHeader?.('X-Content-Type-Options', 'nosniff');
  if (typeof res?.status === 'function' && typeof res.status(500)?.json === 'function') {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'The API failed to handle this request.' }
    });
    return;
  }

  res.statusCode = 500;
  res.setHeader?.('Content-Type', 'application/json');
  res.end?.(JSON.stringify({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'The API failed to handle this request.' }
  }));
}

/**
 * Sends the response first — so a caller waiting on this request is not held
 * up by however long alert delivery takes — then awaits the flush before
 * returning. A Vercel Node function stays alive until the promise its
 * `export default` handler returns settles, regardless of whether a response
 * was already sent; a fire-and-forget alert here has no such guarantee and
 * may never leave the invocation before it is frozen or torn down.
 *
 * The correlation id is settled — minted if the caller sent none, and echoed
 * back via `X-Request-ID` — *before* the response is sent, and that exact
 * value is reused for the critical log/webhook. Settling after the response
 * was already committed (the original shape here) meant a caller with no
 * incoming id got a 500 with no `X-Request-ID` header at all, while a
 * different, unreturned id was the one that showed up in the alert — the
 * caller had no way to quote the diagnostic that identifies their own
 * failure. Skipped when headers are already sent (a mid-stream escape):
 * `res.setHeader` throws past that point, and there is no header left to
 * echo onto in any case.
 */
async function handleEscapedFailure(req: any, res: any, error: unknown): Promise<void> {
  const requestId = res?.headersSent
    ? readRequestCorrelationId(req)
    : settleRequestCorrelationId(req, res);

  sendGenericFailureEnvelope(res);
  await logCriticalAndFlush('Unhandled API route failure', error, {
    requestId,
    endpoint: readRequestPath(req),
    method: typeof req?.method === 'string' ? req.method : undefined
  });
}

/**
 * Wraps a Vercel/Express-compatible `(req, res)` route handler so that
 * anything escaping it — a synchronous throw or a rejected promise the
 * handler's own try/catch did not intercept — is logged at `critical`
 * severity (and thus reaches a configured alert webhook, in production, with
 * its delivery awaited) before answering a generic `500`, instead of
 * surfacing only as whatever the hosting platform's own default crash
 * handling does.
 */
export function withUnhandledRouteFailureLogging(handler: ApiRouteHandler): ApiRouteHandler {
  return async function wrappedHandler(req: any, res: any): Promise<unknown> {
    let result: unknown;

    try {
      result = handler(req, res);
    } catch (error) {
      await handleEscapedFailure(req, res, error);
      return undefined;
    }

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      try {
        return await (result as PromiseLike<unknown>);
      } catch (error) {
        await handleEscapedFailure(req, res, error);
        return undefined;
      }
    }

    return result;
  };
}
