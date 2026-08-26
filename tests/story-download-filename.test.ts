#!/usr/bin/env tsx
// Created: 2026-08-26 UTC

import {
  STORY_DOWNLOAD_FILENAME_FALLBACK_STEM,
  STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES,
  buildStoryDownloadFilename,
  buildStoryDownloadFilenameStem
} from '../shared/storyDownloadFilename';
import { assert } from './assert';

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

// ==================== THE ORDINARY NAME IS UNCHANGED ====================
// A Latin title slugs exactly as it always did: lowercased, one separator per
// run of punctuation or whitespace, no separator left at either end.
const unchanged: Array<[string, string]> = [
  ['The Blood Oath', 'the-blood-oath'],
  ['  Mira & the Door  ', 'mira-the-door'],
  ['Chapter 2: What She Owed', 'chapter-2-what-she-owed'],
  ['Hyphen--Heavy___Title', 'hyphen-heavy-title']
];

for (const [title, expected] of unchanged) {
  assert(
    buildStoryDownloadFilenameStem(title) === expected,
    `${JSON.stringify(title)} should slug to ${expected}, got ${buildStoryDownloadFilenameStem(title)}`
  );
}

// ==================== A NON-LATIN TITLE KEEPS ITS NAME ====================
// Keeping only ASCII letters and digits left these with no stem at all, so
// every one of them downloaded as the fallback and collided with every other:
// the reader who most needs the name got the same name every time.
const nonLatin = ['Мира и договор', '美咲の契約', 'Ελένη', 'الوعد الدامي'];
const nonLatinStems = nonLatin.map(buildStoryDownloadFilenameStem);

for (let index = 0; index < nonLatin.length; index += 1) {
  const stem = nonLatinStems[index]!;
  assert(
    stem !== STORY_DOWNLOAD_FILENAME_FALLBACK_STEM,
    `a title written as ${nonLatin[index]} should not fall back to the shared stem, got ${stem}`
  );
  assert(stem.length > 0, `a title written as ${nonLatin[index]} should produce a stem`);
}

assert(
  new Set(nonLatinStems).size === nonLatin.length,
  `non-Latin titles should produce distinct stems, got ${JSON.stringify(nonLatinStems)}`
);

// The separator run between the words is still collapsed to a single `-`.
assert(
  buildStoryDownloadFilenameStem('Мира и договор') === 'мира-и-договор',
  `a Cyrillic title should keep its words, got ${buildStoryDownloadFilenameStem('Мира и договор')}`
);

// ==================== COMBINING MARKS BELONG TO THEIR WORD ====================
// Retaining only letters and numbers reads every combining mark as a separator,
// which cuts a word apart at each one — `मेरी कहानी` came back as `म-र-कह-न`,
// not shortened but corrupted, with the vowel signs deleted and hyphens left
// where they had been. That is worse than the fallback it replaced: the name
// looks like a slug of the title rather than like nothing at all.
const markedTitles: Array<[string, string]> = [
  ['मेरी कहानी', 'मेरी-कहानी'],
  ['เรื่องของฉัน', 'เรื่องของฉัน'],
  ['مُذَكِّرَة', 'مُذَكِّرَة']
];

for (const [title, expected] of markedTitles) {
  assert(
    buildStoryDownloadFilenameStem(title) === expected,
    `${title} should keep its combining marks, got ${buildStoryDownloadFilenameStem(title)}`
  );
}

// The same title typed in decomposed form is the same title, so it has to reach
// the same name — not one with the accent dropped and the word split at it.
assert(
  buildStoryDownloadFilenameStem('José'.normalize('NFD'))
    === buildStoryDownloadFilenameStem('José'.normalize('NFC')),
  'a decomposed title should slug the same as its precomposed spelling'
);

// ==================== THE FALLBACK IS STILL THERE ====================
// A title with no letter or number anywhere in it has nothing to slug, and an
// empty filename is not a filename.
for (const title of ['', '   ', '***', '!!! ??? ...']) {
  assert(
    buildStoryDownloadFilenameStem(title) === STORY_DOWNLOAD_FILENAME_FALLBACK_STEM,
    `${JSON.stringify(title)} should fall back to the shared stem`
  );
}

// A mark on its own is not a name. Retaining marks is right for one attached to
// a letter and wrong for one left behind when the character it followed was a
// separator: `❤️` is U+2764 plus the U+FE0F variation selector, which is a
// nonspacing mark, so the selector survived alone and the story downloaded as
// `️.html` — a stem of one invisible character, and the same one for every
// emoji-only title, which is the collision the fallback exists to prevent.
for (const title of ['❤️', '👍🏽', '🎃🎃', '✅', '— ❤️ —']) {
  assert(
    buildStoryDownloadFilenameStem(title) === STORY_DOWNLOAD_FILENAME_FALLBACK_STEM,
    `${title} has no letter or number and should fall back, got ${JSON.stringify(buildStoryDownloadFilenameStem(title))}`
  );
}

// A title that pairs one with real words keeps the words and drops the orphan.
assert(
  buildStoryDownloadFilenameStem('❤️ Love') === 'love',
  `an emoji beside a word should leave the word, got ${JSON.stringify(buildStoryDownloadFilenameStem('❤️ Love'))}`
);

// ==================== THE NAME FITS THE FILESYSTEM ====================
// `<stem>.html` has to fit inside the 255-byte limit ext4 and APFS enforce.
// Nothing used to bound the stem, so a long model-written title produced a name
// the save fails or silently truncates on.
const longLatinTitle = 'The Blood Oath and the Very Long Night That Followed It '.repeat(20);
const longLatinStem = buildStoryDownloadFilenameStem(longLatinTitle);

assert(
  utf8Bytes(longLatinStem) <= STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES,
  `a long title should be capped, got ${utf8Bytes(longLatinStem)} bytes`
);
assert(
  !longLatinStem.endsWith('-'),
  `the cap should not strand a trailing separator, got ${longLatinStem}`
);
assert(
  utf8Bytes(buildStoryDownloadFilename(longLatinTitle)) <= 255,
  'the whole filename should fit inside the 255-byte filesystem limit'
);

// The cap is measured in UTF-8 bytes rather than code units, which is the whole
// point: a script that is three bytes per character is exactly the case a
// character cap gets wrong, and it is the same case the fix above is about.
const longCyrillicTitle = 'Мира и договор крови в очень длинную ночь '.repeat(20);
const longCyrillicStem = buildStoryDownloadFilenameStem(longCyrillicTitle);

assert(
  utf8Bytes(longCyrillicStem) <= STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES,
  `a long Cyrillic title should be capped by bytes, got ${utf8Bytes(longCyrillicStem)} bytes`
);
assert(
  longCyrillicStem.length > 0,
  'a long Cyrillic title should still keep a readable stem'
);

// A cut never lands inside a character: an astral code point is kept whole or
// dropped whole, so the name cannot come back carrying U+FFFD.
const astralTitle = `${'a'.repeat(STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES - 2)}𐌰𐌱𐌲`;
const astralStem = buildStoryDownloadFilenameStem(astralTitle);

assert(
  utf8Bytes(astralStem) <= STORY_DOWNLOAD_FILENAME_STEM_MAX_BYTES,
  `an astral title should be capped, got ${utf8Bytes(astralStem)} bytes`
);
assert(
  !astralStem.includes('�') && !/[\uD800-\uDFFF]/.test(astralStem.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')),
  `the cap should not split a surrogate pair, got ${JSON.stringify(astralStem)}`
);

// ==================== THE EXTENSION ====================
assert(
  buildStoryDownloadFilename('The Blood Oath') === 'the-blood-oath.html',
  'the download filename should be the stem plus the html extension'
);

console.log('Story download filename tests passed');
