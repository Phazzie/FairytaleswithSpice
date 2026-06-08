-- Story Lab cloud library schema scaffold.
-- Created: 2026-06-08 10:45 EDT
--
-- This file is a migration-ready contract for Vercel Marketplace Postgres/Neon-style
-- storage. It is not executed automatically by the app.

create table if not exists story_lab_profiles (
  user_id text primary key,
  display_name text,
  preferences_json jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists story_projects (
  id text primary key,
  owner_user_id text not null,
  story_id text not null,
  title text not null,
  synopsis text not null,
  tone text not null,
  spicy_level integer not null,
  creature text not null,
  active_skin text not null,
  latest_revision integer not null,
  project_json jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists story_projects_owner_updated_idx
  on story_projects (owner_user_id, updated_at desc)
  where owner_user_id is not null;

create index if not exists story_projects_owner_story_idx
  on story_projects (owner_user_id, story_id)
  where owner_user_id is not null;

create table if not exists story_lab_jobs (
  job_id text primary key,
  owner_user_id text not null,
  kind text not null,
  status text not null,
  current_step text not null,
  progress_percent integer not null default 0,
  idempotency_key text,
  story_id text,
  request_json jsonb not null,
  result_json jsonb,
  error_json jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz
);

create index if not exists story_lab_jobs_owner_updated_idx
  on story_lab_jobs (owner_user_id, updated_at desc)
  where owner_user_id is not null;

create unique index if not exists story_lab_jobs_owner_idempotency_idx
  on story_lab_jobs (owner_user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists story_lab_job_events (
  event_id bigserial primary key,
  job_id text not null references story_lab_jobs(job_id) on delete cascade,
  owner_user_id text not null,
  sequence_number integer not null,
  event_json jsonb not null,
  created_at timestamptz not null
);

create unique index if not exists story_lab_job_events_job_sequence_idx
  on story_lab_job_events (job_id, sequence_number);

create index if not exists story_lab_job_events_owner_job_idx
  on story_lab_job_events (owner_user_id, job_id, sequence_number);

comment on table story_lab_profiles is
  'Private Story Lab user profiles keyed by provider user id. Editable profile fields must not be used for authorization.';

comment on table story_projects is
  'Owner-scoped Story Lab saved projects. App routes must always filter by owner_user_id.';

comment on table story_lab_jobs is
  'Owner-scoped Story Lab job snapshots for the future durable job runner. Current routes remain non-durable until a store uses this table.';

comment on table story_lab_job_events is
  'Ordered public Story Lab job event snapshots for resumable status/event streams.';
