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
const hook = 'Who was there?';
const separatedChapters = [
  { label: '<br>', markup: `She opened the door.<br><br>Blood pooled on the floor.<br><br>${hook}` },
  { label: '<div>', markup: `<div>She opened the door.</div><div>Blood pooled on the floor.</div><div>${hook}</div>` },
  { label: '<p>', markup: `<p>She opened the door.</p><p>Blood pooled on the floor.</p><p>${hook}</p>` },
  // A boundary tag carrying attributes is still a boundary. Matching the bare
  // form only would drop the tag as inline markup, gluing the words on either
  // side of it back into one block — the whole defect this scan was fixed for.
  { label: 'attributed <br>', markup: `She opened the door.<br class="scene-break">Blood pooled on the floor.<br class="scene-break">${hook}` },
  { label: 'self-closing <br />', markup: `She opened the door.<br />Blood pooled on the floor.<br />${hook}` },
  { label: 'uppercase <BR>', markup: `She opened the door.<BR CLASS="scene-break">Blood pooled on the floor.<BR CLASS="scene-break">${hook}` },
  { label: 'attributed <p>', markup: `<p class="lede">She opened the door.</p><p data-n="2">Blood pooled on the floor.</p><p>${hook}</p>` },
  // The tag name has to end where the boundary list says it does: `<pre>` is
  // not `<p>`, and `<paragraph>` is not either.
  { label: 'near-miss tag names', markup: `<p>She opened the door.</p><p>A <pre>literal</pre> and a <paragraph>tag</paragraph>.</p><p>${hook}</p>` }
];

for (const chapter of separatedChapters) {
  const analysis = service.analyze(chapter.markup);

  assert(
    analysis.cliffhangerText === hook,
    `a ${chapter.label}-separated chapter should report only its final paragraph as the hook ` +
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
