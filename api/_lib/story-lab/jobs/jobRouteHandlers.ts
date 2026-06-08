// Created: 2026-06-07 07:05 EDT

import type {
  ApiResponse,
  StoryContinuationSeam,
  StoryIterationPayload,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse,
  StoryLabJobError
} from '../contracts';
import { applyCorsPolicy } from '../../http/corsPolicy';
import { continueStoryLab, generateStoryLabGenesis } from '../storyLabEngine';
import { getTransientStorySnapshot } from '../stateStore';
import { parseStoryLabBlueprintFromBody } from '../validation/blueprintParser';
import { assertOpaqueStoryLabJobId } from './jobContracts';
import type { StoryLabJobStore } from './jobStorePort';
import {
  createStoryLabJobStoreConfig,
  type StoryLabJobStoreConfig
} from './storyLabJobStoreConfig';

type ContinuationJobResult = StoryIterationPayload & { appendedChapterNumbers: number[] };
type JobResult = StoryIterationPayload | ContinuationJobResult;

interface RequestLike {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(body: unknown): void;
  writeHead?(statusCode: number, headers: Record<string, string>): void;
  write?(chunk: string): void;
  end(): void;
}

export async function handleStoryLabJobsRoute(req: RequestLike, res: ResponseLike): Promise<void> {
  if ((req.method ?? '').toUpperCase() === 'POST') {
    await handleCreateStoryLabJob(req, res);
    return;
  }

  if (isEventsRequest(req)) {
    await handleStreamStoryLabJobEvents(req, res);
    return;
  }

  await handleGetStoryLabJob(req, res);
}

export async function handleCreateStoryLabJob(req: RequestLike, res: ResponseLike): Promise<void> {
  const cors = applyCorsPolicy(req, res, {
    methods: ['POST', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  if ((req.method ?? '').toUpperCase() !== 'POST') {
    sendJson(res, 405, methodNotAllowed('Only POST requests are supported.'));
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || typeof (req.body as { kind?: unknown }).kind !== 'string') {
    sendJson(res, 400, invalidRequest('Request body must include a Story Lab job kind.'));
    return;
  }

  const request = req.body as StoryLabJobCreationRequest;

  if (request.kind === 'export' || request.kind === 'audio') {
    sendJson(res, 400, {
      success: false,
      error: {
        code: 'UNSUPPORTED_JOB_KIND',
        message: 'Export and audio jobs are reserved for the durable job runner and are not supported by this non-durable scaffold.'
      }
    });
    return;
  }

  if (request.kind === 'genesis') {
    await createGenesisJob(request, res);
    return;
  }

  if (request.kind === 'continuation') {
    await createContinuationJob(request, res);
    return;
  }

  sendJson(res, 400, invalidRequest('Story Lab job kind is not supported.'));
}

export async function handleGetStoryLabJob(req: RequestLike, res: ResponseLike): Promise<void> {
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

  const store = resolveJobStoreOrRespond(res);
  if (!store) {
    return;
  }

  const job = await store.getJob(jobId);
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

  const store = resolveJobStoreOrRespond(res);
  if (!store) {
    return;
  }

  const events = await store.getEvents<JobResult>(jobId);
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

  for (const event of events) {
    res.write?.(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
}

async function createGenesisJob(
  request: Extract<StoryLabJobCreationRequest, { kind: 'genesis' }>,
  res: ResponseLike
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

  const store = resolveJobStoreOrRespond(res);
  if (!store) {
    return;
  }

  const job = await store.createJob<StoryIterationPayload>({
    kind: 'genesis',
    currentStep: 'queued',
    idempotencyKey: request.idempotencyKey,
    storyId: request.storyId,
    request: {
      projectId: request.projectId,
      storyId: request.storyId,
      blueprint: parsed.blueprint
    }
  });
  await store.updateJob<StoryIterationPayload>(job.job.jobId, {
    status: 'running',
    currentStep: 'generating_story',
    progressPercent: 25
  });

  const result = await generateStoryLabGenesis(parsed.blueprint);
  sendJson(res, 200, {
    success: true,
    data: await finishJob(store, job.job.jobId, result)
  });
}

async function createContinuationJob(
  request: Extract<StoryLabJobCreationRequest, { kind: 'continuation' }>,
  res: ResponseLike
): Promise<void> {
  const normalized = normalizeContinuationInput(request.continuation);
  if (!normalized) {
    sendJson(res, 400, invalidRequest(
      'Continuation jobs require storyId, storyState or transient snapshot, previous chapters or transient snapshot, and a chapterBatchSize of 1-3.'
    ));
    return;
  }

  const store = resolveJobStoreOrRespond(res);
  if (!store) {
    return;
  }

  const job = await store.createJob<ContinuationJobResult>({
    kind: 'continuation',
    currentStep: 'queued',
    idempotencyKey: request.idempotencyKey,
    storyId: request.storyId ?? normalized.storyId,
    request: {
      projectId: request.projectId,
      storyId: request.storyId ?? normalized.storyId,
      continuation: normalized
    }
  });
  await store.updateJob<ContinuationJobResult>(job.job.jobId, {
    status: 'running',
    currentStep: 'continuing_story',
    progressPercent: 25
  });

  const result = await continueStoryLab(normalized);
  sendJson(res, 200, {
    success: true,
    data: await finishJob(store, job.job.jobId, result)
  });
}

async function finishJob<TPublicResult extends JobResult>(
  store: StoryLabJobStore,
  jobId: string,
  result: ApiResponse<TPublicResult>
): Promise<StoryLabJobCreationResponse<TPublicResult>> {
  if (result.success) {
    return (await store.updateJob<TPublicResult>(jobId, {
      status: 'completed',
      currentStep: 'completed',
      progressPercent: 100,
      result: result.data
    }))!;
  }

  return (await store.updateJob<TPublicResult>(jobId, {
    status: 'failed',
    currentStep: 'failed',
    progressPercent: 100,
    error: toJobError(result.error)
  }))!;
}

function resolveJobStoreOrRespond(res: ResponseLike): StoryLabJobStore | null {
  const config = createStoryLabJobStoreConfig();
  if (!config.store || !config.isConfigured() || config.store.durable) {
    sendJson(res, 503, jobStoreUnavailable(config));
    return null;
  }

  return config.store;
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
    !isValidBatchSize(batchSizeNumber)
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

function isValidBatchSize(size: number): size is StoryContinuationSeam['input']['chapterBatchSize'] {
  return [1, 2, 3].includes(size);
}

function readValidJobIdOrRespond(req: RequestLike, res: ResponseLike): string | null {
  if ((req.method ?? '').toUpperCase() !== 'GET') {
    sendJson(res, 405, methodNotAllowed('Only GET requests are supported.'));
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
  const eventsFlag = Array.isArray(req.query?.events) ? req.query?.events[0] : req.query?.events;
  if (eventsFlag === '1' || eventsFlag === 'true') {
    return true;
  }

  return (req.url ?? '').split('?')[0].endsWith('/events');
}

function readJobId(req: RequestLike): string | null {
  const queryJobId = Array.isArray(req.query?.jobId) ? req.query?.jobId[0] : req.query?.jobId;
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

function methodNotAllowed(message: string): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message
    }
  };
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

function jobStoreUnavailable(config: StoryLabJobStoreConfig): ApiResponse<never> {
  const routeAuthRequired = Boolean(config.store?.durable);
  const message = config.mode === 'unsupported'
    ? 'Story Lab job storage mode is not supported.'
    : routeAuthRequired
      ? 'Durable Story Lab job storage requires owner-scoped route auth before it can be enabled.'
      : 'Story Lab job storage is not configured.';
  return {
    success: false,
    error: {
      code: 'JOB_STORE_UNAVAILABLE',
      message,
      details: {
        requestedMode: config.requestedMode,
        mode: config.mode,
        databaseUrlConfigured: config.databaseUrlConfigured,
        executorConfigured: config.executorConfigured,
        errorCode: config.errorCode,
        routeAuthRequired
      }
    }
  };
}

function toJobError(error: ApiResponse<never>['error']): StoryLabJobError {
  return {
    code: error.code,
    message: error.message,
    details: error.details
  };
}
