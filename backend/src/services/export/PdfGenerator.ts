import { SaveExportSeam } from '@fairytales-with-spice/contracts';
import { FormatGenerator } from './FormatGenerator';

export class PdfGenerator implements FormatGenerator {
  async generate(input: SaveExportSeam['input']): Promise<string> {
    return 'mock pdf content';
  }
}
