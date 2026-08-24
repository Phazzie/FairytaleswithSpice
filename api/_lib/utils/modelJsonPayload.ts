// Created: 2026-08-24 23:55 UTC

/**
 * Match a whole fenced code block from the start of the text.
 *
 * The opening run of backticks is captured so the closing run has to be at
 * least as long, which is how Markdown itself decides where the block ends: a
 * shorter run inside the payload does not close it. The info string — the
 * `json` in ```` ```json ```` — is a run of word characters that cannot contain
 * whitespace or a backtick, so it can never swallow the payload or the fence,
 * and the optional line break after it is what makes the one-line form
 * ```` ```json {"a":1}``` ```` and the three-line form the same shape. The body
 * is lazy, so the block ends at the first closing run rather than the last one
 * in the string, which is what leaves any prose the model added afterwards
 * outside the match instead of inside the JSON.
 */
const FENCED_BLOCK_PATTERN = /^(`{3,})[ \t]*[\w+-]*[ \t]*\r?\n?([\s\S]*?)\r?\n?\1/;

/**
 * Match only the opening fence, for text that never closes it.
 */
const OPENING_FENCE_PATTERN = /^`{3,}[ \t]*[\w+-]*[ \t]*/;

/**
 * Recover the JSON payload from a model response that may be fenced.
 *
 * Every prompt in this repository tells the model to return bare JSON, and
 * models fence it anyway, so both callers stripped the fence before parsing —
 * with two different hand-rolled implementations, each of which dropped the
 * whole response on a form the other handled:
 *
 * - The evaluation route anchored its patterns with `^` and `$` on untrimmed
 *   text, so a single leading newline before the fence left the ```` ``` ````
 *   in the string, and one sentence after the closing fence — "Hope that
 *   helps!" — left both the fence and the sentence in it.
 * - The continuity extractor trimmed first, but only recognised a fence that
 *   ended the string, and only stripped three characters when the response had
 *   no line break at all — so the one-line ```` ```json {"a":1}``` ```` was
 *   parsed as `json {"a":1}``` `.
 *
 * In each case `JSON.parse` threw on markup rather than on anything wrong with
 * the model's answer, and the caller discarded a perfectly good evaluation or
 * continuity extraction: the route answered 502 `EVALUATION_FAILED`, and the
 * extractor fell back to heuristics and warned the reader that Grok had been
 * unavailable. One shared reading means a fence either parses for both callers
 * or for neither.
 *
 * Text that does not begin with a fence is returned trimmed and otherwise
 * untouched — the bare JSON the prompts actually ask for takes the same path it
 * always did. A payload that is preceded by prose is still not recovered: that
 * would mean guessing where the JSON starts, and the guess would be wrong for
 * any response that mentions a fence in passing.
 */
export function stripMarkdownJsonFence(content: string): string {
  const text = content.trim();

  if (!text.startsWith('```')) {
    return text;
  }

  const fencedBlock = FENCED_BLOCK_PATTERN.exec(text);
  if (fencedBlock) {
    return fencedBlock[2].trim();
  }

  // An unterminated fence is still a fence: keep everything after its opening
  // line rather than failing on the backticks the model did close nothing with.
  const firstLineBreakIndex = text.indexOf('\n');
  return firstLineBreakIndex === -1
    ? text.replace(OPENING_FENCE_PATTERN, '').trim()
    : text.slice(firstLineBreakIndex + 1).trim();
}
