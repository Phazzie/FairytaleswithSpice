import type { ApiResponse } from './_lib/types/contracts';
import { applyCorsPolicy } from './_lib/http/corsPolicy';

type HealthPayload = {
  status: 'healthy';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    grok: 'configured' | 'mock';
  };
  cors: {
    allowedOrigin: string | null;
  };
};

export default async function handler(req: any, res: any) {
  const cors = applyCorsPolicy(req, res, {
    methods: ['GET', 'OPTIONS']
  });
  if (cors.handled) {
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed'
      }
    } satisfies ApiResponse<HealthPayload>);
  }

  try {
    // Health check response with service status
    const health: HealthPayload = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      services: {
        grok: !!process.env['XAI_API_KEY'] ? 'configured' : 'mock'
      },
      cors: {
        // Report what the CORS policy actually resolved for this request rather
        // than re-deriving it from FRONTEND_URL alone: the policy also reads
        // STORY_LAB_ALLOWED_ORIGINS and ALLOWED_ORIGINS, so a deployment
        // configured through either of those was told the wrong origin here.
        allowedOrigin: cors.allowedOrigin
      }
    };
    
    res.status(200).json({
      success: true,
      data: health
    } satisfies ApiResponse<HealthPayload>);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        details: { timestamp: new Date().toISOString() }
      }
    } satisfies ApiResponse<HealthPayload>);
  }
}
