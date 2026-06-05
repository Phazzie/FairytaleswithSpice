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
