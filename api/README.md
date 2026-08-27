# Fairytales with Spice - Vercel Serverless API

This directory contains Vercel serverless functions for the Story Lab recovery branch.
Audio endpoints are intentionally deferred for this recovery; story-generation ideas mined from
audio PRs are tracked in `NOT_TAKEN_FEATURE_LEDGER.md`.
The active route budget is now 9 deployable functions out of the 12-function guard after retiring
the unreachable legacy `/api/story/stream` route and, more recently, `/api/story/generate` and
`/api/story/continue` (see "Retired route files" below), after adding the non-durable Story Lab
job-route scaffold, and after adding `api/image/generate.ts` — previously served only by a
hand-rolled Express route in `story-generator/src/server.ts` and completely absent from this
deployment. Status and events URLs rewrite into the single `api/story-lab/jobs.ts` function so the
process-local scaffold does not split state across separate deployed functions.

## 📁 API Structure

```
api/
├── health.ts              # Health check endpoint (GET /api/health)
├── story-lab/
│   ├── jobs.ts           # Story Lab job scaffold
│   │                         # POST /api/story-lab/jobs
│   │                         # GET /api/story-lab/jobs/:jobId via vercel.json rewrite
│   │                         # GET /api/story-lab/jobs/:jobId/events via vercel.json rewrite
│   ├── stories.ts         # Story Lab mock genesis (POST /api/story-lab/stories)
│   ├── stories/[storyId]/continue.ts
│   │                         # Story Lab continuation (POST /api/story-lab/stories/:storyId/continue)
│   └── evaluate.ts        # Prompt/story evaluation (POST /api/story-lab/evaluate)
├── export/
│   └── save.ts            # Save/export stories (POST /api/export/save)
├── image/
│   └── generate.ts        # Story-scene image generation (POST /api/image/generate)
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

- `/api/story-lab/stories` → `/api/story-lab/stories.ts`
- `/api/story-lab/stories/:storyId/continue` → `/api/story-lab/stories/[storyId]/continue.ts`
- `/api/story-lab/jobs` → `/api/story-lab/jobs.ts`
- `/api/story-lab/jobs/:jobId` → rewritten by `vercel.json` to `/api/story-lab/jobs.ts`
- `/api/story-lab/jobs/:jobId/events` → rewritten by `vercel.json` to `/api/story-lab/jobs.ts`
- `/api/story-lab/evaluate` → `/api/story-lab/evaluate.ts`
- `/api/export/save` → `/api/export/save.ts`
- `/api/image/generate` → `/api/image/generate.ts`
- `/api/health` → `/api/health.ts`

Retired route files:

- `/api/story/stream` (old-contract SSE handler, duplicated independently on the Node/Docker
  deployment in `story-generator/src/story-stream-route.ts`; the Node copy only ever registered
  `POST`, which `EventSource` cannot issue, so it was unreachable from any browser, and no
  frontend code called either copy — see `git log` on this file for the resulting bug-fix churn
  on code nobody could exercise. Generation progress is served by `/api/story-lab/jobs.ts`'s job
  event stream instead.)
- `/api/story/stream-demo`
- `/api/story-lab/health`
- `/api/story-lab/stream/genesis` (a second, parallel "live progress" SSE route: unlike the job
  event stream above, it `await`ed the *entire* generation before replaying the already-finished
  chapters back through fixed `setTimeout`s as fabricated per-chapter "progress" — a canned
  animation over a blocking call, not real-time generation. Its only frontend caller,
  `StreamingStoryComponent`, was a hardcoded demo (fixed vampire/dark-romance/900-word blueprint)
  never mounted in any route or nav link — a prior attempt to wire it in leaked the reader's
  free-text logline/character names/world details into the `EventSource` query string and was
  reverted. Deleted along with `StoryService.streamStoryGeneration` and the component; the job
  event stream already provides genuine per-chapter progress against the real generation.)
- `/api/story/generate`, `/api/story/continue` (classic, non-Story-Lab story generation and
  continuation handlers. Dead since the app only ever called `/api/story-lab/...` — see
  `expressApiRoutes.ts`'s own doc comment, which said as much before either file was removed — and
  every request/response shape they served duplicated `StoryService.generateStory` /
  `continueChapter` logic that `storyLabEngine.ts` already calls on the real path via
  `toClassicGenerationInput`. They cost 2 of the 12-function budget for a codepath nothing could
  reach. This investigation is what confirmed it: grepping the Angular app for
  `/api/story/generate` and `/api/story/continue` turns up nothing. The correlation id, access
  control, and redacted structured logging they carried — `beginPostRoute`, `logInfo` /
  `logWarn` / `logError` — moved onto `/api/story-lab/stories` and
  `/api/story-lab/stories/:storyId/continue`, which is what actually needed them.)

`/api/image/generate` was listed here as retired while `story-generator/src/server.ts` kept serving
it ad hoc, only on the Node/Docker deployment — the docs had drifted from the code. It is restored
as a real serverless function above, registered through `expressApiRoutes.ts` like every other route,
rather than retired a second time.

Do not restore retired routes without updating `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md` and
`scripts/recovery/check-vercel-function-count.sh`.

Current function-count guard should print `9/12`.

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

# Test Story Lab genesis (requires request body)
curl -X POST http://localhost:3000/api/story-lab/stories \
  -H "Content-Type: application/json" \
  -d '{"creature":"vampire","tone":"dark_romance","logline":"A cursed bargain changes the court.","spicyLevel":2,"desiredWordBudget":900,"chapterBatchSize":1,"themes":[],"heatContract":{"adultOnlyConfirmed":true,"tensionMode":"slow_burn","intimacyBoundary":"closed_door"}}'
```

---

**Built with Seam-Driven Development** 🚀
