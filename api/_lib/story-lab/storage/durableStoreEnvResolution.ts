// Created: 2026-09-01 EDT
//
// `storyLabJobStoreConfig.ts` and `../../middleware/rateLimitStoreConfig.ts`
// both switch between a process-local default and a Postgres-backed store
// through the identical env-resolution dance: read a mode env var (falling
// back to a default), normalize it, resolve `DATABASE_URL`, and build an
// executor from it, each step preferring an explicit override over `env`
// over `process.env` so a caller-supplied `env: {}` never silently falls
// through to the ambient process environment. Neither piece of that dance is
// specific to jobs or to rate limits — this is the shared implementation, so
// mirroring one durable-store config off the other stays a naming exercise
// rather than a second copy of the same logic.

export interface DurableStoreEnvOptions {
  /** An explicit mode, taking precedence over `env` and `process.env`. */
  modeOverride?: string;
  /** An explicit DATABASE_URL, taking precedence over `env` and `process.env`. */
  databaseUrl?: string;
  /** When provided, resolution reads from this object instead of `process.env` — and does NOT fall through to it. */
  env?: Record<string, string | undefined>;
}

export function resolveDurableStoreMode(
  envVarName: string,
  defaultMode: string,
  options: DurableStoreEnvOptions
): string {
  if (options.modeOverride !== undefined) {
    return options.modeOverride.trim();
  }

  if (options.env) {
    return (options.env[envVarName] ?? defaultMode).trim();
  }

  return (process.env[envVarName] ?? defaultMode).trim();
}

export function normalizeDurableStoreMode(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, '_');
}

export function resolveDurableStoreDatabaseUrl(options: DurableStoreEnvOptions): string {
  if (options.databaseUrl !== undefined) {
    return options.databaseUrl.trim();
  }

  if (options.env) {
    return (options.env['DATABASE_URL'] ?? '').trim();
  }

  return (process.env['DATABASE_URL'] ?? '').trim();
}

export function resolveDurableStoreExecutor<TExecutor>(
  databaseUrl: string,
  explicitExecutor: TExecutor | undefined,
  createExecutor: ((databaseUrl: string) => TExecutor) | undefined,
  createDefaultExecutor: (databaseUrl: string) => TExecutor
): TExecutor | undefined {
  if (explicitExecutor) {
    return explicitExecutor;
  }

  try {
    return createExecutor?.(databaseUrl) ?? createDefaultExecutor(databaseUrl);
  } catch {
    return undefined;
  }
}
