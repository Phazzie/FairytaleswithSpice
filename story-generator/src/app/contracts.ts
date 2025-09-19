// ==================== SEAM-DRIVEN DEVELOPMENT CONTRACTS ====================
// These contracts are derived directly from UI interactions and data flows
// Each seam represents a boundary where data crosses between components

// ==================== TYPE DEFINITIONS ====================
export type CreatureType = 'vampire' | 'werewolf' | 'fairy';
export type ThemeType = 'romance' | 'adventure' | 'mystery' | 'comedy' | 'dark';
export type SpicyLevel = 1 | 2 | 3 | 4 | 5;
export type WordCount = 700 | 900 | 1200;
export type VoiceType = 'female' | 'male' | 'neutral';
export type AudioSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5;
export type AudioFormat = 'mp3' | 'wav' | 'aac';

// Multi-Voice Audio Types
export type CharacterVoiceType = 'vampire-male' | 'vampire-female' | 'werewolf-male' | 'werewolf-female' | 'fairy-male' | 'fairy-female' | 'human-male' | 'human-female' | 'narrator';
export type EmotionalContext = 'neutral' | 'seductive' | 'passionate' | 'mysterious' | 'tender' | 'intense' | 'desperate' | 'fearful';

export interface DialogueSegment {
  id: string;
  type: 'dialogue' | 'narration';
  content: string;
  characterName?: string; // Extracted character name (e.g., "Arabella", "Prince Valdric")
  characterType?: CharacterVoiceType; // Mapped voice type
  emotionalContext?: EmotionalContext; // Extracted from <em> tags or context
  originalIndex: number; // Position in original text
}

export interface MultiVoiceAudioSegment {
  segmentId: string;
  dialogueSegment: DialogueSegment;
  audioUrl: string;
  duration: number; // in seconds
  fileSize: number; // in bytes
  voiceUsed: CharacterVoiceType;
  generatedAt: Date;
}
export type ExportFormat = 'pdf' | 'txt' | 'html' | 'epub' | 'docx';

export interface AudioProgress {
  percentage: number; // 0-100
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
  estimatedTimeRemaining?: number; // in seconds
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
  };

  output: {
    storyId: string;
    title: string;
    content: string; // HTML formatted content for [innerHTML] binding
    creature: CreatureType;
    themes: ThemeType[];
    spicyLevel: SpicyLevel;
    actualWordCount: number;
    estimatedReadTime: number; // in minutes
    hasCliffhanger: boolean; // determines if "Continue Chapter" button shows
    generatedAt: Date;
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

// ==================== SEAM 3: STORY TEXT → AUDIO CONVERTER ====================
export interface AudioConversionSeam {
  seamName: "Story Text → Audio Converter";
  description: "Converts story text to multi-voice audio format with character-specific voices and emotional inflection";

  input: {
    storyId: string;
    content: string; // Full story HTML content
    voice?: VoiceType; // Fallback voice for narrator
    speed?: AudioSpeed;
    format?: AudioFormat;
    multiVoice?: boolean; // Enable multi-voice generation
    creatureType?: CreatureType; // Story creature type for voice mapping
  };

  output: {
    audioId: string;
    storyId: string;
    audioUrl: string; // Download URL for complete audio file
    duration: number; // in seconds (total)
    fileSize: number; // in bytes (total)
    format: AudioFormat;
    speed: AudioSpeed;
    progress: AudioProgress; // For real-time UI updates
    completedAt: Date;
    // Multi-voice specific fields
    isMultiVoice: boolean;
    segments?: MultiVoiceAudioSegment[]; // Individual voice segments
    charactersDetected?: string[]; // Character names found
    voiceMapping?: { [characterName: string]: CharacterVoiceType }; // Character to voice mapping used
  };

  errors: {
    CONVERSION_FAILED: {
      code: "CONVERSION_FAILED";
      message: string;
      retryable: boolean;
      stage: "text_processing" | "dialogue_parsing" | "voice_generation" | "audio_stitching" | "file_creation";
    };
    UNSUPPORTED_CONTENT: {
      code: "UNSUPPORTED_CONTENT";
      message: string;
      unsupportedElements: string[];
    };
    AUDIO_QUOTA_EXCEEDED: {
      code: "AUDIO_QUOTA_EXCEEDED";
      message: string;
      quotaRemaining: number;
      resetTime: Date;
    };
    VOICE_MAPPING_FAILED: {
      code: "VOICE_MAPPING_FAILED";
      message: string;
      unmappedCharacters: string[];
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
  };

  output: {
    exportId: string;
    storyId: string;
    downloadUrl: string; // Direct download URL for UI
    filename: string;
    format: ExportFormat;
    fileSize: number;
    expiresAt: Date; // When download URL expires
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
    STORAGE_QUOTA_EXCEEDED: {
      code: "STORAGE_QUOTA_EXCEEDED";
      message: string;
      quotaRemaining: number;
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
    allowedValues: ['romance', 'adventure', 'mystery', 'comedy', 'dark']
  },
  spicyLevel: {
    min: 1,
    max: 5
  },
  wordCount: {
    allowedValues: [700, 900, 1200]
  },
  audioSpeed: {
    min: 0.5,
    max: 1.5
  }
} as const;

// ==================== UI STATE MANAGEMENT ====================
export interface UIState {
  isGenerating: boolean;
  isConvertingAudio: boolean;
  isSaving: boolean;
  isGeneratingNext: boolean;
  audioProgress: number;
  saveSuccess: boolean;
  audioSuccess: boolean;
  lastError?: string;
}

// ==================== UNIFIED API RESPONSE ====================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    processingTime: number;
    rateLimitRemaining?: number;
  };
}