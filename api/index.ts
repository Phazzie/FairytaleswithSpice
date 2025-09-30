import express, { Router, Request, Response, NextFunction } from 'express';
import healthRouter from './health';
import storyRouter from './story';
import audioConversionRouter from './audio/convert';
import exportRouter from './export/save';
import imageGenerationRouter from './image/generate';

const apiApp = express();

// Global API Middleware
apiApp.use(express.json({ limit: '10mb' }));

// A self-contained CORS middleware for the API sub-app
const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
};
apiApp.use(corsMiddleware);


// Main API Router
const mainApiRouter = Router();
mainApiRouter.use('/health', healthRouter);
mainApiRouter.use('/story', storyRouter);
mainApiRouter.use('/audio/convert', audioConversionRouter);
mainApiRouter.use('/export/save', exportRouter);
mainApiRouter.use('/image/generate', imageGenerationRouter);

// Mount the main router
apiApp.use('/', mainApiRouter);

export default apiApp;