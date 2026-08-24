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

async function main(): Promise<void> {
  await testDownloadUrlMatchesReportedFilename();
  await testFileSizeIsMeasuredInBytes();

  console.log('Export service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
