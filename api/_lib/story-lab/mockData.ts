// Created: 2025-10-29 08:27 UTC

import {
  ApiEnvelope,
  ChapterBatchSize,
  ChapterDelta,
  CharacterProfile,
  CreatureArchetype,
  GeneratedChapter,
  LoreArtifact,
  NarrativeTone,
  PlotThread,
  StoryContinuationSeam,
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryStateDelta,
  StoryStateSnapshot,
  StorySummary
} from './contracts';
import { randomUUID } from 'node:crypto';
import { getTransientStorySnapshot, persistStoryIteration } from './stateStore';

/**
 * The cast, court, and relics this engine invents for one of the ten
 * creature archetypes, when no real AI provider is configured.
 *
 * `buildGenesisResponse` used to read only `input.logline` and
 * `input.chapterBatchSize` off the blueprint — every other field
 * (`creature`, `themes`, `spicyLevel`, `tone`, `protagonistName`,
 * `antagonistName`, `worldDetails`) was accepted and silently discarded, so
 * every mock story was "Selene of the Velvet Court" against "Marcellus
 * Nightbloom" in a vampire-coded court regardless of what a reader (or a
 * local developer checking whether the werewolf picker does anything) chose.
 * One table keyed by `CreatureArchetype`, read the way `getCreatureContext`
 * in `imageService.ts` reads its own, is what makes the choice visible.
 */
interface CreatureFlavor {
  narrativeVoice: string;
  setting: string;
  protagonistName: string;
  protagonistDescriptor: string;
  belovedName: string;
  belovedDescriptor: string;
  rivalName: string;
  rivalDescriptor: string;
  emblemName: string;
  emblemSignificance: string;
  covenantName: string;
  covenantSignificance: string;
  threadLabel: string;
  threadDescription: string;
}

/**
 * One flavor per `CreatureArchetype`. The vampire entry is unchanged from
 * this module's original hardcoded cast — `tests/story-lab-state.test.ts`
 * asserts on `'Crimson Signet Ring'` and `'Broken Oath Scroll'` by name for a
 * `creature: 'vampire'` fixture, so its names stay exactly as they were.
 */
const CREATURE_FLAVORS: Record<CreatureArchetype, CreatureFlavor> = {
  vampire: {
    narrativeVoice: 'Velvet noir',
    setting: 'the velvet vampire court',
    protagonistName: 'Selene of the Velvet Court',
    protagonistDescriptor: 'cunning vampire envoy',
    belovedName: 'Rowan Vale',
    belovedDescriptor: 'mortal scholar',
    rivalName: 'Marcellus Nightbloom',
    rivalDescriptor: 'elegant rival emissary',
    emblemName: 'Crimson Signet Ring',
    emblemSignificance: 'Unlocks the sealed crypt beneath the court.',
    covenantName: 'Broken Oath Scroll',
    covenantSignificance: 'Records the pact that can bind or free both courts.',
    threadLabel: 'Forbidden diplomacy pact',
    threadDescription: 'A secret alliance between rival courts threatens to collapse.'
  },
  werewolf: {
    narrativeVoice: 'Moonlit growl',
    setting: 'the moon-bound werewolf pack',
    protagonistName: 'Briar Ashwood',
    protagonistDescriptor: 'fierce-eyed pack envoy',
    belovedName: 'Callum Reyes',
    belovedDescriptor: 'mortal tracker',
    rivalName: 'Ossian Thorne',
    rivalDescriptor: 'rival packmaster',
    emblemName: 'Silver Claw Torque',
    emblemSignificance: "Marks the wearer as the pack's chosen envoy.",
    covenantName: 'Torn Pack Treaty',
    covenantSignificance: 'Records the truce that can bind or shatter both packs.',
    threadLabel: 'Fragile pack truce',
    threadDescription: 'An uneasy truce between rival packs threatens to collapse.'
  },
  fairy: {
    narrativeVoice: 'Gossamer hush',
    setting: 'the sunlit fae court',
    protagonistName: 'Wren Larkspur',
    protagonistDescriptor: 'ethereal fae envoy',
    belovedName: 'Tamsin Hale',
    belovedDescriptor: 'mortal cartographer',
    rivalName: 'Idris Nightshade',
    rivalDescriptor: 'rival fae courtier',
    emblemName: 'Thorned Bloom Circlet',
    emblemSignificance: 'Grants safe passage through the fae wilds.',
    covenantName: 'Wilting Bargain Leaf',
    covenantSignificance: 'Records the bargain that can bind or free both courts.',
    threadLabel: 'Fraying wildwood bargain',
    threadDescription: 'A bargain between rival fae courts threatens to unravel.'
  },
  siren: {
    narrativeVoice: 'Tidal murmur',
    setting: 'the tide-locked siren court',
    protagonistName: 'Mira Duskwater',
    protagonistDescriptor: 'alluring siren envoy',
    belovedName: 'Soren Vane',
    belovedDescriptor: 'mortal sailor',
    rivalName: 'Thessaly Drake',
    rivalDescriptor: 'rival siren emissary',
    emblemName: 'Pearl Tide Torque',
    emblemSignificance: 'Calms the strait long enough for safe passage.',
    covenantName: 'Drowned Accord Ledger',
    covenantSignificance: 'Records the accord that can bind or drown both courts.',
    threadLabel: 'Drowning trade accord',
    threadDescription: 'An accord between rival siren courts threatens to sink.'
  },
  djinn: {
    narrativeVoice: 'Ember-smoke hush',
    setting: 'the smoke-veiled djinn court',
    protagonistName: 'Zara Emberholt',
    protagonistDescriptor: 'imperious djinn envoy',
    belovedName: 'Idris Marlow',
    belovedDescriptor: 'mortal scribe',
    rivalName: 'Kassim Duskbrand',
    rivalDescriptor: 'rival djinn emissary',
    emblemName: 'Ember-Bound Signet',
    emblemSignificance: 'Grants one binding wish honored by the court.',
    covenantName: 'Sand-Scrawled Pact',
    covenantSignificance: 'Records the pact that can bind or unravel both courts.',
    threadLabel: 'Unraveling wish-pact',
    threadDescription: 'A wish-bound pact between rival djinn courts threatens to unravel.'
  },
  witch: {
    narrativeVoice: 'Candle-smoke hush',
    setting: 'the coven-bound witch circle',
    protagonistName: 'Hazel Thorncroft',
    protagonistDescriptor: 'self-possessed witch envoy',
    belovedName: 'Edmund Grey',
    belovedDescriptor: 'mortal herbalist',
    rivalName: 'Isolde Ravenscar',
    rivalDescriptor: 'rival coven emissary',
    emblemName: 'Sigil-Bound Ring',
    emblemSignificance: 'Unlocks the sealed grimoire vault.',
    covenantName: 'Binding Grimoire Page',
    covenantSignificance: 'Records the binding that can protect or damn both covens.',
    threadLabel: 'Fraying coven binding',
    threadDescription: 'A binding between rival covens threatens to fray.'
  },
  dragon: {
    narrativeVoice: 'Hoard-warmed hush',
    setting: 'the hoard-warmed dragon court',
    protagonistName: 'Aurelia Scaleborn',
    protagonistDescriptor: 'immense dragon envoy',
    belovedName: 'Peregrine Vane',
    belovedDescriptor: 'mortal cartologist',
    rivalName: 'Ignatius Emberclaw',
    rivalDescriptor: 'rival dragon emissary',
    emblemName: 'Molten Hoard Signet',
    emblemSignificance: "Marks the wearer as the hoard's chosen envoy.",
    covenantName: 'Scaled Truce Ledger',
    covenantSignificance: 'Records the truce that can bind or scorch both courts.',
    threadLabel: 'Scorched hoard truce',
    threadDescription: 'A truce between rival dragon courts threatens to burn.'
  },
  demon: {
    narrativeVoice: 'Ash-lit hush',
    setting: 'the ash-lit demon court',
    protagonistName: 'Lilith Duskthorn',
    protagonistDescriptor: 'infernal demon envoy',
    belovedName: 'Gideon Ashe',
    belovedDescriptor: 'mortal exorcist',
    rivalName: 'Baltasar Grimhollow',
    rivalDescriptor: 'rival demon emissary',
    emblemName: 'Ember-Scarred Sigil',
    emblemSignificance: 'Unlocks the sealed ruin beneath the court.',
    covenantName: 'Blood-Sealed Contract',
    covenantSignificance: 'Records the contract that can bind or damn both courts.',
    threadLabel: 'Fraying blood contract',
    threadDescription: 'A contract between rival demon courts threatens to unravel.'
  },
  angel: {
    narrativeVoice: 'Marble-lit hush',
    setting: 'the cloud-crowned angel choir',
    protagonistName: 'Seraphina Vale',
    protagonistDescriptor: 'severe angel envoy',
    belovedName: 'Thaddeus Cole',
    belovedDescriptor: 'mortal cleric',
    rivalName: 'Uriel Ashworth',
    rivalDescriptor: 'rival choir emissary',
    emblemName: 'Halo-Bound Circlet',
    emblemSignificance: "Grants safe passage through the choir's wards.",
    covenantName: 'Sky-Sealed Covenant',
    covenantSignificance: 'Records the covenant that can bind or shatter both choirs.',
    threadLabel: 'Shattering choir covenant',
    threadDescription: 'A covenant between rival choirs threatens to shatter.'
  },
  mermaid: {
    narrativeVoice: 'Coral-lit hush',
    setting: 'the reef-lit mermaid court',
    protagonistName: 'Nerida Wavecrest',
    protagonistDescriptor: 'iridescent mermaid envoy',
    belovedName: 'Callan Reed',
    belovedDescriptor: 'mortal diver',
    rivalName: 'Tiamat Sharptide',
    rivalDescriptor: 'rival mermaid emissary',
    emblemName: 'Coral-Bound Torque',
    emblemSignificance: 'Grants safe passage through the reef court.',
    covenantName: 'Drowned Treaty Shell',
    covenantSignificance: 'Records the treaty that can bind or drown both courts.',
    threadLabel: 'Drowning reef treaty',
    threadDescription: 'A treaty between rival mermaid courts threatens to sink.'
  }
};

/** Read a flavor off the table, falling back to the original vampire cast for anything outside it. */
function resolveCreatureFlavor(creature: CreatureArchetype | undefined): CreatureFlavor {
  return (creature && CREATURE_FLAVORS[creature]) ?? CREATURE_FLAVORS.vampire;
}

/** The mood phrase a chapter's opening line reaches for, per `NarrativeTone`. */
const NARRATIVE_TONE_MOOD: Record<NarrativeTone, string> = {
  romance: 'tender vows and stolen glances',
  dark_romance: 'candlelit intrigue and whispered vows',
  mystery: 'half-answered questions',
  adventure: 'reckless dares',
  comedy: 'barbed wit and stolen glances',
  tragedy: 'grief worn like armor'
};

/** The chapter-title word a `NarrativeTone` reaches for. `dark_romance` keeps the original "Midnight Reverie". */
const NARRATIVE_TONE_CHAPTER_TITLE: Record<NarrativeTone, string> = {
  romance: 'Tender Reckoning',
  dark_romance: 'Midnight Reverie',
  mystery: 'Unanswered Hour',
  adventure: 'Reckless Hour',
  comedy: 'Giddy Hour',
  tragedy: 'Mourning Hour'
};

const DEFAULT_NARRATIVE_TONE: NarrativeTone = 'dark_romance';

function createSummary(storyId: string, logline: string, tone: NarrativeTone, spicyLevel: StorySummary['spicyLevel']): StorySummary {
  const now = new Date().toISOString();
  return {
    storyId,
    title: `The ${logline.split(' ')[0] || 'Crimson'} Chronicles`,
    synopsis: logline,
    tone,
    spicyLevel,
    createdAt: now,
    updatedAt: now
  };
}

interface MockCastOverrides {
  protagonistName?: string;
  antagonistName?: string;
}

function createProtagonist(storyId: string, flavor: CreatureFlavor, overrides: MockCastOverrides): CharacterProfile {
  const displayName = overrides.protagonistName?.trim() || flavor.protagonistName;
  return {
    id: `${storyId}-protagonist`,
    displayName,
    archetype: 'protagonist',
    summary: `A ${flavor.protagonistDescriptor} balancing desire and duty within ${flavor.setting}.`,
    currentGoal: `Protect the mortal they love without shattering the fragile peace of ${flavor.setting}.`,
    internalConflict: 'Craves belonging yet resents the court that owns them.',
    externalConflict: 'A political alliance demands their loyalty.',
    secrets: ['Carries a forbidden charm that binds their heart.'],
    relationships: [],
    spiceCompatibilities: [2, 3, 4]
  };
}

function createMortalBeloved(storyId: string, flavor: CreatureFlavor): CharacterProfile {
  return {
    id: `${storyId}-mortal-beloved`,
    displayName: flavor.belovedName,
    archetype: 'supporting',
    summary: `A ${flavor.belovedDescriptor} whose forbidden research draws ${flavor.setting} into conflict.`,
    currentGoal: `Decode the ${flavor.covenantName.toLowerCase()} before the rival court claims it.`,
    internalConflict: 'Wants the truth but fears becoming leverage against the one they love.',
    externalConflict: 'Hunted by envoys who need the covenant destroyed.',
    secrets: [`Recognizes the ${flavor.emblemName.toLowerCase()} from a childhood vision.`],
    relationships: [
      {
        characterId: `${storyId}-protagonist`,
        relationship: 'lover',
        notes: 'Drawn to the protagonist despite knowing the court may punish them both.'
      }
    ],
    spiceCompatibilities: [2, 3]
  };
}

function createRivalEmissary(storyId: string, flavor: CreatureFlavor, overrides: MockCastOverrides): CharacterProfile {
  const displayName = overrides.antagonistName?.trim() || flavor.rivalName;
  return {
    id: `${storyId}-rival-emissary`,
    displayName,
    archetype: 'antagonist',
    summary: `An elegant ${flavor.rivalDescriptor} who weaponizes etiquette and old debts.`,
    currentGoal: 'Force the protagonist to betray the mortal alliance.',
    internalConflict: 'Still honors a vow they pretend to have forgotten.',
    externalConflict: 'The court expects public victory before the next reckoning.',
    secrets: [`Knows who forged the broken ${flavor.covenantName.toLowerCase()}.`],
    relationships: [
      {
        characterId: `${storyId}-protagonist`,
        relationship: 'rival',
        notes: 'Their rivalry carries unresolved attraction and political danger.'
      }
    ],
    spiceCompatibilities: [3, 4]
  };
}

function createBaseThread(storyId: string, batchSize: ChapterBatchSize, flavor: CreatureFlavor): PlotThread {
  return {
    id: `${storyId}-thread-1`,
    label: flavor.threadLabel,
    status: batchSize > 1 ? 'escalating' : 'active',
    description: flavor.threadDescription,
    foreshadowedDevices: [flavor.emblemName, flavor.covenantName],
    lifetime: 'series'
  };
}

function createSignetArtifact(storyId: string, flavor: CreatureFlavor): LoreArtifact {
  return {
    id: `${storyId}-artifact-ring`,
    name: flavor.emblemName,
    significance: flavor.emblemSignificance,
    introducedInChapter: 1,
    lifetime: 'series'
  };
}

function createOathScroll(storyId: string, chapterNumber: number, flavor: CreatureFlavor): LoreArtifact {
  return {
    id: `${storyId}-artifact-oath-scroll`,
    name: flavor.covenantName,
    significance: flavor.covenantSignificance,
    introducedInChapter: chapterNumber,
    lifetime: 'chapter'
  };
}

function createBaseState(storyId: string, batchSize: ChapterBatchSize, flavor: CreatureFlavor, overrides: MockCastOverrides): StoryStateSnapshot {
  const now = new Date().toISOString();
  return {
    storyId,
    // A fresh story always starts at revision 1. This used to read a
    // module-level `storyRevisionCounter` that incremented forever across
    // the process's lifetime and never reset, so a story's starting
    // revision depended on how many other stories a warm process had
    // already generated rather than on anything about the story itself —
    // see the removed counter in this module's git history.
    revision: 1,
    characters: [createProtagonist(storyId, flavor, overrides)],
    threads: [createBaseThread(storyId, batchSize, flavor)],
    artifacts: [createSignetArtifact(storyId, flavor)],
    beats: [],
    continuityWarnings: [],
    narrativeVoice: flavor.narrativeVoice,
    lastUpdatedAt: now
  };
}

function createChapterDelta(
  storyId: string,
  chapterNumber: number,
  batchSize: ChapterBatchSize,
  flavor: CreatureFlavor,
  overrides: MockCastOverrides
): ChapterDelta {
  let introducedCharacters: CharacterProfile[] = [];
  if (chapterNumber === 1) {
    introducedCharacters = [createMortalBeloved(storyId, flavor)];
  } else if (chapterNumber === 2) {
    introducedCharacters = [createRivalEmissary(storyId, flavor, overrides)];
  }

  let foreshadowedArtifacts: LoreArtifact[] = [];
  if (chapterNumber === 1) {
    foreshadowedArtifacts = [createSignetArtifact(storyId, flavor)];
  } else if (chapterNumber === 2) {
    foreshadowedArtifacts = [createOathScroll(storyId, chapterNumber, flavor)];
  }

  const continuityFlags = batchSize === 3 && chapterNumber % 3 === 0
    ? [`Chapter ${chapterNumber} should pay off one planted court secret before adding another.`]
    : [];

  return {
    introducedCharacters,
    resolvedThreads: chapterNumber >= 6 ? [`${storyId}-thread-1`] : [],
    escalatedThreads: chapterNumber >= 2 ? [`${storyId}-thread-1`] : [],
    foreshadowedArtifacts,
    continuityFlags
  };
}

function createChapter(
  storyId: string,
  chapterNumber: number,
  batchSize: ChapterBatchSize,
  flavor: CreatureFlavor,
  overrides: MockCastOverrides,
  tone: NarrativeTone,
  openingSetting: string,
  openingDetail?: string
): GeneratedChapter {
  // Was `chapter-${chapterIdCounter++}`, a module-level counter with the same
  // never-reset problem as `storyRevisionCounter` in `createBaseState`.
  // `randomUUID` gives a unique id per chapter with no process-lifetime state.
  const id = `chapter-${randomUUID()}`;
  const cliffhanger = chapterNumber % Math.max(2, batchSize) === 0;
  const delta = createChapterDelta(storyId, chapterNumber, batchSize, flavor, overrides);
  const mood = NARRATIVE_TONE_MOOD[tone] ?? NARRATIVE_TONE_MOOD[DEFAULT_NARRATIVE_TONE];
  const title = NARRATIVE_TONE_CHAPTER_TITLE[tone] ?? NARRATIVE_TONE_CHAPTER_TITLE[DEFAULT_NARRATIVE_TONE];
  const openingSentence = `Chapter ${chapterNumber} unfurls in ${openingSetting}, tangled in ${mood}.`;
  const content = openingDetail ? `<p>${openingSentence} ${openingDetail}</p>` : `<p>${openingSentence}</p>`;

  return {
    chapterId: id,
    chapterNumber,
    title: `Chapter ${chapterNumber}: ${title}`,
    htmlContent: content,
    rawContent: content,
    summary: `Passion collides with political duty beneath ${openingSetting}.`,
    wordCount: 850,
    hasCliffhanger: cliffhanger,
    delta
  };
}

function mergeUniqueById<T extends { id: string }>(existing: T[], additions: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of additions) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function applyChapterDeltas(
  state: StoryStateSnapshot,
  chapters: GeneratedChapter[],
  revision: number = state.revision
): StoryStateSnapshot {
  const introducedCharacters = chapters.flatMap(chapter => chapter.delta.introducedCharacters);
  const foreshadowedArtifacts = chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts);
  const escalatedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.escalatedThreads));
  const resolvedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.resolvedThreads));
  const continuityWarnings = uniqueStrings([
    ...state.continuityWarnings,
    ...chapters.flatMap(chapter => chapter.delta.continuityFlags)
  ]);
  const now = new Date().toISOString();

  return {
    ...state,
    revision,
    characters: mergeUniqueById(state.characters, introducedCharacters),
    threads: state.threads.map(thread => {
      if (resolvedThreadIds.has(thread.id)) {
        return { ...thread, status: 'resolved' as const };
      }
      if (escalatedThreadIds.has(thread.id) && thread.status !== 'resolved') {
        return { ...thread, status: 'escalating' as const };
      }
      return thread;
    }),
    artifacts: mergeUniqueById(state.artifacts, foreshadowedArtifacts),
    beats: [
      ...state.beats,
      ...chapters.map(chapter => ({
        id: `${state.storyId}-beat-${chapter.chapterNumber}`,
        chapterNumber: chapter.chapterNumber,
        summary: chapter.summary,
        beatType: chapter.chapterNumber === 1 ? 'inciting_incident' as const : 'rising_action' as const,
        tensionLevel: Math.min(5, 2 + (chapter.chapterNumber % 4)) as 1 | 2 | 3 | 4 | 5,
        spicyLevel: 3 as const
      }))
    ],
    continuityWarnings,
    lastUpdatedAt: now
  };
}

function buildStateDelta(
  storyId: string,
  fromState: StoryStateSnapshot | null,
  toState: StoryStateSnapshot,
  chapters: GeneratedChapter[]
): StoryStateDelta {
  const introducedCharacters = mergeUniqueById([], chapters.flatMap(chapter => chapter.delta.introducedCharacters));
  const foreshadowedArtifacts = mergeUniqueById([], chapters.flatMap(chapter => chapter.delta.foreshadowedArtifacts));
  const escalatedThreadIds = new Set(chapters.flatMap(chapter => chapter.delta.escalatedThreads));
  const escalatedThreads = toState.threads.filter(thread => escalatedThreadIds.has(thread.id));
  const resolvedThreads = uniqueStrings(chapters.flatMap(chapter => chapter.delta.resolvedThreads));
  const continuityWarnings = uniqueStrings(chapters.flatMap(chapter => chapter.delta.continuityFlags));
  const beatIds = chapters.map(chapter => `${storyId}-beat-${chapter.chapterNumber}`);

  const updatedCharacters = fromState
    ? toState.characters.filter(character => {
        const previous = fromState.characters.find(existing => existing.id === character.id);
        return previous ? JSON.stringify(previous) !== JSON.stringify(character) : false;
      })
    : [];

  return {
    storyId,
    fromRevision: fromState?.revision ?? null,
    toRevision: toState.revision,
    addedChapterNumbers: chapters.map(chapter => chapter.chapterNumber),
    introducedCharacters,
    updatedCharacters,
    resolvedThreads,
    escalatedThreads,
    foreshadowedArtifacts,
    continuityWarnings,
    beatIds,
    summary: `Added chapters ${chapters.map(chapter => chapter.chapterNumber).join(', ')} and updated continuity state.`
  };
}

export function buildGenesisResponse(
  input: StoryGenerationSeam['input']
): ApiEnvelope<StoryIterationPayload> {
  const storyId = `story-${randomUUID()}`;
  const flavor = resolveCreatureFlavor(input.creature);
  const overrides: MockCastOverrides = {
    protagonistName: input.protagonistName,
    antagonistName: input.antagonistName
  };
  const chapters: GeneratedChapter[] = [];
  for (let i = 0; i < input.chapterBatchSize; i++) {
    const chapterNumber = i + 1;
    const openingDetail = chapterNumber === 1 && input.worldDetails?.trim()
      ? input.worldDetails.trim()
      : undefined;
    chapters.push(createChapter(storyId, chapterNumber, input.chapterBatchSize, flavor, overrides, input.tone, flavor.setting, openingDetail));
  }
  const baseState = createBaseState(storyId, input.chapterBatchSize, flavor, overrides);
  const state = applyChapterDeltas(baseState, chapters);
  const summary = createSummary(storyId, input.logline, input.tone, input.spicyLevel);
  const payload: StoryIterationPayload = {
    summary,
    batch: {
      chapters,
      totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      suggestedNextPrompts: [
        `Explore the ${flavor.rivalName.split(' ')[0]}'s reaction.`,
        `Deepen ${flavor.belovedName.split(' ')[0]}'s backstory.`
      ]
    },
    state,
    stateDelta: buildStateDelta(storyId, null, state, chapters),
    telemetry: {
      engine: 'custom',
      totalLatencyMs: 2200,
      averageChapterLatencyMs: Math.round(2200 / input.chapterBatchSize),
      tokensConsumed: 1600,
      retryCount: 0
    }
  };
  payload.persistence = persistStoryIteration(payload);

  return {
    success: true,
    data: payload
  };
}

export function buildContinuationResponse(
  input: StoryContinuationSeam['input']
): ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }> {
  const transientSnapshot = getTransientStorySnapshot(input.storyId);
  const previousChapters = input.previouslyGeneratedChapters.length
    ? input.previouslyGeneratedChapters
    : transientSnapshot?.chapters ?? [];
  const lastChapter = previousChapters[previousChapters.length - 1];
  const startingNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
  // A continuation's input carries the story's ongoing `StoryStateSnapshot`
  // and `StorySummary`, not the original `StoryBlueprint` — there is no
  // `creature` here to look up a flavor by. Chapter/artifact/character
  // *names* for an early chapter that lands inside a continuation (a
  // genesis with `chapterBatchSize: 1` makes chapter 2 a continuation
  // chapter) fall back to the vampire cast, exactly as this module always
  // named them; what a continuation *can* honor is the tone and voice the
  // story already established.
  const tone = input.existingSummary?.tone ?? DEFAULT_NARRATIVE_TONE;
  const flavor = CREATURE_FLAVORS.vampire;
  const overrides: MockCastOverrides = {};
  const openingSetting = input.storyState.narrativeVoice.trim() || flavor.setting;
  const chapters: GeneratedChapter[] = [];
  for (let i = 0; i < input.chapterBatchSize; i++) {
    chapters.push(createChapter(input.storyId, startingNumber + i, input.chapterBatchSize, flavor, overrides, tone, openingSetting));
  }

  const preservedSummary = input.existingSummary
    ? { ...input.existingSummary, updatedAt: new Date().toISOString() }
    : createSummary(input.storyId, input.storyState.narrativeVoice, DEFAULT_NARRATIVE_TONE, 3);
  const nextState = applyChapterDeltas(input.storyState, chapters, input.storyState.revision + 1);
  const payload: StoryIterationPayload & { appendedChapterNumbers: number[] } = {
    summary: preservedSummary,
    batch: {
      chapters,
      totalWordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      suggestedNextPrompts: ['Resolve the ancient oath.', 'Reveal a betrayal from within the court.']
    },
    state: nextState,
    stateDelta: buildStateDelta(input.storyId, input.storyState, nextState, chapters),
    telemetry: {
      engine: 'custom',
      totalLatencyMs: 2400,
      averageChapterLatencyMs: Math.round(2400 / input.chapterBatchSize),
      tokensConsumed: 1750,
      retryCount: 1
    },
    appendedChapterNumbers: chapters.map(chapter => chapter.chapterNumber)
  };
  payload.persistence = persistStoryIteration(payload, previousChapters);

  return {
    success: true,
    data: payload
  };
}
