#!/usr/bin/env tsx
// Created: 2026-08-24 18:05 UTC

import { ExportService } from '../api/_lib/services/exportService';
import { SaveExportSeam } from '../api/_lib/types/contracts';

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

// The filename carries a `Date.now()` stamp. It used to be generated twice —
// once inside `saveToStorage` and again for the response — with the mock
// upload's 300ms delay in between, so the two stamps never matched and the
// client was handed a download URL that did not point at the filename it was
// told to save under.
async function testDownloadUrlMatchesReportedFilename(): Promise<void> {
  const exportService = new ExportService();

  for (const format of ['txt', 'html', 'pdf'] as const) {
    const result = await exportService.saveAndExport(createInput({ format }));

    assert(result.success, `${format} export should succeed`);
    const output = result.data as SaveExportSeam['output'];
    assert(
      output.downloadUrl.endsWith(`/exports/${output.filename}`),
      `${format} download URL should end with the reported filename ` +
        `(url=${output.downloadUrl}, filename=${output.filename})`
    );
    assert(output.filename.endsWith(`.${format}`), `${format} filename should keep the requested extension`);
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
  const document = await new ExportService().generateExportContent(
    createInput({ format: 'pdf', content: unicodeStory })
  );

  const declaredLength = Number(/\/Length (\d+)/.exec(document)?.[1]);
  const streamBody = extractPdfStreamBody(document);

  assert(Number.isInteger(declaredLength), 'the PDF content object should declare a /Length');
  assert(
    declaredLength === Buffer.byteLength(streamBody, 'utf8'),
    `/Length should be the stream's UTF-8 byte length ` +
      `(declared=${declaredLength}, actual=${Buffer.byteLength(streamBody, 'utf8')})`
  );
}

// The excerpt used to be cut out of the *escaped* text, which splits whatever
// the escaping added at the cut. The 100th code unit of this body falls inside
// the `\(` written for its parenthesis and inside the surrogate pair written
// for its dragon, so the old cut left a trailing backslash — escaping the `.`
// that follows it — and a lone surrogate that encodes as U+FFFD.
async function testPdfExcerptIsCutOnCharacterBoundaries(): Promise<void> {
  for (const boundary of ['(spice)', '🐉 tail']) {
    const content = `<p>${'x'.repeat(99)}${boundary}</p>`;
    const document = await new ExportService().generateExportContent(
      createInput({ format: 'pdf', content })
    );
    const streamBody = extractPdfStreamBody(document);

    assert(
      !/(^|[^\\])(\\\\)*\\\.\.\.\) Tj/.test(streamBody),
      `a ${boundary} excerpt should not end mid-escape (stream=${JSON.stringify(streamBody)})`
    );
    assert(
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(streamBody),
      `a ${boundary} excerpt should not end on half a surrogate pair`
    );
  }
}

function extractPdfStreamBody(document: string): string {
  const match = /\nstream\n([\s\S]*?)\nendstream\n/.exec(document);
  assert(match, 'the PDF should contain a content stream');
  return match[1];
}

// The EPUB package document writes its metadata with the `dc:` prefix. The
// prefix was never bound to a namespace, so the document was not well-formed
// XML and a conforming reader rejects it before reading any of the metadata.
async function testEpubBindsEveryNamespacePrefixItUses(): Promise<void> {
  const document = await new ExportService().generateExportContent(
    createInput({ format: 'epub' })
  );

  const usedPrefixes = new Set(
    Array.from(document.matchAll(/<\/?([A-Za-z][\w.-]*):/g), match => match[1])
  );

  assert(usedPrefixes.has('dc'), 'the package document should still carry Dublin Core metadata');
  for (const prefix of usedPrefixes) {
    assert(
      document.includes(`xmlns:${prefix}="`),
      `the \`${prefix}:\` prefix should be bound to a namespace on the package element`
    );
  }
}

// A reader resolves an object by seeking to the byte offset the xref table
// gives for it, and finds the table through `startxref`. Both used to be fixed
// constants, so they addressed whatever bytes a real title and excerpt pushed
// into their place and no object lookup landed on an object header.
async function testPdfCrossReferenceTablePointsAtItsObjects(): Promise<void> {
  const exportService = new ExportService();

  for (const title of ['A', 'Midnight Bargain', 'Élodie and the 🐉 of the Château (Part Two)']) {
    const document = await exportService.generateExportContent(
      createInput({ format: 'pdf', title, content: unicodeStory.repeat(4) })
    );
    const bytes = Buffer.from(document, 'utf8');

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
  for (const title of [cyrillicTitle, '月の物語', '🐉🐉🐉', '   ']) {
    const filename = await filenameFor(title);
    assert(
      /^story_\d+\.txt$/.test(filename),
      `a title with no portable characters should fall back to a named stem (got ${filename})`
    );
  }

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
  assert(/_\d+\.txt$/.test(long), `the timestamped suffix should survive the cap (got ${long})`);

  for (const filename of [punctuated, long, await filenameFor(cyrillicTitle)]) {
    assert(
      encodeURIComponent(filename) === filename,
      `a filename is interpolated into the storage URL, so it should need no escaping (got ${filename})`
    );
  }
}

async function main(): Promise<void> {
  await testFilenamesStayReadableAndPortable();
  await testDownloadUrlMatchesReportedFilename();
  await testPdfCrossReferenceTablePointsAtItsObjects();
  await testFileSizeIsMeasuredInBytes();
  await testPdfStreamLengthDescribesTheStream();
  await testPdfExcerptIsCutOnCharacterBoundaries();
  await testEpubBindsEveryNamespacePrefixItUses();

  console.log('Export service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
