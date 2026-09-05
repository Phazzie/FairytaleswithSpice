#!/usr/bin/env tsx
// Created: 2026-09-05 UTC
//
// `story-generator/src/app/app.ts` — Story Lab's top-level Angular
// component — was cut from 3,212 to 3,018 lines by PR #324
// (`***WORST TO BEST*** App god-component`) specifically to end "the entire
// Story Lab frontend crammed into one class." Nothing enforced that fix: in
// the four commits since, almost entirely new sign-in/cloud-library
// plumbing that could have followed the file's own `MemoryCardService`
// pattern instead landed directly on the component, and it grew back to
// 3,339 lines — past its *original*, pre-fix size, with no test or lint
// rule ever failing along the way.
//
// This is the guard that was missing: a hard ceiling, enforced the same way
// `story-generator-component-style-budget.test.ts` bounds this app's CSS.
// It is deliberately tight — headroom for ordinary small changes, not room
// for another feature's worth of state and subscription-lifecycle plumbing
// to land here unnoticed a third time. When a change legitimately needs
// more room than this allows, that is the file asking to be split again,
// not a reason to raise the number without extracting first.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const appPath = join(process.cwd(), 'story-generator/src/app/app.ts');
const lineCount = readFileSync(appPath, 'utf8').split('\n').length;
const maxLineCount = 3100;

assert(
  lineCount <= maxLineCount,
  `story-generator/src/app/app.ts is ${lineCount} lines; keep it at or below ${maxLineCount} lines. `
    + 'This ceiling exists because the file regrew past its own previous size once already '
    + '(PR #324 cut it to 3,018 lines; it reached 3,339 before the next fix) with nothing catching '
    + 'it along the way — extract the new state/logic into a dedicated service (see '
    + 'cloud-library.service.ts, memory-card.service.ts, form-validation.service.ts for the pattern) '
    + 'rather than raising this number.'
);

console.log(`Story generator app.ts line budget: ${lineCount}/${maxLineCount} lines`);
console.log('Story generator app line budget test passed');
