#!/usr/bin/env tsx
// Created: 2026-06-05 00:56 EDT

import { redactSensitiveLogData } from '../api/_lib/utils/logger';
import { toLoggableIdentifier, toLoggableThemes } from '../api/_lib/utils/loggableRequestParameters';

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
  toLoggableIdentifier(privateProse) === '[UNRECOGNIZED]',
  `prose sent as a story id should be reported, not repeated (got ${toLoggableIdentifier(privateProse)})`
);
assert(
  toLoggableIdentifier(`story_${privateProse.repeat(4)}`) === '[UNRECOGNIZED]',
  'a long run of prose should be reported too'
);
assert(
  toLoggableIdentifier('story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f') ===
    'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
  'a real story id should be logged exactly as it is'
);
assert(
  toLoggableIdentifier('a'.repeat(65)) === '[UNRECOGNIZED]',
  'the length bound should still hold for a long run of allowed characters'
);
assert(
  toLoggableIdentifier('   ') === undefined && toLoggableIdentifier(undefined) === undefined,
  'a missing identifier should be omitted rather than reported as unrecognized'
);

console.log('Log redaction tests passed');
