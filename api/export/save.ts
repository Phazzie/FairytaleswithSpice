import { ExportService } from '../lib/services/exportService';
import { SaveExportSeam } from '../lib/types/contracts';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }
    });
  }

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

    // Validate content length (max 500KB)
    const MAX_CONTENT_LENGTH = 500000; // 500KB
    if (input.content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTENT_TOO_LARGE',
          message: `Content exceeds maximum size of ${MAX_CONTENT_LENGTH / 1000}KB`,
          contentLength: input.content.length,
          maxLength: MAX_CONTENT_LENGTH
        }
      });
    }

    const exportService = new ExportService();
    const result = await exportService.saveAndExport(input);
    
    res.status(200).json(result);

  } catch (error: any) {
    console.error('Export serverless function error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Export failed'
      }
    });
  }
}