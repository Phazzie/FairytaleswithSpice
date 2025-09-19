"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
class ExportService {
    constructor() {
        this.storageBaseUrl = process.env.STORAGE_BASE_URL || 'https://storage.example.com';
    }
    async saveAndExport(input) {
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
            // Generate export content based on format
            const exportContent = await this.generateExportContent(input);
            // Save to storage (mock implementation)
            const fileUrl = await this.saveToStorage(exportContent, input);
            // Create response
            const output = {
                exportId: this.generateExportId(),
                storyId: input.storyId,
                downloadUrl: fileUrl,
                filename: this.generateFilename(input),
                format: input.format,
                fileSize: exportContent.length,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
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
        }
        catch (error) {
            console.error('Export error:', error);
            return {
                success: false,
                error: {
                    code: 'EXPORT_FAILED',
                    message: 'Failed to export story',
                    details: error.message
                },
                metadata: {
                    requestId: this.generateRequestId(),
                    processingTime: Date.now() - startTime
                }
            };
        }
    }
    async generateExportContent(input) {
        const cleanContent = this.cleanHtmlContent(input.content);
        const metadata = this.generateMetadata(input);
        switch (input.format) {
            case 'pdf':
                return this.generatePDFContent(cleanContent, metadata, input);
            case 'html':
                return this.generateHTMLContent(cleanContent, metadata, input);
            case 'txt':
                return this.generateTextContent(cleanContent, metadata, input);
            case 'epub':
                return this.generateEPUBContent(cleanContent, metadata, input);
            case 'docx':
                return this.generateDOCXContent(cleanContent, metadata, input);
            default:
                throw new Error(`Unsupported format: ${input.format}`);
        }
    }
    generatePDFContent(content, metadata, input) {
        // Mock PDF generation - in real implementation, use pdfkit or puppeteer
        return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${content.length + 100}
>>
stream
BT
/F1 12 Tf
72 720 Td
(${input.title}) Tj
0 -24 Td
(${content.substring(0, 100)}...) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
0000000354 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
454
%%EOF`;
    }
    generateHTMLContent(content, metadata, input) {
        const includeMetadata = input.includeMetadata !== false;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${input.title}</title>
    <style>
        body { font-family: 'Georgia', serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #2c3e50; }
        .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .story-content { text-align: justify; }
    </style>
</head>
<body>
    <h1>${input.title}</h1>

    ${includeMetadata ? `
    <div class="metadata">
        <h3>Story Information</h3>
        <p><strong>Generated:</strong> ${metadata.generatedAt}</p>
        <p><strong>Word Count:</strong> ${metadata.wordCount}</p>
        <p><strong>Estimated Read Time:</strong> ${metadata.readTime} minutes</p>
        <p><strong>Creature:</strong> ${metadata.creature}</p>
        <p><strong>Themes:</strong> ${metadata.themes.join(', ')}</p>
    </div>
    ` : ''}

    <div class="story-content">
        ${content}
    </div>
</body>
</html>`;
    }
    generateTextContent(content, metadata, input) {
        const includeMetadata = input.includeMetadata !== false;
        let text = `${input.title}\n${'='.repeat(input.title.length)}\n\n`;
        if (includeMetadata) {
            text += `Story Information:\n`;
            text += `Generated: ${metadata.generatedAt}\n`;
            text += `Word Count: ${metadata.wordCount}\n`;
            text += `Estimated Read Time: ${metadata.readTime} minutes\n`;
            text += `Creature: ${metadata.creature}\n`;
            text += `Themes: ${metadata.themes.join(', ')}\n\n`;
            text += `---\n\n`;
        }
        text += content.replace(/<[^>]*>/g, ''); // Remove HTML tags
        return text;
    }
    generateEPUBContent(content, metadata, input) {
        // Mock EPUB generation - in real implementation, use epub-gen or similar
        return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
    <metadata>
        <dc:title>${input.title}</dc:title>
        <dc:creator>Fairytales with Spice</dc:creator>
        <dc:language>en</dc:language>
    </metadata>
    <manifest>
        <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine>
        <itemref idref="chapter1"/>
    </spine>
</package>`;
    }
    generateDOCXContent(content, metadata, input) {
        // Mock DOCX generation - in real implementation, use docx or similar
        return `PK                  docProps/PK                  word/PK                  [Content_Types].xmlPK                  _rels/PK                  word/_rels/document.xml.relsPK                  word/document.xml${content}`;
    }
    async saveToStorage(content, input) {
        // Mock storage implementation - in real implementation, upload to S3, Cloudinary, etc.
        const filename = this.generateFilename(input);
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 300));
        // Return mock URL
        return `${this.storageBaseUrl}/exports/${filename}`;
    }
    validateExportInput(input) {
        const supportedFormats = ['pdf', 'txt', 'html', 'epub', 'docx'];
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
    cleanHtmlContent(htmlContent) {
        // Clean up HTML content for export
        return htmlContent
            .replace(/\n\s*\n/g, '\n') // Remove extra newlines
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    generateMetadata(input) {
        return {
            generatedAt: new Date().toISOString(),
            wordCount: this.countWords(input.content),
            readTime: Math.ceil(this.countWords(input.content) / 200),
            creature: 'vampire', // In real implementation, extract from story data
            themes: ['romance', 'dark'] // In real implementation, extract from story data
        };
    }
    countWords(content) {
        return content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
    }
    generateFilename(input) {
        const sanitizedTitle = input.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        return `${sanitizedTitle}_${Date.now()}.${input.format}`;
    }
    generateExportId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ExportService = ExportService;
