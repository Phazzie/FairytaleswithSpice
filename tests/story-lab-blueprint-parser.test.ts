#!/usr/bin/env tsx
// Created: 2026-06-05 00:56 EDT

import {
  parseStoryLabBlueprintFromBody,
  parseStoryLabBlueprintFromQuery
} from '../api/_lib/story-lab/validation/blueprintParser';
import type { CreatureType } from '../api/_lib/types/contracts';
import {
  describeNarrativeDirectivesOverflow,
  STORY_BLUEPRINT_LIMITS
} from '../shared/storyBlueprintLimits';
import { STORY_LAB_THEME_SEEDS } from '../shared/storyLabThemeSeeds';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const allCreatures: CreatureType[] = [
  'vampire',
  'werewolf',
  'fairy',
  'siren',
  'djinn',
  'witch',
  'dragon',
  'demon',
  'angel',
  'mermaid'
];

function bodyForCreature(creature: CreatureType) {
  return {
    creature,
    tone: 'dark_romance',
    spicyLevel: 3,
    desiredWordBudget: 900,
    chapterBatchSize: 2,
    logline: `A ${creature} tests shared Story Lab validation.`,
    themes: [
      {
        id: 'forbidden_love',
        label: 'Forbidden Love',
        description: 'Desire has consequences.'
      }
    ],
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: 'No coercion.'
    }
  };
}

for (const creature of allCreatures) {
  const postResult = parseStoryLabBlueprintFromBody(bodyForCreature(creature));
  assert(!postResult.error, `${creature} should parse from POST body`);
  assert(postResult.blueprint.creature === creature, `${creature} should survive POST parsing`);
  assert(postResult.blueprint.logline === `A ${creature} tests shared Story Lab validation.`, `${creature} logline should be trimmed and preserved`);
  assert(postResult.blueprint.themes[0].id === 'forbidden_love', `${creature} themes should survive POST parsing`);
  assert(postResult.blueprint.heatContract?.adultOnlyConfirmed === true, `${creature} Heat Contract should survive POST parsing`);

  const queryResult = parseStoryLabBlueprintFromQuery({
    ...bodyForCreature(creature),
    spicyLevel: '3',
    desiredWordBudget: '900',
    chapterBatchSize: '2',
    themes: JSON.stringify(bodyForCreature(creature).themes),
    heatContract: JSON.stringify(bodyForCreature(creature).heatContract)
  });

  assert(!queryResult.error, `${creature} should parse from stream query`);
  assert(JSON.stringify(queryResult.blueprint) === JSON.stringify(postResult.blueprint), `${creature} POST and query parsing should normalize identically`);
}

const invalidCreature = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  creature: 'gargoyle'
});
assert(invalidCreature.error?.message.includes('vampire'), 'invalid creature message should list supported creature options');

const invalidBody = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  logline: '   ',
  chapterBatchSize: 4
});
assert(invalidBody.error?.invalidFields.includes('logline'), 'blank logline should be reported as invalid');
assert(invalidBody.error?.invalidFields.includes('chapterBatchSize'), 'invalid chapterBatchSize should be reported as invalid');

// ---------------------------------------------------------------------------
// Size limits. Every free-text field below is interpolated into the Grok prompt
// the route pays for, and the caps existed only in the browser's form: a caller
// that posted the blueprint itself, or a stale tab, could send unbounded prose
// into a paid generation. The limits come from `shared/storyBlueprintLimits`,
// which the Angular form reads too, so the two readings cannot drift apart.
// ---------------------------------------------------------------------------

function longText(length: number): string {
  return 'a'.repeat(length);
}

const atTheLimit = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  logline: longText(STORY_BLUEPRINT_LIMITS.maxLoglineLength),
  worldDetails: longText(STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength),
  narrativeDirectives: longText(STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength),
  protagonistName: longText(STORY_BLUEPRINT_LIMITS.maxCharacterNameLength),
  antagonistName: longText(STORY_BLUEPRINT_LIMITS.maxCharacterNameLength),
  heatContract: {
    ...bodyForCreature('dragon').heatContract,
    noGoContent: longText(STORY_BLUEPRINT_LIMITS.maxNoGoContentLength)
  }
});
assert(!atTheLimit.error, 'a blueprint exactly at every limit should parse');

const overTheLimit = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  logline: longText(STORY_BLUEPRINT_LIMITS.maxLoglineLength + 1),
  worldDetails: longText(STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength + 1),
  narrativeDirectives: longText(STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength + 1)
});
assert(overTheLimit.error?.invalidFields.includes('logline'), 'an over-long logline should be reported as invalid');
assert(overTheLimit.error?.invalidFields.includes('worldDetails'), 'over-long world details should be reported as invalid');
assert(
  overTheLimit.error?.invalidFields.includes('narrativeDirectives'),
  'over-long narrative directives should be reported as invalid'
);
assert(
  overTheLimit.error?.message.includes(String(STORY_BLUEPRINT_LIMITS.maxLoglineLength)),
  'the refusal should name the limit the caller has to write under'
);

// The two free-text fields the parser used to read straight into the returned
// blueprint without measuring. `buildContinuityPrompt` stringifies both into the
// continuity model call exactly as they arrived, so an unbounded field named for
// one person is a paid model call billed by the token — the failure the shared
// limits object exists to prevent, on the two fields it did not cover.
for (const field of ['protagonistName', 'antagonistName'] as const) {
  const overLongName = parseStoryLabBlueprintFromBody({
    ...bodyForCreature('dragon'),
    [field]: longText(STORY_BLUEPRINT_LIMITS.maxCharacterNameLength + 1)
  });
  assert(
    overLongName.error?.invalidFields.includes(field),
    `an over-long ${field} should be reported as invalid`
  );
  assert(
    overLongName.error?.message.includes(String(STORY_BLUEPRINT_LIMITS.maxCharacterNameLength)),
    `the ${field} refusal should name the limit the caller has to write under`
  );
}

// The query-string genesis stream takes the same blueprint, and is the path a
// caller reaches without the app's form in front of it.
const overLongNameFromQuery = parseStoryLabBlueprintFromQuery({
  ...bodyForCreature('dragon'),
  themes: JSON.stringify(bodyForCreature('dragon').themes),
  heatContract: JSON.stringify(bodyForCreature('dragon').heatContract),
  protagonistName: longText(STORY_BLUEPRINT_LIMITS.maxCharacterNameLength + 1)
} as Record<string, string | number>);
assert(
  overLongNameFromQuery.error?.invalidFields.includes('protagonistName'),
  'the query-string genesis stream should refuse an over-long protagonistName too'
);

const tooManyThemes = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  themes: Array.from({ length: STORY_BLUEPRINT_LIMITS.maxThemes + 1 }, (_unused, index) => ({
    id: `theme_${index}`,
    label: `Theme ${index}`,
    description: 'One more thread than the generator will weave.'
  }))
});
assert(tooManyThemes.error?.invalidFields.includes('themes'), 'more themes than the cap should be reported as invalid');

// How many seeds arrive was measured; how large one is was not. Every seed's
// `label` reaches the continuity model call through `buildContinuityPrompt`,
// and both `label` and `description` are written into a stored `PlotThread` by
// `buildInitialThreads`, so an unbounded seed is billed by the token and then
// kept.
const overLongThemeLabel = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  themes: [{
    id: 'forbidden_love',
    label: longText(STORY_BLUEPRINT_LIMITS.maxThemeLabelLength + 1),
    description: 'A dangerous bond.'
  }]
});
assert(
  overLongThemeLabel.error?.invalidFields.includes('themes'),
  'a theme seed label past the cap should be reported as an invalid theme'
);
assert(
  overLongThemeLabel.error?.message.includes('themes[0].label'),
  'the refusal should name which seed and which field has to be fixed'
);

const overLongThemeDescription = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  themes: [{
    id: 'forbidden_love',
    label: 'Forbidden Love',
    description: longText(STORY_BLUEPRINT_LIMITS.maxThemeDescriptionLength + 1)
  }]
});
assert(
  overLongThemeDescription.error?.invalidFields.includes('themes'),
  'a theme seed description past the cap should be reported as an invalid theme'
);

// The query-string genesis stream takes the same blueprint, so it takes the
// same caps — it is the path with no form in front of it.
const overLongThemeFromQuery = parseStoryLabBlueprintFromQuery({
  ...bodyForCreature('dragon'),
  themes: JSON.stringify([{
    id: 'forbidden_love',
    label: longText(STORY_BLUEPRINT_LIMITS.maxThemeLabelLength + 1),
    description: 'A dangerous bond.'
  }]),
  heatContract: JSON.stringify(bodyForCreature('dragon').heatContract)
} as Record<string, string | number>);
assert(
  overLongThemeFromQuery.error?.invalidFields.includes('themes'),
  'the query-string genesis stream should refuse an over-long theme seed too'
);

// A seed exactly at both caps is a seed the routes accept, so the caps and the
// prompt boundary in `StoryService` cannot disagree about it.
const themeAtTheLimit = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  themes: [{
    id: 'forbidden_love',
    label: longText(STORY_BLUEPRINT_LIMITS.maxThemeLabelLength),
    description: longText(STORY_BLUEPRINT_LIMITS.maxThemeDescriptionLength)
  }]
});
assert(!themeAtTheLimit.error, 'a theme seed exactly at both caps should be accepted');

// The twelve seeds the picker actually offers have to clear the caps they are
// measured against, or the app cannot generate with its own list.
for (const seed of STORY_LAB_THEME_SEEDS) {
  assert(
    seed.label.length <= STORY_BLUEPRINT_LIMITS.maxThemeLabelLength
      && seed.description.length <= STORY_BLUEPRINT_LIMITS.maxThemeDescriptionLength,
    `the offered theme seed "${seed.id}" should clear the blueprint caps`
  );
}

const overLongNoGoContent = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  heatContract: {
    ...bodyForCreature('dragon').heatContract,
    noGoContent: longText(STORY_BLUEPRINT_LIMITS.maxNoGoContentLength + 1)
  }
});
assert(
  overLongNoGoContent.error?.invalidFields.includes('heatContract'),
  'over-long Heat Contract no-go content should be reported as invalid'
);

// The stream route reads the same blueprint out of a query string, so the caps
// have to hold on that path too — it is the one a caller reaches with nothing
// but a URL.
const overTheLimitQuery = parseStoryLabBlueprintFromQuery({
  ...bodyForCreature('dragon'),
  spicyLevel: '3',
  desiredWordBudget: '900',
  chapterBatchSize: '2',
  logline: longText(STORY_BLUEPRINT_LIMITS.maxLoglineLength + 1),
  themes: JSON.stringify(bodyForCreature('dragon').themes),
  heatContract: JSON.stringify(bodyForCreature('dragon').heatContract)
});
assert(
  overTheLimitQuery.error?.invalidFields.includes('logline'),
  'an over-long logline should be refused on the stream query path as well'
);

// A caller that assembles `narrativeDirectives` from parts asks
// `describeNarrativeDirectivesOverflow` before it spends a request. That answer
// is worth nothing unless it matches the one this parser gives, so both
// readings are taken here, at the boundary and on either side of it.
const directivesBody = (narrativeDirectives: string) =>
  parseStoryLabBlueprintFromBody({ ...bodyForCreature('dragon'), narrativeDirectives });

const directivesAtTheLimit = longText(STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength);
assert(
  describeNarrativeDirectivesOverflow(directivesAtTheLimit) === null,
  'directives exactly at the cap should be described as fitting'
);
assert(
  !directivesBody(directivesAtTheLimit).error,
  'directives exactly at the cap should be accepted by the parser'
);

const directivesOverTheLimit = longText(STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength + 1);
const overflowMessage = describeNarrativeDirectivesOverflow(directivesOverTheLimit);
assert(overflowMessage !== null, 'directives past the cap should be described as too long');
assert(
  overflowMessage.includes(String(STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength))
    && overflowMessage.includes(String(directivesOverTheLimit.length)),
  'the overflow message should name both the length and the cap'
);
assert(
  directivesBody(directivesOverTheLimit).error?.invalidFields.includes('narrativeDirectives'),
  'directives past the cap should be refused by the parser'
);

// The parser trims before it measures, so surrounding whitespace is not what
// makes a value too long. A client-side check that counted it would refuse a
// request this route would have taken.
const paddedToTheLimit = `\n  ${directivesAtTheLimit}  \n`;
assert(
  describeNarrativeDirectivesOverflow(paddedToTheLimit) === null,
  'whitespace around directives at the cap should not be described as overflow'
);
assert(
  !directivesBody(paddedToTheLimit).error,
  'whitespace around directives at the cap should not be refused by the parser'
);

// `logline` and `worldDetails` are read through the same trimming helpers and
// were not stated anywhere, which is how the Angular `FormValidationService`
// came to measure all three untrimmed: it refused a logline pasted with a
// trailing newline at exactly the cap the route accepts it under. The parser's
// reading is the one the form has to mirror, so it is written down here.
const paddedFreeText = parseStoryLabBlueprintFromBody({
  ...bodyForCreature('dragon'),
  logline: `\n  ${longText(STORY_BLUEPRINT_LIMITS.maxLoglineLength)}  \n`,
  worldDetails: `  ${longText(STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength)}\n`
});
assert(
  !paddedFreeText.error,
  'whitespace around a logline or world details at the cap should not be refused by the parser'
);
assert(
  paddedFreeText.blueprint.logline.length === STORY_BLUEPRINT_LIMITS.maxLoglineLength
    && paddedFreeText.blueprint.worldDetails?.length === STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength,
  'the parsed blueprint should carry the trimmed value it was measured as'
);

console.log('Story Lab shared blueprint parser tests passed');
