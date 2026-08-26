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
 * A run of anything that is not part of a word, in any script. Matching on the
 * Unicode properties rather than on `[^a-z0-9]` is what keeps a non-Latin title
 * from slugging to nothing at all.
 *
 * `\p{M}` — the combining marks — has to be in the retained set beside the
 * letters and numbers, or the claim above holds only for the scripts that
 * happen to be written in precomposed characters. A mark is not a letter, so
 * without it every mark is read as a separator and the word it belongs to is
 * cut apart at each one: `मेरी कहानी` came back as `म-र-कह-न` and
 * `เรื่องของฉัน` as `เร-องของฉ-น` — not shortened but corrupted, the vowels and
 * tone marks deleted and hyphens left where they had been. It is not only the
 * scripts that require marks, either: the same title typed in decomposed form
 * (`José` as `Jose` plus a combining acute) would lose its accent where the
 * precomposed spelling keeps it.
 *
 * Retaining marks is what stops that deletion, and normalizing is what makes
 * the two spellings one name — the marks are kept either way, but `é` and `e` +
 * U+0301 are different strings, so without `NFC` one story downloads under two
 * names depending on how its title happened to be typed. Devanagari, Thai, and
 * Arabic marks do not compose away under `NFC`, which is why both are needed
 * rather than either alone.
 */
const FILENAME_SEPARATOR_PATTERN = /[^\p{L}\p{N}\p{M}]+/u;

/**
 * What a part of the name has to contain to be worth keeping.
 *
 * Retaining marks is right for a mark attached to a letter and wrong for one
 * left on its own, and the split above cannot tell the two apart: a symbol is a
 * separator, so `❤️` — U+2764 followed by the U+FE0F variation selector, which
 * is a nonspacing mark — split into a part holding nothing but the selector.
 * On its own that produced `️.html`, a stem of one invisible character and the
 * same one for every emoji-only title, which is the collision the fallback
 * exists to prevent. Beside a word it produced `️-love.html`, where the
 * invisible part is still there and now has a separator after it.
 *
 * So the rule is applied per part rather than to the finished stem: a run with
 * no letter and no number in it is not a word of the title and is dropped, and
 * if that leaves nothing the fallback answers. Stating it as the property a
 * name needs, rather than as a rule about which marks may follow what, is what
 * makes it hold for whatever else punctuation, symbols, and marks combine into.
 */
const FILENAME_PART_HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;

export function buildStoryDownloadFilenameStem(title: string): string {
  // Splitting on the separator runs and joining the parts back collapses each
  // run and drops the leading and trailing ones in a single linear pass, the
  // way the export filename stem and the continuity slug are both built.
  const parts = title
    .normalize('NFC')
    .toLowerCase()
    .split(FILENAME_SEPARATOR_PATTERN)
    .filter(part => FILENAME_PART_HAS_WORD_CHARACTER.test(part));
  const capped = capUtf8Bytes(parts.join('-'), STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES);
  // The join leaves single separators, so the cap can strand at most one — a
  // single slice says that, where the loop `ExportService` needs for its own
  // stem says only that some unknown number may be there.
  const stem = capped.endsWith('-') ? capped.slice(0, -1) : capped;

  // The cap can still leave a tail of only the leading marks of a part it cut
  // into, so the finished stem is checked as well as each part.
  return FILENAME_PART_HAS_WORD_CHARACTER.test(stem) ? stem : STORY_DOWNLOAD_FILENAME_FALLBACK_STEM;
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
