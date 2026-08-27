#!/usr/bin/env tsx

import { CliffhangerService, hasIdentifiedCliffhangerType } from '../api/_lib/services/cliffhangerService';
import type { CliffhangerType } from '../api/_lib/types/contracts';

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

// `cliffhangerType` is a placeholder when nothing was detected — the contract
// has no "none" member — and the two fields the caller acts on used to be built
// from it anyway. The suggestions described a twist the scan had just said was
// not there, and the variety score applied a repetition penalty for it.
assert(
  answeredQuestion.suggestedContinuations.length === 0,
  'an undetected cliffhanger suggests no continuations for a hook it did not find ' +
    `(got ${JSON.stringify(answeredQuestion.suggestedContinuations)})`
);

const undetectedAfterTwist = service.analyze(
  '<p>The lamps guttered.</p><p>Did she stay? She stayed, and the night was warm.</p>',
  ['plot_twist']
);

assert(
  !undetectedAfterTwist.cliffhangerDetected,
  'the same closing paragraph is still not a cliffhanger when a previous type is supplied'
);
assert(
  undetectedAfterTwist.varietyScore === 8,
  'a chapter with no cliffhanger cannot repeat the previous one, whatever the placeholder type is ' +
    `(got ${undetectedAfterTwist.varietyScore})`
);

// The detected side of both fields is unchanged: a real hook still carries its
// suggestions, and still loses variety when it repeats the type before it.
const repeatedDanger = service.analyze(
  '<p>The corridor went silent.</p><p>Footsteps stopped outside the door, and her blood froze.</p>',
  ['danger']
);

assert(repeatedDanger.cliffhangerType === 'danger', 'a repeated danger hook is still a danger hook');
assert(
  repeatedDanger.suggestedContinuations.length > 0,
  'a detected cliffhanger still carries its continuation suggestions'
);
assert(
  repeatedDanger.varietyScore === 3,
  `a detected hook repeating the previous type still loses variety (got ${repeatedDanger.varietyScore})`
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

// ...and because that type is the placeholder rather than a finding, the two
// per-type fields must not be built from it. `cliffhangerDetected` is the wider
// condition — it is true for any chapter ending on `?` or `!` — so keying them
// on it closed the `?` case only, where the fallback assigns `mystery` and a
// real type follows. `!` has no fallback, so `She ran!` was handed three
// instructions about a twist ("Reveal the first consequence of the twist") and
// lost five points of variety to a preceding chapter that genuinely was one.
assert(
  exclamation.suggestedContinuations.length === 0,
  'a hook the scan did not classify suggests no continuations for the placeholder type ' +
    `(got ${JSON.stringify(exclamation.suggestedContinuations)})`
);

const exclamationAfterTwist = service.analyze('<p>The lamps guttered.</p><p>She ran!</p>', ['plot_twist']);

assert(
  exclamationAfterTwist.cliffhangerDetected,
  'a closing exclamation is still a cliffhanger when a previous type is supplied'
);
assert(
  exclamationAfterTwist.varietyScore === 8,
  'an unclassified hook cannot repeat the previous one, whatever the placeholder type is ' +
    `(got ${exclamationAfterTwist.varietyScore})`
);

// The predicate the continuation loop feeds `previousCliffhangers` from. It has
// to separate a hook the scan classified from one it only found, because
// pushing the placeholder forward rebuilds the same phantom penalty one chapter
// later — from outside the service, where this test cannot see it.
assert(
  !hasIdentifiedCliffhangerType(exclamation),
  'a closing exclamation matching no pattern carries no identified type'
);
assert(
  !hasIdentifiedCliffhangerType(answeredQuestion),
  'a chapter with no hook at all carries no identified type'
);
assert(
  hasIdentifiedCliffhangerType(repeatedDanger),
  'a pattern-matched danger hook carries an identified type'
);
assert(
  hasIdentifiedCliffhangerType(openQuestion),
  'a closing question resolved to mystery carries an identified type'
);

console.log('Cliffhanger service tests passed');

// ==================== WHOLE-WORD HOOK MATCHING ====================
// The hook lists were matched with `String.prototype.includes`, and the words
// this genre writes constantly sit inside longer words that mean something
// else — or the opposite thing. Each case below is one such collision: the
// prose carries no hook of the named type at all, so the type must not win.

const substringCollisions: Array<{ label: string; markup: string; wrongType: CliffhangerType }> = [
  // `understood` is inside `misunderstood`: a register credited by the word
  // that denies it.
  {
    label: 'misunderstood/understood',
    markup: '<p>She had misunderstood him from the first night.</p>'
      + '<p>He had misunderstood her just as badly.</p>',
    wrongType: 'character_revelation'
  },
  // `decision` is inside `indecision`, and `price` inside `priceless` — the
  // exact collision the continuation pressure scans were fixed for.
  {
    label: 'indecision/decision and priceless/price',
    markup: '<p>Her indecision held the room still.</p>'
      + '<p>The priceless crown sat between them, and her indecision held.</p>',
    wrongType: 'emotional_conflict'
  },
  // `trapped` is inside `strapped`, `shadow` inside `overshadowed`.
  {
    label: 'strapped/trapped and overshadowed/shadow',
    markup: '<p>He was strapped into the chair, overshadowed by the lamp.</p>'
      + '<p>She left him strapped there, overshadowed and alone.</p>',
    wrongType: 'danger'
  },
  // `revealed` is inside `unrevealed`.
  {
    label: 'unrevealed/revealed',
    markup: '<p>The letter stayed unrevealed on the table.</p>'
      + '<p>It stayed unrevealed until morning.</p>',
    wrongType: 'plot_twist'
  }
];

for (const collision of substringCollisions) {
  const analysis = service.analyze(collision.markup);

  assert(
    analysis.cliffhangerType !== collision.wrongType || !hasIdentifiedCliffhangerType(analysis),
    `"${collision.label}" must not classify as ${collision.wrongType}: the longer word is not the hook ` +
      `(got ${JSON.stringify(analysis.cliffhangerType)} with strength ${analysis.cliffhangerStrength})`
  );
}

// `secret` is inside `secretary`, `truth` inside `untruth`. Both are worth a
// `mystery` hit in the closing paragraph, where a hit counts three times over.
const secretaryUntruth = service.analyze(
  '<p>The lamps guttered.</p><p>The secretary repeated the untruth once more.</p>'
);

assert(
  !hasIdentifiedCliffhangerType(secretaryUntruth),
  'a secretary repeating an untruth carries no identified hook ' +
    `(got ${JSON.stringify(secretaryUntruth.cliffhangerType)})`
);

// The repair must not cost the scan the matches it got right: the inflections
// the substring form picked up for free are still hooks.
const inflections: Array<{ markup: string; type: CliffhangerType }> = [
  { markup: '<p>Quiet.</p><p>The dangerous thing was still threatening her.</p>', type: 'danger' },
  { markup: '<p>Quiet.</p><p>She secretly counted the questions she could not ask.</p>', type: 'mystery' },
  { markup: '<p>Quiet.</p><p>The choices and their consequences waited.</p>', type: 'emotional_conflict' }
];

for (const inflection of inflections) {
  const analysis = service.analyze(inflection.markup);

  assert(
    analysis.cliffhangerType === inflection.type && hasIdentifiedCliffhangerType(analysis),
    `an inflected hook is still a hook: expected ${inflection.type} ` +
      `(got ${JSON.stringify(analysis.cliffhangerType)} for ${JSON.stringify(inflection.markup)})`
  );
}

// A hook counts once however many of its spellings the chapter uses, which is
// how the substring scan behaved when one needle was a substring of both. Two
// spellings of one hook must not outscore a chapter carrying two real hooks.
const oneHookTwiceSpelled = service.analyze('<p>Quiet.</p><p>The danger was dangerous.</p>');
const twoDistinctHooks = service.analyze('<p>Quiet.</p><p>Footsteps, and a shadow.</p>');

assert(
  twoDistinctHooks.cliffhangerStrength > oneHookTwiceSpelled.cliffhangerStrength,
  'two distinct hooks should outscore one hook spelled two ways ' +
    `(got ${twoDistinctHooks.cliffhangerStrength} vs ${oneHookTwiceSpelled.cliffhangerStrength})`
);

// A hook phrase is one space wide, and the generator wraps lines inside a
// paragraph. Collapsing the scanned copy's whitespace is what keeps the phrase
// visible; the reported hook text stays the paragraph the reader sees.
const wrappedPhrase = service.analyze('<p>Quiet.</p><p>Her blood\n   froze at the sound.</p>');

assert(
  wrappedPhrase.cliffhangerType === 'danger' && hasIdentifiedCliffhangerType(wrappedPhrase),
  `a hook phrase wrapped across a line is still the phrase (got ${JSON.stringify(wrappedPhrase.cliffhangerType)})`
);

// The boundary between two paragraphs is not a space, so a phrase cannot be
// assembled out of the end of one paragraph and the start of the next.
const phraseAcrossParagraphs = service.analyze('<p>Her blood</p><p>froze at the sound.</p>');

assert(
  !hasIdentifiedCliffhangerType(phraseAcrossParagraphs),
  'a phrase split across two paragraphs is not that phrase ' +
    `(got ${JSON.stringify(phraseAcrossParagraphs.cliffhangerType)})`
);

console.log('Cliffhanger whole-word hook matching tests passed');
