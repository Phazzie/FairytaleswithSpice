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

comment on table story_lab_profiles is
  'Private Story Lab user profiles keyed by provider user id. Editable profile fields must not be used for authorization.';

comment on table story_projects is
  'Owner-scoped Story Lab saved projects. App routes must always filter by owner_user_id.';
