// Created: 2026-08-26 UTC

import { AssertionError } from 'node:assert';

/**
 * The assertion the `tsx` tests in this directory are written against.
 *
 * Every one of them declares its own copy of the same five lines, which is
 * where this came from: it is the most duplicated block in the repository, and
 * on a pull request that adds a test file those five lines are *new* duplicated
 * code — enough, on a small change, to fail the duplication gate on their own.
 *
 * So new tests import it from here instead. The forty-odd existing copies are
 * left where they are: rewriting them all is a change to every test in the
 * repository and belongs in its own commit, not in one riding along with a
 * behavioural fix.
 *
 * `AssertionError` rather than `Error`, because that is what this is and a test
 * runner prints it as such — the local copies predate nothing in particular and
 * simply never said so.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (condition) {
    return;
  }

  throw new AssertionError({ message });
}
