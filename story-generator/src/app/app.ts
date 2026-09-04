import { CommonModule } from '@angular/common';
import { Component, OnDestroy, SecurityContext, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, map, timer } from 'rxjs';
import {
  createBrowserHtmlDownloadHost,
  dataUriToBlob,
  downloadBlob,
  downloadHtmlDocument
} from '../../../shared/htmlDocumentDownload';
import {
  formatThreadDebtLabel,
  normalizeActivationText,
  scoreActivationCandidates
} from '../../../shared/continuityActivation';
import { buildStoryDownloadFilename } from '../../../shared/storyDownloadFilename';
import { STORY_LAB_THEME_SEEDS } from '../../../shared/storyLabThemeSeeds';
import { stripStoryHtmlToText } from '../../../shared/storyTextBlocks';
import { isVocabularyMember } from '../../../shared/storyStateVocabulary';
import { buildStoryHtmlDocument } from './story-html-exporter';
import { BlueprintValidationField, FormValidationService } from './form-validation.service';
import { AcceptedMemoryCardEditDraft, MemoryCardDraftItem, MemoryCardService } from './memory-card.service';
import { CREATURE_ARCHETYPES, readCreatureDisplayName } from '../../../shared/creatureVocabulary';
import {
  AudioConversionSeam,
  BatchProgressState,
  CHAPTER_BATCH_SIZES,
  ChapterBatchSize,
  ChapterTimelineEntry,
  CharacterProfile,
  CloudLibrarySyncState,
  CloudStoryProjectListItem,
  ContinuityPanelViewModel,
  CreatureArchetype,
  EXPORT_FORMATS,
  ExportFormat,
  GeneratedChapter,
  HEAT_INTIMACY_BOUNDARIES,
  HEAT_TENSION_MODES,
  HeatContract,
  HeatIntimacyBoundary,
  HeatTensionMode,
  IMAGE_STYLES,
  ImageGenerationSeam,
  ImageStyle,
  NARRATIVE_TONES,
  NarrativeTone,
  PlotThread,
  RELATIONSHIP_KINDS,
  RelationshipEdge,
  RelationshipKind,
  SPICY_LEVELS,
  SavedStoryProject,
  SpicyLevel,
  StoryMemoryLifetime,
  StoryMemoryCard,
  StoryBlueprint,
  StoryIterationPayload,
  StoryLabGenerationJobKind,
  StoryLabJob,
  StoryLabJobStatus,
  STORY_LAB_JOB_STEP_LABELS,
  StoryWorkbenchSession,
  ThemeSeed,
  WORD_BUDGETS,
  WordBudget,
  isStoryLabJobStep,
  isTerminalStoryLabJobStatus
} from './contracts';
import { StoryService } from './story.service';
import { AuthService } from './auth.service';
import { StoryWorkspaceStorageService } from './story-workspace-storage.service';
import { ErrorLoggingService } from './error-logging';
import { DebugPanel } from './debug-panel/debug-panel';
import { ErrorDisplayComponent } from './error-display/error-display';
import { NotificationService } from './notification.service';
import { NotificationsComponent } from './notifications.component';

type BlueprintForm = StoryBlueprint & {
  chapterBatchSize: ChapterBatchSize;
  narrativeDirectives?: string;
};

type ChapterGroupViewModel = {
  id: number;
  label: string;
  chapters: GeneratedChapter[];
};

type StorySkinId = 'bookshop' | 'conservatory' | 'writing-desk';

type StorySkinOption = {
  id: StorySkinId;
  label: string;
  mood: string;
};

type CreatureOption = {
  id: CreatureArchetype;
  label: string;
  description: string;
};

type SpiceOption = {
  level: SpicyLevel;
  label: string;
  description: string;
};

type HeatContractOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};

type ContinuationDirection = {
  label: string;
  brief: string;
};

type ChoiceOption<TId extends string | number> = {
  id: TId;
  label: string;
};

/**
 * The words this form puts in front of the reader for each value of a closed
 * vocabulary — and nothing else.
 *
 * Every picker below used to be a hand-written array of `{ id, label,
 * description }`, which made the array two things at once: the copy that says
 * what a `vampire` is called, and a second declaration of *which* creatures
 * there are. The second one is the problem. `CREATURE_ARCHETYPES`,
 * `NARRATIVE_TONES`, `SPICY_LEVELS`, `WORD_BUDGETS`, `CHAPTER_BATCH_SIZES`,
 * `HEAT_TENSION_MODES`, and `HEAT_INTIMACY_BOUNDARIES` are the vocabularies the
 * API's parser refuses a blueprint against and `FormValidationService` checks
 * this form's own state against — `shared/creatureVocabulary` and the tables in
 * `contracts.ts` exist precisely so those two readers cannot disagree — and the
 * screen that decides what a reader can actually send was not one of the
 * readers.
 *
 * A value added to a vocabulary therefore reached the type, the validator, the
 * route, the prompt builders, and the log filter, and stopped at the picker:
 * the new creature, tone, or word budget is accepted everywhere and offered
 * nowhere, with nothing to fail and nothing on the page to say it is missing.
 * Typing the copy as a total `Record` over the vocabulary is what turns that
 * into a compile error — TypeScript refuses a record missing a key — and
 * mapping the picker over the table rather than over the record's own keys is
 * what keeps the offered order the vocabulary's.
 *
 * The `label`s below are the ones this form already showed, transcribed
 * unchanged; the creature labels are dropped entirely in favour of
 * `readCreatureDisplayName`, which is the title-cased id every one of them
 * already was.
 */
const CREATURE_DESCRIPTIONS: Record<CreatureArchetype, string> = {
  vampire: 'Immortal desire, old secrets, dangerous elegance.',
  werewolf: 'Pack bonds, moonlit hunger, protective intensity.',
  fairy: 'Fae bargains, beautiful traps, glittering menace.',
  siren: 'Songs, saltwater vows, temptation with teeth.',
  djinn: 'Wishes, bargains, heat shimmer magic.',
  witch: 'Spellwork, grimoires, familiar old power.',
  dragon: 'Treasure, pride, scale-deep obsession.',
  demon: 'Temptation, contracts, wicked devotion.',
  angel: 'Forbidden grace, falling, sacred desire.',
  mermaid: 'Tides, curses, pearl-lit longing.'
};

const SPICE_LEVEL_COPY: Record<SpicyLevel, { label: string; description: string }> = {
  1: { label: 'Storybook Romance', description: 'Longing, flirtation, no explicit detail.' },
  2: { label: 'Warm', description: 'Kissing, sensual tension, restrained heat.' },
  3: { label: 'Spicy', description: 'Adult heat, literary, fade-to-black before graphic detail.' },
  4: { label: 'Very Spicy', description: 'Explicit consensual intimacy with emotional stakes.' },
  5: { label: 'Inferno', description: 'Maximum explicit consensual adult fantasy.' }
};

const HEAT_TENSION_COPY: Record<HeatTensionMode, { label: string; description: string }> = {
  slow_burn: { label: 'Slow burn', description: 'Longing, restraint, charged pauses.' },
  dangerous_proximity: { label: 'Danger close', description: 'Threat, protection, forced proximity.' },
  playful_banter: { label: 'Banter', description: 'Teasing, challenge, mischief.' },
  devotional_longing: { label: 'Devotion', description: 'Reverence, sacrifice, tenderness.' }
};

const HEAT_BOUNDARY_COPY: Record<HeatIntimacyBoundary, { label: string; description: string }> = {
  fade_to_black: { label: 'Fade to black', description: 'Build heat, close the door early.' },
  closed_door: { label: 'Closed door', description: 'Romance stays implied off-page.' },
  literary_on_page: { label: 'Literary on-page', description: 'Consensual heat with polished language.' }
};

const NARRATIVE_TONE_LABELS: Record<NarrativeTone, string> = {
  romance: 'Romance',
  dark_romance: 'Dark Romance',
  mystery: 'Mystery',
  adventure: 'Adventure',
  comedy: 'Comedy',
  tragedy: 'Tragedy'
};

/**
 * The four word budgets under the names the "Chapter length" picker gives them.
 *
 * These were `<option [ngValue]="600">Short</option>` and three more like it,
 * written straight into the template — the copy `contracts.ts` names in the
 * note on `WORD_BUDGETS` ("restated ... a fourth in the template's `<option>`
 * values") and the one that change did not reach, because a template is not a
 * reader a `satisfies` clause can check.
 */
const WORD_BUDGET_LABELS: Record<WordBudget, string> = {
  600: 'Short',
  900: 'Medium',
  1200: 'Long',
  1500: 'Lush'
};

type NarrativeDialId = 'villain-pressure' | 'chapter-payload' | 'pacing' | 'ending-bet';

type NarrativeDialOption = {
  id: string;
  label: string;
  description: string;
  brief: string;
};

type NarrativeDialOptionDefinition<TId extends string = string> = readonly [
  id: TId,
  label: string,
  description: string,
  brief: string
];

type NarrativeDial = {
  id: NarrativeDialId;
  label: string;
  options: NarrativeDialOption[];
};

type NarrativeDialViewModel = NarrativeDial & {
  selectedOptionId: string;
  selectedDescription: string;
  selectedBrief: string;
};

type SelectedNarrativeDialOptions = Record<NarrativeDialId, string>;

/** See `App.captureCloudRequestIdentity`'s own comment. */
type CloudRequestIdentity = {
  signedIn: boolean;
  accountId: string | null;
  sessionEpoch: number;
};

type VillainPressureId = 'antagonist' | 'environment' | 'secret' | 'deadline' | 'inner-desire';

type VillainPressureOption = NarrativeDialOption & {
  id: VillainPressureId;
};

function defineNarrativeDialOptions<TId extends string>(
  definitions: readonly NarrativeDialOptionDefinition<TId>[]
): Array<NarrativeDialOption & { id: TId }> {
  return definitions.map(([id, label, description, brief]) => ({ id, label, description, brief }));
}

function defineNarrativeDial(
  id: NarrativeDialId,
  label: string,
  options: NarrativeDialOption[]
): NarrativeDial {
  return { id, label, options };
}

type DirectorRoomNoteId = 'desire-ledger' | 'continuity-keeper' | 'chapter-ending';

type DirectorRoomNoteStatus = 'pending' | 'accepted' | 'dismissed';

type DirectorRoomNote = {
  id: DirectorRoomNoteId;
  title: string;
  focus: string;
  suggestion: string;
  continuationBrief: string;
  status: DirectorRoomNoteStatus;
  chapterId: string;
};

type ContinuityPreviewItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  sourceReason: string;
  lifetimeLabel?: string;
};

type ContinuityPreviewSelection<T> = {
  item: T;
  matched: boolean;
};

type GenerationProgressState = {
  active: boolean;
  percent: number;
  stage: string;
  elapsedSeconds: number;
};

const BATCH_STATUS_LABELS: Record<BatchProgressState['status'], string> = {
  queued: 'Queued',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed'
};

function isBatchProgressStatus(status: unknown): status is BatchProgressState['status'] {
  return typeof status === 'string' && Object.prototype.hasOwnProperty.call(BATCH_STATUS_LABELS, status);
}

/**
 * How long a thread or artifact is expected to matter, as the continuity panel
 * says it. Total over `STORY_MEMORY_LIFETIMES` — see
 * `formatStoryMemoryLifetimeLabel`.
 */
const STORY_MEMORY_LIFETIME_LABELS: Record<StoryMemoryLifetime, string> = {
  scene: 'Scene memory',
  chapter: 'Chapter memory',
  series: 'Series memory'
};

/**
 * What each relationship kind asks of the next scene, for an edge the model
 * wrote no note on. Total over `RELATIONSHIP_KINDS` — see
 * `formatRelationshipPreviewDetail`.
 */
const RELATIONSHIP_PRESSURE_DETAILS: Record<RelationshipKind, string> = {
  lover: 'Want has a cost in the next scene.',
  rival: 'Opposition should change what someone risks.',
  ally: 'Trust should require an action.',
  family: 'Loyalty should complicate the next choice.',
  unknown: 'This connection should change the next scene.'
};

/** The devices a thread planted, read the way the guidance builder reads them. */
function readThreadForeshadowedDevices(thread: PlotThread): string[] {
  const devices = (thread as Partial<PlotThread>).foreshadowedDevices;
  return Array.isArray(devices)
    ? devices.filter((device): device is string => typeof device === 'string' && device.trim().length > 0)
    : [];
}

/**
 * Read a character's relationship edges before the panel dereferences them.
 *
 * `CharacterProfile.relationships` is typed `RelationshipEdge[]`, and the
 * extractor now checks each entry against that type before storing it — but the
 * type is a promise about new state, not about state that already exists.
 * `mergeCharacters` asserted the model's array into the type for as long as this
 * app has had a continuity panel, so a saved project or a cloud-stored snapshot
 * written before that fix can still hand this component an array holding `null`,
 * a bare name string, or an object with no `characterId` on it.
 *
 * `buildContinuityRelationshipPreviewItem` reads `relationship.characterId` off
 * every entry, so a `null` among them is a `TypeError` thrown while rendering —
 * not a missing preview line but a continuity panel that does not draw, on a
 * story the reader can still see the chapters of. The API tree has read the same
 * array through a filter for exactly this reason: `getCharacterRelationships` in
 * `continuationGuidance.ts` re-checks object, `characterId`, and `relationship`
 * on every read. This is that guard, on the reader that did not have one.
 *
 * The kind is checked against `RELATIONSHIP_KINDS` rather than against `typeof
 * === 'string'`, which is what both readers were doing and what the writer
 * stopped doing when the vocabulary got a table. That split had a cost of its
 * own: `edge.relationship` was *declared* `RelationshipKind` and could hold any
 * string at all, so `formatRelationshipPreviewDetail` below — which switches on
 * exactly the five the union lists — received `"mentor"` from a snapshot written
 * before the writer's check and had a total table's worth of nothing to say
 * about it. TypeScript reports none of it, because the assertion this guard is
 * written with is the thing that made the promise.
 *
 * An unrecognised kind normalizes to `'unknown'` rather than dropping the edge,
 * which is what that member of the vocabulary is for. A model that answered
 * `"mentor"` still named two characters and wrote a note about them; the kind is
 * the part it got wrong, and discarding the pair along with it would lose a
 * relationship the story really has from a panel whose whole job is to show
 * them.
 */
function readRelationshipEdges(character: CharacterProfile): RelationshipEdge[] {
  const relationships = (character as Partial<CharacterProfile>).relationships;
  if (!Array.isArray(relationships)) {
    return [];
  }

  return relationships.flatMap(edge => {
    if (!edge || typeof edge !== 'object' || typeof edge.characterId !== 'string') {
      return [];
    }

    return [{
      characterId: edge.characterId,
      relationship: isVocabularyMember(RELATIONSHIP_KINDS, edge.relationship) ? edge.relationship : 'unknown',
      notes: typeof edge.notes === 'string' ? edge.notes : ''
    }];
  });
}

type JobStatusPanelState = {
  visible: boolean;
  kind: StoryLabGenerationJobKind;
  tone: 'starting' | 'running';
  label: string;
  title: string;
  description: string;
  progressPercent: number;
  stage: string;
  jobId?: string;
  statusPath?: string;
  startedAt?: string;
  durabilityWarning?: string;
};

type ContinuationJobResult = StoryIterationPayload & { appendedChapterNumbers: number[] };

/**
 * How long a job may stay non-terminal before the reader is told it failed
 * rather than watching a progress bar with nothing behind it forever.
 *
 * A watchdog on the whole watch, not on any single request: the job event
 * stream (`StoryService.streamStoryLabJobEvents`) reconnects on its own, so
 * there is no per-request timeout to bound the way the old poll loop bounded
 * each status request — only "has this job reached a terminal snapshot
 * within the overall budget."
 */
const STORY_LAB_JOB_POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * The copy that told genesis and continuation apart in what used to be three
 * pairs of near-identical methods (`handle{Genesis,Continuation}JobSnapshot`,
 * `open{Genesis,Continuation}JobEventStream`, `fail{Genesis,Continuation}Job`).
 * Collecting it here is what let those six methods become two, parameterized
 * by `kind` — every other line between the genesis and continuation versions
 * was already identical.
 */
const JOB_KIND_COPY: Record<
  StoryLabGenerationJobKind,
  {
    incompletePayloadMessage: string;
    completedStatusMessage: string;
    completedNotificationTitle: string;
    completedNotificationMessage: (chapterCount: number) => string;
    defaultFailedMessage: string;
    cancelledMessage: string;
    streamErrorMessage: string;
    pollTimeoutMessage: string;
    failedNotificationTitle: string;
  }
> = {
  genesis: {
    incompletePayloadMessage: 'Story generation finished without a story payload. Please try again.',
    completedStatusMessage: 'Your first chapter is ready. Choose where the story goes next.',
    completedNotificationTitle: 'Genesis complete',
    completedNotificationMessage: chapterCount => `Generated ${chapterCount} chapter${chapterCount === 1 ? '' : 's'}.`,
    defaultFailedMessage: 'Story generation failed. Please try again in a moment.',
    cancelledMessage: 'Story generation was cancelled before it finished.',
    streamErrorMessage: 'Story generation updates stopped. Please try again in a moment.',
    pollTimeoutMessage: 'Story generation is taking longer than expected. Please try again in a moment.',
    failedNotificationTitle: 'Generation failed'
  },
  continuation: {
    incompletePayloadMessage: 'Continuation finished without a valid story payload. Please try again.',
    completedStatusMessage: 'Continuation batch ready. Select a chapter to explore.',
    completedNotificationTitle: 'Continuation ready',
    completedNotificationMessage: chapterCount => `Added ${chapterCount} chapter${chapterCount === 1 ? '' : 's'} to the saga.`,
    defaultFailedMessage: 'Continuation failed. Your existing chapters are still available.',
    cancelledMessage: 'Continuation was cancelled before it finished.',
    streamErrorMessage: 'Continuation updates stopped. Your existing chapters are still available.',
    pollTimeoutMessage: 'Continuation is taking longer than expected. Your existing chapters are still available.',
    failedNotificationTitle: 'Continuation failed'
  }
};

@Component({
  selector: 'app-story-lab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NotificationsComponent, DebugPanel, ErrorDisplayComponent],
  // Component-scoped rather than root-provided — see MemoryCardService's
  // own doc comment for why a root singleton would leak memory-card state
  // across navigations away from and back to this component.
  providers: [MemoryCardService],
  templateUrl: './app.html',
  styleUrls: ['./app.css', './app-reader-library.css']
})
export class App implements OnDestroy {
  private readonly storyService = inject(StoryService);
  private readonly authService = inject(AuthService);
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly formValidation = inject(FormValidationService);
  private readonly notificationService = inject(NotificationService);
  private readonly workspaceStorage = inject(StoryWorkspaceStorageService);
  private readonly memoryCardService = inject(MemoryCardService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private batchIdSequence = 0;
  private readonly skinStorageKey = 'fairytales_story_lab_skin_v1';
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private progressStartedAt = 0;
  private jobDrivenProgress = false;
  private jobCreationSubscription: Subscription | null = null;
  private jobEventSubscription: Subscription | null = null;
  private cloudLibrarySubscription: Subscription | null = null;

  readonly skinOptions: StorySkinOption[] = [
    { id: 'bookshop', label: 'Enchanted Bookshop', mood: 'Warm, nostalgic, whimsical' },
    { id: 'conservatory', label: 'Moonlit Conservatory', mood: 'Romantic, mysterious, gothic' },
    { id: 'writing-desk', label: 'Cozy Witchy Writing Desk', mood: 'Intimate, earthy, creative' }
  ];

  // Built from the vocabulary tables rather than restated — see the copy
  // records above for what a picker that declares its own vocabulary costs.
  readonly creatureOptions: CreatureOption[] = CREATURE_ARCHETYPES.map(id => ({
    id,
    label: readCreatureDisplayName(id),
    description: CREATURE_DESCRIPTIONS[id]
  }));

  // Read from the shared seed list rather than restated here. These ids do not
  // stay in the browser: they travel to `/api/image/generate`, `/api/export/save`,
  // and the Story Lab routes, where server-side tables have to recognise them —
  // and every one of those tables was first written against the classic
  // `ThemeType` vocabulary instead, because this list had one copy and no
  // reader on the other side of the seam could see it.
  readonly availableThemes: ThemeSeed[] = STORY_LAB_THEME_SEEDS.map(seed => ({ ...seed }));

  readonly spiceOptions: SpiceOption[] = SPICY_LEVELS.map(level => ({
    level,
    ...SPICE_LEVEL_COPY[level]
  }));

  readonly heatTensionOptions: HeatContractOption<HeatTensionMode>[] = HEAT_TENSION_MODES.map(id => ({
    id,
    ...HEAT_TENSION_COPY[id]
  }));

  readonly heatBoundaryOptions: HeatContractOption<HeatIntimacyBoundary>[] = HEAT_INTIMACY_BOUNDARIES.map(id => ({
    id,
    ...HEAT_BOUNDARY_COPY[id]
  }));

  /**
   * The three vocabularies the template used to write out as `<option>`s.
   *
   * A `<select>`'s options are the whole of what a reader may choose, so these
   * were the same second declaration the arrays above were, one layer further
   * from anything that could check them: a tone added to `NARRATIVE_TONES` is
   * accepted by the parser and by `FormValidationService`, and a form built out
   * of six hand-written `<option>` elements would never offer it.
   *
   * The batch sizes need no copy table — "1 chapter", "2 chapters" is the
   * number and a plural — so their labels are built from the value itself.
   */
  readonly toneOptions: ChoiceOption<NarrativeTone>[] = NARRATIVE_TONES.map(id => ({
    id,
    label: NARRATIVE_TONE_LABELS[id]
  }));

  readonly wordBudgetOptions: ChoiceOption<WordBudget>[] = WORD_BUDGETS.map(id => ({
    id,
    label: WORD_BUDGET_LABELS[id]
  }));

  readonly chapterBatchOptions: ChoiceOption<ChapterBatchSize>[] = CHAPTER_BATCH_SIZES.map(id => ({
    id,
    label: `${id} chapter${id === 1 ? '' : 's'}`
  }));

  readonly continuationDirections: ContinuationDirection[] = [
    { label: 'Deepen the romance', brief: 'Deepen the romantic tension and make the emotional stakes more intimate.' },
    { label: 'Raise the danger', brief: 'Raise the external danger and force the characters into a sharper choice.' },
    { label: 'Reveal a secret', brief: 'Reveal a secret that changes how the previous chapter should be understood.' },
    { label: 'Add a twist', brief: 'Add a twist that complicates the romance without breaking continuity.' },
    { label: 'Slow down and linger', brief: 'Slow down for atmosphere, longing, and character intimacy before the next plot turn.' }
  ];

  readonly villainPressureOptions: VillainPressureOption[] = defineNarrativeDialOptions<VillainPressureId>([
    ['antagonist', 'Antagonist', 'Make the rival or villain act directly.', 'Villain Pressure: Let the antagonist directly raise the cost of the next choice.'],
    ['environment', 'Environment', 'Make the setting itself push back.', 'Villain Pressure: Let the environment itself become dangerous and force a decision.'],
    ['secret', 'Secret', 'Let hidden truth create pressure.', 'Villain Pressure: Let a secret create pressure before anyone fully explains it.'],
    ['deadline', 'Deadline', 'Put the scene under a clock.', 'Villain Pressure: Put the characters under a tight deadline that makes delay costly.'],
    ['inner-desire', 'Inner Desire', 'Make want itself the problem.', 'Villain Pressure: Let inner desire pressure the character into a dangerous choice.']
  ]);

  readonly chapterPayloadOptions: NarrativeDialOption[] = defineNarrativeDialOptions([
    ['romance', 'More romance', 'Put desire under pressure.', 'Chapter Payload: Put desire under pressure and reveal it through behavior, restraint, jealousy, protection, or sacrifice.'],
    ['danger', 'More danger', 'Move the threat close enough that it changes what the characters do next.', 'Chapter Payload: Move the threat close enough that it changes what the characters do next.'],
    ['lore', 'More lore', 'Reveal one world rule and make it personal.', 'Chapter Payload: Reveal one rule of the world, but make it personal and costly.'],
    ['intimacy', 'More intimacy', 'Deepen trust, vulnerability, or consent.', 'Chapter Payload: Deepen trust, vulnerability, or consent through behavior rather than explanation.'],
    ['plot', 'More plot', 'Change the situation in a way nobody can ignore.', 'Chapter Payload: Change the situation in a concrete way that nobody can ignore.']
  ]);

  readonly pacingOptions: NarrativeDialOption[] = defineNarrativeDialOptions([
    ['linger', 'Linger', 'Slow down for texture, longing, and consequence.', 'Pacing: Linger on texture, longing, and consequence before the next turn.'],
    ['balanced', 'Balanced', 'Move plot and emotion together.', 'Pacing: Balance external movement with emotional consequence.'],
    ['escalate', 'Escalate', 'Make each beat cost more than the last.', 'Pacing: Escalate so each beat costs more than the last.'],
    ['sprint', 'Sprint', 'Drive hard toward a cliffhanger.', 'Pacing: Sprint toward a cliffhanger without skipping the emotional cost.']
  ]);

  readonly endingBetOptions: NarrativeDialOption[] = defineNarrativeDialOptions([
    ['revelation', 'Revelation', 'End by making hidden truth visible.', 'Ending Bet: Build the ending around a revelation that changes what came before.'],
    ['betrayal', 'Betrayal', 'End where trust breaks or appears to break.', 'Ending Bet: Build the ending around betrayal, and let behavior make the rupture land.'],
    ['impossible-choice', 'Impossible choice', 'End with no clean option left.', 'Ending Bet: Build the ending around an impossible choice with no clean escape.'],
    ['arrival', 'Arrival', 'End with someone or something entering too late.', 'Ending Bet: End with an arrival that changes the room before anyone is ready.'],
    ['deadline', 'Deadline', 'End when the clock becomes impossible to ignore.', 'Ending Bet: End by making the deadline impossible to ignore.']
  ]);

  readonly narrativeDials: NarrativeDial[] = [
    defineNarrativeDial('villain-pressure', 'Villain Pressure', this.villainPressureOptions),
    defineNarrativeDial('chapter-payload', 'Chapter Payload', this.chapterPayloadOptions),
    defineNarrativeDial('pacing', 'Pacing', this.pacingOptions),
    defineNarrativeDial('ending-bet', 'Ending Bet', this.endingBetOptions)
  ];

  readonly blueprint = signal<BlueprintForm>({
    creature: 'vampire',
    themes: [],
    logline: '',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 1,
    heatContract: {
      adultOnlyConfirmed: false,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    },
    protagonistName: '',
    antagonistName: '',
    worldDetails: '',
    narrativeDirectives: ''
  });

  readonly workbench = signal<StoryWorkbenchSession>({
    story: null,
    state: null,
    chapterHistory: [],
    activeBatchSize: 2,
    lastSuggestedPrompts: [],
    batchQueue: []
  });

  readonly selectedChapterId = signal<string | null>(null);
  readonly collapsedChapterGroups = signal<Set<number>>(new Set());
  readonly activeSkin = signal<StorySkinId>('writing-desk');
  readonly customContinuationBrief = signal('');
  readonly selectedNarrativeDialOptionIds = signal<SelectedNarrativeDialOptions>({
    'villain-pressure': 'secret',
    'chapter-payload': 'plot',
    pacing: 'balanced',
    'ending-bet': 'revelation'
  });
  readonly directorRoomDecisions = signal<Record<string, DirectorRoomNoteStatus>>({});
  // Memory-card state (pinned drafts, accepted cards, the in-progress edit)
  // lives in `MemoryCardService` — see `memoryCardDrafts` below for why the
  // derivation still happens here. These are aliases (not copies) onto the
  // service's own signals, kept under their original names so the template
  // didn't need to change.
  readonly acceptedMemoryCards = this.memoryCardService.acceptedMemoryCards;
  readonly editingAcceptedMemoryCardId = this.memoryCardService.editingAcceptedMemoryCardId;
  readonly acceptedMemoryCardEditDraft = this.memoryCardService.acceptedMemoryCardEditDraft;
  readonly isGenerating = signal(false);
  /**
   * Whether the creature/spice/heat-contract-detail/mood/length/batch-size
   * controls are shown.
   *
   * Those seven controls all ship with a valid default (`FormValidationService`
   * never blocks generation on any of them) and were shown with the same visual
   * weight as the three fields that actually gate generation — the logline, the
   * theme picker, and the Heat Contract's adult-confirmation checkbox. Collapsed
   * by default here, the same way `<details class="story-details">` already
   * collapses the fully-optional name/world/special-request fields; this closes
   * the gap left when that pattern was applied to one group of optional fields
   * and not the other.
   */
  readonly advancedControlsExpanded = signal(false);
  readonly imageStyles = IMAGE_STYLES;
  readonly selectedImageStyle = signal<ImageStyle>('artistic');
  readonly isGeneratingImage = signal(false);
  /**
   * Generated chapter illustrations this session, keyed by chapter id.
   *
   * A single `{ chapterId, image } | null` slot held only the most recently
   * generated illustration: generating one for chapter 2 discarded chapter
   * 1's, even though both chapters were still open in the same story. Keying
   * by chapter id keeps every chapter's illustration independently, the way
   * `chapterImageFailure` already keys failures — see `SavedStoryProject.chapterImages`
   * for the matching fix to the save/load side of the same loss.
   */
  readonly generatedChapterImages = signal<Record<string, ImageGenerationSeam['output']>>({});
  readonly chapterImageFailure = signal<{ chapterId: string; message: string } | null>(null);
  /**
   * The image failure to show under the chapter currently open, if it is that
   * chapter's failure.
   *
   * The panel this renders in belongs to the selected chapter, and the image
   * beside it has always known that: the `<img>` is drawn only for the
   * selected chapter's own entry in `generatedChapterImages`, so selecting
   * another chapter puts a different (or no) preview up. The error had no such
   * check and nothing cleared it, so a refusal earned by Chapter 1 — "Themes
   * are required", "Invalid image style" — stayed pinned under Chapter 2,
   * Chapter 3, and every chapter generated afterwards, describing a request
   * that was never made for them. It outlived the story, too: loading a saved
   * project leaves it on screen over chapters from a different story.
   *
   * Recording which chapter the failure belongs to and matching it the way the
   * image already does makes the two halves of the panel agree, and means the
   * message goes away on its own when the reader moves on.
   */
  readonly imageGenerationError = computed(() => {
    const failure = this.chapterImageFailure();
    return failure && failure.chapterId === this.selectedChapter()?.chapterId ? failure.message : null;
  });

  readonly isGeneratingAudio = signal(false);
  readonly generatedChapterAudio = signal<{ chapterId: string; audio: AudioConversionSeam['output'] } | null>(null);
  readonly chapterAudioFailure = signal<{ chapterId: string; message: string } | null>(null);

  /** The audio failure to show under the chapter currently open. See `imageGenerationError` for why this is scoped. */
  readonly audioGenerationError = computed(() => {
    const failure = this.chapterAudioFailure();
    return failure && failure.chapterId === this.selectedChapter()?.chapterId ? failure.message : null;
  });
  // Read from the contract rather than restated here: this list had lost
  // `html`, so the export route's sanitized HTML document — the only rendering
  // that runs the story through the export sanitizer and carries the export
  // metadata — had no option in the picker to ask for it.
  readonly exportFormats: readonly ExportFormat[] = EXPORT_FORMATS;
  readonly selectedExportFormat = signal<ExportFormat>('txt');
  readonly isExporting = signal(false);
  readonly statusMessage = signal<string>('Tell us what kind of enchanted, spicy story you want.');
  readonly workspaceSaveStatus = signal<string>('No saved stories in this browser yet.');
  readonly savedProjects = signal<SavedStoryProject[]>([]);
  readonly cloudProjects = signal<CloudStoryProjectListItem[]>([]);
  readonly cloudLibrarySyncState = signal<CloudLibrarySyncState>({
    mode: 'cloud_unavailable',
    message: 'Account sync is not connected yet.'
  });
  readonly isCloudLibraryBusy = signal(false);
  readonly generationProgress = signal<GenerationProgressState>({
    active: false,
    percent: 0,
    stage: 'Waiting for your story idea',
    elapsedSeconds: 0
  });
  readonly jobStatusPanel = signal<JobStatusPanelState>(this.createHiddenJobStatusPanel());
  readonly showDebugPanel = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('debug') === '1')),
    { initialValue: false }
  );
  readonly validationErrors = computed(() => this.formValidation.validateBlueprint(this.blueprint()));
  readonly isBlueprintValid = computed(() => this.formValidation.isValid(this.validationErrors()));
  readonly firstValidationError = computed(() => this.formValidation.getFirstError(this.validationErrors()));
  readonly currentSkin = computed(() =>
    this.skinOptions.find(skin => skin.id === this.activeSkin()) ?? this.skinOptions[0]
  );
  readonly activeSpiceOption = computed(() =>
    this.spiceOptions.find(option => option.level === Number(this.blueprint().spicyLevel)) ?? this.spiceOptions[2]
  );
  readonly activeHeatContract = computed(() => this.normalizeHeatContract(this.blueprint().heatContract));
  readonly narrativeDialViewModels = computed<NarrativeDialViewModel[]>(() => {
    const selections = this.selectedNarrativeDialOptionIds();

    return this.narrativeDials.map(dial => {
      const selectedOption = this.getSelectedNarrativeDialOption(dial, selections);
      return {
        ...dial,
        selectedOptionId: selectedOption.id,
        selectedDescription: selectedOption.description,
        selectedBrief: selectedOption.brief
      };
    });
  });
  readonly timeline = computed<ChapterTimelineEntry[]>(() => {
    const session = this.workbench();
    return session.chapterHistory.map(chapter => ({
      chapterId: chapter.chapterId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      summary: chapter.summary,
      hasCliffhanger: chapter.hasCliffhanger,
      createdAt: session.story?.updatedAt ?? new Date().toISOString()
    }));
  });

  readonly continuityPanel = computed<ContinuityPanelViewModel>(() => {
    const session = this.workbench();
    if (!session.state) {
      return {
        characters: [],
        activeThreads: [],
        unresolvedArtifacts: [],
        continuityWarnings: []
      };
    }

    return {
      characters: session.state.characters,
      activeThreads: session.state.threads.filter(thread => thread.status !== 'resolved'),
      unresolvedArtifacts: session.state.artifacts.filter(artifact => !artifact.resolvedInChapter),
      continuityWarnings: session.state.continuityWarnings
    };
  });

  readonly continuityPreviewItems = computed<ContinuityPreviewItem[]>(() => {
    const continuity = this.continuityPanel();
    const activationSource = normalizeActivationText(
      this.withStoryMemoryCardBriefs(this.customContinuationBrief())
    );
    const threadSelections = this.selectContinuityPreviewMatches(
      continuity.activeThreads,
      2,
      // The same three the guidance builder recognises a thread by. The
      // foreshadowed devices were missing here, so a brief that named the
      // planted device and nothing else activated the thread in the prompt and
      // not in the preview of it.
      thread => [thread.label, thread.description, ...readThreadForeshadowedDevices(thread)],
      activationSource
    );
    const artifactSelections = this.selectContinuityPreviewMatches(
      continuity.unresolvedArtifacts,
      1,
      artifact => [artifact.name, artifact.significance],
      activationSource
    );
    const warningSelections = this.selectContinuityPreviewMatches(
      continuity.continuityWarnings,
      1,
      warning => [warning],
      activationSource
    );
    const relationshipItem = this.buildContinuityRelationshipPreviewItem(continuity.characters, activationSource);
    return [
      ...threadSelections.map(({ item: thread, matched }) => ({
        id: `thread-${thread.id}`,
        label: formatThreadDebtLabel(thread.status),
        title: thread.label,
        detail: thread.description,
        sourceReason: this.formatContinuityPreviewSourceReason(matched, 'Active story thread'),
        lifetimeLabel: this.formatStoryMemoryLifetimeLabel(thread.lifetime)
      })),
      ...(relationshipItem ? [relationshipItem] : []),
      ...artifactSelections.map(({ item: artifact, matched }) => ({
        id: `artifact-${artifact.id}`,
        label: 'World clue',
        title: artifact.name,
        detail: artifact.significance,
        sourceReason: this.formatContinuityPreviewSourceReason(matched, 'Unresolved world clue'),
        lifetimeLabel: this.formatStoryMemoryLifetimeLabel(artifact.lifetime)
      })),
      ...warningSelections.map(({ item: warning, index, matched }) => ({
        id: `warning-${index}`,
        label: 'Continuity note',
        title: 'Carry forward',
        detail: warning,
        sourceReason: this.formatContinuityPreviewSourceReason(matched, 'Continuity note to honor')
      }))
    ].filter(item => item.title || item.detail);
  });

  // Derivation stays here (rather than moving wholesale into the service)
  // because it depends on `continuityPanel`, which is itself derived from
  // workbench/session state the service has no business knowing about; the
  // service takes the view model as a parameter instead of reaching for it.
  readonly memoryCardDrafts = computed<MemoryCardDraftItem[]>(() =>
    this.memoryCardService.deriveDrafts(this.continuityPanel())
  );

  readonly pinnedMemoryCardDraftCount = computed(() =>
    this.memoryCardDrafts().filter(draft => draft.pinned).length
  );

  readonly acceptedMemoryContinuationSummary = computed(() =>
    this.memoryCardService.deriveAcceptedContinuationSummary()
  );

  /**
   * How long a thread or artifact is expected to matter, named for the reader.
   *
   * Read from `STORY_MEMORY_LIFETIME_LABELS` rather than the three `if`s this
   * replaces, for the reason `formatThreadDebtLabel` gives: an `if` ladder over
   * a closed vocabulary is a table with no one checking it is complete, and the
   * chapter memory line is the only thing that would have said a fourth lifetime
   * had been added — by not appearing. `undefined` stays the answer for an
   * absent lifetime, which is the field being optional rather than a value this
   * has no name for.
   */
  private formatStoryMemoryLifetimeLabel(lifetime: StoryMemoryLifetime | undefined): string | undefined {
    return lifetime ? STORY_MEMORY_LIFETIME_LABELS[lifetime] : undefined;
  }

  private buildContinuityRelationshipPreviewItem(
    characters: ContinuityPanelViewModel['characters'],
    activationSource: string
  ): ContinuityPreviewItem | null {
    const relationshipItems: Array<ContinuityPreviewItem & { activationScore: number; sourceIndex: number }> = [];
    let sourceIndex = 0;
    for (const character of characters) {
      for (const relationship of readRelationshipEdges(character)) {
        const target = characters.find(candidate => candidate.id === relationship.characterId);
        if (target) {
          relationshipItems.push({
            id: `relationship-${character.id}-${target.id}`,
            label: 'Relationship pressure',
            title: `${character.displayName} and ${target.displayName}`,
            detail: relationship.notes || this.formatRelationshipPreviewDetail(relationship.relationship),
            sourceReason: 'Current relationship edge',
            activationScore: this.scorePreviewActivationMatch(activationSource, [
              character.displayName,
              target.displayName,
              relationship.relationship,
              relationship.notes
            ]),
            sourceIndex
          });
          sourceIndex += 1;
        }
      }
    }

    if (!relationshipItems.length) {
      return null;
    }

    relationshipItems.sort((first, second) =>
      second.activationScore - first.activationScore || first.sourceIndex - second.sourceIndex
    );
    const selected = relationshipItems[0];
    const { activationScore, sourceIndex: _sourceIndex, ...item } = selected;

    return {
      ...item,
      sourceReason: this.formatContinuityPreviewSourceReason(activationScore > 0, 'Current relationship edge')
    };
  }

  private selectContinuityPreviewMatches<T>(
    items: T[],
    limit: number,
    getCandidates: (item: T) => Array<string | undefined>,
    activationSource: string
  ): Array<ContinuityPreviewSelection<T> & { index: number }> {
    return items
      .map((item, index) => ({
        item,
        index,
        matched: false,
        activationScore: this.scorePreviewActivationMatch(activationSource, getCandidates(item))
      }))
      .sort((first, second) => second.activationScore - first.activationScore || first.index - second.index)
      .slice(0, limit)
      .map(({ item, index, activationScore }) => ({
        item,
        index,
        matched: activationScore > 0
      }));
  }

  private formatContinuityPreviewSourceReason(matched: boolean, fallback: string): string {
    return matched ? 'Matched continuation guidance' : fallback;
  }

  /**
   * How strongly the reader's brief names one continuity item, as the guidance
   * builder scores it.
   *
   * This panel used to score it a third way of its own — best candidate rather
   * than the sum of them, a three-character token floor rather than four, and an
   * apostrophe the guidance's normalizer removes — so `Matched continuation
   * guidance` was this component's judgement rather than the one the run makes.
   * A thread called `Broken vow` was reported as matched against a brief that
   * mentions a vow, while the guidance scored it zero and ordered it by story
   * position; and a thread matched weakly three times ranked below one matched
   * strongly once here, and above it in the prompt. The scorer moved to
   * `shared/continuityActivation.ts`, which both now read.
   *
   * The panel still lists fewer items than the courtroom carries — two threads
   * to its three, one artifact to its two, one warning to its two — because this
   * is a preview beside a form rather than the prompt itself. What changes is
   * that the items it lists are now the head of the same ordering, and its
   * `Matched` label means what the guidance means by it.
   */
  private scorePreviewActivationMatch(
    activationSource: string,
    candidates: Array<string | undefined>
  ): number {
    return scoreActivationCandidates(candidates, activationSource);
  }

  /**
   * The pressure line the preview shows for an edge the model wrote no note on.
   *
   * Read from `RELATIONSHIP_PRESSURE_DETAILS` rather than the four `if`s this
   * replaces. `RELATIONSHIP_KINDS` has five members and the ladder named four,
   * so `unknown` — the kind `readRelationshipEdges` now normalizes an
   * unrecognised value *to* — arrived at a fallback that was doing two jobs at
   * once: the honest line for a connection nobody has characterized, and the
   * line a sixth kind would silently inherit on the day one is added. Keyed by
   * the union, `unknown` has that line because it was written for it and a sixth
   * kind has to be given its own.
   */
  private formatRelationshipPreviewDetail(relationship: RelationshipKind): string {
    return RELATIONSHIP_PRESSURE_DETAILS[relationship];
  }

  readonly selectedChapter = computed(() => {
    const id = this.selectedChapterId();
    if (!id) {
      const chapters = this.workbench().chapterHistory;
      return chapters[chapters.length - 1] ?? null;
    }

    return this.workbench().chapterHistory.find(chapter => chapter.chapterId === id) ?? null;
  });

  readonly selectedChapterIndex = computed(() => {
    const chapter = this.selectedChapter();
    if (!chapter) {
      return -1;
    }

    return this.workbench().chapterHistory.findIndex(entry => entry.chapterId === chapter.chapterId);
  });

  readonly activeBatchSize = computed<ChapterBatchSize>(() => this.blueprint().chapterBatchSize);
  readonly activeBatchQueue = computed<BatchProgressState[]>(() => this.workbench().batchQueue ?? []);
  readonly hasFinishedBatchQueueItems = computed(() =>
    this.activeBatchQueue().some(item => item.status === 'completed' || item.status === 'failed')
  );
  readonly suggestedNextPrompts = computed(() => this.workbench().lastSuggestedPrompts ?? []);
  readonly continuityExtraction = computed(() => this.workbench().lastContinuityExtraction ?? null);
  readonly directorRoomNotes = computed<DirectorRoomNote[]>(() => {
    const chapter = this.selectedChapter();
    if (!chapter) {
      return [];
    }

    const blueprint = this.blueprint();
    const continuity = this.continuityPanel();
    const primaryCharacter = continuity.characters[0];
    const primaryThread = continuity.activeThreads[0];
    const primaryArtifact = continuity.unresolvedArtifacts[0];
    const protagonist = primaryCharacter?.displayName || blueprint.protagonistName?.trim() || 'the lead';
    const currentGoal = primaryCharacter?.currentGoal || `make the ${blueprint.creature} desire more costly`;
    let continuityLabel = 'the current story thread';
    let continuityDetail = chapter.summary;
    if (primaryThread) {
      continuityLabel = primaryThread.label;
      continuityDetail = primaryThread.description || chapter.summary;
    } else if (primaryArtifact) {
      continuityLabel = primaryArtifact.name;
      continuityDetail = primaryArtifact.significance || chapter.summary;
    }
    const endingSuggestion = chapter.hasCliffhanger
      ? 'Pay off the current cliffhanger, then open a harder question before the chapter closes.'
      : 'End the next chapter on an impossible choice instead of a quiet fade-out.';
    const baseNotes: Omit<DirectorRoomNote, 'status'>[] = [
      {
        id: 'desire-ledger',
        title: 'Desire Ledger',
        focus: `${protagonist} wants: ${currentGoal}`,
        suggestion: 'Make the next scene force that desire to cost something visible.',
        continuationBrief: `Desire Ledger: Make ${protagonist} actively pursue ${currentGoal}, and make that desire cost something visible.`,
        chapterId: chapter.chapterId
      },
      {
        id: 'continuity-keeper',
        title: 'Continuity Keeper',
        focus: `${continuityLabel}: ${continuityDetail}`,
        suggestion: 'Carry this thread forward on page so the next chapter feels connected.',
        continuationBrief: `Continuity Keeper: Carry forward ${continuityLabel}. ${continuityDetail}`,
        chapterId: chapter.chapterId
      },
      {
        id: 'chapter-ending',
        title: 'Chapter Ending',
        focus: chapter.hasCliffhanger ? 'Current chapter already ends on a cliffhanger.' : 'Current chapter closes without a hard unresolved turn.',
        suggestion: endingSuggestion,
        continuationBrief: `Chapter Ending: ${endingSuggestion}`,
        chapterId: chapter.chapterId
      }
    ];
    const decisions = this.directorRoomDecisions();

    return baseNotes.map(note => ({
      ...note,
      status: decisions[this.getDirectorRoomDecisionKey(note)] ?? 'pending'
    }));
  });
  readonly acceptedDirectorRoomNotes = computed(() =>
    this.directorRoomNotes().filter(note => note.status === 'accepted')
  );
  readonly modelBadge = computed(() => {
    const telemetry = this.workbench().lastTelemetry;
    if (!telemetry?.model) {
      return 'Grok 4.3';
    }

    const modelLabel = telemetry.fallbackFromModel
      ? `${telemetry.model} fallback`
      : telemetry.model;

    return telemetry.reasoningEffort
      ? `${modelLabel} · ${telemetry.reasoningEffort}`
      : modelLabel;
  });
  readonly cloudLibraryStatusLabel = computed(() => {
    switch (this.cloudLibrarySyncState().mode) {
      case 'cloud_synced':
        return 'Cloud synced';
      case 'sync_failed':
        return 'Cloud sync failed';
      case 'local_only':
        return 'Local only';
      case 'cloud_unavailable':
        return 'Cloud unavailable';
    }
  });
  readonly cloudLibraryStatusMessage = computed(() => {
    const state = this.cloudLibrarySyncState();
    if (state.message) {
      return state.message;
    }

    if (state.mode === 'cloud_synced') {
      return state.lastSyncedAt
        ? `Last checked ${new Date(state.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
        : 'Cloud library is available.';
    }

    if (state.mode === 'sync_failed') {
      return 'Cloud sync failed. Local browser saves are still available.';
    }

    if (state.mode === 'local_only') {
      return 'This story is saved in this browser.';
    }

    return 'Account sync is not connected yet.';
  });
  readonly cloudAccountStatusLabel = computed(() => {
    switch (this.cloudLibrarySyncState().mode) {
      case 'cloud_synced':
        return 'Connected';
      case 'sync_failed':
        return 'Needs attention';
      case 'local_only':
      case 'cloud_unavailable':
        return 'Not connected';
    }
  });
  readonly cloudAccountActionLabel = computed(() => {
    switch (this.cloudLibrarySyncState().mode) {
      case 'cloud_synced':
        return 'Profile';
      case 'sync_failed':
        return 'Account status';
      case 'local_only':
      case 'cloud_unavailable':
        return 'Connect account';
    }
  });
  readonly canUseCloudLibrary = computed(() => this.cloudLibrarySyncState().mode === 'cloud_synced');
  // `cloud_synced` is only reachable after an authenticated `/account/projects`
  // call succeeds, so it already implies a real Clerk session — but the
  // template still needs its own signal to decide whether a sign-out control
  // has anything to do, since `AuthService` itself is private to this class.
  readonly isCloudAccountSignedIn = computed(() => this.authService.isSignedIn());
  readonly chapterGroups = computed<ChapterGroupViewModel[]>(() => {
    const chapters = this.workbench().chapterHistory;
    if (!chapters.length) {
      return [];
    }

    const groupSize = this.getChapterGroupSize(chapters.length);
    const groups: ChapterGroupViewModel[] = [];

    for (let index = 0; index < chapters.length; index += groupSize) {
      const chunk = chapters.slice(index, index + groupSize);
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const label = chunk.length === 1
        ? `Chapter ${first.chapterNumber}`
        : `Chapters ${first.chapterNumber}-${last.chapterNumber}`;

      groups.push({
        id: index / groupSize,
        label,
        chapters: chunk
      });
    }

    return groups;
  });

  constructor() {
    this.restoreSkin();
    this.restoreLatestProject();

    // Fire-and-forget: `initialize()` is idempotent, and every deployment
    // that has not configured Clerk resolves this to a no-op after the one
    // `auth-config` request. The effect below is what actually reacts to a
    // sign-in once it happens.
    void this.authService.initialize();

    // `signIn()` opens Clerk's own modal; there is no promise that resolves
    // when the reader finishes it. This is what notices the session actually
    // landing and moves `cloudLibrarySyncState` out of `cloud_unavailable`
    // the same way a manual "Check cloud" click already does. The other
    // branch is what a local sign-out click alone did not cover: Clerk can
    // also end a session out from under the app — revocation, expiry,
    // another tab signing out — and without this, `cloudProjects` kept
    // rendering the previous account's project titles and metadata after
    // the account panel had already moved off `cloud_synced`, a real
    // privacy gap on a shared device.
    //
    // `wasSignedIn` (a plain closure variable, not a signal) is what makes
    // this a true→false *transition* check rather than a standing
    // condition: reading `cloudProjects`/`cloudLibrarySyncState` here too
    // would make them tracked dependencies of this same effect, so setting
    // either one (including this effect's own clearing writes, or a test
    // seeding `cloudProjects` directly) would immediately re-trigger it.
    //
    // `accountId()` is tracked alongside `isSignedIn()` for the case
    // `isSignedIn()` alone misses entirely: a multi-session Clerk client can
    // replace one signed-in account with another without an intermediate
    // signed-out state (an account switch in another tab, say), and
    // `isSignedIn()`'s boolean value would not change across that swap — an
    // effect keyed on it alone would never rerun, so the outgoing account's
    // in-flight request would never be cancelled and its eventual response
    // could populate the incoming account's project list or workbench.
    // `accountId()` only changes value (by `===`, `computed`'s own
    // equality gate) on an actual identity change, not an ordinary token
    // refresh, so this does not add spurious reruns.
    //
    // The reaction itself is a plain method, not inlined in the effect body:
    // Angular's constructor effects only reliably rerun in this codebase's
    // TestBed setup on their first execution — a second signal change does
    // not reach them without `fixture.detectChanges()` (which hangs here
    // rendering `App`'s full template for the first time) or
    // `TestBed.flushEffects()` (which throws `NG0101` in this exact
    // context, per the sign-out tests above). `syncCloudLibraryWithAuthState`
    // is called directly by tests for that reason — the effect below only
    // has to keep tracking `isSignedIn()`/`accountId()` and forwarding them.
    effect(() => {
      this.syncCloudLibraryWithAuthState(this.authService.isSignedIn(), this.authService.accountId());
    });
  }

  private wasSignedIn = false;
  private previousAccountId: string | null = null;

  private syncCloudLibraryWithAuthState(signedIn: boolean, accountId: string | null): void {
    if (signedIn) {
      const accountChanged = this.wasSignedIn && this.previousAccountId !== null && accountId !== null
        && accountId !== this.previousAccountId;
      this.wasSignedIn = true;
      this.previousAccountId = accountId;

      if (accountChanged) {
        this.cancelInFlightCloudLibraryRequest();
        this.cloudProjects.set([]);
      }
      this.refreshCloudLibrary();
      return;
    }

    if (this.wasSignedIn) {
      this.wasSignedIn = false;
      this.previousAccountId = null;
      this.cancelInFlightCloudLibraryRequest();
      this.cloudProjects.set([]);
      this.cloudLibrarySyncState.set({
        mode: 'cloud_unavailable',
        message: 'Signed out. Local browser saves are still available.'
      });
    }
  }

  ngOnDestroy() {
    this.closeJobSubscriptions();
    this.stopProgress();
    // A cloud list/save/load/delete request can still be in flight when the
    // reader navigates away (to `/proving-grounds`, say). Angular does not
    // unsubscribe a manually-created RxJS subscription on component
    // destruction, so without this its response would still arrive and its
    // callback could mutate or persist the now-destroyed workbench.
    this.cancelInFlightCloudLibraryRequest();
  }

  updateBlueprint<K extends keyof BlueprintForm>(field: K, value: BlueprintForm[K]) {
    this.blueprint.update(current => ({
      ...current,
      [field]: value
    }));
  }

  updateHeatContract<K extends keyof HeatContract>(field: K, value: HeatContract[K]) {
    this.blueprint.update(current => ({
      ...current,
      heatContract: {
        ...this.normalizeHeatContract(current.heatContract),
        [field]: value
      }
    }));
  }

  isThemeSelected(theme: ThemeSeed): boolean {
    return this.blueprint().themes.some(item => item.id === theme.id);
  }

  toggleTheme(theme: ThemeSeed) {
    const current = this.blueprint();
    const isSelected = current.themes.some(item => item.id === theme.id);
    const updatedThemes = isSelected
      ? current.themes.filter(item => item.id !== theme.id)
      : [...current.themes, theme];

    this.blueprint.set({ ...current, themes: updatedThemes });
  }

  toggleAdvancedControls() {
    this.advancedControlsExpanded.update(expanded => !expanded);
  }

  selectSkin(skinId: StorySkinId) {
    this.activeSkin.set(skinId);
    try {
      localStorage.setItem(this.skinStorageKey, skinId);
    } catch {
      this.workspaceSaveStatus.set('Theme choice will last until this tab closes.');
    }
  }

  updateCustomContinuationBrief(value: string) {
    this.customContinuationBrief.set(value);
  }

  selectChapter(chapterId: string) {
    this.selectedChapterId.set(chapterId);
  }

  async startGenesis() {
    if (this.isGenerating()) {
      return;
    }

    const blueprint = this.blueprint();
    const validationErrors = this.validationErrors();
    if (!this.formValidation.isValid(validationErrors)) {
      const message = this.formValidation.getFirstError(validationErrors) ?? 'Complete the required blueprint fields.';
      this.statusMessage.set(message);
      this.notificationService.error('Blueprint needs attention', message);
      return;
    }

    this.isGenerating.set(true);
    this.statusMessage.set('Sending your story ingredients to Grok...');
    this.startProgress('genesis');
    this.showStartingJobStatus('genesis');
    this.setBatchQueue([]);
    this.closeJobSubscriptions();
    const batchId = this.enqueueBatch('Genesis', blueprint.chapterBatchSize);

    const jobCreationSubscription = this.storyService.createStoryLabJob<StoryIterationPayload>({
      kind: 'genesis',
      blueprint
    }).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = this.formatApiError(response.error, 'Unknown error while generating story.');
          this.failJob('genesis', batchId, message);
          return;
        }

        const finished = this.handleJobSnapshot(
          'genesis',
          response.data.job,
          response.data.paths.statusPath,
          batchId,
          blueprint.chapterBatchSize,
          response.data.durability.warning
        );

        if (!finished) {
          this.watchJobUntilTerminal<StoryIterationPayload>(
            'genesis',
            response.data.paths.eventsPath,
            response.data.paths.statusPath,
            batchId,
            blueprint.chapterBatchSize,
            response.data.durability.warning
          );
        }
      },
      error: error => {
        this.jobCreationSubscription = null;
        this.errorLogging.logError(error, 'App.startGenesis');
        const message = this.formatHttpError(error, 'Story generation failed. Please try again in a moment.');
        this.failJob('genesis', batchId, message);
      },
      complete: () => {
        this.jobCreationSubscription = null;
      }
    });
    this.jobCreationSubscription = jobCreationSubscription.closed ? null : jobCreationSubscription;
  }

  async continueSaga(brief?: string) {
    if (this.isGenerating()) {
      return;
    }

    let session = this.workbench();
    if (!session.story || !session.state) {
      const message = 'Generate a story before requesting continuations.';
      this.statusMessage.set(message);
      this.notificationService.warning('No active story', message);
      return;
    }
    const story = session.story;
    const storyState = session.state;

    const savedProjectId = this.persistSession(session);
    if (savedProjectId) {
      session = {
        ...session,
        savedProjectId
      };
      this.workbench.set(session);
    }

    this.isGenerating.set(true);
    this.statusMessage.set('Asking Grok to continue the next chapter...');
    this.startProgress('continuation');
    this.showStartingJobStatus('continuation');
    this.closeJobSubscriptions();
    const batchId = this.enqueueBatch('Continuation', this.blueprint().chapterBatchSize);
    const continuationBrief = this.withStoryMemoryCardBriefs(brief);

    const request = {
      storyId: story.storyId,
      chapterBatchSize: this.blueprint().chapterBatchSize,
      storyState,
      previouslyGeneratedChapters: session.chapterHistory,
      continuationBrief,
      existingSummary: story,
      heatContract: this.activeHeatContract()
    } as const;

    const jobCreationSubscription = this.storyService.createStoryLabJob<ContinuationJobResult>({
      kind: 'continuation',
      continuation: request
    }).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          const message = this.formatApiError(response.error, 'Continuation request failed.');
          this.failJob('continuation', batchId, message);
          return;
        }

        const finished = this.handleJobSnapshot(
          'continuation',
          response.data.job,
          response.data.paths.statusPath,
          batchId,
          request.chapterBatchSize,
          response.data.durability.warning
        );

        if (!finished) {
          this.watchJobUntilTerminal<ContinuationJobResult>(
            'continuation',
            response.data.paths.eventsPath,
            response.data.paths.statusPath,
            batchId,
            request.chapterBatchSize,
            response.data.durability.warning
          );
        }
      },
      error: error => {
        this.jobCreationSubscription = null;
        this.errorLogging.logError(error, 'App.continueSaga');
        const message = this.formatHttpError(error, 'Continuation failed. Your existing chapters are still available.');
        this.failJob('continuation', batchId, message);
      },
      complete: () => {
        this.jobCreationSubscription = null;
      }
    });
    this.jobCreationSubscription = jobCreationSubscription.closed ? null : jobCreationSubscription;
  }

  continueWithDirection(direction: ContinuationDirection) {
    this.continueSaga(this.withNarrativeDialBriefs(direction.brief));
  }

  continueWithCustomDirection() {
    const brief = this.customContinuationBrief().trim();
    if (!brief) {
      this.continueSaga(this.withNarrativeDialBriefs());
      return;
    }

    this.customContinuationBrief.set('');
    this.continueSaga(this.withNarrativeDialBriefs(brief));
  }

  selectNarrativeDialOption(dialId: NarrativeDialId, optionId: string) {
    const dial = this.narrativeDials.find(candidate => candidate.id === dialId);
    if (!dial?.options.some(option => option.id === optionId)) {
      return;
    }

    this.selectedNarrativeDialOptionIds.update(current => ({
      ...current,
      [dialId]: optionId
    }));
  }

  selectVillainPressure(pressureId: VillainPressureId) {
    this.selectNarrativeDialOption('villain-pressure', pressureId);
  }

  acceptDirectorRoomNote(note: DirectorRoomNote) {
    this.setDirectorRoomNoteStatus(note, 'accepted');
  }

  dismissDirectorRoomNote(note: DirectorRoomNote) {
    this.setDirectorRoomNoteStatus(note, 'dismissed');
  }

  useDirectorRoomNoteAsBrief(note: DirectorRoomNote) {
    this.setDirectorRoomNoteStatus(note, 'accepted');
    this.customContinuationBrief.set(note.continuationBrief);
    this.statusMessage.set('Director Room note moved into the custom continuation brief.');
  }

  pinMemoryCardDraft(draftId: string) {
    this.statusMessage.set(this.memoryCardService.pinDraft(draftId));
  }

  acceptMemoryCardDraft(draftId: string) {
    const message = this.memoryCardService.acceptDraft(draftId, this.memoryCardDrafts());
    if (message) {
      this.statusMessage.set(message);
    }
  }

  editAcceptedMemoryCard(card: StoryMemoryCard) {
    this.memoryCardService.beginEdit(card);
  }

  updateAcceptedMemoryCardEditDraft(field: keyof AcceptedMemoryCardEditDraft, value: string) {
    this.memoryCardService.updateEditDraft(field, value);
  }

  saveAcceptedMemoryCardEdit() {
    const message = this.memoryCardService.saveEdit();
    if (message) {
      this.statusMessage.set(message);
    }
  }

  cancelAcceptedMemoryCardEdit() {
    this.memoryCardService.cancelEdit();
  }

  moveAcceptedMemoryCard(cardId: string, direction: -1 | 1) {
    this.memoryCardService.moveAccepted(cardId, direction);
    this.statusMessage.set('Accepted memory card order updated.');
  }

  deleteAcceptedMemoryCard(cardId: string) {
    this.memoryCardService.deleteAccepted(cardId);
    this.statusMessage.set('Accepted memory card removed.');
  }

  continueWithDirectorRoomNotes() {
    const acceptedNotes = this.acceptedDirectorRoomNotes();
    if (!acceptedNotes.length) {
      this.notificationService.warning('No Director Room notes selected', 'Accept at least one note before continuing with notes.');
      return;
    }

    this.continueSaga(this.withNarrativeDialBriefs(this.buildDirectorRoomContinuationBrief(acceptedNotes)));
    this.customContinuationBrief.set('');
  }

  getSafeHtml(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  resetWorkbench() {
    this.memoryCardService.reset();
    this.workbench.set({
      story: null,
      state: null,
      chapterHistory: [],
      activeBatchSize: this.blueprint().chapterBatchSize,
      lastSuggestedPrompts: [],
      batchQueue: []
    });
    this.selectedChapterId.set(null);
    this.collapsedChapterGroups.set(new Set());
    this.statusMessage.set('Start a fresh tale whenever you are ready.');
    this.notificationService.info('Workbench reset', 'Story Lab is ready for a new blueprint.');
  }

  async copyStory() {
    const text = this.buildPlainStoryText();
    if (!text) {
      this.notificationService.warning('Nothing to copy', 'Generate a story first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.notificationService.success('Story copied', 'The story text is on your clipboard.');
      this.statusMessage.set('Story copied to your clipboard.');
    } catch {
      this.notificationService.error('Copy failed', 'Your browser did not allow clipboard access.');
      this.statusMessage.set('Copy failed. Your browser did not allow clipboard access.');
    }
  }

  downloadStory() {
    const exportable = this.requireExportableStory('download');
    if (!exportable) {
      return;
    }

    const { session, story } = exportable;
    const images = this.generatedChapterImages();
    const chaptersWithImages = session.chapterHistory.map(chapter => ({
      ...chapter,
      imageUrl: images[chapter.chapterId]?.imageUrl
    }));
    const html = buildStoryHtmlDocument(session.story!, chaptersWithImages, html => this.getSafeHtml(html));
    downloadHtmlDocument(
      html,
      buildStoryDownloadFilename(story.title),
      createBrowserHtmlDownloadHost(document, URL)
    );
    this.statusMessage.set('Story download created.');
  }

  /**
   * The story-download and story-export actions both need a generated story
   * to act on and both refuse the same way when there isn't one; shared so
   * that refusal can't drift between the two buttons that show it.
   */
  private requireExportableStory(
    actionLabel: string
  ): { session: StoryWorkbenchSession; story: NonNullable<StoryWorkbenchSession['story']> } | null {
    const session = this.workbench();
    if (!session.story || !session.chapterHistory.length) {
      this.notificationService.warning(`Nothing to ${actionLabel}`, 'Generate a story first.');
      return null;
    }

    return { session, story: session.story };
  }

  exportStory() {
    if (this.isExporting()) {
      return;
    }

    const exportable = this.requireExportableStory('export');
    if (!exportable) {
      return;
    }

    const { session, story } = exportable;
    const format = this.selectedExportFormat();

    this.isExporting.set(true);

    this.storyService
      .exportStory({
        storyId: story.storyId,
        title: story.title,
        // Deliberately built without `imageUrl` per chapter, unlike
        // `downloadStory`'s own `buildStoryHtmlDocument` call: this content
        // travels to `/api/export/save`, and `exportSanitizer.ts`'s
        // `ALLOWED_STORY_TAGS` does not include `img` for any format this
        // route serves — an `<img>` here would be silently dropped by the
        // server, not rendered, so there is nothing this call gains by
        // sending one.
        content: buildStoryHtmlDocument(session.story!, session.chapterHistory, html => this.getSafeHtml(html)),
        format,
        includeMetadata: true,
        creature: this.blueprint().creature,
        themes: this.blueprint().themes.map(theme => theme.id)
      })
      .subscribe({
        next: response => {
          this.isExporting.set(false);

          if (response.success) {
            // `dataUriToBlob` throws for a `downloadUrl` it cannot decode, and
            // this is a `next` callback: RxJS does not route a throw from here
            // to the `error` handler below, it reports it as an unhandled error
            // and abandons the rest of this branch. So the two lines that tell
            // the reader the export is ready never ran either, and the only
            // export failure the app cannot describe was the one where the file
            // is already built and only the decoding of it went wrong — the
            // spinner stopped, no file was saved, and nothing said why.
            try {
              downloadBlob(
                dataUriToBlob(response.data.downloadUrl),
                response.data.filename,
                createBrowserHtmlDownloadHost(document, URL)
              );
            } catch {
              const message = 'The export arrived in a form this browser could not save.';
              this.notificationService.error('Export failed', message);
              this.statusMessage.set(message);
              return;
            }

            this.notificationService.success('Export ready', `${format.toUpperCase()} export created.`);
            this.statusMessage.set(`${format.toUpperCase()} export created.`);
          } else {
            const message = response.error?.message ?? 'Export failed.';
            this.notificationService.error('Export failed', message);
          }
        },
        // Read through `formatHttpError` like every other subscription in this
        // component. `/api/export/save` answers a real status now, so a refusal
        // no longer arrives as a `success: false` body on a `200` — it arrives
        // here, and the envelope beside it says which of the route's four
        // refusals it was: a story past the 500KB cap, a body missing
        // `storyId`/`content`/`title`/`format`, a format the renderer does not
        // support, or the service itself failing. Discarding it reported all
        // four as "Could not reach the export service.", which is the one thing
        // none of them is — the request reached the service and was answered.
        // The reader was told to check their connection over a story they can
        // fix by exporting fewer chapters or choosing another format.
        error: error => {
          this.isExporting.set(false);
          const message = this.formatHttpError(error, 'Could not reach the export service.');
          this.notificationService.error('Export failed', message);
          this.statusMessage.set(message);
        }
      });
  }

  generateChapterImage() {
    const chapter = this.selectedChapter();
    const story = this.workbench().story;

    if (!chapter || !story || this.isGeneratingImage()) {
      return;
    }

    this.isGeneratingImage.set(true);
    this.chapterImageFailure.set(null);

    const themes = this.blueprint().themes.map(theme => theme.id);

    this.storyService
      .generateImage({
        storyId: story.storyId,
        content: chapter.htmlContent,
        creature: this.blueprint().creature,
        themes,
        style: this.selectedImageStyle()
      })
      .subscribe({
        next: response => {
          this.isGeneratingImage.set(false);

          if (response.success) {
            this.generatedChapterImages.update(current => ({ ...current, [chapter.chapterId]: response.data }));
            this.notificationService.success('Image generated', 'Your chapter illustration is ready.');
          } else {
            const message = response.error?.message ?? 'Image generation failed.';
            this.chapterImageFailure.set({ chapterId: chapter.chapterId, message });
            this.notificationService.error('Image generation failed', message);
          }
        },
        // Read through `formatHttpError` like every other subscription in this
        // component. A failed image generation is a real status now, so it
        // arrives here rather than as a `success: false` body on a `200`, and
        // the reason the route gave — an unsupported style, an exhausted image
        // quota, a missing provider key — travels in the envelope this used to
        // discard. "Please try again" is the wrong advice for all three.
        error: error => {
          this.isGeneratingImage.set(false);
          const message = this.formatHttpError(error, 'Image generation failed. Please try again.');
          this.chapterImageFailure.set({ chapterId: chapter.chapterId, message });
          this.notificationService.error('Image generation failed', message);
        }
      });
  }

  generateChapterAudio() {
    const chapter = this.selectedChapter();
    const story = this.workbench().story;

    if (!chapter || !story || this.isGeneratingAudio()) {
      return;
    }

    this.isGeneratingAudio.set(true);
    this.chapterAudioFailure.set(null);
    // Cleared here, not only set on success: without this, a retry that fails
    // after an earlier success left that stale player on screen underneath
    // the new failure message, where it reads as this attempt's result.
    this.generatedChapterAudio.set(null);

    // `rawContent` carries the `[Character, voice: …]:`/`[Narrator]:` tags the
    // narration pipeline reads; `htmlContent` is what a chapter falls back to
    // when a saved project predates that field. `buildNarrationExcerpt` caps
    // it well under `AudioService`'s response-size ceiling — this app's
    // shortest chapter (600 words) is already past what that ceiling allows
    // in one inline response, so sending the whole chapter would refuse every
    // request with a length error instead of narrating an opening excerpt.
    const narrationSource =
      chapter.rawContent && chapter.rawContent.trim().length > 0 ? chapter.rawContent : chapter.htmlContent;

    this.storyService
      .convertChapterToAudio({
        storyId: story.storyId,
        chapterId: chapter.chapterId,
        content: this.buildNarrationExcerpt(narrationSource)
      })
      .subscribe({
        next: response => {
          this.isGeneratingAudio.set(false);

          if (response.success) {
            this.generatedChapterAudio.set({ chapterId: chapter.chapterId, audio: response.data });
            this.notificationService.success('Narration ready', 'Your chapter narration is ready to play.');
          } else {
            const message = response.error?.message ?? 'Audio generation failed.';
            this.chapterAudioFailure.set({ chapterId: chapter.chapterId, message });
            this.notificationService.error('Audio generation failed', message);
          }
        },
        error: error => {
          this.isGeneratingAudio.set(false);
          const message = this.formatHttpError(error, 'Audio generation failed. Please try again.');
          this.chapterAudioFailure.set({ chapterId: chapter.chapterId, message });
          this.notificationService.error('Audio generation failed', message);
        }
      });
  }

  /**
   * The opening of a chapter, cut on whole `<p>` blocks, short enough for
   * `AudioService` to narrate in one inline response.
   *
   * `AudioService.MAX_ESTIMATED_DURATION_SECONDS` (180s at the default speed
   * this app always requests) allows roughly 450 words; 400 keeps margin
   * without this frontend estimate needing to match the backend's word-count
   * formula exactly. A single paragraph alone past the budget — including
   * `rawContent` that is plain text with no `<p>` breaks at all, which reads
   * here as one paragraph — is truncated at a word boundary rather than kept
   * whole: sending it intact regardless of size was exactly the kind of
   * silent overpromise this feature exists to stop making.
   */
  private buildNarrationExcerpt(rawContent: string): string {
    const NARRATION_EXCERPT_MAX_WORDS = 400;
    const paragraphs = rawContent.split(/(?<=<\/p>)/i).filter(paragraph => paragraph.trim().length > 0);

    const kept: string[] = [];
    let wordCount = 0;

    for (const paragraph of paragraphs) {
      // `stripStoryHtmlToText` rather than a bare `<[^>]+>` strip: the naive
      // pattern ends a tag at the first `>`, including one inside a quoted
      // attribute value (`<p title="a>b">`), and leaks the fragment after it
      // as spoken text. The shared scanner is what every other reader of this
      // markup already uses for the same reason.
      const plainWords = stripStoryHtmlToText(paragraph).split(/\s+/).filter(Boolean);
      if (kept.length > 0 && wordCount + plainWords.length > NARRATION_EXCERPT_MAX_WORDS) {
        break;
      }

      if (kept.length === 0 && plainWords.length > NARRATION_EXCERPT_MAX_WORDS) {
        // The one block by itself is already oversized — including a
        // plain-text chapter with no `<p>` breaks, which is this whole
        // string read as a single "paragraph". Tags are dropped rather than
        // preserved: `parseAudioSegments` on the backend reads either shape,
        // and truncating at a word boundary in the plain-text reading is what
        // avoids re-balancing whatever markup this cuts through.
        return this.truncateWithoutSplittingASpeakerTag(plainWords, NARRATION_EXCERPT_MAX_WORDS);
      }

      kept.push(paragraph);
      wordCount += plainWords.length;
    }

    return kept.join('').trim() || rawContent;
  }

  /**
   * A word-boundary slice can still stop mid speaker-tag — e.g. after
   * `[Lord` inside `[Lord Damien, voice: velvet-smoke]:` — leaving a bracket
   * fragment that `AudioService`'s tag pattern won't recognize, so it gets
   * narrated as spoken text in the preceding speaker's voice instead of
   * being read as a tag. If the slice's last `[` has no matching `]:` after
   * it, drop everything from that `[` onward.
   */
  private truncateWithoutSplittingASpeakerTag(words: string[], maxWords: number): string {
    const slice = words.slice(0, maxWords).join(' ');
    const lastOpenBracket = slice.lastIndexOf('[');
    const lastClosedTag = slice.lastIndexOf(']:');

    if (lastOpenBracket === -1 || lastOpenBracket < lastClosedTag) {
      return slice;
    }

    return slice.slice(0, lastOpenBracket).trim();
  }

  saveActiveProject() {
    const savedProjectId = this.persistSession(this.workbench());
    if (savedProjectId) {
      this.workbench.update(current => ({
        ...current,
        savedProjectId
      }));
    }
  }

  loadSavedProject(projectId: string) {
    const project = this.workspaceStorage.loadProject(projectId);
    if (!project) {
      const message = 'That saved story could not be found in this browser.';
      this.workspaceSaveStatus.set(message);
      this.notificationService.warning('Story not found', message);
      this.refreshSavedProjects();
      return;
    }

    this.hydrateSavedProject(project, true);
  }

  deleteSavedProject(projectId: string) {
    const result = this.workspaceStorage.deleteProject(projectId);
    if (!result.success) {
      this.workspaceSaveStatus.set(result.message);
      this.notificationService.warning('Delete failed', result.message);
      return;
    }

    this.refreshSavedProjects();
    if (this.workbench().savedProjectId === projectId) {
      this.workbench.update(current => ({
        ...current,
        savedProjectId: undefined
      }));
    }
    this.workspaceSaveStatus.set('Saved story removed from this browser.');
  }

  /**
   * Gates every cloud-library request against a Clerk identity transition
   * still in flight, not just against another cloud-library request already
   * running: `authService.identityTransitionPending()` is true for the brief
   * window between a session-change listener firing and its own token
   * refresh settling, during which `sessionEpoch` has already advanced but
   * `sessionTokenState`/`accountId` have not — see that signal's own comment
   * on `AuthService` for why a request that starts in exactly that window is
   * dangerous rather than merely stale.
   */
  private isCloudLibraryRequestBlocked(): boolean {
    return this.isCloudLibraryBusy() || this.authService.identityTransitionPending();
  }

  private reportCloudLibraryError(
    mode: CloudLibrarySyncState['mode'],
    error: unknown,
    loggerContext: string,
    fallbackMessage: string
  ): void {
    this.errorLogging.logError(error, loggerContext);
    this.cloudLibrarySyncState.set({
      mode,
      message: this.formatHttpError(error, fallbackMessage)
    });
  }

  refreshCloudLibrary() {
    if (this.isCloudLibraryRequestBlocked()) {
      return;
    }

    this.isCloudLibraryBusy.set(true);
    const requestIdentity = this.captureCloudRequestIdentity();
    const cloudLibrarySubscription = this.storyService.listCloudStoryProjects().subscribe({
      next: this.guardStaleCloudResponse(requestIdentity, response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud library is unavailable.')
          });
          return;
        }

        this.cloudProjects.set(response.data.projects);
        // The listing is capped, so "12 cloud projects loaded" is only the
        // whole story while the reader has twelve. `totalProjectCount` is what
        // they actually have, and saying both is the difference between a
        // library that is short and one that has silently lost a story.
        const loaded = this.describeCloudProjectsLoaded(
          response.data.projects.length,
          response.data.totalProjectCount
        );
        if (response.data.storageMode === 'non_durable_memory') {
          this.cloudLibrarySyncState.set({
            mode: 'cloud_unavailable',
            message: `Cloud library is using non-durable account storage. ${loaded} loaded for inspection.`
          });
          return;
        }

        this.cloudLibrarySyncState.set({
          mode: 'cloud_synced',
          lastSyncedAt: new Date().toISOString(),
          message: `${loaded} loaded.`
        });
      }),
      error: this.guardStaleCloudError(requestIdentity, error => {
        this.reportCloudLibraryError(
          'cloud_unavailable',
          error,
          'App.refreshCloudLibrary',
          'Cloud library is unavailable until account sync is configured.'
        );
      }),
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
    // Held so a sign-out that lands while this request is still in flight
    // (see the constructor's effect and `signOutOfCloudAccount()`) can
    // unsubscribe it — cancelling the underlying HTTP request rather than
    // letting a response authenticated under the old session arrive after
    // sign-out and repopulate `cloudProjects` with the previous account's
    // data. `save`/`load`/`deleteCloudProject` hold their own in-flight
    // subscription in this same field — `isCloudLibraryBusy` already gates
    // all four cloud-library requests against each other, so at most one is
    // ever in flight and one field is enough to cancel whichever it is.
    this.cloudLibrarySubscription = cloudLibrarySubscription.closed ? null : cloudLibrarySubscription;
  }

  private cancelInFlightCloudLibraryRequest(): void {
    if (!this.cloudLibrarySubscription) {
      return;
    }
    this.cloudLibrarySubscription.unsubscribe();
    this.cloudLibrarySubscription = null;
    this.isCloudLibraryBusy.set(false);
  }

  /**
   * The signed-in identity a cloud-library request was made for, snapshotted
   * at the moment it starts, so its response callbacks can tell — no matter
   * when they run — whether they still belong to the account currently
   * signed in.
   *
   * Cancelling the subscription (`cancelInFlightCloudLibraryRequest`, called
   * from `signOutOfCloudAccount()` and the constructor effect) is not
   * sufficient on its own: Angular's constructor `effect()` is scheduled
   * asynchronously, so an external session change (Clerk revoking a session,
   * or a multi-session account switch in another tab) can leave a real
   * window where an already-in-flight response's callback runs *before* the
   * effect gets a chance to cancel it — cancelling afterward stops nothing
   * that already ran. Reading `authService.isSignedIn()`/`accountId()` here
   * is not subject to that same delay: a signal's current value is correct
   * the instant it's read, regardless of when any effect depending on it
   * next runs, so comparing against a live read inside each callback closes
   * the window cancellation alone cannot.
   *
   * `sessionEpoch` closes a narrower, related gap: `isSignedIn`/`accountId`
   * do not themselves update until `AuthService`'s `refreshSessionToken()`
   * finishes awaiting Clerk, so a response arriving in the window between a
   * session-change event firing and that `await` resolving would still
   * compare equal against the *outgoing* identity. `sessionEpoch` advances
   * synchronously the instant such an event is announced — see its own
   * comment on `AuthService` — closing that window too.
   */
  private captureCloudRequestIdentity(): CloudRequestIdentity {
    return {
      signedIn: this.authService.isSignedIn(),
      accountId: this.authService.accountId(),
      sessionEpoch: this.authService.sessionEpoch()
    };
  }

  private isStaleCloudResponse(requestIdentity: CloudRequestIdentity): boolean {
    const current = this.captureCloudRequestIdentity();
    return current.signedIn !== requestIdentity.signedIn
      || current.accountId !== requestIdentity.accountId
      || current.sessionEpoch !== requestIdentity.sessionEpoch;
  }

  /**
   * Wraps a `next` handler so the identity check above happens once, at the
   * call site each of `refreshCloudLibrary`/`saveActiveProjectToCloud`/
   * `loadCloudProject`/`deleteCloudProject` already needs it, rather than as
   * a repeated three-line guard inlined into each of those callbacks. A
   * stale `next` payload is dropped entirely — it belongs to a request no
   * longer representing the live signed-in state, so applying it would
   * repopulate the UI with the wrong account's data.
   */
  private guardStaleCloudResponse<T>(
    requestIdentity: CloudRequestIdentity,
    handler: (value: T) => void
  ): (value: T) => void {
    return value => {
      if (this.isStaleCloudResponse(requestIdentity)) {
        return;
      }
      handler(value);
    };
  }

  /**
   * Wraps an `error` handler the same way, except the busy lock always
   * releases even when the response is stale: `isCloudLibraryBusy` is set
   * once, at the start of each request, and only `error`/`complete` ever
   * clear it, so a stale `error` that skipped clearing it — the same way a
   * stale `next` payload is dropped — would leave every cloud control
   * disabled permanently, since no later callback exists to release it. The
   * error's own state-mutating side effects (logging, `cloudLibrarySyncState`)
   * still only apply when the response isn't stale.
   */
  private guardStaleCloudError<T>(
    requestIdentity: CloudRequestIdentity,
    handler: (value: T) => void
  ): (value: T) => void {
    return value => {
      this.isCloudLibraryBusy.set(false);
      if (this.isStaleCloudResponse(requestIdentity)) {
        return;
      }
      handler(value);
    };
  }

  /**
   * How many cloud projects this listing carries, and — when the listing is
   * capped — how many the account holds.
   *
   * A total larger than the page is not an error state and does not get its own
   * banner: the reader has more stories than one listing shows, which is
   * ordinary. What it must not do is go unsaid, because a page that reports only
   * its own length reads exactly like a complete library.
   *
   * A total *smaller* than the page cannot happen, and is not asserted against
   * either: the count comes from the same request as the items, so the honest
   * thing for an unexpected pair is to report the items, which is what the
   * reader is looking at.
   *
   * The noun agrees with the last number before it — `totalCount` in the
   * "1 of 61" form, `loadedCount` otherwise — so a single project out of
   * sixty-one reads as "1 of 61 cloud projects" rather than "1 of 61 cloud
   * project".
   */
  private describeCloudProjectsLoaded(loadedCount: number, totalCount: number): string {
    const isCapped = totalCount > loadedCount;
    const noun = `cloud project${(isCapped ? totalCount : loadedCount) === 1 ? '' : 's'}`;

    return isCapped
      ? `${loadedCount} of ${totalCount} ${noun}`
      : `${loadedCount} ${noun}`;
  }

  async showCloudAccountSetupStatus(): Promise<void> {
    if (this.isCloudLibraryBusy()) {
      return;
    }

    if (this.cloudLibrarySyncState().mode === 'cloud_synced') {
      this.cloudLibrarySyncState.update(state => ({
        ...state,
        message: state.message ?? 'Account is connected.'
      }));
      this.notificationService.info('Account connected', 'Cloud sync is available.');
      return;
    }

    // Always attempts sign-in rather than gating on the cached
    // `isConfigured()` read: `signIn()` awaits `initialize()` first, which
    // retries a prior transient auth-config/client-load failure (see
    // `AuthService.loadConfigAndClient`) instead of replaying it — without
    // this, a deployment that IS configured but hit one bad request would
    // show "not configured" forever with no way to retry short of a reload.
    // A genuinely unconfigured deployment, and one whose Clerk client failed
    // to actually load (the script blocked, a network error) even though the
    // deployment reports `provider: 'clerk'`, both still end here with
    // `isConfigured()` false — see that computed's own comment — so
    // `openSignIn()` no-ops and the message below shows either way, just
    // after the round trip resolves instead of synchronously.
    await this.authService.signIn();
    if (!this.authService.isConfigured()) {
      this.cloudLibrarySyncState.set({
        mode: 'cloud_unavailable',
        message: 'Sign-in setup is not configured yet. Local browser saves are still available.'
      });
      this.notificationService.info('Account setup pending', 'Sign-in setup is not configured yet.');
    }
  }

  /**
   * Ends the signed-in Clerk session. Before this existed there was no code
   * path back out of `cloud_synced` short of clearing cookies by hand — a
   * real gap on a shared device, since the next person to open the app would
   * keep the previous reader's authenticated cloud library.
   */
  async signOutOfCloudAccount(): Promise<void> {
    if (!this.isCloudAccountSignedIn()) {
      return;
    }

    // Cancelled before the `await` below, not after: `client.signOut()` is a
    // network call, and a save/load/delete/refresh that was in flight when
    // sign-out started could otherwise complete *during* that wait and still
    // run its callback — hydrating or re-adding the previous account's data
    // even though nothing has awaited yet to race against. The user already
    // asked to sign out at this point, so cancelling here is correct even on
    // the (rare) path below where Clerk's own sign-out call then fails.
    this.cancelInFlightCloudLibraryRequest();

    // `cancelInFlightCloudLibraryRequest()` leaves `isCloudLibraryBusy` false
    // (there is nothing in flight left to be busy with), which — before this
    // — reopened every cloud control (including "Sign out" itself, and the
    // template gates all of them on this same flag) for the whole remainder
    // of this `await`. A load or save started in that window could complete
    // before Clerk's sign-out did, hydrating or re-adding the outgoing
    // account's data — the cleanup below only clears `cloudProjects`, not
    // whatever a request begun after this point already wrote into the
    // workbench. Re-locking here, before the `await`, closes that window:
    // `saveActiveProjectToCloud`/`loadCloudProject`/`deleteCloudProject`/
    // `refreshCloudLibrary` all bail immediately while this is true, and so
    // does the template.
    this.isCloudLibraryBusy.set(true);

    // `AuthService.signOut()` deliberately does not clear its own session
    // state on failure — Clerk's session is the source of truth, and a
    // rejected call means it may still be active. Announcing "signed out"
    // regardless would be unsafe on a shared device, so this only clears
    // local state and reports success once Clerk has actually confirmed it.
    try {
      await this.authService.signOut();
    } catch (error) {
      this.errorLogging.logError(error, 'App.signOutOfCloudAccount');
      this.notificationService.error('Sign out failed', 'Could not sign out — the session may still be active.');
      // Sign-out failed, so the account is (as far as this app can tell)
      // still active — unlock cloud controls again rather than leaving them
      // stuck disabled.
      this.isCloudLibraryBusy.set(false);
      return;
    }

    // Clearing `cloudProjects` here, not just `cloudLibrarySyncState`, is
    // the actual fix: before this, the account panel moved off
    // `cloud_synced` but the previous account's project titles and metadata
    // stayed rendered in the list underneath it — a real privacy gap on a
    // shared device.
    this.cloudProjects.set([]);
    this.cloudLibrarySyncState.set({
      mode: 'cloud_unavailable',
      message: 'Signed out. Local browser saves are still available.'
    });
    this.isCloudLibraryBusy.set(false);
    this.notificationService.info('Signed out', 'Cloud sync is now disconnected on this device.');
  }

  saveActiveProjectToCloud() {
    if (this.isCloudLibraryRequestBlocked()) {
      return;
    }

    const project = this.buildSavedProjectFromSession(this.workbench());
    if (!project) {
      this.notificationService.warning('Nothing to save', 'Generate a story before saving to cloud.');
      this.cloudLibrarySyncState.update(state => ({
        ...state,
        message: 'Generate a story before saving to cloud.'
      }));
      return;
    }

    if (!this.canUseCloudLibrary()) {
      this.showCloudAccountSetupStatus();
      return;
    }

    this.isCloudLibraryBusy.set(true);
    const requestIdentity = this.captureCloudRequestIdentity();
    const cloudLibrarySubscription = this.storyService.saveCloudStoryProject(project).subscribe({
      next: this.guardStaleCloudResponse(requestIdentity, response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud save failed.')
          });
          return;
        }

        this.upsertCloudProject(project, response.data.projectId);
        this.cloudLibrarySyncState.set(response.data.syncState);
        this.notificationService.success('Cloud save requested', project.title);
      }),
      error: this.guardStaleCloudError(requestIdentity, error => {
        this.reportCloudLibraryError(
          'cloud_unavailable',
          error,
          'App.saveActiveProjectToCloud',
          'Cloud save is unavailable until account sync is configured.'
        );
      }),
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
    // `isCloudLibraryBusy` gates save/load/delete/refresh against each other,
    // so at most one of these subscriptions is ever in flight — the same
    // field `refreshCloudLibrary` holds its subscription in is safe to reuse
    // here. Without this, a save that was still in flight when the account
    // signed out could resolve afterward and silently re-add the previous
    // account's project to the (now cleared) list.
    this.cloudLibrarySubscription = cloudLibrarySubscription.closed ? null : cloudLibrarySubscription;
  }

  loadCloudProject(projectId: string) {
    if (this.isCloudLibraryRequestBlocked()) {
      return;
    }

    if (!this.canUseCloudLibrary()) {
      this.showCloudAccountSetupStatus();
      return;
    }

    this.isCloudLibraryBusy.set(true);
    const requestIdentity = this.captureCloudRequestIdentity();
    const cloudLibrarySubscription = this.storyService.loadCloudStoryProject(projectId).subscribe({
      next: this.guardStaleCloudResponse(requestIdentity, response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud story could not be loaded.')
          });
          return;
        }

        this.hydrateCloudProject(response.data.project);
        if (response.data.storageMode === 'non_durable_memory') {
          this.cloudLibrarySyncState.set({
            mode: 'cloud_unavailable',
            message: `Loaded "${response.data.project.title}" from non-durable account storage.`
          });
        } else {
          this.cloudLibrarySyncState.set({
            mode: 'cloud_synced',
            lastSyncedAt: new Date().toISOString(),
            message: `Loaded "${response.data.project.title}" from cloud.`
          });
        }
      }),
      error: this.guardStaleCloudError(requestIdentity, error => {
        this.reportCloudLibraryError('sync_failed', error, 'App.loadCloudProject', 'Cloud story could not be loaded.');
      }),
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
    // See the matching comment in `saveActiveProjectToCloud`: a load that
    // resolves after sign-out could otherwise hydrate the previous account's
    // full story into the UI after it has already cleared its signed-in
    // state.
    this.cloudLibrarySubscription = cloudLibrarySubscription.closed ? null : cloudLibrarySubscription;
  }

  deleteCloudProject(projectId: string) {
    if (this.isCloudLibraryRequestBlocked()) {
      return;
    }

    if (!this.canUseCloudLibrary()) {
      this.showCloudAccountSetupStatus();
      return;
    }

    this.isCloudLibraryBusy.set(true);
    const requestIdentity = this.captureCloudRequestIdentity();
    const cloudLibrarySubscription = this.storyService.deleteCloudStoryProject(projectId).subscribe({
      next: this.guardStaleCloudResponse(requestIdentity, response => {
        if (!response.success || !response.data) {
          this.cloudLibrarySyncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud delete failed.')
          });
          return;
        }

        this.cloudProjects.set(this.cloudProjects().filter(project => project.projectId !== projectId));
        if (response.data.storageMode === 'non_durable_memory') {
          this.cloudLibrarySyncState.set({
            mode: 'cloud_unavailable',
            message: response.data.deleted
              ? 'Cloud story deleted from non-durable account storage.'
              : 'Cloud story was already absent from non-durable account storage.'
          });
        } else {
          this.cloudLibrarySyncState.set({
            mode: 'cloud_synced',
            lastSyncedAt: new Date().toISOString(),
            message: response.data.deleted ? 'Cloud story deleted.' : 'Cloud story was already absent.'
          });
        }
      }),
      error: this.guardStaleCloudError(requestIdentity, error => {
        this.reportCloudLibraryError('sync_failed', error, 'App.deleteCloudProject', 'Cloud delete failed.');
      }),
      complete: () => {
        this.isCloudLibraryBusy.set(false);
      }
    });
    // See the matching comment in `saveActiveProjectToCloud`.
    this.cloudLibrarySubscription = cloudLibrarySubscription.closed ? null : cloudLibrarySubscription;
  }

  private applyIteration(payload: StoryIterationPayload, batchSize: ChapterBatchSize, batchId?: string) {
    const previousStoryId = this.workbench().story?.storyId;
    const isNewStory = previousStoryId !== payload.summary.storyId;
    const existingQueue = this.activeBatchQueue();
    const batchQueue = batchId
      ? existingQueue.map(item => item.id === batchId
          ? {
              ...item,
              status: 'completed' as const,
              chaptersGenerated: payload.batch.chapters.length,
              completedAt: new Date().toISOString(),
              errorMessage: undefined
            }
          : item)
      : existingQueue;

    const nextSession: StoryWorkbenchSession = {
      story: payload.summary,
      state: payload.state,
      chapterHistory: [...(this.workbench().story?.storyId === payload.summary.storyId ? this.workbench().chapterHistory : []), ...payload.batch.chapters],
      activeBatchSize: batchSize,
      lastTelemetry: payload.telemetry,
      lastContinuityExtraction: payload.continuityExtraction,
      lastSuggestedPrompts: payload.batch.suggestedNextPrompts,
      batchQueue
    };

    if (isNewStory) {
      this.memoryCardService.reset();
    }

    const savedProjectId = this.persistSession(nextSession);
    this.workbench.set({
      ...nextSession,
      savedProjectId
    });
    this.collapsedChapterGroups.set(new Set());

    const newestChapter = payload.batch.chapters[payload.batch.chapters.length - 1];
    if (newestChapter) {
      this.selectedChapterId.set(newestChapter.chapterId);
    }
  }

  /**
   * Handle one job snapshot for either a genesis or a continuation run.
   *
   * `T` is bounded by `StoryIterationPayload` rather than fixed to it:
   * `ContinuationJobResult` is `StoryIterationPayload & { appendedChapterNumbers }`,
   * so the genesis caller's `StoryLabJob<StoryIterationPayload>` and the
   * continuation caller's `StoryLabJob<ContinuationJobResult>` both satisfy it
   * without a cast, and `applyIteration`/`hasRenderableIterationPayload` below
   * only ever read the fields the bound guarantees.
   */
  private handleJobSnapshot<T extends StoryIterationPayload>(
    kind: StoryLabGenerationJobKind,
    job: StoryLabJob<T>,
    statusPath: string,
    batchId: string,
    batchSize: ChapterBatchSize,
    durabilityWarning?: string
  ): boolean {
    const copy = JOB_KIND_COPY[kind];
    this.updateProgressFromJob(job);
    this.updateJobStatusFromJob(job, statusPath, durabilityWarning);

    if (job.status === 'completed') {
      // `hasRenderableIterationPayload` rather than a bare `!job.result`:
      // `applyIteration` reads `payload.batch.chapters` and
      // `payload.summary.storyId` straight through, so a completed job carrying
      // a result that is merely *present* — a stored job row from an older
      // payload shape, a durable store that answered a partial record — threw a
      // `TypeError` inside the job event stream's `next` callback. That is not a
      // path with a handler on it: the batch stays "in progress" forever, the
      // progress timer keeps running, and the reader is told nothing at all.
      if (!this.hasRenderableIterationPayload(job.result)) {
        this.failJob(kind, batchId, copy.incompletePayloadMessage);
        return true;
      }

      this.applyIteration(job.result, batchSize, batchId);
      this.statusMessage.set(copy.completedStatusMessage);
      this.notificationService.success(
        copy.completedNotificationTitle,
        copy.completedNotificationMessage(job.result.batch.chapters.length)
      );
      this.isGenerating.set(false);
      this.clearJobStatusPanel();
      this.closeJobEventSubscription();
      this.stopProgress();
      return true;
    }

    if (job.status === 'failed') {
      this.failJob(kind, batchId, this.formatApiError(job.error, copy.defaultFailedMessage));
      return true;
    }

    if (job.status === 'cancelled') {
      this.failJob(kind, batchId, copy.cancelledMessage);
      return true;
    }

    // A terminal status without a branch above must not read as "still
    // running". See `STORY_LAB_TERMINAL_JOB_STATUSES` for the three places this
    // set is read and why none of them may guess.
    if (isTerminalStoryLabJobStatus(job.status)) {
      this.failJob(kind, batchId, copy.defaultFailedMessage);
      return true;
    }

    // `false` means "not finished yet" — both call sites (`startGenesis`,
    // `continueSaga`) and the poll loop's own recursive call in
    // `watchJobUntilTerminal` use this to decide whether to keep watching the
    // job at its `statusPath`. It used to be discarded at every call site,
    // which is exactly what let a non-terminal job go unwatched forever.
    return false;
  }

  /**
   * Watches a Story Lab job that `handleJobSnapshot` reported as not yet
   * terminal, over its event stream, until it finishes or the watch times
   * out.
   *
   * The backend always finishes genesis/continuation work synchronously
   * inside the job-creation request today, so a caller of this method
   * currently only fires once in a rare race (a request that outlives the
   * function's execution budget) rather than routinely. But the creation
   * response's own `paths.eventsPath` exists for exactly this case, and a
   * durable/queued job runner — the documented next step for Story Lab —
   * would hand back a non-terminal job on its very first response. Without
   * this, that job's progress bar would freeze forever with nothing watching
   * it: `jobEventSubscription` existed, was "cleaned up" on every terminal
   * path, and was never once assigned.
   *
   * One subscription, not a recursive re-poll: `StoryService.streamStoryLabJobEvents`
   * reconnects on its own for as long as the backend keeps closing the
   * response by design (see that route), fetching a fresh session token
   * before every attempt via the `getSessionToken` callback below — so there
   * is nothing here to reschedule on each snapshot the way the retired poll
   * loop had to. `handleJobSnapshot` already tears this subscription down on
   * every terminal path (`closeJobEventSubscription`, directly or via
   * `failJob`), so `next` below does not need to inspect its return value.
   *
   * The watchdog timer and the event-stream subscription are composed into
   * one `Subscription` so that a single `closeJobEventSubscription()` call —
   * on a terminal snapshot, a stream error, or `ngOnDestroy` — tears down
   * both, the same way it tore down the one poll subscription before this.
   */
  private watchJobUntilTerminal<T extends StoryIterationPayload>(
    kind: StoryLabGenerationJobKind,
    eventsPath: string,
    statusPath: string,
    batchId: string,
    batchSize: ChapterBatchSize,
    durabilityWarning: string | undefined
  ) {
    const subscription = new Subscription();
    this.jobEventSubscription = subscription;

    subscription.add(timer(STORY_LAB_JOB_POLL_TIMEOUT_MS).subscribe(() => {
      this.failJob(kind, batchId, JOB_KIND_COPY[kind].pollTimeoutMessage);
    }));

    subscription.add(this.storyService.streamStoryLabJobEvents<T>(
      eventsPath,
      () => this.authService.getRequestToken()
    ).subscribe({
      next: event => {
        this.handleJobSnapshot(kind, event.job, statusPath, batchId, batchSize, durabilityWarning);
      },
      error: error => {
        this.errorLogging.logError(error, 'App.watchJobUntilTerminal');
        this.failJob(kind, batchId, JOB_KIND_COPY[kind].streamErrorMessage);
      }
    }));
  }

  private updateProgressFromJob(job: StoryLabJob<unknown>) {
    const stage = this.formatJobStage(job.currentStep, job.status);
    const progressPercent = this.normalizeJobProgressPercent(job.progressPercent);
    this.jobDrivenProgress = true;
    this.statusMessage.set(stage);
    this.generationProgress.update(current => ({
      active: true,
      percent: progressPercent,
      stage,
      elapsedSeconds: current.elapsedSeconds
    }));
  }

  private failJob(kind: StoryLabGenerationJobKind, batchId: string, message: string) {
    this.clearJobStatusPanel();
    this.closeJobSubscriptions();
    this.statusMessage.set(message);
    this.markBatchFailed(batchId, message);
    this.notificationService.error(JOB_KIND_COPY[kind].failedNotificationTitle, message);
    this.isGenerating.set(false);
    this.stopProgress();
  }

  /**
   * Whether a finished job's result is a payload `applyIteration` can read.
   *
   * The check is the set of fields that method dereferences, not a spot check of
   * one of them. `batch.chapters` was already here; `summary.storyId` was not,
   * and it is read first — `applyIteration` compares it against the current
   * story before it touches the chapter list, so a result with a chapter array
   * and no summary got past this guard and threw one line further in.
   */
  private hasRenderableIterationPayload(payload: StoryIterationPayload | undefined): payload is StoryIterationPayload {
    return Array.isArray(payload?.batch?.chapters)
      && typeof payload?.summary?.storyId === 'string';
  }

  private closeJobEventSubscription() {
    if (this.jobEventSubscription) {
      this.jobEventSubscription.unsubscribe();
      this.jobEventSubscription = null;
    }
  }

  private closeJobSubscriptions() {
    if (this.jobCreationSubscription) {
      this.jobCreationSubscription.unsubscribe();
      this.jobCreationSubscription = null;
    }

    this.closeJobEventSubscription();
  }

  /**
   * The sentence the reader watches while a job runs.
   *
   * The five step cases were a `switch` over string literals with
   * `humanizeIdentifier` under them, and that fallback is the reason this is
   * worth changing. It cannot fail visibly: it takes any identifier and makes it
   * presentable, so a sixth step added on the API side would have arrived here,
   * missed all five cases, and rendered as its own title-cased wire name — the
   * reader shown "Extracting continuity." where a written sentence belonged,
   * with nothing to report that one was missing. Both sides typed `currentStep`
   * as `string`, so there was nothing for TypeScript to compare either.
   *
   * `STORY_LAB_JOB_STEP_LABELS` is total over `StoryLabJobStep`, so a sixth step
   * added to the table is a compile error here instead. The fallback stays,
   * because `currentStep` still arrives off the wire and a durable row written
   * by an older deployment may name a step this build has retired — but it is
   * now only for that, rather than for the app's own vocabulary.
   */
  private formatJobStage(currentStep: string, status: StoryLabJobStatus): string {
    if (status === 'queued') {
      return STORY_LAB_JOB_STEP_LABELS.queued;
    }

    if (status === 'waiting_for_review') {
      return 'Story job is waiting for review.';
    }

    return isStoryLabJobStep(currentStep)
      ? STORY_LAB_JOB_STEP_LABELS[currentStep]
      : this.humanizeIdentifier(currentStep);
  }

  private createHiddenJobStatusPanel(): JobStatusPanelState {
    return {
      visible: false,
      kind: 'genesis',
      tone: 'starting',
      label: '',
      title: '',
      description: '',
      progressPercent: 0,
      stage: ''
    };
  }

  private showStartingJobStatus(kind: StoryLabGenerationJobKind) {
    this.setJobStatusPanel({
      kind,
      tone: 'starting',
      progressPercent: 8,
      stage: this.generationProgress().stage,
      startedAt: new Date().toISOString()
    });
  }

  private updateJobStatusFromJob(job: StoryLabJob<unknown>, statusPath: string, durabilityWarning?: string) {
    // `job.kind` is the wire's four-member `StoryLabJobKind`; the panel speaks
    // only the two this client creates. The narrowing is correct because the
    // route refuses the deferred kinds outright, so no `export` or `audio` job
    // exists for this client to be polling — but it is a narrowing, and it used
    // to be hidden by a local `StoryLabJobKind` shadowing the contract's own.
    const kind: StoryLabGenerationJobKind = job.kind === 'continuation' ? 'continuation' : 'genesis';
    const current = this.jobStatusPanel();
    const tone = 'running';
    const stage = this.formatJobStage(job.currentStep, job.status);
    const progressPercent = this.normalizeJobProgressPercent(job.progressPercent);

    this.setJobStatusPanel({
      kind,
      tone,
      progressPercent,
      stage,
      jobId: this.formatShortJobId(job.jobId),
      statusPath,
      startedAt: job.createdAt,
      durabilityWarning: durabilityWarning ?? current.durabilityWarning
    });
  }

  private setJobStatusPanel(status: Pick<
    JobStatusPanelState,
    'kind' | 'tone' | 'progressPercent' | 'stage' | 'jobId' | 'statusPath' | 'startedAt' | 'durabilityWarning'
  >) {
    this.jobStatusPanel.set({
      visible: true,
      ...status,
      label: this.formatJobStatusLabel(status.kind, status.tone),
      title: this.formatJobStatusTitle(status.kind, status.tone),
      description: this.formatJobStatusDescription(status.kind, status.tone)
    });
  }

  private formatJobStatusLabel(kind: StoryLabGenerationJobKind, tone: JobStatusPanelState['tone']): string {
    return kind === 'genesis' ? 'Story generation' : 'Story continuation';
  }

  private formatJobStatusTitle(kind: StoryLabGenerationJobKind, tone: JobStatusPanelState['tone']): string {
    if (tone === 'starting') {
      if (kind === 'genesis') {
        return 'First chapter job starting';
      }

      return 'Continuation job starting';
    }

    if (kind === 'genesis') {
      return 'First chapter job running';
    }

    return 'Continuation job running';
  }

  private formatJobStatusDescription(kind: StoryLabGenerationJobKind, tone: JobStatusPanelState['tone']): string {
    if (kind === 'genesis') {
      if (tone === 'starting') {
        return 'Story Lab is creating a background job for the opening batch.';
      }

      return 'Story Lab is writing the opening batch in a background job.';
    }

    if (tone === 'starting') {
      return 'Story Lab is creating a background job for the next batch.';
    }

    return 'Story Lab is extending the saved story in a background job.';
  }

  private clearJobStatusPanel() {
    this.jobStatusPanel.set(this.createHiddenJobStatusPanel());
  }

  private formatShortJobId(jobId: string | undefined): string | undefined {
    if (!jobId) {
      return undefined;
    }

    return jobId.length <= 16 ? jobId : `${jobId.slice(0, 8)}...${jobId.slice(-4)}`;
  }

  private normalizeJobProgressPercent(progressPercent: number | null | undefined): number {
    return Math.max(0, Math.min(100, Math.round(progressPercent ?? 0)));
  }

  private enqueueBatch(label: string, batchSize: ChapterBatchSize): string {
    const id = `batch-${Date.now()}-${this.batchIdSequence++}`;
    const entry: BatchProgressState = {
      id,
      label,
      batchSize,
      status: 'in_progress',
      chaptersGenerated: 0,
      totalChapters: batchSize,
      submittedAt: new Date().toISOString()
    };

    this.setBatchQueue([...this.activeBatchQueue(), entry]);
    return id;
  }

  private markBatchFailed(batchId: string, errorMessage: string) {
    this.setBatchQueue(this.activeBatchQueue().map(item => item.id === batchId
      ? {
          ...item,
          status: 'failed' as const,
          completedAt: new Date().toISOString(),
          errorMessage
        }
      : item));
  }

  private setBatchQueue(batchQueue: BatchProgressState[]) {
    this.workbench.update(current => ({
      ...current,
      batchQueue
    }));
  }

  private restoreLatestProject() {
    this.refreshSavedProjects();
    const latestProject = this.savedProjects()[0];
    if (latestProject) {
      this.hydrateSavedProject(latestProject, false);
    }
  }

  private refreshSavedProjects() {
    this.savedProjects.set(this.workspaceStorage.listProjects());
  }

  private hydrateSavedProject(project: SavedStoryProject, shouldNotify: boolean) {
    this.hydrateProjectState(project);
    this.workspaceSaveStatus.set(`Loaded "${project.title}" from this browser.`);
    this.statusMessage.set('Saved story loaded. Continue the saga whenever you are ready.');

    if (shouldNotify) {
      this.notificationService.info('Story loaded', project.title);
    }
  }

  private hydrateCloudProject(project: SavedStoryProject) {
    this.hydrateProjectState(project);
    this.statusMessage.set('Cloud story loaded. Continue the saga whenever you are ready.');
    this.notificationService.info('Cloud story loaded', project.title);
  }

  private hydrateProjectState(project: SavedStoryProject) {
    this.blueprint.set({
      ...project.blueprint,
      heatContract: this.normalizeHeatContract(project.blueprint.heatContract),
      narrativeDirectives: project.blueprint.narrativeDirectives ?? ''
    });
    this.workbench.set({
      story: project.summary,
      state: project.state,
      chapterHistory: project.chapters,
      activeBatchSize: project.blueprint.chapterBatchSize,
      lastTelemetry: project.telemetry,
      lastContinuityExtraction: project.continuityExtraction,
      lastSuggestedPrompts: [],
      batchQueue: [],
      savedProjectId: project.id
    });
    this.memoryCardService.hydrate(project.pinnedMemoryCardDraftIds, project.acceptedMemoryCards);
    this.generatedChapterImages.set(project.chapterImages ?? {});
    this.selectedChapterId.set(project.chapters[project.chapters.length - 1]?.chapterId ?? null);
    this.collapsedChapterGroups.set(new Set());
  }

  private findSavedProjectByStoryId(storyId: string): SavedStoryProject | null {
    return this.workspaceStorage.loadProject(storyId)
      ?? this.workspaceStorage.listProjects().find(project => project.storyId === storyId)
      ?? null;
  }

  private restoreSkin() {
    try {
      const savedSkin = localStorage.getItem(this.skinStorageKey) as StorySkinId | null;
      if (savedSkin && this.skinOptions.some(skin => skin.id === savedSkin)) {
        this.activeSkin.set(savedSkin);
      }
    } catch {
      this.activeSkin.set('writing-desk');
    }
  }

  private startProgress(mode: 'genesis' | 'continuation') {
    const stages = mode === 'genesis'
      ? [
          'Preparing your story ingredients',
          'Sending them to Grok',
          'Writing the first chapter',
          'Checking the story thread',
          'Binding the pages'
        ]
      : [
          'Reading the last chapter',
          'Sending your direction to Grok',
          'Writing the next turn',
          'Checking continuity',
          'Binding the next pages'
        ];

    this.stopProgress();
    this.jobDrivenProgress = false;
    this.progressStartedAt = Date.now();
    this.generationProgress.set({
      active: true,
      percent: 8,
      stage: stages[0],
      elapsedSeconds: 0
    });

    this.progressTimer = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - this.progressStartedAt) / 1000);
      const stageIndex = Math.min(stages.length - 1, Math.floor(elapsedSeconds / 6));
      this.generationProgress.update(current => ({
        active: true,
        percent: this.jobDrivenProgress
          ? current.percent
          : Math.min(92, current.percent + (current.percent < 55 ? 7 : 3)),
        stage: this.jobDrivenProgress ? current.stage : stages[stageIndex],
        elapsedSeconds
      }));
    }, 1000);
  }

  private stopProgress() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    this.generationProgress.update(current => ({
      ...current,
      active: false,
      percent: current.percent > 0 ? 100 : 0
    }));
    this.jobDrivenProgress = false;
  }

  /**
   * `AI_UNAVAILABLE` and "temporarily unavailable" are answered by three
   * services now — story/continuation (Grok), image generation, and audio
   * narration — and every one of them already writes its own specific,
   * caller-facing sentence for exactly this case: see `StoryService`'s
   * `missingProviderResponse` ("Set XAI_API_KEY…"), `ImageService`'s
   * `CallerFacingImageError`, and `AudioService`'s `CallerFacingAudioError`.
   * This used to override all three with a hardcoded "Grok is temporarily
   * unavailable" / "…missing its Grok configuration" — correct for the
   * service this method was first written for, and wrong for the other two,
   * telling an image or audio failure's reader that the wrong system is down.
   * Passing the message through is what the "AI story engine" branch already
   * did anywhere its own detail mattered more than a fixed sentence — the
   * `timeout` rewording stays Grok-specific because story/continuation is
   * still the only caller of this method whose fallback names a timeout.
   */
  private formatApiError(error: { code?: string; message?: string; details?: unknown } | undefined, fallback: string): string {
    const code = error?.code ?? '';
    const message = error?.message ?? fallback;

    if (code === 'AI_UNAVAILABLE') {
      return message;
    }

    if (code.includes('TIMEOUT') || message.toLowerCase().includes('timeout')) {
      return 'Grok took too long to finish this story. Try a shorter chapter or try again in a minute.';
    }

    return message;
  }

  private formatHttpError(error: any, fallback: string): string {
    return this.formatApiError(error?.error?.error ?? error?.error, fallback);
  }

  private buildPlainStoryText(): string {
    const session = this.workbench();
    if (!session.story || !session.chapterHistory.length) {
      return '';
    }

    const chapters = session.chapterHistory
      .map(chapter => `Chapter ${chapter.chapterNumber}: ${chapter.title}\n\n${stripStoryHtmlToText(chapter.htmlContent)}`)
      .join('\n\n---\n\n');

    return `${session.story.title}\n\n${session.story.synopsis}\n\n${chapters}`;
  }

  private normalizeInlineWhitespace(value: string): string {
    let normalized = '';
    let pendingSpace = false;

    for (const char of value) {
      if (this.isWhitespace(char)) {
        pendingSpace = normalized.length > 0;
        continue;
      }

      if (pendingSpace) {
        normalized += ' ';
      }
      normalized += char;
      pendingSpace = false;
    }

    return normalized.trim();
  }

  private humanizeIdentifier(value: string): string {
    const normalized = this.normalizeInlineWhitespace(value.replace(/[_-]+/g, ' '));
    return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}.` : 'Story job is running.';
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f' || char === '\v';
  }

  private persistSession(session: StoryWorkbenchSession): string | undefined {
    const project = this.buildSavedProjectFromSession(session);
    if (!project) {
      return undefined;
    }

    const result = this.workspaceStorage.saveProject(project);

    if (!result.success) {
      this.workspaceSaveStatus.set(result.message);
      return undefined;
    }

    this.refreshSavedProjects();
    this.workspaceSaveStatus.set('Saved in this browser.');
    return result.data.id;
  }

  private buildSavedProjectFromSession(session: StoryWorkbenchSession): SavedStoryProject | null {
    if (!session.story || !session.state || !session.chapterHistory.length) {
      return null;
    }

    const now = new Date().toISOString();
    const currentProjectId = session.savedProjectId ?? session.story.storyId;
    const existingProject = this.workspaceStorage.loadProject(currentProjectId);
    const { pinnedMemoryCardDraftIds, acceptedMemoryCards } = this.memoryCardService.snapshot();

    return {
      id: currentProjectId,
      storyId: session.story.storyId,
      title: session.story.title,
      synopsis: session.story.synopsis,
      blueprint: this.blueprint(),
      summary: session.story,
      state: session.state,
      chapters: session.chapterHistory,
      telemetry: session.lastTelemetry,
      continuityExtraction: session.lastContinuityExtraction,
      pinnedMemoryCardDraftIds,
      acceptedMemoryCards,
      chapterImages: this.generatedChapterImages(),
      createdAt: existingProject?.createdAt ?? session.story.createdAt ?? now,
      updatedAt: now
    };
  }

  private upsertCloudProject(project: SavedStoryProject, projectId = project.id) {
    const nextItem: CloudStoryProjectListItem = {
      projectId,
      storyId: project.storyId,
      title: project.title,
      synopsis: project.synopsis,
      chapterCount: project.chapters.length,
      acceptedMemoryCardCount: project.acceptedMemoryCards?.length ?? 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
    const existing = this.cloudProjects().filter(item => item.projectId !== projectId);
    this.cloudProjects.set([nextItem, ...existing]);
  }

  clearFinishedBatchQueue() {
    this.setBatchQueue(this.activeBatchQueue().filter(item => item.status !== 'completed' && item.status !== 'failed'));
  }

  trackBatch(_index: number, batch: BatchProgressState): string {
    return batch.id;
  }

  trackCloudProject(_index: number, project: CloudStoryProjectListItem): string {
    return project.projectId;
  }

  acceptedMemoryCardCount(project: SavedStoryProject): number {
    return Array.isArray(project.acceptedMemoryCards) ? project.acceptedMemoryCards.length : 0;
  }

  formatBatchStatus(status: BatchProgressState['status'] | string | null | undefined): string {
    if (isBatchProgressStatus(status)) {
      return BATCH_STATUS_LABELS[status];
    }
    return typeof status === 'string' && status.trim() ? status : 'Unknown';
  }

  formatBatchChapterProgress(batch: BatchProgressState): string {
    const noun = batch.totalChapters === 1 ? 'chapter' : 'chapters';
    return `${batch.chaptersGenerated} of ${batch.totalChapters} ${noun}`;
  }

  trackDirectorRoomNote(_index: number, note: DirectorRoomNote): string {
    return note.id;
  }

  trackVillainPressure(_index: number, option: VillainPressureOption): string {
    return option.id;
  }

  trackNarrativeDial(_index: number, dial: NarrativeDialViewModel): string {
    return dial.id;
  }

  trackNarrativeDialOption(_index: number, option: NarrativeDialOption): string {
    return option.id;
  }

  trackAcceptedMemoryCard(_index: number, card: StoryMemoryCard): string {
    return card.id;
  }

  formatDirectorRoomNoteStatus(status: DirectorRoomNoteStatus): string {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'dismissed':
        return 'Dismissed';
      case 'pending':
        return 'Pending';
    }
  }

  private setDirectorRoomNoteStatus(note: DirectorRoomNote, status: DirectorRoomNoteStatus) {
    this.directorRoomDecisions.update(current => ({
      ...current,
      [this.getDirectorRoomDecisionKey(note)]: status
    }));
  }

  private getDirectorRoomDecisionKey(note: Pick<DirectorRoomNote, 'chapterId' | 'id'>): string {
    return `${note.chapterId}:${note.id}`;
  }

  private buildDirectorRoomContinuationBrief(notes: DirectorRoomNote[]): string {
    const customBrief = this.customContinuationBrief().trim();
    const directorBrief = [
      'Director Room notes:',
      ...notes.map(note => `- ${note.continuationBrief}`)
    ].join('\n');

    return customBrief ? `${customBrief}\n\n${directorBrief}` : directorBrief;
  }

  private getSelectedNarrativeDialOption(
    dial: NarrativeDial,
    selections: SelectedNarrativeDialOptions
  ): NarrativeDialOption {
    return dial.options.find(option => option.id === selections[dial.id]) ?? dial.options[0];
  }

  private withNarrativeDialBriefs(brief?: string): string {
    const trimmedBrief = brief?.trim();
    const dialBrief = this.narrativeDialViewModels()
      .map(dial => dial.selectedBrief)
      .join('\n');

    return trimmedBrief ? `${trimmedBrief}\n\n${dialBrief}` : dialBrief;
  }

  private withStoryMemoryCardBriefs(brief?: string): string | undefined {
    const trimmedBrief = brief?.trim();
    const acceptedCards = this.memoryCardService.acceptedMemoryCards();
    const acceptedCardIds = new Set(acceptedCards.map(card => card.id));
    const pinnedDrafts = this.memoryCardDrafts().filter(draft => draft.pinned && !acceptedCardIds.has(draft.id));
    if (!acceptedCards.length && !pinnedDrafts.length) {
      return trimmedBrief || undefined;
    }

    const memoryBrief = [
      ...(acceptedCards.length
        ? ['Accepted Memory Cards:', ...acceptedCards.map(card => this.memoryCardService.formatBrief(card))]
        : []),
      ...(pinnedDrafts.length
        ? ['Pinned Memory Cards:', ...pinnedDrafts.map(draft => this.memoryCardService.formatBrief(draft))]
        : [])
    ].join('\n');

    return trimmedBrief ? `${trimmedBrief}\n\n${memoryBrief}` : memoryBrief;
  }

  toggleChapterGroup(groupId: number) {
    const next = new Set(this.collapsedChapterGroups());
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.collapsedChapterGroups.set(next);
  }

  isChapterGroupCollapsed(groupId: number): boolean {
    return this.collapsedChapterGroups().has(groupId);
  }

  private getChapterGroupSize(chapterCount: number): number {
    if (chapterCount >= 50) {
      return 10;
    }
    if (chapterCount >= 20) {
      return 5;
    }
    return 3;
  }

  get currentChapterContent(): string {
    return this.selectedChapter()?.htmlContent ?? '';
  }

  get currentChapterSummary(): string {
    return this.selectedChapter()?.summary ?? '';
  }

  get totalChapterCount(): number {
    return this.workbench().chapterHistory.length;
  }

  get continuityWarnings(): string[] {
    return this.continuityPanel().continuityWarnings;
  }

  get activeThreadsLabel(): string {
    const threads = this.continuityPanel().activeThreads;
    if (!threads.length) {
      return 'No active plot threads';
    }
    return `${threads.length} active plot ${threads.length === 1 ? 'thread' : 'threads'}`;
  }

  get selectedThemes(): string {
    const blueprint = this.blueprint();
    if (!blueprint.themes.length) {
      return 'No themes selected';
    }
    return blueprint.themes.map(theme => theme.label).join(', ');
  }

  trackChapter(index: number, entry: Pick<ChapterTimelineEntry, 'chapterId'>) {
    return entry.chapterId;
  }

  trackTheme(index: number, theme: ThemeSeed) {
    return theme.id;
  }

  trackSkin(index: number, skin: StorySkinOption) {
    return skin.id;
  }

  trackCreature(index: number, creature: CreatureOption) {
    return creature.id;
  }

  trackSpice(index: number, spice: SpiceOption) {
    return spice.level;
  }

  trackHeatTensionOption(index: number, option: HeatContractOption<HeatTensionMode>) {
    return option.id;
  }

  trackHeatBoundaryOption(index: number, option: HeatContractOption<HeatIntimacyBoundary>) {
    return option.id;
  }

  trackContinuationDirection(index: number, direction: ContinuationDirection) {
    return direction.label;
  }

  /** One `trackBy` for the three `<select>` vocabularies, which share a shape. */
  trackChoiceOption(index: number, option: ChoiceOption<string | number>) {
    return option.id;
  }

  getFieldError(field: BlueprintValidationField): string | undefined {
    return this.validationErrors()[field];
  }

  hasFieldError(field: BlueprintValidationField): boolean {
    return Boolean(this.getFieldError(field));
  }

  private normalizeHeatContract(contract: HeatContract | undefined): HeatContract {
    return {
      adultOnlyConfirmed: contract?.adultOnlyConfirmed === true,
      tensionMode: contract?.tensionMode ?? 'slow_burn',
      intimacyBoundary: contract?.intimacyBoundary ?? 'fade_to_black',
      noGoContent: contract?.noGoContent ?? ''
    };
  }
}
