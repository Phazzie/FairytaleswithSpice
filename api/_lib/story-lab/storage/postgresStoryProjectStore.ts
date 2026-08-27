// Created: 2026-06-05 04:02 EDT

import type { AuthUser } from '../auth/authPort';
import type { SavedStoryProject, StoryLabLibrarySort } from '../contracts';
import {
  cloneSavedStoryProject,
  createStoredStoryProjectRecord,
  createStoryProjectStoreError,
  errorResult,
  StoryProjectDeleteReceipt,
  StoryProjectListPage,
  StoryProjectListQuery,
  StoryProjectStore,
  StoryProjectStoreError,
  StoryProjectStoreResult,
  StoredStoryProjectRecord,
  successResult,
  toStoryProjectListItem
} from './storyProjectStore';

export interface PostgresQueryExecutor {
  query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }>;
}

export interface PostgresStoryProjectStoreOptions {
  databaseUrl?: string;
  executor?: PostgresQueryExecutor;
  now?: () => string;
}

interface StoryProjectRow {
  id: string;
  story_id: string;
  owner_user_id: string;
  project_json: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

const DEFAULT_ACTIVE_SKIN = 'writing-desk';
const DEFAULT_CREATURE = 'vampire';
const DEFAULT_REVISION = 0;
const DEFAULT_SPICY_LEVEL = 1;
const DEFAULT_TONE = 'dark_romance';

const SAVE_PROJECT_SQL = `
insert into story_projects (
  id,
  owner_user_id,
  story_id,
  title,
  synopsis,
  tone,
  spicy_level,
  creature,
  active_skin,
  latest_revision,
  project_json,
  created_at,
  updated_at
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
on conflict (id) do update set
  title = excluded.title,
  synopsis = excluded.synopsis,
  tone = excluded.tone,
  spicy_level = excluded.spicy_level,
  creature = excluded.creature,
  latest_revision = excluded.latest_revision,
  project_json = excluded.project_json,
  updated_at = excluded.updated_at
where story_projects.owner_user_id = excluded.owner_user_id
returning id, story_id, owner_user_id, project_json, created_at, updated_at
`;

const LOAD_PROJECT_SQL = `
select id, story_id, owner_user_id, project_json, created_at, updated_at
from story_projects
where id = $1 and owner_user_id = $2
limit 1
`;

/**
 * One page of the owner's library, in the order the caller asked for.
 *
 * This used to be a single `order by updated_at desc limit 50` — a cap on the
 * *answer*, applied in the one place that could not know what the answer was
 * ordered by. `handleProjectsRoute` reads `librarySort` off the caller's
 * profile, so the fifty rows were always the fifty most recently updated and
 * the reader's sort only rearranged the survivors: a `title_asc` library was
 * the alphabetical order of the fifty most recently touched projects, not the
 * first fifty by title, and the project that should have been at the top of it
 * was gone with nothing in the response saying so. The in-memory adapter beside
 * this one had no cap at all, so the two did not agree on what the library
 * contained.
 *
 * Taking the ordering as part of the query is what lets the bound stay here,
 * where the rows are. Removing the `limit` and capping at the route would have
 * fixed the ordering and broken the cost: every row of the library, including
 * its whole `project_json`, read and parsed on every listing so that the route
 * could throw most of it away.
 *
 * `ORDER_BY_CLAUSES` is a closed table keyed by `StoryLabLibrarySort` rather
 * than a string built from the caller's value — the ordering comes from a
 * stored profile field, and an `order by` is not a place to find out that a
 * validator was skipped. `id` breaks every tie so one library always pages the
 * same way.
 */
const LIST_PROJECTS_SQL_PREFIX = `
select id, story_id, owner_user_id, project_json, created_at, updated_at
from story_projects
where owner_user_id = $1
order by `;

const LIST_PROJECTS_SQL_SUFFIX = `
limit $2
`;

/**
 * The three orderings `StoryLabLibrarySort` names, as SQL.
 *
 * `updated_desc` and `created_desc` read the columns directly.
 * `title_asc` orders on `lower(title)` so that it does not depend on whether
 * the deployment's collation is case-sensitive — but SQL collation and
 * `localeCompare` are still not the same ordering for accented titles, so this
 * clause decides only *which* rows a page holds. The route re-applies
 * `sortStoryProjectListItems` to the page it gets back, and that comparator is
 * what decides the order a caller actually sees.
 */
const ORDER_BY_CLAUSES: Record<StoryLabLibrarySort, string> = {
  updated_desc: 'updated_at desc, id asc',
  created_desc: 'created_at desc, id asc',
  title_asc: 'lower(title) asc, id asc'
};

/** The owner's whole count, which is not the page's — see `StoryProjectListPage`. */
const COUNT_PROJECTS_SQL = `
select count(*)::int as total
from story_projects
where owner_user_id = $1
`;

const DELETE_PROJECT_SQL = `
delete from story_projects
where id = $1 and owner_user_id = $2
returning id
`;

export function createPostgresStoryProjectStore(
  options: PostgresStoryProjectStoreOptions = {}
): StoryProjectStore {
  return new PostgresStoryProjectStore(options);
}

class PostgresStoryProjectStore implements StoryProjectStore {
  readonly mode = 'postgres';
  readonly durable = true;

  constructor(private readonly options: PostgresStoryProjectStoreOptions) {}

  isConfigured(): boolean {
    return Boolean(this.getDatabaseUrl() && this.options.executor);
  }

  async saveProject(
    user: AuthUser,
    project: SavedStoryProject
  ): Promise<StoryProjectStoreResult<StoredStoryProjectRecord>> {
    const readyError = this.getReadinessError();
    if (readyError) {
      return errorResult(readyError);
    }

    const record = createStoredStoryProjectRecord({
      user,
      project,
      storageMode: this.mode,
      now: this.getNow()
    });

    try {
      const result = await this.executor().query<StoryProjectRow>(SAVE_PROJECT_SQL, [
        record.projectId,
        record.ownerUserId,
        record.storyId,
        record.project.title,
        record.project.synopsis,
        record.project.summary?.tone ?? record.project.blueprint?.tone ?? DEFAULT_TONE,
        record.project.summary?.spicyLevel ?? record.project.blueprint?.spicyLevel ?? DEFAULT_SPICY_LEVEL,
        record.project.blueprint?.creature ?? DEFAULT_CREATURE,
        DEFAULT_ACTIVE_SKIN,
        record.project.state?.revision ?? DEFAULT_REVISION,
        JSON.stringify(record.project),
        record.createdAt,
        record.updatedAt
      ]);

      const row = result.rows[0];
      if (!row) {
        return errorResult(this.ownerConflictError());
      }

      return successResult(recordFromRow(row));
    } catch {
      return errorResult(this.storageError());
    }
  }

  async loadProject(
    user: AuthUser,
    projectId: string
  ): Promise<StoryProjectStoreResult<StoredStoryProjectRecord | null>> {
    const readyError = this.getReadinessError();
    if (readyError) {
      return errorResult(readyError);
    }

    try {
      const result = await this.executor().query<StoryProjectRow>(LOAD_PROJECT_SQL, [projectId, user.userId]);
      const row = result.rows[0];
      if (!row) {
        return successResult(null);
      }

      return successResult(recordFromRow(row));
    } catch {
      return errorResult(this.storageError());
    }
  }

  async listProjects(user: AuthUser, query: StoryProjectListQuery): Promise<StoryProjectStoreResult<StoryProjectListPage>> {
    const readyError = this.getReadinessError();
    if (readyError) {
      return errorResult(readyError);
    }

    // The count is its own statement rather than a window function over the
    // page, because the page is bounded and a `count(*) over ()` beside it
    // would make the database read every row again to answer it — the cost the
    // `limit` is here to avoid.
    const listSql = `${LIST_PROJECTS_SQL_PREFIX}${ORDER_BY_CLAUSES[query.sort]}${LIST_PROJECTS_SQL_SUFFIX}`;

    try {
      const [page, count] = await Promise.all([
        this.executor().query<StoryProjectRow>(listSql, [user.userId, query.limit]),
        this.executor().query<{ total: number }>(COUNT_PROJECTS_SQL, [user.userId])
      ]);

      return successResult({
        items: page.rows.map(row => toStoryProjectListItem(recordFromRow(row))),
        totalCount: count.rows[0]?.total ?? page.rows.length
      });
    } catch {
      return errorResult(this.storageError());
    }
  }

  async deleteProject(user: AuthUser, projectId: string): Promise<StoryProjectStoreResult<StoryProjectDeleteReceipt>> {
    const readyError = this.getReadinessError();
    if (readyError) {
      return errorResult(readyError);
    }

    try {
      const result = await this.executor().query<{ id: string }>(DELETE_PROJECT_SQL, [projectId, user.userId]);
      return successResult({
        projectId,
        deleted: result.rows.length > 0
      });
    } catch {
      return errorResult(this.storageError());
    }
  }

  private getReadinessError(): StoryProjectStoreError | null {
    if (!this.getDatabaseUrl()) {
      return createStoryProjectStoreError(
        'STORY_LAB_STORAGE_UNCONFIGURED',
        'Story Lab cloud storage is not configured.',
        503,
        true
      );
    }

    if (!this.options.executor) {
      return createStoryProjectStoreError(
        'STORY_LAB_STORAGE_DRIVER_MISSING',
        'Story Lab cloud storage driver is not configured.',
        503,
        true
      );
    }

    return null;
  }

  private getDatabaseUrl(): string {
    return this.options.databaseUrl ?? process.env['DATABASE_URL'] ?? '';
  }

  private getNow(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private executor(): PostgresQueryExecutor {
    const executor = this.options.executor;
    if (!executor) {
      throw new Error('Postgres executor missing after readiness check.');
    }
    return executor;
  }

  private storageError(): StoryProjectStoreError {
    return createStoryProjectStoreError(
      'STORY_LAB_STORAGE_ERROR',
      'Story Lab cloud storage failed.',
      500,
      true
    );
  }

  private ownerConflictError(): StoryProjectStoreError {
    return createStoryProjectStoreError(
      'STORY_LAB_PROJECT_FORBIDDEN',
      'You do not have access to this Story Lab project.',
      403
    );
  }
}

function recordFromRow(row: StoryProjectRow): StoredStoryProjectRecord {
  const project = projectFromJson(row.project_json);
  const createdAt = toIsoString(row.created_at);
  const updatedAt = toIsoString(row.updated_at);
  const normalizedProject: SavedStoryProject = {
    ...project,
    id: row.id,
    storyId: row.story_id,
    createdAt,
    updatedAt
  };

  return {
    projectId: row.id,
    storyId: row.story_id,
    ownerUserId: row.owner_user_id,
    project: normalizedProject,
    createdAt,
    updatedAt,
    storageMode: 'postgres'
  };
}

function projectFromJson(value: unknown): SavedStoryProject {
  try {
    if (value === null || value === undefined) {
      throw new Error('Stored Story Lab project JSON is empty.');
    }

    if (typeof value === 'string') {
      return cloneSavedStoryProject(JSON.parse(value) as SavedStoryProject);
    }

    return cloneSavedStoryProject(value as SavedStoryProject);
  } catch {
    throw new Error('Stored Story Lab project JSON is invalid.');
  }
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
