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
assert(schema.includes('create table if not exists story_lab_jobs'), 'schema should create durable Story Lab jobs');
assert(schema.includes('job_id text primary key'), 'jobs should be keyed by opaque job id');
assert(schema.includes('owner_user_id text not null'), 'jobs should carry owner_user_id');
assert(schema.includes('request_json jsonb not null'), 'jobs should persist sanitized request json');
assert(schema.includes('result_json jsonb'), 'jobs should persist result json when completed');
assert(schema.includes('error_json jsonb'), 'jobs should persist safe error json when failed');
assert(schema.includes('create table if not exists story_lab_job_events'), 'schema should create durable Story Lab job events');
assert(schema.includes('sequence_number integer not null'), 'job events should preserve event ordering');
assert(schema.includes('event_json jsonb not null'), 'job events should persist public event snapshots');
assert(schema.includes('story_lab_jobs_owner_updated_idx'), 'schema should index owner job ordering');
assert(schema.includes('story_lab_jobs_owner_idempotency_idx'), 'schema should support owner idempotency lookup');
assert(schema.includes('story_lab_job_events_job_sequence_idx'), 'schema should make job event streams resumable in sequence order');

console.log('Story Lab cloud schema tests passed');
