export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Health check response with service configuration status
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        grok: !!process.env.XAI_AI_KEY ? 'configured' : 'mock',
        elevenlabs: !!process.env.ELEVENLABS_API_KEY ? 'configured' : 'mock'
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
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