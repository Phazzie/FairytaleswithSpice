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
  // The tag name has to end where the boundary list says it does: a tag whose
  // name merely begins with a listed one is not a boundary, so `<press>` is
  // neither `<p>` nor `<pre>`, `<tracker>` is not `<tr>`, and `<paragraph>` is
  // not `<p>`.
  { label: 'near-miss tag names', markup: `<p>She opened the door.</p><p>A <press>literal</press>, a <tracker>mark</tracker>, and a <paragraph>tag</paragraph>.</p><p>${hook}</p>` },
  // A boundary the enclosing tag carries is not the boundary the reader sees.
  // `<table>` and `<tr>` were boundaries while `<td>` was not, so a row's cells
  // came back welded into one token and the whole table scanned as one block.
  { label: '<td>', markup: `<table><tr><td>She opened the door.</td><td>Blood pooled on the floor.</td></tr><tr><td>${hook}</td></tr></table>` },
  { label: '<li>', markup: `<ul><li>She opened the door.</li><li>Blood pooled on the floor.</li><li>${hook}</li></ul>` },
  { label: '<dd>', markup: `<dl><dt>She opened the door.</dt><dd>Blood pooled on the floor.</dd><dd>${hook}</dd></dl>` }
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

// The same welding, one level in: a row's cells are separate text to a reader,
// so `<td>The shadow</td><td>Footsteps followed her home.</td>` must not scan
// as the single token `The shadowFootsteps followed her home.`.
const gluedCells = service.analyze('<table><tr><td>The shadow moved.</td><td>Footsteps followed her home.</td></tr></table>');

assert(
  gluedCells.cliffhangerText === 'Footsteps followed her home.',
  `table cell text should not be glued to the next cell (got ${JSON.stringify(gluedCells.cliffhangerText)})`
);

// The other direction for the boundary list: a tag whose name merely begins
// with a listed one is inline markup, so it must be dropped in place rather
// than splitting the paragraph it sits inside.
const nearMiss = service.analyze('<p>The shadow moved.</p><p>A <press>hidden</press> <tracker>door</tracker> waited. Who was there?</p>');

assert(
  nearMiss.cliffhangerText === 'A hidden door waited. Who was there?',
  `a near-miss tag name is not a boundary (got ${JSON.stringify(nearMiss.cliffhangerText)})`
);

// A hook is what the chapter *stops* on. The question-mark fallback used to ask
// whether a `?` appeared anywhere in the closing paragraph, so a paragraph that
// raises a question and then answers it scored as a detected `mystery` hook of
// strength 2 — while `cliffhangerDetected`, one line below it, was reading the
// paragraph's last character. Both halves now read the ending.
const answeredQuestion = service.analyze('<p>The lamps guttered.</p><p>Did she stay? She stayed, and the night was warm.</p>');

assert(
  !answeredQuestion.cliffhangerDetected,
  'a closing paragraph that answers its own question is not a cliffhanger ' +
    `(got ${JSON.stringify(answeredQuestion)})`
);
assert(
  answeredQuestion.cliffhangerStrength === 0,
  `an undetected cliffhanger has no strength (got ${answeredQuestion.cliffhangerStrength})`
);
assert(
  answeredQuestion.cliffhangerText === '',
  `an undetected cliffhanger reports no hook text (got ${JSON.stringify(answeredQuestion.cliffhangerText)})`
);

// The same paragraph, left on the question, is still the mystery hook it was.
const openQuestion = service.analyze('<p>The lamps guttered.</p><p>The night was warm, and she stayed. But had she chosen well?</p>');

assert(openQuestion.cliffhangerDetected, 'a closing question is still a cliffhanger');
assert(openQuestion.cliffhangerType === 'mystery', 'a closing question still classifies as mystery');

// An exclamation still ends on a hook, and still falls through to the default
// type rather than being reclassified as a mystery by the question fallback.
const exclamation = service.analyze('<p>The lamps guttered.</p><p>She ran!</p>');

assert(exclamation.cliffhangerDetected, 'a closing exclamation is a cliffhanger');
assert(exclamation.cliffhangerType === 'plot_twist', 'a closing exclamation is not a question');

console.log('Cliffhanger service tests passed');
