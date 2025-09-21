import { SaveExportSeam } from '@fairytales-with-spice/contracts';
import { FormatGenerator } from './FormatGenerator';

export class DocxGenerator implements FormatGenerator {
  async generate(input: SaveExportSeam['input']): Promise<string> {
    return 'mock docx content';
  }
}
