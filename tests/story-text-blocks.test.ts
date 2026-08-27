#!/usr/bin/env tsx
// Created: 2026-08-26

import {
  splitStoryIntoTextBlocks,
  stripStoryHtmlToText
} from '../shared/storyTextBlocks';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// A block-level tag puts a boundary where the markup put one, so two <p>
// elements come back as two blocks rather than one welded-together run.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p>First.</p><p>Second.</p>')) ===
    JSON.stringify(['First.', 'Second.']),
  'adjacent <p> elements should split into separate blocks'
);

// Basic entities are decoded so a quoted line reads as dialogue, not as the
// literal entity text the generator emitted.
assert(
  splitStoryIntoTextBlocks('<p>&quot;Wait,&quot; she said &amp; ran.</p>')[0] ===
    '"Wait," she said & ran.',
  'basic entities should be decoded'
);

// Inline tags are dropped without introducing a boundary, so a run of prose
// split across a <strong> or <em> stays one block.
assert(
  splitStoryIntoTextBlocks('<p>He was <strong>certain</strong> of it.</p>')[0] ===
    'He was certain of it.',
  'inline tags should be stripped without splitting the surrounding block'
);

// Plain text with no markup keeps its own blank-line boundaries.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('One.\n\nTwo.')) === JSON.stringify(['One.', 'Two.']),
  'plain text should still split on blank lines'
);

// Empty and whitespace-only blocks are dropped rather than returned as blanks.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p>Only.</p><p>   </p>')) === JSON.stringify(['Only.']),
  'blank blocks should be filtered out'
);

// `stripStoryHtmlToText` re-joins the same blocks with a blank line between
// them, which is what a reader sees as paragraphs.
assert(
  stripStoryHtmlToText('<p>First.</p><p>Second.</p>') === 'First.\n\nSecond.',
  'stripStoryHtmlToText should join blocks with a blank line'
);

console.log('Story text block tests passed');
