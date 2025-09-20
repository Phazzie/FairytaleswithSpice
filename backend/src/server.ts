// Import necessary packages
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { storyRoutes } from './routes/storyRoutes';
import { audioRoutes } from './routes/audioRoutes';
import { exportRoutes } from './routes/exportRoutes';

// Load environment variables from a .env file into process.env
dotenv.config();

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware Setup ---

// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing (CORS)
// This allows the frontend (running on a different origin) to communicate with the backend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));

// Parse incoming JSON requests and place the parsed data in req.body
// The limit option prevents oversized payloads
app.use(express.json({ limit: '10mb' }));

// Parse incoming URL-encoded requests
app.use(express.urlencoded({ extended: true }));


// --- Core Routes ---

/**
 * Health check endpoint to verify that the server is running.
 * @returns {object} A JSON object with the server's status, timestamp, and version.
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Register API routes for different features
app.use('/api', storyRoutes); // Routes for story generation and management
app.use('/api', audioRoutes); // Routes for audio conversion
app.use('/api', exportRoutes); // Routes for exporting stories


// --- Error Handling ---

/**
 * Custom error handling middleware.
 * This catches all errors that occur in the route handlers.
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  // Send a standardized error response
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      // Only include stack trace in development mode for debugging
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    metadata: {
      requestId: req.headers['x-request-id'] || 'unknown',
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * 404 handler for requests to non-existent routes.
 * This should be the last middleware in the chain.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});


// --- Server Activation ---

// Start the Express server
app.listen(PORT, () => {
  console.log(`🚀 Seam-Driven Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Export the app for testing purposes
export default app;