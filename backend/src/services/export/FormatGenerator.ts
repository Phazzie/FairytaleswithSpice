import { SaveExportSeam } from '@fairytales-with-spice/contracts';

export interface FormatGenerator {
  generate(input: SaveExportSeam['input']): Promise<string>;
}
