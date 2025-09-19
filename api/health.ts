import { setCorsHeaders, handlePreflight, validateMethod } from './lib/utils/cors';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  if (handlePreflight(req, res)) return;

  // Only allow GET requests
  if (!validateMethod(req, res, ['GET'])) return;

  try {
    // Health check response with service status
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        grok: !!process.env.XAI_AI_KEY ? 'configured' : 'mock',
        elevenlabs: !!process.env.ELEVENLABS_API_KEY ? 'configured' : 'mock'
      },
      cors: {
        allowedOrigin: process.env.FRONTEND_URL || 'http://localhost:4200'
      }
    };
    
    res.status(200).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}