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
