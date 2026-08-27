#!/usr/bin/env tsx
// Created: 2026-08-27 UTC

/**
 * The four severities an error is logged at, and the one table that names them.
 *
 * `ErrorSeverity` was the last closed vocabulary in the Angular contract with
 * no runtime list, and the debug panel — the only screen that reads it — wrote
 * it out twice more:
 *
 * - `getSeverityIcon` decided a glyph per severity in a `switch` whose
 *   `default` was already unreachable;
 * - `getErrorCounts` returned an object literal with one hand-written key per
 *   severity, and the template drew one hand-written `<span *ngIf>` per
 *   severity beside it, each repeating the same emoji the `switch` had just
 *   chosen.
 *
 * Two failures follow from that, and neither is loud. The icons are declared in
 * two files, so the day they disagree the same error is one glyph in the list
 * and a different one in the count beside it. And a fifth severity — which
 * `ErrorLoggingService.logError` would accept, since it takes whatever the
 * caller passes — reaches the list as the `switch`'s neutral `📝` and is not
 * counted at all, on the one row of this panel that says how many of something
 * there are.
 *
 * So this file pins that the icons are declared once, that the header is built
 * by walking the table, and that neither the component nor the template has
 * grown a literal copy of the vocabulary again.
 *
 * The Angular sources are read as text rather than imported for the reason
 * `story-lab-picker-vocabulary` gives: they are components, and the root test
 * runner has no `@angular/core` — importing this one reaches `@angular/common`
 * through the component decorator before a single assertion runs. `contracts.ts`
 * is plain TypeScript and is imported directly.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './assert';
import { ERROR_SEVERITIES } from '../story-generator/src/app/contracts';
import type { ErrorSeverity } from '../story-generator/src/app/contracts';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const component = readSource('story-generator/src/app/error-display/error-display.ts');
const template = readSource('story-generator/src/app/error-display/error-display.html');
const errorLogging = readSource('story-generator/src/app/error-logging.ts');

/**
 * The icon table as the component declares it.
 *
 * `Record<ErrorSeverity, string>` is what makes a *missing* severity a compile
 * error, and the preflight typechecks both Angular projects, so that half is
 * enforced already. Reading the entries back out is what lets the assertions
 * below ask the things a type cannot: that no two severities share a glyph, and
 * that the template does not carry a second copy of any of them.
 */
function readSeverityIcons(): Map<string, string> {
  const block = /const ERROR_SEVERITY_ICONS: Record<ErrorSeverity, string> = \{([^}]*)\}/.exec(component);
  assert(Boolean(block), 'the component should declare its icons as one total record over the vocabulary');

  const icons = new Map<string, string>();
  for (const [, severity, icon] of block![1].matchAll(/(\w+)\s*:\s*'([^']+)'/g)) {
    icons.set(severity, icon);
  }

  return icons;
}

const severityIcons = readSeverityIcons();

// ==================== One icon per severity, and no two alike ====================

for (const severity of ERROR_SEVERITIES) {
  assert(
    Boolean(severityIcons.get(severity)?.trim()),
    `the "${severity}" severity should carry a glyph`
  );
}
assert(
  severityIcons.size === ERROR_SEVERITIES.length,
  'the icon table should name the vocabulary and nothing else'
);
// Two severities sharing a glyph is not a type error, and in the panel it is
// indistinguishable from the counts being wrong.
assert(
  new Set(severityIcons.values()).size === ERROR_SEVERITIES.length,
  'two severities sharing a glyph cannot be told apart in the panel that shows them'
);

// ==================== The panel reads the table ====================

assert(
  component.includes('ERROR_SEVERITIES.map'),
  'the count header should be built by walking the vocabulary'
);
assert(
  !/switch\s*\(\s*severity\s*\)/.test(component),
  'the icon should be read from the table rather than decided by a switch with an unreachable default'
);
assert(
  template.includes('severityCounts'),
  'the template should render whatever the component counted rather than name the severities itself'
);

for (const severity of ERROR_SEVERITIES) {
  assert(
    !template.includes(`count ${severity}`),
    `the template should not write the "${severity}" row out by hand`
  );
  assert(
    !template.includes(severityIcons.get(severity)!),
    `the template should not restate the "${severity}" glyph the component already decided`
  );
}

// The severity a caller does not pass. `logError` defaults it, and that default
// has to be one of the four — it is stamped onto every error logged without one
// and then looked up in the icon table.
const defaultSeverity = /severity:\s*ErrorSeverity\s*=\s*'([a-z]+)'/.exec(errorLogging)?.[1];
assert(
  Boolean(defaultSeverity) && (ERROR_SEVERITIES as readonly string[]).includes(defaultSeverity as ErrorSeverity),
  `the default logging severity should be one of the four, got ${String(defaultSeverity)}`
);

console.log('error severity vocabulary checks passed');
