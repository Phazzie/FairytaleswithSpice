import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      services: {
        grok: !!process.env['XAI_API_KEY'] ? 'configured' : 'mock',
        elevenlabs: !!process.env['ELEVENLABS_API_KEY'] ? 'configured' : 'mock'
      },
      cors: {
        allowedOrigin: process.env['FRONTEND_URL'] || 'http://localhost:4200'
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
});

export default router;