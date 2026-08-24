#!/usr/bin/env tsx

import { CliffhangerService } from '../api/_lib/services/cliffhangerService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const service = new CliffhangerService();

const danger = service.analyze(`
<p>[Narrator]: The corridor went silent.</p>
<p>[Narrator]: Footsteps stopped outside the door, and her blood froze.</p>
`);

assert(danger.cliffhangerDetected, 'danger cliffhanger should be detected');
assert(danger.cliffhangerType === 'danger', 'danger pattern should classify as danger');
assert(danger.cliffhangerStrength > 0, 'danger cliffhanger should have strength');
assert(danger.suggestedContinuations.length > 0, 'danger cliffhanger should include suggestions');

const repeated = service.analyze('A secret waited behind the locked mirror?', ['mystery']);

assert(repeated.cliffhangerDetected, 'question ending should be a cliffhanger');
assert(repeated.cliffhangerType === 'mystery', 'secret/question should classify as mystery');
assert(repeated.varietyScore === 3, 'repeated cliffhanger type should reduce variety score');

// The ending is supposed to weigh more than the middle, which only works if the
// paragraphs are the ones a reader sees. Only `</p>` and blank lines used to
// count as boundaries, so a chapter separated by `<br>` or `<div>` collapsed
// into a single block and "the final paragraph" became the whole chapter.
for (const [markup, label] of [
  ['She opened the door.<br><br>Blood pooled on the floor.<br><br>Who was there?', '<br>'],
  ['<div>She opened the door.</div><div>Blood pooled on the floor.</div><div>Who was there?</div>', '<div>'],
  ['<p>She opened the door.</p><p>Blood pooled on the floor.</p><p>Who was there?</p>', '<p>']
] as const) {
  const analysis = service.analyze(markup);

  assert(
    analysis.cliffhangerText === 'Who was there?',
    `a ${label}-separated chapter should report only its final paragraph as the hook ` +
      `(got ${JSON.stringify(analysis.cliffhangerText)})`
  );
}

// Dropping a tag without putting a boundary in its place ran the neighbouring
// words together, so `door.</p><p>Blood` was scanned as the single token
// `door.Blood`.
const glued = service.analyze('<p>The shadow moved.</p><p>Footsteps followed her home.</p>');

assert(
  glued.cliffhangerText === 'Footsteps followed her home.',
  `paragraph text should not be glued to its neighbour (got ${JSON.stringify(glued.cliffhangerText)})`
);
assert(glued.cliffhangerType === 'danger', 'shadow and footsteps should classify as danger');

console.log('Cliffhanger service tests passed');
