#!/usr/bin/env tsx
// Created: 2026-09-03 05:10 EDT

import { resolveAccountPortalAuthConfig } from '../api/_lib/story-lab/auth/accountPortalConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  testReportsNoneWithoutProvider();
  testReportsClerkWithoutPortalUrlWhenUnconfigured();
  testReportsPortalUrlWhenFullyConfigured();
  testTrimsTrailingSlashesFromPortalUrl();
  testIgnoresPortalUrlForNonClerkProvider();

  console.log('Account portal auth config tests passed');
}

function testReportsNoneWithoutProvider() {
  const config = resolveAccountPortalAuthConfig({});
  assert(config.provider === 'none', 'unset provider should report "none"');
  assert(config.accountPortalUrl === null, 'unset provider should never report a portal URL');
}

function testReportsClerkWithoutPortalUrlWhenUnconfigured() {
  const config = resolveAccountPortalAuthConfig({ STORY_LAB_AUTH_PROVIDER: 'clerk' });
  assert(config.provider === 'clerk', 'clerk provider should be reported even without a portal URL');
  assert(config.accountPortalUrl === null, 'a missing CLERK_ACCOUNT_PORTAL_URL should report no usable sign-in link');
}

function testReportsPortalUrlWhenFullyConfigured() {
  const config = resolveAccountPortalAuthConfig({
    STORY_LAB_AUTH_PROVIDER: 'clerk',
    CLERK_ACCOUNT_PORTAL_URL: 'https://accounts.example.com'
  });
  assert(config.provider === 'clerk', 'fully configured Clerk should report provider "clerk"');
  assert(
    config.accountPortalUrl === 'https://accounts.example.com',
    'fully configured Clerk should report the portal base URL'
  );
}

function testTrimsTrailingSlashesFromPortalUrl() {
  const config = resolveAccountPortalAuthConfig({
    STORY_LAB_AUTH_PROVIDER: 'clerk',
    CLERK_ACCOUNT_PORTAL_URL: 'https://accounts.example.com///'
  });
  assert(
    config.accountPortalUrl === 'https://accounts.example.com',
    'trailing slashes should be trimmed so callers can append /sign-in without a double slash'
  );
}

function testIgnoresPortalUrlForNonClerkProvider() {
  const config = resolveAccountPortalAuthConfig({
    CLERK_ACCOUNT_PORTAL_URL: 'https://accounts.example.com'
  });
  assert(config.provider === 'none', 'a portal URL alone, without selecting clerk, should not enable it');
  assert(config.accountPortalUrl === null, 'a portal URL should be ignored when clerk is not the selected provider');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
