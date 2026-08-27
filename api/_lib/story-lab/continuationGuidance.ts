// Created: 2026-08-27 02:55 UTC

/**
 * The "Continuity Courtroom" / prompt-guidance subsystem, extracted out of
 * `storyLabEngine.ts` (previously ~700 of that file's 1,726 lines — 40% of
 * it — with zero unit tests of its own; it was only reachable indirectly
 * through the genesis/continuation integration tests). Builds the hidden
 * guidance appended to a continuation brief before it reaches the model:
 * which unresolved threads, artifacts, relationships, and continuity
 * warnings to surface, which chapter-ending pressure to aim for, and which
 * cliche to steer away from. Pure functions of a `StoryStateSnapshot` and an
 * optional brief string — no AI calls, no other collaborators.
 */

import type {
  CharacterProfile,
  LoreArtifact,
  PlotThread,
  StoryStateSnapshot
} from './contracts';
import { collapseWhitespace } from '../utils/whitespace';

export interface StoryLabContinuationGuidancePreview {
  originalBrief: string;
  providerBrief: string;
  hiddenGuidance: string;
  anchorHeadings: string[];
  contextSourceMap: StoryLabContinuationSourceMapEntry[];
  characterCount: number;
}

type StoryLabContinuationSourceKind = 'thread' | 'relationship' | 'artifact' | 'warning';

export interface StoryLabContinuationSourceMapEntry {
  kind: StoryLabContinuationSourceKind;
  label: string;
  anchorLabel: string;
  reason: string;
  activationScore: number;
}

const CONTINUITY_COURTROOM_MAX_THREADS = 3;
const CONTINUITY_COURTROOM_MAX_ARTIFACTS = 2;
const CONTINUITY_COURTROOM_MAX_WARNINGS = 2;
const CONTINUITY_COURTROOM_MAX_DETAIL_LENGTH = 180;
// Hidden anchors share one compact provider budget so guidance cannot crowd prior-chapter context.
const CONTINUATION_HIDDEN_GUIDANCE_MAX_LENGTH = 860;
const CONTINUITY_COURTROOM_MAX_SECTION_LENGTH = 420;
const CHAPTER_ENDING_STRESS_TEST_MAX_SECTION_LENGTH = 320;
const CLICHE_ALARM_MAX_SECTION_LENGTH = 300;
type ChapterEndingPressureId = 'emotional_reveal' | 'danger_escalation' | 'secret_exposed';
type ScenePressureLabel = 'Emotional' | 'Secret' | 'Deadline' | 'Social' | 'Setting';
interface ChapterEndingPressure {
  id: ChapterEndingPressureId;
  label: string;
  candidateLabel: string;
  instruction: string;
}
const CHAPTER_ENDING_PRESSURES: readonly ChapterEndingPressure[] = [
  {
    id: 'emotional_reveal',
    label: 'Emotional reveal',
    candidateLabel: 'emotional reveal',
    instruction: 'end on a private truth the characters cannot comfortably take back.'
  },
  {
    id: 'danger_escalation',
    label: 'Danger escalation',
    candidateLabel: 'danger escalation',
    instruction: 'end with the outside threat entering the scene in a way that forces motion.'
  },
  {
    id: 'secret_exposed',
    label: 'Secret exposed',
    candidateLabel: 'secret exposed',
    instruction: 'expose a secret that changes the next chapter.'
  }
];
const SCENE_PRESSURE_VARIANTS: Record<ScenePressureLabel, readonly string[]> = {
  Emotional: ['private truth costs status', 'want changes the bargain', 'affection becomes leverage'],
  Secret: ['truth changes leverage', 'hidden motive costs safety', 'named lie changes power'],
  Deadline: ['clock forces choice', 'delay costs safety', 'time makes refusal visible'],
  Social: ['witnesses make retreat costly', 'status turns into pressure', 'audience changes the bargain'],
  Setting: ['place enforces cost', 'room becomes leverage', 'world rule tightens']
};

export function previewStoryLabContinuationGuidance(input: {
  continuationBrief?: string;
  storyState: StoryStateSnapshot;
}): StoryLabContinuationGuidancePreview {
  const originalBrief = input.continuationBrief?.trim() ?? '';
  const providerBrief = withContinuationStrategyBrief(input.continuationBrief, input.storyState) ?? originalBrief;
  const hiddenGuidance = extractHiddenContinuationGuidance(providerBrief, originalBrief);
  return {
    originalBrief,
    providerBrief,
    hiddenGuidance,
    anchorHeadings: extractAnchorHeadings(hiddenGuidance),
    contextSourceMap: buildContinuationContextSourceMap(input.storyState, originalBrief),
    characterCount: providerBrief.length
  };
}

export function withContinuationStrategyBrief(continuationBrief: string | undefined, storyState: StoryStateSnapshot): string | undefined {
  const trimmedBrief = continuationBrief?.trim();
  const hiddenGuidance = joinGuidanceSectionsWithinBudget([
    buildContinuityCourtroomBrief(storyState, trimmedBrief),
    buildChapterEndingStressTestBrief(storyState, trimmedBrief),
    buildClicheAlarmBrief(storyState, trimmedBrief)
  ], CONTINUATION_HIDDEN_GUIDANCE_MAX_LENGTH);

  return [
    trimmedBrief,
    hiddenGuidance
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n') || undefined;
}

function extractHiddenContinuationGuidance(providerBrief: string, originalBrief: string): string {
  if (!originalBrief || !providerBrief.startsWith(originalBrief)) {
    return providerBrief.trim();
  }

  return providerBrief.slice(originalBrief.length).trim();
}

function extractAnchorHeadings(hiddenGuidance: string): string[] {
  return hiddenGuidance
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[A-Za-z][A-Za-z ]+:$/.test(line))
    .map(line => line.slice(0, -1));
}

function joinGuidanceSectionsWithinBudget(sections: Array<string | undefined>, maxLength: number): string | undefined {
  const acceptedSections: string[] = [];
  let usedLength = 0;

  for (const section of sections) {
    if (!section) {
      continue;
    }

    const separatorLength = acceptedSections.length > 0 ? 2 : 0;
    const remainingLength = maxLength - usedLength - separatorLength;
    const trimmedSection = limitGuidanceSection(section.split('\n'), remainingLength);
    if (!trimmedSection) {
      continue;
    }

    acceptedSections.push(trimmedSection);
    usedLength += separatorLength + trimmedSection.length;
  }

  return acceptedSections.join('\n\n') || undefined;
}

function limitGuidanceSection(lines: string[], maxLength: number): string | undefined {
  const heading = lines[0]?.trim();
  if (!heading || maxLength <= heading.length + 2) {
    return undefined;
  }

  const selectedLines = [heading];
  let usedLength = heading.length;

  for (const line of lines.slice(1)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const remainingLength = maxLength - usedLength - 1;
    if (remainingLength <= 0) {
      break;
    }

    const nextLine = trimmedLine.length <= remainingLength
      ? trimmedLine
      : compactPromptLineToLength(trimmedLine, remainingLength);
    if (!nextLine) {
      break;
    }

    selectedLines.push(nextLine);
    usedLength += 1 + nextLine.length;
    if (nextLine !== trimmedLine) {
      break;
    }
  }

  return selectedLines.length > 1 ? selectedLines.join('\n') : undefined;
}

function compactPromptLineToLength(value: string, maxLength: number): string {
  const compacted = collapseWhitespace(value).trim();
  if (compacted.length <= maxLength) {
    return compacted;
  }

  if (maxLength < 12) {
    return '';
  }

  return `${compacted.slice(0, maxLength - 3).trim()}...`;
}

function buildContinuityCourtroomBrief(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string | undefined {
  const lines: string[] = [];

  for (const thread of selectCourtroomThreads(storyState, continuationBrief)) {
    lines.push(`- ${formatThreadDebtLabel(thread)}: ${compactPromptLine(thread.label)}${formatCourtroomDetail(thread.description)}`);
  }

  const relationshipPressure = selectRelationshipPressure(storyState, continuationBrief);
  if (relationshipPressure) {
    lines.push(formatRelationshipPressureLine(relationshipPressure));
  }

  for (const artifact of selectCourtroomArtifacts(storyState, continuationBrief)) {
    lines.push(`- World clue: ${compactPromptLine(artifact.name)}${formatCourtroomDetail(artifact.significance)}`);
  }

  for (const warning of selectCourtroomWarnings(storyState, continuationBrief)) {
    lines.push(`- Continuity note: ${compactPromptLine(warning)}`);
  }

  if (lines.length === 0) {
    return undefined;
  }

  return limitGuidanceSection([
    'Continuity Courtroom:',
    ...lines
  ], CONTINUITY_COURTROOM_MAX_SECTION_LENGTH);
}

function buildContinuationContextSourceMap(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined
): StoryLabContinuationSourceMapEntry[] {
  const entries: StoryLabContinuationSourceMapEntry[] = [];

  for (const item of selectScoredCourtroomThreads(storyState, continuationBrief)) {
    entries.push({
      kind: 'thread',
      label: item.thread.label,
      anchorLabel: formatThreadDebtLabel(item.thread),
      reason: formatActivationReason(item.activationScore, continuationBrief, getThreadActivationCandidates(item.thread)),
      activationScore: item.activationScore
    });
  }

  const relationshipPressure = selectRelationshipPressure(storyState, continuationBrief);
  if (relationshipPressure) {
    entries.push({
      kind: 'relationship',
      label: `${relationshipPressure.sourceCharacter.displayName} and ${relationshipPressure.targetCharacter.displayName}`,
      anchorLabel: 'Relationship pressure',
      reason: formatActivationReason(
        relationshipPressure.activationScore,
        continuationBrief,
        getRelationshipActivationCandidates(
          relationshipPressure.sourceCharacter,
          relationshipPressure.targetCharacter,
          relationshipPressure.relationship
        )
      ),
      activationScore: relationshipPressure.activationScore
    });
  }

  for (const item of selectScoredCourtroomArtifacts(storyState, continuationBrief)) {
    entries.push({
      kind: 'artifact',
      label: item.artifact.name,
      anchorLabel: 'World clue',
      reason: formatActivationReason(item.activationScore, continuationBrief, getArtifactActivationCandidates(item.artifact)),
      activationScore: item.activationScore
    });
  }

  for (const item of selectScoredCourtroomWarnings(storyState, continuationBrief)) {
    entries.push({
      kind: 'warning',
      label: item.warning,
      anchorLabel: 'Continuity note',
      reason: formatActivationReason(item.activationScore, continuationBrief, getWarningActivationCandidates(item.warning)),
      activationScore: item.activationScore
    });
  }

  return entries;
}

function formatActivationReason(
  activationScore: number,
  continuationBrief: string | undefined,
  activationCandidates: string[]
): string {
  if (activationScore <= 0) {
    return 'Included by unresolved-story priority.';
  }

  return hasAcceptedMemoryCardActivation(continuationBrief, activationCandidates)
    ? 'Matched words from accepted memory card text.'
    : 'Matched words from the continuation brief.';
}

function selectCourtroomThreads(storyState: StoryStateSnapshot, continuationBrief: string | undefined): PlotThread[] {
  return selectScoredCourtroomThreads(storyState, continuationBrief).map(item => item.thread);
}

function selectScoredCourtroomThreads(storyState: StoryStateSnapshot, continuationBrief: string | undefined): Array<{
  thread: PlotThread;
  index: number;
  activationScore: number;
}> {
  const source = normalizeActivationText(continuationBrief);
  return getStateThreads(storyState)
    .filter(isUnresolvedThread)
    .map((thread, index) => ({
      thread,
      index,
      activationScore: scoreThreadActivation(thread, source)
    }))
    .sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))
    .slice(0, CONTINUITY_COURTROOM_MAX_THREADS);
}

function selectCourtroomArtifacts(storyState: StoryStateSnapshot, continuationBrief: string | undefined): LoreArtifact[] {
  return selectScoredCourtroomArtifacts(storyState, continuationBrief).map(item => item.artifact);
}

function selectScoredCourtroomArtifacts(storyState: StoryStateSnapshot, continuationBrief: string | undefined): Array<{
  artifact: LoreArtifact;
  index: number;
  activationScore: number;
}> {
  const source = normalizeActivationText(continuationBrief);
  return getStateArtifacts(storyState)
    .filter(artifact => !artifact.resolvedInChapter)
    .map((artifact, index) => ({
      artifact,
      index,
      activationScore: scoreArtifactActivation(artifact, source)
    }))
    .sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))
    .slice(0, CONTINUITY_COURTROOM_MAX_ARTIFACTS);
}

function scoreThreadActivation(thread: PlotThread, source: string): number {
  return scoreActivationCandidates(getThreadActivationCandidates(thread), source);
}

function getThreadActivationCandidates(thread: PlotThread): string[] {
  return [
    safeString(thread.label),
    safeString(thread.description),
    ...getThreadForeshadowedDevices(thread)
  ];
}

function scoreArtifactActivation(artifact: LoreArtifact, source: string): number {
  return scoreActivationCandidates(getArtifactActivationCandidates(artifact), source);
}

function getArtifactActivationCandidates(artifact: LoreArtifact): string[] {
  return [
    safeString(artifact.name),
    safeString(artifact.significance)
  ];
}

function selectCourtroomWarnings(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string[] {
  return selectScoredCourtroomWarnings(storyState, continuationBrief).map(item => item.warning);
}

function selectScoredCourtroomWarnings(storyState: StoryStateSnapshot, continuationBrief: string | undefined): Array<{
  warning: string;
  index: number;
  activationScore: number;
}> {
  const source = normalizeActivationText(continuationBrief);
  return getStateContinuityWarnings(storyState)
    .map((warning, index) => ({
      warning,
      index,
      activationScore: scoreWarningActivation(warning, source)
    }))
    .sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))
    .slice(0, CONTINUITY_COURTROOM_MAX_WARNINGS);
}

function scoreWarningActivation(warning: string, source: string): number {
  return scoreActivationCandidates(getWarningActivationCandidates(warning), source);
}

function getWarningActivationCandidates(warning: string): string[] {
  return [warning];
}

/**
 * Reduce a continuation brief, or one thread label, artifact name, or continuity
 * warning, to the lowercase words `scoreActivationCandidates` compares.
 *
 * Both sides of that comparison come through here, so what this deletes is
 * invisible to it. `[^a-z0-9 ]+` deleted every letter outside ASCII, which made
 * the whole activation scan unreachable for a story not written in Latin
 * script: a thread labelled `Клятва Миры` normalized to the empty string,
 * `normalizedCandidates.filter(Boolean)` dropped it, and its activation score
 * was zero however plainly the reader's brief named it. The courtroom then
 * chose which threads, artifacts, and warnings to put in front of the model by
 * story order alone — the reader asks the next batch to pay off one promise and
 * is given the first `CONTINUITY_COURTROOM_MAX_THREADS` instead — and
 * `describeActivationReason` reported "Included by unresolved-story priority"
 * for every one of them, which was at least honest about what had happened.
 *
 * A partly-Latin name failed in a way that is harder to see: `José's pact`
 * became `jos s pact`, so the whole-candidate match against the brief could
 * never fire, and the word tokens the score falls back to were `pact` and a
 * `jos` that matches nothing a reader would type.
 *
 * Matching on the Unicode properties keeps those words whole. Every retained
 * character is still a letter or a number, so the scoring below is unchanged
 * for text that was already ASCII: the separator run each unsupported character
 * used to become is exactly the separator run it becomes now.
 */
function normalizeActivationText(value: unknown): string {
  return collapseWhitespace(safeString(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUnresolvedThread(thread: PlotThread): boolean {
  return thread.status !== 'resolved';
}

function getStateThreads(storyState: StoryStateSnapshot): PlotThread[] {
  return Array.isArray((storyState as Partial<StoryStateSnapshot>).threads)
    ? (storyState as Partial<StoryStateSnapshot>).threads as PlotThread[]
    : [];
}

function getStateArtifacts(storyState: StoryStateSnapshot): LoreArtifact[] {
  return Array.isArray((storyState as Partial<StoryStateSnapshot>).artifacts)
    ? (storyState as Partial<StoryStateSnapshot>).artifacts as LoreArtifact[]
    : [];
}

function getStateCharacters(storyState: StoryStateSnapshot): CharacterProfile[] {
  return Array.isArray((storyState as Partial<StoryStateSnapshot>).characters)
    ? (storyState as Partial<StoryStateSnapshot>).characters as CharacterProfile[]
    : [];
}

function getStateContinuityWarnings(storyState: StoryStateSnapshot): string[] {
  const warnings = (storyState as Partial<StoryStateSnapshot>).continuityWarnings;
  return Array.isArray(warnings)
    ? warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
    : [];
}

function getThreadForeshadowedDevices(thread: PlotThread): string[] {
  const devices = (thread as Partial<PlotThread>).foreshadowedDevices;
  return Array.isArray(devices)
    ? devices.filter((device): device is string => typeof device === 'string' && device.trim().length > 0)
    : [];
}

function getCharacterRelationships(character: CharacterProfile): CharacterProfile['relationships'] {
  const relationships = (character as Partial<CharacterProfile>).relationships;
  return Array.isArray(relationships)
    ? relationships.filter((relationship): relationship is CharacterProfile['relationships'][number] =>
        Boolean(relationship)
        && typeof relationship === 'object'
        && typeof relationship.characterId === 'string'
        && typeof relationship.relationship === 'string'
      )
    : [];
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function formatThreadDebtLabel(thread: PlotThread): string {
  if (thread.status === 'escalating') {
    return 'Pressure rising';
  }
  if (thread.status === 'dormant') {
    return 'Quiet promise';
  }
  return 'Open promise';
}

interface RelationshipPressureSelection {
  sourceCharacter: CharacterProfile;
  targetCharacter: CharacterProfile;
  relationship: CharacterProfile['relationships'][number];
  index: number;
  activationScore: number;
}

function selectRelationshipPressure(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined
): RelationshipPressureSelection | undefined {
  const source = normalizeActivationText(continuationBrief);
  const candidates: RelationshipPressureSelection[] = [];
  const characters = getStateCharacters(storyState);

  for (const sourceCharacter of characters) {
    for (const relationship of getCharacterRelationships(sourceCharacter)) {
      const targetCharacter = characters.find(candidate => candidate.id === relationship.characterId);
      if (targetCharacter) {
        candidates.push({
          sourceCharacter,
          targetCharacter,
          relationship,
          index: candidates.length,
          activationScore: scoreRelationshipActivation(sourceCharacter, targetCharacter, relationship, source)
        });
      }
    }
  }

  return candidates.sort((left, right) => (right.activationScore - left.activationScore) || (left.index - right.index))[0];
}

function formatRelationshipPressureLine(selected: RelationshipPressureSelection): string {
  return `- Relationship pressure: ${compactPromptLine(selected.sourceCharacter.displayName)} and ${compactPromptLine(selected.targetCharacter.displayName)}.`;
}

function scoreRelationshipActivation(
  sourceCharacter: CharacterProfile,
  targetCharacter: CharacterProfile,
  relationship: CharacterProfile['relationships'][number],
  source: string
): number {
  return scoreActivationCandidates(
    getRelationshipActivationCandidates(sourceCharacter, targetCharacter, relationship),
    source
  );
}

function getRelationshipActivationCandidates(
  sourceCharacter: CharacterProfile,
  targetCharacter: CharacterProfile,
  relationship: CharacterProfile['relationships'][number]
): string[] {
  return [
    safeString(sourceCharacter.displayName),
    safeString(targetCharacter.displayName),
    safeString(relationship.relationship),
    safeString(relationship.notes)
  ];
}

function scoreActivationCandidates(candidates: unknown[], source: string): number {
  if (!source) {
    return 0;
  }

  const normalizedCandidates = candidates.map(normalizeActivationText).filter(Boolean);
  let score = 0;

  for (const candidate of normalizedCandidates) {
    if (source.includes(candidate)) {
      score += 6;
    }

    for (const token of candidate.split(' ').filter(value => value.length > 3)) {
      if (source.includes(token)) {
        score += 1;
      }
    }
  }

  return score;
}

function hasAcceptedMemoryCardActivation(continuationBrief: string | undefined, activationCandidates: string[]): boolean {
  const acceptedMemoryText = extractAcceptedMemoryCardSection(continuationBrief);
  if (!acceptedMemoryText) {
    return false;
  }

  return scoreActivationCandidates(activationCandidates, normalizeActivationText(acceptedMemoryText)) > 0;
}

function extractAcceptedMemoryCardSection(continuationBrief = ''): string {
  const acceptedHeading = 'Accepted Memory Cards:';
  const acceptedStart = continuationBrief.indexOf(acceptedHeading);
  if (acceptedStart === -1) {
    return '';
  }

  const acceptedText = continuationBrief.slice(acceptedStart + acceptedHeading.length);
  const pinnedStart = acceptedText.search(/\r?\nPinned Memory Cards:/);
  return pinnedStart === -1 ? acceptedText : acceptedText.slice(0, pinnedStart);
}

function formatCourtroomDetail(value: unknown): string {
  const detail = compactPromptLine(value);
  return detail ? ` - ${detail}` : '';
}

function compactPromptLine(value: unknown): string {
  const compacted = collapseWhitespace(safeString(value)).trim();
  if (compacted.length <= CONTINUITY_COURTROOM_MAX_DETAIL_LENGTH) {
    return compacted;
  }

  return `${compacted.slice(0, CONTINUITY_COURTROOM_MAX_DETAIL_LENGTH - 3).trim()}...`;
}

function buildChapterEndingStressTestBrief(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const selectedPressure = chooseChapterEndingPressure(storyState, continuationBrief);
  return limitGuidanceSection([
    'Chapter Ending Stress Test:',
    `- Endings: ${CHAPTER_ENDING_PRESSURES.map(pressure => pressure.candidateLabel).join(', ')}.`,
    `- Chosen: ${selectedPressure.label} - ${selectedPressure.instruction}`,
    `- Scene pressure mix: ${chooseScenePressureMix(storyState, continuationBrief, selectedPressure)}.`,
    '- Answer one question; leave one sharper.'
  ], CHAPTER_ENDING_STRESS_TEST_MAX_SECTION_LENGTH) ?? '';
}

function chooseChapterEndingPressure(storyState: StoryStateSnapshot, continuationBrief: string | undefined): ChapterEndingPressure {
  const unresolvedThreads = getStateThreads(storyState).filter(isUnresolvedThread);
  const unresolvedArtifacts = getStateArtifacts(storyState).filter(artifact => !artifact.resolvedInChapter);
  const pressureSource = buildContinuationPressureSource(storyState, continuationBrief);
  const scores: Record<ChapterEndingPressureId, number> = {
    emotional_reveal: 1,
    danger_escalation: 1,
    secret_exposed: 1
  };

  if (containsAny(pressureSource, ['love', 'kiss', 'desire', 'choose', 'confess', 'heart', 'boundary', 'want', 'betray'])) {
    scores.emotional_reveal += 2;
  }

  if (containsAny(pressureSource, ['danger', 'attack', 'threat', 'trap', 'hunt', 'deadline', 'demand', 'force', 'blood'])) {
    scores.danger_escalation += 2;
  }

  if (unresolvedThreads.some(thread => thread.status === 'escalating')) {
    scores.danger_escalation += 2;
  }

  if (containsAny(pressureSource, ['secret', 'hidden', 'truth', 'lie', 'name', 'bargain', 'debt', 'payment', 'price', 'vow'])) {
    scores.secret_exposed += 3;
  }

  if (unresolvedArtifacts.length > 0 || getStateContinuityWarnings(storyState).length > 0) {
    scores.secret_exposed += 2;
  }

  return CHAPTER_ENDING_PRESSURES.reduce((best, candidate) =>
    scores[candidate.id] > scores[best.id] ? candidate : best
  );
}

function chooseScenePressureMix(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined,
  selectedPressure: ChapterEndingPressure
): string {
  const primary = mapEndingPressureToScenePressure(selectedPressure.id);
  const pressureSource = buildContinuationPressureSource(storyState, continuationBrief);
  const secondaryCandidates: ScenePressureLabel[] = [];

  if (containsAny(pressureSource, ['deadline', 'clock', 'tonight', 'hour', 'sunrise'])) {
    secondaryCandidates.push('Deadline');
  }

  if (getStateArtifacts(storyState).some(artifact => !artifact.resolvedInChapter)
    || containsAny(pressureSource, ['court', 'room', 'place', 'reef', 'shell', 'song', 'door', 'hall'])) {
    secondaryCandidates.push('Setting');
  }

  if (getStateCharacters(storyState).length > 1
    || containsAny(pressureSource, ['family', 'crowd', 'witness', 'lord', 'queen', 'council'])) {
    secondaryCandidates.push('Social');
  }

  if (containsAny(pressureSource, ['secret', 'hidden', 'truth', 'lie', 'bargain', 'debt', 'payment', 'price', 'vow'])) {
    secondaryCandidates.push('Secret');
  }

  if (containsAny(pressureSource, ['love', 'kiss', 'desire', 'choose', 'confess', 'heart', 'betray'])) {
    secondaryCandidates.push('Emotional');
  }

  const secondary = secondaryCandidates.find(candidate => candidate !== primary)
    ?? (primary === 'Setting' ? 'Social' : 'Setting');
  return `${primary} + ${secondary}; ${chooseScenePressureVariant(storyState, continuationBrief, primary, secondary)}`;
}

function mapEndingPressureToScenePressure(pressureId: ChapterEndingPressureId): ScenePressureLabel {
  if (pressureId === 'emotional_reveal') {
    return 'Emotional';
  }
  if (pressureId === 'danger_escalation') {
    return 'Deadline';
  }
  return 'Secret';
}

function chooseScenePressureVariant(
  storyState: StoryStateSnapshot,
  continuationBrief: string | undefined,
  primary: ScenePressureLabel,
  secondary: ScenePressureLabel
): string {
  const variants = SCENE_PRESSURE_VARIANTS[secondary];
  const seed = `${storyState.storyId}|${storyState.revision}|${continuationBrief ?? ''}|${primary}|${secondary}`;
  return variants[stableSeedIndex(seed, variants.length)] ?? variants[0];
}

function stableSeedIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (const char of seed) {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

/**
 * Every word the pressure scans below look for, and the forms of it they count.
 *
 * The scans read `buildContinuationPressureSource` — the unresolved threads'
 * labels and descriptions, the unresolved artifacts' names and significance,
 * the continuity warnings, and the continuation brief — and what they decide
 * goes into the continuation prompt: which of the three chapter-ending
 * pressures the next chapter is told to end on, which pair of scene pressures
 * it is told to work in, and which cliche the Cliche Alarm tells it to avoid.
 *
 * `containsAny` was `value.includes(needle)`, and these needles are short. That
 * is the substring scan `extractThemesFromContent` and
 * `extractSpicyLevelFromContent` were both moved off, arriving here through the
 * one door nobody had checked, and the collisions are the same kind:
 *
 * - **`lie` is inside `courtier`**, and also inside `earlier`, `relief`,
 *   `believed`, `soldier`, and `chandelier`. It is worth `+3` to
 *   `secret_exposed`, the largest single weight in `chooseChapterEndingPressure`
 *   and on its own enough to beat a fully scored `emotional_reveal` — so a
 *   court-intrigue saga, which is the app's own third theme seed and whose
 *   prose says `courtiers` as a matter of course, was told to end on an exposed
 *   secret whatever the chapter was actually about.
 * - **`heart` is inside `hearth`**, the exact collision
 *   `extractSpicyLevelFromContent`'s own note names.
 * - **`hall` is inside `shall` and `challenge`**, so `Setting` was offered to
 *   the scene pressure mix by any state that merely used the word `shall`.
 * - **`want` is inside `unwanted`** and **`price` is inside `priceless`** —
 *   both of which read as the opposite of the beat they were credited to.
 * - **`force` is inside `enforce`**, **`trap` inside `strapped`**, **`room`
 *   inside `groom`**, **`lord` inside `landlord`**, **`vow` inside `vowel`**,
 *   **`secret` inside `secretary`**, **`name` inside `nameless`**.
 *
 * So the forms are spelled out and matched as whole words, which is the same
 * repair and the same reading `containsWholeWord` in `storyContentAnalysis`
 * already applies. The inflections the substring form picked up for free —
 * `dangerous` for `danger`, `threatening` for `threat`, `betrayal` for
 * `betray`, `hunters` for `hunt`, `confession` for `confess` — are listed
 * rather than lost, so the repair does not quietly cost the scans the matches
 * they got right. What is not carried over is the rest of what the substrings
 * caught: the collisions above, and the compounds (`bloodline`, `courtyard`,
 * `bedroom`, `clockwork`, `hourglass`) where the compound is its own word
 * rather than an inflection of the one being looked for.
 *
 * Keying the table by the words the call sites use, and typing those sites
 * against it, is what stops a keyword being added below without a decision
 * being made here about what counts as that word — the same guarantee
 * `extractThemesFromContent` gets from keying its table by `ThemeType`.
 */
const PRESSURE_KEYWORD_FORMS = {
  attack: ['attack', 'attacks', 'attacked', 'attacking'],
  bargain: ['bargain', 'bargains', 'bargained', 'bargaining'],
  betray: ['betray', 'betrays', 'betrayed', 'betraying', 'betrayal', 'betrayals'],
  blood: ['blood', 'bloodied', 'bloody'],
  boundary: ['boundary', 'boundaries'],
  choose: ['choose', 'chooses', 'choosing', 'chose', 'chosen'],
  clock: ['clock', 'clocks'],
  confess: ['confess', 'confesses', 'confessed', 'confessing', 'confession', 'confessions'],
  council: ['council', 'councils'],
  court: ['court', 'courts', 'courtier', 'courtiers'],
  crowd: ['crowd', 'crowds', 'crowded'],
  danger: ['danger', 'dangers', 'dangerous', 'dangerously'],
  deadline: ['deadline', 'deadlines'],
  debt: ['debt', 'debts'],
  demand: ['demand', 'demands', 'demanded', 'demanding'],
  desire: ['desire', 'desires', 'desired', 'desiring'],
  door: ['door', 'doors', 'doorway', 'doorways'],
  family: ['family', 'families'],
  force: ['force', 'forces', 'forced', 'forcing'],
  heart: ['heart', 'hearts'],
  hidden: ['hidden'],
  hour: ['hour', 'hours'],
  hunt: ['hunt', 'hunts', 'hunted', 'hunting', 'hunter', 'hunters'],
  kiss: ['kiss', 'kisses', 'kissed', 'kissing'],
  lie: ['lie', 'lies', 'lied', 'lying'],
  lord: ['lord', 'lords'],
  love: ['love', 'loves', 'loved', 'loving', 'lover', 'lovers'],
  name: ['name', 'names', 'named', 'naming'],
  payment: ['payment', 'payments'],
  place: ['place', 'places', 'placed'],
  price: ['price', 'prices', 'priced'],
  queen: ['queen', 'queens'],
  reef: ['reef', 'reefs'],
  room: ['room', 'rooms'],
  secret: ['secret', 'secrets', 'secretly'],
  shell: ['shell', 'shells'],
  song: ['song', 'songs'],
  sunrise: ['sunrise'],
  threat: ['threat', 'threats', 'threaten', 'threatens', 'threatened', 'threatening'],
  tonight: ['tonight'],
  trap: ['trap', 'traps', 'trapped', 'trapping'],
  truth: ['truth', 'truths', 'truthful'],
  hall: ['hall', 'halls'],
  vow: ['vow', 'vows', 'vowed'],
  want: ['want', 'wants', 'wanted', 'wanting'],
  witness: ['witness', 'witnesses', 'witnessed']
} as const satisfies Record<string, readonly string[]>;

type PressureKeyword = keyof typeof PRESSURE_KEYWORD_FORMS;

/**
 * One compiled alternation per keyword, built once at module load.
 *
 * `containsAny` runs eleven times per continuation, and building a `RegExp` per
 * call would recompile the same handful of patterns on every one of them. The
 * source is already lowercased by `buildContinuationPressureSource`, so no
 * case-insensitive flag is needed — the same arrangement `containsWholeWord`
 * relies on.
 */
const PRESSURE_KEYWORD_PATTERNS = new Map<PressureKeyword, RegExp>(
  (Object.entries(PRESSURE_KEYWORD_FORMS) as Array<[PressureKeyword, readonly string[]]>)
    .map(([keyword, forms]) => [keyword, new RegExp(String.raw`\b(?:${forms.join('|')})\b`)])
);

function containsAny(value: string, needles: readonly PressureKeyword[]): boolean {
  return needles.some(needle => PRESSURE_KEYWORD_PATTERNS.get(needle)?.test(value) === true);
}

function buildContinuationPressureSource(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const unresolvedThreads = getStateThreads(storyState).filter(isUnresolvedThread);
  const unresolvedArtifacts = getStateArtifacts(storyState).filter(artifact => !artifact.resolvedInChapter);
  return [
    continuationBrief ?? '',
    ...unresolvedThreads.flatMap(thread => [
      safeString(thread.label),
      safeString(thread.description),
      ...getThreadForeshadowedDevices(thread)
    ]),
    ...unresolvedArtifacts.map(artifact => `${safeString(artifact.name)} ${safeString(artifact.significance)}`),
    ...getStateContinuityWarnings(storyState)
  ].join(' ').toLowerCase();
}

function buildClicheAlarmBrief(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  return limitGuidanceSection([
    'Cliche Alarm:',
    `- Avoid: ${chooseClicheAlarmPath(storyState, continuationBrief)}`,
    `- Freshness: turn ${chooseFreshnessTarget(storyState)} with visible cost.`,
    `- Subtext receipt: prove ${chooseSubtextReceiptTarget(storyState, continuationBrief)} by behavior before explanation.`
  ], CLICHE_ALARM_MAX_SECTION_LENGTH) ?? '';
}

function chooseClicheAlarmPath(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const source = buildContinuationPressureSource(storyState, continuationBrief);
  if (containsAny(source, ['debt', 'payment', 'price', 'bargain', 'vow', 'court', 'demand'])) {
    return 'formal demand with no personal cost.';
  }

  if (containsAny(source, ['love', 'kiss', 'desire', 'choose', 'confess', 'heart', 'want'])) {
    return 'confession of what they already know.';
  }

  if (containsAny(source, ['danger', 'attack', 'threat', 'trap', 'hunt', 'deadline', 'force', 'blood'])) {
    return 'threat that changes no relationship.';
  }

  return 'repeat of the last chapter without new cost.';
}

function chooseFreshnessTarget(storyState: StoryStateSnapshot): string {
  const threads = getStateThreads(storyState);
  const thread = threads.find(candidate => candidate.status === 'escalating')
    ?? threads.find(candidate => candidate.status === 'active')
    ?? threads.find(isUnresolvedThread);
  if (thread) {
    return compactPromptLine(thread.label);
  }

  const artifact = getStateArtifacts(storyState).find(candidate => !candidate.resolvedInChapter);
  if (artifact) {
    return compactPromptLine(artifact.name);
  }

  return 'the most recent unresolved choice';
}

function chooseSubtextReceiptTarget(storyState: StoryStateSnapshot, continuationBrief: string | undefined): string {
  const relationshipPressure = selectRelationshipPressure(storyState, continuationBrief);
  if (relationshipPressure) {
    return `${compactPromptLine(relationshipPressure.sourceCharacter.displayName)} and ${compactPromptLine(relationshipPressure.targetCharacter.displayName)}`;
  }

  return chooseFreshnessTarget(storyState);
}

/**
 * Drop the "Accepted Memory Cards:"/"Pinned Memory Cards:" sections a
 * continuation brief carries for the model, so a suggested-next-prompt built
 * from the brief doesn't echo that internal bookkeeping back to the reader.
 */
export function stripStoryMemoryCardSections(continuationBrief: string | undefined): string | undefined {
  const lines = continuationBrief?.split(/\r?\n/) ?? [];
  const publicLines: string[] = [];

  for (const line of lines) {
    if (line === 'Accepted Memory Cards:' || line === 'Pinned Memory Cards:') {
      break;
    }
    publicLines.push(line);
  }

  const publicBrief = publicLines.join('\n').trim();
  return publicBrief || undefined;
}
