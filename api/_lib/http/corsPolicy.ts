// Created: 2026-06-05 01:43 EDT

type HeaderValue = string | string[] | undefined;

export interface CorsRequestLike {
  method?: string;
  headers?: Record<string, HeaderValue>;
}

export interface CorsResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): CorsResponseLike;
  json?(body: unknown): void;
  end?(): void;
}

export interface CorsPolicyOptions {
  methods: string[];
  headers?: string[];
  credentials?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface CorsPolicyResult {
  handled: boolean;
  rejected: boolean;
  allowedOrigin: string | null;
  headers: Record<string, string>;
}

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:4200'];
const ORIGIN_ENV_KEYS = ['STORY_LAB_ALLOWED_ORIGINS', 'ALLOWED_ORIGINS', 'FRONTEND_URL'] as const;
const DEFAULT_HEADERS = [
  'Authorization',
  'Cache-Control',
  'Content-MD5',
  'Content-Type',
  'Date',
  'X-API-Key',
  'X-Api-Version',
  'X-CSRF-Token',
  'X-Request-ID',
  'X-Requested-With'
];

export function parseAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const rawValues = ORIGIN_ENV_KEYS
    .map(key => env[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (!rawValues.length) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  return unique(
    rawValues
      .flatMap(value => value.split(','))
      .map(value => normalizeOrigin(value.trim()))
      .filter((value): value is string => Boolean(value))
  );
}

export function buildCorsHeaders(
  req: CorsRequestLike,
  options: CorsPolicyOptions
): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(req, options);
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': normalizeMethods(options.methods),
    'Access-Control-Allow-Headers': unique(options.headers ?? DEFAULT_HEADERS).join(', ')
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  if (options.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function applyCorsPolicy(
  req: CorsRequestLike,
  res: CorsResponseLike,
  options: CorsPolicyOptions
): CorsPolicyResult {
  const headers = buildCorsHeaders(req, options);
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }

  const requestOrigin = getRequestOrigin(req);
  const allowedOrigin = headers['Access-Control-Allow-Origin'] ?? null;
  const rejected = Boolean(requestOrigin && !allowedOrigin);

  if (rejected) {
    sendCorsForbidden(res);
    return { handled: true, rejected: true, allowedOrigin, headers };
  }

  if ((req.method ?? '').toUpperCase() === 'OPTIONS') {
    res.status(200).end?.();
    return { handled: true, rejected: false, allowedOrigin, headers };
  }

  return { handled: false, rejected: false, allowedOrigin, headers };
}

function resolveAllowedOrigin(req: CorsRequestLike, options: CorsPolicyOptions): string | null {
  const requestOrigin = normalizeOrigin(getRequestOrigin(req) ?? '');
  const allowedOrigins = parseAllowedOrigins(options.env);

  if (requestOrigin) {
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
  }

  return allowedOrigins[0] ?? null;
}

function getRequestOrigin(req: CorsRequestLike): string | undefined {
  const rawOrigin = req.headers?.origin ?? req.headers?.Origin;
  return Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
}

function normalizeOrigin(value: string): string | null {
  if (!value || value === '*') {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeMethods(methods: string[]): string {
  return unique(methods.map(method => method.toUpperCase())).join(', ');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(value => value.trim().length > 0)));
}

function sendCorsForbidden(res: CorsResponseLike): void {
  const response = res.status(403);
  response.json?.({
    success: false,
    error: {
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'Request origin is not allowed.'
    }
  });
}
