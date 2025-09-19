import { setCorsHeaders, handlePreflight, validateMethod } from './lib/utils/cors';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  if (handlePreflight(req, res)) return;

  // Only allow GET requests
  if (!validateMethod(req, res, ['GET'])) return;

  try {
    // Health check response
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}