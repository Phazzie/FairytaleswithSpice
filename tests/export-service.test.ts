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
async function testFileSizeIsMeasuredInBytes(): Promise<void> {
  const exportService = new ExportService();
  const input = createInput();

  const result = await exportService.saveAndExport(input);
  assert(result.success, 'unicode export should succeed');
  const output = result.data as SaveExportSeam['output'];

  const exportContent: string = await (exportService as any).generateExportContent(input);
  const expectedBytes = Buffer.byteLength(exportContent, 'utf8');

  assert(
    expectedBytes > exportContent.length,
    'test fixture should contain multi-byte characters so the two measures differ'
  );
  assert(
    output.fileSize === expectedBytes,
    `fileSize should be the UTF-8 byte length (expected ${expectedBytes}, got ${output.fileSize})`
  );
}

async function testAsciiExportStillReportsItsOwnSize(): Promise<void> {
  const exportService = new ExportService();
  const input = createInput({ content: '<p>Plain ascii prose.</p>' });

  const result = await exportService.saveAndExport(input);
  assert(result.success, 'ascii export should succeed');
  const output = result.data as SaveExportSeam['output'];

  const exportContent: string = await (exportService as any).generateExportContent(input);
  assert(
    output.fileSize === exportContent.length,
    'an all-ascii export should report the same size under either measure'
  );
}

async function main(): Promise<void> {
  await testDownloadUrlMatchesReportedFilename();
  await testFileSizeIsMeasuredInBytes();
  await testAsciiExportStillReportsItsOwnSize();

  console.log('Export service tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
