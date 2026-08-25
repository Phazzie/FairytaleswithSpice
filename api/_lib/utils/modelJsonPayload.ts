// Created: 2026-08-24 23:55 UTC

/**
 * Match the opening fence and the rest of the line it sits on.
 *
 * The run of backticks is captured because Markdown measures the closing run
 * against it: a shorter run does not close the block. Everything else on that
 * line is captured as one piece rather than being parsed here, because two
 * different things can be sitting in it — the info string, and, when the model
 * started the JSON on the same line, the beginning of the payload.
 *
 * The line class excludes `\r` as well as `\n` so that the engine never has a
 * choice about which part matches a CRLF: with `[^\n]*`, the `\r` could be
 * taken either by the class or by the `\r?` after it, and every way of
 * splitting a long line between them gets tried on input that ultimately fails
 * to match. Here the class stops at the `\r`, so each position is decided once.
 */
const OPENING_FENCE_PATTERN = /^(`{3,})([^\r\n]*)\r?\n?/;

/**
 * Find where a payload begins on the opening-fence line.
 *
 * The info string is whatever the model wrote after the backticks — `json`,
 * but also `JSON`, `application/json`, or nothing. Rather than trying to
 * describe every info string a model might emit, the payload is located by the
 * character that actually starts a JSON value; anything before it is the info
 * string by definition, whatever punctuation it contains.
 */
const JSON_VALUE_START_PATTERN = /[{[]/;

/**
 * Count the run of backticks that ends a string, for the one-line form.
 *
 * Counted rather than matched with `` /`+$/ ``: that pattern has no left
 * anchor, so on a payload that ends in something other than a backtick the
 * engine starts a greedy run at every backtick in it and backtracks to the end
 * of each, which is quadratic in a payload full of them — and a story
 * evaluation whose suggestions are about Markdown fences is exactly that.
 */
function countTrailingBackticks(value: string): number {
  let count = 0;

  while (count < value.length && value[value.length - 1 - count] === '`') {
    count += 1;
  }

  return count;
}

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
 * The reading is Markdown's, in three parts:
 *
 * - **The opening line** is the backtick run plus an info string. The payload
 *   may also start on it, so anything from the first `{` or `[` onward is kept.
 *   Reading the info string as "everything before the JSON starts" rather than
 *   as a word is what lets `application/json` through, and keeping the rest of
 *   the line is what stops a model that opened `` ```json {"score":80, `` and
 *   never closed the fence from having its first line thrown away.
 * - **The closing fence** has to be a line of its own containing nothing but a
 *   run at least as long as the opening one. That is Markdown's rule, and here
 *   it is also what keeps a story evaluation whose `suggestions` mention
 *   ```` ``` ```` from being truncated at the backticks inside its own JSON
 *   string.
 * - **No closing fence** is still a fence: everything after the opening line is
 *   the payload, rather than the response being abandoned over the run the
 *   model never wrote.
 *
 * Text that does not begin with a fence is returned trimmed and otherwise
 * untouched — the bare JSON the prompts actually ask for takes the same path it
 * always did. A payload preceded by prose is still not recovered: that would
 * mean guessing where the JSON starts, and the guess would be wrong for any
 * response that mentions a fence in passing.
 */
export function stripMarkdownJsonFence(content: string): string {
  const text = content.trim();
  const opening = OPENING_FENCE_PATTERN.exec(text);

  if (!opening) {
    return text;
  }

  const fenceLength = opening[1].length;
  const inlinePayload = readInlinePayload(opening[2], fenceLength);
  const followingLines = text.slice(opening[0].length).split('\n');
  const closingIndex = followingLines.findIndex(line => isClosingFenceLine(line, fenceLength));
  const body = (closingIndex === -1 ? followingLines : followingLines.slice(0, closingIndex)).join('\n');

  return [inlinePayload, body].filter(part => part.trim().length > 0).join('\n').trim();
}

/**
 * Take the part of the opening line that belongs to the payload, and drop the
 * closing run when the model wrote the whole block on that one line.
 */
function readInlinePayload(openingLineRest: string, fenceLength: number): string {
  const payloadStart = openingLineRest.search(JSON_VALUE_START_PATTERN);
  if (payloadStart === -1) {
    return '';
  }

  const payload = openingLineRest.slice(payloadStart).trimEnd();
  const trailingRun = countTrailingBackticks(payload);

  return trailingRun >= fenceLength
    ? payload.slice(0, -trailingRun).trimEnd()
    : payload;
}

/**
 * A closing fence is a line holding nothing but a run at least as long as the
 * one that opened the block — not merely a backtick run somewhere in the text.
 */
function isClosingFenceLine(line: string, fenceLength: number): boolean {
  const trimmed = line.trim();

  return trimmed.length >= fenceLength && /^`+$/.test(trimmed);
}
