import { randomUUID } from 'node:crypto';
import { SaveExportSeam, ApiResponse, EXPORT_FORMATS, ExportFormat } from '../types/contracts';
import {
  escapeHtml,
  escapePdfText,
  sanitizeStoryHtmlForExport,
  stripStoryHtmlForExport
} from './exportSanitizer';
import { buildZipArchive, ZipEntry } from './zipArchive';

// US Letter, in the points a PDF's default user space is measured in.
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 72;
const PDF_FONT_SIZE = 12;
const PDF_LINE_HEIGHT = 16;
/**
 * How wide a character is assumed to be, as a fraction of the font size.
 *
 * Helvetica is proportional, so a line's real width depends on which glyphs are
 * in it: `l` is 0.222em and `W` is 0.944em. Rather than ship a width table for
 * one font, lines are broken on a per-character estimate chosen above
 * Helvetica's average for lowercase prose (~0.5em), which errs toward a short
 * line. A short line wraps early; a long one would run off the page edge, since
 * nothing in a PDF clips a text-showing operator to the media box.
 */
const PDF_GLYPH_WIDTH_EM = 0.55;
const PDF_MAX_LINE_CHARACTERS = Math.floor(
  (PDF_PAGE_WIDTH - PDF_MARGIN * 2) / (PDF_FONT_SIZE * PDF_GLYPH_WIDTH_EM)
);
const PDF_LINES_PER_PAGE = Math.floor((PDF_PAGE_HEIGHT - PDF_MARGIN * 2) / PDF_LINE_HEIGHT);
// Leaves room for the `_<timestamp>_<token>.<format>` suffix inside the
// 255-byte filename limit that ext4 and APFS enforce.
const EXPORT_FILENAME_STEM_MAX_LENGTH = 80;
// Distinguishes two exports that collide on both stem and millisecond.
const EXPORT_FILENAME_TOKEN_LENGTH = 8;

const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  html: 'text/html',
  txt: 'text/plain',
  epub: 'application/epub+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

/**
 * Cut `value` into runs of at most `limit` code points. Iterating a string
 * yields whole code points rather than UTF-16 code units, so an astral-plane
 * character always stays whole — a cut between the halves of a surrogate pair
 * would encode as U+FFFD on both sides of it.
 */
function chunkByCodePoint(value: string, limit: number): string[] {
  const chunks: string[] = [];
  let chunk = '';
  let taken = 0;

  for (const character of value) {
    if (taken >= limit) {
      chunks.push(chunk);
      chunk = '';
      taken = 0;
    }

    chunk += character;
    taken += 1;
  }

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
}

/** The code points in `value`, which is what the line width is measured in. */
function countCodePoints(value: string): number {
  let count = 0;

  for (const _character of value) {
    count += 1;
  }

  return count;
}

/**
 * Break one paragraph of the story into the lines a PDF page shows it as.
 *
 * Words are kept whole where they fit; a word longer than a whole line — a URL,
 * a run of unbroken text — is cut at code-point boundaries rather than being
 * allowed to run off the page. A paragraph with no words still yields one
 * (empty) line, so the blank line between two paragraphs survives into the
 * document.
 */
function wrapPdfParagraph(paragraph: string, maxCharacters: number): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    for (const piece of chunkByCodePoint(word, maxCharacters)) {
      if (current.length === 0) {
        current = piece;
        continue;
      }

      if (countCodePoints(current) + 1 + countCodePoints(piece) <= maxCharacters) {
        current += ` ${piece}`;
        continue;
      }

      lines.push(current);
      current = piece;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * Drop any separators the length cap left at the end of a filename stem.
 *
 * The join above leaves single separators, so the cut can strand at most one —
 * the loop is the cheap way to say that without the reader having to prove it.
 */
function trimTrailingSeparators(stem: string): string {
  let end = stem.length;

  while (end > 0 && stem[end - 1] === '_') {
    end -= 1;
  }

  return stem.slice(0, end);
}

interface ExportMetadata {
  generatedAt: string;
  wordCount: number;
  readTime: number;
  creature: string;
  themes: string[];
}

export class ExportService {
  async saveAndExport(input: SaveExportSeam['input']): Promise<ApiResponse<SaveExportSeam['output']>> {
    const startTime = Date.now();

    try {
      // Validate input
      const validationError = this.validateExportInput(input);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          metadata: {
            requestId: this.generateRequestId(),
            processingTime: Date.now() - startTime
          }
        };
      }

      const exportContent = await this.generateExportContent(input);

      // The filename is timestamped, so it has to be generated once and shared:
      // deriving it separately for the storage URL and for the response would
      // stamp two different times and hand the client a download URL whose name
      // does not match the filename it was told to save.
      const filename = this.generateFilename(input);

      // There is no object storage behind this service: the exported bytes are
      // handed back directly as a `data:` URI rather than a link to somewhere
      // they were uploaded. That URI resolves immediately, in the same
      // response, with nothing left to expire.
      const downloadUrl = this.buildDataUri(input.format, exportContent);

      const output: SaveExportSeam['output'] = {
        exportId: this.generateExportId(),
        storyId: input.storyId,
        downloadUrl,
        filename,
        format: input.format,
        fileSize: exportContent.length,
        exportedAt: new Date()
      };

      return {
        success: true,
        data: output,
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };

    } catch {
      console.error('Export failed');

      return {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Failed to export story'
        },
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Render the export document for an input without building its data URI.
   *
   * Public because the document itself is the product: `saveAndExport` reports
   * only its size and a self-contained download URI, so this is the supported
   * way to assert on what an export actually contains.
   */
  async generateExportContent(input: SaveExportSeam['input']): Promise<Buffer> {
    const sanitizedHtml = sanitizeStoryHtmlForExport(input.content);
    const plainText = stripStoryHtmlForExport(input.content);
    const metadata = this.generateMetadata(plainText, input);

    switch (input.format) {
      case 'pdf':
        return Buffer.from(this.generatePDFContent(plainText, input), 'utf8');
      case 'html':
        return Buffer.from(this.generateHTMLContent(sanitizedHtml, metadata, input), 'utf8');
      case 'txt':
        return Buffer.from(this.generateTextContent(plainText, metadata, input), 'utf8');
      case 'epub':
        return this.generateEPUBContent(plainText, input);
      case 'docx':
        return this.generateDOCXContent(plainText, input);
      default:
        throw new Error(`Unsupported format: ${input.format}`);
    }
  }

  /**
   * Write the story out as a paginated PDF.
   *
   * It used to be one page holding the title and `truncateByCodePoint(content,
   * 100)` followed by a literal `...`, so choosing PDF from the export picker
   * produced a document with the first hundred characters of the story in it —
   * about a sentence — while the four other formats shipped the whole thing.
   * Nothing said so: the file downloaded under the story's own name, at the
   * size a real PDF of a sentence is, and the trailing ellipsis reads as
   * ordinary prose in a story that ends on a cliffhanger.
   *
   * The text is broken into lines and the lines into pages, and each page is a
   * `/Page` of its own with its own content stream. `assemblePdfDocument`
   * measures the cross-reference offsets from whatever objects it is handed, so
   * the table stays correct however many pages a story runs to.
   */
  private generatePDFContent(content: string, input: SaveExportSeam['input']): string {
    // The title heads the document, then a blank line, then the story — the
    // same order the `.txt` export puts them in.
    const lines = [input.title, '', ...content.split('\n')].flatMap(paragraph =>
      wrapPdfParagraph(paragraph, PDF_MAX_LINE_CHARACTERS)
    );

    const pages: string[][] = [];
    for (let index = 0; index < lines.length; index += PDF_LINES_PER_PAGE) {
      pages.push(lines.slice(index, index + PDF_LINES_PER_PAGE));
    }
    // An empty story still gets a page, so the document is a valid PDF with a
    // page tree rather than one whose `/Kids` array is empty.
    if (pages.length === 0) {
      pages.push(['']);
    }

    // Objects 1, 2 and 3 are the catalog, the page tree and the font; each page
    // then contributes its `/Page` and the content stream that page points at,
    // in that order, so both numbers follow from the page's index.
    const FIRST_PAGE_OBJECT_NUMBER = 4;
    const pageObjectNumber = (index: number) => FIRST_PAGE_OBJECT_NUMBER + index * 2;

    const objects = [
      `<<
/Type /Catalog
/Pages 2 0 R
>>`,
      `<<
/Type /Pages
/Kids [${pages.map((_page, index) => `${pageObjectNumber(index)} 0 R`).join(' ')}]
/Count ${pages.length}
>>`,
      `<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>`
    ];

    pages.forEach((pageLines, index) => {
      const contentStream = this.buildPdfPageContentStream(pageLines);

      objects.push(
        `<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}]
/Contents ${pageObjectNumber(index) + 1} 0 R
/Resources <<
/Font <<
/F1 3 0 R
>>
>>
>>`,
        // `/Length` tells a reader how many bytes of stream follow the `stream`
        // keyword, so it has to be measured from the stream itself. It used to
        // be derived from the whole story text, which is neither what the
        // stream holds nor a byte count, and left readers scanning past
        // `endstream`.
        `<<
/Length ${Buffer.byteLength(contentStream, 'utf8')}
>>
stream
${contentStream}
endstream`
      );
    });

    return this.assemblePdfDocument(objects);
  }

  /**
   * The text operators for one page.
   *
   * Each line is escaped as it is written, from the source text rather than
   * from text that has already been escaped: cutting escaped text splits
   * whatever the escaping added at the boundary — a `\(` pair loses its
   * parenthesis and leaves a dangling backslash that escapes the character
   * after it.
   */
  private buildPdfPageContentStream(pageLines: string[]): string {
    const firstBaseline = PDF_PAGE_HEIGHT - PDF_MARGIN;
    const operators = pageLines.flatMap((line, index) => [
      index === 0 ? `${PDF_MARGIN} ${firstBaseline} Td` : `0 -${PDF_LINE_HEIGHT} Td`,
      `(${escapePdfText(line)}) Tj`
    ]);

    return [`BT`, `/F1 ${PDF_FONT_SIZE} Tf`, ...operators, `ET`].join('\n');
  }

  /**
   * Write the objects out with a cross-reference table that points at them.
   *
   * A reader resolves an object by seeking to the byte offset the xref table
   * gives for it, and finds the table itself through `startxref`. Those offsets
   * therefore have to be measured from the document being written: they used to
   * be fixed constants copied from some earlier draft, so they addressed the
   * middle of whatever a real title and excerpt happened to push into their
   * place, and every object lookup landed on bytes that are not an object
   * header. Each entry is measured here as the document is assembled, so the
   * table stays correct however long the story's title and excerpt are.
   */
  private assemblePdfDocument(objects: string[]): string {
    let document = '%PDF-1.4\n';
    const offsets: number[] = [];

    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(document, 'utf8'));
      document += `${index + 1} 0 obj\n${body}\nendobj\n\n`;
    });

    const xrefOffset = Buffer.byteLength(document, 'utf8');
    const entries = [
      // The head of the free-object list: object 0 is always free, and its
      // generation number is the 65535 the spec reserves for it.
      '0000000000 65535 f ',
      ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n `)
    ];

    document += `xref
0 ${objects.length + 1}
${entries.join('\n')}
trailer
<<
/Size ${objects.length + 1}
/Root 1 0 R
>>
startxref
${xrefOffset}
%%EOF`;

    return document;
  }

  private generateHTMLContent(content: string, metadata: ExportMetadata, input: SaveExportSeam['input']): string {
    const includeMetadata = input.includeMetadata !== false;
    const title = escapeHtml(input.title);
    const generatedAt = escapeHtml(metadata.generatedAt);
    const creature = escapeHtml(metadata.creature);
    const themes = metadata.themes.map(theme => escapeHtml(theme)).join(', ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: 'Georgia', serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #2c3e50; }
        .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .story-content { text-align: justify; }
    </style>
</head>
<body>
    <h1>${title}</h1>

    ${includeMetadata ? `
    <div class="metadata">
        <h3>Story Information</h3>
        <p><strong>Generated:</strong> ${generatedAt}</p>
        <p><strong>Word Count:</strong> ${metadata.wordCount}</p>
        <p><strong>Estimated Read Time:</strong> ${metadata.readTime} minutes</p>
        <p><strong>Creature:</strong> ${creature}</p>
        <p><strong>Themes:</strong> ${themes}</p>
    </div>
    ` : ''}

    <div class="story-content">
        ${content}
    </div>
</body>
</html>`;
  }

  private generateTextContent(content: string, metadata: ExportMetadata, input: SaveExportSeam['input']): string {
    const includeMetadata = input.includeMetadata !== false;
    const title = stripStoryHtmlForExport(input.title);

    let text = `${title}\n${'='.repeat(title.length)}\n\n`;

    if (includeMetadata) {
      text += `Story Information:\n`;
      text += `Generated: ${metadata.generatedAt}\n`;
      text += `Word Count: ${metadata.wordCount}\n`;
      text += `Estimated Read Time: ${metadata.readTime} minutes\n`;
      text += `Creature: ${metadata.creature}\n`;
      text += `Themes: ${metadata.themes.join(', ')}\n\n`;
      text += `---\n\n`;
    }

    text += content;

    return text;
  }

  /**
   * Build a real EPUB 3 container: the mandatory `mimetype` entry (stored,
   * uncompressed, first), the OCF `container.xml` pointer, a package document
   * with the nav item EPUB 3 requires, the nav document itself, and the
   * chapter it points at — actually containing the story, where the previous
   * version referenced a `chapter1.xhtml` it never wrote.
   */
  private generateEPUBContent(plainText: string, input: SaveExportSeam['input']): Buffer {
    const title = escapeHtml(input.title);
    // Derived from the story being exported rather than a fresh `randomUUID()`
    // per call: the same story exported twice should produce the same book
    // identifier, and a real UUID would make otherwise-identical output
    // (including the copy this method itself hands back for verification)
    // vary from one call to the next.
    const bookId = `urn:x-fairytales-with-spice:${escapeHtml(input.storyId)}`;
    const chapterXhtml = this.toXhtmlBody(plainText);

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Fairytales with Spice</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

    const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
<nav epub:type="toc" id="toc">
<ol><li><a href="chapter1.xhtml">${title}</a></li></ol>
</nav>
</body>
</html>`;

    const chapter1Xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title></head>
<body>
<h1>${title}</h1>
${chapterXhtml}
</body>
</html>`;

    const entries: ZipEntry[] = [
      // Must be the first entry, stored uncompressed, for a conforming reader
      // to identify the container by its first 38 bytes alone.
      { path: 'mimetype', data: Buffer.from('application/epub+zip', 'ascii') },
      { path: 'META-INF/container.xml', data: Buffer.from(containerXml, 'utf8') },
      { path: 'OEBPS/content.opf', data: Buffer.from(contentOpf, 'utf8') },
      { path: 'OEBPS/nav.xhtml', data: Buffer.from(navXhtml, 'utf8') },
      { path: 'OEBPS/chapter1.xhtml', data: Buffer.from(chapter1Xhtml, 'utf8') }
    ];

    return buildZipArchive(entries);
  }

  /**
   * Build a real, minimal OOXML `.docx`: the package-level content-types and
   * relationship parts every `.docx` reader requires, plus a `word/document.xml`
   * holding the story as one paragraph per line. The previous version wrote
   * literal text made to *look* like these zip entries' names, concatenated
   * with escaped plain text — not a zip archive at all.
   */
  private generateDOCXContent(plainText: string, input: SaveExportSeam['input']): Buffer {
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const paragraphs = [input.title, ...plainText.split('\n').map(line => line.trim())]
      .filter(Boolean)
      .map(line => `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(line)}</w:t></w:r></w:p>`)
      .join('\n    ');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr/>
  </w:body>
</w:document>`;

    const entries: ZipEntry[] = [
      { path: '[Content_Types].xml', data: Buffer.from(contentTypesXml, 'utf8') },
      { path: '_rels/.rels', data: Buffer.from(relsXml, 'utf8') },
      { path: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') }
    ];

    return buildZipArchive(entries);
  }

  /**
   * Turn the plain-text export into well-formed XHTML paragraphs: each
   * non-blank line becomes its own escaped `<p>`, which is enough structure for
   * a real XHTML document without re-parsing the sanitizer's HTML-oriented
   * output (whose unclosed `<br>` void tags are not valid XHTML).
   */
  private toXhtmlBody(plainText: string): string {
    return plainText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => `<p>${escapeHtml(line)}</p>`)
      .join('\n');
  }

  private buildDataUri(format: ExportFormat, content: Buffer): string {
    return `data:${EXPORT_MIME_TYPES[format]};base64,${content.toString('base64')}`;
  }

  private validateExportInput(input: SaveExportSeam['input']): any {
    // The contract's own list rather than a fourth copy of it: the picker, this
    // guard, and `generateExportContent`'s switch all have to name the same five
    // formats, and the copy in the picker is the one that had already drifted.
    const supportedFormats: ExportFormat[] = [...EXPORT_FORMATS];

    if (!supportedFormats.includes(input.format)) {
      return {
        code: 'FORMAT_NOT_SUPPORTED',
        message: `Format '${input.format}' is not supported`,
        requestedFormat: input.format,
        supportedFormats: supportedFormats
      };
    }

    if (!input.storyId || !input.content || !input.title) {
      return {
        code: 'INVALID_INPUT',
        message: 'Missing required fields: storyId, content, title'
      };
    }

    return null;
  }

  private generateMetadata(content: string, input: SaveExportSeam['input']): ExportMetadata {
    return {
      generatedAt: new Date().toISOString(),
      wordCount: this.countWords(content),
      readTime: Math.ceil(this.countWords(content) / 200),
      creature: input.creature ?? 'unknown',
      themes: input.themes ?? []
    };
  }

  private countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Name the export file.
   *
   * The name has to be unique per export, because it is what the storage URL
   * addresses: a real object store would let a second export overwrite the
   * first. A timestamp alone does not give that. Two exports raced within one
   * millisecond already collided whenever their titles matched, and the stem
   * fallback widened the window — every title with no portable characters, in
   * any script, now shares the stem `story`. A random token per export closes
   * it without giving up the readable, sortable name.
   */
  private generateFilename(input: SaveExportSeam['input']): string {
    const token = randomUUID().replace(/-/g, '').slice(0, EXPORT_FILENAME_TOKEN_LENGTH);
    return `${this.buildFilenameStem(input.title)}_${Date.now()}_${token}.${input.format}`;
  }

  /**
   * Turn a story title into the readable, portable stem of its filename.
   *
   * Replacing each unsupported character with its own underscore produced names
   * no one can use: a title written in any non-Latin script kept none of its
   * characters, so every such export downloaded as a row of underscores and a
   * timestamp, indistinguishable from every other one; punctuation left runs of
   * underscores through otherwise Latin titles; and nothing bounded the length,
   * so a long title produced a name past the 255-byte limit filesystems such as
   * ext4 and APFS enforce. Collapsing each run to a single separator, trimming
   * the ends, capping the stem, and naming the fallback keeps the name both
   * meaningful and safe to write — and, since the stem is interpolated into the
   * storage URL, keeps that URL free of characters that would need escaping.
   */
  private buildFilenameStem(title: string): string {
    // Splitting on the unsupported runs and joining the parts back collapses
    // each run and drops the leading and trailing ones in a single linear pass:
    // a separator at either end leaves an empty part, which the filter removes.
    // Trimming them with `/^_+|_+$/` instead is quadratic — an anchored `_+`
    // is retried from every position of a long underscore run before it fails.
    const parts = title.split(/[^a-z0-9]+/i).filter(Boolean);
    const stem = trimTrailingSeparators(
      parts.join('_').toLowerCase().slice(0, EXPORT_FILENAME_STEM_MAX_LENGTH)
    );

    return stem || 'story';
  }

  private generateExportId(): string {
    return `export_${randomUUID()}`;
  }

  private generateRequestId(): string {
    return `req_${randomUUID()}`;
  }
}
