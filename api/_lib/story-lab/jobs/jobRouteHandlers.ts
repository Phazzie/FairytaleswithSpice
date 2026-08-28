// Created: 2026-06-07 07:05 EDT

import type {
  ApiResponse,
  StoryContinuationSeam,
  StoryIterationPayload,
  StoryLabGenerationJobKind,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse,
  StoryLabJobError
} from '../contracts';
import {
  STORY_LAB_DEFERRED_JOB_KINDS,
  formatChapterBatchSizeList,
  isChapterBatchSize,
  isDeferredStoryLabJobKind
} from '../contracts';
import type { AuthPort, AuthUser } from '../auth/authPort';
import { isAuthError } from '../auth/authPort';
import { configuredAuthPort } from '../auth/configuredAuthPort';
import { applyCorsPolicy } from '../../http/corsPolicy';
import { sendMethodNotAllowed } from '../../http/methodNotAllowed';
import { settleRequestCorrelationId } from '../../http/requestCorrelationId';
import { endSseStream, writeSseFrame, type SseResponseLike } from '../../http/sseStream';
import { RATE_LIMITS } from '../../constants';
import { enforceApiAccessControl, withEventStreamAuth } from '../../middleware/apiAccessControl';
import { logError, logWarn } from '../../utils/logger';
import { continueStoryLab, generateStoryLabGenesis } from '../storyLabEngine';
import { getTransientStorySnapshot } from '../stateStore';
import { parseStoryLabBlueprintFromBody } from '../validation/blueprintParser';
import { assertOpaqueStoryLabJobId } from './jobContracts';
import type { StoryLabJobStore } from './jobStorePort';
import {
  isStoryLabJobStoreError,
  type StoryLabJobStoreError
} from './postgresStoryLabJobStore';
import {
  createStoryLabJobStoreConfig,
  type StoryLabJobStoreConfig
} from './storyLabJobStoreConfig';
import { createStoryLabCloudStorage } from '../storage/storyLabCloudStorageConfig';
import type { StoryLabProfileStore } from '../profile/storyLabProfileStore';
import type { HeatContract } from '../contracts';

type ContinuationJobResult = StoryIterationPayload & { appendedChapterNumbers: number[] };
type JobResult = StoryIterationPayload | ContinuationJobResult;

interface RequestLike {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Extends the SSE response shape rather than restating it: the events handler
 * below streams, so it needs the same `write`/`end` pair and the same optional
 * lifecycle flags the shared helpers read to decide whether a frame can still
 * land.
 */
interface ResponseLike extends SseResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(body: unknown): void;
  writeHead?(statusCode: number, headers: Record<string, string>): void;
}

export interface StoryLabJobRouteDependencies {
  authPort?: AuthPort;
  profileStore?: StoryLabProfileStore;
  createJobStoreConfig?: () => StoryLabJobStoreConfig;
  generateGenesis?: typeof generateStoryLabGenesis;
  continueStory?: typeof continueStoryLab;
}

interface StoryLabJobRouteContext {
  authPort: AuthPort;
  profileStore: StoryLabProfileStore;
  createJobStoreConfig: () => StoryLabJobStoreConfig;
  generateGenesis: typeof generateStoryLabGenesis;
  continueStory: typeof continueStoryLab;
}

interface ResolvedJobStore {
  store: StoryLabJobStore;
  ownerUserId?: string;
}

type JobStoreOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false };

export function createStoryLabJobsRouteHandler(
  dependencies: StoryLabJobRouteDependencies = {}
): (req: RequestLike, res: ResponseLike) => Promise<void> {
  const context: StoryLabJobRouteContext = {
    authPort: dependencies.authPort ?? configuredAuthPort,
    profileStore: dependencies.profileStore ?? createStoryLabCloudStorage().profileStore,
    createJobStoreConfig: dependencies.createJobStoreConfig ?? (() => createStoryLabJobStoreConfig()),
    generateGenesis: dependencies.generateGenesis ?? generateStoryLabGenesis,
    continueStory: dependencies.continueStory ?? continueStoryLab
  };

  return async function storyLabJobsRouteHandler(req: RequestLike, res: ResponseLike): Promise<void> {
    await handleStoryLabJobsRouteWithContext(context, req, res);
  };
}

export const handleStoryLabJobsRoute = createStoryLabJobsRouteHandler();

/**
 * Every method this one route serves. The handlers below each declare only
 * their own, which is right for them — they are exported and mounted
 * individually too — but wrong for the preflight, which is asked about the
 * route rather than about a handler.
 */
const STORY_LAB_JOBS_ROUTE_METHODS = ['GET', 'POST', 'OPTIONS'];

/**
 * And the per-handler lists, which are what `Allow` reports: the header names
 * the target resource's methods, so creating a job answers `POST, OPTIONS`
 * while reading one answers `GET, OPTIONS`, even though the route as a whole
 * serves both.
 */
const STORY_LAB_JOB_CREATE_METHODS = ['POST', 'OPTIONS'];
const STORY_LAB_JOB_READ_METHODS = ['GET', 'OPTIONS'];

async function handleStoryLabJobsRouteWithContext(
  context: StoryLabJobRouteContext,
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  // Settled here, once, and handed down rather than settled again below.
  // Every request that arrives at this route file arrives here: `vercel.json`
  // rewrites `/api/story-lab/jobs/:jobId[/events]` onto this one file, and
  // `API_ROUTES` mounts all three of those paths on this same handler. A
  // sub-handler settling its own would mint a *second* id for the same request
  // — the ids are minted, not derived, so the two differ whenever the caller
  // supplied none — and overwrite the header with one the log lines below do
  // not use. The three handlers exported beside this one settle their own,
  // because each is the entry point when it is called directly.
  //
  // Before the preflight branch, so an `OPTIONS` answer carries the id too.
  const requestId = settleRequestCorrelationId(req, res);

  // A preflight names the method it is asking about in
  // `Access-Control-Request-Method`, not in its own, so an `OPTIONS` fell past
  // the `POST` branch and was answered by the GET handler — which advertises
  // `Access-Control-Allow-Methods: GET, OPTIONS`. A browser reads that as "POST
  // is not allowed here" and never sends the request, so creating a Story Lab
  // job from the page failed before it left the browser on any deployment where
  // the API is not same-origin. Answering the preflight here is what lets it
  // describe the route instead of one of its handlers.
  if ((req.method ?? '').toUpperCase() === 'OPTIONS') {
    applyCorsPolicy(req, res, {
      methods: STORY_LAB_JOBS_ROUTE_METHODS,
      credentials: true
    });
    return;
  }

  if ((req.method ?? '').toUpperCase() === 'POST') {
    await handleCreateStoryLabJobWithContext(context, req, res, requestId);
    return;
  }

  if (isEventsRequest(req)) {
    await handleStreamStoryLabJobEventsWithContext(context, req, res, requestId);
    return;
  }

  await handleGetStoryLabJobWithContext(context, req, res, requestId);
}

export async function handleCreateStoryLabJob(req: RequestLike, res: ResponseLike): Promise<void> {
  await handleCreateStoryLabJobWithContext(
    createDefaultJobRouteContext(),
    req,
    res,
    settleRequestCorrelationId(req, res)
  );
}

async function handleCreateStoryLabJobWithContext(
  context: StoryLabJobRouteContext,
  req: RequestLike,
  res: ResponseLike,
  requestId: string
): Promise<void> {
  const cors = applyCorsPolicy(req, res, {
    methods: STORY_LAB_JOB_CREATE_METHODS,
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  if ((req.method ?? '').toUpperCase() !== 'POST') {
    sendMethodNotAllowed(res, STORY_LAB_JOB_CREATE_METHODS, 'Only POST requests are supported.');
    return;
  }

  const access = await enforceApiAccessControl(req, res, 'story-lab/jobs', RATE_LIMITS.STORY_LAB_JOB_CREATE);
  if (!access.allowed) {
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || typeof (req.body as { kind?: unknown }).kind !== 'string') {
    sendJson(res, 400, invalidRequest('Request body must include a Story Lab job kind.'));
    return;
  }

  const request = req.body as StoryLabJobCreationRequest;

  if (isDeferredStoryLabJobKind(request.kind)) {
    sendJson(res, 400, {
      success: false,
      error: {
        code: 'UNSUPPORTED_JOB_KIND',
        message: `${formatDeferredJobKindList()} jobs are reserved for the durable job runner and are not supported by this non-durable scaffold.`
      }
    });
    return;
  }

  if (request.kind === 'genesis') {
    await createGenesisJob(context, request, req, res, requestId);
    return;
  }

  if (request.kind === 'continuation') {
    await createContinuationJob(context, request, req, res, requestId);
    return;
  }

  sendJson(res, 400, invalidRequest('Story Lab job kind is not supported.'));
}

export async function handleGetStoryLabJob(req: RequestLike, res: ResponseLike): Promise<void> {
  await handleGetStoryLabJobWithContext(
    createDefaultJobRouteContext(),
    req,
    res,
    settleRequestCorrelationId(req, res)
  );
}

async function handleGetStoryLabJobWithContext(
  context: StoryLabJobRouteContext,
  req: RequestLike,
  res: ResponseLike,
  requestId: string
): Promise<void> {
  const cors = applyCorsPolicy(req, res, {
    methods: ['GET', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  const jobId = readValidJobIdOrRespond(req, res);
  if (!jobId) {
    return;
  }

  const resolvedStore = await resolveJobStoreOrRespond(context, req, res, requestId);
  if (!resolvedStore) {
    return;
  }

  const jobResult = await tryJobStoreOperation(res, () => resolvedStore.store.getJob(jobId, {
    ownerUserId: resolvedStore.ownerUserId
  }));
  if (!jobResult.ok) {
    return;
  }

  const job = jobResult.value;
  if (!job) {
    sendJson(res, 404, jobNotFound());
    return;
  }

  sendJson(res, 200, {
    success: true,
    data: job
  });
}

export async function handleStreamStoryLabJobEvents(req: RequestLike, res: ResponseLike): Promise<void> {
  await handleStreamStoryLabJobEventsWithContext(
    createDefaultJobRouteContext(),
    req,
    res,
    settleRequestCorrelationId(req, res)
  );
}

async function handleStreamStoryLabJobEventsWithContext(
  context: StoryLabJobRouteContext,
  req: RequestLike,
  res: ResponseLike,
  requestId: string
): Promise<void> {
  const cors = applyCorsPolicy(req, res, {
    methods: ['GET', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  // `EventSource` cannot set custom headers, so this checks for the key
  // through `withEventStreamAuth`'s `apiKey` query-parameter fallback as well
  // as the usual headers — see that helper for why.
  const access = await enforceApiAccessControl(
    withEventStreamAuth(req),
    res,
    'story-lab/jobs/events',
    // Not `STREAMING`: this route replays and closes, so a reader watching one
    // job reconnects every few seconds. See `RATE_LIMITS.STORY_LAB_JOB_EVENTS`.
    RATE_LIMITS.STORY_LAB_JOB_EVENTS
  );
  if (!access.allowed) {
    return;
  }

  const jobId = readValidJobIdOrRespond(req, res);
  if (!jobId) {
    return;
  }

  const resolvedStore = await resolveJobStoreOrRespond(context, req, res, requestId);
  if (!resolvedStore) {
    return;
  }

  const eventsResult = await tryJobStoreOperation(res, () => resolvedStore.store.getEvents<JobResult>(jobId, {
    ownerUserId: resolvedStore.ownerUserId
  }));
  if (!eventsResult.ok) {
    return;
  }

  const events = eventsResult.value;
  if (!events) {
    sendJson(res, 404, jobNotFound());
    return;
  }

  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  };

  if (res.writeHead) {
    res.writeHead(200, headers);
  } else {
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    res.status(200);
  }

  // Framed by the shared serializer rather than by an interpolation of its
  // own. The terminator has to be two real newlines, and the last route in this
  // repository to spell it for itself got `\\n\\n` — printable text inside a
  // template literal, not a line ending — so no client dispatched a single one
  // of its events. Reading the stream state here matters as much: the store
  // lookups above are awaited, so a reader who closes the tab in the meantime
  // leaves a destroyed response that answers every replayed frame with
  // `ERR_STREAM_DESTROYED`, thrown out of an async handler with nothing left to
  // catch it. `res.write?.()` guarded against the method being absent, which is
  // not the thing that goes wrong here.
  for (const event of events) {
    writeSseFrame(res, event);
  }
  endSseStream(res);
}

async function createGenesisJob(
  context: StoryLabJobRouteContext,
  request: Extract<StoryLabJobCreationRequest, { kind: 'genesis' }>,
  req: RequestLike,
  res: ResponseLike,
  requestId: string
): Promise<void> {
  const parsed = parseStoryLabBlueprintFromBody(request.blueprint);
  if (parsed.error) {
    sendJson(res, 400, {
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

  const resolvedStore = await resolveJobStoreOrRespond(context, req, res, requestId);
  if (!resolvedStore) {
    return;
  }
  const { store, ownerUserId } = resolvedStore;

  const jobResult = await tryJobStoreOperation(res, () => store.createJob<StoryIterationPayload>({
    kind: 'genesis',
    ownerUserId,
    currentStep: 'queued',
    idempotencyKey: request.idempotencyKey,
    storyId: request.storyId,
    request: {
      projectId: request.projectId,
      storyId: request.storyId,
      blueprint: parsed.blueprint
    }
  }));
  if (!jobResult.ok) {
    return;
  }

  const job = jobResult.value;
  const startedResult = await tryJobStoreOperation(res, () => store.updateJob<StoryIterationPayload>(job.job.jobId, {
    ownerUserId,
    status: 'running',
    currentStep: 'generating_story',
    progressPercent: 25
  }));
  if (!startedResult.ok) {
    return;
  }
  if (!startedResult.value) {
    sendJson(res, 503, jobStorageFailed());
    return;
  }

  const contentBoundaries = await loadAuthenticatedContentBoundaries(context, req);
  const genesisInput = contentBoundaries
    ? { ...parsed.blueprint, heatContract: withMergedContentBoundaries(parsed.blueprint.heatContract, contentBoundaries) }
    : parsed.blueprint;

  const result = await runJobWork(
    () => context.generateGenesis(genesisInput),
    'genesis',
    job.job.jobId,
    requestId
  );
  const finishedResult = await tryJobStoreOperation(res, () => finishJob(store, ownerUserId, job.job.jobId, result));
  if (!finishedResult.ok) {
    return;
  }
  if (!finishedResult.value) {
    sendJson(res, 503, jobStorageFailed());
    return;
  }
  sendJson(res, 200, {
    success: true,
    data: finishedResult.value
  });
}

async function createContinuationJob(
  context: StoryLabJobRouteContext,
  request: Extract<StoryLabJobCreationRequest, { kind: 'continuation' }>,
  req: RequestLike,
  res: ResponseLike,
  requestId: string
): Promise<void> {
  const normalized = normalizeContinuationInput(request.continuation);
  if (!normalized) {
    sendJson(res, 400, invalidRequest(
      'Continuation jobs require storyId, storyState or transient snapshot, previous chapters or transient snapshot, '
      + `and a chapterBatchSize of ${formatChapterBatchSizeList()}.`
    ));
    return;
  }

  const resolvedStore = await resolveJobStoreOrRespond(context, req, res, requestId);
  if (!resolvedStore) {
    return;
  }
  const { store, ownerUserId } = resolvedStore;

  const jobResult = await tryJobStoreOperation(res, () => store.createJob<ContinuationJobResult>({
    kind: 'continuation',
    ownerUserId,
    currentStep: 'queued',
    idempotencyKey: request.idempotencyKey,
    storyId: request.storyId ?? normalized.storyId,
    request: {
      projectId: request.projectId,
      storyId: request.storyId ?? normalized.storyId,
      continuation: normalized
    }
  }));
  if (!jobResult.ok) {
    return;
  }

  const job = jobResult.value;
  const startedResult = await tryJobStoreOperation(res, () => store.updateJob<ContinuationJobResult>(job.job.jobId, {
    ownerUserId,
    status: 'running',
    currentStep: 'continuing_story',
    progressPercent: 25
  }));
  if (!startedResult.ok) {
    return;
  }
  if (!startedResult.value) {
    sendJson(res, 503, jobStorageFailed());
    return;
  }

  const contentBoundaries = await loadAuthenticatedContentBoundaries(context, req);
  const continuationInput = contentBoundaries && normalized.heatContract
    ? { ...normalized, heatContract: withMergedContentBoundaries(normalized.heatContract, contentBoundaries) }
    : normalized;

  const result = await runJobWork(
    () => context.continueStory(continuationInput),
    'continuation',
    job.job.jobId,
    requestId
  );
  const finishedResult = await tryJobStoreOperation(res, () => finishJob(store, ownerUserId, job.job.jobId, result));
  if (!finishedResult.ok) {
    return;
  }
  if (!finishedResult.value) {
    sendJson(res, 503, jobStorageFailed());
    return;
  }
  sendJson(res, 200, {
    success: true,
    data: finishedResult.value
  });
}

/**
 * The deferred kinds as the refusal names them, read from the table it checks.
 *
 * The message used to say "Export and audio" in prose beside a branch that
 * matched the two literals, so a third deferred kind would have been refused
 * and not mentioned. Capitalised only at the front, the way the sentence was.
 */
function formatDeferredJobKindList(): string {
  const kinds: readonly string[] = STORY_LAB_DEFERRED_JOB_KINDS;
  const sentence = kinds.length > 1
    ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}`
    : kinds.join('');

  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Run the engine for a job that is already recorded as `running`.
 *
 * The engine reports its own failures as an unsuccessful envelope, but it can
 * also throw — a provider socket that dies mid-call, a bug below it — and the
 * throw used to travel straight past the route into its 500 handler. By then
 * the job row said `running`, and nothing ever moved it off that: a durable job
 * stayed running forever, so a client polling `/jobs/{id}` or reading its event
 * stream waited on a job no one was working on any more. A throw is one more
 * way for the work to fail, so it is recorded as a failure of the job like any
 * other. The thrown detail goes to the log rather than into the job, which is
 * read by the caller and should not carry whatever a provider error says.
 */
async function runJobWork<TPublicResult extends JobResult>(
  work: () => Promise<ApiResponse<TPublicResult>>,
  kind: StoryLabGenerationJobKind,
  jobId: string,
  requestId: string
): Promise<ApiResponse<TPublicResult>> {
  try {
    return await work();
  } catch (error) {
    logError(`Story Lab ${kind} job work threw`, error, {
      requestId,
      endpoint: '/api/story-lab/jobs'
    }, { jobId, kind });

    return {
      success: false,
      error: {
        code: 'GENERATION_FAILED',
        message: `Story Lab ${kind} generation failed unexpectedly.`
      }
    };
  }
}

async function finishJob<TPublicResult extends JobResult>(
  store: StoryLabJobStore,
  ownerUserId: string | undefined,
  jobId: string,
  result: ApiResponse<TPublicResult>
): Promise<StoryLabJobCreationResponse<TPublicResult> | null> {
  if (result.success) {
    return store.updateJob<TPublicResult>(jobId, {
      ownerUserId,
      status: 'completed',
      currentStep: 'completed',
      progressPercent: 100,
      result: result.data
    });
  }

  return store.updateJob<TPublicResult>(jobId, {
    ownerUserId,
    status: 'failed',
    currentStep: 'failed',
    progressPercent: 100,
    error: toJobError(result.error)
  });
}

async function tryJobStoreOperation<T>(
  res: ResponseLike,
  operation: () => T | Promise<T>
): Promise<JobStoreOperationResult<T>> {
  try {
    return {
      ok: true,
      value: await operation()
    };
  } catch (error) {
    if (!isStoryLabJobStoreError(error)) {
      throw error;
    }

    sendJson(res, jobStoreErrorStatus(error), jobStoreErrorResponse(error));
    return {
      ok: false
    };
  }
}

async function resolveJobStoreOrRespond(
  context: StoryLabJobRouteContext,
  req: RequestLike,
  res: ResponseLike,
  requestId: string
): Promise<ResolvedJobStore | null> {
  const config = context.createJobStoreConfig();
  if (!config.store || !config.isConfigured()) {
    sendJson(res, 503, jobStoreUnavailable(config, requestId));
    return null;
  }

  if (config.store.durable) {
    const user = await requireJobRouteUser(context.authPort, req, res);
    if (!user) {
      return null;
    }

    return {
      store: config.store,
      ownerUserId: user.userId
    };
  }

  return {
    store: config.store
  };
}

function createDefaultJobRouteContext(): StoryLabJobRouteContext {
  return {
    authPort: configuredAuthPort,
    profileStore: createStoryLabCloudStorage().profileStore,
    createJobStoreConfig: () => createStoryLabJobStoreConfig(),
    generateGenesis: generateStoryLabGenesis,
    continueStory: continueStoryLab
  };
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
async function loadAuthenticatedContentBoundaries(
  context: StoryLabJobRouteContext,
  req: RequestLike
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
 * not, so manufacturing a contract here for a continuation that supplied none
 * would turn a request that used to succeed into one that fails the adult-
 * reader gate it never actually asked for. Only `noGoContent` — the free-text
 * field this is the profile-wide counterpart of — is touched, joined onto
 * whatever the request itself already carried rather than replacing it.
 *
 * Exported so the value the prompt is actually built from can be asserted on
 * directly, the way `buildSceneDescriptionFromStory` is: the widest merge this
 * produces is what the prompt's bound on that field is measured against, and
 * reconstructing the join in a test would prove the bound against a string this
 * function does not build.
 */
export function withMergedContentBoundaries(
  heatContract: HeatContract,
  contentBoundaries: string | undefined
): HeatContract {
  if (!contentBoundaries) {
    return heatContract;
  }

  const existing = heatContract.noGoContent?.trim();
  return {
    ...heatContract,
    noGoContent: existing ? `${existing}\n${contentBoundaries}` : contentBoundaries
  };
}

async function requireJobRouteUser(authPort: AuthPort, req: RequestLike, res: ResponseLike): Promise<AuthUser | null> {
  try {
    return await authPort.requireUser(req);
  } catch (error) {
    if (isAuthError(error)) {
      sendJson(res, error.statusCode, {
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
      return null;
    }

    sendJson(res, 401, {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Account authentication is required.'
      }
    });
    return null;
  }
}

function normalizeContinuationInput(input: unknown): StoryContinuationSeam['input'] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const partial = input as Partial<StoryContinuationSeam['input']>;
  const storyId = typeof partial.storyId === 'string' ? partial.storyId.trim() : '';
  const transientSnapshot = storyId ? getTransientStorySnapshot(storyId) : null;
  const hasChapters = Array.isArray(partial.previouslyGeneratedChapters);
  const batchSizeNumber = Number(partial.chapterBatchSize);
  const storyState = partial.storyState ?? transientSnapshot?.state;
  const previouslyGeneratedChapters = hasChapters
    ? partial.previouslyGeneratedChapters ?? []
    : transientSnapshot?.chapters;

  if (
    !storyId ||
    !storyState ||
    !previouslyGeneratedChapters ||
    !isChapterBatchSize(batchSizeNumber)
  ) {
    return null;
  }

  return {
    storyId,
    storyState,
    previouslyGeneratedChapters,
    continuationBrief: partial.continuationBrief,
    forceCliffhanger: partial.forceCliffhanger,
    existingSummary: partial.existingSummary ?? transientSnapshot?.summary,
    chapterBatchSize: batchSizeNumber,
    heatContract: partial.heatContract
  };
}


function readValidJobIdOrRespond(req: RequestLike, res: ResponseLike): string | null {
  if ((req.method ?? '').toUpperCase() !== 'GET') {
    sendMethodNotAllowed(res, STORY_LAB_JOB_READ_METHODS, 'Only GET requests are supported.');
    return null;
  }

  const jobId = readJobId(req);
  if (!jobId || !assertOpaqueStoryLabJobId(jobId)) {
    sendJson(res, 400, invalidJobId());
    return null;
  }

  return jobId;
}

function isEventsRequest(req: RequestLike): boolean {
  const eventsFlag = Array.isArray(req.query?.['events']) ? req.query?.['events'][0] : req.query?.['events'];
  if (eventsFlag === '1' || eventsFlag === 'true') {
    return true;
  }

  return (req.url ?? '').split('?')[0].endsWith('/events');
}

function readJobId(req: RequestLike): string | null {
  const queryJobId = Array.isArray(req.query?.['jobId']) ? req.query?.['jobId'][0] : req.query?.['jobId'];
  if (queryJobId) {
    return queryJobId;
  }

  if (!req.url) {
    return null;
  }

  const pathname = req.url.split('?')[0];
  const match = /\/api\/story-lab\/jobs\/([^/]+)/.exec(pathname);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function sendJson<T>(res: ResponseLike, statusCode: number, body: T): void {
  res.status(statusCode).json(body);
}

function invalidRequest(message: string): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'INVALID_REQUEST',
      message
    }
  };
}

function invalidJobId(): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'INVALID_JOB_ID',
      message: 'Job id must be an opaque Story Lab job id.'
    }
  };
}

function jobNotFound(): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'JOB_NOT_FOUND',
      message: 'Story Lab job was not found. Non-durable jobs may disappear after a cold start or deploy.'
    }
  };
}

function jobStoreUnavailable(config: StoryLabJobStoreConfig, requestId: string): ApiResponse<never> {
  const routeAuthRequired = Boolean(config.store?.durable);
  const durableMisconfigured = config.mode === 'postgres' && (!config.databaseUrlConfigured || !config.executorConfigured);
  const message = config.mode === 'unsupported'
    ? 'Story Lab job storage mode is not supported.'
    : durableMisconfigured
      ? 'Durable Story Lab job storage is not configured.'
    : routeAuthRequired
      ? 'Durable Story Lab job storage requires owner-scoped route auth before it can be enabled.'
      : 'Story Lab job storage is not configured.';
  logWarn('Story Lab job store unavailable', {
    requestId,
    endpoint: '/api/story-lab/jobs',
    statusCode: 503
  }, {
    requestedMode: config.requestedMode,
    mode: config.mode,
    databaseUrlConfigured: config.databaseUrlConfigured,
    executorConfigured: config.executorConfigured,
    errorCode: config.errorCode,
    routeAuthRequired
  });
  return {
    success: false,
    error: {
      code: 'JOB_STORE_UNAVAILABLE',
      message
    }
  };
}

function jobStorageFailed(): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'STORY_LAB_JOB_STORAGE_FAILED',
      message: 'Story Lab job storage failed.'
    }
  };
}

function jobStoreErrorResponse(error: StoryLabJobStoreError): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: jobStorePublicMessage(error)
    }
  };
}

function jobStoreErrorStatus(error: StoryLabJobStoreError): number {
  if (error.code === 'STORY_LAB_JOB_OWNER_REQUIRED') {
    return 401;
  }

  return 503;
}

function jobStorePublicMessage(error: StoryLabJobStoreError): string {
  switch (error.code) {
    case 'STORY_LAB_JOB_STORAGE_UNCONFIGURED':
      return 'Story Lab job storage is not configured.';
    case 'STORY_LAB_JOB_STORAGE_DRIVER_MISSING':
      return 'Story Lab job storage driver is not configured.';
    case 'STORY_LAB_JOB_OWNER_REQUIRED':
      return 'Story Lab job storage requires an authenticated owner.';
    case 'STORY_LAB_JOB_STORAGE_FAILED':
    default:
      return 'Story Lab job storage failed.';
  }
}

/**
 * `ApiResponse<never>['error']` is the union of both envelope arms, so it
 * includes the success arm's absent error. Only the failure arm reaches here —
 * `finishJob` calls this inside its `!result.success` branch — and saying so is
 * what lets the fields be read without a null check the caller has already made.
 */
function toJobError(error: NonNullable<ApiResponse<never>['error']>): StoryLabJobError {
  return {
    code: error.code,
    message: error.message,
    details: error.details
  };
}
