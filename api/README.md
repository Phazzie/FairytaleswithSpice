# Fairytales with Spice - Vercel Serverless API

This directory contains Vercel serverless functions for the Story Lab recovery branch.
Audio endpoints are intentionally deferred for this recovery; story-generation ideas mined from
audio PRs are tracked in `NOT_TAKEN_FEATURE_LEDGER.md`.
The active route budget is now 12 deployable functions out of the 12-function guard after adding
the non-durable Story Lab job-route scaffold. Do not add another deployable route until a new
consolidation plan frees capacity.

## 📁 API Structure

```
api/
├── health.ts              # Health check endpoint (GET /api/health)
├── story/
│   ├── generate.ts        # Story generation (POST /api/story/generate)
│   ├── continue.ts        # Story continuation (POST /api/story/continue)
│   └── stream.ts          # Story streaming (POST /api/story/stream)
├── story-lab/
│   ├── jobs.ts           # Story Lab job creation scaffold (POST /api/story-lab/jobs)
│   ├── jobs/[jobId].ts   # Story Lab job status (GET /api/story-lab/jobs/:jobId)
│   ├── jobs/[jobId]/events.ts
│   │                         # Story Lab job event replay (GET /api/story-lab/jobs/:jobId/events)
│   ├── stories.ts         # Story Lab mock genesis (POST /api/story-lab/stories)
│   ├── stories/[storyId]/continue.ts
│   │                         # Story Lab continuation (POST /api/story-lab/stories/:storyId/continue)
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

### Story Lab Jobs
```http
POST /api/story-lab/jobs
Content-Type: application/json

{
  "kind": "genesis",
  "blueprint": {
    "creature": "vampire",
    "tone": "dark_romance",
    "themes": [],
    "logline": "A cursed bargain changes the court.",
    "spicyLevel": 3,
    "desiredWordBudget": 1200,
    "chapterBatchSize": 2
  }
}
```

Returns an opaque `job_<uuid>` plus status and events paths. Current job storage is
`non_durable_memory`: it is process-local and can disappear after a cold start, deploy, or crash.
Export and audio job kinds are reserved for later durable storage/provider work.

```http
GET /api/story-lab/jobs/:jobId
GET /api/story-lab/jobs/:jobId/events
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
- `/api/story-lab/stories/:storyId/continue` → `/api/story-lab/stories/[storyId]/continue.ts`
- `/api/story-lab/jobs` → `/api/story-lab/jobs.ts`
- `/api/story-lab/jobs/:jobId` → `/api/story-lab/jobs/[jobId].ts`
- `/api/story-lab/jobs/:jobId/events` → `/api/story-lab/jobs/[jobId]/events.ts`
- `/api/story-lab/evaluate` → `/api/story-lab/evaluate.ts`
- `/api/story-lab/stream/genesis` → `/api/story-lab/stream/genesis.ts`
- `/api/export/save` → `/api/export/save.ts`
- `/api/health` → `/api/health.ts`

Retired route files:

- `/api/story/stream-demo`
- `/api/story-lab/health`
- `/api/image/generate`

Do not restore retired routes without updating `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md` and
`scripts/recovery/check-vercel-function-count.sh`.

Current function-count guard should print `12/12`.

### CORS Configuration

The API is configured to accept requests from the frontend domain specified in `FRONTEND_URL` environment variable.

### Mock Mode

Without API keys, the services run in mock mode with realistic delays and responses for development.
In production-like environments, missing `XAI_API_KEY` fails Story Lab generation jobs with
`AI_UNAVAILABLE` instead of silently returning mock prose.

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
curl -X POST http://localhost:3000/api/story/generate \
  -H "Content-Type: application/json" \
  -d '{"creature":"vampire","themes":["romance"],"spicyLevel":2,"wordCount":700}'
```

---

**Built with Seam-Driven Development** 🚀
