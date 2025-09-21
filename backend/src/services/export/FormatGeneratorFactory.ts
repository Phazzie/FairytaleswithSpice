import { ExportFormat } from '@fairytales-with-spice/contracts';
import { FormatGenerator } from './FormatGenerator';
import { PdfGenerator } from './PdfGenerator';
import { HtmlGenerator } from './HtmlGenerator';
import { TxtGenerator } from './TxtGenerator';
import { EpubGenerator } from './EpubGenerator';
import { DocxGenerator } from './DocxGenerator';

export class FormatGeneratorFactory {
  create(format: ExportFormat): FormatGenerator {
    switch (format) {
      case 'pdf':
        return new PdfGenerator();
      case 'html':
        return new HtmlGenerator();
      case 'txt':
        return new TxtGenerator();
      case 'epub':
        return new EpubGenerator();
      case 'docx':
        return new DocxGenerator();
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
}
