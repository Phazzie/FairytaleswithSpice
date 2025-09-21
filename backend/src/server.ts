import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { storyRoutes } from './routes/storyRoutes';
import { audioRoutes } from './routes/audioRoutes';
import { exportRoutes } from './routes/exportRoutes';
import { StoryService } from './services/storyService';
import { GrokAIService } from './services/ai/GrokAIService';
import { MockAIService } from './services/ai/MockAIService';
import { AxiosHttpClient } from './lib/http/AxiosHttpClient';
import { StoryInputValidator } from './lib/validation/StoryInputValidator';
import { AIService } from './services/ai/AIService';
import { AudioService } from './services/audioService';
import { ExportService } from './services/exportService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Dependency Injection
const httpClient = new AxiosHttpClient();
const storyInputValidator = new StoryInputValidator();
let aiService: AIService;

if (process.env.XAI_AI_KEY) {
  console.log('🚀 Using GrokAIService');
  aiService = new GrokAIService(process.env.XAI_AI_KEY, httpClient);
} else {
  console.log('⚠️ Using MockAIService. Set XAI_AI_KEY to use real AI.');
  aiService = new MockAIService();
}

const storyService = new StoryService(aiService, storyInputValidator);
const audioService = new AudioService(httpClient, process.env.ELEVENLABS_API_KEY);
const exportService = new ExportService();

// API Routes
app.use('/api', storyRoutes(storyService));
app.use('/api', audioRoutes(audioService));
app.use('/api', exportRoutes(exportService));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    metadata: {
      requestId: req.headers['x-request-id'] || 'unknown',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Seam-Driven Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;