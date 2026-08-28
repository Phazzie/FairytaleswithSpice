#!/usr/bin/env tsx
// Created: 2026-06-05 02:20 EDT

import { ExportService } from '../api/_lib/services/exportService';
import {
  escapeHtml,
  escapePdfText,
  sanitizeStoryHtmlForExport,
  stripStoryHtmlForExport
} from '../api/_lib/services/exportSanitizer';
import { SaveExportSeam } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const maliciousStoryHtml = `
<article onclick="trackPrivateStory()">
  <h2 data-chapter="1">Chapter One</h2>
  <p onclick="alert('private')">Hello <strong data-safe="false">safe</strong> reader.</p>
  <a href="javascript:stealPrivateStory()">Link text</a>
  <script>stealPrivateStory('secret story text');</script>
  <style>body { background-image: url("https://secret.example/private.png"); }</style>
  <img src="x" onerror="stealPrivateStory()">
  <svg><text>svg private text</text></svg>
  <p>Angel & demon</p>
</article>`;

const sanitizedHtml = sanitizeStoryHtmlForExport(maliciousStoryHtml);
assert(sanitizedHtml.includes('<h2>Chapter One</h2>'), 'sanitizer should preserve safe heading structure');
assert(sanitizedHtml.includes('<p>Hello <strong>safe</strong> reader.</p>'), 'sanitizer should preserve safe paragraph structure');
assert(sanitizedHtml.includes('Link text'), 'sanitizer should preserve text from disallowed non-dangerous tags');
assert(sanitizedHtml.includes('Angel &amp; demon'), 'sanitizer should escape story text');
assert(!sanitizedHtml.includes('onclick'), 'sanitizer should remove event attributes');
assert(!sanitizedHtml.includes('onerror'), 'sanitizer should remove image event attributes');
assert(!sanitizedHtml.includes('data-chapter'), 'sanitizer should remove arbitrary attributes');
assert(!sanitizedHtml.includes('href='), 'sanitizer should strip link attributes');
assert(!sanitizedHtml.includes('javascript:'), 'sanitizer should remove unsafe URLs');
assert(!sanitizedHtml.includes('<script'), 'sanitizer should remove scripts');
assert(!sanitizedHtml.includes('<style'), 'sanitizer should remove styles');
assert(!sanitizedHtml.includes('<img'), 'sanitizer should remove images');
assert(!sanitizedHtml.includes('<svg'), 'sanitizer should remove SVG');
assert(!sanitizedHtml.includes('stealPrivateStory'), 'sanitizer should remove dangerous container content');
assert(!sanitizedHtml.includes('secret.example'), 'sanitizer should remove private artifact URLs in style content');
assert(!sanitizedHtml.includes('svg private text'), 'sanitizer should remove SVG text content');

const plainText = stripStoryHtmlForExport(maliciousStoryHtml);
assert(plainText.includes('Chapter One'), 'plain export should preserve heading text');
assert(plainText.includes('Hello safe reader.'), 'plain export should preserve paragraph text');
assert(plainText.includes('Link text'), 'plain export should preserve link text only');
assert(!plainText.includes('<'), 'plain export should not contain raw opening angle brackets');
assert(!plainText.includes('>'), 'plain export should not contain raw closing angle brackets');
assert(!plainText.includes('stealPrivateStory'), 'plain export should remove script content');
assert(!plainText.includes('secret.example'), 'plain export should remove style content');

const entityPlainText = stripStoryHtmlForExport(
  '<p>&lt;visible&gt; &amp;lt;encoded&amp;gt; &quot;quote&quot; &amp;quot;encoded quote&amp;quot;</p>'
);
assert(entityPlainText.includes('<visible>'), 'plain export should decode direct less-than and greater-than entities');
assert(entityPlainText.includes('&lt;encoded&gt;'), 'plain export should not double-decode amp-escaped tag entities');
assert(entityPlainText.includes('"quote"'), 'plain export should decode direct quote entities');
assert(entityPlainText.includes('&quot;encoded quote&quot;'), 'plain export should not double-decode amp-escaped quote entities');

// The story arrives as the generator's HTML, where `&` and `"` are already
// written as `&amp;` and `&quot;`. Escaping every `&` re-escaped those, so the
// HTML export rendered the entity text itself while the plain-text export of
// the same story showed the punctuation it stands for.
const entityStoryHtml = '<p>Blood pooled at her feet &amp; the &quot;hunter&quot; smiled.</p>';
const entitySanitizedHtml = sanitizeStoryHtmlForExport(entityStoryHtml);
assert(
  entitySanitizedHtml === entityStoryHtml,
  `HTML export should pass the generator's own entities through unchanged (got ${entitySanitizedHtml})`
);
assert(
  !entitySanitizedHtml.includes('&amp;amp;') && !entitySanitizedHtml.includes('&amp;quot;'),
  'HTML export should not double-escape character references'
);
// Only a complete reference is a reference. A bare ampersand, and an `&amp`
// with no semicolon, are still text and still have to be escaped.
assert(
  sanitizeStoryHtmlForExport('<p>Angel &amp demon & wolf &#zz; here</p>')
    === '<p>Angel &amp;amp demon &amp; wolf &amp;#zz; here</p>',
  'incomplete references should still be escaped'
);

// HTML parses a named reference by its longest valid prefix, with no `;`
// required, so passing an entity-shaped literal through corrupts the story:
// `&copycat;` would reach a reader as `©cat;`. Only the references the
// plain-text export decodes are preserved, which is what makes preserving any
// of them safe — everything else is escaped and stays the text it was.
const unpreservedReferences = '<p>&copycat; and &#38; and &apos; and &Amp; stay literal</p>';
const unpreservedSanitized = sanitizeStoryHtmlForExport(unpreservedReferences);
assert(
  unpreservedSanitized
    === '<p>&amp;copycat; and &amp;#38; and &amp;apos; and &amp;Amp; stay literal</p>',
  `an entity-shaped literal that is not a decoded reference must be escaped (got ${unpreservedSanitized})`
);

// A reference that survives must mean the same thing in every export, so the
// HTML export preserves exactly the set the plain-text export decodes.
const crossFormatSource = '<p>feet &amp; the &quot;hunter&quot;, &lt;him&gt; &#39;there&#39; &copycat; &#38;</p>';
const crossFormatHtml = sanitizeStoryHtmlForExport(crossFormatSource);
const crossFormatPlain = stripStoryHtmlForExport(crossFormatSource);
assert(
  decodeForComparison(crossFormatHtml) === `<p>${crossFormatPlain}</p>`,
  `HTML and plain-text exports must render the same story text\n  html : ${decodeForComparison(crossFormatHtml)}\n  plain: <p>${crossFormatPlain}</p>`
);

/**
 * Resolve an export's HTML to the text a reader sees, so the two formats can
 * be compared as rendered output rather than as markup. Escaped `&amp;` is
 * resolved last, exactly as a parser resolves each reference once.
 */
function decodeForComparison(html: string): string {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const commentedStoryHtml =
  '<p>Elena waited.</p><!-- editor note: cut this line <script>stealPrivateStory()</script> --><p>Dawn broke.</p>';
const sanitizedComments = sanitizeStoryHtmlForExport(commentedStoryHtml);
assert(sanitizedComments === '<p>Elena waited.</p><p>Dawn broke.</p>', 'HTML export should drop comments entirely');

const strippedComments = stripStoryHtmlForExport(commentedStoryHtml);
assert(strippedComments.includes('Elena waited.'), 'plain export should keep prose around a comment');
assert(strippedComments.includes('Dawn broke.'), 'plain export should keep prose after a comment');
assert(!strippedComments.includes('editor note'), 'plain export should not leak comment text');
assert(!strippedComments.includes('-->'), 'plain export should not leak comment delimiters');
assert(
  !strippedComments.includes('stealPrivateStory'),
  'plain export should not leak script bodies hidden inside comments'
);

assert(
  sanitizeStoryHtmlForExport('<p>Kept.</p><!-- unterminated note <p>dropped</p>') === '<p>Kept.</p>',
  'an unterminated comment should swallow the rest of the document rather than leaking it'
);

// ==================== TAG BOUNDARIES ====================
// A tag ends at the first `>` that is not inside a quoted attribute value.
// Reading it as the first `>` full stop split the tag mid-attribute and read the
// remainder as prose, so `<p class="a>b">Hello.</p>` exported as `b">Hello.` —
// through `stripStoryHtmlForExport`, which `.txt`, `.pdf`, `.epub` and `.docx`
// all reach via `ExportService.toPlainText`, and through the `.html` export
// beside it.
const quotedAttributeSamples: Array<{ label: string; html: string; text: string; markup: string }> = [
  {
    label: 'double-quoted value',
    html: '<p class="a>b">Hello.</p>',
    text: 'Hello.',
    markup: '<p>Hello.</p>'
  },
  {
    label: 'single-quoted value',
    html: "<p class='a>b'>She turned.</p>",
    text: 'She turned.',
    markup: '<p>She turned.</p>'
  },
  {
    label: 'a heading, whose text becomes a chapter title',
    html: '<h3 data-chapter="1>2">Real Title</h3>',
    text: 'Real Title',
    markup: '<h3>Real Title</h3>'
  },
  {
    label: 'a value that is prose in its own right',
    html: '<p title="Ash > Ember">The door opened.</p>',
    text: 'The door opened.',
    markup: '<p>The door opened.</p>'
  }
];

for (const sample of quotedAttributeSamples) {
  const text = stripStoryHtmlForExport(sample.html);
  assert(
    text === sample.text,
    `a \`>\` inside a ${sample.label} should not end the tag (got ${JSON.stringify(text)})`
  );

  const markup = sanitizeStoryHtmlForExport(sample.html);
  assert(
    markup === sample.markup,
    `the HTML export should not carry an attribute fragment into the story (got ${JSON.stringify(markup)})`
  );
}

// The costly half of the same defect, because it is silent rather than visible.
// Losing the tag's trailing `/` makes a dropped element look like a block that
// opens and never closes, and `removeNonStoryHtml` then skips every token after
// it — so a single `<svg data-x="1>2"/>` deleted the rest of the story from
// every export.
const truncatedSelfClosing = '<p>Before.</p><svg data-x="1>2"/><p>After.</p>';
assert(
  stripStoryHtmlForExport(truncatedSelfClosing) === 'Before.\nAfter.',
  `a self-closing dropped tag must not swallow the story after it (got ${JSON.stringify(stripStoryHtmlForExport(truncatedSelfClosing))})`
);
assert(
  sanitizeStoryHtmlForExport(truncatedSelfClosing) === '<p>Before.</p><p>After.</p>',
  'the HTML export should keep the story after a self-closing dropped tag too'
);

// Reading a quoted value is only safe while the quote is real. Prose is what
// this runs on, and a malformed attribute whose quote never closes must not go
// looking for its partner in the story: `<p class='unterminated>` finds the
// apostrophe of `It's` and deletes the words between them. Keeping the reader's
// words matters more than removing the fragment, so markup with no well-formed
// reading falls back to the older first-`>` scan.
const unterminatedDouble = '<p class="unterminated>It\'s dangerous here.</p>';
assert(
  stripStoryHtmlForExport(unterminatedDouble) === "It's dangerous here.",
  `an unterminated attribute quote must not consume prose (got ${JSON.stringify(stripStoryHtmlForExport(unterminatedDouble))})`
);
// Stated on prose that also carries a later `>`, which is what makes the
// apostrophe reachable: without the follow-set rule the run closes at the `'` of
// `It's`, the scan then finds the `>` after `dangerous`, and the whole span
// becomes part of the tag — `It's dangerous` is deleted from the story.
const unterminatedSingle = "<p class='unterminated>It's dangerous > here.</p>";
assert(
  stripStoryHtmlForExport(unterminatedSingle) === "It's dangerous > here.",
  `an apostrophe in the prose must not close a malformed attribute (got ${JSON.stringify(stripStoryHtmlForExport(unterminatedSingle))})`
);

// The other limit that keeps a malformed quote inside its own tag: a quoted run
// stops at `<`, because that is where the next tag starts. Without it the run
// above reaches the *following* paragraph, finds a quote there that a space
// follows — so the follow-set accepts it — and swallows `Alpha.` along with the
// markup between them.
const runAcrossTags = '<p class="unterminated>Alpha.</p><p title=x" >Beta.</p>';
assert(
  stripStoryHtmlForExport(runAcrossTags) === 'Alpha.\nBeta.',
  `a quoted run must not reach into the next tag (got ${JSON.stringify(stripStoryHtmlForExport(runAcrossTags))})`
);

// A stray `<` in the prose is where the scan stops looking for a well-formed
// end, for the same reason: the tag it would otherwise run to belongs to
// different markup, and everything between them is the reader's words. This
// module already loses the span between a literal `<` and the next `>` — that is
// unchanged from before this fix, and both readings drop `< Beta` here — but the
// scan must not carry on past `Epsilon.` and take that with it.
const strayAngleBracket = "<p title='>' She wept for him<em>then left</em>";
assert(
  stripStoryHtmlForExport(strayAngleBracket).includes('She wept for him'),
  `the scan must not run into the next tag and take the prose with it (got ${JSON.stringify(stripStoryHtmlForExport(strayAngleBracket))})`
);

// The pre-existing limit this module already documents, asserted so the change
// above is on the record as not having moved it: a story containing a literal
// `<` still loses the span between it and the next `>`, exactly as before.
const literalAngleBracket = '<p>Alpha < Beta "gamma>delta" Epsilon.</p>';
assert(
  stripStoryHtmlForExport(literalAngleBracket).endsWith('Epsilon.'),
  `a literal \`<\` must not delete the prose after the next tag (got ${JSON.stringify(stripStoryHtmlForExport(literalAngleBracket))})`
);

// Reading a quoted value at all depends on there being an assignment to read it
// from, and the three shapes below are the ones where there is not. Each was a
// regression found in review: the scanner opened a "value" on a quote that was
// not a delimiter, hunted for its partner, and found one in the story text —
// losing prose that the older first-`>` reading kept. The rule in every case is
// that markup HTML itself would not read as an attribute must fall back.
const notAnAttributeValue: Array<{ label: string; html: string }> = [
  // A real closing quote followed by the next attribute with no space between.
  // The quote is genuine, but the follow-set cannot accept it, and scanning on
  // for a later quote reaches the one in the prose.
  { label: 'no whitespace between attributes', html: '<p title="a>b"class=x>Visible " prose > after</p>' },
  // A quote *inside* an unquoted value is a character, not a delimiter.
  { label: 'quote inside an unquoted value', html: '<p data-x=a"b>Visible text">After.</p>' },
  // An `=` with no attribute name before it is not an assignment: HTML reads it
  // as the attribute's name and ends the tag at the first `>`.
  { label: 'an `=` with no attribute name', html: '<v =">Visible text">After.</p>' },
  // Inside an unquoted value, `=` and quotes are characters. Without a state for
  // that, the second `=` reads as a fresh assignment and the quote after it
  // opens a run that reaches the sentence.
  { label: 'an `=` embedded in an unquoted value', html: '<p data-x=a="b>Visible text">After.</p>' },
  // The same shape one `=` deeper, which is what actually needs the unquoted
  // state: with only "an `=` needs a name", `a` `=` `b` walks back to a name and
  // the second `=` is taken for an assignment.
  { label: 'two `=` inside one unquoted value', html: '<p data-x=a=b="c>Visible text">After.</p>' },
  // A construct `parseHtmlTag` rejects has no attribute list to walk. Both of
  // these reach `a` as an attribute name and then swallow the sentence.
  { label: 'a `<` with no tag name', html: '< =a="b>Visible text">After.' },
  // A start-tag name begins *immediately* after the `<`. HTML has no whitespace
  // there, so `< p …>` is a `<` the reader typed, not a paragraph.
  { label: 'whitespace between `<` and the name', html: '< p x=">Visible text">After.' },
  // A start-tag name must begin with an ASCII *letter* — narrower than the set a
  // name may continue with — so `<1 …>` is prose, not a tag.
  { label: 'a digit where a tag name should start', html: '<1 x="a>Visible text">After.' },
  { label: 'a declaration rather than a tag', html: '<!x a="b>Visible text">After.' },
  // A tag name begins with a tag-name character but does not end at the first
  // one outside that set: HTML's tag-name state runs to whitespace, `/` or `>`,
  // so `<p=x=">` is one name and has no attributes at all.
  { label: 'an `=` welded into the tag name', html: '<p=x=">Visible text">After.</p>' },
  // A `/` is never part of a name. HTML sends it to the self-closing-start
  // state and, when no `>` follows, resumes before the next attribute — so the
  // `=` after it has no name to assign to.
  { label: 'a `/` that whitespace rejects as a marker', html: '<p / =">Visible text">After.</p>' },
  // A value's first character starts an unquoted value whatever it is, `=`
  // included: `x==y` gives `x` the value `=y`.
  { label: 'a value whose first character is `=`', html: '<p x==y=">Visible text">After.</p>' }
];

for (const sample of notAnAttributeValue) {
  const text = stripStoryHtmlForExport(sample.html);
  assert(
    text.includes('Visible text') || text.includes('Visible " prose'),
    `${sample.label}: the reader's words must survive markup that is not an attribute (got ${JSON.stringify(text)})`
  );
}

// The same rule stated where it is least obvious, because the `=` *is* part of
// the tag name rather than an attribute: `<e=">…">` has no attribute at all.
assert(
  stripStoryHtmlForExport('<e=">Visible text">After.</p>').includes('Visible text'),
  'an `=` welded to the tag name does not open an attribute value'
);

// Whitespace before `=` is legal and does not throw the name away: `y = z` is a
// spelling of `y=z`, so that `=` is still `y`'s assignment and `z="` is its
// unquoted value. Reading the space as ending the attribute instead makes the
// `=` a fresh name, the *next* `=` an assignment, and its quote opens a run that
// swallows the sentence. The expected text is exactly what a browser renders.
const spacedAssignment = '<p x="a>b" y = z=">Visible " > After.</p>';
assert(
  stripStoryHtmlForExport(spacedAssignment) === 'Visible " > After.',
  `whitespace before \`=\` must not discard the attribute name (got ${JSON.stringify(stripStoryHtmlForExport(spacedAssignment))})`
);

// The dropped-tag lists are read from the tag name, which sits before any
// attribute, so the truncation never let a dangerous element through. Asserted
// so the boundary change above is on the record as not having moved it.
assert(
  !stripStoryHtmlForExport('<script foo="a>b">stealPrivateStory()</script><p>Story survives.</p>')
    .includes('stealPrivateStory'),
  'a script carrying a quoted `>` must still be dropped with its contents'
);

// The slash is the case reading a tag whole newly exposed, and it is the one
// with teeth. `<svg/>` closes itself because SVG is foreign content; in HTML the
// slash is ignored, so `<script/>` does *not* close the element and its contents
// run to `</script>`. Honouring it there stops `removeNonStoryHtml` entering
// block-skipping and puts the script body into every export as story text —
// which the old truncation prevented only by accident, having eaten the slash.
for (const container of ['script', 'style', 'iframe']) {
  const html = `<${container} data-x="a>b"/>stealPrivateStory()</${container}><p>Story survives.</p>`;
  const text = stripStoryHtmlForExport(html);
  assert(
    !text.includes('stealPrivateStory'),
    `a self-closing <${container}> must still take its contents with it (got ${JSON.stringify(text)})`
  );
  assert(
    text.includes('Story survives.'),
    `the story after a self-closing <${container}> must survive (got ${JSON.stringify(text)})`
  );
  assert(
    !sanitizeStoryHtmlForExport(html).includes('stealPrivateStory'),
    `the HTML export must drop a self-closing <${container}>'s contents too`
  );
}

// Reading a `/` as a self-closing marker depends on where it sits, exactly as a
// quote does. Two tags end on a `/` without being self-closing at all, and HTML
// keeps the contents of both — so treating them as closed means no
// block-skipping and the element's text exported as story prose.
const notSelfClosing: Array<{ label: string; html: string }> = [
  // The `/` is the last character of the unquoted value `y/`. Nothing ends an
  // unquoted value but whitespace or `>`.
  { label: 'a `/` inside an unquoted value', html: '<svg title="a>b" data-x=y/>secret</svg><p>Story.</p>' },
  // A `/` directly after `=` does not close the tag either — it *begins* the
  // unquoted value, so `data-x` is `/` and the element is still open.
  { label: 'a `/` that is the whole unquoted value', html: '<svg title="a>b" data-x=/>secret</svg><p>Story.</p>' },
  // A self-closing marker is the two characters `/>`. Whitespace between them
  // makes the `/` a stray.
  { label: 'whitespace between `/` and `>`', html: '<svg title="a>b"/ >secret</svg><p>Story.</p>' }
];

for (const sample of notSelfClosing) {
  const text = stripStoryHtmlForExport(sample.html);
  assert(
    !text.includes('secret'),
    `${sample.label}: the element is not closed, so its contents must not be exported (got ${JSON.stringify(text)})`
  );
  assert(
    text.includes('Story.'),
    `${sample.label}: the story after it must survive (got ${JSON.stringify(text)})`
  );
}

// The cost of that rule, stated rather than left to be rediscovered: a dangerous
// container written self-closing and never closed now takes the rest of the
// document with it, where the older reading kept it. That is what a browser does
// too — the slash is ignored, so the element's contents run to a `</iframe>`
// that never arrives — and it is the safe direction for a sanitizer. The
// alternative is the leak asserted above.
assert(
  stripStoryHtmlForExport('<iframe/>Story text.') === '',
  'an unclosed self-closing dangerous container takes the rest with it, as a browser does'
);

// A raw-text element's contents are text, not markup, so it cannot nest. An
// opener-shaped string inside one — `<script>const t = "<script/>";</script>` —
// must not deepen the skip, or the closing tag only gets the depth back to one
// and the rest of the story is swallowed. The closing side is unaffected:
// `</script>` inside a string does end the element, here as in a browser.
for (const container of ['script', 'style', 'iframe']) {
  const html = `<${container}>const t = "<${container}/>";</${container}><p>Story survives.</p>`;
  const text = stripStoryHtmlForExport(html);
  assert(
    text.includes('Story survives.'),
    `an opener-shaped string inside <${container}> must not deepen the skip (got ${JSON.stringify(text)})`
  );
  assert(!text.includes('const t'), `the <${container}> body itself is still dropped`);
}

// `form` is on the same list for a different reason with the same effect: HTML
// ignores a `<form>` start tag while a form is already open, so a second one
// never opens an element for the single close to leave behind.
for (const control of ['form', 'button', 'select']) {
  const html = `<${control}>hidden<${control}/></${control}><p>Story.</p>`;
  assert(
    stripStoryHtmlForExport(html) === 'Story.',
    `a nested <${control}> opener does not deepen the skip (got ${JSON.stringify(stripStoryHtmlForExport(html))})`
  );
}

// The other side, and why that is a list rather than a blanket: containers that
// really do nest must still be counted, or the inner close ends the outer skip
// and the element's tail leaks.
assert(
  stripStoryHtmlForExport('<svg>a<svg>b</svg>c</svg><p>Story survives.</p>') === 'Story survives.',
  'a genuinely nesting dropped container still counts its depth'
);

// A name that merely *starts* with a dangerous one is not that element. HTML
// ends a tag name at whitespace, `/` or `>`, so `script!` is an ordinary unknown
// element and its contents are story text. Classifying it as `script` sent the
// whole document into block-skipping — the costliest possible reading of a
// harmless tag.
const nearMissName = '<script!/>Visible.<p>After.</p>';
assert(
  stripStoryHtmlForExport(nearMissName).includes('Visible.')
    && stripStoryHtmlForExport(nearMissName).includes('After.'),
  `a tag name that only starts with a dangerous name is not dangerous (got ${JSON.stringify(stripStoryHtmlForExport(nearMissName))})`
);
assert(
  !stripStoryHtmlForExport('<script/>secret()</script><p>Story.</p>').includes('secret'),
  'the exact dangerous name still takes its contents with it'
);

// Dropping an element must not let its neighbours become markup. The survivors
// are handed on as tokens rather than rejoined into a string and read again:
// `<p x=">"<>` tokenizes to `<p x=">`, `"`, `<>`, and dropping the `<>` would
// otherwise leave `<p x=">" Visible > After.` — in which the quote and the
// sentence look like an attribute list, so the sentence never reaches the reader.
const reconstructed = '<p x=">"<> Visible > After.</p>';
assert(
  stripStoryHtmlForExport(reconstructed).includes('Visible'),
  `a recovery pass must not turn visible text into attributes (got ${JSON.stringify(stripStoryHtmlForExport(reconstructed))})`
);

// The other side of that rule, and why it is a list rather than a blanket:
// foreign content really does self-close, so `<svg .../>` must not start a skip
// that swallows the rest of the story. This is the silent half of the headline
// defect and it stays fixed.
assert(
  stripStoryHtmlForExport('<p>Before.</p><svg data-x="1>2"/><p>After.</p>') === 'Before.\nAfter.',
  'a self-closing <svg> closes itself and must not swallow the story after it'
);

// A boundary a reader sees has to survive into both exports, and the closing tag
// is not the only place one appears. `</div!>` is an unknown element rather than
// a `</div>`, so there is no close to break on — but the `<p>` after it opens a
// block, and the HTML export already separates them. The plain-text export ran
// the two paragraphs into one line until it counted the opening side too.
const nearMissClose = '<div>Visible.</div!><p>After.</p>';
assert(
  stripStoryHtmlForExport(nearMissClose) === 'Visible.\nAfter.',
  `an unrecognised closing tag must not weld two blocks together (got ${JSON.stringify(stripStoryHtmlForExport(nearMissClose))})`
);

// And the reason it is written only where a break is not already there: ordinary
// story markup breaks on the close, and must not gain a second break from the
// next block's open.
assert(
  stripStoryHtmlForExport('<p>A</p><p>B</p>') === 'A\nB',
  'well-formed paragraphs still produce one break between them'
);

// ==================== BLOCK BOUNDARIES ====================
// A tag outside the allowed set is replaced with nothing, so a block-level one
// welded the words on either side of it: `<h4>The Vault</h4><div>She opened the
// door.</div>` exported as `The VaultShe opened the door.`, and
// `<td>One</td><td>Two</td>` as `OneTwo`, while the plain-text export of the
// same story put each on its own line. Every boundary a reader sees has to
// survive into both documents.
const blockBoundarySamples: Array<{ label: string; html: string; expected: string }> = [
  {
    label: 'a heading level the allow-list does not carry',
    html: '<h4>The Vault</h4><div>She opened the door.</div>',
    expected: 'The Vault<br>She opened the door.'
  },
  {
    label: 'table cells',
    html: '<table><tr><td>One</td><td>Two</td></tr></table>',
    expected: 'One<br>Two'
  },
  {
    label: 'an opening container between two runs of prose',
    html: 'door.<div>Blood',
    expected: 'door.<br>Blood'
  },
  {
    // One boundary is what a reader sees however many tags close at it. The
    // plain-text export caps a run of newlines at two for the same reason.
    label: 'a run of dropped boundaries',
    html: 'Before<div><figure></figure></div><div>After</div>',
    expected: 'Before<br>After'
  },
  {
    // ...and a boundary with no story on one side of it is not a boundary.
    label: 'leading and trailing dropped boundaries',
    html: '<div><div>Nested</div></div>',
    expected: 'Nested'
  },
  {
    // An allowed block tag already ends the paragraph; a dropped one beside it
    // must not add a second break.
    label: 'a dropped container after an allowed paragraph',
    html: '<p>She opened the door.</p><div>Blood pooled.</div>',
    expected: '<p>She opened the door.</p>Blood pooled.'
  },
  {
    // Inline tags are dropped without a boundary, which is what a reader sees.
    label: 'an inline tag',
    html: '<p>Hello <em>there</em>, <a href="x">reader</a>.</p>',
    expected: '<p>Hello <em>there</em>, reader.</p>'
  },
  {
    // A break the generator wrote is the story's own and is not collapsed.
    label: 'an authored double break',
    html: '<p>Line<br><br>Break</p>',
    expected: '<p>Line<br><br>Break</p>'
  }
];

for (const sample of blockBoundarySamples) {
  const sanitized = sanitizeStoryHtmlForExport(sample.html);
  assert(
    sanitized === sample.expected,
    `HTML export should render ${sample.label} as ${JSON.stringify(sample.expected)}, got ${JSON.stringify(sanitized)}`
  );
}

// The two exports must agree on where one piece of story ends and the next
// begins, which is the property the welding broke.
const boundarySource = '<h4>The Vault</h4><div>She opened the door.</div><table><tr><td>One</td><td>Two</td></tr></table>';
assert(
  sanitizeStoryHtmlForExport(boundarySource).split('<br>').length
    === stripStoryHtmlForExport(boundarySource).split('\n').length,
  'HTML and plain-text exports should find the same number of block boundaries'
);

// `normalizePlainText` tidied the end of the text with `String.prototype.trimEnd`
// every time it wrote a newline, which counts a newline as trailing whitespace
// and so deleted the breaks already written. The first two breaks in a run were
// rewritten immediately afterwards, so only the third and later ones vanished —
// and three in a row is what the app's own export sends, because
// `buildStoryHtmlDocument` writes one tag per line and the literal newlines
// between the tags are breaks too.
const prettyPrintedBoundaries = [
  {
    label: 'a pretty-printed horizontal rule between two paragraphs',
    html: '<p>She opened the door.</p>\n<hr>\n<p>Blood pooled.</p>',
    expected: 'She opened the door.\n\nBlood pooled.'
  },
  {
    label: 'a pretty-printed section boundary',
    html: '<section><p>One.</p></section>\n\n<section><p>Two.</p></section>',
    expected: 'One.\n\nTwo.'
  },
  {
    label: 'a run of nested closings',
    html: '<ul>\n<li>One.</li>\n</ul>\n<p>Two.</p>',
    expected: 'One.\n\nTwo.'
  }
];

for (const sample of prettyPrintedBoundaries) {
  const plain = stripStoryHtmlForExport(sample.html);
  assert(
    plain === sample.expected,
    `plain export should render ${sample.label} as ${JSON.stringify(sample.expected)}, got ${JSON.stringify(plain)}`
  );
}

// The trailing spaces the trim existed to remove still have to go: a line must
// not end on the space every dropped inline tag leaves behind.
assert(
  stripStoryHtmlForExport('<p>She waited <em>there</em> </p><p>Then left.</p>') === 'She waited there\nThen left.',
  'plain export should still drop the spaces a line ends on'
);

// `buildStoryHtmlDocument` sends a whole HTML document, whose `<head>` names the
// story a few tags above the `<h1>` that names it again. `<title>` was the one
// head element whose text was not dropped, so every export opened on the title
// welded to itself.
const wholeDocument = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Vampire's Bargain</title>
<style>body{font-family:Georgia,serif}</style>
</head>
<body>
<h1>The Vampire's Bargain</h1>
<p>She traded a name for a night.</p>
</body>
</html>`;

const documentPlainText = stripStoryHtmlForExport(wholeDocument);
assert(
  documentPlainText === "The Vampire's Bargain\n\nShe traded a name for a night.",
  `plain export should carry the document's story once, got ${JSON.stringify(documentPlainText)}`
);

const documentHtml = sanitizeStoryHtmlForExport(wholeDocument);
assert(
  documentHtml.startsWith('<h1>'),
  `HTML export should open on the story's own heading, got ${JSON.stringify(documentHtml.slice(0, 60))}`
);
assert(
  !documentHtml.includes('font-family'),
  'HTML export should not carry the document stylesheet'
);

assert(
  escapeHtml('<title>"Angel"</title>') === '&lt;title&gt;&quot;Angel&quot;&lt;/title&gt;',
  'escapeHtml should escape markup and quotes'
);
const pdfSample = String.raw`A (private) \\ path` + '\n';
const expectedPdfSample = String.raw`A \(private\) \\\\ path `;
assert(escapePdfText(pdfSample) === expectedPdfSample, 'escapePdfText should escape PDF string syntax');

async function main(): Promise<void> {
  const exportService = new ExportService();
  const input: SaveExportSeam['input'] = {
    storyId: 'story_private',
    title: '<Private "Title">',
    content: maliciousStoryHtml,
    format: 'html',
    includeMetadata: true
  };

  const htmlExport = await (exportService as any).generateExportContent(input);
  assert(htmlExport.includes('&lt;Private &quot;Title&quot;&gt;'), 'HTML export should escape title');
  assert(htmlExport.includes('<h2>Chapter One</h2>'), 'HTML export should preserve safe story markup');
  assert(!htmlExport.includes('<script'), 'HTML export should not include scripts');
  assert(!htmlExport.includes('onclick'), 'HTML export should not include event attributes');
  assert(!htmlExport.includes('javascript:'), 'HTML export should not include unsafe URLs');
  assert(!htmlExport.includes('stealPrivateStory'), 'HTML export should not include removed script content');

  const textExport = await (exportService as any).generateExportContent({
    ...input,
    title: 'Private Title',
    format: 'txt'
  });
  assert(textExport.includes('Chapter One'), 'text export should include story text');
  assert(textExport.includes('Hello safe reader.'), 'text export should include paragraph text');
  assert(!textExport.includes('<script'), 'text export should not include scripts');
  assert(!textExport.includes('onclick'), 'text export should not include event attributes');
  assert(!textExport.includes('javascript:'), 'text export should not include unsafe URLs');
  assert(!textExport.includes('stealPrivateStory'), 'text export should not include removed script content');

  const pdfTitle = String.raw`Private (Title) \\`;
  const pdfExport = await (exportService as any).generateExportContent({
    ...input,
    title: pdfTitle,
    format: 'pdf'
  });
  assert(pdfExport.includes(`(${escapePdfText(pdfTitle)}) Tj`), 'PDF export should escape title string syntax');

  console.log('Export sanitizer tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
