// Created: 2026-08-27 00:32 UTC
//
// Pure, state-free content-analysis and formatting helpers extracted out of
// `StoryService`. Each function here is a plain transformation of a string
// (and, where noted, a couple of primitives) with no dependency on an AI
// client, the cliffhanger service, or any other collaborator `StoryService`
// wires into its constructor — which is exactly what let the bugs fixed in
// #258/#259/#261 hide for as long as they did, and what forced the tests for
// them to reach into `StoryService`'s private methods via `as any` casts
// instead of calling the logic directly.

import { SpicyLevel, ThemeType } from '../types/contracts';
import { readCreatureDisplayName } from '../../../shared/creatureVocabulary';
import { readSpiceLevelPromptLabel } from '../../../shared/spiceLevelPromptLadder';
import {
  ParsedHtmlTag,
  findCommentEnd,
  findTagEnd,
  findWellFormedTagEnd,
  parseHtmlTag
} from '../../../shared/htmlTagScanner';
import { stripStoryHtmlToText } from '../../../shared/storyTextBlocks';
import { capAtWordBoundary, tailAtWordBoundary } from '../utils/textExcerpt';
import { wholeWordAlternationPattern, wholeWordPattern } from '../utils/wholeWord';

/** The longest `nextChapterHint`, in code points. */
export const NEXT_CHAPTER_HINT_MAX_LENGTH = 200;

/**
 * Reduce story markup to the text a reader sees.
 *
 * Deleting the tags and nothing else closed the gap they held open, so the
 * last word of one paragraph and the first word of the next were read as one
 * token: `<p>She opened the door.</p><p>Blood pooled…</p>` became
 * `door.Blood`. Every caller here is looking for something the reader can
 * point at — a chapter title, a summary of what just happened, the sentence a
 * continuation has to follow on from — and each of them was handed welded
 * text instead. Sentence splitting suffered worst: with no space after the
 * full stop there was nothing for `/(?<=[.!?])\s+/` to split on, so the whole
 * chapter came back as its own final sentence.
 */
export function stripHtml(content: string): string {
  return stripStoryHtmlToText(content);
}

/**
 * Count the words a reader would count.
 *
 * The count is reported to the client as `actualWordCount` and drives the
 * streaming progress percentage, so it has to match the rendered story rather
 * than the markup. Stripping tags in place merged the words on either side of
 * every paragraph break into one, which cost one word per boundary — a
 * chapter of forty `<p>` elements with no whitespace between them reported
 * thirty-nine fewer words than it has, and `<p>one</p><p>two</p>` reported a
 * single word.
 */
export function countWords(content: string): number {
  return stripStoryHtmlToText(content).split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract character names from story content
 */
export function extractCharacterNames(content: string): string[] {
  const speakerMatches = content.match(/\[([^\],]+)(?:,\s*[^\]]+)?\]:/g) || [];
  const names = speakerMatches
    .map(match => match.replace(/\[([^\],]+).*/, '$1').trim())
    .filter(name => name !== 'Narrator');

  // Deduplicate and return
  return [...new Set(names)];
}

/**
 * The open question this scan reads as a thread the chapter left standing.
 *
 * Built through `wholeWordPattern` like the plain keywords beside it rather
 * than carrying its own `\b`, so the phrase asks the same boundary question
 * they do — see `WORD_CHARACTERS` for what `\b` was answering wrong. `\s+`
 * because the two words are separated by whatever whitespace the generator
 * wrote, and the group is non-capturing because nothing reads the match.
 */
const UNRESOLVED_QUESTION_PATTERN = wholeWordPattern(String.raw`what\s+(?:if|would|could)`);

/**
 * The threads this scan can report, and the words that put one on the list.
 *
 * The keywords were five `if`s over a `mentions(...)` helper that asked
 * `containsWholeWord` one word at a time, and `containsWholeWord` compiles a
 * `RegExp` per call — so the whole table was rebuilt as twenty-three patterns
 * on every chapter this scan reads. `wholeWordAlternationPattern` exists to be
 * "compiled once per table by the callers that scan repeatedly, never per
 * call", which is what `CLIFFHANGER_HOOK_PATTERNS` and
 * `PRESSURE_KEYWORD_PATTERNS` already do with it; this file was one of the two
 * that still asked per keyword. The boundary the alternation puts at its ends
 * is the boundary each keyword carried on its own, so what a chapter matches is
 * unchanged.
 *
 * `UNRESOLVED_QUESTION_PATTERN` joins the table rather than staying a fifth
 * `if` below it: it was already a compiled pattern, and it is one more signal
 * with one more thread behind it.
 */
const PLOT_THREAD_SIGNALS: ReadonlyArray<{ thread: string; pattern: RegExp }> = [
  {
    thread: 'Unresolved mystery or secret',
    pattern: wholeWordAlternationPattern(['secret', 'secrets', 'secretly', 'mystery'])
  },
  {
    thread: 'Active threat or danger',
    pattern: wholeWordAlternationPattern([
      'danger', 'dangers', 'dangerous', 'dangerously',
      'threat', 'threats', 'threaten', 'threatens', 'threatened', 'threatening'
    ])
  },
  {
    thread: 'Forbidden relationship tension',
    pattern: wholeWordAlternationPattern(['forbidden', 'impossible'])
  },
  {
    thread: 'Power dynamics in play',
    pattern: wholeWordAlternationPattern([
      'power', 'powers', 'powerful', 'control', 'controls', 'controlled', 'controlling'
    ])
  },
  { thread: 'Unresolved questions', pattern: UNRESOLVED_QUESTION_PATTERN }
];

/**
 * Report the threads a continuation has to carry forward.
 *
 * The result is interpolated into the continuation prompt as
 * `Active Plot Threads`, so what this finds is what the next chapter is told is
 * still open. It was the last scan in this module reading the markup and
 * matching substrings, and both of its siblings above and below have already
 * been moved off both:
 *
 * - **It scanned the markup.** `extractThemesFromContent` and
 *   `extractSpicyLevelFromContent` read `stripHtml(content)` first, so that what
 *   is measured is what the reader sees. Here the cost falls on the one
 *   multi-word pattern: `\bwhat\s+(if|would|could)\b` needs whitespace between
 *   the two words, and a chapter that breaks its paragraph between them —
 *   `what</p><p>if she was lying` — has markup there instead, so the question
 *   the scan exists to notice was invisible whenever the model put it across a
 *   paragraph break.
 * - **It matched substrings.** `secret` is inside `secretary`, `power` inside
 *   `powerless`, and `control` inside `uncontrollable` — and the last of the
 *   five checks, on the same lines, already used `\b`. Whole-word matching is
 *   what makes the other four agree with it, and with the two scans beside them
 *   that were repaired for the same reason.
 *
 * The inflections the substring form picked up for free — `secrets` for
 * `secret`, `dangerous` for `danger`, `threatening` for `threat`, `powerful`
 * for `power`, `controlled` for `control` — are listed rather than lost.
 */
export function extractPlotThreads(content: string): string[] {
  const lowerContent = stripHtml(content).toLowerCase();
  const threads = PLOT_THREAD_SIGNALS
    .filter(signal => signal.pattern.test(lowerContent))
    .map(signal => signal.thread);

  return threads.length > 0 ? threads : ['Character development', 'Relationship progression'];
}

/**
 * The registers this scan can name, and the words that put a chapter in each.
 *
 * A fixed lexicon written beside its own matcher, so — as the story-quality
 * heuristics' `EMOTION_FAMILIES` puts it — every inflection it accepts has to
 * be listed. That is the half of the whole-word repair this scan never got.
 * `dominan` was fixed by spelling out `dominant`, `dominance`, and
 * `dominated`; the other four families kept their bare stems, and a bare stem
 * under `\b…\b` matches only the present-tense dictionary form of the word.
 *
 * Narrative prose is written in the past tense. `smile` does not match
 * "he smiled", `laugh` does not match "she laughed", `desire` does not match
 * "he desired her", `want` does not match "she wanted him", `wound` does not
 * match "the wound had scarred", `danger` does not match "dangerous", and
 * `power` does not match "powerful" — so the tones this function exists to
 * report were unreachable for the way the generator actually writes, and the
 * scan fell through to `romantic with building tension` for chapter after
 * chapter. That string is not cosmetic: `buildContinuationPrompt` writes it
 * into the model's context as `Emotional Tone`, so a chapter of wounds and
 * threats was described to the model as mild romance and continued from there.
 *
 * The stems are unchanged and nothing is added to them; what is written out
 * is the inflections the stems were already meant to stand for, the same way
 * `extractPlotThreads` above lists `dangers`/`dangerous`/`dangerously` and
 * `extractSpicyLevelFromContent` below lists `kissed` for `kiss`.
 */
const EMOTIONAL_TONE_FAMILIES: ReadonlyArray<{ tone: string; terms: readonly string[] }> = [
  {
    tone: 'passionate',
    terms: [
      'desire', 'desired', 'desires', 'desiring',
      'passion', 'passionate', 'passionately', 'passions',
      'want', 'wanted', 'wanting', 'wants',
      'need', 'needed', 'needing', 'needs',
      'crave', 'craved', 'craves', 'craving'
    ]
  },
  {
    tone: 'dark/suspenseful',
    terms: [
      'dark', 'darker', 'darkness',
      'shadow', 'shadowed', 'shadows', 'shadowy',
      'danger', 'dangerous', 'dangerously', 'dangers',
      'fear', 'feared', 'fearful', 'fearing', 'fears',
      'threat', 'threaten', 'threatened', 'threatening', 'threatens', 'threats'
    ]
  },
  {
    tone: 'playful',
    terms: [
      'tease', 'teased', 'teases', 'teasing',
      'playful', 'playfully',
      'smile', 'smiled', 'smiles', 'smiling',
      'grin', 'grinned', 'grinning', 'grins',
      'laugh', 'laughed', 'laughing', 'laughs', 'laughter'
    ]
  },
  {
    tone: 'angsty',
    terms: [
      'pain', 'pained', 'painful', 'pains',
      'ache', 'ached', 'aches', 'aching',
      'hurt', 'hurting', 'hurts',
      'wound', 'wounded', 'wounding', 'wounds',
      'scar', 'scarred', 'scarring', 'scars'
    ]
  },
  {
    tone: 'intense',
    terms: [
      'power', 'powerful', 'powers',
      'control', 'controlled', 'controlling', 'controls',
      'dominance', 'dominant', 'dominated', 'dominating',
      'command', 'commanded', 'commanding', 'commands'
    ]
  }
];

/**
 * Analyze emotional tone of existing content.
 *
 * The scan reads the rendered text rather than the markup, like every other
 * scanner in this file. This one was the last that did not: it lowercased the
 * generator's HTML and matched against that, so a word the model split across
 * an inline tag — `dan<em>ger</em>ous` — was two fragments rather than the
 * word, and the entities the generator writes (`&amp;`, `&nbsp;`) sat in the
 * text undecoded where `stripStoryHtmlToText` would have turned them back into
 * the characters the reader sees. `extractSpicyLevelFromContent` below names
 * the same defect and the same repair; this is the sibling it was still true
 * of.
 *
 * See `EMOTIONAL_TONE_FAMILIES` for the other half — the inflections a
 * whole-word match needs spelled out, without which none of these tones could
 * be reported for prose written in the past tense.
 */
/**
 * One pattern per register, compiled with the table rather than per term on
 * every scan. See `PLOT_THREAD_SIGNALS` for what the per-term form was costing:
 * these five families hold ninety-four terms between them, and each was a
 * `RegExp` built and thrown away for every chapter read.
 */
const EMOTIONAL_TONE_PATTERNS: ReadonlyArray<{ tone: string; pattern: RegExp }> =
  EMOTIONAL_TONE_FAMILIES.map(family => ({
    tone: family.tone,
    pattern: wholeWordAlternationPattern(family.terms)
  }));

export function analyzeEmotionalTone(content: string): string {
  const lowerContent = stripHtml(content).toLowerCase();
  const tones = EMOTIONAL_TONE_PATTERNS
    .filter(family => family.pattern.test(lowerContent))
    .map(family => family.tone);

  return tones.length > 0 ? tones.join(', ') : 'romantic with building tension';
}

/**
 * Where the chapter heading is, read the way a browser reads it.
 *
 * The two callers below each used to spell this as `<h3[^>]*>(.*?)</h3>`, and
 * that spelling gets two things wrong for the same reason — it decides where
 * the opening tag ends by looking for a character rather than by reading the
 * tag:
 *
 * 1. **It ends the tag at the first `>`**, even one inside a quoted attribute
 *    value. `<h3 data-x="a>b">Real Title</h3>` leaves `b">Real Title` as the
 *    captured group, and `stripHtml` cannot clean that up afterwards because
 *    the truncation leaves no tag in it to strip. It reaches the reader as the
 *    chapter's title, and it is what feeds the `Untitled Chapter N` fallback
 *    and the `chapter N` prefix-stripping beside it.
 * 2. **`.` cannot cross a newline**, so a heading with a line break past the
 *    truncation point matches nothing at all. That is the actual defect behind
 *    #296's second row, which had been filed as the same cause as the first:
 *    the strip below then leaves the heading in place and the chapter ships
 *    carrying two of them.
 *
 * `findTagEnd` answers the first question by walking HTML's own start-tag
 * states, so a `>` inside a quoted value is a character rather than the end of
 * the tag, and index arithmetic answers the second by not involving `.` at all.
 * Issue #296 records the two attempts to repair this with a better pattern
 * instead, and why a scanner is the answer rather than a fifth pattern.
 *
 * The reading is otherwise deliberately the one the pattern had: the first
 * `<h3>`, then the first `</h3>` after it. A second `<h3>` in between does not
 * open a nested heading — HTML has no nesting here, and the lazy `.*?` this
 * replaces ran on to the same `</h3>`.
 */
interface ChapterHeading {
  /** Index of the opening tag's `<`. */
  start: number;
  /** Index just past the closing tag's `>`. */
  end: number;
  /** The markup between the two tags. */
  inner: string;
}

interface HeadingTag {
  /** Index of the tag's `<`. */
  start: number;
  /** Index just past the tag's `>`. */
  end: number;
  isClosing: boolean;
}

/**
 * Whether the `<` at `index` opens a tag at all.
 *
 * HTML's tag-open state: an optional `/`, then an ASCII letter. Anything else
 * is text a reader typed, and `2 < 3` in a story is exactly that.
 *
 * Asking this *before* reading a tag is what keeps a stray `<` from consuming
 * the markup after it. `findTagEnd` has no well-formed reading for `< 3`, so it
 * falls back to the first `>` — which is the `>` of the real `<h3>` further on
 * — and a walk that advanced past that end would step over the heading it was
 * looking for. It also settles `< h3>`, which `parseHtmlTag` would otherwise
 * accept by skipping the space: a browser shows those five characters to the
 * reader, so treating them as a heading deletes prose.
 *
 * Deciding it here rather than from the parse also keeps the walk linear. A run
 * of stray `<` costs one character each, instead of a scan to the next `>` per
 * `<`.
 */
function opensATag(content: string, index: number): boolean {
  const nameStart = content[index + 1] === '/' ? index + 2 : index + 1;
  const codePoint = content.codePointAt(nameStart) ?? 0;

  return (codePoint >= 65 && codePoint <= 90) || (codePoint >= 97 && codePoint <= 122);
}

/**
 * Elements whose contents are text rather than markup.
 *
 * Inside one of these nothing is a tag and nothing is a comment until its own
 * closing tag: `<script><!-- legacy\n</script>` carries no comment, and
 * `<textarea><h3>x</h3></textarea>` carries no heading — a browser shows those
 * characters to the reader. Walking into them reads their text as markup, and
 * the `<!--` in the first one then looks like a comment that never ends, which
 * abandons the scan and loses the real heading after it.
 *
 * The raw-text and RCDATA sets together, `noscript` included, which is raw text
 * wherever scripting is enabled. None of these belong in generated story
 * markup; the list is here so that markup which has one is read the way a
 * browser reads it rather than half-parsed.
 */
const RAW_TEXT_TAG_NAMES = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript'
]);

/**
 * The elements whose subtrees are *not* HTML.
 *
 * HTML's raw-text rules stop applying inside one. `<svg><title/></svg>` closes
 * that title immediately — foreign content honours a self-closing `/`, where
 * HTML ignores it — so entering raw-text mode there hunts for a `</title>` that
 * will never come and abandons the scan. `script` and `desc` have the same
 * problem, being SVG element names too.
 *
 * Tracking the namespace rather than honouring `isSelfClosing` everywhere is
 * what keeps the *HTML* reading right: a bare `<title/>` in HTML really does
 * open a raw-text element that runs to the end, and a browser shows no heading
 * after it. The two answers are opposite, and only the namespace separates them.
 */
const FOREIGN_CONTENT_TAG_NAMES = new Set(['svg', 'math']);

/** Depth after this `<svg>`/`<math>` tag; a self-closing one opens nothing. */
function nextForeignDepth(depth: number, parsed: ParsedHtmlTag): number {
  if (parsed.isClosing) {
    return Math.max(0, depth - 1);
  }

  return parsed.isSelfClosing ? depth : depth + 1;
}

/** What may follow a closing tag's name: whitespace, `/`, or its own `>`. */
function endsTagName(character: string | undefined): boolean {
  return (
    character === undefined ||
    character === ' ' ||
    character === '\n' ||
    character === '\t' ||
    character === '\r' ||
    character === '\f' ||
    character === '/' ||
    character === '>'
  );
}

/**
 * Where the raw-text element opened by `tagName` ends, or `-1` if nothing
 * closes it — in which case it runs to the end of the content, exactly as a
 * browser reads it, and there is no heading after it to find.
 *
 * Only that element's own closing tag ends it. Every other `<` inside is one of
 * its characters, which is why this looks for one name rather than tokenizing.
 */
function findRawTextEnd(content: string, tagName: string, index: number): number {
  let cursor = index;

  while (cursor < content.length) {
    const candidate = content.indexOf('<', cursor);
    if (candidate === -1) {
      return -1;
    }

    const nameStart = candidate + 2;
    const isItsClosingTag =
      content[candidate + 1] === '/' &&
      content.slice(nameStart, nameStart + tagName.length).toLowerCase() === tagName &&
      endsTagName(content[nameStart + tagName.length]);

    if (isItsClosingTag) {
      const tagEnd = findTagEnd(content, candidate);

      return tagEnd === -1 ? -1 : tagEnd + 1;
    }

    cursor = candidate + 1;
  }

  return -1;
}

/** A tag the walk found, with where it sits and what it says it is. */
interface ScannedTag {
  /** Index of the tag's `<`. */
  start: number;
  /** Index just past the tag's `>`. */
  end: number;
  parsed: ParsedHtmlTag;
}

/**
 * The next tag at or after `index`, or `null` where the markup runs out.
 *
 * "Tag" is decided here and nowhere else, so the three things that look like
 * one and are not — a comment, a `<` a reader typed, and a construct
 * `parseHtmlTag` refuses — are skipped in one place rather than being three
 * cases the heading walk has to remember.
 *
 * Every tag is read to its end even when it is not the one being looked for,
 * because that is what decides where the *next* one starts: ending
 * `<p class="a>b">` at the first `>` would resume the walk inside an attribute
 * value and read whatever follows as markup.
 */
function nextTag(content: string, index: number): ScannedTag | null {
  let cursor = index;

  while (cursor < content.length) {
    const tagStart = content.indexOf('<', cursor);
    if (tagStart === -1) {
      return null;
    }

    // A comment's body is markup, not prose, so it is skipped whole. One that
    // never closes runs to the end of the content, as a browser reads it.
    if (content.startsWith('<!--', tagStart)) {
      const commentEnd = findCommentEnd(content, tagStart);
      if (commentEnd === -1) {
        return null;
      }

      cursor = commentEnd;
      continue;
    }

    // Text a reader typed, not markup. One character, and on to the next `<`.
    if (!opensATag(content, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }

    const tagEnd = findTagEnd(content, tagStart);
    if (tagEnd === -1) {
      return null;
    }

    cursor = tagEnd + 1;

    const parsed = parseHtmlTag(content.slice(tagStart, cursor));
    if (parsed) {
      return { start: tagStart, end: cursor, parsed };
    }
  }

  return null;
}

/**
 * Whether this tag is a heading boundary the readers may cut on.
 *
 * A *closing* tag decides where the chapter's own prose resumes, so it may not
 * sit on `findTagEnd`'s fallback boundary. `</h3 data-x="a>b"class=x>` has no
 * well-formed reading — the closing quote is followed by a word character — so
 * the fallback ends the tag at the `>` inside the quoted value, and cutting
 * there puts `b"class=x>` at the front of the chapter as visible prose. The
 * pattern this replaces required a literal `</h3>` and so never produced that
 * fragment; declining the boundary answers as it did.
 *
 * The opening tag is deliberately not held to the same rule. There the fallback
 * decides only where the *title* starts, and it reproduces exactly what
 * `[^>]*>` did — a recovery class this reader forgoes, rather than a regression
 * it introduces.
 */
function isHeadingBoundary(content: string, tag: ScannedTag): boolean {
  if (tag.parsed.tagName !== 'h3') {
    return false;
  }

  return !tag.parsed.isClosing || findWellFormedTagEnd(content, tag.start) === tag.end - 1;
}

/**
 * The next `<h3>` or `</h3>` at or after `index`, or `null` where the markup
 * runs out before one.
 */
function nextHeadingTag(content: string, index: number): HeadingTag | null {
  let cursor = index;
  let foreignDepth = 0;

  for (let tag = nextTag(content, cursor); tag !== null; tag = nextTag(content, cursor)) {
    cursor = tag.end;

    if (FOREIGN_CONTENT_TAG_NAMES.has(tag.parsed.tagName)) {
      foreignDepth = nextForeignDepth(foreignDepth, tag.parsed);
      continue;
    }

    if (foreignDepth === 0 && !tag.parsed.isClosing && RAW_TEXT_TAG_NAMES.has(tag.parsed.tagName)) {
      const rawTextEnd = findRawTextEnd(content, tag.parsed.tagName, cursor);
      if (rawTextEnd === -1) {
        return null;
      }

      cursor = rawTextEnd;
      continue;
    }

    if (isHeadingBoundary(content, tag)) {
      return { start: tag.start, end: tag.end, isClosing: tag.parsed.isClosing };
    }
  }

  return null;
}

function findChapterHeading(content: string): ChapterHeading | null {
  let opening: HeadingTag | null = null;

  for (let tag = nextHeadingTag(content, 0); tag !== null; tag = nextHeadingTag(content, tag.end)) {
    if (!tag.isClosing) {
      // The *first* opening tag, so a second one does not restart the heading.
      opening ??= tag;
      continue;
    }

    if (opening !== null) {
      return { start: opening.start, end: tag.end, inner: content.slice(opening.end, tag.start) };
    }
  }

  return null;
}

export function extractChapterTitleAndBody(content: string, chapterNumber: number): { title: string; body: string } {
  const heading = findChapterHeading(content);
  let title = heading ? stripHtml(heading.inner).trim() : '';

  if (title.toLowerCase().startsWith(`chapter ${chapterNumber}`)) {
    title = title.slice(`chapter ${chapterNumber}`.length).replace(/^\s*:?/, '').trim();
  }

  if (!title) {
    title = `Untitled Chapter ${chapterNumber}`;
  }

  // Cut by index rather than `content.replace(match[0], '')`: the heading is
  // located here, so the body is what sits either side of it, and no second
  // search can land somewhere the first did not.
  const body = heading
    ? `${content.slice(0, heading.start)}${content.slice(heading.end)}`.trim()
    : content.trim();

  return { title, body };
}

/**
 * Drop the heading a chapter opens with, so the caller can write its own.
 *
 * Lives here, beside the reader above, rather than in `StoryService` where it
 * was a private method reachable only through a model call — which is why the
 * newline defect described above went unnoticed in it: nothing could call it
 * with a heading to strip without generating a story first.
 *
 * Only a *leading* heading is dropped. Anything but whitespace before it means
 * the chapter's own prose starts first, and then the heading is part of the
 * chapter rather than the title being replaced.
 */
export function stripLeadingChapterHeading(content: string): string {
  const heading = findChapterHeading(content);
  if (!heading || content.slice(0, heading.start).trim() !== '') {
    return content.trim();
  }

  return content.slice(heading.end).trim();
}

/**
 * The last sentence of a chapter, as the hint for what comes next.
 *
 * Measured and cut in code points. `candidate.slice(0, 197)` counted UTF-16
 * code units, so a hint whose 197th unit fell between the halves of a
 * surrogate pair ended on a lone surrogate — and the story this app writes is
 * one whose prose carries the occasional astral character. The cut also landed
 * mid-word wherever it landed, which is what `capAtWordBoundary` is for.
 */
export function generateNextChapterHint(content: string): string {
  const text = stripHtml(content).replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const candidate = (sentences[sentences.length - 1] || text).trim();

  return Array.from(candidate).length > NEXT_CHAPTER_HINT_MAX_LENGTH
    ? `${capAtWordBoundary(candidate, NEXT_CHAPTER_HINT_MAX_LENGTH - 3)}...`
    : candidate;
}

/**
 * The tail of everything written so far, shown to the model as
 * `PREVIOUS CHAPTER EXCERPT` when it continues the story.
 *
 * `text.slice(-maxLength)` cut at the front, in code units, so the excerpt
 * could begin on the second half of a surrogate pair — and began mid-word
 * whatever it began on, which is the first thing the model reads.
 */
export function createContextExcerpt(html: string, maxLength: number = 1200): string {
  const text = stripHtml(html || '').replace(/\s+/g, ' ').trim();

  return tailAtWordBoundary(text, maxLength);
}

/**
 * Name the creature to the model, as `PROTAGONIST: …`.
 *
 * The ten-entry map this used to hold is now `shared/creatureVocabulary`, which
 * the request validator and the Proving Grounds preview of this same prompt
 * slot also read. Behaviour is unchanged, `'Creature'` fallback included.
 */
export function getCreatureDisplayName(creature: string): string {
  return readCreatureDisplayName(creature);
}

/**
 * Name the spice level to the model, as `SPICE LEVEL: … (Level n/5)`.
 *
 * The five labels are now `shared/spiceLevelPromptLadder`, beside the
 * system-prompt block that defines what each of them permits — and read by the
 * Proving Grounds, whose own copy named all five levels something else. See
 * that module.
 */
export function getSpicyLabel(level: number): string {
  return readSpiceLevelPromptLabel(level);
}


/**
 * Report which of the reader's themes the new chapters carried on.
 *
 * The result is returned to the caller as `themesContinued`, which the
 * contract types as `ThemeType[]` — the same closed set of eighteen ids the
 * form offers and `VALIDATION_RULES.themes.allowedValues` lists. Two things
 * kept it from being one:
 *
 * - When nothing matched, the answer was `['romance', 'fantasy']`. Neither is
 *   a theme: no chapter can be generated with either, no theme picker can
 *   render either, and a caller mapping the ids back to labels gets nothing
 *   for both. It is also not the honest answer — "no configured theme was
 *   detected" is — and because a scan this coarse usually matches something,
 *   the case it fired in was the one where the scan had found nothing to say.
 * - Six of the eighteen themes had no keywords at all, so `dominance`,
 *   `submission`, `temptation`, `sin`, `lust`, and `deceit` could never be
 *   reported however plainly a chapter carried them: a scene naming all six
 *   came back as `power_dynamics, desire`. `lust` was worse than absent — it
 *   sat in `desire`'s keyword list, so the word was credited to a theme the
 *   reader may not have chosen while its own theme stayed unreachable.
 *
 * Keying the table by `ThemeType` is what stops the second from returning: a
 * theme added to the contract without keywords here is now a compile error
 * rather than a silent blind spot. The declared return type does the same for
 * the first.
 *
 * The scan reads the rendered text rather than the markup, like every other
 * scanner here — the multi-word keywords (`secret love`, `star-crossed`,
 * `false promise`) are the ones a welded `door.</p><p>Blood` boundary hides.
 *
 * Keywords are matched as whole words rather than as substrings, which is
 * what makes the six new entries safe to state plainly: `sin` as a substring
 * is in `rising`, `using`, and `singing`, and `lust` is in `lustre`, so under
 * the old matching the only way to add those themes would have been to spell
 * them as something other than their own names. The inflections the substring
 * form used to pick up for free — `secrets` for `secret`, `powerful` for
 * `power` — are listed instead. `used` is gone from `manipulation`: an
 * ordinary "she used the key" is not a story about being used, and it was the
 * loosest keyword in the table.
 */
// Ordered as `VALIDATION_RULES.themes.allowedValues` orders them, so the same
// chapter always reports the same list in the same order.
//
// At module scope, and compiled to one pattern per theme, rather than rebuilt
// inside the scan: this record of eighteen themes and ninety-eight keywords was
// a function-local literal, so both the table and a `RegExp` for every keyword
// in it were constructed again for every chapter this function reads — on a
// path that reads every chapter of every continuation. See `PLOT_THREAD_SIGNALS`
// for the reading, which is unchanged.
const THEME_KEYWORDS: Record<ThemeType, readonly string[]> = {
  betrayal: ['betrayed', 'betrayal', 'deceived', 'backstabbed', 'treachery', 'double-crossed'],
  obsession: ['obsessed', 'obsession', 'possessed', 'consumed', 'fixated', 'addicted'],
  power_dynamics: ['power', 'powers', 'powerful', 'control', 'authority', 'command', 'leverage'],
  forbidden_love: ['forbidden', 'secret love', 'star-crossed', 'illicit', 'taboo'],
  revenge: ['revenge', 'vengeance', 'retribution', 'payback', 'avenge', 'avenged'],
  manipulation: ['manipulated', 'manipulation', 'controlled', 'exploited', 'influenced'],
  seduction: ['seduced', 'seduction', 'allured', 'enticed', 'charmed', 'coaxed'],
  dark_secrets: ['secret', 'secrets', 'hidden', 'mysterious', 'concealed', 'buried'],
  corruption: ['corrupted', 'corruption', 'tainted', 'fallen', 'darkness', 'evil'],
  dominance: ['dominance', 'dominant', 'dominated', 'dominion', 'mastery'],
  submission: ['submission', 'submitted', 'submissive', 'yielded', 'knelt', 'obeyed'],
  jealousy: ['jealous', 'jealousy', 'envious', 'possessive', 'resentful', 'covetous'],
  temptation: ['tempted', 'temptation', 'tempting', 'lured', 'beckoned'],
  sin: ['sin', 'sins', 'sinful', 'sinner', 'damnation', 'damned', 'penance'],
  desire: ['desire', 'desires', 'yearning', 'craving', 'longing', 'wanting'],
  passion: ['passionate', 'passion', 'intense', 'burning', 'fiery', 'ardent'],
  lust: ['lust', 'lustful', 'lusted', 'carnal', 'ravenous'],
  deceit: ['deceit', 'deceitful', 'lied', 'lying', 'false promise']
};

const THEME_PATTERNS: ReadonlyArray<[ThemeType, RegExp]> =
  (Object.entries(THEME_KEYWORDS) as Array<[ThemeType, readonly string[]]>)
    .map(([theme, keywords]) => [theme, wholeWordAlternationPattern(keywords)]);

export function extractThemesFromContent(content: string): ThemeType[] {
  const lowerContent = stripHtml(content).toLowerCase();

  return THEME_PATTERNS
    .filter(([, pattern]) => pattern.test(lowerContent))
    .map(([theme]) => theme);
}

/**
 * The spice level a batch of chapters actually reads at.
 *
 * The answer travels: it is `spicyLevelMaintained` on the continuation
 * response, and `buildContinuationPayload` writes it into a new story's
 * `StorySummary.spicyLevel` — the level the project is then stored and
 * reopened under. So a misread here is not a cosmetic number beside the
 * prose; it is what the library says the story is.
 *
 * Its sibling `extractThemesFromContent` directly above scans the rendered
 * text with whole-word matching. This one did neither, and the two failures
 * compound:
 *
 * - **It scanned the markup.** Every other scanner here — the cliffhanger
 *   service, the image service, the continuity extractor, the story-quality
 *   heuristics, and `extractThemesFromContent` beside it — reads
 *   `stripStoryHtmlToText` first, so that what is measured is what the
 *   reader sees: block tags become paragraph breaks and the entities the
 *   generator writes are decoded. Undecoded, `intense&nbsp;passion` is not
 *   the phrase `intense passion` at all, and the one multi-word keyword the
 *   scan has matched nothing whenever the model spaced it that way.
 * - **It matched substrings.** `heart` is inside `hearth`, `love` inside
 *   `glove` and `clover`, `touch` inside `untouched`, `heat` inside
 *   `sheath` and `wheat`, and `climax` inside `anticlimax` — so a chaste
 *   scene at a hearth in wool gloves was filed as level 2, a chapter that
 *   ends `he left her untouched` as level 3, and one that calls a duel an
 *   anticlimax as level 5, the maximum, on the strength of a word that says
 *   the opposite. The story then reopens at that level, and the reader who
 *   set the dial themselves is the one contradicted.
 *
 * Keywords are matched as whole words for the same reason
 * `extractThemesFromContent` was changed to: it is the only way to state
 * `heat` or `love` as itself. The inflections the substring form picked up
 * for free — `kissed` for `kiss`, `caressing` for `caress`, `desired` for
 * `desire` — are listed instead, so the repair does not quietly cost the
 * scan the matches it did get right. What it does not carry over is the rest
 * of what the substrings caught: `lovely` is not `love`, `gentleman` is not
 * `gentle`, and `hearth` is not `heart`. Those are the defect, not coverage.
 */
/**
 * The ladder this scan reads, hottest rung first, compiled once.
 *
 * Four `const` arrays inside the function and a `RegExp` per keyword per call,
 * for the reason `PLOT_THREAD_SIGNALS` and `THEME_KEYWORDS` give — this is the
 * fourth and last scan in the file that was rebuilding its table on every
 * chapter, and the largest, at fifty-three keywords. The rungs are read in
 * order and the first that matches wins, which is what the fall-through chain
 * of `if`s did.
 *
 * The `level` is typed from `SpicyLevel` rather than cast to it at each
 * `return`, which is what the four `as SpicyLevel` assertions this replaces
 * were for: a bare numeric literal has no relationship to the scale, so the
 * only way to hand one back under that type was to assert it. Named in a table
 * whose entries the compiler checks, `6` is a type error here rather than an
 * assertion nobody would question.
 */
const SPICE_LEVEL_KEYWORD_PATTERNS: ReadonlyArray<{ level: SpicyLevel; pattern: RegExp }> = [
  {
    // Level 5 - Very Explicit
    level: 5,
    pattern: wholeWordAlternationPattern([
      'explicit', 'explicitly', 'graphic', 'graphically', 'intense passion',
      'climax', 'climaxed', 'climaxes', 'ecstasy'
    ])
  },
  {
    // Level 4 - Passionate
    level: 4,
    pattern: wholeWordAlternationPattern([
      'passionate', 'passionately', 'breathless', 'breathlessly',
      'desire', 'desires', 'desired', 'yearning', 'heat', 'heated'
    ])
  },
  {
    // Level 3 - Romantic with Heat
    level: 3,
    pattern: wholeWordAlternationPattern([
      'kiss', 'kissed', 'kisses', 'kissing',
      'embrace', 'embraced', 'embraces', 'embracing',
      'caress', 'caressed', 'caresses', 'caressing',
      'touch', 'touched', 'touches', 'touching',
      'intimate', 'intimately'
    ])
  },
  {
    // Level 2 - Sweet Romance
    level: 2,
    pattern: wholeWordAlternationPattern([
      'love', 'loved', 'loves', 'lover', 'lovers', 'loving',
      'affection', 'affections', 'affectionate',
      'tender', 'tenderly', 'tenderness',
      'gentle', 'gently', 'heart', 'hearts'
    ])
  }
];

/** Level 1 - Mild: what a chapter matching no rung above reads at. */
const MILDEST_DETECTED_SPICY_LEVEL: SpicyLevel = 1;

export function extractSpicyLevelFromContent(content: string): SpicyLevel {
  const lowerContent = stripHtml(content).toLowerCase();

  return SPICE_LEVEL_KEYWORD_PATTERNS.find(rung => rung.pattern.test(lowerContent))?.level
    ?? MILDEST_DETECTED_SPICY_LEVEL;
}

export function formatStoryContent(content: string): string {
  // Enhanced formatting for better readability
  let formatted = content;

  // If no HTML formatting exists, apply smart formatting
  if (!content.includes('<h3>') && !content.includes('<p>')) {
    // Extract title if present (first line typically).
    //
    // Only the blank lines *before* the title are dropped. Dropping all of
    // them — `split('\n').filter(line => line.trim())` — took out the very
    // separators the paragraph split below looks for, so rejoining the
    // remainder produced a body with no blank line left anywhere in it and
    // `split('\n\n')` returned the whole story as one block. Every paragraph
    // the model wrote was then welded into a single `<p>`, and only for a
    // story that opens with a title line: the same story without one kept its
    // paragraphs, because that branch never touched the lines. This is the
    // path a plain-text answer from the provider takes on its way to the
    // reader, so what the reader saw was the chapter as one unbroken wall.
    const lines = content.split('\n');
    const titleIndex = lines.findIndex(line => line.trim());
    const firstLine = titleIndex === -1 ? undefined : lines[titleIndex]?.trim();

    // Check if first line looks like a title (short, no punctuation except colon)
    const isTitle = firstLine && firstLine.length < 80 && !firstLine.endsWith('.') && !firstLine.startsWith('[');

    if (isTitle) {
      formatted = `<h3>${firstLine}</h3>\n\n` + lines.slice(titleIndex + 1).join('\n');
    }

    // Split into paragraphs based on multiple newlines or speaker changes
    formatted = formatted
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .split('\n\n')
      .filter(para => para.trim())
      .map(para => para.trim())
      .map(para => {
        // Skip if already has HTML tags
        if (para.includes('<')) return para;

        // Wrap in paragraph tags
        return `<p>${para}</p>`;
      })
      .join('\n\n');
  }

  return formatted;
}

export function formatChapterContent(content: string): string {
  // Enhanced chapter formatting to match story formatting
  let formatted = content;

  // If no HTML formatting exists, apply smart formatting
  if (!content.includes('<h3>') && !content.includes('<p>')) {
    // Split into paragraphs based on multiple newlines
    formatted = formatted
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .split('\n\n')
      .filter(para => para.trim())
      .map(para => para.trim())
      .map(para => {
        // Skip if already has HTML tags
        if (para.includes('<')) return para;

        // Wrap in paragraph tags
        return `<p>${para}</p>`;
      })
      .join('\n\n');
  }

  return formatted;
}

/**
 * The words that open a new beat, and so a new paragraph.
 *
 * The list is unchanged. What changes is where and how it is read, because the
 * test it was written into got both wrong:
 *
 * ```
 * trimmedLine.includes('Later') || ... || /^(The|As|But|However|Still)/i.test(trimmedLine)
 * ```
 *
 * **The anchored half had no word boundary**, so it fired on the words that
 * merely *begin* with one of these — and the ones it catches are the commonest
 * openers in narrative prose. `The` is inside `They`, `Them`, `Their`,
 * `Theatre`; `As` is inside `Asked`, `Aside`, `Ashes`, `Astonished`; `But` is
 * inside `Butler`, `Button`; `Still` is inside `Stillness`. A run of ordinary
 * sentences — "She set the cup down. / They had not spoken since. / Butler
 * waited by the stair." — was therefore broken into a paragraph per line, which
 * is the opposite of the welding this method's blank-line branch exists to
 * prevent and just as wrong: the reader is shown a chapter chopped into
 * one-sentence stubs wherever the prose happens to use a pronoun.
 *
 * **The `includes` half was not anchored at all**, so a line was declared a
 * shift for a word anywhere inside it. The break this test decides goes *before
 * the whole line*, so a mid-line `Then` or `Later` — "She waited. Then he
 * spoke." — put the break in a place the word never justified.
 *
 * So the rule is one pattern: the line *opens* with one of these words, as a
 * whole word. That is the same reading `wholeWordAlternationPattern` above
 * already applies to the theme and emotion scans, anchored at the start because
 * "opens a new beat" is what this test means.
 *
 * The pattern stays case-insensitive, as the anchored half always was: the
 * lines reaching here are model prose, where a beat can open mid-sentence after
 * a speaker tag has been stripped.
 */
const NARRATIVE_SHIFT_OPENERS = [
  'later',
  'meanwhile',
  'suddenly',
  'then',
  'the',
  'as',
  'but',
  'however',
  'still'
];
/**
 * The openers, as whole words, at the start of the line.
 *
 * The docblock above says this applies "the same reading
 * `wholeWordAlternationPattern` above already applies … anchored at the start",
 * and it did not: it was `\b`, which is defined against `[A-Za-z0-9_]` and so
 * finds a boundary between an ASCII letter and an accented one. A line opening
 * on a word this list is a prefix of matched whenever the letter that continued
 * it carried an accent — `Théâtre` typed in decomposed form (`The` followed by a
 * combining acute) opened on `the` and started a new paragraph in the middle of
 * a sentence. The precomposed spelling of the same word did not, so the split a
 * reader saw depended on how the model happened to encode one character.
 *
 * Built from the shared matcher's own source rather than respelling its class,
 * so there is one answer to where a word ends. The `^` supplies the opening
 * boundary the anchor already guarantees, which is why the pattern's leading
 * lookbehind is redundant here and harmless — it is trivially true at index 0.
 * `u` comes with the `\p{…}` classes; `i` is the flag this test always had, and
 * the reason the shared helper cannot simply be used as it stands.
 *
 * One consequence of `u` worth naming rather than discovering: `iu` together do
 * Unicode case folding where `i` alone does not, so a line opening `ſtill` (the
 * long s) now reads as the opener `still`. That is the same word, so it is the
 * direction this test wants, and it is reachable only from text the generator
 * has no reason to emit — but it is a behaviour change, not just a boundary fix.
 */
const NARRATIVE_SHIFT_OPENING_PATTERN = new RegExp(
  String.raw`^${wholeWordAlternationPattern(NARRATIVE_SHIFT_OPENERS).source}`,
  'iu'
);

/**
 * How short a line has to be to read as a beat marker rather than as prose.
 * Unchanged from the `< 50` it replaces; named so the two halves of the test
 * are both legible.
 */
const NARRATIVE_SHIFT_MAX_LINE_LENGTH = 50;

export function stripSpeakerTagsForDisplay(content: string): string {
  // Enhanced speaker tag removal with better text formatting
  let displayContent = content;

  // Remove speaker tags but preserve structure
  displayContent = displayContent
    .replace(/\[([^\]]+?)\]:\s*/g, '') // Remove speaker tags like [Narrator]: [Character, emotion]:
    .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
    .trim();

  // Smart paragraph creation based on content structure.
  //
  // The blank lines have to survive the split. Filtering them out here left
  // the branch below — the one that reads a blank line as the paragraph break
  // it is — unreachable, so the only breaks this method could ever make were
  // the ones the dialogue and narrative-shift heuristics guessed at. A model
  // that separated its paragraphs the ordinary way, with a blank line and no
  // opening quote or `Suddenly` to give itself away, had every one of them
  // welded into a single `<p>`: the reader was shown the chapter as one
  // unbroken block, and the paragraph structure the generator had actually
  // written was thrown away before anything downstream could read it.
  const lines = displayContent.split('\n');
  const paragraphs = [];
  let currentParagraph = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Empty line indicates paragraph break
    if (!trimmedLine) {
      if (currentParagraph) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      continue;
    }

    // Start new paragraph for dialogue or narrative shifts
    const isDialogue = trimmedLine.startsWith('"') || trimmedLine.includes('"');
    const isNarrativeShift = trimmedLine.length < NARRATIVE_SHIFT_MAX_LINE_LENGTH
      && NARRATIVE_SHIFT_OPENING_PATTERN.test(trimmedLine);

    if (currentParagraph && (isNarrativeShift || (isDialogue && !currentParagraph.includes('"')))) {
      paragraphs.push(currentParagraph.trim());
      currentParagraph = trimmedLine;
    } else {
      currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
    }
  }

  // Add final paragraph
  if (currentParagraph) {
    paragraphs.push(currentParagraph.trim());
  }

  // Format paragraphs with proper HTML
  const formattedParagraphs = paragraphs
    .filter(para => para.length > 0)
    .map(para => {
      // Clean up any extra spacing
      para = para.replace(/\s+/g, ' ').trim();

      // Wrap in paragraph tags if not already formatted
      if (!para.startsWith('<') && !para.includes('<p>')) {
        return `<p>${para}</p>`;
      }
      return para;
    });

  return formattedParagraphs.join('\n\n');
}
