#!/usr/bin/env tsx
// Created: 2026-06-08 11:05 EDT

import { applyStoryLabCloudSchema } from '../../api/_lib/story-lab/storage/storyLabCloudSchemaMigration';
import { createNeonStoryLabQueryExecutor } from '../../api/_lib/story-lab/storage/neonStoryLabExecutor';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  if (!databaseUrl) {
    console.error('Story Lab cloud schema was not applied: DATABASE_URL is not configured.');
    process.exit(1);
  }

  try {
    const result = await applyStoryLabCloudSchema(createNeonStoryLabQueryExecutor(databaseUrl));
    console.log(`Story Lab cloud schema applied: ${result.statementCount} statements at ${result.appliedAt}.`);
  } catch {
    console.error('Story Lab cloud schema apply failed. Check database provisioning and schema permissions.');
    process.exit(1);
  }
}

main();
