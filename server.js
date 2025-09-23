const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Middleware for parsing JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // CORS headers
  const origin = process.env.FRONTEND_URL || `http://localhost:${port}`;
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        grok: !!process.env.XAI_API_KEY ? 'configured' : 'mock',
        elevenlabs: !!process.env.ELEVENLABS_API_KEY ? 'configured' : 'mock'
      },
      cors: {
        allowedOrigin: process.env.FRONTEND_URL || `http://localhost:${port}`
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

// Mock API endpoints for basic functionality (replace with real handlers when needed)
app.post(['/api/generate-story', '/api/story/generate'], (req, res) => {
  console.log('📚 Story generation request received');
  
  // Mock response for development/testing
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        storyId: `story_${Date.now()}`,
        title: '🧚‍♀️ A Magical Tale',
        content: '<h3>Chapter 1: The Beginning</h3><p>Once upon a time, in a land filled with magic and wonder, there lived a brave fairy who discovered the power of spice in storytelling...</p>',
        rawContent: '<h3>Chapter 1: The Beginning</h3><p>[Narrator]: Once upon a time, in a land filled with magic and wonder, there lived a brave fairy who discovered the power of spice in storytelling...</p>',
        creature: req.body.creature || 'fairy',
        themes: req.body.themes || ['adventure'],
        spicyLevel: req.body.spicyLevel || 1,
        wordCount: req.body.wordCount || 700,
        chapterCount: 1,
        estimatedReadingTime: 3
      },
      metadata: {
        requestId: `req_${Date.now()}`,
        processingTime: 2000,
        model: 'mock-grok',
        tokensUsed: 150
      }
    });
  }, 2000);
});

app.post(['/api/convert-audio', '/api/audio/convert'], (req, res) => {
  console.log('🎵 Audio conversion request received');
  
  // Mock response
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        audioId: `audio_${Date.now()}`,
        url: 'data:audio/mp3;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj',
        format: 'mp3',
        duration: 45,
        fileSize: 1024000,
        voice: req.body.voice || 'female',
        speed: req.body.speed || 1.0,
        processingTime: 12000
      },
      metadata: {
        requestId: `audio_req_${Date.now()}`,
        provider: 'mock-elevenlabs',
        charactersProcessed: req.body.content ? req.body.content.length : 0
      }
    });
  }, 12000);
});

app.post(['/api/save-story', '/api/export/save'], (req, res) => {
  console.log('💾 Export request received');
  
  // Mock response
  res.json({
    success: true,
    data: {
      exportId: `export_${Date.now()}`,
      downloadUrl: '/api/download/story.pdf',
      format: req.body.format || 'pdf',
      fileSize: 2048000,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    },
    metadata: {
      requestId: `export_req_${Date.now()}`,
      processingTime: 1500
    }
  });
});

// Serve static files from Angular build
app.use(express.static(path.join(__dirname, 'dist/browser')));

// Handle Angular routing - return index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ 
      success: false,
      error: {
        code: 'API_NOT_FOUND',
        message: 'API endpoint not found'
      }
    });
  } else {
    res.sendFile(path.join(__dirname, 'dist/browser/index.html'));
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred'
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🧚‍♀️ Fairytales with Spice is running on port ${port}`);
  console.log(`🌐 Access the app at: http://localhost:${port}`);
  console.log(`🔍 Health check: http://localhost:${port}/api/health`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 API Keys: ${process.env.XAI_API_KEY ? '✅' : '🔄'} Grok, ${process.env.ELEVENLABS_API_KEY ? '✅' : '🔄'} ElevenLabs`);
});

module.exports = app;