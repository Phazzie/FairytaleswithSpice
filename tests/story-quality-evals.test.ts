#!/usr/bin/env tsx
// Created: 2026-05-28 21:25 UTC

import {
  buildStoryLabPayloadFromGeneratedStory,
  continueStoryLab,
  previewStoryLabContinuationGuidance,
  toClassicGenerationInput
} from '../api/_lib/story-lab/storyLabEngine';
import { extractContinuity } from '../api/_lib/story-lab/continuityExtractor';
import { buildStoryQualityHeuristicReport } from '../api/_lib/story-lab/evaluation/storyQualityHeuristics';
import type {
  StoryGenerationSeam as LabGenerationSeam,
  StoryStateSnapshot
} from '../api/_lib/story-lab/contracts';
import type {
  ChapterContinuationSeam as ClassicContinuationSeam,
  StoryGenerationSeam as ClassicGenerationSeam
} from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function withEnv<T>(updates: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(updates)) {
    previous.set(key, process.env[key]);
    const value = updates[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

const blueprint: LabGenerationSeam['input'] = {
  creature: 'siren',
  themes: [
    {
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'A vow that makes desire politically dangerous.'
    },
    {
      id: 'blood_oaths',
      label: 'Blood Oaths',
      description: 'Promises that demand a physical price.'
    }
  ],
  logline: 'A siren diplomat must betray a moonlit reef court to save her forbidden lover.',
  spicyLevel: 3,
  tone: 'dark_romance',
  desiredWordBudget: 900,
  chapterBatchSize: 2,
  protagonistName: 'Mira',
  antagonistName: 'Lord Brine',
  worldDetails: 'A reef court where witness shells record every vow.',
  narrativeDirectives: 'Keep the romance dangerous and give each chapter a sharp unanswered question.'
};

const classicStory: ClassicGenerationSeam['output'] = {
  storyId: 'story-quality',
  title: 'Witness Shells',
  content: '<p>Mira pressed her palm to the witness shell while Lord Brine listened.</p>',
  rawContent: 'Mira pressed her palm to the witness shell while Lord Brine listened.',
  creature: 'siren',
  themes: ['forbidden_love', 'blood_oaths'],
  spicyLevel: 3,
  actualWordCount: 24,
  estimatedReadTime: 1,
  hasCliffhanger: true,
  generatedAt: new Date('2026-05-28T20:00:00.000Z'),
  tropeMetadata: 'trope-state: forbidden vow inverted by public testimony',
  chapters: [
    {
      chapterId: 'chapter-1',
      chapterNumber: 1,
      title: 'The Witness Shell',
      content: '<p>Mira pressed her palm to the witness shell while Lord Brine listened.</p>',
      rawContent: 'Mira pressed her palm to the witness shell while Lord Brine listened.',
      wordCount: 12,
      generatedAt: new Date('2026-05-28T20:00:00.000Z'),
      hasAudio: false,
      cliffhangerEnding: true,
      nextChapterHint: 'Reveal which oath the shell recorded.'
    }
  ],
  totalWordCount: 12,
  appendedToStory: '<p>Mira pressed her palm to the witness shell while Lord Brine listened.</p>',
  nextChapterHint: 'Reveal which oath the shell recorded.'
};

// The evaluation route is called with the story exactly as the generator
// renders it: `<p>` elements on one line, `[Speaker]:` tags inside those
// elements, no blank lines anywhere. Scored against the raw markup, the whole
// story counted as a single paragraph and no line ever started with a speaker
// tag, so the paragraph-shaped and dialogue-shaped dimensions all reported the
// opposite of what the story contains.
function testHtmlStoriesAreScoredOnTheirProse(): void {
  const htmlStory = '<section><h3>The Witness Shell</h3>'
    + '<p>[Narrator]: Salt stung her wrist as the witness shell glowed under the reef arch.</p>'
    + '<p>[Mira]: &quot;If the shell repeats my vow, Lord Brine owns the court by sunrise.&quot;</p>'
    + '<p>[Lord Brine]: &quot;Then choose which secret survives the tide.&quot;</p>'
    + '<p>Mira touched the blood oath hidden under her sleeve. Whose name would the shell give up?</p>'
    + '</section>';

  const report = buildStoryQualityHeuristicReport({
    storyContent: htmlStory,
    configuration: {
      creature: 'siren',
      themes: ['blood_oaths'],
      spicyLevel: 3,
      wordCount: 900
    }
  });

  const dimension = (id: string) => {
    const found = report.dimensions.find(entry => entry.id === id);
    assert(found, `report should include the ${id} dimension`);
    return found;
  };

  const proseQuality = dimension('prose_quality');
  assert(
    proseQuality.signals.some(signal => /^Paragraphs: [2-9]/.test(signal)),
    `an HTML story should be counted as several paragraphs (signals=${JSON.stringify(proseQuality.signals)})`
  );
  assert(
    !proseQuality.signals.includes('Words: 1'),
    'markup should not be counted as a single word'
  );

  const audioReadiness = dimension('audio_readiness');
  assert(
    audioReadiness.signals.some(signal => signal.startsWith('Speaker variety: Narrator, Mira, Lord Brine')),
    `speaker tags inside <p> elements should still be read as dialogue (signals=${JSON.stringify(audioReadiness.signals)})`
  );
  assert(
    audioReadiness.signals.includes('No overlong paragraphs detected.'),
    'a story of short paragraphs should not be penalised as one overlong block'
  );

  // The cliffhanger dimension is documented as reading the ending. Its hook
  // words appear only in the last paragraph here, and the ending's question
  // mark is the last character of the prose — not of the markup.
  const cliffhanger = dimension('cliffhanger_quality');
  assert(
    cliffhanger.signals.includes('Ending closes on a question or exclamation.'),
    `the ending should be read past its closing tags (signals=${JSON.stringify(cliffhanger.signals)})`
  );
}

/**
 * The one thing in the audio-readiness dimension that can cost points has to
 * say so.
 *
 * An overlong paragraph swings the score by thirty — the difference between the
 * `+12` a clean story gets and the `-18` a penalised one takes — and the
 * dimension printed nothing about it. The rationale claimed to check paragraph
 * length while every signal beside it was about dialogue, so the reader was
 * handed a number with no way to explain it and nothing to act on.
 */
function testOverlongParagraphsAreReportedNotJustPenalised(): void {
  const longParagraph = Array.from({ length: 120 }, (_, index) => `word${index}`).join(' ');
  const configuration = {
    creature: 'siren',
    themes: ['blood_oaths'],
    spicyLevel: 3,
    wordCount: 900
  };

  const audioReadiness = (storyContent: string) => {
    const report = buildStoryQualityHeuristicReport({ storyContent, configuration });
    const found = report.dimensions.find(entry => entry.id === 'audio_readiness');
    assert(found, 'report should include the audio_readiness dimension');
    return found;
  };

  const penalised = audioReadiness(`<p>${longParagraph}</p><p>She ran.</p>`);
  const clean = audioReadiness('<p>She opened the door.</p><p>She ran.</p>');

  assert(
    penalised.score < clean.score,
    `an overlong paragraph should cost the dimension points (penalised=${penalised.score}, clean=${clean.score})`
  );
  assert(
    penalised.signals.some(signal => signal.startsWith('Overlong paragraphs (over 90 words): 1, longest 120 words')),
    `the penalty should name what caused it (signals=${JSON.stringify(penalised.signals)})`
  );
  assert(
    !penalised.signals.includes('No overlong paragraphs detected.'),
    'a penalised story should not also claim it has no overlong paragraphs'
  );
  assert(
    clean.signals.includes('No overlong paragraphs detected.'),
    `a clean story should still report the check passing (signals=${JSON.stringify(clean.signals)})`
  );
}

/**
 * The two identity-shaped dimensions have to be able to say "no".
 *
 * Both used to answer yes to everything. `\b[A-Z][a-z]+\b` matches the first
 * word of every sentence, so this story of four sentences and no cast reported
 * four named characters and collected the whole named-character bonus, which
 * caps at two. And `extractConcreteAnchors` dropped tokens shorter than three
 * characters before pairing them, so the determiners its own weak-first-token
 * list exists to reject — `a`, `an`, `my` — were gone before the guard ran, and
 * the deleted token welded its two neighbours into a phrase the prose never
 * contained: "She opened a door" was scored as the concrete anchor
 * `opened door`.
 */
function testAnonymousProseScoresAsAnonymous(): void {
  const report = buildStoryQualityHeuristicReport({
    storyContent: [
      'She opened a door and stepped through the cold hall.',
      'Rain fell hard. Blood pooled where the light could not reach.',
      'He carried my key past the arch and said nothing about the vow.'
    ].join('\n\n'),
    configuration: {
      creature: 'vampire',
      themes: [],
      spicyLevel: 3,
      wordCount: 900
    }
  });

  const characterConsistency = report.dimensions.find(dimension => dimension.id === 'character_consistency');
  assert(characterConsistency, 'report should include the character consistency dimension');
  assert(
    !characterConsistency.signals.some(signal => signal.startsWith('Named character count:')),
    `sentence-initial words are not a cast (signals=${JSON.stringify(characterConsistency.signals)})`
  );

  const proseQuality = report.dimensions.find(dimension => dimension.id === 'prose_quality');
  assert(proseQuality, 'report should include the prose quality dimension');
  const anchorSignal = proseQuality.signals.find(signal => signal.startsWith('Specific anchors:'));
  assert(
    !anchorSignal,
    `"a door", "my key", and "the arch" are generic references, not concrete anchors (got ${anchorSignal})`
  );
}

/**
 * The other direction: a story that does name its cast and does anchor its
 * objects still gets credit for both, so the guards above cannot be satisfied
 * by scoring nothing at all.
 */
function testNamedProseStillScores(): void {
  const report = buildStoryQualityHeuristicReport({
    storyContent: [
      '[Narrator]: Salt stung her wrist while Mira watched the witness shell.',
      'The price was named when Lord Brine pressed the blood oath into her palm.'
    ].join('\n\n'),
    configuration: {
      creature: 'siren',
      themes: [],
      spicyLevel: 3,
      wordCount: 900
    }
  });

  const characterConsistency = report.dimensions.find(dimension => dimension.id === 'character_consistency');
  assert(
    characterConsistency?.signals.includes('Named character count: 2'),
    `Mira and Lord Brine are a cast (signals=${JSON.stringify(characterConsistency?.signals)})`
  );

  const proseQuality = report.dimensions.find(dimension => dimension.id === 'prose_quality');
  assert(
    proseQuality?.signals.some(signal => signal.includes('Specific anchors: witness shell, blood oath')),
    `named objects are still concrete anchors (signals=${JSON.stringify(proseQuality?.signals)})`
  );
}

/**
 * A `[Speaker]:` tag names a character outright, so the cast count must include
 * the speakers the same scan already reports.
 *
 * The tag starts the line it is on, which is the one position the boundary rule
 * throws a capital away — so a scene whose signals read `Speaker: Elena` next
 * to `Named character count: 1` was reporting a cast of one for a cast of
 * three, and no action Elena took anywhere in the chapter could be credited to
 * her. `Narrator` stays out of the count for the reason it always has: it names
 * the telling, not a member of the cast.
 */
function testDialogueSpeakersCountAsCast(): void {
  const scan = (storyContent: string) => buildStoryQualityHeuristicReport({
    storyContent,
    configuration: { creature: 'siren', themes: [], spicyLevel: 3, wordCount: 900 }
  })
    .dimensions
    .find(dimension => dimension.id === 'character_consistency');

  const spoken = scan('<p>[Elena]: "Run."</p><p>Then Kael chose the door.</p>');
  assert(
    spoken?.signals.includes('Speaker: Elena'),
    `the speaker tag should still be reported (signals=${JSON.stringify(spoken?.signals)})`
  );
  assert(
    spoken?.signals.includes('Named character count: 2'),
    `a speaker is a named character (signals=${JSON.stringify(spoken?.signals)})`
  );

  const narrated = scan('<p>[Narrator]: The tide turned at last.</p><p>Then Mira pressed the blood oath.</p>');
  assert(
    narrated?.signals.includes('Named character count: 1'),
    `Narrator names the telling, not the cast (signals=${JSON.stringify(narrated?.signals)})`
  );
}

/**
 * Both boundary rules have to reject only what they are aimed at.
 *
 * The Codex review on PR #213 caught each one overreaching. A sentence opener
 * used to swallow the name behind it: `\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b`
 * matches "Then Mira" as one pair, rejecting the pair for starting the
 * sentence dropped "Mira" with it, and a global matcher resumes past the whole
 * match — so "Then Mira pressed the blood oath" produced no character signals
 * at all. And keeping every token for pairing made short prepositions eligible
 * as the first half of an anchor, so "In court, she waited" scored `in court`
 * as concrete specificity that the old tokenization never awarded.
 */
function testBoundaryRulesRejectOnlyTheBoundary(): void {
  const scan = (storyContent: string) => buildStoryQualityHeuristicReport({
    storyContent,
    configuration: { creature: 'siren', themes: [], spicyLevel: 3, wordCount: 900 }
  });

  const opener = scan('The tide turned at last. Then Mira pressed the blood oath.');
  const openerCharacters = opener.dimensions.find(dimension => dimension.id === 'character_consistency');
  assert(
    openerCharacters?.signals.includes('Named character count: 1'),
    `a sentence opener should disqualify itself, not the name after it (signals=${JSON.stringify(openerCharacters?.signals)})`
  );
  assert(
    openerCharacters?.signals.some(signal => signal.startsWith('Agency actions:')),
    'a name recovered from behind a sentence opener should still carry its agency actions'
  );

  // A semicolon or a dash does not end a sentence, so English does not
  // capitalize after one — a capital that follows is explained by nothing but
  // the word, and treating the mark as a boundary threw the name away.
  for (const mark of [';', ' —', ',']) {
    const joined = scan(`The lock broke${mark} Mira pressed the blood oath.`);
    const joinedCharacters = joined.dimensions.find(dimension => dimension.id === 'character_consistency');
    assert(
      joinedCharacters?.signals.includes('Named character count: 1'),
      `"${mark.trim() || 'comma'}" does not end a sentence (signals=${JSON.stringify(joinedCharacters?.signals)})`
    );
  }

  const prepositions = scan('In court, she waited. By car, they crossed the city.');
  const prepositionAnchors = prepositions.dimensions
    .find(dimension => dimension.id === 'prose_quality')
    ?.signals.find(signal => signal.startsWith('Specific anchors:'));
  assert(
    !prepositionAnchors,
    `a preposition is not a modifier that makes a noun specific (got ${prepositionAnchors})`
  );
}

/**
 * A cast is not always spelled in ASCII.
 *
 * `\b[A-Z][a-z]+\b` saw no name at all in a Cyrillic sentence and cut `José`
 * down to `Jos` — the accented letter is not `[a-z]`, so the run ended at it and
 * the scan named a character the story does not have. Both results travel: the
 * agency scan reads this list, so no action either character took anywhere in
 * the chapter could be credited to them, and `Named character count` counted a
 * cast it could not see.
 *
 * `\b` cannot be the boundary once the pattern reaches past ASCII, because it is
 * defined against `[A-Za-z0-9_]` — there is no word boundary between a space and
 * `М`, so an anchored `\bМира\b` matches nothing anywhere. The same is true of
 * the name pattern the agency scan builds for each character.
 */
function testNonAsciiNamesAreReadAsNames(): void {
  const scan = (storyContent: string) => buildStoryQualityHeuristicReport({
    storyContent,
    configuration: { creature: 'siren', themes: [], spicyLevel: 3, wordCount: 900 }
  })
    .dimensions
    .find(dimension => dimension.id === 'character_consistency');

  const cyrillic = scan('<p>The lock broke; Мира pressed the blood oath.</p>');
  assert(
    cyrillic?.signals.includes('Named character count: 1'),
    `a Cyrillic name is a name (signals=${JSON.stringify(cyrillic?.signals)})`
  );
  assert(
    cyrillic?.signals.some(signal => signal === 'Agency actions: pressed'),
    `a Cyrillic name should carry its agency actions too (signals=${JSON.stringify(cyrillic?.signals)})`
  );

  // Precomposed and decomposed spellings of the same name, so the accent is
  // read as part of the word either way rather than ending the run at it.
  for (const jose of ['José', 'José']) {
    const accented = scan(`<p>The lock broke; ${jose} pressed the blood oath.</p>`);
    assert(
      accented?.signals.some(signal => signal === 'Agency actions: pressed'),
      `${JSON.stringify(jose)} should be matched whole, not truncated at its accent (signals=${JSON.stringify(accented?.signals)})`
    );
  }
}

/**
 * A word the scan cannot read is still a word between two others.
 *
 * `extractConcreteAnchors` pairs each token with the one after it, so the
 * normalizer feeding it must not delete a word — that is what welds two words
 * the prose never put together, which is the failure `a door` → `opened door`
 * was already fixed for once. Replacing every non-ASCII letter with a space did
 * exactly that deletion, so `she opened Мирина door` produced the anchor
 * `opened door`: a generic reference scored as a concrete one, from a phrase
 * that is not in the story.
 */
function testNonAsciiWordsDoNotWeldTheirNeighbours(): void {
  const anchors = buildStoryQualityHeuristicReport({
    storyContent: '<p>She opened Мирина door.</p>',
    configuration: { creature: 'siren', themes: [], spicyLevel: 3, wordCount: 900 }
  })
    .dimensions
    .find(dimension => dimension.id === 'prose_quality')
    ?.signals.find(signal => signal.startsWith('Specific anchors:'));

  assert(
    !anchors?.includes('opened door'),
    `the deleted word used to weld its neighbours into an anchor the prose never held (got ${anchors})`
  );
}

/**
 * The continuity courtroom has to be able to match a brief against a story that
 * is not written in Latin script.
 *
 * Both sides of the activation comparison go through `normalizeActivationText`,
 * so what it deletes is invisible to the score. `[^a-z0-9 ]+` deleted every
 * letter outside ASCII, which normalized a Cyrillic thread label to the empty
 * string: it was filtered out as a candidate and scored zero however plainly the
 * brief named it, so the courtroom chose what to put in front of the model by
 * story order alone and reported "Included by unresolved-story priority" for
 * everything it picked.
 */
function testActivationMatchingReadsNonLatinThreads(): void {
  const filler = ['Weather Tax', 'Kitchen Claim', 'Silent Harbor'].map((label, index) => ({
    id: `thread-filler-${index}`,
    label,
    status: 'active' as const,
    description: `The court still owes an answer about the ${label.toLowerCase()}.`,
    foreshadowedDevices: []
  }));
  const preview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Верни клятва Миры в следующую сцену.',
    storyState: {
      storyId: 'story-activation',
      revision: 1,
      lastUpdatedAt: new Date().toISOString(),
      narrativeVoice: 'Close third, present tense.',
      characters: [],
      artifacts: [],
      continuityWarnings: [],
      threads: [
        ...filler,
        {
          id: 'thread-oath',
          label: 'Клятва Миры',
          status: 'active',
          description: 'Старая клятва идёт за Мирой.',
          foreshadowedDevices: []
        }
      ]
    } as StoryStateSnapshot
  });

  assert(
    preview.contextSourceMap.some(item =>
      item.kind === 'thread'
      && item.label === 'Клятва Миры'
      && item.reason.includes('Matched words from the continuation brief')),
    `a brief-matched Cyrillic thread should outrank the fillers (map=${JSON.stringify(preview.contextSourceMap)})`
  );
}

/**
 * The emotional-variety dimension has to be able to say "no".
 *
 * It matched its emotion words as substrings, and every one of the five
 * registers has a common word of this genre sitting on top of it: `anger` is
 * inside `danger` and `stranger`, `rage` inside `courage`, `ache` inside
 * `reached`, `loss` inside `gloss`, and — worst — `hope` inside `hopeless`,
 * `fear` inside `fearless`, and `trust` inside `distrust`, so three registers
 * were credited by the negations that deny them.
 *
 * The prose below is built entirely from those decoys and contains no emotional
 * statement at all; it used to score four of the five registers. Five at twelve
 * points on a base of 48 clamps to 100, so the leak did not just inflate the
 * number, it pinned the dimension near its ceiling for ordinary prose and took
 * the `overallScore` it is one seventh of with it.
 */
function testEmotionalVarietyReadsWordsNotSubstrings(): void {
  const configuration = {
    creature: 'vampire',
    themes: [],
    spicyLevel: 3,
    wordCount: 900
  };

  const emotionalVariety = (storyContent: string) => {
    const report = buildStoryQualityHeuristicReport({ storyContent, configuration });
    const found = report.dimensions.find(entry => entry.id === 'emotional_variety');
    assert(found, 'report should include the emotional_variety dimension');
    return found;
  };

  const decoys = emotionalVariety(
    '<p>She reached for the door. A dangerous stranger waited in the hall, hopeless '
      + 'and fearless at once, his courage a gloss over an old distrust.</p>'
  );
  assert(
    decoys.signals.length === 0,
    `words that merely contain an emotion word should score nothing (signals=${JSON.stringify(decoys.signals)})`
  );
  assert(
    decoys.score === 48,
    `prose with no emotional statement should sit at the dimension's base (score=${decoys.score})`
  );

  // The inflections the substring form picked up for free are listed rather than
  // lost, so the repair does not cost the scan the matches it did get right.
  const real = emotionalVariety(
    '<p>She wanted him and hungered for the bargain. She dreaded the reef and was afraid. '
      + 'Her anger raged. The loss ached. She hoped, and trusted him with the vow.</p>'
  );
  for (const family of ['want', 'fear', 'anger', 'grief', 'hope']) {
    assert(
      real.signals.includes(`Emotion family: ${family}`),
      `the ${family} register should still be detected (signals=${JSON.stringify(real.signals)})`
    );
  }
  assert(
    real.score > decoys.score,
    `real emotional range should outscore decoys (real=${real.score}, decoys=${decoys.score})`
  );

  // A whole-word boundary written as `\b` is defined against `[A-Za-z0-9_]`, so
  // it finds a boundary between an ASCII term and the non-ASCII letter beside
  // it and reports a word that is part of a longer one in another script.
  const embedded = emotionalVariety('<p>Мира said the word angerё and nothing else.</p>');
  assert(
    embedded.signals.length === 0,
    `an emotion word inside a non-ASCII word is not that word (signals=${JSON.stringify(embedded.signals)})`
  );
}

// Named rather than repeated, the way the state-store and field-check tests
// name theirs: a dimension id or a theme seed spelled out at four call sites is
// four places to mistype it, and a typo here reads as a passing assertion about
// a dimension that does not exist.
const CONTINUITY_DIMENSION = 'continuity';
const CLIFFHANGER_DIMENSION = 'cliffhanger_quality';
const TROPE_FRESHNESS_DIMENSION = 'trope_freshness';
const FORBIDDEN_LOVE_SEED = 'forbidden_love';
const SLOW_BURN_SEED = 'slow_burn';
const BLOOD_OATHS_SEED = 'blood_oaths';
/** The three seeds the whole-word decoy and its positive twin are both built on. */
const WORD_FORM_THEME_SEEDS = [FORBIDDEN_LOVE_SEED, SLOW_BURN_SEED, BLOOD_OATHS_SEED];
/** A creature the case is not about, for the dimensions that ignore it. */
const UNUSED_CREATURE = 'siren';

function testConfiguredAnchorsAndHookWordsReadWordsNotSubstrings(): void {
  const dimension = (
    id: string,
    storyContent: string,
    configuration: { creature: string; themes: string[] }
  ) => {
    const report = buildStoryQualityHeuristicReport({
      storyContent,
      configuration: { ...configuration, spicyLevel: 3, wordCount: 900 }
    });
    const found = report.dimensions.find(entry => entry.id === id);
    assert(found, `report should include the ${id} dimension`);
    return found;
  };

  // `fairy` is inside `fairytale`, `witch` inside `switch`, `love` inside
  // `gloves`, `burn` inside `burnished`, and `oath` inside `loathing`. Every one
  // of them is a word this genre writes constantly, and none of them is the
  // configured anchor the continuity dimension is claiming to have found.
  const decoyContinuity = dimension(
    CONTINUITY_DIMENSION,
    '<p>She switched off the lamp in the burnished hall, pulled on her gloves, and read '
      + 'the fairytale again with a clover pressed between its pages, loathing every line.</p>',
    { creature: 'witch', themes: WORD_FORM_THEME_SEEDS }
  );
  assert(
    decoyContinuity.signals.length === 0,
    `words that merely contain a configured anchor should score nothing (signals=${JSON.stringify(decoyContinuity.signals)})`
  );

  // The inflections the substring reading picked up for free are kept: a story
  // that says `witches`, `loved`, `burning`, and `oaths` is a story that says
  // those words.
  const realContinuity = dimension(
    CONTINUITY_DIMENSION,
    '<p>The witches had loved each other for a year of burning silence, and the oaths '
      + 'between them were still owed.</p>',
    { creature: 'witch', themes: WORD_FORM_THEME_SEEDS }
  );
  assert(
    realContinuity.signals.includes('Creature appears: witch'),
    `a plural creature is still the creature (signals=${JSON.stringify(realContinuity.signals)})`
  );
  for (const theme of WORD_FORM_THEME_SEEDS) {
    assert(
      realContinuity.signals.includes(`Theme echo appears: ${theme}`),
      `an inflected theme word is still a theme echo (signals=${JSON.stringify(realContinuity.signals)})`
    );
  }
  assert(
    realContinuity.score > decoyContinuity.score,
    `real anchors should outscore decoys (real=${realContinuity.score}, decoys=${decoyContinuity.score})`
  );

  // `fairy` inside `fairytale` deserves its own case: it is the word this app is
  // named for, so it appears in prose about anything.
  const fairytaleDecoy = dimension(
    CONTINUITY_DIMENSION,
    '<p>He told her a fairytale about a dragonfly and demonstrated nothing at all.</p>',
    { creature: 'fairy', themes: [] }
  );
  assert(
    fairytaleDecoy.signals.length === 0,
    `a fairytale is not a fairy (signals=${JSON.stringify(fairytaleDecoy.signals)})`
  );
  const fairiesReal = dimension(
    CONTINUITY_DIMENSION,
    '<p>Two fairies argued over the last of the light.</p>',
    { creature: 'fairy', themes: [] }
  );
  assert(
    fairiesReal.signals.includes('Creature appears: fairy'),
    `an irregular plural is still the creature (signals=${JSON.stringify(fairiesReal.signals)})`
  );

  // `door` is inside `doorway`, `price` inside `priceless`, `blood` inside
  // `bloodless`, and `name` inside `nameless` — four of the eight hook words the
  // cliffhanger dimension credits an ending for, matched by words that negate
  // or merely contain them.
  const decoyEnding = dimension(
    CLIFFHANGER_DIMENSION,
    '<p>An opening line, for the paragraph split.</p>'
      + '<p>She stood in the doorway, bloodless and nameless, holding something priceless.</p>',
    { creature: UNUSED_CREATURE, themes: [] }
  );
  assert(
    decoyEnding.signals.length === 0,
    `an ending that merely contains hook letters is not a hook (signals=${JSON.stringify(decoyEnding.signals)})`
  );
  const realEnding = dimension(
    CLIFFHANGER_DIMENSION,
    '<p>An opening line, for the paragraph split.</p>'
      + '<p>She stood at the door and said his name, and the price was already paid.</p>',
    { creature: UNUSED_CREATURE, themes: [] }
  );
  assert(
    realEnding.signals.includes('Ending contains an unresolved hook word.'),
    `a real hook word should still be found (signals=${JSON.stringify(realEnding.signals)})`
  );

  // `cost` is inside `costume`, in a genre that writes masquerades.
  const costumeDecoy = dimension(
    TROPE_FRESHNESS_DIMENSION,
    '<p>Her costume was finished by midnight.</p>',
    { creature: UNUSED_CREATURE, themes: [] }
  );
  assert(
    costumeDecoy.signals.length === 0,
    `a costume is not a cost (signals=${JSON.stringify(costumeDecoy.signals)})`
  );
  const costReal = dimension(
    TROPE_FRESHNESS_DIMENSION,
    '<p>The bargain had costs she had not counted.</p>',
    { creature: UNUSED_CREATURE, themes: [] }
  );
  assert(
    costReal.signals.includes('Freshness signal: cost'),
    `an inflected freshness signal should still be found (signals=${JSON.stringify(costReal.signals)})`
  );
}

async function main(): Promise<void> {
  testHtmlStoriesAreScoredOnTheirProse();
  testOverlongParagraphsAreReportedNotJustPenalised();
  testEmotionalVarietyReadsWordsNotSubstrings();
  testConfiguredAnchorsAndHookWordsReadWordsNotSubstrings();
  testAnonymousProseScoresAsAnonymous();
  testNamedProseStillScores();
  testNonAsciiNamesAreReadAsNames();
  testNonAsciiWordsDoNotWeldTheirNeighbours();
  testActivationMatchingReadsNonLatinThreads();
  testDialogueSpeakersCountAsCast();
  testBoundaryRulesRejectOnlyTheBoundary();

  const heuristicReport = buildStoryQualityHeuristicReport({
    storyContent: [
      '[Mira]: "If the shell repeats my vow, Lord Brine owns the court by sunrise."',
      "[Narrator]: Mira pressed her palm to the witness shell. Salt stung Mira's wrist as the witness shell glowed under the reef arch, bright enough for every rival to see.",
      '[Lord Brine]: "Then choose which secret survives the tide."',
      'Mira touched the blood oath hidden under her sleeve. The bargain had followed her from the first chapter, and now it wanted a name.'
    ].join('\n\n'),
    configuration: {
      creature: 'siren',
      themes: ['forbidden_love', 'blood_oaths'],
      spicyLevel: 3,
      wordCount: 900
    }
  });
  const heuristicDimensionIds = new Set(heuristicReport.dimensions.map(dimension => dimension.id));
  assert(heuristicReport.source === 'heuristic', 'quality report should identify deterministic heuristic mode.');
  assert(heuristicReport.dimensions.length === 7, 'quality report should include the seven planned dimensions.');
  assert(heuristicDimensionIds.has('continuity'), 'quality report should include continuity.');
  assert(heuristicDimensionIds.has('audio_readiness'), 'quality report should include audio readiness.');
  assert(heuristicReport.dimensions.every(dimension => dimension.score >= 0 && dimension.score <= 100), 'quality scores should stay normalized.');
  assert(heuristicReport.dimensions.some(dimension => dimension.signals.length > 0), 'quality report should include explainable signals.');
  const proseQuality = heuristicReport.dimensions.find(dimension => dimension.id === 'prose_quality');
  assert(proseQuality?.signals.some(signal => signal.includes('Specific anchors: witness shell, reef arch, blood oath')), 'prose quality should report concrete specificity anchors.');
  assert(proseQuality?.signals.some(signal => signal.includes('Sensory texture: glow, salt, sting')), 'prose quality should report concrete sensory texture.');
  const characterConsistency = heuristicReport.dimensions.find(dimension => dimension.id === 'character_consistency');
  assert(characterConsistency?.signals.some(signal => signal.includes('Agency actions: pressed, touched')), 'character consistency should report protagonist agency actions.');
  const audioReadiness = heuristicReport.dimensions.find(dimension => dimension.id === 'audio_readiness');
  assert(audioReadiness?.signals.some(signal => signal.includes('Speaker variety: Mira, Narrator, Lord Brine')), 'audio-readiness should report concrete speaker variety.');

  const classicInput = toClassicGenerationInput(blueprint);
  assert(classicInput.generationContext?.protagonistName === 'Mira', 'protagonist name should survive Story Lab mapping.');
  assert(classicInput.generationContext?.antagonistName === 'Lord Brine', 'antagonist name should survive Story Lab mapping.');
  assert(classicInput.generationContext?.narrativeDirectives?.includes('unanswered question'), 'narrative directives should survive Story Lab mapping.');
  assert(classicInput.generationContext?.themeSeeds?.some(theme => theme.label === 'Blood Oaths'), 'theme labels should survive Story Lab mapping.');

  const genesisPayload = buildStoryLabPayloadFromGeneratedStory(blueprint, classicStory, {
    requestId: 'quality-eval',
    processingTime: 1400,
    chaptersRequested: 2,
    chaptersGenerated: 1
  });
  assert(genesisPayload.state.characters.some(character => character.displayName === 'Mira'), 'protagonist should seed state.');
  assert(genesisPayload.state.characters.some(character => character.displayName === 'Lord Brine'), 'antagonist should seed state.');
  assert(genesisPayload.batch.chapters[0].hasCliffhanger, 'cliffhanger metadata should reach Story Lab chapters.');
  assert(genesisPayload.batch.suggestedNextPrompts.some(prompt => prompt.includes('oath')), 'next chapter hint should become a continuation prompt.');

  const continuity = await extractContinuity({
    storyId: genesisPayload.summary.storyId,
    currentState: genesisPayload.state,
    chapters: genesisPayload.batch.chapters,
    summary: genesisPayload.summary,
    blueprint,
    useAi: false
  });
  assert(continuity.receipt.source === 'heuristic', 'continuity extraction should label heuristic fallback.');
  assert(continuity.receipt.warning?.includes('disabled'), 'disabled AI continuity fallback should be visible.');

  const guidancePreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Pay off the witness shell and make Lord Brine escalate.',
    storyState: genesisPayload.state
  });
  assert(guidancePreview.providerBrief.includes('Pay off the witness shell'), 'guidance preview should preserve the user continuation brief.');
  assert(guidancePreview.hiddenGuidance.includes('Continuity Courtroom:'), 'guidance preview should expose hidden continuity anchors for future UI preview work.');
  assert(guidancePreview.anchorHeadings.length === 3, 'guidance preview should report the three hidden anchor blocks.');
  assert(guidancePreview.characterCount <= 900, 'guidance preview should expose the same compactness budget guarded by real-engine tests.');
  const activationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Bring the blood oath into the next room.',
    storyState: {
      ...genesisPayload.state,
      threads: [
        {
          id: 'thread-weather-tax',
          label: 'Weather Tax',
          status: 'active',
          description: 'The court taxes every storm that crosses the reef.',
          foreshadowedDevices: []
        },
        {
          id: 'thread-kitchen-claim',
          label: 'Kitchen Claim',
          status: 'active',
          description: 'The servants know who stole the silver ladle.',
          foreshadowedDevices: []
        },
        {
          id: 'thread-silent-harbor',
          label: 'Silent Harbor',
          status: 'active',
          description: 'The harbor stopped answering ships at midnight.',
          foreshadowedDevices: []
        },
        {
          id: 'thread-blood-oath',
          label: 'Blood Oath',
          status: 'active',
          description: 'The old vow follows Mira into every negotiation.',
          foreshadowedDevices: []
        }
      ],
      artifacts: [],
      continuityWarnings: []
    }
  });
  assert(activationPreview.hiddenGuidance.includes('Open promise: Blood Oath'), 'continuation guidance should prioritize a brief-matched thread when the courtroom is compacted.');
  assert(
    activationPreview.contextSourceMap.some(item =>
      item.kind === 'thread'
      && item.label === 'Blood Oath'
      && item.anchorLabel === 'Open promise'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Blood Oath thread was activated.'
  );
  const memoryComparisonState = {
    ...genesisPayload.state,
    characters: [],
    threads: [
      {
        id: 'thread-weather-tax',
        label: 'Weather Tax',
        status: 'active' as const,
        description: 'The court taxes every storm that crosses the reef.',
        foreshadowedDevices: []
      },
      {
        id: 'thread-kitchen-claim',
        label: 'Kitchen Claim',
        status: 'active' as const,
        description: 'The servants know who stole the silver ladle.',
        foreshadowedDevices: []
      },
      {
        id: 'thread-silent-harbor',
        label: 'Silent Harbor',
        status: 'active' as const,
        description: 'The harbor stopped answering ships at midnight.',
        foreshadowedDevices: []
      },
      {
        id: 'thread-moonlit-oath',
        label: 'Moonlit Oath',
        status: 'active' as const,
        description: 'Mara promised the duke a ledger that would cost her the archive.',
        foreshadowedDevices: []
      }
    ],
    artifacts: [],
    continuityWarnings: []
  };
  const neutralMemoryPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Raise the pressure in the next room.',
    storyState: memoryComparisonState
  });
  assert(
    !neutralMemoryPreview.contextSourceMap.some(item => item.kind === 'thread' && item.label === 'Moonlit Oath'),
    'neutral continuation brief should not activate the lower-priority Moonlit Oath thread.'
  );
  const acceptedMemoryPreview = previewStoryLabContinuationGuidance({
    continuationBrief: [
      'Raise the pressure in the next room.',
      '',
      'Accepted Memory Cards:',
      '- Promise card: Moonlit Oath. Mara will burn the moonlit ledger before she lets the duke own the vow. Trigger: Moonlit oath, ledger.'
    ].join('\n'),
    storyState: memoryComparisonState
  });
  assert(
    acceptedMemoryPreview.hiddenGuidance.includes('Open promise: Moonlit Oath'),
    'accepted memory card text should change the selected continuity anchor.'
  );
  assert(
    acceptedMemoryPreview.contextSourceMap.some(item =>
      item.kind === 'thread'
      && item.label === 'Moonlit Oath'
      && item.reason.includes('accepted memory card text')),
    'guidance preview should explain when accepted memory card text activated an anchor.'
  );
  const artifactActivationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Use the glass key now; make it unlock the forbidden tide door.',
    storyState: {
      ...genesisPayload.state,
      threads: [],
      artifacts: [
        {
          id: 'artifact-silver-ladle',
          name: 'Silver Ladle',
          significance: 'The kitchen staff hid it after the court dinner.',
          introducedInChapter: 1
        },
        {
          id: 'artifact-storm-ledger',
          name: 'Storm Ledger',
          significance: 'The reef court taxes storms by moon phase.',
          introducedInChapter: 1
        },
        {
          id: 'artifact-glass-key',
          name: 'Glass Key',
          significance: 'A brittle key that opens the forbidden tide door only once.',
          introducedInChapter: 1
        }
      ],
      continuityWarnings: []
    }
  });
  assert(artifactActivationPreview.hiddenGuidance.includes('World clue: Glass Key'), 'continuation guidance should prioritize a brief-matched artifact when the courtroom is compacted.');
  assert(
    artifactActivationPreview.contextSourceMap.some(item =>
      item.kind === 'artifact'
      && item.label === 'Glass Key'
      && item.anchorLabel === 'World clue'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Glass Key artifact was activated.'
  );
  const relationshipActivationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Let Coral Scribe betray Mira with the court ledger.',
    storyState: {
      ...genesisPayload.state,
      characters: [
        {
          id: 'mira',
          displayName: 'Mira',
          archetype: 'protagonist',
          summary: 'A siren diplomat carrying a forbidden oath.',
          currentGoal: 'Keep the reef court from owning her lover.',
          internalConflict: 'She wants help but fears being seen needing it.',
          externalConflict: 'The court wants the oath made public.',
          secrets: [],
          relationships: [
            {
              characterId: 'lord-brine',
              relationship: 'rival',
              notes: 'Lord Brine can turn the vow into leverage.'
            },
            {
              characterId: 'coral-scribe',
              relationship: 'ally',
              notes: 'Coral Scribe knows which ledger proves the betrayal.'
            }
          ],
          spiceCompatibilities: [3]
        },
        {
          id: 'lord-brine',
          displayName: 'Lord Brine',
          archetype: 'antagonist',
          summary: 'A reef lord with a claim on the oath.',
          currentGoal: 'Own the court record.',
          internalConflict: 'He wants Mira to choose him and the court.',
          externalConflict: 'Mira can make him look desperate.',
          secrets: [],
          relationships: [],
          spiceCompatibilities: [3]
        },
        {
          id: 'coral-scribe',
          displayName: 'Coral Scribe',
          archetype: 'supporting',
          summary: 'A court recordkeeper who knows which ledger can hurt Mira.',
          currentGoal: 'Survive whichever side wins.',
          internalConflict: 'Loyalty costs more than silence.',
          externalConflict: 'Both Mira and Lord Brine need the ledger.',
          secrets: [],
          relationships: [],
          spiceCompatibilities: [3]
        }
      ],
      threads: [],
      artifacts: [],
      continuityWarnings: []
    }
  });
  assert(relationshipActivationPreview.hiddenGuidance.includes('Relationship pressure: Mira and Coral Scribe'), 'continuation guidance should prioritize a brief-matched relationship pair.');
  assert(
    relationshipActivationPreview.contextSourceMap.some(item =>
      item.kind === 'relationship'
      && item.label === 'Mira and Coral Scribe'
      && item.anchorLabel === 'Relationship pressure'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Coral Scribe relationship was activated.'
  );
  const warningActivationPreview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Make Coral Scribe honor the ledger warning before the court leaves.',
    storyState: {
      ...genesisPayload.state,
      characters: [],
      threads: [],
      artifacts: [],
      continuityWarnings: [
        'Do not move the storm tax before the reef bell rings.',
        'Keep the kitchen staff out of the oath scene.',
        'Coral Scribe must betray Mira before the ledger leaves court.'
      ]
    }
  });
  assert(warningActivationPreview.hiddenGuidance.includes('Continuity note: Coral Scribe must betray Mira before the ledger leaves court.'), 'continuation guidance should prioritize a brief-matched continuity warning when the courtroom is compacted.');
  assert(
    warningActivationPreview.contextSourceMap.some(item =>
      item.kind === 'warning'
      && item.label === 'Coral Scribe must betray Mira before the ledger leaves court.'
      && item.anchorLabel === 'Continuity note'
      && item.reason.includes('Matched words from the continuation brief')),
    'guidance preview should explain why the Coral Scribe warning was activated.'
  );

  let continuationInput: ClassicContinuationSeam['input'] | null = null;
  const continuationResponse = await withEnv({ XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, () => continueStoryLab({
      storyId: genesisPayload.summary.storyId,
      chapterBatchSize: 1,
      storyState: genesisPayload.state,
      previouslyGeneratedChapters: genesisPayload.batch.chapters,
      continuationBrief: [
        'Pay off the witness shell and make Lord Brine escalate.',
        '',
        'Accepted Memory Cards:',
        '- Promise card: Private ledger. The private card detail names the hidden betrayal. Trigger: Private ledger, betrayal.'
      ].join('\n'),
      existingSummary: genesisPayload.summary
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by continuation eval.');
        },
        continueChapter: async input => {
          continuationInput = input;
          return {
            success: true,
            data: {
              storyId: input.storyId,
              chapterNumber: 2,
              title: 'The Recorded Oath',
              content: "<p>The witness shell sang Mira's secret into the court.</p>",
              creature: 'siren',
              spicyLevelMaintained: 3,
              toneConsistency: true,
              continuedAt: new Date('2026-05-28T20:05:00.000Z'),
              chapters: [
                {
                  chapterId: 'chapter-2',
                  chapterNumber: 2,
                  title: 'The Recorded Oath',
                  content: "<p>The witness shell sang Mira's secret into the court.</p>",
                  rawContent: "The witness shell sang Mira's secret into the court.",
                  wordCount: 10,
                  generatedAt: new Date('2026-05-28T20:05:00.000Z'),
                  hasAudio: false,
                  cliffhangerEnding: true
                }
              ],
              totalWordCount: 10,
              appendedToStory: "<p>The witness shell sang Mira's secret into the court.</p>",
              nextChapterHint: 'Force Lord Brine to name the punishment.',
              tropeMetadata: input.tropeMetadata
            }
          };
        }
      })
    })
  );

  assert(continuationResponse.success, 'continuation eval should succeed with a fake service.');
  assert(
    continuationInput?.existingContent.toLowerCase().includes('witness shell'),
    `continuation should receive previous chapter context. Received: ${continuationInput?.existingContent ?? 'none'}`
  );
  assert(continuationInput?.userInput?.includes('Lord Brine'), 'continuation brief should reach the story service.');
  const hiddenGuidance = continuationInput?.userInput ?? '';
  assert(hiddenGuidance.includes('Continuity Courtroom:'), 'continuation guidance should include continuity anchors.');
  assert(hiddenGuidance.includes('Chapter Ending Stress Test:'), 'continuation guidance should include ending pressure.');
  assert(hiddenGuidance.includes('Cliche Alarm:'), 'continuation guidance should include stale-path avoidance.');
  assert(!hiddenGuidance.includes('Scene Pressure Mixer:'), 'scene pressure should reuse an existing anchor instead of adding a fourth hidden block.');
  assert(!hiddenGuidance.includes('Subtext Receipt:'), 'subtext receipt should stay inside an existing hidden block.');
  assert(hiddenGuidance.includes('Scene pressure mix: Secret + Setting;'), 'continuation guidance should add a compact pressure mix inside the ending anchor.');
  assert(!hiddenGuidance.includes('Scene pressure mix: Secret + Setting.'), 'scene pressure should include a concrete seeded variant, not just labels.');
  assert(
    hiddenGuidance.includes('Subtext receipt: prove Mira and Lord Brine by behavior before explanation.'),
    'continuation guidance should force emotional change to show through behavior before explanation.'
  );
  assert(!hiddenGuidance.includes('Escalating thread:'), 'continuation guidance should not expose mechanical thread labels.');
  assert(!hiddenGuidance.includes('Open thread:'), 'continuation guidance should not expose mechanical thread labels.');
  assert(!hiddenGuidance.includes('Unresolved artifact:'), 'continuation guidance should not expose mechanical artifact labels.');
  assert(!hiddenGuidance.includes('Warning to honor:'), 'continuation guidance should not expose mechanical warning labels.');
  assert(!hiddenGuidance.includes('generic conflict'), 'continuation guidance should not ask the model to avoid generic conflict with generic wording.');
  assert(!hiddenGuidance.includes('World clue: World Details'), 'continuation guidance should not use a generic world artifact name.');
  assert(hiddenGuidance.includes('World clue: Witness Shells'), 'continuation guidance should name the concrete world clue.');
  assert(continuationResponse.data.batch.chapters[0].chapterNumber === 2, 'continuation should append the next chapter number.');
  assert(continuationResponse.data.continuityExtraction?.source === 'heuristic', 'test-injected service should keep heuristic continuity labeling.');
  const suggestedPromptText = continuationResponse.data.batch.suggestedNextPrompts.join(' ');
  assert(suggestedPromptText.includes('Pay off the witness shell'), 'public continuation brief should still seed suggested prompt chips.');
  assert(!suggestedPromptText.includes('Accepted Memory Cards'), 'suggested prompt chips should not expose internal accepted memory sections.');
  assert(!suggestedPromptText.includes('private card detail'), 'suggested prompt chips should not expose private memory card detail.');

  console.log('Story quality evals passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
