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
import { splitStoryIntoTextBlocks, stripStoryHtmlToText } from '../../../shared/storyTextBlocks';
import { capAtWordBoundary, tailAtWordBoundary } from '../utils/textExcerpt';

/** The longest `nextChapterHint`, in code points. */
export const NEXT_CHAPTER_HINT_MAX_LENGTH = 200;

/** How much of the closing passage a continuation prompt is shown as "what just happened", in words. */
export const SUMMARY_WORD_LIMIT = 150;

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
 * Extract summary of last chapter/section
 */
export function extractLastChapterSummary(content: string): string {
  // Stories arrive as generator HTML, where a paragraph is a `<p>` element
  // rather than a run of text between blank lines. Splitting the stripped
  // text on blank lines therefore found exactly one paragraph — the whole
  // story — and "the last three paragraphs, truncated to 150 words" became
  // "the story's opening 150 words". That summary is what the continuation
  // prompt is told just happened, so a chapter continued from the beginning.
  const paragraphs = splitStoryIntoTextBlocks(content);

  if (paragraphs.length === 0) return 'Story beginning';

  // Get last 2-3 paragraphs as summary
  const lastParagraphs = paragraphs.slice(-3).join(' ');

  // Truncate to ~150 words
  const words = lastParagraphs.split(/\s+/);
  const summary = words.slice(0, SUMMARY_WORD_LIMIT).join(' ');

  // Whether the cut happened is a question about the words, not about the
  // lengths of two strings. Joining on single spaces is itself shortening —
  // any line break or double space inside the paragraphs comes back as one
  // character — so comparing lengths reported a truncation for a summary that
  // holds the whole passage. The marker is what tells the continuation prompt
  // that the chapter it is being handed stops mid-thought, and the model is
  // then prompted to resume from a sentence that had in fact already ended.
  return words.length > SUMMARY_WORD_LIMIT ? summary + '...' : summary;
}

/**
 * Extract active plot threads and unresolved elements
 */
export function extractPlotThreads(content: string): string[] {
  const threads: string[] = [];
  const lowerContent = content.toLowerCase();

  // Check for common plot thread indicators
  if (lowerContent.includes('secret') || lowerContent.includes('mystery')) {
    threads.push('Unresolved mystery or secret');
  }
  if (lowerContent.includes('danger') || lowerContent.includes('threat')) {
    threads.push('Active threat or danger');
  }
  if (lowerContent.includes('forbidden') || lowerContent.includes('impossible')) {
    threads.push('Forbidden relationship tension');
  }
  if (lowerContent.includes('power') || lowerContent.includes('control')) {
    threads.push('Power dynamics in play');
  }
  if (lowerContent.match(/\bwhat\s+(if|would|could)\b/)) {
    threads.push('Unresolved questions');
  }

  return threads.length > 0 ? threads : ['Character development', 'Relationship progression'];
}

/**
 * Analyze emotional tone of existing content
 *
 * `dominan` was a word stem left behind from a substring scan, and every
 * keyword here is matched as a whole word. Nothing in English is spelled
 * `dominan`, so the alternative could never fire: the one register the
 * `intense` tone exists to name — a chapter written about dominance — was
 * recognised only if it also happened to say `power`, `control`, or
 * `command`, and a scene that says `dominant` and nothing else was reported
 * to the continuation prompt as `romantic with building tension`. The
 * inflections the stem stood for are spelled out instead, which is the same
 * repair `extractThemesFromContent` made when it moved to whole-word
 * matching.
 */
export function analyzeEmotionalTone(content: string): string {
  const lowerContent = content.toLowerCase();
  const tones: string[] = [];

  // Emotional indicators
  if (lowerContent.match(/\b(desire|passion|want|need|crave)\b/)) tones.push('passionate');
  if (lowerContent.match(/\b(dark|shadow|danger|fear|threat)\b/)) tones.push('dark/suspenseful');
  if (lowerContent.match(/\b(tease|playful|smile|grin|laugh)\b/)) tones.push('playful');
  if (lowerContent.match(/\b(pain|ache|hurt|wound|scar)\b/)) tones.push('angsty');
  if (lowerContent.match(/\b(power|control|dominant|dominance|dominated|command)\b/)) tones.push('intense');

  return tones.length > 0 ? tones.join(', ') : 'romantic with building tension';
}

export function extractChapterTitleAndBody(content: string, chapterNumber: number): { title: string; body: string } {
  const headingMatch = content.match(/<h3[^>]*>(.*?)<\/h3>/i);
  let title = headingMatch ? stripHtml(headingMatch[1]).trim() : '';

  if (title.toLowerCase().startsWith(`chapter ${chapterNumber}`)) {
    title = title.slice(`chapter ${chapterNumber}`.length).replace(/^\s*:?/, '').trim();
  }

  if (!title) {
    title = `Untitled Chapter ${chapterNumber}`;
  }

  const body = headingMatch ? content.replace(headingMatch[0], '').trim() : content.trim();

  return { title, body };
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

export function getCreatureDisplayName(creature: string): string {
  const names: Record<string, string> = {
    'vampire': 'Vampire',
    'werewolf': 'Werewolf',
    'fairy': 'Fairy',
    'siren': 'Siren',
    'djinn': 'Djinn',
    'witch': 'Witch',
    'dragon': 'Dragon',
    'demon': 'Demon',
    'angel': 'Angel',
    'mermaid': 'Mermaid'
  };
  return names[creature] || 'Creature';
}

export function getSpicyLabel(level: number): string {
  const labels = [
    'Storybook romance',
    'Warm',
    'Spicy',
    'Very spicy',
    'Inferno'
  ];
  return labels[level - 1] || 'Spicy';
}

/**
 * Whether `text` contains `keyword` as a whole word or whole phrase.
 *
 * Both sides are already lowercased by the caller. The `\b` at each end is what
 * separates a theme keyword from the longer word it happens to sit inside, and
 * a hyphenated keyword such as `star-crossed` is unaffected: `-` is a
 * non-word character, so the boundaries fall at the ends of the phrase rather
 * than around each half.
 */
function containsWholeWord(text: string, keyword: string): boolean {
  return new RegExp(String.raw`\b${escapeRegExp(keyword)}\b`).test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
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
export function extractThemesFromContent(content: string): ThemeType[] {
  const lowerContent = stripHtml(content).toLowerCase();

  // Ordered as `VALIDATION_RULES.themes.allowedValues` orders them, so the
  // same chapter always reports the same list in the same order.
  const themeKeywords: Record<ThemeType, readonly string[]> = {
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

  const detectedThemes: ThemeType[] = [];
  for (const [theme, keywords] of Object.entries(themeKeywords) as Array<[ThemeType, readonly string[]]>) {
    if (keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
      detectedThemes.push(theme);
    }
  }

  return detectedThemes;
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
export function extractSpicyLevelFromContent(content: string): SpicyLevel {
  const lowerContent = stripHtml(content).toLowerCase();

  // Level 5 - Very Explicit
  const level5Keywords = [
    'explicit', 'explicitly', 'graphic', 'graphically', 'intense passion',
    'climax', 'climaxed', 'climaxes', 'ecstasy'
  ];
  if (level5Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
    return 5 as SpicyLevel;
  }

  // Level 4 - Passionate
  const level4Keywords = [
    'passionate', 'passionately', 'breathless', 'breathlessly',
    'desire', 'desires', 'desired', 'yearning', 'heat', 'heated'
  ];
  if (level4Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
    return 4 as SpicyLevel;
  }

  // Level 3 - Romantic with Heat
  const level3Keywords = [
    'kiss', 'kissed', 'kisses', 'kissing',
    'embrace', 'embraced', 'embraces', 'embracing',
    'caress', 'caressed', 'caresses', 'caressing',
    'touch', 'touched', 'touches', 'touching',
    'intimate', 'intimately'
  ];
  if (level3Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
    return 3 as SpicyLevel;
  }

  // Level 2 - Sweet Romance
  const level2Keywords = [
    'love', 'loved', 'loves', 'lover', 'lovers', 'loving',
    'affection', 'affections', 'affectionate',
    'tender', 'tenderly', 'tenderness',
    'gentle', 'gently', 'heart', 'hearts'
  ];
  if (level2Keywords.some(keyword => containsWholeWord(lowerContent, keyword))) {
    return 2 as SpicyLevel;
  }

  // Default to Level 1 - Mild
  return 1 as SpicyLevel;
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
    const isNarrativeShift = trimmedLine.length < 50 && (
      trimmedLine.includes('Later') ||
      trimmedLine.includes('Meanwhile') ||
      trimmedLine.includes('Suddenly') ||
      trimmedLine.includes('Then') ||
      /^(The|As|But|However|Still)/i.test(trimmedLine)
    );

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
