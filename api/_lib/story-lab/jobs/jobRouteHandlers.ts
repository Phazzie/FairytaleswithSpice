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
import { nonDurableStoryLabJobStore } from './jobStore';

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

  if ((req.method ?? '').toUpperCase() !== 'GET') {
    sendJson(res, 405, methodNotAllowed('Only GET requests are supported.'));
    return;
  }

  const jobId = readJobId(req);
  if (!jobId || !assertOpaqueStoryLabJobId(jobId)) {
    sendJson(res, 400, invalidJobId());
    return;
  }

  const job = nonDurableStoryLabJobStore.getJob(jobId);
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

  if ((req.method ?? '').toUpperCase() !== 'GET') {
    sendJson(res, 405, methodNotAllowed('Only GET requests are supported.'));
    return;
  }

  const jobId = readJobId(req);
  if (!jobId || !assertOpaqueStoryLabJobId(jobId)) {
    sendJson(res, 400, invalidJobId());
    return;
  }

  const events = nonDurableStoryLabJobStore.getEvents<JobResult>(jobId);
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

  const job = nonDurableStoryLabJobStore.createJob<StoryIterationPayload>({
    kind: 'genesis',
    currentStep: 'queued'
  });
  nonDurableStoryLabJobStore.updateJob<StoryIterationPayload>(job.job.jobId, {
    status: 'running',
    currentStep: 'generating_story',
    progressPercent: 25
  });

  const result = await generateStoryLabGenesis(parsed.blueprint);
  sendJson(res, 200, {
    success: true,
    data: finishJob(job.job.jobId, result)
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

  const job = nonDurableStoryLabJobStore.createJob<ContinuationJobResult>({
    kind: 'continuation',
    currentStep: 'queued'
  });
  nonDurableStoryLabJobStore.updateJob<ContinuationJobResult>(job.job.jobId, {
    status: 'running',
    currentStep: 'continuing_story',
    progressPercent: 25
  });

  const result = await continueStoryLab(normalized);
  sendJson(res, 200, {
    success: true,
    data: finishJob(job.job.jobId, result)
  });
}

function finishJob<TPublicResult extends JobResult>(
  jobId: string,
  result: ApiResponse<TPublicResult>
): StoryLabJobCreationResponse<TPublicResult> {
  if (result.success) {
    return nonDurableStoryLabJobStore.updateJob<TPublicResult>(jobId, {
      status: 'completed',
      currentStep: 'completed',
      progressPercent: 100,
      result: result.data
    })!;
  }

  return nonDurableStoryLabJobStore.updateJob<TPublicResult>(jobId, {
    status: 'failed',
    currentStep: 'failed',
    progressPercent: 100,
    error: toJobError(result.error)
  })!;
}

function normalizeContinuationInput(input: unknown): StoryContinuationSeam['input'] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const partial = input as Partial<StoryContinuationSeam['input']>;
  const storyId = partial.storyId?.trim() ?? '';
  const transientSnapshot = storyId ? getTransientStorySnapshot(storyId) : null;
  const hasChapters = Array.isArray(partial.previouslyGeneratedChapters);
  const batchSizeNumber = Number(partial.chapterBatchSize);

  if (
    !storyId ||
    (!partial.storyState && !transientSnapshot) ||
    (!hasChapters && !transientSnapshot) ||
    !isValidBatchSize(batchSizeNumber)
  ) {
    return null;
  }

  return {
    ...(partial as StoryContinuationSeam['input']),
    storyId,
    storyState: partial.storyState ?? transientSnapshot!.state,
    previouslyGeneratedChapters: hasChapters ? partial.previouslyGeneratedChapters ?? [] : transientSnapshot!.chapters,
    existingSummary: partial.existingSummary ?? transientSnapshot?.summary,
    chapterBatchSize: batchSizeNumber
  };
}

function isValidBatchSize(size: number): size is StoryContinuationSeam['input']['chapterBatchSize'] {
  return [1, 2, 3].includes(size as StoryContinuationSeam['input']['chapterBatchSize']);
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
  const match = pathname.match(/\/api\/story-lab\/jobs\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
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

function toJobError(error: ApiResponse<never>['error']): StoryLabJobError {
  return {
    code: error.code,
    message: error.message,
    details: error.details
  };
}
