// ==================== SEAM-DRIVEN DEVELOPMENT CONTRACTS ====================
// These contracts are derived directly from UI interactions and data flows
// Each seam represents a boundary where data crosses between components

import { CREATURE_ARCHETYPES, type CreatureArchetype } from '../../../shared/creatureVocabulary';
import { CLASSIC_STORY_THEMES, type ClassicStoryTheme } from '../../../shared/themeVocabulary';
import { CHAPTER_BATCH_SIZES, type ChapterBatchSize } from '../../../shared/chapterBatchVocabulary';
import { SPICY_LEVELS, type SpicyLevel } from '../../../shared/spiceLevelVocabulary';
import type { XaiReasoningEffort } from '../../../shared/reasoningEffortVocabulary';
import { STORY_BLUEPRINT_LIMITS } from '../../../shared/storyBlueprintLimits';

export { CREATURE_ARCHETYPES, CLASSIC_STORY_THEMES, CHAPTER_BATCH_SIZES, SPICY_LEVELS };
export type { CreatureArchetype, ClassicStoryTheme, ChapterBatchSize, SpicyLevel };

// ==================== TYPE DEFINITIONS ====================
// `CreatureType` is this contract's name for the ten creatures, which are now
// one table in `shared/creatureVocabulary` rather than seven hand-written
// copies — see the note there for what the other six were and what each of
// them broke on its own. The alias is kept because the whole API tree spells
// the type this way; the values behind it are no longer restated here.
export type CreatureType = CreatureArchetype;
// `ThemeType` is this contract's name for the eighteen classic themes, which
// are now one table in `shared/themeVocabulary` rather than four hand-written
// copies — see the note there for what the other three were and what each of
// them broke on its own. The alias is kept because the whole API tree spells
// the type this way; the values behind it are no longer restated here.
export type ThemeType = ClassicStoryTheme;
// The five heat levels are `shared/spiceLevelVocabulary` for the same reason,
// after `VALIDATION_RULES.spicyLevel` below was found stating the scale a third
// time as the bare `{ min: 1, max: 5 }` the classic seam validates against. See
// that module for what the range check could not say that membership can.
/**
 * The word counts the classic generator accepts, as a value rather than only as
 * a type.
 *
 * This ladder was the last closed set in this file with no table behind it. It
 * was written twice — as a union here, and as the bare literal
 * `[600, 700, 900, 1200, 1500]` in `VALIDATION_RULES.wordCount.allowedValues`
 * three hundred lines below — with nothing tying the two together, while both
 * of its neighbours in that same object read their tables
 * (`themes.allowedValues` is `CLASSIC_STORY_THEMES`, `imageStyle.allowedValues`
 * is `IMAGE_STYLES`). The cast at the one reader said so out loud:
 * `StoryService.validateStoryInput` widened the literal to `readonly number[]`
 * before asking whether a caller's `wordCount` was in it, because the tuple's
 * own type had no relationship to `WordCount` to check against.
 *
 * The two could therefore drift in either direction, and each direction fails
 * silently in its own way. A budget added to the union alone is one the type
 * says is legal and the validator answers `INVALID_INPUT` for — a value the
 * app can request and the service refuses. A budget added to the literal alone
 * is one the validator waves through and every `WordCount`-keyed reader is
 * unaware of. This repository has already had that exact drift once on this
 * exact ladder, in the other direction: the transcribed production prompt named
 * 700, 900, and 1200 words while the Story Lab picker offered 600, 900, 1200,
 * and 1500, which is what `getProductionUserPrompt` reading the shared prompt
 * module was written to end.
 *
 * Derived rather than declared-and-`satisfies`-checked, for the reason
 * `IMAGE_STYLES` gives above: a `satisfies` clause catches a *wrong* entry, and
 * a copy of this list could only ever go wrong by being short one.
 *
 * `700` is deliberately here and deliberately absent from the Angular
 * `WORD_BUDGETS`. That list is the Story Lab picker's four choices and is a
 * *subset* of this one: the classic route accepts everything the picker offers
 * and one budget besides. `tests/word-count-ladder.test.ts` asserts the
 * containment, because the expensive direction of that drift — a picker
 * offering a budget this route refuses — is a blueprint refused only after the
 * reader presses generate.
 */
export const WORD_COUNTS = [600, 700, 900, 1200, 1500] as const;
export type WordCount = typeof WORD_COUNTS[number];

/** Membership, for the callers that check a value they were handed. */
const WORD_COUNT_SET: ReadonlySet<number> = new Set<number>(WORD_COUNTS);

export function isSupportedWordCount(value: unknown): value is WordCount {
  return typeof value === 'number' && WORD_COUNT_SET.has(value);
}
export type NarrativeTone = 'romance' | 'dark_romance' | 'mystery' | 'adventure' | 'comedy' | 'tragedy';
export type GenerationSource = 'classic_generator' | 'story_lab';
export type HeatTensionMode = 'slow_burn' | 'dangerous_proximity' | 'playful_banter' | 'devotional_longing';
export type HeatIntimacyBoundary = 'fade_to_black' | 'closed_door' | 'literary_on_page';

export interface GenerationThemeSeed {
  id: string;
  label: string;
  description: string;
}

export interface HeatContractIntent {
  adultOnlyConfirmed: boolean;
  tensionMode: HeatTensionMode;
  intimacyBoundary: HeatIntimacyBoundary;
  noGoContent?: string;
}

export interface StoryGenerationContext {
  source: GenerationSource;
  logline?: string;
  tone?: NarrativeTone;
  protagonistName?: string;
  antagonistName?: string;
  worldDetails?: string;
  narrativeDirectives?: string;
  heatContract?: HeatContractIntent;
  themeSeeds?: GenerationThemeSeed[];
}
export type ExportFormat = 'pdf' | 'txt' | 'html' | 'epub' | 'docx';

/**
 * The export formats, as a value rather than only as a type.
 *
 * `ExportFormat` has named five since the export pipeline was written, and
 * `ExportService.generateExportContent` renders all five. The Angular export
 * picker restated the list by hand as `['txt', 'pdf', 'epub', 'docx']` and lost
 * `html` doing it, so the one format with no option in the dropdown was the one
 * whose renderer is the only path that runs the story through
 * `sanitizeStoryHtmlForExport` and attaches the export metadata — a reader could
 * reach the sanitized HTML document from nowhere in the app. (The "Download"
 * button beside the picker is a different document: the browser builds it from
 * the workbench, without the sanitizer or the metadata.)
 *
 * Both readers take the list from here now, so a format added to the type has
 * one place to be added to and cannot go missing from the picker again — the
 * same arrangement `IMAGE_STYLES` and `CREATURE_ARCHETYPES` already have on the
 * Angular side.
 */
export const EXPORT_FORMATS = [
  'txt',
  'pdf',
  'html',
  'epub',
  'docx'
] as const satisfies readonly ExportFormat[];
/**
 * The image styles, as a value the type is read from rather than the other way
 * round.
 *
 * Five style names were written out by hand in six places: this union, the
 * Angular contract's own copy of it, `IMAGE_STYLES` beside that one for the
 * picker, `VALIDATION_RULES.imageStyle.allowedValues` below, `SUPPORTED_STYLES`
 * in `ImageService`, and — twice more — the `styleMap` and `grokStyleMap`
 * lookups that turn a style into prompt text and into the provider's own style
 * parameter. Nothing tied any of them to any other, which is the arrangement
 * `EXPORT_FORMATS` above was written to end after the picker restated the
 * export formats and lost `html`.
 *
 * The two lookups are why this is `as const` with the type derived, rather than
 * a union with a list `satisfies`-checked against it: a `satisfies` clause
 * catches a *wrong* entry, and every one of these copies could only ever go
 * wrong by being short one. A style missing from `styleMap` falls through to
 * `'artistic style'` and one missing from `grokStyleMap` to `'natural'`, so a
 * sixth style added to the union alone would have been generated in the wrong
 * look, silently, with no error anywhere. Derived from the table, they are
 * `Record<ImageStyle, string>` and a missing entry does not compile.
 *
 * `VALIDATION_RULES.imageStyle.allowedValues` is the copy that mattered most
 * for being right: `toLoggableImageStyle` reads it to decide whether the
 * `style` a caller sent is one of ours, and a value that is not is replaced
 * with `[UNRECOGNIZED]` rather than written to the log as the caller wrote it.
 */
export const IMAGE_STYLES = [
  'artistic',
  'photorealistic',
  'fantasy',
  'dark',
  'romantic'
] as const;
export type ImageStyle = typeof IMAGE_STYLES[number];
/**
 * The aspect ratios an image request may name, as a value the type is read from.
 *
 * Four ratios were written out in four places: the inline union on
 * `ImageGenerationSeam['input']['aspectRatio']`, `VALIDATION_RULES.aspectRatio
 * .allowedValues` below, the keys of `ASPECT_RATIO_SPECS` in `ImageService`, and
 * `SUPPORTED_ASPECT_RATIOS` beside it — plus a fifth spelling of the default,
 * `input.aspectRatio || '16:9'`, in the provider call.
 *
 * `ASPECT_RATIO_SPECS`' own docblock is the argument for this one. It says the
 * three lookups this ratio decides "were three separate lookups, each with its
 * own `|| '1792x1024'`-style fallback, so an unsupported ratio was silently
 * served as 16:9 while the response still echoed the ratio the caller asked
 * for", and that one table means "a ratio is either supported everywhere or
 * rejected". That change made the *specs* one table and left the *list* spelled
 * out three more times, one of which — the validation rule — no longer had a
 * reader at all and so could not have been caught by anything failing.
 *
 * `SUPPORTED_ASPECT_RATIOS` stays derived from `ASPECT_RATIO_SPECS` rather than
 * from this list, because that is the stronger of the two guarantees: the specs
 * are a `Record<AspectRatio, AspectRatioSpec>`, so a ratio named here and missing
 * a spec does not compile, and the closed-set check keeps answering with exactly
 * the ratios the lookups can actually serve.
 */
export const ASPECT_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3'
] as const;
export type AspectRatio = typeof ASPECT_RATIOS[number];
export type CliffhangerType =
  | 'romantic_tension'
  | 'plot_twist'
  | 'danger'
  | 'mystery'
  | 'character_revelation'
  | 'emotional_conflict';

export interface CliffhangerAnalysis {
  cliffhangerDetected: boolean;
  cliffhangerType: CliffhangerType;
  cliffhangerStrength: number;
  cliffhangerText: string;
  suggestedContinuations: string[];
  varietyScore: number;
}

// ==================== CHAPTER MANAGEMENT ====================
export interface Chapter {
  chapterId: string;
  chapterNumber: number;
  title: string;
  content: string; // HTML for this chapter only
  rawContent?: string; // With speaker tags for audio
  wordCount: number;
  generatedAt: Date;
  hasAudio: boolean;
  audioUrl?: string;
  audioDuration?: number;
  cliffhangerEnding?: boolean;
  nextChapterHint?: string;
}

export interface ChapterFailure {
  chapterNumber: number;
  message: string;
  errorCode?: string;
}

// ==================== SEAM 1: USER INPUT → STORY GENERATOR ====================
export interface StoryGenerationSeam {
  seamName: "User Input → Story Generator";
  description: "Converts form data into generated story content";

  input: {
    creature: CreatureType;
    themes: ThemeType[];
    userInput: string; // Optional custom ideas
    spicyLevel: SpicyLevel;
    wordCount: WordCount;
    // `ChapterBatchSize`, not a fourth spelling of `1 | 2 | 3`: this field and
    // the Story Lab's `chapterBatchSize` are one value — `storyLabEngine`
    // passes that straight into this one — so they read one table. See
    // `shared/chapterBatchVocabulary` for the six copies this replaces and
    // what a fourth size cost each of them.
    requestedChapterCount?: ChapterBatchSize;
    generationContext?: StoryGenerationContext;
  };

  output: {
    storyId: string;
    title: string;
    content: string; // HTML formatted content for [innerHTML] binding (speaker tags removed)
    rawContent?: string; // Content with speaker tags for audio processing
    creature: CreatureType;
    themes: ThemeType[];
    spicyLevel: SpicyLevel;
    actualWordCount: number;
    estimatedReadTime: number; // in minutes
    hasCliffhanger: boolean; // determines if "Continue Chapter" button shows
    generatedAt: Date;
    tropeMetadata?: string; // Invisible generation metadata for continuation consistency
    chapters?: Chapter[];
    totalWordCount?: number;
    nextChapterHint?: string;
    appendedToStory?: string; // Combined HTML for generated chapters
    failedChapters?: ChapterFailure[];
  };

  errors: {
    GENERATION_FAILED: {
      code: "GENERATION_FAILED";
      message: string;
      retryable: boolean;
      retryAfter?: number;
    };
    CONTENT_VIOLATION: {
      code: "CONTENT_VIOLATION";
      message: string;
      suggestions: string[];
      blockedContent: string[];
    };
    RATE_LIMITED: {
      code: "RATE_LIMITED";
      message: string;
      retryAfter: number; // seconds
      limitRemaining: number;
    };
    INVALID_INPUT: {
      code: "INVALID_INPUT";
      message: string;
      field: keyof StoryGenerationSeam['input'];
      providedValue: any;
      expectedType: string;
    };
  };
}

// ==================== SEAM 2: STORY → CHAPTER CONTINUATION ====================
export interface ChapterContinuationSeam {
  seamName: "Story → Chapter Continuation";
  description: "Extends existing story with additional chapters";

  input: {
    storyId: string;
    currentChapterCount: number;
    existingContent: string; // Full story HTML content
    userInput?: string; // Optional continuation hints
    maintainTone: boolean; // Keep same spicy level and themes
    tropeMetadata?: string; // Optional invisible generation metadata from original story
    // The same table the genesis seam above reads.
    requestedChapterCount?: ChapterBatchSize;
    generationContext?: StoryGenerationContext;
  };

  output: {
    chapterId: string;
    chapterNumber: number;
    title: string;
    content: string; // New chapter HTML content
    wordCount: number;
    cliffhangerEnding: boolean;
    themesContinued: ThemeType[];
    spicyLevelMaintained: SpicyLevel;
    appendedToStory: string; // Full updated story content
    tropeMetadata?: string; // Propagated invisible generation metadata
    cliffhangerAnalysis?: CliffhangerAnalysis;
    chapters?: Chapter[]; // Newly generated chapters when batching
    totalWordCount?: number;
    estimatedReadTime?: number; // Updated total read time in minutes
    nextChapterHint?: string;
    failedChapters?: ChapterFailure[];
  };

  errors: {
    STORY_NOT_FOUND: {
      code: "STORY_NOT_FOUND";
      message: string;
      storyId: string;
    };
    CONTINUATION_FAILED: {
      code: "CONTINUATION_FAILED";
      message: string;
      retryable: boolean;
    };
    MAX_CHAPTERS_REACHED: {
      code: "MAX_CHAPTERS_REACHED";
      message: string;
      maxChapters: number;
      currentChapters: number;
    };
  };
}

// ==================== SEAM 4: STORY DATA → SAVE/EXPORT SYSTEM ====================
export interface SaveExportSeam {
  seamName: "Story Data → Save/Export System";
  description: "Saves or exports story data in various formats";

  input: {
    storyId: string;
    content: string; // Full story HTML content
    title: string;
    format: ExportFormat;
    includeMetadata?: boolean;
    includeChapters?: boolean;
    creature?: string; // The story's actual creature, for the exported metadata
    themes?: string[]; // The story's actual themes, for the exported metadata
  };

  output: {
    exportId: string;
    storyId: string;
    // A self-contained `data:` URI holding the exported file. There is no
    // object storage behind this service, so the file itself — not a link to
    // somewhere it was uploaded — is what the caller gets back; it resolves
    // immediately and never expires.
    downloadUrl: string;
    filename: string;
    format: ExportFormat;
    fileSize: number;
    exportedAt: Date;
  };

  errors: {
    EXPORT_FAILED: {
      code: "EXPORT_FAILED";
      message: string;
      retryable: boolean;
      format: ExportFormat;
    };
    FORMAT_NOT_SUPPORTED: {
      code: "FORMAT_NOT_SUPPORTED";
      message: string;
      requestedFormat: ExportFormat;
      supportedFormats: ExportFormat[];
    };
  };
}

// ==================== SEAM 5: STORY → IMAGE GENERATION ====================
/**
 * The image seam, in the one place it is declared.
 *
 * It was declared twice — here and in the Angular contract — and the two had
 * drifted into describing different seams:
 *
 * - **`themes` was `ThemeType[]` here and `string[]` there, and the client was
 *   right.** The Story Lab sends its own theme seed ids, which the classic
 *   eighteen-name vocabulary does not contain. Both readers downstream already
 *   know that: `ImageService.mapThemeToVisualElement` takes a `string` and
 *   answers for either vocabulary, and `ALLOWED_THEMES` in
 *   `loggableRequestParameters` had to be widened with
 *   `STORY_LAB_THEME_SEED_IDS` for the same reason. Only this line still
 *   claimed the route receives a closed set it does not.
 * - **`creature` was `CreatureType` here and `CreatureArchetype` there** — the
 *   same ten names under two names. It stays `CreatureType` because this is
 *   the classic contract; the client's `CreatureArchetype` is structurally the
 *   same union and assigns to it.
 * - **`seamName` and `description` are literal types**, and the two spellings
 *   of `description` differed, so the two interfaces were not assignable to
 *   each other in either direction. Nothing crossed that boundary because
 *   nothing could.
 *
 * The Angular contract re-exports this one now, the way it already re-exports
 * `SaveExportSeam` and `ExportFormat`.
 */
export interface ImageGenerationSeam {
  seamName: "Story → Image Generation";
  description: "Generates a scene image from story content using Grok-2-Image.";

  input: {
    storyId: string;
    content: string; // Story content or specific scene
    imagePrompt?: string; // Optional custom prompt
    creature: CreatureType;
    /**
     * Classic `ThemeType` ids or Story Lab theme seed ids — the route takes
     * both, and every reader of this field is written for both.
     */
    themes: string[];
    style: ImageStyle;
    aspectRatio?: AspectRatio;
  };

  output: {
    imageId: string;
    storyId: string;
    imageUrl: string; // URL to generated image
    prompt: string; // The actual prompt sent to AI
    style: ImageStyle;
    aspectRatio: string;
    width: number;
    height: number;
    fileSize: number; // in bytes
    generatedAt: Date;
  };

  errors: {
    IMAGE_GENERATION_FAILED: {
      code: "IMAGE_GENERATION_FAILED";
      message: string;
      retryable: boolean;
      reason: "content_policy" | "quota_exceeded" | "service_error";
    };
    UNSUPPORTED_STYLE: {
      code: "UNSUPPORTED_STYLE";
      message: string;
      requestedStyle: ImageStyle;
      supportedStyles: ImageStyle[];
    };
    IMAGE_QUOTA_EXCEEDED: {
      code: "IMAGE_QUOTA_EXCEEDED";
      message: string;
      quotaRemaining: number;
      resetTime: Date;
    };
  };
}

/**
 * The audio container formats `/api/audio/convert` can answer with.
 *
 * One format for this seam's first version, and it is WAV rather than the
 * MP3 the stale README example named: `AudioService` requests raw PCM from
 * ElevenLabs (`output_format=pcm_16000`) and wraps it in a WAV header it
 * writes itself, and builds the same container for its own mock narration
 * when no `ELEVENLABS_API_KEY` is configured — one code path either way,
 * producing a file this repository can decode and duration-check without an
 * MP3 encoder dependency. Read the way `IMAGE_STYLES` and `EXPORT_FORMATS`
 * are: a closed list, so a caller asking for a format this pipeline does not
 * produce gets `UNSUPPORTED_FORMAT` rather than an envelope that silently
 * ships something else. Widening this to MP3 is real future work, not a
 * decision this change makes by omission.
 */
export const AUDIO_FORMATS = ['wav'] as const;
export type AudioFormat = typeof AUDIO_FORMATS[number];

/**
 * SEAM 6: Chapter → Audio Narration.
 *
 * The README has documented this contract's request shape since before this
 * interface existed — `POST /api/audio/convert` with `storyId`, `content`,
 * `voice`, `speed`, `format` — while `api/audio/`, `audioService.ts`, and every
 * piece of the pipeline it describes were absent from the repository. The data
 * model already carried the other half of that promise: `Chapter.hasAudio`,
 * `audioUrl`, and `audioDuration` in this file, and `Chapter.rawContent` kept
 * specifically "with speaker tags for audio" — fields every production call
 * site sets to `false`/`undefined` because nothing could ever set them
 * otherwise. `AudioService` is what makes `rawContent` (the `[Character, voice:
 * …]`/`[Narrator]:` tags `PRODUCTION_AUDIO_AND_VOICE_BLOCK` already instructs
 * the model to emit) resolve to a real answer here instead of a promise the
 * data model made on the app's behalf.
 *
 * `voice` names a caller override for every segment without a per-character
 * mapping configured; see `AudioService` for how a segment's speaker resolves
 * to an ElevenLabs voice id, and the mock fallback used with no
 * `ELEVENLABS_API_KEY` — the same `storyService.ts` fallback shape, not a
 * second mocking convention.
 */
export interface AudioConversionSeam {
  seamName: "Chapter → Audio Narration";
  description: "Converts speaker-tagged chapter text into narrated audio using ElevenLabs.";

  input: {
    storyId: string;
    chapterId?: string;
    content: string; // Speaker-tagged text: `[Character, voice: …]: "…"` / `[Narrator]: …`
    voice?: string; // Overrides the resolved voice for every segment when set
    speed?: number; // Playback speed multiplier
    format?: AudioFormat; // Defaults to 'wav'
  };

  output: {
    audioId: string;
    storyId: string;
    audioUrl: string; // `data:` URI carrying the synthesized audio
    format: AudioFormat;
    duration: number; // Estimated seconds
    voiceUsed: string[]; // Distinct voice ids the narration actually used, in first-use order
    generatedAt: Date;
  };

  errors: {
    AUDIO_GENERATION_FAILED: {
      code: "AUDIO_GENERATION_FAILED";
      message: string;
      retryable: boolean;
    };
    UNSUPPORTED_FORMAT: {
      code: "UNSUPPORTED_FORMAT";
      message: string;
      requestedFormat: string;
      supportedFormats: AudioFormat[];
    };
  };
}

// ==================== VALIDATION RULES ====================
export const VALIDATION_RULES = {
  userInput: {
    maxLength: 1000,
    allowedHtml: false
  },
  themes: {
    /**
     * How many themes one story may weave, read from the shared limit rather
     * than restated here.
     *
     * `STORY_BLUEPRINT_LIMITS.maxThemes` is the number the Story Lab enforces —
     * `parseStoryLabBlueprint` refuses a blueprint past it and
     * `FormValidationService` refuses one before the reader presses generate —
     * and this rule is the number the classic route enforces on the array that
     * *same blueprint* becomes. `STORY_EVALUATION_LIMITS.maxThemes` beside it
     * in the shared module already reads it, and says why: these fields "name
     * the same things".
     *
     * They could therefore drift, and each direction fails silently in its own
     * way. Raise the shared limit alone and the picker offers a sixth seed, the
     * form accepts it, `parseStoryLabBlueprint` accepts it, and
     * `toClassicThemes` — which now reads the same number — hands this rule an
     * array it refuses, so a blueprint the app assembled for itself comes back
     * `INVALID_INPUT` after the reader pressed generate. Lower it alone and the
     * refusal is worse for being invisible: the sixth theme is dropped on the
     * way to the generator and the story is written without it, with nothing in
     * the response saying a choice went missing.
     */
    maxCount: STORY_BLUEPRINT_LIMITS.maxThemes,
    // Read from the table rather than restated here, for the reason
    // `imageStyle.allowedValues` below reads `IMAGE_STYLES`: this copy is what
    // decides whether a caller's theme reaches the log or is written as
    // `[UNRECOGNIZED]`, so a theme in the union and missing here is a theme the
    // app can request and cannot report.
    allowedValues: CLASSIC_STORY_THEMES
  },
  spicyLevel: {
    /**
     * Read from the table rather than restated here, the way every rule around
     * it now reads its own.
     *
     * This one was stated as `{ min: 1, max: 5 }` — the only rule in this object
     * that described its closed set as a range instead of naming it — and
     * `StoryService.validateStoryInput` checked it as one, pairing the two
     * numbers with a `Number.isInteger` guard that is doing the other half of
     * what membership would answer on its own. See `spiceLevelVocabulary` for
     * what a range cannot say once the table it stands in for changes.
     */
    allowedValues: SPICY_LEVELS
  },
  wordCount: {
    // Read from the table rather than restated here, for the reason the two
    // rules above it read theirs. `StoryService.validateStoryInput` asks
    // `isSupportedWordCount` rather than reading this rule directly — the guard
    // is what narrows to `WordCount`, which the widening cast this replaced
    // could not — but both answer for the same array, so this rule states the
    // ladder for anything that reads the rules object and cannot drift from
    // what the validator enforces.
    allowedValues: WORD_COUNTS
  },
  audioSpeed: {
    min: 0.5,
    max: 1.5
  },
  imageStyle: {
    allowedValues: IMAGE_STYLES
  },
  aspectRatio: {
    // Read from the table, for the reason `imageStyle.allowedValues` above
    // reads `IMAGE_STYLES`. This rule has no reader today — `ImageService`
    // checks the ratio against `SUPPORTED_ASPECT_RATIOS`, which is the keys of
    // its own spec table — so restating the list here was a fourth copy that
    // nothing would ever have failed on.
    allowedValues: ASPECT_RATIOS
  }
} as const;

// ==================== UI STATE MANAGEMENT ====================
export interface UIState {
  isGenerating: boolean;
  isConvertingAudio: boolean;
  isSaving: boolean;
  isGeneratingNext: boolean;
  isGeneratingImage: boolean;
  audioProgress: number;
  saveSuccess: boolean;
  audioSuccess: boolean;
  imageSuccess: boolean;
  lastError?: string;
}

// ==================== UNIFIED API RESPONSE ====================
export interface ApiResponseMetadata {
  requestId: string;
  processingTime: number;
  rateLimitRemaining?: number;
  chaptersRequested?: number;
  chaptersGenerated?: number;
  partialFailures?: ChapterFailure[];
  model?: string;
  // The union from `shared/reasoningEffortVocabulary`, not a second spelling of
  // it: this field reports what `getXaiReasoningEffortForModel` chose, and the
  // two were written out separately with nothing tying them together.
  reasoningEffort?: XaiReasoningEffort;
  fallbackFromModel?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  // `unknown` rather than `any`: this is provider or store text a handler
  // attaches, and every reader of it — `toJobError` is the only one — passes it
  // along rather than reaching into it. It was `any` here and `unknown` in the
  // Angular declaration this replaces, which is the looser of two spellings of
  // one field winning by being the one the API tree read.
  details?: unknown;
}

export type ApiResponse<T> = {
  success: true;
  data: T;
  error?: never;
  metadata?: ApiResponseMetadata;
} | {
  success: false;
  data?: never;
  error: ApiErrorPayload;
  metadata?: ApiResponseMetadata;
};
