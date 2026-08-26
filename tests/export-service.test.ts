#!/usr/bin/env tsx
// Created: 2026-08-24 18:05 UTC

import { ExportService } from '../api/_lib/services/exportService';
import { readZipEntries, ZipEntry } from '../api/_lib/services/zipArchive';
import { EXPORT_FORMATS, SaveExportSeam } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const unicodeStory = '<p>Élodie smiled — a 🐉 dragon watched the château.</p>';

function createInput(overrides: Partial<SaveExportSeam['input']> = {}): SaveExportSeam['input'] {
  return {
    storyId: 'story_export_regression',
    title: 'Midnight Bargain',
    content: unicodeStory,
    format: 'txt',
    includeMetadata: false,
    ...overrides
  };
}

// There is no object storage behind this service: the exported bytes are
// handed back directly as a `data:` URI. It used to be a mock upload that
// returned a URL pointing at `storage.example.com` — a link that resolved
// nowhere — so this now checks the URI actually carries the exported bytes,
// not merely that it is shaped like one.
async function testDownloadUrlCarriesTheExportedBytes(): Promise<void> {
  const exportService = new ExportService();

  for (const format of ['txt', 'html', 'pdf', 'epub', 'docx'] as const) {
    const input = createInput({ format });
    const result = await exportService.saveAndExport(input);
    const content = await exportService.generateExportContent(input);

    assert(result.success, `${format} export should succeed`);
    const output = result.data as SaveExportSeam['output'];
    assert(output.filename.endsWith(`.${format}`), `${format} filename should keep the requested extension`);

    const dataUriMatch = /^data:([^;]+);base64,(.+)$/.exec(output.downloadUrl);
    assert(dataUriMatch, `${format} downloadUrl should be a data: URI (got ${output.downloadUrl.slice(0, 40)}...)`);
    const decoded = Buffer.from(dataUriMatch[2], 'base64');
    assert(
      decoded.equals(content),
      `${format} downloadUrl should decode to exactly the exported document's bytes`
    );
    assert(output.fileSize === content.length, `${format} fileSize should equal the exported document's byte length`);
  }
}

// `fileSize` is documented in the contract as bytes. It was reported as
// `content.length`, which counts UTF-16 code units and so undercounts every
// accented character and emoji a story contains.
//
// These three bodies are all four UTF-16 code units long, so the buggy measure
// reports one identical size for all of them. Their UTF-8 lengths differ: `é`
// costs one byte more than `e`, and the two units of `🐉` cost four bytes where
// the two ASCII letters they replace cost two. Comparing the sizes against each
// other pins the unit of measure without reaching into the service to rebuild
// the exported text.
async function testFileSizeIsMeasuredInBytes(): Promise<void> {
  const asciiSize = await exportedSizeOf('<p>Cafe</p>');
  const accentedSize = await exportedSizeOf('<p>Café</p>');
  const emojiSize = await exportedSizeOf('<p>Ca🐉</p>');

  assert(asciiSize > 0, 'an export should report a non-zero size');
  assert(
    accentedSize === asciiSize + 1,
    `an accented character should add its extra UTF-8 byte (ascii=${asciiSize}, accented=${accentedSize})`
  );
  assert(
    emojiSize === asciiSize + 2,
    `an astral-plane character should add its extra UTF-8 bytes (ascii=${asciiSize}, emoji=${emojiSize})`
  );
}

async function exportedSizeOf(content: string): Promise<number> {
  const exportService = new ExportService();
  const result = await exportService.saveAndExport(createInput({ content }));

  assert(result.success, `export of ${content} should succeed`);
  return (result.data as SaveExportSeam['output']).fileSize;
}

// A PDF reader locates the end of a content stream by the `/Length` its object
// declares. The mock PDF declared `content.length + 100` — the code-unit count
// of the whole story, not the byte count of the short stream it actually
// writes — so the declared span ran far past `endstream`.
async function testPdfStreamLengthDescribesTheStream(): Promise<void> {
  const document = await pdfTextOf(createInput({ format: 'pdf', content: unicodeStory }));

  const declaredLength = Number(/\/Length (\d+)/.exec(document)?.[1]);
  const streamBody = extractPdfStreamBody(document);

  assert(Number.isInteger(declaredLength), 'the PDF content object should declare a /Length');
  assert(
    declaredLength === Buffer.byteLength(streamBody, 'utf8'),
    `/Length should be the stream's UTF-8 byte length ` +
      `(declared=${declaredLength}, actual=${Buffer.byteLength(streamBody, 'utf8')})`
  );
}

// The PDF used to hold the story's first 100 code points followed by a literal
// `...`, on a single page, while the four other formats shipped the whole
// story. Nothing about the file said so — it downloaded under the story's own
// name, and a trailing ellipsis reads as ordinary prose.
async function testPdfCarriesTheWholeStoryAcrossPages(): Promise<void> {
  // Long enough to need several pages, and marked at both ends so a truncation
  // anywhere between them is visible.
  const paragraphs = Array.from(
    { length: 60 },
    (_unused, index) => `<p>Paragraph ${index} — Élodie counted the 🐉 scales in the (dark).</p>`
  );
  const content = `<p>OPENING-MARKER</p>${paragraphs.join('')}<p>CLOSING-MARKER</p>`;
  const document = await pdfTextOf(createInput({ format: 'pdf', content }));

  const shownText = pdfShownText(document);
  assert(shownText.includes('OPENING-MARKER'), 'the PDF should show the start of the story');
  assert(shownText.includes('CLOSING-MARKER'), 'the PDF should show the end of the story');
  for (let index = 0; index < 60; index += 1) {
    assert(shownText.includes(`Paragraph ${index} `), `the PDF should show paragraph ${index}`);
  }

  const pageCount = Number(/\/Count (\d+)/.exec(document)?.[1]);
  const pageObjects = document.match(/\/Type \/Page\b/g) ?? [];
  assert(pageCount > 1, `a story this long should run to more than one page (got ${pageCount})`);
  assert(
    pageObjects.length === pageCount,
    `the page tree should declare as many pages as it holds (declared=${pageCount}, objects=${pageObjects.length})`
  );

  const kids = /\/Kids \[([^\]]*)\]/.exec(document)?.[1].trim().split(/\s+(?=\d+ 0 R)/) ?? [];
  assert(kids.length === pageCount, `the /Kids array should name every page (named=${kids.length})`);
  for (const kid of kids) {
    const objectNumber = Number(/^(\d+) 0 R$/.exec(kid.trim())?.[1]);
    assert(
      new RegExp(`\\n${objectNumber} 0 obj\\n<<\\n/Type /Page\\b`).test(document),
      `/Kids entry ${JSON.stringify(kid)} should name a page object`
    );
  }
}

// Escaping is applied to each line as it is written, from the source text
// rather than from text that has already been escaped: cutting escaped text
// splits whatever the escaping added at the cut — a `\(` pair loses its
// parenthesis and strands a backslash that escapes the next character, and a
// surrogate pair loses its second half and encodes as U+FFFD.
async function testPdfLinesBreakOnCharacterBoundaries(): Promise<void> {
  for (const boundary of ['(spice)', '🐉 tail']) {
    // No spaces, so the line is longer than a page is wide and has to be broken
    // inside the word — the only place a break can land mid-character.
    const content = `<p>${`${'x'.repeat(60)}${boundary.replace(/\s/g, '')}`.repeat(6)}</p>`;
    const document = await pdfTextOf(createInput({ format: 'pdf', content }));
    const streamBody = extractPdfStreamBody(document);

    assert(
      !/(^|[^\\])(\\\\)*\\\) Tj/.test(streamBody),
      `a ${boundary} line should not end mid-escape (stream=${JSON.stringify(streamBody)})`
    );
    assert(
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(streamBody),
      `a ${boundary} line should not end on half a surrogate pair`
    );
  }
}

function extractPdfStreamBody(document: string): string {
  const match = /\nstream\n([\s\S]*?)\nendstream\n/.exec(document);
  assert(match, 'the PDF should contain a content stream');
  return match[1];
}

/** The text every page of a PDF actually shows, in page order. */
function pdfShownText(document: string): string {
  return Array.from(document.matchAll(/\((.*)\) Tj/g), match => match[1].replace(/\\([\\()])/g, '$1')).join('\n');
}

async function pdfTextOf(input: SaveExportSeam['input']): Promise<string> {
  const document = await new ExportService().generateExportContent(input);
  return document.toString('utf8');
}

/**
 * Confirm a document is actually a zip archive, then read its entries back by
 * path — the check both the epub and docx tests below start from, since both
 * formats used to be plain text made to merely *look* like a zip.
 */
function readAsRealZipContainer(document: Buffer, formatLabel: string): Map<string, ZipEntry> {
  assert(
    document.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
    `a ${formatLabel} should start with a zip local file header signature`
  );

  return new Map(readZipEntries(document).map(entry => [entry.path, entry]));
}

// The EPUB used to be a bare, unzipped OPF XML fragment referencing a
// `chapter1.xhtml` that was never produced — not a real `.epub` (a zip
// container) at all. This confirms it now is one: `mimetype` first and
// stored, the OCF pointer resolving to the package document, and the chapter
// the package document references actually existing and holding the story.
async function testEpubIsARealZipContainerWithItsChapter(): Promise<void> {
  const document = await new ExportService().generateExportContent(
    createInput({ format: 'epub', title: 'Élodie & the Dragon' })
  );

  const byPath = readAsRealZipContainer(document, 'epub');

  assert(byPath.keys().next().value === 'mimetype', 'mimetype must be the first entry in an epub');
  assert(
    byPath.get('mimetype')?.data.toString('ascii') === 'application/epub+zip',
    'the mimetype entry should hold the epub media type verbatim'
  );

  const containerXml = byPath.get('META-INF/container.xml')?.data.toString('utf8');
  assert(containerXml?.includes('OEBPS/content.opf'), 'container.xml should point at the package document');

  const contentOpf = byPath.get('OEBPS/content.opf')?.data.toString('utf8');
  assert(contentOpf, 'the package document should exist');
  assert(contentOpf.includes('Élodie &amp; the Dragon'), 'the package document should carry the escaped title');
  assert(contentOpf.includes('href="chapter1.xhtml"'), 'the package document should reference the chapter it ships');

  const usedPrefixes = new Set(Array.from(contentOpf.matchAll(/<\/?([A-Za-z][\w.-]*):/g), match => match[1]));
  for (const prefix of usedPrefixes) {
    assert(contentOpf.includes(`xmlns:${prefix}="`), `the \`${prefix}:\` prefix should be bound to a namespace`);
  }

  const chapter = byPath.get('OEBPS/chapter1.xhtml')?.data.toString('utf8');
  assert(chapter, 'the chapter the package document references should actually exist');
  assert(chapter.includes('Élodie smiled'), 'the chapter should contain the real story content');
}

// The DOCX used to be literal text made to *look* like a zip's local-file-header
// strings, concatenated with escaped plain text — not a valid archive. This
// confirms the required OOXML package parts exist and the document body holds
// the actual story.
async function testDocxIsARealZipContainerWithItsDocument(): Promise<void> {
  const document = await new ExportService().generateExportContent(
    createInput({ format: 'docx', title: 'Midnight Bargain' })
  );

  const byPath = readAsRealZipContainer(document, 'docx');

  for (const requiredPart of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    assert(byPath.has(requiredPart), `a docx should contain ${requiredPart}`);
  }

  const contentTypes = byPath.get('[Content_Types].xml')!.data.toString('utf8');
  assert(contentTypes.includes('/word/document.xml'), 'Content_Types should declare the document part');

  const rels = byPath.get('_rels/.rels')!.data.toString('utf8');
  assert(rels.includes('word/document.xml'), 'the package relationships should point at the document part');

  const documentXml = byPath.get('word/document.xml')!.data.toString('utf8');
  assert(documentXml.includes('Midnight Bargain'), 'the document body should include the title');
  assert(documentXml.includes('Élodie smiled'), 'the document body should include the real story content');
}

// A reader resolves an object by seeking to the byte offset the xref table
// gives for it, and finds the table through `startxref`. Both used to be fixed
// constants, so they addressed whatever bytes a real title and excerpt pushed
// into their place and no object lookup landed on an object header.
async function testPdfCrossReferenceTablePointsAtItsObjects(): Promise<void> {
  const exportService = new ExportService();

  for (const title of ['A', 'Midnight Bargain', 'Élodie and the 🐉 of the Château (Part Two)']) {
    const bytes = await exportService.generateExportContent(
      createInput({ format: 'pdf', title, content: unicodeStory.repeat(4) })
    );
    const document = bytes.toString('utf8');

    const startxref = /startxref\n(\d+)\n%%EOF$/.exec(document);
    assert(startxref, `the PDF for "${title}" should end with a startxref offset`);
    assert(
      bytes.subarray(Number(startxref[1])).toString('utf8').startsWith('xref\n'),
      `startxref for "${title}" should point at the cross-reference table`
    );

    const table = /\nxref\n0 (\d+)\n([\s\S]*?)\ntrailer\n/.exec(document);
    assert(table, `the PDF for "${title}" should contain a cross-reference table`);
    const entries = table[2].split('\n');
    assert(
      entries.length === Number(table[1]),
      `the table for "${title}" should hold one entry per object it declares ` +
        `(declared=${table[1]}, entries=${entries.length})`
    );
    assert(
      entries.every(entry => Buffer.byteLength(`${entry}\n`, 'utf8') === 20),
      `every entry for "${title}" should keep the fixed 20-byte record width`
    );
    assert(entries[0] === '0000000000 65535 f ', `object 0 for "${title}" should head the free list`);

    entries.slice(1).forEach((entry, index) => {
      const objectNumber = index + 1;
      const offset = Number(/^(\d{10}) \d{5} n $/.exec(entry)?.[1]);
      assert(Number.isFinite(offset), `entry ${objectNumber} for "${title}" should be a well-formed xref record`);
      assert(
        bytes.subarray(offset).toString('utf8').startsWith(`${objectNumber} 0 obj\n`),
        `entry ${objectNumber} for "${title}" should point at that object's header`
      );
    });
  }
}

// Every unsupported character used to become its own underscore, so a title in
// any non-Latin script kept nothing of itself and downloaded as a row of
// underscores; punctuation left runs of them through Latin titles; and nothing
// bounded the length, so a long title produced a name past the 255-byte limit
// filesystems and object stores enforce.
async function testFilenamesStayReadableAndPortable(): Promise<void> {
  const exportService = new ExportService();

  const filenameFor = async (title: string): Promise<string> => {
    const result = await exportService.saveAndExport(createInput({ title }));
    assert(result.success, `export of "${title}" should succeed`);
    return (result.data as SaveExportSeam['output']).filename;
  };

  const cyrillicTitle = 'Полночь';
  const fallbackNames = new Set<string>();
  for (const title of [cyrillicTitle, '月の物語', '🐉🐉🐉', '   ']) {
    const filename = await filenameFor(title);
    assert(
      /^story_\d+_[0-9a-f]{8}\.txt$/.test(filename),
      `a title with no portable characters should fall back to a named stem (got ${filename})`
    );
    fallbackNames.add(filename);
  }

  // Every one of those titles now shares the stem `story`, so the rest of the
  // name is all that keeps two exports from addressing the same storage URL.
  assert(
    fallbackNames.size === 4,
    `exports sharing a fallback stem should still get distinct names (got ${fallbackNames.size} of 4)`
  );

  const punctuated = await filenameFor("The Vampire's Kiss --- Part II!");
  assert(
    punctuated.startsWith('the_vampire_s_kiss_part_ii_'),
    `runs of unsupported characters should collapse to one separator (got ${punctuated})`
  );
  assert(!/_{2,}/.test(punctuated), `no run of separators should survive (got ${punctuated})`);

  const long = await filenameFor('Midnight Bargain '.repeat(40));
  assert(
    Buffer.byteLength(long, 'utf8') <= 255,
    `a long title should not push the filename past the 255-byte limit (got ${long.length} bytes)`
  );
  assert(long.startsWith('midnight_bargain'), `a long title should keep its readable head (got ${long})`);
  assert(
    /_\d+_[0-9a-f]{8}\.txt$/.test(long),
    `the timestamped, tokenized suffix should survive the cap (got ${long})`
  );

  for (const filename of [punctuated, long, await filenameFor(cyrillicTitle)]) {
    assert(
      encodeURIComponent(filename) === filename,
      `a filename is interpolated into the storage URL, so it should need no escaping (got ${filename})`
    );
  }
}

/**
 * Every tag the plain-text renderer does not recognise as a break is replaced
 * with a single space, so a break the reader sees is silently downgraded to a
 * word gap. The break list stopped at `h3`, so a heading below that level, a
 * `<div>`-wrapped passage, a table row, and an `<hr>` scene divider all ran
 * into the text after them — in the `.txt` and `.pdf` documents and in the
 * `.docx` body, which are the only renderings built from this text.
 */
async function testPlainTextExportKeepsEveryBlockBreak(): Promise<void> {
  const exportService = new ExportService();
  const buffer = await exportService.generateExportContent(createInput({
    content: [
      '<h4>The Vault</h4>',
      '<div>She opened the door.</div>',
      '<hr>',
      '<table><tr><td>Cell A</td><td>Cell B</td></tr></table>'
    ].join('')
  }));
  const text = buffer.toString('utf8');

  for (const [left, right] of [
    ['The Vault', 'She opened the door.'],
    ['She opened the door.', 'Cell A'],
    ['Cell A', 'Cell B']
  ]) {
    assert(
      !new RegExp(`${escapeForAssertion(left)}[^\\n]*${escapeForAssertion(right)}`).test(text),
      `"${left}" and "${right}" are separated by block markup, so they should not share a line (got ${JSON.stringify(text)})`
    );
  }

  for (const fragment of ['The Vault', 'She opened the door.', 'Cell A', 'Cell B']) {
    assert(text.includes(fragment), `"${fragment}" should survive into the export (got ${JSON.stringify(text)})`);
  }

  // Nested closings such as `</td></tr></table>` each ask for a break, and the
  // plain-text normalizer is what keeps them from opening a run of blank lines.
  assert(!/\n{3,}/.test(text), `no run of blank lines should open up (got ${JSON.stringify(text)})`);
}

// The metadata used to be hardcoded to `creature: 'vampire'` and
// `themes: ['romance', 'dark']` for every export, regardless of what story was
// actually exported. The caller now supplies the real values.
async function testMetadataReflectsTheActualStory(): Promise<void> {
  const exportService = new ExportService();

  const withMetadata = await exportService.generateExportContent(createInput({
    format: 'txt',
    includeMetadata: true,
    creature: 'werewolf',
    themes: ['mystery', 'adventure']
  }));
  const text = withMetadata.toString('utf8');

  assert(text.includes('Creature: werewolf'), `export should carry the passed creature (got ${JSON.stringify(text)})`);
  assert(text.includes('Themes: mystery, adventure'), `export should carry the passed themes (got ${JSON.stringify(text)})`);
  assert(!text.includes('vampire'), 'export should not fall back to the old hardcoded creature');
  assert(!text.includes('romance, dark'), 'export should not fall back to the old hardcoded themes');

  const withoutMetadataInput = await exportService.generateExportContent(createInput({
    format: 'txt',
    includeMetadata: true
  }));
  assert(
    withoutMetadataInput.toString('utf8').includes('Creature: unknown'),
    'an export with no creature supplied should say so honestly rather than guessing one'
  );
}

/**
 * The export format list has three readers — the service's own guard, the
 * renderer's switch, and the Angular picker — and the picker's hand-written
 * copy had lost `html`, so the one format nobody could choose was the one whose
 * renderer runs the story through the export sanitizer and attaches the export
 * metadata. `EXPORT_FORMATS` is now the single definition; this holds the two
 * server-side readers to it, and the Angular spec holds the picker to it.
 */
async function testEveryDeclaredFormatRenders(): Promise<void> {
  const exportService = new ExportService();

  assert(EXPORT_FORMATS.includes('html'), 'html is an export format the service renders');

  for (const format of EXPORT_FORMATS) {
    const result = await exportService.saveAndExport(createInput({ format }));
    assert(result.success, `${format} is a declared format and must not be refused as unsupported`);

    const content = await exportService.generateExportContent(createInput({ format }));
    assert(content.length > 0, `${format} should render a non-empty document`);
  }

  const unsupported = await exportService.saveAndExport(
    createInput({ format: 'rtf' as SaveExportSeam['input']['format'] })
  );
  assert(!unsupported.success, 'a format outside the declared list should still be refused');
  assert(
    !unsupported.success && unsupported.error?.code === 'FORMAT_NOT_SUPPORTED',
    'an unsupported format should be named as such rather than reported as a service failure'
  );
}

function escapeForAssertion(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

async function main(): Promise<void> {
  await testPlainTextExportKeepsEveryBlockBreak();
  await testFilenamesStayReadableAndPortable();
  await testDownloadUrlCarriesTheExportedBytes();
  await testPdfCrossReferenceTablePointsAtItsObjects();
  await testFileSizeIsMeasuredInBytes();
  await testPdfStreamLengthDescribesTheStream();
  await testPdfCarriesTheWholeStoryAcrossPages();
  await testPdfLinesBreakOnCharacterBoundaries();
  await testEpubIsARealZipContainerWithItsChapter();
  await testDocxIsARealZipContainerWithItsDocument();
  await testMetadataReflectsTheActualStory();
  await testEveryDeclaredFormatRenders();

  console.log('Export service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
