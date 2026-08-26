# Changelog

All notable changes to the Fairytales with Spice project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🐛 Three Quick Wins — the Proving Grounds bench, and a dropped image reason (August 26, 2026)

#### Proving Grounds no longer spends a generation on a request the route always refuses
- The page packs the selected template's system and user prompts — and the
  generation-logic summary once the reader has asked to see it — into the
  blueprint's `narrativeDirectives`, which `parseStoryLabBlueprintFromBody` caps
  at `STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength` (1,200). The template
  the page opens on, "Current Production", builds about 4,600 characters, so the
  default configuration of the prompt bench could not generate at all, and the
  shorter templates — which fit on their own — joined it once the generation
  logic was attached to the run.
- `describeNarrativeDirectivesOverflow` is asked before the request is sent, and
  the page names the template, the length, the cap, and the three things the
  reader can change. It measures `.trim().length` because the parser trims
  before it measures — a check that counted the whitespace would refuse a
  request the route would have taken. `tests/story-lab-blueprint-parser.test.ts`
  takes both readings at the boundary so they cannot drift apart.
- A generation that fails for any other reason now reports what the API said.
  Since the routes answer real statuses, a refusal arrives through `HttpClient`'s
  error path with the envelope on it, and the page was replacing that with
  "Story generation failed. Check the debug panel or console for details."

#### "Export Results" is a button that downloads something
- The Proving Grounds history export built a `data:` URI and clicked an anchor it
  had created but never attached — the pattern `downloadHtmlDocument` was
  extracted to end. Firefox does not dispatch a synthetic click on a detached
  anchor, so the button did nothing there at all, and a `data:` URI carries its
  whole payload in the URL, which twenty-five generated stories with their
  prompts and evaluations are not.
- `downloadTextDocument` is the same attach-click-detach over an object URL that
  the story download already uses, parameterized by MIME type; `downloadHtmlDocument`
  now delegates to it, so both buttons share one implementation and one test.

#### A failed chapter illustration says why it failed
- `generateChapterImage` was the one subscription in the component whose error
  handler ignored its argument, answering "Image generation failed. Please try
  again." for every failure. An unsupported style, an exhausted image quota, and
  a deployment with no image provider configured are all reasons that retrying
  does not fix, and the route names each of them in the envelope that reaches
  the error path.
- It now reads through `formatHttpError` with that sentence as the fallback,
  like every other subscription in the component.

### 🐛 Three Quick Wins (August 26, 2026)

#### A keyless deployment no longer passes its canned evaluation off as a Grok score
- `/api/story-lab/evaluate` answers a fixed `score: 75` and a fixed set of
  strengths, weaknesses, and suggestions — written about a story it never read —
  whenever `XAI_API_KEY` is not configured, and it went out as a plain
  `success: true`. Proving Grounds exists to compare prompt variants by these
  scores, so on such a deployment a reader was comparing 75 against 75 and
  reading the tie as a result.
- The mock now carries `isMockEvaluation: true`, which the frontend already
  understands: PR #233 gave the *client-side* fallback the same marker, and
  `proving-grounds.html` renders the "⚠️ Offline mock evaluation" notice, tags
  the score in the history and comparison views, and offers "🔁 Retry
  Evaluation" instead of locking into a false "✅ Evaluated" wherever it is set.
  Only the server-side fallback — the one every reader of a keyless deployment
  actually reaches — was still unmarked. The `heuristicReport` beside it is a
  real deterministic scan and travels with the successful path too, so it could
  never have been what told the two apart.

#### The HTML export stops welding the words on either side of a tag it drops
- `sanitizeStoryHtmlForExport` replaces any tag outside its allow-list with
  nothing at all, so a block-level one ran two pieces of story together:
  `<h4>The Vault</h4><div>She opened the door.</div>` exported as
  `The VaultShe opened the door.` and `<td>One</td><td>Two</td>` as `OneTwo`,
  while the plain-text export of the same story put each on its own line. This
  is the `door.</p><p>Blood` welding `splitStoryIntoTextBlocks` exists to
  prevent, on the last export path that still had it.
- A dropped block-level tag is now a `<br>` boundary. The boundary is held until
  something follows it, so a leading or trailing one never reaches the document
  and a run of them — `</td></tr></table><div>` — writes the single break a
  reader sees; a dropped tag beside an allowed `</p>` adds nothing, and a `<br>`
  the generator wrote is the story's own and is left alone. Inline tags are
  still dropped without a break, which is also what a reader sees.

#### The caller no longer decides what this service's logs are made of
- `/api/story/generate`, `/api/image/generate`, and `/api/export/save` each read
  `req.headers['x-request-id']` exactly as sent, wrote it back as the
  `X-Request-ID` response header, and stamped it into every log line for the
  request — including the structured `LogContext.requestId` that reaches the
  thousand-entry log buffer. Nothing bounded its length or its shape, so a
  kilobyte of header text was a kilobyte on every line the request wrote, kept
  in the buffer, and repeatable at the rate the route can be called.
- `readRequestCorrelationId` honours a supplied id when it is plausibly one —
  which is the entire value of the header, since a caller tracing a request
  across their logs and this service's needs it to survive — and mints
  `req_<uuid>` otherwise. A bad id is replaced rather than refused: it names the
  request, it is not part of what was asked for.

### 🐛 Three Quick Wins (August 25, 2026)

#### A running Story Lab job is no longer reported as a failed one
- `/api/story-lab/jobs/:jobId/events` replays the events a job has recorded and
  then ends the response, so the browser drops the connection and reopens it
  after every replay of a job that has not finished. `EventSource` fires `error`
  on that drop, and `StoryService.streamStoryLabJobEvents` read it as a failure:
  it errored the subscription and closed the very connection that was about to
  reconnect, so the app told the reader "Story generation updates stopped" and
  abandoned a batch the server was still generating.
- The reader now distinguishes the two things an `EventSource` `error` can mean
  by `readyState` (`shared/eventStreamRetry.ts`): a pending reconnect is left
  alone, and only an error the browser will not retry ends the stream. The
  genesis stream deliberately keeps failing on the first error — reconnecting
  there restarts a paid generation from the beginning.

#### The API enforces the blueprint size limits, not just the form
- The logline, world details, narrative directives, theme count, and the Heat
  Contract's no-go list were capped only in the Angular `FormValidationService`.
  `/api/story-lab/stories` takes the same blueprint as a POST body and
  `/api/story-lab/stream/genesis` takes it as a query string, and every one of
  those fields goes straight into the Grok prompt the route pays for, so a
  caller that skipped the form could send unbounded prose into a paid
  generation.
- `parseStoryLabBlueprint` now refuses a blueprint past any of those caps,
  naming the field and the limit like every other invalid field it reports. The
  numbers live in `shared/storyBlueprintLimits.ts`, which the form reads too, so
  the two readings cannot drift apart.

#### "Download story" works outside Chrome, and the blob outlives the click
- The download built an anchor, set `download` on it, and clicked it without
  ever putting it in the page. A synthetic click only follows a `download` on an
  attached anchor — Firefox dispatched nothing at all, so the button did nothing
  and said nothing.
- The object URL was revoked on the next task, racing the transfer the click
  starts: a browser that had not begun reading the blob was handed a URL that no
  longer resolved. `shared/htmlDocumentDownload.ts` attaches the anchor, clicks
  it, takes it back out (even if the click throws), and revokes the URL well
  after the browser has had a chance to start.

### 🐛 Deployment Parity Fixes (August 25, 2026)

#### Story Lab API reachable on the Node/Docker deployment
- The Express server registered four hand-written legacy routes and none of the
  `/api/story-lab/*` paths the Angular app actually calls, so every Story Lab
  request fell through to the SSR handler and came back as the index page with
  `200 OK`. All serverless handlers are now mounted through
  `registerApiRoutes`, including the query rewrites `vercel.json` performs for
  the job and account paths.

#### Legacy routes no longer a second implementation
- `/api/health`, `/api/story/generate`, `/api/story/continue`, and
  `/api/export/save` now run the same handlers on both deployments. The Node
  deployment had drifted: no 500KB export byte cap, no string checks on
  `content`/`title`, no redacted structured logging, no `X-Request-ID`, and a
  bare health payload where the serverless route answers an `ApiResponse`.

#### Unsuccessful responses answer a real HTTP status
- The legacy story, continuation, export, and image routes ended in
  `res.status(200).json(result)` whatever the envelope said. `getApiResponseStatus`
  maps the error code to a status, so a refusal, an invalid request, and a
  provider outage are no longer all reported as `200 OK`.

#### Supporting corrections
- `parseStoryLabBlueprint` now names a missing `heatContract` as an invalid
  field instead of returning a blueprint whose declared type said it was there.
  The engine already refused those requests with `CONTENT_POLICY_VIOLATION`.
- The Story Lab account, job, profile, and blueprint modules now type-check
  under the Angular app's strict configuration, which reaches them through the
  Node server.

### 🔧 Technical Improvements (December 20-22, 2025)

#### Grok Model Updates
- **Model Name Refactoring**: Deduplicated Grok model name using private class constant for better maintainability
- **Model Version Update**: Updated Grok model from `grok-4-fast-reasoning` to `grok-4-1-fast-reasoning`

#### Test Coverage Enhancements
- **Token Calculation Tests**: Added token calculation tests to test runner
- **Test Infrastructure**: Refactored tests to use shared utilities, reducing code duplication
- **Async Test Fixes**: Fixed all 5 async timing test failures - all 108 tests now pass

#### Build & Deployment
- **Vercel Configuration**: Added comprehensive Vercel deployment configuration
- **Build Fixes**: Fixed critical build and test errors
- **Vercel Config Updates**: Enhanced Vercel config to support token calculation tests

#### Files Changed:
- Grok model service refactored with private class constant
- Test runner configuration updated
- Vercel deployment configuration files added
- Build scripts and test utilities improved

---

## [2.2.0] - 2025-01-XX

### 🌊 Real-Time Story Streaming (October 11, 2025)

#### Complete SSE Implementation
- **Frontend Streaming Service**: Added `generateStoryStreaming()` method with EventSource-based real-time updates
- **Backend SSE Support**: Enhanced `/api/story/stream` endpoint to accept GET requests for EventSource compatibility
- **Real-Time Progress**: Users see incremental content, word counts, generation speed, and estimated completion time
- **Model Consistency Fix**: Fixed `grok-beta` reference to `grok-4-fast-reasoning` in streaming function
- **Component Refactor**: Updated streaming-story component to use service layer instead of direct EventSource

#### Files Updated (4 total):
- **`story-generator/src/app/story.service.ts`**: New `generateStoryStreaming()` method with progress callbacks (+140 lines)
- **`api/story/stream.ts`**: Added GET request support for query parameters (EventSource compatibility)
- **`story-generator/src/api/lib/services/storyService.ts`**: Fixed line 158 model from `grok-beta` to `grok-4-fast-reasoning`
- **`story-generator/src/app/streaming-story/streaming-story.component.ts`**: Refactored to use service layer

#### Streaming Features:
- **Progress Updates**: Connected → Chunk → Complete event flow
- **Real-Time Metrics**: Words generated, generation speed (words/sec), percentage complete
- **Automatic Extraction**: Title extraction from content, cliffhanger detection
- **Error Handling**: Connection failures, stream interruptions, graceful degradation
- **Cleanup Management**: Automatic EventSource closure on completion/error/unsubscribe

#### User Experience Benefits:
✅ 50% reduction in perceived wait time (immediate feedback vs 21-second blank screen)  
✅ Progressive content display with typing indicator  
✅ Real-time word count and speed metrics  
✅ Estimated time remaining calculation  
✅ Better engagement during generation  

See `STREAMING_COMPLETION_SUMMARY.md` for comprehensive documentation.

---

### 🔧 Production-Ready Logging System (October 10, 2025)

#### Enterprise-Level Observability
- **Structured Logging Utility**: Created comprehensive logger with request correlation, performance tracking, and error details
- **Request Correlation IDs**: Track multi-step operations across services with unique request IDs
- **Performance Metrics**: Automatic tracking of API response times, token usage, and processing durations
- **API Error Capture**: Full stack traces, HTTP status codes, and API response bodies for debugging
- **Environment-Aware**: Verbose logging in development, minimal in production
- **Specialized Log Functions**: API errors, performance, user actions, and critical system failures

#### Files Updated (6 total):
- **`api/lib/utils/logger.ts`**: New 520-line logging utility (singleton pattern, log buffering, sanitization)
- **`api/lib/services/storyService.ts`**: 11 logging integration points (request tracking, performance, errors)
- **`api/lib/services/audioService.ts`**: 15 logging integration points (multi-voice tracking, ElevenLabs metrics)
- **`api/story/generate.ts`**: Request ID generation, validation logging, error tracking
- **`api/story/continue.ts`**: Request ID generation, validation logging, error tracking
- **`api/audio/convert.ts`**: Request ID generation, validation logging, error tracking

#### Logging Features:
- **5 Log Levels**: Debug (dev only), Info, Warn, Error, Critical
- **Context Capture**: Request ID, user input, API tokens, response times, status codes
- **Error Details**: Name, message, stack trace, HTTP status, API responses
- **Sensitive Data Protection**: Auto-redaction of API keys, passwords, tokens
- **Log Buffer**: In-memory storage of recent 1000 logs for debugging
- **External Logging Ready**: Placeholder for Sentry/Datadog/CloudWatch integration

#### Benefits:
✅ Trace entire request flows with correlation IDs  
✅ Measure performance at each pipeline step  
✅ Debug API failures with full context  
✅ Monitor token consumption and costs  
✅ Track user actions for analytics  
✅ Production-ready error monitoring  

See `ERROR_LOGGING_IMPROVEMENTS.md` for comprehensive documentation.

---

### �🚀 Digital Ocean Migration

#### Zero Technical Debt Migration
- **Express Server Integration**: Added API routes to existing SSR server (no adapter pattern, no abstraction layer)
- **Service Layer Preservation**: All seam contracts remain unchanged in `api/lib/services/` (seam-driven compliance)
- **Direct Route Implementation**: Copy-pasted serverless function logic into Express routes (5 endpoints: health, generate, continue, audio, export)
- **Buildpack Deployment**: Digital Ocean auto-detection (no Dockerfile needed)

#### Changed Files (3 total, ~180 lines)
- `story-generator/src/server.ts`: Added middleware (JSON, CORS) + 5 API routes (142 lines added)
- `story-generator/package.json`: Added `build:prod`, `start:prod` scripts + Node 20 engine requirement (3 lines added)
- `.do/app.yaml`: Digital Ocean App Platform configuration (buildpack, health checks, environment variables) (new file, 47 lines)

#### Deployment Details
- **Method**: Digital Ocean App Platform with Node.js buildpack
- **Build**: `cd story-generator && npm install && npm run build:prod`
- **Runtime**: `cd story-generator && npm run start:prod`
- **Port**: 8080 (configurable via PORT env var)
- **Cost**: $5/month (basic-xxs tier)
- **Region**: NYC (configurable to SFO, AMS, etc.)

#### Technical Approach
- **Seam-Driven Compliance**: Service layer untouched, only HTTP transport changed (Vercel functions → Express routes)
- **Mock Fallbacks**: Development mode works without API keys
- **Zero Refactoring**: Direct code copy-paste, no architectural changes
- **Simple Migration**: ~150 lines of actual code changes

### 🔧 Technical Debt Status
**Created**: 0 new items  
**Deferred**: Root package.json TypeScript dependency (non-critical, scale-only issue)  
**Maintained**: All existing seam contracts and service layer architecture

---

## [2.1.0] - 2025-09-21

### 🎉 Major Features Added

#### Multi-Voice Audio System
- **Advanced Character Voices**: Implemented character-specific voices for vampires, werewolves, fairies, and humans
- **Speaker Tag Recognition**: Automatically detects `[Character]:` patterns in generated stories
- **Gender Detection**: Intelligently assigns male/female voices based on character names
- **Seamless Audio Merging**: Combines multiple voice segments with proper timing and silence
- **90+ Emotion Mapping**: Maps emotional states to voice parameters for enhanced expressiveness

#### Enhanced Story Generation
- **TV-Quality Prompts**: Upgraded story generation with professional narrative structures
- **Real-Time Progress**: Added progress indicators with realistic status updates during generation
- **Character Development**: Enhanced character depth and interaction patterns
- **Chapter Continuity**: Improved chapter continuation with theme and tone consistency

#### Audio Player Integration
- **Built-in Audio Player**: Added native HTML5 audio player with controls
- **Download Functionality**: Direct download links for generated audio files
- **Duration Display**: Shows audio length and playback information
- **Format Support**: MP3, WAV, and AAC audio format options

### 🛠️ Technical Improvements

#### Deployment & Infrastructure
- **Angular Budget Fixes**: Resolved CSS bundle size limits for successful Vercel deployment
- **Serverless Optimization**: Enhanced API endpoints for better Vercel serverless function performance
- **Environment Configuration**: Improved environment variable handling across development and production
- **Build Optimization**: Streamlined build process with better dependency management

#### Code Quality & Documentation
- **Comprehensive Comments**: Added detailed JSDoc documentation throughout codebase
- **Type Safety**: Enhanced TypeScript strict mode compliance
- **Error Handling**: Improved error logging and user feedback systems
- **Debug Panel**: Enhanced debugging tools with API health checks and error monitoring

#### User Experience
- **Responsive Design**: Improved mobile and tablet compatibility
- **Loading States**: Added visual feedback for all async operations
- **Success Messages**: Clear confirmation for completed actions
- **Progress Visualization**: Real-time progress bars with percentage indicators

### 🔧 Technical Details

#### Frontend (Angular 20.3)
- Enhanced form validation and user input handling
- Improved component lifecycle management
- Better state management for complex UI operations
- Optimized bundle size and performance

#### Backend (Serverless Functions)
- Advanced audio processing with multi-voice support
- Enhanced story generation with improved prompts
- Better error handling and logging
- Optimized API response times

#### Infrastructure
- Vercel deployment configuration updates
- Environment variable management improvements
- Build process optimization
- Dependency management streamlining

### 🐛 Bug Fixes
- Fixed Angular CSS budget warnings during build
- Resolved TypeScript compilation errors in API services
- Fixed Vercel install command sequence
- Corrected audio player display issues
- Resolved theme selection state management

### 📚 Documentation Updates
- Comprehensive README.md with feature overview
- Detailed API documentation
- Code comments and JSDoc additions
- Development setup instructions
- Troubleshooting guide

### 🔄 Migration Notes
- No breaking changes for existing users
- Enhanced theme system (compatible with previous selections)
- Audio features are additive (backward compatible)
- Environment variables are optional (defaults to mock mode)

---

## [2.0.0] - 2025-09-15 (Previous Release)

### Major Features
- Initial seam-driven architecture implementation
- Basic story generation with creature selection
- Theme-based story customization
- Export functionality (PDF, EPUB, DOCX, etc.)
- Debug panel for development
- Comprehensive test coverage (95%+)
- Enterprise CI/CD pipeline
- Vercel deployment integration

### Technical Foundation
- Angular 20.3 frontend framework
- TypeScript strict mode compliance
- Serverless API architecture
- Mock service implementations
- Contract-based development approach

---

## Development Guidelines

### Version Numbering
- **Major (X.0.0)**: Breaking changes or significant architectural updates
- **Minor (X.Y.0)**: New features, enhancements, backward-compatible changes
- **Patch (X.Y.Z)**: Bug fixes, documentation updates, minor improvements

### Release Process
1. Update version in package.json files
2. Update this CHANGELOG.md
3. Create release branch
4. Run full test suite
5. Deploy to staging
6. Merge to main
7. Tag release
8. Deploy to production

### Contributing
When contributing, please:
- Add entries to the "Unreleased" section
- Follow the established format
- Include technical details for developers
- Note any breaking changes
- Reference issue numbers when applicable

---

*For detailed technical documentation, see the [API Documentation](./api/README.md) and [Development Guide](./DEVELOPMENT.md).*