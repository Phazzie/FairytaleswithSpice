#!/usr/bin/env tsx
// Created: 2026-06-05 00:56 EDT

import { redactSensitiveLogData } from '../api/_lib/utils/logger';
import {
  toLoggableBoolean,
  toLoggableImageStyle,
  toLoggableStoryId,
  toLoggableNumber,
  toLoggableThemes
} from '../api/_lib/utils/loggableRequestParameters';
import { STORY_LAB_THEME_SEED_IDS } from '../shared/storyLabThemeSeeds';
import {
  BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH,
  REDACTED_SENSITIVE_TEXT
} from '../shared/sensitiveTextRedaction';
import { API_KEY_MINIMUM_LENGTH } from '../api/_lib/middleware/security';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const storyText = 'Elena opened the forbidden grimoire and confessed the secret ending.';
const prompt = 'Write a spicy supernatural chapter using the entire private blueprint.';
const email = 'reader@example.com';
const apiKey = 'xai-secret-key-123';
const artifactUrl = 'https://blob.vercel-storage.com/story/export.html?token=private-token';

const redacted = redactSensitiveLogData({
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey
  },
  email,
  prompt,
  storyText,
  rawContent: storyText,
  htmlContent: `<p>${storyText}</p>`,
  exportArtifactUrl: artifactUrl,
  nested: {
    callbackUrl: artifactUrl,
    model: 'grok-4'
  }
});

const serialized = JSON.stringify(redacted);

assert(!serialized.includes(storyText), 'story text should be redacted');
assert(!serialized.includes(prompt), 'prompts should be redacted');
assert(!serialized.includes(email), 'emails should be redacted');
assert(!serialized.includes(apiKey), 'API keys and auth headers should be redacted');
assert(!serialized.includes(artifactUrl), 'artifact URLs should be redacted');
assert(serialized.includes('grok-4'), 'safe operational metadata should be preserved');
assert(serialized.includes('[REDACTED]'), 'redacted logs should use a clear placeholder');

const telemetry = redactSensitiveLogData({
  promptTokens: 123,
  completionTokens: 456,
  tokensConsumed: 579,
  hobby: 'skateboarding near skyscrapers',
  apiKey: 'xai-secret-key-123'
});
const telemetrySerialized = JSON.stringify(telemetry);

assert(telemetrySerialized.includes('promptTokens'), 'token-count telemetry keys should be preserved');
assert(telemetrySerialized.includes('579'), 'token-count telemetry values should be preserved');
// The key surviving is not the value surviving: a redacted field keeps its name
// and loses what is under it, so asserting on the name alone passed while
// `promptTokens` — matched by the `/prompt/i` pattern and filled from the
// provider's usage report on every paid call — was written as `[REDACTED]`.
assert(
  (telemetry as Record<string, unknown>)['promptTokens'] === 123,
  `prompt token counts should survive redaction, got ${JSON.stringify((telemetry as Record<string, unknown>)['promptTokens'])}`
);
assert(
  (telemetry as Record<string, unknown>)['completionTokens'] === 456,
  'completion token counts should survive redaction'
);
// The prompt itself, and every other key the pattern is there for, still does not.
const promptShapedKeys = redactSensitiveLogData({
  prompt: 'system instructions a model was sent',
  systemPrompt: 'you are a storyteller',
  imagePrompt: 'a gothic vampire in candlelight',
  promptText: 'the story so far'
}) as Record<string, unknown>;
for (const key of Object.keys(promptShapedKeys)) {
  assert(
    promptShapedKeys[key] === '[REDACTED]',
    `${key} should still be redacted, got ${JSON.stringify(promptShapedKeys[key])}`
  );
}
assert(telemetrySerialized.includes('skateboarding'), 'normal words beginning with sk should not be redacted');
assert(!telemetrySerialized.includes('xai-secret-key-123'), 'actual API key fields should still be redacted');

const sharedContext = { model: 'grok-4', attempt: 2 };
const sharedReferences = redactSensitiveLogData({
  first: sharedContext,
  second: sharedContext,
  batch: [sharedContext, sharedContext]
}) as Record<string, any>;

assert(sharedReferences.second?.model === 'grok-4', 'a repeated object reference should be redacted, not dropped as circular');
assert(sharedReferences.batch?.[1]?.attempt === 2, 'repeated array entries should keep their values');
assert(
  !JSON.stringify(sharedReferences).includes('[Circular]'),
  'non-circular shared references should never be reported as circular'
);

const prose = redactSensitiveLogData({
  note: 'the forbearer and the torchbearer stayed intact'
}) as Record<string, string>;
assert(
  prose.note === 'the forbearer and the torchbearer stayed intact',
  'a word that merely contains "bearer" is not a credential and must survive redaction'
);

const scheme = redactSensitiveLogData({
  note: 'sent Bearer abc123def456 upstream'
}) as Record<string, string>;
assert(
  !scheme.note.includes('abc123def456'),
  'a real Bearer credential should still be redacted'
);

// The word-boundary guard must not treat the delimiters that actually precede
// a credential as word characters. `=`, `/` and `+` are all valid bearer-token
// characters, so keying the guard off the token grammar would leak these.
for (const delimiter of ['=', ':', '/', '+', '"', ',', '(']) {
  const delimited = redactSensitiveLogData({
    note: `Authorization${delimiter}Bearer abc123def456 upstream`
  }) as Record<string, string>;
  assert(
    !delimited.note.includes('abc123def456'),
    `a Bearer credential introduced by "${delimiter}" should be redacted`
  );
}

// `bearer` is the scheme keyword and an ordinary noun, and this is a
// dark-fantasy story generator: a bearer of a seal, an oath, or bad news
// reaches the logger through prompts, story excerpts and error messages. The
// scheme keyword alone used to be enough to swallow the following word AND
// rewrite the noun to `Bearer`, so the operator reading a failed generation
// lost the word and was told a credential had been there instead. Redaction
// that cries wolf is redaction an operator learns to read past.
for (const sentence of [
  'a standard bearer led the march',
  'the bearer of bad news',
  'The bearer must not be named.',
  'Bearer of the seal walked in',
  'news. Bearer of the seal walked in',
  'He was a bearer, and he ran.',
  // The shapes story content actually takes on its way to the logger. This
  // module is handed `htmlContent` and `storyText` above, so a credential
  // introducer that also abuts narrative prose reintroduces the whole defect
  // on the most common inputs: HTML tags, quoted dialogue, parentheticals and
  // markdown table cells all put a punctuation mark immediately before a
  // capitalized noun.
  '<p>Bearer of the seal walked in</p>',
  '"Bearer of the seal," he said',
  "'Bearer of bad news,' she whispered",
  '(Bearer of the oath) stepped forward',
  '| Bearer of the seal | a row |',
  '[Bearer of the seal] stepped forward',
  'context: The bearer of bad news',
  // The lookback past `header` is exactly one word and only past that suffix.
  // An unbounded scan for an auth field name anywhere before the separator
  // would destroy these.
  'The authorization ceremony: Bearer of the seal',
  'token of my esteem: Bearer of bad news',
  'header: Bearer of the seal',
  // Eight letters is not enough to make a word a credential. These are the
  // verbs that actually follow the noun in story prose, and an eight-character
  // floor destroyed every one of them.
  'the bearer announced victory',
  'the bearer delivered the news',
  'the bearer whispered a warning',
  'the bearer returned at dawn',
  'the bearer answered plainly',
  // A hyphen is ordinary English, not proof of a credential. Reading every
  // non-letter as credential-only destroyed this whole class.
  'the bearer re-entered the chamber',
  'the bearer self-appointed by the court',
  'the bearer half-turned away',
  'the bearer well-known to us',
  'the bearer mother-in-law arrived',
  // A slash joins two halves of one expression exactly as a hyphen does. Adding
  // the hyphen fixed the instance and left the class, and a later review found
  // the rest of it.
  'the bearer and/or recipient must sign',
  'the bearer his/her representative appointed',
  'the bearer either/or clause applies',
  // The full stop that ends the sentence belongs to the sentence. `.` is a
  // `b64token` character, so the token scan took it and every ordinary sentence
  // ending on the word after the noun was credential-shaped on that one
  // character -- losing the word *and* the mark that ended the line.
  'the bearer returned.',
  'the bearer of.',
  'the bearer announced.',
  'the bearer re-entered.',
  'the bearer of the seal walked in. The bearer left.',
  'the bearer of bad news...',
  // Nothing but sentence punctuation after the keyword is not a run at all.
  'Authorization: Bearer ...',
  // Markdown is how story content spells emphasis, and `_` and `~` are
  // `b64token` characters, so a balanced pair around an ordinary word made it
  // carry marks no English word carries. Only balanced pairs: `_abcdef` and
  // `sk_live_abcdef` are still credentials, asserted below.
  // A value that has already closed is not padding around the next one. A
  // non-empty value stops the lookback on its own characters -- `authorization:
  // "abc" Bearer of the seal` was always prose -- and an empty one now stops it
  // too, instead of letting the walk read through to the separator behind it.
  'authorization: "" Bearer of the seal',
  "authorization: '' Bearer of the seal",
  'authorization: "" the bearer announced victory',
  'authorization: "abc" Bearer of the seal',
  'the bearer _returned_ to court',
  'the bearer __of__ the seal',
  'the bearer ~~returned~~ at dawn',
  'the bearer _re-entered_ the chamber',
  'the bearer _returned_.',
  // A separator is not a header. These are a story title, a chapter heading
  // this app generates, and ordinary structured prose -- each puts `:` or `=`
  // immediately before the noun, and each was destroyed until the field name
  // was required as well as the separator.
  'Title: Bearer of the seal',
  'Chapter 3: Bearer of the Oath',
  'role=bearer of bad news',
  'He said: "Bearer of the seal"',
  'note: bearer of bad news',
  // Reading a serialized array's field context does not make the bracket
  // sufficient on its own. Each of these puts the noun inside `[...]`, and the
  // gate that reads the field name is the same one, so each stays prose.
  'Title: ["Bearer of the seal", "Bearer of bad news"]',
  'Chapter 3: ["Bearer of the Oath"]',
  'The authorization ceremony: ["Bearer of the seal"]',
  'header: ["Bearer of the seal"]'
]) {
  const preserved = redactSensitiveLogData({ note: sentence }) as Record<string, string>;
  assert(
    preserved.note === sentence,
    `prose using "bearer" as a word must survive redaction unchanged: ${sentence}`
  );
}

// The other arm, and the one that keeps the repair fail-closed. A credential
// short enough AND alphabetic enough to pass for a word is still redacted when
// it sits where a header puts it -- which is the counterexample that withdrew
// the first attempt at this repair in #313, where a `Bearer abcdef` accepted by
// `authenticateRequest` survived a shape check in the clear.
for (const line of [
  'Authorization: Bearer abcdef',
  'Authorization:Bearer abc',
  'Authorization=Bearer abcdef',
  '{"authorization": "Bearer abcdef"}',
  'x-api-key: Bearer abcdef',
  'AUTHORIZATION:Bearer abcdef',
  // A provider's error text labels the header in words rather than naming it,
  // and an error message often carries a JSON payload that has already been
  // escaped once. Both put explicit authorization context around the
  // credential, and both reached the logger in the clear until the walk
  // learned to read past `header` and past `\`.
  'Invalid Authorization header: Bearer abcdef',
  'Invalid authorization-header: Bearer abcdef',
  'rejected the Authorization headers: Bearer abcdef',
  'payload="{\\"authorization\\":\\"Bearer abcdef\\"}"',
  // A repeated header serializes as `string[]` -- the request contracts in this
  // repository type it that way -- and the walk back from the scheme reaches
  // the `[` or the `,` between elements rather than the field's `:`.
  '{"authorization":["Bearer abcdef"]}',
  '{"x-api-key":["Bearer abcdef"]}',
  'payload="{\\"authorization\\":[\\"Bearer abcdef\\"]}"',
  'Bearer a1b2c3',
  'Bearer k+y/z=',
  'Bearer xai-secret-key-123',
  'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig',
  `Bearer ${'k'.repeat(API_KEY_MINIMUM_LENGTH)}`
]) {
  const hidden = redactSensitiveLogData({ note: line }) as Record<string, string>;
  assert(
    hidden.note.includes(REDACTED_SENSITIVE_TEXT),
    `a Bearer credential must be redacted, not read as prose: ${line}`
  );
}

// The boundary the two arms meet at, asserted in both directions so neither can
// be widened without the suite noticing. A purely alphabetic run of
// `API_KEY_MINIMUM_LENGTH` characters is redacted on length alone with no
// introducer in sight; one character shorter is a word.
const floorCredential = redactSensitiveLogData({
  note: `sent Bearer ${'k'.repeat(API_KEY_MINIMUM_LENGTH)} upstream`
}) as Record<string, string>;
assert(
  !floorCredential.note.includes('k'.repeat(API_KEY_MINIMUM_LENGTH)),
  'a configured-length key is redacted on its length alone, with no introducer present'
);
const belowFloor = redactSensitiveLogData({
  note: `sent Bearer ${'k'.repeat(API_KEY_MINIMUM_LENGTH - 1)} upstream`
}) as Record<string, string>;
assert(
  belowFloor.note.includes('k'.repeat(API_KEY_MINIMUM_LENGTH - 1)),
  'one character below the configured floor is a word, not a credential'
);

// Giving the full stop back to the sentence must not give any of the credential
// back with it, and it must not cost the credential its punctuation either --
// the same trade the URL pass makes further down, where a comma after a link
// belongs to the sentence. Only a *trailing* dot is sentence punctuation: an
// interior one is what makes `ab.cd` and a JWT's three parts credentials at any
// length, and the other `b64token` marks are not sentence punctuation at all.
for (const [line, expected] of [
  ['sent Bearer abc123def456. Then it failed', 'sent Bearer [REDACTED]. Then it failed'],
  ['Authorization: Bearer abcdef.', 'Authorization: Bearer [REDACTED].'],
  ['Bearer ab.cd', 'Bearer [REDACTED]'],
  ['Bearer eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig', 'Bearer [REDACTED]'],
  ['Bearer abcdef/', 'Bearer [REDACTED]'],
  ['Bearer abcdef-', 'Bearer [REDACTED]']
] as const) {
  const stopped = redactSensitiveLogData({ note: line }) as Record<string, string>;
  assert(
    stopped.note === expected,
    `sentence punctuation is the sentence's, the rest of the run is the credential's: ${line} -> ${stopped.note}`
  );
}

// Stopping the lookback at a closed empty value costs exactly one band, and it
// is the band the residual already names: a credential written after one, short
// and alphabetic enough to have no shape, is no longer reached by the header
// arm. Asserted in both directions so the trade is visible rather than implied
// -- anything with a shape is still caught there, at any length.
const afterClosedEmptyValue = redactSensitiveLogData({
  note: 'Authorization: "" Bearer abcdef'
}) as Record<string, string>;
assert(
  afterClosedEmptyValue.note.includes('abcdef'),
  `a closed empty value ends the header context: ${afterClosedEmptyValue.note}`
);
for (const stillCaught of [
  'Authorization: "" Bearer abc123def456',
  'Authorization: "" Bearer xai-secret-key-123',
  `Authorization: "" Bearer ${'k'.repeat(API_KEY_MINIMUM_LENGTH)}`,
  // Two *different* quotes side by side are a value quoted inside another, not
  // a closed empty one -- so the header arm must still reach through them.
  `authorization: "'Bearer abcdef'"`,
  `authorization: '"Bearer abcdef"'`
]) {
  const hidden = redactSensitiveLogData({ note: stillCaught }) as Record<string, string>;
  assert(
    hidden.note.includes(REDACTED_SENSITIVE_TEXT),
    `the shape arm still reaches past a closed empty value: ${stillCaught} -> ${hidden.note}`
  );
}

// The one guarantee no trimming may reach past, and the reason the shape is
// read off the trimmed body while the length is measured on the whole run.
// `API_KEY_CREDENTIAL_GRAMMAR` counts `.`, `_` and `~` inside a token body, so
// a run of `API_KEY_MINIMUM_LENGTH` characters is a value `authenticateRequest`
// can accept whatever those characters are -- `abcdefghijklmno.` is fifteen
// letters and a stop, and it is a configured credential. Trimming the marks out
// of the *length* as well as the shape logged exactly that in the clear.
for (const atFloor of [
  `${'k'.repeat(API_KEY_MINIMUM_LENGTH - 1)}.`,
  `_${'k'.repeat(API_KEY_MINIMUM_LENGTH - 2)}_`,
  `~${'k'.repeat(API_KEY_MINIMUM_LENGTH - 2)}~`,
  `${'k'.repeat(API_KEY_MINIMUM_LENGTH - 3)}...`,
  'k'.repeat(API_KEY_MINIMUM_LENGTH)
]) {
  assert(atFloor.length === API_KEY_MINIMUM_LENGTH, `test setup: ${atFloor} is not at the floor`);
  const hidden = redactSensitiveLogData({
    note: `request failed with Bearer ${atFloor}`
  }) as Record<string, string>;
  assert(
    hidden.note.includes(REDACTED_SENSITIVE_TEXT),
    `every run at the configured floor is a credential, whatever its shape: ${atFloor} -> ${hidden.note}`
  );
}

// The joiners take the floor with them, and that is the whole cost of sparing
// `re-entered` and `and/or`. A run joined by one interior hyphen or slash is
// word-shaped, so it is preserved below the floor exactly as a plain-letters
// run is -- the residual `SECURITY_IMPLEMENTATION_GUIDE.md` Note 7 records, in
// the two spellings it now records it in. Pinned in both directions so the
// documented rule and the code cannot drift: the same run reaching the floor is
// a credential again, which is what keeps a configured entry out of the band.
for (const joined of ['abc/def', 'abc-def']) {
  const spared = redactSensitiveLogData({ note: `sent Bearer ${joined} upstream` }) as Record<string, string>;
  assert(
    spared.note.includes(joined),
    `a run joined by one interior joiner is a word below the floor: ${joined} -> ${spared.note}`
  );
  const atFloor = `${joined}/${'k'.repeat(API_KEY_MINIMUM_LENGTH - joined.length - 1)}`;
  const hidden = redactSensitiveLogData({ note: `sent Bearer ${atFloor} upstream` }) as Record<string, string>;
  assert(
    atFloor.length === API_KEY_MINIMUM_LENGTH && !hidden.note.includes(atFloor),
    `the same shape at the configured floor is a credential again: ${atFloor} -> ${hidden.note}`
  );
}

// The load-bearing tie: the redactor's alphabetic floor IS the floor
// `authenticateRequest` puts on a configured entry. If someone lowers the auth
// contract without lowering this, a configurable key becomes a value the logger
// reads as prose. `shared/` cannot import server middleware (it is bundled into
// the browser app), so the constant is duplicated and pinned here instead.
//
// Asserted as an equality between the two constants rather than against a
// literal 16: the invariant is that they are the same number, not that the
// number is that one. A literal would also fail on a deliberate coordinated
// change, which is the one case here that is not a defect.
assert(
  BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH === API_KEY_MINIMUM_LENGTH,
  'the bearer redactor duplicates this floor as BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH; keep them equal'
);
// A single non-letter is enough at any length -- this is the arm that catches
// every provider token, none of which is purely alphabetic.
// Sparing hyphenated words must not spare a hyphenated credential: a leading or
// doubled hyphen is not a word shape, and a digit or `_` anywhere still settles
// it. Every provider token this app holds fails the word test on one of these.
for (const shortButShaped of [
  'Bearer a1b2c3', 'Bearer k+y/z=', 'Bearer ab.cd',
  'Bearer xai-secret-key-123', 'Bearer sk_live_abcdef',
  'Bearer -abcdef', 'Bearer ab--cd', 'Bearer abcdef-',
  'Bearer /abcdef', 'Bearer ab//cd', 'Bearer abcdef/',
  // Only a *balanced* pair of emphasis marks is Markdown. One end alone is a
  // leading mark exactly as `-abcdef` is, and a provider token wears its
  // underscores on the inside.
  'Bearer _abcdef', 'Bearer abcdef_', 'Bearer ~abcdef', 'Bearer sk_live_abcdef', 'Bearer _a_b_',
  // And only the marks Markdown actually uses for inline emphasis. A hyphen
  // wraps nothing in Markdown -- it opens a list or rules a line -- so a run
  // wearing one at each end is a credential, not an emphasized word.
  'Bearer -abcdef-'
]) {
  const shaped = redactSensitiveLogData({ note: shortButShaped }) as Record<string, string>;
  assert(
    shaped.note.includes(REDACTED_SENSITIVE_TEXT),
    `a short run carrying a non-letter is a credential at any length: ${shortButShaped}`
  );
}

// Every element of a repeated header, not just the one the walk can reach. The
// loop above asserts only that a redaction happened somewhere in the line, so
// an array whose first element was hidden and whose second was logged in the
// clear would pass it -- which is exactly the shape this repair is about. The
// field context belongs to the array, so each element must lose its credential,
// whatever position it sits in.
for (const serialized of [
  '{"authorization":["Bearer abcdef","Bearer ghijkl"]}',
  '{"authorization": ["Bearer abcdef", "Bearer ghijkl"]}',
  '{"authorization":["Basic xyz","Bearer abcdef","Bearer ghijkl"]}',
  // A sibling element may hold a `]` -- `Digest roles=[admin]` is a real header
  // value. Ending the array at the first `]` closed the span inside element one
  // and emitted everything after it in the clear. The credential cannot carry a
  // `]`, which is what made the first reading look safe; the element around it
  // can.
  '{"authorization":["Digest roles=[admin]","Bearer abcdef","Bearer ghijkl"]}',
  '{"authorization":["Bearer abcdef","Digest roles=[admin]","Bearer ghijkl"]}',
  // A quote is closed only by the same character that opened it, so an
  // apostrophe inside a double-quoted element does not end it, and a
  // single-quoted serialization is read the same way as a double-quoted one.
  '{"authorization":["it\'s fine","Bearer abcdef","Bearer ghijkl"]}',
  "{'authorization': ['Digest roles=[admin]', 'Bearer abcdef', 'Bearer ghijkl']}",
  // `\"` is the same two characters in two serializations that need opposite
  // readings, and the pair below is the proof. In the first it is a literal
  // quote *inside* an element, so the `]` after it is content; in the second it
  // is the element delimiter itself, so the `]` after it closes the array.
  // Reading the backslash one way leaks the first, the other way leaks the
  // second -- both readings are taken and the later end wins.
  '{"authorization":["Digest realm=\\"tenant]\\"","Bearer abcdef","Bearer ghijkl"]}',
  'payload="{\\"authorization\\":[\\"Digest roles=[admin]\\",\\"Bearer abcdef\\",\\"Bearer ghijkl\\"]}"',
  '{"authorization":["say \\"hi\\"","Bearer abcdef","Bearer ghijkl"]}',
  // Nesting goes deeper than two spellings. Embedding a payload in a string
  // adds a backslash to every delimiter and more to every literal quote, so a
  // depth-1 delimiter (`\"`) and a depth-2 one are different lengths, and a
  // literal quote at depth 1 is spelled exactly like a depth-2 delimiter. The
  // depth is read off the text rather than guessed.
  'payload="{\\"authorization\\":[\\"Digest realm=\\\\\\"tenant]\\\\\\"\\",\\"Bearer abcdef\\",\\"Bearer ghijkl\\"]}"'
]) {
  const hidden = redactSensitiveLogData({ note: serialized }) as Record<string, string>;
  assert(
    !hidden.note.includes('abcdef') && !hidden.note.includes('ghijkl'),
    `every credential in a serialized header array must be redacted: ${serialized} -> ${hidden.note}`
  );
}

// Matching the opening quote is what stops the span from swallowing the rest of
// the line. An apostrophe inside a double-quoted element does not close it, so
// the array still ends at its own `]` and the prose after it is untouched.
// Reading any quote as closing any other desynchronises the scan, leaves a
// string open across the `]`, and runs the span to the end of the log line --
// which destroys the sentence that follows, the very defect this whole PR is
// about.
// The same guard also pins the rule that only a reading which actually reached
// a `]` may win. A reading run at the wrong nesting depth misreads a delimiter,
// leaves a quote open and falls off the end of the string; letting that count as
// "the later end" ran the span across the whole log line and rewrote the
// sentence after it. An element ending in a literal quote is the shape that
// exposes it.
// The last two are the routes that stopped the readings being compared at all.
// An element ending in a literal backslash puts two backslashes before the
// closing quote, and a scan that demanded exactly the delimiter's count read
// that quote as content, left the element open and ran off the end of the
// string. A literal quote inside an earlier element desynchronised a
// wrong-depth scan far enough to reach the *note's* bracket, which is a real
// `]` and so beat the array's own end in a longest-end comparison. Neither is
// reachable now: the delimiter's spelling is read off the field name before the
// scan starts, so there is one reading and nothing to compare.
for (const note of [
  '{"authorization":["it\'s fine","Bearer abcdef"]} and the bearer announced victory',
  '{"authorization":["ends with a quote\\"","Bearer abcdef"]} and the bearer announced victory',
  '{"authorization":["path=C:\\\\","Bearer abcdef"]} and the bearer announced victory',
  '{"authorization":["say \\"hi","Bearer abcdef"]} and the bearer announced victory'
]) {
  const afterArray = redactSensitiveLogData({ note }) as Record<string, string>;
  assert(
    afterArray.note.endsWith('} and the bearer announced victory'),
    `prose after a credential array must survive: ${afterArray.note}`
  );
  assert(
    !afterArray.note.includes('abcdef'),
    `the credential inside that array must still be redacted: ${afterArray.note}`
  );
}

// An array left unterminated by a truncated log is read to the end of the
// string rather than abandoned, which is the fail-closed direction for a
// redactor and the deliberate opposite of how `shared/storyTextBlocks.ts`
// treats an unterminated comment.
const truncated = redactSensitiveLogData({
  note: '{"authorization":["Bearer abcdef'
}) as Record<string, string>;
assert(
  !truncated.note.includes('abcdef'),
  'a credential inside an unterminated header array is still redacted'
);

// A later real `]` is the shape that made "the longest end that closed wins"
// wrong rather than merely lucky. The note after the array holds a genuine
// bracket, so a scan desynchronised inside the array could reach it and win the
// comparison, and the sentence between the two was rewritten. The bracket in
// the note is not an authorization value -- the field before it is `note` --
// so nothing here is a credential array except the first one.
const laterBracket = redactSensitiveLogData({
  note: '{"authorization":["say \\"hi","Bearer abcdef"]} and note=\\"[the bearer announced victory]\\"'
}) as Record<string, string>;
assert(
  laterBracket.note.endsWith('and note=\\"[the bearer announced victory]\\"'),
  `prose holding a bracket of its own must survive an array before it: ${laterBracket.note}`
);
assert(
  !laterBracket.note.includes('abcdef'),
  `the credential inside that array must still be redacted: ${laterBracket.note}`
);

// A quote whose backslashes do not match the field name's is not this
// serialization's delimiter, and treating it as one is how a value span could
// still reach past its value: nothing closes it, so it runs to the end of the
// line and takes the sentence after it. The field name says depth 0 here and
// the value is written at depth 1, which is a malformed line rather than a
// serialization -- so no span is opened, the credential is still caught by the
// header arm walking back past the escape, and the prose is left alone.
for (const mismatched of [
  'authorization: \\"Bearer abcdef\\" and the bearer announced victory',
  '{"authorization":\\"Bearer abcdef\\"} and the bearer announced victory'
]) {
  const hidden = redactSensitiveLogData({ note: mismatched }) as Record<string, string>;
  assert(
    !hidden.note.includes('abcdef'),
    `a credential in a mismatched-depth value is still redacted: ${hidden.note}`
  );
  assert(
    hidden.note.endsWith('and the bearer announced victory'),
    `a mismatched-depth quote may not open a span that swallows the line: ${hidden.note}`
  );
}

// A repeated header does not have to be an array to arrive as one value: joined
// with commas into a single string is the other serialization, and the walk
// back from the second credential reaches the comma rather than the field. The
// field context belongs to the value, so it carries across everything inside
// the quotes -- an array and a string are the same rule, not two.
for (const joined of [
  '{"authorization":"Bearer abcdef, Bearer ghijkl"}',
  '{"authorization":"Basic xyz, Bearer abcdef, Bearer ghijkl"}',
  // A literal quote inside the value does not end it, for the same reason it
  // does not end an array element: at depth 0 a delimiter carries an even
  // number of backslashes and this one carries an odd number. Ending the value
  // on it drops everything after, and the credential after it is logged clear.
  '{"authorization":"Bearer abcdef, say \\"hi\\", Bearer ghijkl"}',
  'payload="{\\"authorization\\":\\"Bearer abcdef, Bearer ghijkl\\"}"',
  "{'authorization': 'Bearer abcdef, Bearer ghijkl'}"
]) {
  const hidden = redactSensitiveLogData({ note: joined }) as Record<string, string>;
  assert(
    !hidden.note.includes('abcdef') && !hidden.note.includes('ghijkl'),
    `every credential in a comma-joined header value must be redacted: ${joined} -> ${hidden.note}`
  );
}

// What that costs, asserted rather than left implied. Inside a value the writer
// labelled with an authorization field name, `bearer` is header data and the
// word after it is redacted wherever it sits -- exactly as it already was
// inside an array. The cost is bounded by the same gate the rest of this arm
// uses: the field name must be a credential field, and the value must actually
// be serialized as one. A story field is untouched, and so is an unquoted value
// that only a label precedes.
const insideLabelledValue = redactSensitiveLogData({
  note: 'token: "the bearer announced victory"'
}) as Record<string, string>;
assert(
  !insideLabelledValue.note.includes('announced'),
  `prose inside a labelled credential value is treated as header data: ${insideLabelledValue.note}`
);
for (const spared of [
  'token: the bearer announced victory',
  '{"storyText":"the bearer announced victory"}',
  '{"note":"the bearer announced victory"}',
  'Title: "the bearer announced victory"',
  'He said: "Bearer of the seal" and the bearer announced victory'
]) {
  const untouched = redactSensitiveLogData({ note: spared }) as Record<string, string>;
  assert(
    untouched.note === spared,
    `the value span may not reach story prose: ${spared} -> ${untouched.note}`
  );
}

// The delimiter's spelling is read off the field name, so the same array at
// three nesting depths is read three ways without anything being guessed. The
// depth-2 line is the one that used to need a candidate set: a literal quote at
// depth 1 and a delimiter at depth 2 are the same three backslashes.
for (const [depth, serialized] of [
  [0, '{"authorization":["Bearer abcdef","Bearer ghijkl"]}'],
  [1, 'payload="{\\"authorization\\":[\\"Bearer abcdef\\",\\"Bearer ghijkl\\"]}"'],
  [2, 'outer="payload=\\"{\\\\\\"authorization\\\\\\":[\\\\\\"Bearer abcdef\\\\\\",\\\\\\"Bearer ghijkl\\\\\\"]}\\""']
] as const) {
  const hidden = redactSensitiveLogData({ note: serialized }) as Record<string, string>;
  assert(
    !hidden.note.includes('abcdef') && !hidden.note.includes('ghijkl'),
    `an array at depth ${depth} is read from its field name: ${serialized} -> ${hidden.note}`
  );
}

// Reading the arrays costs a pass of its own, so the shapes that pass is worst
// on are held to a time: a bracket per field name, and a credential per array.
// The second is the one that matters — the membership test is a cursor that
// only moves forward precisely because a scan of every recorded span per
// scheme keyword is quadratic on that shape, and a serialized header dump is
// exactly one array and one credential per element.
//
// This bounds the pass; it does not pin every line of it. The restart past a
// recorded span, and the `<=` the cursor advances on, are both unobservable
// here — no input distinguishes them, only a stopwatch on inputs far larger
// than a log line — so they are cheap insurance rather than asserted behaviour.
for (const [label, note] of [
  ['labelled bracket run', 'authorization:['.repeat(20_000)],
  ['credential per element', '{"authorization":["Bearer abcdef"]},'.repeat(20_000)]
] as const) {
  const startedAt = Date.now();
  redactSensitiveLogData({ note });
  const elapsed = Date.now() - startedAt;

  assert(elapsed < 4_000, `${label}: 20,000 arrays took ${elapsed}ms — the array pass is not linear`);
}

// A URL is usually written into a sentence, and the mark that closes the
// sentence has no whitespace before it — so the run that redacted the URL took
// the punctuation with it and left the log line unreadable at exactly the
// moment someone is reading it.
const punctuated: Array<{ note: string; expected: string; why: string }> = [
  {
    note: 'See https://host.example/a, then call me.',
    expected: 'See [REDACTED], then call me.',
    why: 'a comma after a URL belongs to the sentence'
  },
  {
    note: 'Visit (https://host.example/a) now.',
    expected: 'Visit ([REDACTED]) now.',
    why: 'a parenthesis enclosing a URL is not part of it'
  },
  {
    note: 'Fetched https://host.example/a.',
    expected: 'Fetched [REDACTED].',
    why: 'a full stop after a URL belongs to the sentence'
  },
  {
    // The other direction: a path that really does end in a bracket keeps it,
    // because the URL holds the opener that matches it.
    note: 'Fetched https://host.example/wiki/Title_(disambiguation) twice.',
    expected: 'Fetched [REDACTED] twice.',
    why: 'a balanced bracket inside a path is part of the URL'
  }
];

for (const testCase of punctuated) {
  const redactedNote = (redactSensitiveLogData({ note: testCase.note }) as Record<string, string>).note;
  assert(
    redactedNote === testCase.expected,
    `${testCase.why} (got ${JSON.stringify(redactedNote)})`
  );
  assert(
    !redactedNote.includes('host.example'),
    `the URL itself must still be redacted (got ${JSON.stringify(redactedNote)})`
  );
}

const cyclic: Record<string, unknown> = { model: 'grok-4' };
cyclic['self'] = cyclic;
const redactedCycle = redactSensitiveLogData(cyclic) as Record<string, any>;
assert(redactedCycle.self === '[Circular]', 'true cycles should still be broken');

// The two halves of what a request line is made of. `userInput` is free text a
// reader wrote and has to be replaced wholesale; `requestParameters` is the
// already-derived configuration a request was served with, and it has to
// survive — the story routes used to send the second under the key of the
// first, so the redactor blanked it and the log recorded that a generation had
// started and nothing about what was asked for.
const requestLine = redactSensitiveLogData({
  requestId: 'req_abc',
  endpoint: '/api/story/generate',
  userInput: 'Write me a vampire who runs a bakery.',
  requestParameters: {
    creature: 'vampire',
    themes: ['forbidden_love', 'betrayal'],
    spicyLevel: 3,
    wordCount: 900,
    existingContentLength: 1420
  }
}) as Record<string, any>;

assert(requestLine.userInput === '[REDACTED]', 'free-text user input should still be redacted');
assert(
  requestLine.requestParameters?.creature === 'vampire' &&
    requestLine.requestParameters?.spicyLevel === 3 &&
    requestLine.requestParameters?.wordCount === 900 &&
    requestLine.requestParameters?.existingContentLength === 1420,
  `derived request parameters should survive redaction (got ${JSON.stringify(requestLine.requestParameters)})`
);
assert(
  Array.isArray(requestLine.requestParameters?.themes) &&
    requestLine.requestParameters.themes.join(',') === 'forbidden_love,betrayal',
  `theme ids should survive redaction (got ${JSON.stringify(requestLine.requestParameters?.themes)})`
);

// A sensitive key nested inside the parameters is still judged on its own name,
// so the new field is not a hole in the redactor.
const parametersWithSecret = redactSensitiveLogData({
  requestParameters: { creature: 'siren', apiKey: 'xai-secret-key-123' }
}) as Record<string, any>;
assert(
  parametersWithSecret.requestParameters.apiKey === '[REDACTED]' &&
    parametersWithSecret.requestParameters.creature === 'siren',
  'sensitive keys nested under request parameters should still be redacted'
);

// `themes` and `storyId` are the two parameters whose contents the caller
// chooses. `validateStoryInput` bounds the number of themes but never checks
// them against the allow-list they are documented as, and the streaming route
// builds the array by splitting a query string — so an API client can put prose
// in either one. While these fields travelled under `userInput` the redactor
// blanked them along with everything else; under a key that is deliberately
// kept, they have to be reduced before they are handed over.
const privateProse = 'my neighbour Dana is having an affair with her therapist';
const loggableThemes = toLoggableThemes(['forbidden_love', privateProse, 42]);

assert(
  loggableThemes.themes.join(',') === 'forbidden_love',
  `only allow-listed theme ids should survive (got ${JSON.stringify(loggableThemes.themes)})`
);
assert(
  loggableThemes.unrecognizedThemeCount === 2,
  `everything else should be reported as a count (got ${loggableThemes.unrecognizedThemeCount})`
);
assert(
  !JSON.stringify(redactSensitiveLogData({ requestParameters: loggableThemes })).includes('Dana'),
  'caller prose sent as a theme must not reach the log'
);
assert(
  toLoggableThemes(['betrayal', 'revenge']).unrecognizedThemeCount === undefined,
  'an ordinary request should log its themes with no unrecognized count beside them'
);

// The allow-list has to be the vocabulary the app actually sends, not only the
// classic `ThemeType` one. Seven of the twelve seeds the picker offers —
// `court_intrigue`, `blood_oaths`, `slow_burn`, `enemies_to_lovers`,
// `magical_bargain`, `secret_identity`, `forced_proximity` — are on no other
// list, so filtering against `ThemeType` alone reported the app's own themes as
// unrecognised. Every real image generation then logged `themes: []` beside a
// count, which is the marker for "the caller sent something that is not a
// theme" written about the picker's own values.
for (const seed of STORY_LAB_THEME_SEED_IDS) {
  const loggable = toLoggableThemes([seed]);
  assert(
    loggable.themes.join(',') === seed && loggable.unrecognizedThemeCount === undefined,
    `${seed} is on the app's own picker, so the request line should name it (got ${JSON.stringify(loggable)})`
  );
}

const pickedFromTheUi = toLoggableThemes(['court_intrigue', 'blood_oaths']);
assert(
  pickedFromTheUi.themes.join(',') === 'court_intrigue,blood_oaths'
    && pickedFromTheUi.unrecognizedThemeCount === undefined,
  `a request the app itself makes should log its themes intact (got ${JSON.stringify(pickedFromTheUi)})`
);

// Widening the list must not turn the filter off: a value from neither picker
// is still reported by count rather than repeated.
const mixed = toLoggableThemes(['forced_proximity', privateProse]);
assert(
  mixed.themes.join(',') === 'forced_proximity' && mixed.unrecognizedThemeCount === 1,
  `prose sent beside a real seed should still be counted, not repeated (got ${JSON.stringify(mixed)})`
);

// `style` reaches `/api/image/generate`'s request line as caller text: the
// route's guard tests the field for truthiness, and the closed-set check lives
// in `ImageService`, which has not run yet. It is the one field on that line
// that was still being logged verbatim.
assert(
  toLoggableImageStyle('fantasy') === 'fantasy' && toLoggableImageStyle('artistic') === 'artistic',
  'a style the contract names should be logged as it is'
);
assert(
  toLoggableImageStyle(privateProse) === '[UNRECOGNIZED]',
  `prose sent as an image style should be reported, not repeated (got ${toLoggableImageStyle(privateProse)})`
);
assert(
  !JSON.stringify(redactSensitiveLogData({
    requestParameters: { style: toLoggableImageStyle(privateProse) }
  })).includes('Dana'),
  'caller prose sent as an image style must not reach the log'
);
assert(
  toLoggableImageStyle(42) === '[UNRECOGNIZED]' && toLoggableImageStyle(undefined) === '[UNRECOGNIZED]',
  'a non-string style should be reported rather than stringified into the line'
);

// An identifier is filtered by its shape, not its length. A length cap alone
// let anything shorter than the cap through, and most prose is shorter than the
// cap — the sentence above is 55 characters.
assert(
  toLoggableStoryId(privateProse) === '[UNRECOGNIZED]',
  `prose sent as a story id should be reported, not repeated (got ${toLoggableStoryId(privateProse)})`
);
assert(
  toLoggableStoryId(`story_${privateProse.repeat(4)}`) === '[UNRECOGNIZED]',
  'a long run of prose should be reported too'
);
// Prose written with the separators an id uses passes an alphabet check but is
// still prose, which is why the rule is the minted shape rather than a class of
// permitted characters.
assert(
  toLoggableStoryId('Dana_is_in_treatment_at_Rosewood') === '[UNRECOGNIZED]',
  'underscore-separated prose should be reported, not repeated'
);
assert(
  toLoggableStoryId('story-notes-about-Dana-and-Rosewood') === '[UNRECOGNIZED]',
  'hyphen-separated prose should be reported too'
);
// Caller text riding in front of a real UUID: the id-shaped part is genuine, so
// only pinning the whole minted form rejects it.
assert(
  toLoggableStoryId('Dana_at_Rosewood_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f') === '[UNRECOGNIZED]',
  'prose in front of a real uuid should be reported, not repeated'
);
assert(
  toLoggableStoryId('story_Dana_at_Rosewood_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f') === '[UNRECOGNIZED]',
  'prose between the story prefix and the uuid should be reported too'
);
assert(
  toLoggableStoryId('story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f_Dana_at_Rosewood') === '[UNRECOGNIZED]',
  'prose after the uuid should be reported too'
);
// The mock Story Lab path mints the hyphenated form.
assert(
  toLoggableStoryId('story-9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f') ===
    'story-9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
  'the hyphenated minted form should be logged as it is'
);
// A different family of id is not a story id, whatever else it is.
assert(
  toLoggableStoryId('req_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f') === '[UNRECOGNIZED]',
  'a request id is not a story id'
);
assert(
  toLoggableStoryId('story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f') ===
    'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
  'a real story id should be logged exactly as it is'
);
// The stream route mints `story_stream_<uuid>`, so the prefix is not always one
// segment.
assert(
  toLoggableStoryId('story_stream_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f') ===
    'story_stream_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
  'a streaming story id should be logged as it is'
);
assert(
  toLoggableStoryId('a'.repeat(65)) === '[UNRECOGNIZED]',
  'a long run of allowed characters with no uuid in it should be reported'
);
assert(
  toLoggableStoryId('   ') === undefined && toLoggableStoryId(undefined) === undefined,
  'a missing identifier should be omitted rather than reported as unrecognized'
);

// The scalars are typed as numbers and a flag by the contract, but a raw POST
// carries whatever JSON the caller wrote and the checks before these log calls
// test presence rather than type.
assert(
  toLoggableNumber(3) === 3 && toLoggableNumber(0) === 0,
  'a real number should be logged as it is, zero included'
);
assert(
  toLoggableNumber(privateProse) === '[UNRECOGNIZED]' &&
    toLoggableNumber(Number.NaN) === '[UNRECOGNIZED]' &&
    toLoggableNumber({ nested: privateProse }) === '[UNRECOGNIZED]',
  'anything that is not a finite number should be reported, not repeated'
);
assert(
  toLoggableNumber(undefined) === undefined && toLoggableNumber(null) === undefined,
  'a missing number should be omitted rather than reported as unrecognized'
);
assert(
  toLoggableBoolean(false) === false && toLoggableBoolean(true) === true,
  'a real flag should be logged as it is, false included'
);
assert(
  toLoggableBoolean(privateProse) === '[UNRECOGNIZED]',
  'prose sent as a flag should be reported, not repeated'
);
assert(
  toLoggableBoolean(undefined) === undefined,
  'a missing flag should be omitted'
);

console.log('Log redaction tests passed');
