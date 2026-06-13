#!/usr/bin/env tsx
// Created: 2026-06-08 11:10 EDT

import { checkStoryLabCloudDatabaseReadiness } from '../../api/_lib/story-lab/storage/storyLabCloudDatabaseReadiness';
import { createNeonStoryLabQueryExecutor } from '../../api/_lib/story-lab/storage/neonStoryLabExecutor';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  if (!databaseUrl) {
    console.error('Story Lab cloud DB smoke was not run: DATABASE_URL is not configured.');
    process.exit(1);
  }

  const result = await checkStoryLabCloudDatabaseReadiness(createNeonStoryLabQueryExecutor(databaseUrl));
  if (!result.ready) {
    console.error(`Story Lab cloud DB is not ready. Missing: ${result.missing.join(', ') || 'unknown'}.`);
    process.exit(1);
  }

  console.log(`Story Lab cloud DB is ready at ${result.checkedAt}.`);
}

main().catch(() => {
  console.error('Story Lab cloud DB smoke failed. Check database provisioning and credentials.');
  process.exit(1);
});
