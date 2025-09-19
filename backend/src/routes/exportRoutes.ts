import express from 'express';
import { ExportService } from '../services/exportService';
import { SaveExportSeam } from '../types/contracts';

const router = express.Router();
const exportService = new ExportService();

// POST /api/save-story
router.post('/save-story', async (req, res) => {
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
    res.json(result);

  } catch (error: any) {
    console.error('Export route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Export failed'
      }
    });
  }
});

export { router as exportRoutes };