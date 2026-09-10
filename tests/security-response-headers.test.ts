#!/usr/bin/env tsx
// Created: 2026-09-10 UTC
//
// This app set no `Content-Security-Policy`, `X-Frame-Options`,
// `Strict-Transport-Security`, `Referrer-Policy`, or `Permissions-Policy` on
// any response, anywhere — the only header either deployment target ever sent
// was a bare `X-Content-Type-Options: nosniff`, hardcoded twice
// (`expressApiRoutes.ts` and `withUnhandledRouteFailureLogging.ts`). This
// pins the shared list both call sites (and `vercel.json`, checked below)
// now read from, so they cannot drift back apart the way the two `nosniff`
// literals already had.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { applySecurityResponseHeaders, SECURITY_RESPONSE_HEADERS } from '../api/_lib/http/securityResponseHeaders';

const __dirname = dirname(fileURLToPath(import.meta.url));

class FakeResponse {
  headers: Record<string, string> = {};

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
}

function testSetsEveryDeclaredHeader(): void {
  const res = new FakeResponse();
  applySecurityResponseHeaders(res);

  for (const header of SECURITY_RESPONSE_HEADERS) {
    assert.equal(res.headers[header.key], header.value, `${header.key} should be set to its declared value`);
  }
  assert.equal(
    Object.keys(res.headers).length,
    SECURITY_RESPONSE_HEADERS.length,
    'no extra headers should be set beyond the declared list'
  );
}

function testContentSecurityPolicyDeniesFramingAndPlugins(): void {
  const csp = SECURITY_RESPONSE_HEADERS.find(header => header.key === 'Content-Security-Policy')?.value ?? '';
  assert.match(csp, /frame-ancestors 'none'/, 'the app must not be embeddable in a frame');
  assert.match(csp, /object-src 'none'/, 'no plugin content should be allowed to load');
  assert.match(csp, /default-src 'self'/, 'unlisted resource types should fall back to same-origin only');
}

function testToleratesAResponseDoubleWithNoSetHeader(): void {
  // A bare `ServerResponse`-shaped double (no `setHeader` at all) must not
  // throw — the same defensive-call style `sendGenericFailureEnvelope`
  // already uses for `res.end?.()`.
  assert.doesNotThrow(() => applySecurityResponseHeaders({}));
  assert.doesNotThrow(() => applySecurityResponseHeaders(undefined));
}

function testIsSafeToCallTwice(): void {
  const res = new FakeResponse();
  applySecurityResponseHeaders(res);
  applySecurityResponseHeaders(res);

  for (const header of SECURITY_RESPONSE_HEADERS) {
    assert.equal(res.headers[header.key], header.value);
  }
}

/**
 * `vercel.json`'s static-asset `headers` block and this module's
 * `SECURITY_RESPONSE_HEADERS` are the two places these values are declared —
 * one JSON-only, since the CDN-served static bundle on that deployment never
 * runs this or any other Node code. Nothing at build time keeps them in sync,
 * so this test does: any value edited in one place and not the other fails
 * here instead of shipping two deployments with different security postures.
 */
function testVercelJsonHeadersMatchTheSharedList(): void {
  const vercelConfigPath = join(__dirname, '..', 'vercel.json');
  const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, 'utf-8'));

  const rule = (vercelConfig.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>)
    .find(entry => entry.source === '/(.*)');
  assert.ok(rule, 'vercel.json should declare a headers rule matching every path');

  const vercelHeaders = new Map(rule!.headers.map(header => [header.key, header.value]));
  assert.equal(vercelHeaders.size, SECURITY_RESPONSE_HEADERS.length, 'vercel.json should declare exactly the shared header set');

  for (const header of SECURITY_RESPONSE_HEADERS) {
    assert.equal(
      vercelHeaders.get(header.key),
      header.value,
      `vercel.json's ${header.key} should match the shared SECURITY_RESPONSE_HEADERS value exactly`
    );
  }
}

testSetsEveryDeclaredHeader();
testContentSecurityPolicyDeniesFramingAndPlugins();
testToleratesAResponseDoubleWithNoSetHeader();
testIsSafeToCallTwice();
testVercelJsonHeadersMatchTheSharedList();

console.log('Security response headers tests passed');
