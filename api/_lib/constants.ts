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
  MAX_CONTENT_LENGTH_KB: 500,    // 500KB maximum content length (~75,000 words)
  /**
   * The widest export title, in bytes.
   *
   * `/api/export/save` measured `content` against the cap above and left
   * `title` unmeasured, though both are caller text and both are rendered into
   * the same document. The title is the more expensive of the two to leave
   * open: `generateTextContent` writes it and then `'='.repeat(title.length)`
   * under it, so a `.txt` export doubles it; `generateEPUBContent` interpolates
   * it into four separate XML parts, so an `.epub` carries four copies; and the
   * finished document is returned as a base64 `data:` URI, which adds a third
   * again. The Node deployment accepts a 10MB JSON body, so a one-byte story
   * with a nine-megabyte title produced tens of megabytes of response from a
   * rate-limited paid route.
   *
   * A kilobyte is several times the longest title this app's generator has ever
   * produced — the download filename stem is capped at 200 bytes — so this
   * refuses the abuse without coming near a real title. Measured in bytes, not
   * code units, for the reason the content cap is: a title in a non-Latin
   * script is up to four bytes per character, and it is the bytes that are
   * written.
   */
  MAX_TITLE_LENGTH_BYTES: 1024,
  DATA_URL_WARNING_THRESHOLD_MB: 5  // Warn when data URL exceeds 5MB
} as const;

export const TIMEOUTS = {
  GROK_API_MS: 45000,           // 45 seconds for story generation
  GROK_CONTINUATION_MS: 30000   // 30 seconds for chapter continuation
} as const;

export const RATE_LIMITS = {
  STORY_GENERATION: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000    // 15 minutes
  },
  CHAPTER_CONTINUATION: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000    // 15 minutes — same tier as story generation
  },
  IMAGE_GENERATION: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000    // 15 minutes — same tier as story generation
  },
  EXPORT: {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000    // 15 minutes
  },
  STREAMING: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000    // 15 minutes
  },
  /**
   * The Story Lab job event stream, which is not the kind of stream `STREAMING`
   * describes.
   *
   * `STREAMING` is sized for `/api/story-lab/stream/genesis`: one connection
   * held open for a whole paid generation, which the Angular reader
   * deliberately never reopens because reconnecting there re-runs the
   * generation from the beginning. Five of those in fifteen minutes is a
   * generous cap.
   *
   * `/api/story-lab/jobs/:jobId/events` works the opposite way. It replays the
   * events a job has recorded so far and then *ends the response* — every time,
   * for a job that is still running — so the browser fires `error`, reopens the
   * connection, and asks again. That is the documented design on both sides:
   * `shared/eventStreamRetry.ts` exists to tell the reader to keep the
   * subscription alive through it, and `StoryService.streamStoryLabJobEvents`
   * treats a reconnect as normal. So one reader watching one job is not one
   * request here; it is a request every time the browser retries, roughly every
   * three seconds.
   *
   * Under `STREAMING` that budget was spent about fifteen seconds into the
   * first generation, and every reconnect after it was answered 429 for the
   * rest of the window: the job kept running on the server while the reader was
   * told "Story generation updates stopped", and could not get them back for
   * fifteen minutes. The route spends nothing — it reads the job store and
   * replays recorded snapshots — so the cap belongs on the polling, not on the
   * generation. Fifteen minutes of uninterrupted three-second reconnects is
   * three hundred requests, which is what this allows.
   */
  STORY_LAB_JOB_EVENTS: {
    maxRequests: 300,
    windowMs: 15 * 60 * 1000    // 15 minutes
  },
  STORY_LAB_GENESIS: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000    // 15 minutes — same tier as story generation
  },
  STORY_LAB_CONTINUATION: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000    // 15 minutes — same tier as chapter continuation
  },
  STORY_LAB_JOB_CREATE: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000    // 15 minutes — creates the same genesis/continuation work synchronously
  },
  STORY_LAB_EVALUATE: {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000    // 15 minutes — cheaper than generation, higher tier
  }
} as const;

export const READING_SPEED = {
  WORDS_PER_MINUTE: 200         // Average reading speed for time estimation
} as const;
