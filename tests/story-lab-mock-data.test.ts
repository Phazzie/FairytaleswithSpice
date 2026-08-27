import { buildContinuationResponse, buildGenesisResponse } from '../api/_lib/story-lab/mockData';
import type { StoryGenerationSeam } from '../api/_lib/story-lab/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function baseBlueprint(overrides: Partial<StoryGenerationSeam['input']> = {}): StoryGenerationSeam['input'] {
  return {
    creature: 'vampire',
    themes: [
      {
        id: 'forbidden-love',
        label: 'Forbidden Love',
        description: 'A romance that risks court punishment.'
      }
    ],
    logline: 'Velvet envoys bargain with a dangerous mortal scholar.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'closed_door'
    },
    chapterBatchSize: 2,
    ...overrides
  };
}

// --- Creature-driven variation ------------------------------------------------
// buildGenesisResponse used to read only `logline`/`chapterBatchSize` off the
// blueprint, so a werewolf request produced the exact same vampire-court cast
// as a vampire request. This is the regression that fix guards against.
const vampireGenesis = buildGenesisResponse(baseBlueprint({ creature: 'vampire' }));
const werewolfGenesis = buildGenesisResponse(baseBlueprint({ creature: 'werewolf' }));

assert(vampireGenesis.success && werewolfGenesis.success, 'both genesis calls should succeed');

const vampireProtagonist = vampireGenesis.data.state.characters.find(c => c.archetype === 'protagonist');
const werewolfProtagonist = werewolfGenesis.data.state.characters.find(c => c.archetype === 'protagonist');
assert(vampireProtagonist?.displayName === 'Selene of the Velvet Court', 'vampire flavor should keep its original protagonist name');
assert(werewolfProtagonist?.displayName === 'Briar Ashwood', 'werewolf flavor should use its own protagonist name');
assert(vampireProtagonist?.displayName !== werewolfProtagonist?.displayName, 'creature should change who the protagonist is');

assert(
  vampireGenesis.data.state.artifacts.some(a => a.name === 'Crimson Signet Ring'),
  'vampire flavor should keep its original emblem name'
);
assert(
  werewolfGenesis.data.state.artifacts.some(a => a.name === 'Silver Claw Torque'),
  'werewolf flavor should use its own emblem name'
);

assert(vampireGenesis.data.state.narrativeVoice === 'Velvet noir', 'vampire narrative voice should be unchanged');
assert(werewolfGenesis.data.state.narrativeVoice === 'Moonlit growl', 'werewolf narrative voice should reflect the creature');

// A chapter's own text should mention the creature's setting, not a hardcoded one.
const werewolfChapterText = werewolfGenesis.data.batch.chapters[0]?.htmlContent ?? '';
assert(werewolfChapterText.includes('werewolf pack'), 'chapter text should reflect the chosen creature\'s setting');

// --- Name overrides ------------------------------------------------------------
const overriddenGenesis = buildGenesisResponse(baseBlueprint({
  creature: 'dragon',
  protagonistName: 'Kestrel Dawnfire',
  antagonistName: 'Vex Coldmourn'
}));
assert(overriddenGenesis.success, 'overridden genesis should succeed');
const overriddenProtagonist = overriddenGenesis.data.state.characters.find(c => c.archetype === 'protagonist');
assert(overriddenProtagonist?.displayName === 'Kestrel Dawnfire', 'protagonistName override should win over the flavor default');
// The rival is only introduced in chapter 2's delta.
const overriddenRival = overriddenGenesis.data.batch.chapters
  .flatMap(chapter => chapter.delta.introducedCharacters)
  .find(character => character.archetype === 'antagonist');
assert(overriddenRival?.displayName === 'Vex Coldmourn', 'antagonistName override should win over the flavor default');
// Fields with no override field on the blueprint (the mortal beloved, the thread label) still come from the flavor.
assert(
  overriddenGenesis.data.state.threads[0]?.label === 'Scorched hoard truce',
  'thread label with no override field should still come from the creature flavor'
);

// --- Tone and spice level flow through, instead of being hardcoded -------------
const romanceGenesis = buildGenesisResponse(baseBlueprint({ tone: 'romance', spicyLevel: 1, creature: 'fairy' }));
assert(romanceGenesis.success, 'romance genesis should succeed');
assert(romanceGenesis.data.summary.tone === 'romance', 'summary tone should reflect the requested tone, not a hardcoded default');
assert(romanceGenesis.data.summary.spicyLevel === 1, 'summary spicyLevel should reflect the requested level, not a hardcoded default');
assert(
  romanceGenesis.data.batch.chapters[0]?.title.includes('Tender Reckoning'),
  'a romance-toned chapter should not be titled with the dark_romance default'
);

const tragedyGenesis = buildGenesisResponse(baseBlueprint({ tone: 'tragedy', creature: 'fairy' }));
assert(tragedyGenesis.success, 'tragedy genesis should succeed');
assert(
  tragedyGenesis.data.batch.chapters[0]?.title !== romanceGenesis.data.batch.chapters[0]?.title,
  'different tones should produce different chapter titles'
);

// --- worldDetails is no longer silently dropped ---------------------------------
const worldDetailGenesis = buildGenesisResponse(baseBlueprint({
  creature: 'siren',
  worldDetails: 'The strait has not been calm in three generations.'
}));
assert(worldDetailGenesis.success, 'genesis with worldDetails should succeed');
assert(
  worldDetailGenesis.data.batch.chapters[0]?.htmlContent.includes('The strait has not been calm in three generations.'),
  'worldDetails should appear in the opening chapter instead of being discarded'
);

// --- Revision is deterministic, not derived from a never-reset global counter ---
// Building several genesis stories back-to-back in the same process used to
// push each new story's starting revision further from 1, because
// `storyRevisionCounter` was a module-level `let` that only ever incremented.
for (let i = 0; i < 5; i++) {
  const repeated = buildGenesisResponse(baseBlueprint({ creature: 'demon' }));
  assert(repeated.success, 'repeated genesis calls should succeed');
  assert(repeated.data.state.revision === 1, `genesis story #${i} should start at revision 1 regardless of process history`);
}

// --- Chapter ids are unique and carry no shared global counter ------------------
const idBearingGenesis = buildGenesisResponse(baseBlueprint({ creature: 'angel', chapterBatchSize: 2 }));
assert(idBearingGenesis.success, 'genesis for id uniqueness check should succeed');
const [firstChapter, secondChapter] = idBearingGenesis.data.batch.chapters;
assert(firstChapter.chapterId !== secondChapter.chapterId, 'chapters within one batch should get distinct ids');
assert(/^chapter-/.test(firstChapter.chapterId), 'chapter ids should keep their existing "chapter-" prefix');

// --- Continuation carries the established tone and voice forward ---------------
const genesisForContinuation = buildGenesisResponse(baseBlueprint({ creature: 'mermaid', tone: 'mystery' }));
assert(genesisForContinuation.success, 'genesis for continuation setup should succeed');

const continuation = buildContinuationResponse({
  storyId: genesisForContinuation.data.summary.storyId,
  chapterBatchSize: 1,
  storyState: genesisForContinuation.data.state,
  previouslyGeneratedChapters: genesisForContinuation.data.batch.chapters,
  continuationBrief: 'Reveal what the tide dragged in.',
  existingSummary: genesisForContinuation.data.summary
});
assert(continuation.success, 'continuation should succeed');
assert(
  continuation.data.batch.chapters[0]?.htmlContent.includes('Coral-lit hush'),
  'continuation chapter text should reuse the narrative voice the genesis established'
);
assert(
  continuation.data.batch.chapters[0]?.title.includes('Unanswered Hour'),
  'continuation should honor the tone carried on existingSummary rather than always defaulting to dark_romance'
);

console.log('Story Lab mock data tests passed');
