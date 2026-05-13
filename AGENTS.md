# AGENTS.md — Fairytales with Spice

> This file is read automatically by AI coding agents (Jules, Copilot Workspace, etc.).
> It describes architecture, conventions, and rules for this codebase.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20 with SSR (`@angular/ssr`) |
| Server | Express 5, embedded inside Angular SSR entry point |
| AI / Story Generation | xAI Grok API (`XAI_API_KEY`) |
| Language | TypeScript 5.9.2 |
| Unit Tests | Karma + Jasmine (Angular), `npm run test` inside `story-generator/` |
| Integration Tests | Custom `tsx`-based harness, lives in `tests/` at repo root |
| Deployment | DigitalOcean App Platform (`.do/app.yaml`) |

Express is **not** a separate process. It runs inside `story-generator/src/server.ts` alongside Angular SSR. Do not create a separate `server/` package or a root-level `server.ts`.

---

## Repository Layout

```
fairytaleswithspice/
├── AGENTS.md                          ← you are here
├── package.json                       ← thin orchestration wrapper (not an app)
├── tests/
│   └── story-service-improved.test.ts ← integration tests (requires XAI_API_KEY)
├── .do/
│   └── app.yaml                       ← DigitalOcean deployment config
├── .github/
│   └── copilot-instructions.md        ← SDD methodology reference
└── story-generator/                   ← the actual application
    ├── package.json
    ├── angular.json
    ├── tsconfig.json
    └── src/
        ├── server.ts                  ← Express routes + Angular SSR entry
        ├── app/
        │   ├── contracts.ts           ← FRONTEND contract types (source of truth for UI)
        │   ├── story.service.ts       ← Angular HTTP service (Observable + SSE)
        │   └── ...components/
        └── api/
            └── lib/
                ├── types/
                │   └── contracts.ts   ← BACKEND contract types (mirrors frontend)
                └── services/
                    ├── storyService.ts    ← Grok AI integration (39KB, working)
                    ├── exportService.ts   ← Save/export logic
                    └── imageService.ts    ← Image generation (stub)
```

---

## Architecture: Seam-Driven Development (SDD)

This project uses **SDD** — contracts are defined before any implementation. Every data boundary between components is an explicit TypeScript interface called a "seam."

**Rule**: If you are adding a new feature that crosses a component boundary (UI → API, API → external service), you must define the contract interface first in **both** contract files before writing any implementation code.

### Contract Files

There are two contract files that must stay in sync:

| File | Purpose |
|---|---|
| `story-generator/src/app/contracts.ts` | Used by Angular components and services |
| `story-generator/src/api/lib/types/contracts.ts` | Used by Express route handlers and backend services |

Both define the same seam interfaces. When you add or change a seam, update both files. The pattern is:

```typescript
export interface MyNewSeam {
  seamName: 'myNewSeam';
  input: { /* required fields */ };
  output: { /* response shape */ };
  errors: 'ERROR_CODE_ONE' | 'ERROR_CODE_TWO';
}
```

All API responses follow `ApiResponse<T>`:
```typescript
// success
{ success: true, data: T }
// error
{ success: false, error: { code: string, message: string } }
```

### Established Domain Types

Do not create conflicting types. Use these:

```typescript
type CreatureType = 'vampire' | 'werewolf' | 'fairy';
type ThemeType    = 'betrayal' | 'obsession' | 'power_dynamics' | 'forbidden_love'
                  | 'redemption' | 'corruption' | 'sacrifice' | 'revenge'
                  | 'transformation' | 'duality' | 'temptation' | 'fate'
                  | 'isolation' | 'desire' | 'control' | 'freedom'
                  | 'identity' | 'mortality';
type SpicyLevel   = 1 | 2 | 3 | 4 | 5;
type WordCount    = 700 | 900 | 1200;
```

---

## API Routes (server.ts)

| Method | Path | Handler | Status |
|---|---|---|---|
| GET | `/api/health` | Inline | ✅ Working |
| POST | `/api/story/generate` | `StoryService.generateStory()` | ✅ Working |
| POST | `/api/story/stream` | `StoryService.generateStoryStreaming()` | ✅ Working (SSE) |
| POST | `/api/story/continue` | `StoryService.continueChapter()` | ✅ Working |
| POST | `/api/export/save` | `ExportService.saveAndExport()` | Stub |
| POST | `/api/image/generate` | `ImageService.generateImage()` | Stub |

**Audio routes have been intentionally removed.** The ElevenLabs integration (`audioService.ts`, `emotionMapping.ts`) was incomplete and has been deleted. Do not re-add audio functionality unless explicitly asked.

### SSE Streaming

`/api/story/stream` uses Server-Sent Events. The client connects with `EventSource`. Do not convert this to WebSocket or polling. The SSE protocol emits JSON on each `data:` line. The Angular service in `story.service.ts` consumes it. Do not break this contract.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `XAI_API_KEY` | Yes (prod) | xAI / Grok API key for story generation |
| `ALLOWED_ORIGINS` | Yes (prod) | CORS allowed origin(s) |
| `PORT` | No | Server port (default: 8080) |
| `NODE_ENV` | No | `development` or `production` |

The app runs in mock mode when `XAI_API_KEY` is absent. Mock mode returns placeholder stories, allowing UI development without credentials.

---

## Running Locally

```bash
# Install all dependencies
npm run install:all

# Start dev server (Angular + Express hot-reload)
cd story-generator && npm start

# Build for production
npm run build

# Run integration tests (requires XAI_API_KEY in .env at repo root)
npm run test:story
```

Integration tests live at `tests/story-service-improved.test.ts` and use a custom `tsx`-based harness (not Vitest or Jest). They call the real Grok API.

Angular unit tests (Karma + Jasmine) run inside `story-generator/`:
```bash
cd story-generator && npm test
```

---

## Build & Deploy

Build output lands in `story-generator/dist/`. The DigitalOcean config in `.do/app.yaml` handles CI/CD:
- **Build**: `cd story-generator && npm install && npm run build:prod`
- **Run**: `cd story-generator && npm run start:prod`
- **Health check**: `GET /api/health`
- **Auto-deploy**: push to `main`

Do not add Vercel, Railway, or Fly.io config. The deployment target is DigitalOcean App Platform.

---

## What Has Been Removed (Do Not Restore)

- `story-generator/src/api/lib/services/audioService.ts` — ElevenLabs TTS
- `story-generator/src/api/lib/services/emotionMapping.ts` — ElevenLabs voice ID mapping
- `tests/audio-service-improved.test.ts` — audio integration test
- `tests/audio-service.test.mjs` — older audio integration test
- `POST /api/audio/convert` route in server.ts

The `AudioConversionSeam` interface still exists in `contracts.ts` as a forward reference. It is harmless but orphaned — do not wire it up to new routes unless audio is explicitly being rebuilt.

---

## Key Rules for AI Agents

1. **Contracts first** — define seam interfaces in both contract files before writing implementation
2. **Never break SSE** — `/api/story/stream` must keep emitting `data: {...}\n\n` format
3. **Mock fallbacks required** — all services must work without API keys (return mock data)
4. **No separate server process** — Express lives in `server.ts` alongside Angular SSR
5. **ApiResponse<T> everywhere** — all API responses use `{ success: true, data: T }` or `{ success: false, error: { code, message } }`
6. **File header required** — add `Created: YYYY-MM-DD HH:MM` comment at top of all new files
7. **No new domain types** — extend `CreatureType`, `ThemeType`, etc. via union; don't replace them
8. **DigitalOcean only** — don't add config for other platforms
