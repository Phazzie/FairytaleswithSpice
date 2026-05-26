# Fairytales with Spice - Vercel Serverless API

This directory contains Vercel serverless functions for the Story Lab recovery branch.
Audio endpoints are intentionally deferred for this recovery; story-generation ideas mined from
audio PRs are tracked in `NOT_TAKEN_FEATURE_LEDGER.md`.

## 📁 API Structure

```
api/
├── health.ts              # Health check endpoint (GET /api/health)
├── story/
│   ├── generate.ts        # Story generation (POST /api/story/generate)
│   ├── continue.ts        # Story continuation (POST /api/story/continue)
│   └── stream.ts          # Story streaming (POST /api/story/stream)
├── story-lab/
│   ├── stories.ts         # Story Lab mock genesis (POST /api/story-lab/stories)
│   ├── evaluate.ts        # Prompt/story evaluation (POST /api/story-lab/evaluate)
│   └── stream/genesis.ts  # Story Lab mock streaming (GET /api/story-lab/stream/genesis)
├── export/
│   └── save.ts            # Save/export stories (POST /api/export/save)
└── _lib/
    ├── services/          # Business logic services
    │   ├── storyService.ts    # Grok AI integration
    │   └── exportService.ts   # Export functionality
    └── types/
        └── contracts.ts       # TypeScript contracts

```

## 🌍 Environment Variables

### Required for Production (Vercel)

Set these environment variables in your Vercel dashboard:

```bash
# AI Service API Keys
XAI_API_KEY=your_xai_api_key_here

# Frontend Configuration
FRONTEND_URL=https://fairytaleswithspice.vercel.app

# Runtime Configuration
NODE_ENV=production
```

## 🔗 API Endpoints

### Health Check
```http
GET /api/health
```

Returns service status and configuration information.

### Story Generation
```http
POST /api/story/generate
Content-Type: application/json

{
  "creature": "vampire",
  "themes": ["romance", "adventure"],
  "spicyLevel": 3,
  "wordCount": 900,
  "userInput": "Optional custom ideas"
}
```

### Story Lab Genesis
```http
POST /api/story-lab/stories
Content-Type: application/json

{
  "creature": "vampire",
  "tone": "dark_romance",
  "themes": [],
  "logline": "A cursed bargain changes the court.",
  "spicyLevel": 3,
  "desiredWordBudget": 1200,
  "chapterBatchSize": 2
}
```

### Save/Export
```http
POST /api/export/save
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

- `/api/story/generate` → `/api/story/generate.ts`
- `/api/story/continue` → `/api/story/continue.ts`
- `/api/story/stream` → `/api/story/stream.ts`
- `/api/story-lab/stories` → `/api/story-lab/stories.ts`
- `/api/export/save` → `/api/export/save.ts`
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
