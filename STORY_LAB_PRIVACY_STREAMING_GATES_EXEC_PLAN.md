# Story Lab Privacy, CORS, Export, and Streaming Gates ExecPlan

Created: 2026-06-05 01:30 EDT

## Purpose / Big Picture

Finish a large, bounded chunk of the Story Lab platform evolution after PR #100 without widening that already-ready PR. This plan completes the remaining Phase B gates from `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`:

- Phase B2: centralized CORS and account-boundary policy;
- Phase B3: retention/deletion/export-sanitizer policy plus a safer export sanitizer implementation;
- Phase B4: opaque job-id streaming design and contracts, without adding deployable job routes while the Vercel function-count guard is already at `12/12`.

The user-visible outcome is not a new cloud account feature yet. The observable outcome is that future account sync, private export, and durable job work have enforceable safety rails: no wildcard credentialed CORS, no raw export HTML interpolation, documented retention/deletion behavior, and an explicit job-id contract that prevents sensitive Story Lab blueprint fields from entering future EventSource URLs.

This work must run on a new branch based on the current Story Lab branch. Do not add commits to PR #100's ready branch.

## Progress

- [x] Confirmed active branch before planning was `feature/charmed-mvp-story-lab`.
- [x] Created new branch `feature/story-lab-privacy-streaming-gates` to avoid broadening PR #100.
- [x] Read `AGENTS.md`, `.agent/PLANS.md`, the local ExecPlan standard, and `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`.
- [x] Audited current CORS usage across `api/` routes.
- [x] Audited current export service HTML/text/PDF mock generation path.
- [x] Wrote initial plan.
- [x] Ran hostile expert review and revised the plan before implementation.
- [x] Implement centralized CORS helper and route integration.
- [x] Implement export sanitizer helper and export tests.
- [x] Implement opaque job-id contract helper and tests.
- [x] Update platform plan, changelog, and lessons.
- [x] Run validation and record evidence.

## Surprises & Discoveries

- CORS is repeated in many routes and one demo stream still writes `Access-Control-Allow-Origin: *` during `writeHead`.
- Story Lab genesis stream still parses sensitive blueprint fields from `req.query`; this must be replaced by POST-created opaque job ids before account data or private story text enters streaming.
- Existing export service is mock storage, but it still interpolates title/content/metadata into generated artifacts. Sanitizer work is useful now even before Vercel Blob or email export exists.
- `api/_lib/middleware/security.ts` authenticates API keys, but Phase B1 explicitly decided provider/API keys are not user account auth. This plan must not lean on that middleware for account safety.
- All of Phase B2-B4 could be implemented without adding deployable route files, so the function-count guard stayed at `12/12`.

## Decision Log

- Decision: Implement CORS through `api/_lib/http/corsPolicy.ts` and use it from account-capable or private-content routes.
  Rationale: Future account routes need a single deny-by-default place for origins, methods, headers, and credentials.
- Decision: Credentialed CORS never accepts `*`. If a browser origin is present and not in the allow-list, routes reject with `403` before processing the private request.
  Rationale: Browser CORS alone is not an authorization control. Rejecting disallowed origins prevents accidental side effects and future CSRF mistakes.
- Decision: Origin allow-list comes from `STORY_LAB_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`, and `FRONTEND_URL`, in that order, with local development fallback only when no explicit value is configured.
  Rationale: Existing files mention both `ALLOWED_ORIGINS` and `FRONTEND_URL`; a future account-specific env can be introduced without breaking current deployments.
- Decision: Export sanitizer is implemented as a conservative allow-list with no attributes, not as a broad "strip bad things" pass.
  Rationale: Without a DOM parser dependency, the least risky no-dependency choice is preserving only known story-structure tags and escaping titles/metadata separately.
- Decision: Job-id streaming is implemented as contracts/helpers/tests only in this slice; no job API routes are added.
  Rationale: The route guard is already `12/12`, and adding `/api/story-lab/jobs/*` would violate the function-count constraint.
- Decision: Retention and deletion rules are documented now; cloud persistence remains blocked until a provider, schema, owner-scope checks, and deletion/export controls are selected.
  Rationale: Privacy policy must precede storage writes.

## Outcomes & Retrospective

- What became safer:
  - Credentialed CORS is centralized through `api/_lib/http/corsPolicy.ts`; wildcard origins are never echoed, and disallowed browser origins get `403` before private route work runs.
  - SSE routes now build `writeHead` CORS headers from the same helper instead of duplicating stale header strings.
  - Server export content now uses `api/_lib/services/exportSanitizer.ts` to preserve only safe story-structure tags, strip attributes, remove dangerous containers, escape titles/metadata, and avoid raw export error logging.
  - Future job/status/events URLs now have an opaque `job_<uuid>` contract that keeps blueprint text, story ids, no-go content, emails, API keys, and artifact URLs out of paths.
- What remains blocked by provisioning:
  - Auth provider adapter, account sync, cloud database writes, Vercel Blob/private artifact URLs, email export, Workflow-backed jobs, and actual `/api/story-lab/jobs*` routes.
  - Route consolidation remains required before adding job routes because the function-count guard is still saturated at `12/12`.
- What validation proved:
  - Focused CORS/export/job/auth/parser/redaction tests passed.
  - Direct Node 20 TypeScript spec compile passed.
  - Function count remained `12/12`.
  - `scripts/recovery/preflight.sh --quick --skip-status` passed.
- What hostile review would still object to:
  - Current Story Lab genesis streaming still uses EventSource query fields until a POST job-creation route exists.
  - Export is safer, but server export is still mock storage and must not be described as durable Blob/email export.
  - The sanitizer is a conservative no-dependency guard, not a full HTML parser.

## Context and Orientation

Repository root: this repository checkout.

Current work branch: `feature/story-lab-privacy-streaming-gates`.

Base work already completed in PR #100:

- Story Lab POST and stream genesis share one server blueprint parser.
- `AuthPort` and `authorizeProjectAccess` exist without choosing an auth provider.
- server/client redaction tests cover story text, prompts, auth headers, API keys, emails, and artifact URLs.
- Vercel function count is `12/12`.

Key files:

- `api/story/generate.ts`, `api/story/continue.ts`, `api/story/stream.ts`: classic story generation routes with repeated credentialed CORS.
- `api/story-lab/stories.ts`, `api/story-lab/stories/[storyId]/continue.ts`, `api/story-lab/evaluate.ts`, `api/story-lab/stream/genesis.ts`: Story Lab private-content routes.
- `api/export/save.ts`, `api/_lib/services/exportService.ts`: existing mock server export path.
- `api/image/generate.ts`: private prompt-like image route.
- `api/story/stream-demo.ts`: demo route that must not keep wildcard CORS in SSE headers.
- `scripts/recovery/check-vercel-function-count.sh`: route budget guard.
- `PR70_RECOVERY_CHANGELOG.md`, `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, `LESSONS_LEARNED.md`: recovery documentation.

Existing untracked files remain out of scope:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

## Hostile Expert Review

Reviewer stance: hostile privacy/security/deployment reviewer who wants this PR rejected unless it prevents future account-sync mistakes.

Findings against the initial plan:

1. Critical: "Centralized CORS" is meaningless if routes can still process disallowed browser origins after omitting the CORS header. Revise to reject disallowed browser origins with `403` before private route work.
2. Critical: Do not make `*` an accepted env value, even in tests. Wildcard plus credentials is invalid and dangerous. Revise tests to prove wildcard env input fails closed.
3. Important: Replacing CORS in `res.setHeader` but leaving `writeHead` with old CORS headers in SSE routes would keep stale behavior. Revise to build SSE response headers from the same helper.
4. Important: Export sanitizer cannot be only documentation. Existing export service is reachable and interpolates title/content. Revise to implement sanitizer and tests now.
5. Important: Regex sanitizers are fragile. Since no parser dependency is available in this slice, revise the sanitizer to preserve a tiny HTML allow-list and strip every attribute, while escaping titles and metadata.
6. Important: Job-id design cannot add routes because function count is `12/12`. Revise to add contracts/helpers/tests only and explicitly block route creation.
7. Important: Do not treat API key middleware as account auth. Revise CORS/account-boundary language to keep `AuthPort` as the future account seam.
8. Moderate: Updating only the new plan is not enough. Revise `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, `PR70_RECOVERY_CHANGELOG.md`, and `LESSONS_LEARNED.md` so future agents see the outcome.

Revisions applied:

- Disallowed browser origins are rejected by the shared helper.
- `*` is ignored/rejected; it is never echoed.
- SSE headers come from the same helper instead of route-local CORS strings.
- Export sanitizer is implemented and tested now.
- Job-id work is contracts/tests only; no deployable job routes are added.
- Docs explicitly preserve `AuthPort` as the account-auth seam.

## Plan of Work

1. Create `api/_lib/http/corsPolicy.ts`.
2. Add `tests/cors-policy.test.ts`.
3. Replace repeated CORS blocks in private-content routes with the helper.
4. Ensure SSE `writeHead` calls use helper-provided headers.
5. Create `api/_lib/services/exportSanitizer.ts`.
6. Update `api/_lib/services/exportService.ts` to sanitize content and escape title/metadata.
7. Add `tests/export-sanitizer.test.ts`.
8. Create `api/_lib/story-lab/jobs/jobContracts.ts`.
9. Add `tests/story-lab-job-contracts.test.ts`.
10. Update `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, `PR70_RECOVERY_CHANGELOG.md`, and `LESSONS_LEARNED.md`.
11. Run focused tests and preflight.

## Concrete Steps

### Step 1: CORS Helper

Create `api/_lib/http/corsPolicy.ts` with:

- `parseAllowedOrigins(env?: NodeJS.ProcessEnv): string[]`
- `applyCorsPolicy(req, res, options): CorsPolicyResult`
- `buildCorsHeaders(req, options): Record<string, string>`

Options:

- `methods: string[]`
- `headers?: string[]`
- `credentials?: boolean`
- `env?: NodeJS.ProcessEnv`

Rules:

- `STORY_LAB_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`, and `FRONTEND_URL` can contain comma-separated URLs.
- Only URL origins are kept. Path/query/hash are normalized away.
- `*` is never returned as an allowed origin.
- If no explicit env value exists, default to `http://localhost:4200`.
- If request has `Origin` and it is not allowed, write a `403` JSON response and return `rejected: true`.
- If request is `OPTIONS`, write either `200` or `403`, return `handled: true`, and route handlers must stop.
- Always set `Vary: Origin`.

### Step 2: Route Integration

Use `applyCorsPolicy` in:

- `api/story/generate.ts`
- `api/story/continue.ts`
- `api/story/stream.ts`
- `api/story/stream-demo.ts`
- `api/export/save.ts`
- `api/image/generate.ts`
- `api/story-lab/stories.ts`
- `api/story-lab/stories/[storyId]/continue.ts`
- `api/story-lab/evaluate.ts`
- `api/story-lab/stream/genesis.ts`
- `api/story-lab/health.ts`

Do not change `api/health.ts` unless needed for compile safety; it is not an account/private-content route.

### Step 3: Export Sanitizer

Create `api/_lib/services/exportSanitizer.ts` with:

- `escapeHtml(value: string): string`
- `sanitizeStoryHtmlForExport(html: string): string`
- `stripStoryHtmlForExport(html: string): string`
- `escapePdfText(value: string): string`

Allowed story HTML tags:

- `p`, `br`, `strong`, `em`, `b`, `i`, `u`
- `h1`, `h2`, `h3`
- `section`, `article`
- `ul`, `ol`, `li`
- `blockquote`

All attributes are stripped. Disallowed element tags are removed while preserving text except for dangerous container elements (`script`, `style`, `iframe`, `object`, `embed`, `svg`, `math`, `form`, `input`, `button`, `textarea`, `select`, `link`, `meta`, `base`), whose full content is removed.

Update `ExportService` so:

- HTML title and metadata are escaped.
- HTML content uses `sanitizeStoryHtmlForExport`.
- Text/PDF/DOCX mock content uses `stripStoryHtmlForExport` or escaped content.
- File names remain sanitized.
- `console.error` in catch blocks does not print raw private story content.

### Step 4: Opaque Job-Id Contracts

Create `api/_lib/story-lab/jobs/jobContracts.ts` with:

- `StoryLabJobKind`
- `StoryLabJobStatus`
- `StoryLabJob`
- `StoryLabJobCreationRequest`
- `createOpaqueStoryLabJobId(randomId?: string): string`
- `buildStoryLabJobPaths(jobId: string): { statusPath: string; eventsPath: string }`
- `assertOpaqueStoryLabJobId(jobId: string): boolean`

Rules:

- Job ids must be `job_` plus UUID-like opaque text.
- Paths contain only the job id, never blueprint JSON, logline, no-go content, email, API key, story id, or title.
- This slice creates no `api/story-lab/jobs*` routes.

### Step 5: Documentation

Update `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`:

- mark Phase B2 complete if CORS helper/tests/routes pass;
- mark Phase B3 policy and sanitizer complete while durable Blob/email export remains blocked;
- mark Phase B4 design/contracts complete while route implementation remains blocked by function count and Workflow/provider decisions.

Update `PR70_RECOVERY_CHANGELOG.md` with actions and validation.

Update `LESSONS_LEARNED.md` with the CORS/export/job-id lesson if it does not already exist.

## Validation and Acceptance

Run from repository root:

- `git diff --check`
- `npx tsx tests/cors-policy.test.ts`
- `npx tsx tests/export-sanitizer.test.ts`
- `npx tsx tests/story-lab-job-contracts.test.ts`
- `npx tsx tests/log-redaction.test.ts`
- `npx tsx tests/story-lab-blueprint-parser.test.ts`
- `npx tsx tests/story-lab-stream-parse.test.ts`
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`
- `scripts/recovery/check-vercel-function-count.sh`
- `scripts/recovery/preflight.sh --quick --skip-status`

Acceptance requires:

- disallowed browser origins are rejected with `403`;
- wildcard origins are never echoed;
- credentialed routes never use `Access-Control-Allow-Origin: *`;
- export HTML preserves paragraph/chapter structure while removing scripts, event handlers, dangerous tags, and unsafe URLs;
- generated export titles/metadata are escaped;
- job-id paths contain no blueprint/story/private fields;
- no new deployable Vercel functions are added;
- function count remains `12/12`;
- PR #100 branch is not broadened.

## Idempotence and Recovery

- Re-running the CORS helper tests must not depend on environment mutation; each test restores env values it changes.
- Re-running export tests must not call external storage providers. The current export service storage remains mock-only.
- If route integration fails TypeScript because of response helper typing, keep helper arguments typed as minimal structural interfaces instead of importing framework-specific request/response types.
- If function count exceeds `12/12`, stop and revert route additions; this plan explicitly forbids new route files.
- If preflight hangs in Angular/Karma, record the exact command and fall back to direct Node 20 `tsc` evidence, but do not call the browser-spec layer complete.
- If any existing untracked files conflict with this work, stop and ask. Otherwise leave them untouched.

## Artifacts and Notes

This plan is intentionally not a storage/auth provider selection. It creates the safety gates needed before that selection can be useful.

Potential future follow-up after this plan:

- route consolidation to free function-count budget for job routes;
- auth provider selection and `AuthPort` adapter;
- storage port and migration plan;
- Workflow-backed job implementation;
- private Blob export artifacts.

## Interfaces and Dependencies

No new npm dependency is required.

New files expected:

- `api/_lib/http/corsPolicy.ts`
- `api/_lib/services/exportSanitizer.ts`
- `api/_lib/story-lab/jobs/jobContracts.ts`
- `tests/cors-policy.test.ts`
- `tests/export-sanitizer.test.ts`
- `tests/story-lab-job-contracts.test.ts`

No deployable API route file should be added by this plan.
