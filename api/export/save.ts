import { Router, Request, Response } from 'express';
import { ExportService } from '../lib/services/exportService';
import { SaveExportSeam } from '@project/contracts';

const router = Router();
const exportService = new ExportService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: SaveExportSeam['input'] = req.body;

    // Validate required fields
    if (!input.storyId || !input.content || !input.title || !input.format) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, title, format'
        }
      });
    }

    const result = await exportService.saveAndExport(input);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Export API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Export failed'
      }
    });
  }
});

export default router;