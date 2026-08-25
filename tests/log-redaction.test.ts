#!/usr/bin/env tsx
// Created: 2026-06-05 00:56 EDT

import { redactSensitiveLogData } from '../api/_lib/utils/logger';
import {
  toLoggableBoolean,
  toLoggableStoryId,
  toLoggableNumber,
  toLoggableThemes
} from '../api/_lib/utils/loggableRequestParameters';

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
