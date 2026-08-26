// Created: 2026-08-26 UTC

/**
 * Name the file the "Download story" button hands the browser.
 *
 * The stem used to be built by keeping ASCII letters and digits and dropping
 * everything else, with no bound on the result. Both halves of that are the
 * failures `ExportService.buildFilenameStem` was already fixed for, on the
 * button beside it:
 *
 * - **A title in any other script kept none of its characters.** `Мира и
 *   договор`, `美咲の契約`, and `Ελένη` all produced an empty stem and fell to
 *   the `fairytales-story` fallback, so every story a reader generated in their
 *   own language downloaded under one name — the second save landing beside the
 *   first as `fairytales-story (1).html`, with nothing in either name to say
 *   which story it is. The reader who most needs the name is the one who least
 *   gets one.
 * - **Nothing bounded the length.** A title is model-written and occasionally
 *   runs long, and `<stem>.html` has to fit inside the 255-byte filename limit
 *   ext4 and APFS enforce. Past it the save fails or is silently truncated by
 *   the browser, on a button whose only failure mode is otherwise silence.
 *
 * So the reading here is `slugId`'s, from the continuity extractor, which
 * answers the first: runs of anything that is not a Unicode letter or number
 * become a single `-`, which keeps those names distinct and legible instead of
 * collapsing them onto one. And the cap is measured the way the limit is
 * measured — in UTF-8 bytes, not code units — because a script that is three
 * bytes per character is exactly the case a character cap would get wrong, and
 * it is the same case the first half is about.
 *
 * The stem is not a storage key here, unlike the export service's: it names a
 * file in the reader's own downloads folder and never reaches a URL, so it does
 * not carry the random token that service appends and does not need to stay
 * inside ASCII to keep a URL free of escaping.
 */

/** What a title with no letters or numbers in it at all is called. */
export const STORY_DOWNLOAD_FILENAME_FALLBACK_STEM = 'fairytales-story';

/**
 * The widest stem, in UTF-8 bytes.
 *
 * Filesystems such as ext4 and APFS cap a filename at 255 bytes. Leaving 55 of
 * them free covers the `.html` extension and the ` (1)`-style suffix a browser
 * appends when the name is already taken, so a long title is shortened here
 * rather than being truncated — or refused — by the filesystem.
 */
export const STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES = 200;

/**
 * A run of anything that is not a letter or a number, in any script. Matching
 * on the Unicode properties rather than on `[^a-z0-9]` is what keeps a
 * non-Latin title from slugging to nothing at all.
 */
const FILENAME_SEPARATOR_PATTERN = /[^\p{L}\p{N}]+/u;

export function buildStoryDownloadFilenameStem(title: string): string {
  // Splitting on the separator runs and joining the parts back collapses each
  // run and drops the leading and trailing ones in a single linear pass, the
  // way the export filename stem and the continuity slug are both built.
  const parts = title.toLowerCase().split(FILENAME_SEPARATOR_PATTERN).filter(Boolean);
  const capped = capUtf8Bytes(parts.join('-'), STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES);
  // The join leaves single separators, so the cap can strand at most one — a
  // single slice says that, where the loop `ExportService` needs for its own
  // stem says only that some unknown number may be there.
  const stem = capped.endsWith('-') ? capped.slice(0, -1) : capped;

  return stem || STORY_DOWNLOAD_FILENAME_FALLBACK_STEM;
}

/**
 * The name of the HTML document a story downloads as.
 *
 * Kept here beside the stem so the extension is counted against the same cap
 * the stem is chosen under, rather than being appended somewhere that has
 * forgotten there is one.
 */
export function buildStoryDownloadFilename(title: string): string {
  return `${buildStoryDownloadFilenameStem(title)}.html`;
}

/**
 * Cut a stem to at most `maxBytes` of UTF-8, at a code-point boundary.
 *
 * Measured per code point rather than by encoding the whole string and slicing
 * the bytes: a cut between the bytes of one character encodes as U+FFFD, and a
 * cut between the halves of a surrogate pair does the same — the reason
 * `ExportService`'s `chunkByCodePoint` iterates code points too.
 */
function capUtf8Bytes(value: string, maxBytes: number): string {
  let capped = '';
  let bytes = 0;

  for (const character of value) {
    const characterBytes = utf8ByteLength(character.codePointAt(0) ?? 0);
    if (bytes + characterBytes > maxBytes) {
      break;
    }

    capped += character;
    bytes += characterBytes;
  }

  return capped;
}

function utf8ByteLength(codePoint: number): number {
  if (codePoint < 0x80) {
    return 1;
  }
  if (codePoint < 0x800) {
    return 2;
  }
  if (codePoint < 0x10000) {
    return 3;
  }
  return 4;
}
