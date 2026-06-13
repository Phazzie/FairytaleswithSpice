#!/usr/bin/env tsx
// Created: 2026-06-08 10:45 EDT

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const schemaPath = resolve('api/_lib/story-lab/storage/storyLabCloudSchema.sql');
const schema = readFileSync(schemaPath, 'utf8').toLowerCase();

assert(schema.includes('create table if not exists story_lab_profiles'), 'schema should create story_lab_profiles');
assert(schema.includes('user_id text primary key'), 'profiles should be keyed by auth user id');
assert(schema.includes('preferences_json jsonb not null'), 'profiles should persist normalized preferences json');
assert(schema.includes('create table if not exists story_projects'), 'schema should create story_projects');
assert(schema.includes('owner_user_id text not null'), 'projects should carry owner_user_id');
assert(schema.includes('project_json jsonb not null'), 'projects should persist full saved project json');
assert(schema.includes('create index if not exists story_projects_owner_updated_idx'), 'schema should index owner library ordering');
assert(schema.includes('where owner_user_id is not null'), 'owner index should be explicitly scoped to owner rows');

console.log('Story Lab cloud schema tests passed');
