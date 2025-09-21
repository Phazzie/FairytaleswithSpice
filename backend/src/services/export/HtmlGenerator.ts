import { SaveExportSeam } from '@fairytales-with-spice/contracts';
import { FormatGenerator } from './FormatGenerator';

export class HtmlGenerator implements FormatGenerator {
  async generate(input: SaveExportSeam['input']): Promise<string> {
    return '<html>mock html content</html>';
  }
}
