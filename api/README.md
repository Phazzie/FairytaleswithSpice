# Fairytales with Spice - Vercel Serverless API

This directory contains Vercel serverless functions that replace the Express.js backend.

## 📁 API Structure

```
api/
├── health.ts              # Health check endpoint (GET /api/health)
├── story/
│   └── generate.ts        # Story generation (POST /api/generate-story)
├── audio/
│   └── convert.ts         # Audio conversion (POST /api/convert-audio)
├── export/
│   └── save.ts           # Save/export stories (POST /api/save-story)
└── lib/
    ├── services/         # Business logic services
    │   ├── storyService.ts    # Grok AI integration
    │   ├── audioService.ts    # ElevenLabs integration  
    │   └── exportService.ts   # Export functionality
    └── types/
        └── contracts.ts   # TypeScript contracts

```

## 🌍 Environment Variables

### Required for Production (Vercel)

Set these environment variables in your Vercel dashboard:

```bash
# AI Service API Keys
XAI_AI_KEY=your_xai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Frontend Configuration
FRONTEND_URL=https://fairytaleswithspice.vercel.app

# Runtime Configuration
NODE_ENV=production
```

### Optional Configuration

```bash
# ElevenLabs Voice Configuration (uses defaults if not set)
ELEVENLABS_VOICE_FEMALE=EXAVITQu4vr4xnSDxMaL
ELEVENLABS_VOICE_MALE=pNInz6obpgDQGcFmaJgB
ELEVENLABS_VOICE_NEUTRAL=21m00Tcm4TlvDq8ikWAM

# Storage Configuration
STORAGE_BASE_URL=https://storage.fairytaleswithspice.com
```

## 🔗 API Endpoints

### Health Check
```http
GET /api/health
```

Returns service status and configuration information.

### Story Generation
```http
POST /api/generate-story
Content-Type: application/json

{
  "creature": "vampire",
  "themes": ["romance", "adventure"],
  "spicyLevel": 3,
  "wordCount": 900,
  "userInput": "Optional custom ideas"
}
```

### Audio Conversion
```http
POST /api/convert-audio
Content-Type: application/json

{
  "storyId": "story_123",
  "content": "<h3>Story content...</h3>",
  "voice": "female",
  "speed": 1.0,
  "format": "mp3"
}
```

### Save/Export
```http
POST /api/save-story
Content-Type: application/json

{
  "storyId": "story_123",
  "content": "<h3>Story content...</h3>",
  "title": "My Spicy Story",
  "format": "pdf",
  "includeMetadata": true
}
```

## 🚀 Deployment

The API is automatically deployed to Vercel when changes are pushed to the main branch.

### URL Mapping

- `/api/generate-story` → `/api/story/generate.ts`
- `/api/convert-audio` → `/api/audio/convert.ts`
- `/api/save-story` → `/api/export/save.ts`
- `/api/health` → `/api/health.ts`

### CORS Configuration

The API is configured to accept requests from the frontend domain specified in `FRONTEND_URL` environment variable.

### Mock Mode

Without API keys, the services run in mock mode with realistic delays and responses for development.

## 🔧 Local Development

For local testing, you can use the Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev
```

Or test individual functions:

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test story generation (requires request body)
curl -X POST http://localhost:3000/api/generate-story \
  -H "Content-Type: application/json" \
  -d '{"creature":"vampire","themes":["romance"],"spicyLevel":2,"wordCount":700}'
```

---

**Built with Seam-Driven Development** 🚀