import { SaveExportSeam, ApiResponse, ExportFormat } from '@fairytales-with-spice/contracts';

export interface IExportService {
  saveAndExport(input: SaveExportSeam['input']): Promise<ApiResponse<SaveExportSeam['output']>>;
}

export class ExportService implements IExportService {
  async saveAndExport(input: SaveExportSeam['input']): Promise<ApiResponse<SaveExportSeam['output']>> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}`;

    try {
      const exportContent = await this.generateExportContent(input);
      const fileUrl = await this.saveToStorage(exportContent, input);

      const output: SaveExportSeam['output'] = {
        exportId: `export_${Date.now()}`,
        storyId: input.storyId,
        downloadUrl: fileUrl,
        filename: this.generateFilename(input),
        format: input.format,
        fileSize: exportContent.length,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        exportedAt: new Date()
      };

      return { success: true, data: output, metadata: { requestId, processingTime: Date.now() - startTime } };
    } catch (error: any) {
      console.error('Export error:', error);
      return {
        success: false,
        error: { code: 'EXPORT_FAILED', message: 'Failed to export story', details: error.message },
        metadata: { requestId, processingTime: Date.now() - startTime }
      };
    }
  }

  private async generateExportContent(input: SaveExportSeam['input']): Promise<string> {
    switch (input.format) {
      case 'pdf':
        return 'mock pdf content';
      case 'html':
        return '<html>mock html content</html>';
      case 'txt':
        return 'mock text content';
      case 'epub':
        return 'mock epub content';
      case 'docx':
        return 'mock docx content';
      default:
        throw new Error(`Unsupported format: ${input.format}`);
    }
  }

  private async saveToStorage(content: string, input: SaveExportSeam['input']): Promise<string> {
    const filename = this.generateFilename(input);
    await new Promise(resolve => setTimeout(resolve, 300));
    return `https://storage.example.com/exports/${filename}`;
  }

  private generateFilename(input: SaveExportSeam['input']): string {
    const sanitizedTitle = input.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `${sanitizedTitle}_${Date.now()}.${input.format}`;
  }
}