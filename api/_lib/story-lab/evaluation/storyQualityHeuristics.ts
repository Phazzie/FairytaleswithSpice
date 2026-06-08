import type {
  StoryQualityDimensionScore,
  StoryQualityHeuristicReport
} from '../contracts';

export interface StoryQualityHeuristicInput {
  storyContent: string;
  configuration: {
    creature: string;
    themes: string[];
    spicyLevel: number;
    wordCount: number;
  };
}

type DimensionDraft = Omit<StoryQualityDimensionScore, 'score'> & {
  score: number;
};

export function buildStoryQualityHeuristicReport(input: StoryQualityHeuristicInput): StoryQualityHeuristicReport {
  const storyText = collapseWhitespace(input.storyContent);
  const lowerStory = storyText.toLowerCase();
  const paragraphs = input.storyContent.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
  const sentences = storyText.split(/[.!?]+/).map(sentence => sentence.trim()).filter(Boolean);
  const words = storyText.split(/\s+/).filter(Boolean);
  const dialogueLines = input.storyContent.split('\n').filter(line => /^\s*\[[^\]]+\]:/.test(line));
  const dimensions: StoryQualityDimensionScore[] = [
    scoreContinuity(lowerStory, input.configuration),
    scoreCliffhangerQuality(lowerStory, paragraphs),
    scoreTropeFreshness(lowerStory),
    scoreEmotionalVariety(lowerStory),
    scoreCharacterConsistency(input.storyContent, dialogueLines),
    scoreProseQuality(input.storyContent, words.length, sentences.length, paragraphs.length),
    scoreAudioReadiness(dialogueLines, paragraphs)
  ].map(normalizeDimension);
  const overallScore = clampScore(Math.round(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / Math.max(1, dimensions.length)
  ));

  return {
    source: 'heuristic',
    heuristicOnly: true,
    overallScore,
    dimensions,
    summary: `Deterministic story-quality scan completed with ${dimensions.length} advisory dimensions.`
  };
}

function scoreContinuity(storyText: string, configuration: StoryQualityHeuristicInput['configuration']): DimensionDraft {
  const signals: string[] = [];
  if (configuration.creature && storyText.includes(configuration.creature.toLowerCase())) {
    signals.push(`Creature appears: ${configuration.creature}`);
  }
  for (const theme of configuration.themes) {
    const themeWords = theme.split(/[_\s-]+/).filter(word => word.length > 3);
    if (themeWords.some(word => storyText.includes(word.toLowerCase()))) {
      signals.push(`Theme echo appears: ${theme}`);
    }
  }
  if (containsAny(storyText, ['oath', 'vow', 'bargain', 'debt', 'secret'])) {
    signals.push('Continuity object or promise is repeated.');
  }

  return {
    id: 'continuity',
    label: 'Continuity',
    score: 55 + signals.length * 12,
    rationale: signals.length ? 'Story text repeats configured or established state.' : 'Few configured story anchors were detected.',
    signals
  };
}

function scoreCliffhangerQuality(storyText: string, paragraphs: string[]): DimensionDraft {
  const finalParagraph = (paragraphs[paragraphs.length - 1] ?? storyText).toLowerCase();
  const signals: string[] = [];
  if (/[?!]\s*$/.test(finalParagraph)) {
    signals.push('Ending closes on a question or exclamation.');
  }
  if (containsAny(finalParagraph, ['choose', 'secret', 'reveal', 'blood', 'price', 'door', 'name', 'truth'])) {
    signals.push('Ending contains an unresolved hook word.');
  }
  if (containsAny(finalParagraph, ['cliff', 'continued', 'to be continued'])) {
    signals.push('Ending uses explicit cliffhanger language.');
  }

  return {
    id: 'cliffhanger_quality',
    label: 'Cliffhanger quality',
    score: 50 + signals.length * 16,
    rationale: signals.length ? 'The ending carries unresolved pressure.' : 'The ending may need a sharper unresolved turn.',
    signals
  };
}

function scoreTropeFreshness(storyText: string): DimensionDraft {
  const staleSignals = ['damsel in distress', 'it was all a dream', 'love at first sight', 'chosen one'];
  const staleHits = staleSignals.filter(signal => storyText.includes(signal));
  const freshSignals = ['cost', 'bargain', 'choice', 'consequence', 'leverage'].filter(signal => storyText.includes(signal));
  return {
    id: 'trope_freshness',
    label: 'Trope freshness',
    score: 72 + freshSignals.length * 6 - staleHits.length * 18,
    rationale: staleHits.length ? 'Potential stale trope language was detected.' : 'No obvious stale trope phrase was detected.',
    signals: staleHits.length ? staleHits.map(hit => `Stale phrase: ${hit}`) : freshSignals.map(hit => `Freshness signal: ${hit}`)
  };
}

function scoreEmotionalVariety(storyText: string): DimensionDraft {
  const emotionGroups = [
    ['want', 'desire', 'hunger'],
    ['fear', 'dread', 'afraid'],
    ['anger', 'rage', 'fury'],
    ['grief', 'ache', 'loss'],
    ['hope', 'trust', 'mercy']
  ];
  const matchedGroups = emotionGroups.filter(group => group.some(word => storyText.includes(word)));
  return {
    id: 'emotional_variety',
    label: 'Emotional variety',
    score: 48 + matchedGroups.length * 12,
    rationale: matchedGroups.length > 1 ? 'Multiple emotional registers are present.' : 'Emotional range looks narrow in the deterministic scan.',
    signals: matchedGroups.map(group => `Emotion family: ${group[0]}`)
  };
}

function scoreCharacterConsistency(storyContent: string, dialogueLines: string[]): DimensionDraft {
  const speakers = extractDialogueSpeakers(dialogueLines);
  const namedCharacters = Array.from(new Set((storyContent.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [])
    .filter(name => !['Narrator'].includes(name))));
  const agencyActions = extractAgencyActions(storyContent, namedCharacters);
  const signals = [
    ...speakers.map(speaker => `Speaker: ${speaker}`),
    ...(namedCharacters.length ? [`Named character count: ${namedCharacters.length}`] : []),
    ...(agencyActions.length ? [`Agency actions: ${agencyActions.slice(0, 4).join(', ')}`] : [])
  ];

  return {
    id: 'character_consistency',
    label: 'Character consistency',
    score: 52 + Math.min(3, speakers.length) * 12 + Math.min(2, namedCharacters.length) * 6 + Math.min(2, agencyActions.length) * 5,
    rationale: agencyActions.length
      ? 'Dialogue speakers, named characters, and concrete character actions are identifiable.'
      : speakers.length ? 'Dialogue speakers and named characters are identifiable.' : 'Few character identity signals were detected.',
    signals
  };
}

function scoreProseQuality(storyContent: string, wordCount: number, sentenceCount: number, paragraphCount: number): DimensionDraft {
  const averageSentenceLength = sentenceCount ? wordCount / sentenceCount : wordCount;
  const signals: string[] = [
    `Words: ${wordCount}`,
    `Paragraphs: ${paragraphCount}`,
    `Average sentence length: ${averageSentenceLength.toFixed(1)}`
  ];
  const specificAnchors = extractConcreteAnchors(storyContent);
  if (specificAnchors.length) {
    signals.push(`Specific anchors: ${specificAnchors.slice(0, 3).join(', ')}`);
  }
  const sensoryTextures = extractSensoryTextures(storyContent);
  if (sensoryTextures.length) {
    signals.push(`Sensory texture: ${sensoryTextures.slice(0, 4).join(', ')}`);
  }
  const sentenceScore = averageSentenceLength >= 8 && averageSentenceLength <= 28 ? 24 : 10;
  const paragraphScore = paragraphCount >= 2 ? 18 : 8;
  const specificityScore = Math.min(2, specificAnchors.length) * 4;
  const sensoryScore = Math.min(3, sensoryTextures.length) * 3;

  return {
    id: 'prose_quality',
    label: 'Prose quality',
    score: 48 + sentenceScore + paragraphScore + specificityScore + sensoryScore,
    rationale: 'Deterministic readability scan uses sentence shape, concrete anchors, and sensory texture signals.',
    signals
  };
}

function scoreAudioReadiness(dialogueLines: string[], paragraphs: string[]): DimensionDraft {
  const dialogueLineCount = dialogueLines.length;
  const speakers = extractDialogueSpeakers(dialogueLines);
  const longParagraphs = paragraphs.filter(paragraph => paragraph.split(/\s+/).filter(Boolean).length > 90);
  const signals: string[] = [];
  if (dialogueLineCount > 0) {
    signals.push(`Tagged dialogue lines: ${dialogueLineCount}`);
  }
  if (speakers.length > 1) {
    signals.push(`Speaker variety: ${speakers.slice(0, 4).join(', ')}`);
  } else if (speakers.length === 1) {
    signals.push(`Single speaker: ${speakers[0]}`);
  }
  if (!longParagraphs.length) {
    signals.push('No overlong paragraphs detected.');
  }

  return {
    id: 'audio_readiness',
    label: 'Audio-readiness',
    score: 58 + Math.min(3, dialogueLineCount) * 8 + (longParagraphs.length ? -18 : 12),
    rationale: 'Audio-readiness checks dialogue tags, speaker variety, and paragraph length.',
    signals
  };
}

function normalizeDimension(dimension: DimensionDraft): StoryQualityDimensionScore {
  return {
    ...dimension,
    score: clampScore(Math.round(dimension.score))
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some(needle => value.includes(needle));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractDialogueSpeakers(dialogueLines: string[]): string[] {
  return Array.from(new Set(dialogueLines
    .map(line => line.match(/^\s*\[([^\]]+)\]:/)?.[1]?.trim())
    .map(speaker => speaker?.split(',')[0]?.trim())
    .filter((speaker): speaker is string => Boolean(speaker))));
}

function extractAgencyActions(storyContent: string, namedCharacters: readonly string[]): string[] {
  const agencyLexicon: Array<{ label: string; terms: readonly string[] }> = [
    { label: 'pressed', terms: ['press', 'pressed', 'presses'] },
    { label: 'touched', terms: ['touch', 'touched', 'touches'] },
    { label: 'chose', terms: ['chose', 'chooses'] },
    { label: 'refused', terms: ['refuse', 'refused', 'refuses'] },
    { label: 'revealed', terms: ['reveal', 'revealed', 'reveals'] },
    { label: 'risked', terms: ['risk', 'risked', 'risks'] },
    { label: 'protected', terms: ['protect', 'protected', 'protects'] },
    { label: 'challenged', terms: ['challenge', 'challenged', 'challenges'] },
    { label: 'paid', terms: ['pay', 'paid', 'pays'] },
    { label: 'escaped', terms: ['escape', 'escaped', 'escapes'] }
  ];
  const normalized = storyContent
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, ' ')
    .replace(/\s+/g, ' ');
  const lowerNames = namedCharacters
    .map(name => name.toLowerCase().replace(/[^a-z'\s-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(name => name.length > 2);
  const actions: string[] = [];

  for (const entry of agencyLexicon) {
    const termPattern = entry.terms.map(escapeRegExp).join('|');
    const hasNamedAction = lowerNames.some(name => {
      const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b(?:\\s+[a-z']+){0,4}\\s+(${termPattern})\\b`);
      return pattern.test(normalized);
    });
    if (hasNamedAction) {
      actions.push(entry.label);
    }
  }

  return actions;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractConcreteAnchors(storyContent: string): string[] {
  const objectNouns = new Set([
    'arch',
    'bargain',
    'blade',
    'book',
    'bridge',
    'car',
    'contract',
    'court',
    'crown',
    'door',
    'envelope',
    'house',
    'key',
    'ledger',
    'letter',
    'map',
    'mirror',
    'oath',
    'phone',
    'reef',
    'ring',
    'shell',
    'sleeve',
    'ticket',
    'vow'
  ]);
  const weakFirstTokens = new Set([
    'a',
    'an',
    'and',
    'every',
    'her',
    'his',
    'my',
    'now',
    'our',
    'that',
    'the',
    'then',
    'their',
    'this',
    'under',
    'which',
    'your'
  ]);
  const weakVerbPrefixes = new Set([
    'choose',
    'glowed',
    'listened',
    'owns',
    'pressed',
    'recorded',
    'repeats',
    'survives',
    'touched',
    'wanted'
  ]);
  const anchors: string[] = [];
  const normalized = storyContent
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, ' ')
    .replace(/\s+/g, ' ');
  const tokens = normalized.split(' ').filter(token => token.length > 2);

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const phrase = `${tokens[index]} ${tokens[index + 1]}`;
    const noun = tokens[index + 1].replace(/s$/, '');
    const firstToken = tokens[index];
    if (
      weakFirstTokens.has(firstToken) ||
      weakVerbPrefixes.has(firstToken) ||
      !objectNouns.has(noun) ||
      anchors.includes(phrase)
    ) {
      continue;
    }
    anchors.push(phrase);
    if (anchors.length >= 5) {
      break;
    }
  }

  return anchors;
}

function extractSensoryTextures(storyContent: string): string[] {
  const normalized = storyContent.toLowerCase();
  const sensoryLexicon: Array<{ label: string; terms: readonly string[] }> = [
    { label: 'glow', terms: ['glow', 'glowed', 'glowing', 'bright', 'shimmer', 'shimmered'] },
    { label: 'salt', terms: ['salt', 'salty'] },
    { label: 'sting', terms: ['sting', 'stung', 'stinging'] },
    { label: 'cold', terms: ['cold', 'chill', 'chilled'] },
    { label: 'heat', terms: ['heat', 'hot', 'warm'] },
    { label: 'scent', terms: ['scent', 'smell', 'perfume', 'smoke'] },
    { label: 'sound', terms: ['sound', 'sang', 'whisper', 'rang'] }
  ];

  return sensoryLexicon
    .filter(entry => entry.terms.some(term => new RegExp(`\\b${term}\\b`).test(normalized)))
    .map(entry => entry.label);
}
