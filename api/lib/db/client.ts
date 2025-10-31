import type { Pool, PoolClient, QueryResult } from 'pg';
import { logError, logWarn } from '../utils/logger';

let pool: Pool | null = null;
let inMemoryMode = false;
let pgModule: { Pool: new (...args: any[]) => Pool } | null = null;

function hasPgModule(): boolean {
  try {
    require.resolve('pg');
    return true;
  } catch (error) {
    return false;
  }
}

function getPg(): { Pool: new (...args: any[]) => Pool } | null {
  if (pgModule) {
    return pgModule;
  }

  if (!hasPgModule()) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  pgModule = require('pg');
  return pgModule;
}

function createPool(): Pool | null {
  const connectionString = process.env['DATABASE_URL'];

  if (!connectionString) {
    if (!inMemoryMode) {
      logWarn('DATABASE_URL not configured. Story state persistence will fall back to in-memory mode.', {
        subsystem: 'database',
        module: 'storyStateService'
      });
      inMemoryMode = true;
    }
    return null;
  }

  if (!pool) {
    const pg = getPg();

    if (!pg) {
      logWarn('pg module is not installed. Story state persistence will run in memory mode.', {
        subsystem: 'database',
        module: 'storyStateService'
      });
      inMemoryMode = true;
      return null;
    }

    pool = new pg.Pool({
      connectionString,
      ssl: process.env['DATABASE_SSL'] === 'true'
        ? { rejectUnauthorized: false }
        : undefined
    });

    pool.on('error', (error: Error) => {
      logError('Unexpected error on idle Postgres client', error, {
        subsystem: 'database',
        module: 'storyStateService'
      });
    });
  }

  return pool;
}

export function getPool(): Pool | null {
  return createPool();
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const activePool = getPool();

  if (!activePool) {
    throw new Error('Database connection is not available');
  }

  const client = await activePool.connect();

  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  const activePool = getPool();

  if (!activePool) {
    throw new Error('Database connection is not available');
  }

  return activePool.query<T>(text, params);
}

export function isInMemoryMode(): boolean {
  createPool();
  return inMemoryMode;
}
