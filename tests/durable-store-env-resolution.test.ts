#!/usr/bin/env tsx
// Created: 2026-09-01 EDT
//
// `durableStoreEnvResolution.ts` is the env-parsing seam shared by
// `story-lab-job-store-config.test.ts` and
// `rate-limit-store-config.test.ts` — both cover it end-to-end through their
// own config, but this proves the seam's own precedence rules directly:
// explicit override beats `env` beats `process.env`, and an explicit
// `env: {}` must never fall through to the ambient process environment.

import {
  normalizeDurableStoreMode,
  resolveDurableStoreDatabaseUrl,
  resolveDurableStoreExecutor,
  resolveDurableStoreMode
} from '../api/_lib/story-lab/storage/durableStoreEnvResolution';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  testModeOverrideBeatsEnv();
  testEnvBeatsProcessEnvAndDoesNotFallThrough();
  testProcessEnvIsTheLastResort();
  testDefaultModeAppliesWhenNothingIsSet();
  testNormalizeDurableStoreModeLowercasesAndCollapsesHyphens();
  testDatabaseUrlFollowsTheSamePrecedence();
  testExecutorPrefersExplicitOverFactoryOverDefault();
  testExecutorFactoryFailureIsUnconfiguredNotThrown();

  console.log('Durable store env resolution tests passed');
}

function testModeOverrideBeatsEnv() {
  const mode = resolveDurableStoreMode('EXAMPLE_STORE', 'memory', {
    modeOverride: ' postgres ',
    env: { EXAMPLE_STORE: 'memory' }
  });
  assert(mode === 'postgres', 'an explicit override should win over env, and be trimmed');
}

function testEnvBeatsProcessEnvAndDoesNotFallThrough() {
  const previous = process.env['EXAMPLE_STORE'];
  process.env['EXAMPLE_STORE'] = 'postgres';
  try {
    const mode = resolveDurableStoreMode('EXAMPLE_STORE', 'memory', { env: {} });
    assert(mode === 'memory', 'an explicit empty env object must not fall through to process.env');
  } finally {
    if (previous === undefined) {
      delete process.env['EXAMPLE_STORE'];
    } else {
      process.env['EXAMPLE_STORE'] = previous;
    }
  }
}

function testProcessEnvIsTheLastResort() {
  const previous = process.env['EXAMPLE_STORE'];
  process.env['EXAMPLE_STORE'] = 'postgres';
  try {
    const mode = resolveDurableStoreMode('EXAMPLE_STORE', 'memory', {});
    assert(mode === 'postgres', 'with no override and no env object, process.env should be read');
  } finally {
    if (previous === undefined) {
      delete process.env['EXAMPLE_STORE'];
    } else {
      process.env['EXAMPLE_STORE'] = previous;
    }
  }
}

function testDefaultModeAppliesWhenNothingIsSet() {
  const mode = resolveDurableStoreMode('EXAMPLE_STORE', 'memory', { env: {} });
  assert(mode === 'memory', 'the caller-supplied default should apply when nothing overrides it');
}

function testNormalizeDurableStoreModeLowercasesAndCollapsesHyphens() {
  assert(normalizeDurableStoreMode(' Non-Durable-Memory ') === 'non_durable_memory', 'normalization should lowercase, trim, and collapse hyphens to underscores');
}

function testDatabaseUrlFollowsTheSamePrecedence() {
  const previous = process.env['DATABASE_URL'];
  process.env['DATABASE_URL'] = 'postgres://process-env/db';
  try {
    assert(
      resolveDurableStoreDatabaseUrl({ databaseUrl: ' postgres://explicit/db ' }) === 'postgres://explicit/db',
      'an explicit databaseUrl should win and be trimmed'
    );
    assert(
      resolveDurableStoreDatabaseUrl({ env: { DATABASE_URL: 'postgres://env/db' } }) === 'postgres://env/db',
      'env should be read when no explicit override is given'
    );
    assert(
      resolveDurableStoreDatabaseUrl({ env: {} }) === '',
      'an explicit empty env object must not fall through to process.env'
    );
    assert(
      resolveDurableStoreDatabaseUrl({}) === 'postgres://process-env/db',
      'process.env should be the last resort'
    );
  } finally {
    if (previous === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = previous;
    }
  }
}

function testExecutorPrefersExplicitOverFactoryOverDefault() {
  const explicit = { kind: 'explicit' };
  const fromFactory = { kind: 'factory' };
  const fromDefault = { kind: 'default' };

  assert(
    resolveDurableStoreExecutor('db-url', explicit, () => fromFactory, () => fromDefault) === explicit,
    'an explicit executor should win over both the factory and the default'
  );
  assert(
    resolveDurableStoreExecutor('db-url', undefined, () => fromFactory, () => fromDefault) === fromFactory,
    'the caller-supplied factory should win over the default when no explicit executor is given'
  );
  assert(
    resolveDurableStoreExecutor('db-url', undefined, undefined, () => fromDefault) === fromDefault,
    'the default factory should run when nothing else is supplied'
  );
}

function testExecutorFactoryFailureIsUnconfiguredNotThrown() {
  const result = resolveDurableStoreExecutor(
    'db-url',
    undefined,
    () => {
      throw new Error('cannot construct executor');
    },
    () => ({ kind: 'default' })
  );
  assert(result === undefined, 'a factory that throws should resolve to undefined rather than propagate');
}

main();
