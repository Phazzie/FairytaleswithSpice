// ==================== SEAM-DRIVEN DEVELOPMENT CONTRACTS ====================
// These contracts are derived directly from UI interactions and data flows
// Each seam represents a boundary where data crosses between components

import { CREATURE_ARCHETYPES, type CreatureArchetype } from '../../../shared/creatureVocabulary';

export { CREATURE_ARCHETYPES };
export type { CreatureArchetype };

// ==================== TYPE DEFINITIONS ====================
// `CreatureType` is this contract's name for the ten creatures, which are now
// one table in `shared/creatureVocabulary` rather than seven hand-written
// copies — see the note there for what the other six were and what each of
// them broke on its own. The alias is kept because the whole API tree spells
// the type this way; the values behind it are no longer restated here.
export type CreatureType = CreatureArchetype;
export type ThemeType = 'betrayal' | 'obsession' | 'power_dynamics' | 'forbidden_love' | 'revenge' | 'manipulation' | 'seduction' | 'dark_secrets' | 'corruption' | 'dominance' | 'submission' | 'jealousy' | 'temptation' | 'sin' | 'desire' | 'passion' | 'lust' | 'deceit';
export type SpicyLevel = 1 | 2 | 3 | 4 | 5;
export type WordCount = 600 | 700 | 900 | 1200 | 1500;
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
    requestedChapterCount?: 1 | 2 | 3;
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
    requestedChapterCount?: 1 | 2 | 3;
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
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
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

// ==================== VALIDATION RULES ====================
export const VALIDATION_RULES = {
  userInput: {
    maxLength: 1000,
    allowedHtml: false
  },
  themes: {
    maxCount: 5,
    allowedValues: ['betrayal', 'obsession', 'power_dynamics', 'forbidden_love', 'revenge', 'manipulation', 'seduction', 'dark_secrets', 'corruption', 'dominance', 'submission', 'jealousy', 'temptation', 'sin', 'desire', 'passion', 'lust', 'deceit']
  },
  spicyLevel: {
    min: 1,
    max: 5
  },
  wordCount: {
    allowedValues: [600, 700, 900, 1200, 1500]
  },
  audioSpeed: {
    min: 0.5,
    max: 1.5
  },
  imageStyle: {
    allowedValues: IMAGE_STYLES
  },
  aspectRatio: {
    allowedValues: ['1:1', '16:9', '9:16', '4:3']
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
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  fallbackFromModel?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any;
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
