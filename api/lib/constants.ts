// ==================== SYSTEM CONSTANTS ====================
// Centralized constants to avoid magic numbers throughout the codebase

export const TOKEN_CALCULATION = {
  TOKENS_PER_WORD: 1.5,        // English averages ~1.5 tokens per word
  HTML_OVERHEAD: 1.2,           // HTML tags add ~20% overhead
  SPEAKER_TAG_OVERHEAD: 1.15,   // Speaker tags add ~15% overhead
  SAFETY_BUFFER: 1.1            // 10% safety margin for quality
} as const;

export const FILE_SIZE = {
  BYTES_PER_KB: 1024,
  BYTES_PER_MB: 1024 * 1024,
  MAX_AUDIO_SIZE_MB: 10,        // 10MB maximum audio file size
  MAX_CONTENT_LENGTH_KB: 500    // 500KB maximum content length (~75,000 words)
} as const;

export const TIMEOUTS = {
  GROK_API_MS: 45000,           // 45 seconds for story generation
  GROK_CONTINUATION_MS: 30000,  // 30 seconds for chapter continuation
  ELEVENLABS_API_MS: 60000      // 60 seconds for audio generation
} as const;

export const RATE_LIMITS = {
  STORY_GENERATION: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000    // 15 minutes
  },
  AUDIO_CONVERSION: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000    // 15 minutes
  },
  EXPORT: {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000    // 15 minutes
  },
  STREAMING: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000    // 15 minutes
  }
} as const;

export const READING_SPEED = {
  WORDS_PER_MINUTE: 200         // Average reading speed for time estimation
} as const;
