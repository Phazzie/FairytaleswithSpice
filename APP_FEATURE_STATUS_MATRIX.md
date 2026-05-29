# App Feature Status Matrix

Updated: 2026-05-29 02:41 EDT

This matrix summarizes the current Fairytales with Spice app after promoting `grok-4.3` to the default Story Lab model.

| Area | Feature | Status | Evidence | Main Risk / Next Step |
|---|---|---|---|---|
| Deployment | Vercel production app | Working | Recovery CI passed for `ab4de1a`; Vercel deployed it; production root returned HTTP 200 with `last-modified: Fri, 29 May 2026 06:40:59 GMT`. | Keep monitoring deploys after follow-up docs-only changes. |
| Deployment | Vercel API layout | Working | Shared API code is under `api/_lib`; function-count/preflight checks have passed in recovery. | Continue avoiding helper files in deployable API folders. |
| AI | Production Story Lab generation | Working, defaulting to `grok-4.3` | Post-deploy direct production `/api/story-lab/stories` call returned HTTP 200, generated `Reefbound Vows`, reported `model: "grok-4.3"`, `fallbackFromModel: null`, and `latencyMs: 11106`. | Monitor provider latency and add a direct API smoke script so this proof is repeatable. |
| AI | Grok multi-agent | Demoted to experiment | Production telemetry showed generation succeeded through fallback from `grok-4.20-multi-agent` to `grok-4.3`. | Use `XAI_STORY_MODEL=grok-4.20-multi-agent` only for explicit experiments. |
| AI | Continuation | Working but not reverified today | Prior production browser smoke generated and continued a story; route uses the canonical StoryService path. | Re-run continuation smoke after fixing browser navigation timeout. |
| AI | Continuity extraction | Degraded but honest | Direct production generation returned `source: "mixed"` and a visible warning when AI extraction was unavailable. | Improve AI extraction reliability or keep the degraded receipt highly visible. |
| AI | Story quality features | Partially working | Trope subversion, author-style config, cliffhanger prompts, and story-quality evals are in the canonical service/test path. | Need qualitative review of generated prose and stronger eval coverage. |
| UI | Story Lab main workflow | Functional but visually weak | App has blueprint form, generate/continue controls, saved-story rail, model badge, continuity panel, and screenshots from prior smoke runs. | Redesign on a separate branch after smoke harness is reliable. |
| UI | Public visual polish | Poor | User feedback: current UI is pretty terrible; previous work improved structure more than taste. | Create a design brief and rebuild the first screen with a clearer visual direction. |
| UI | Responsive/browser smoke | Unstable | Recent Playwright run timed out on `page.goto()` while HTTP root and API calls succeeded. | Fix smoke harness to distinguish page load, static asset, and generation failures. |
| State | Browser-local saved stories | Working in mock smoke | Mock browser smoke has verified save/restore after reload. | Production persistence remains browser-local only; do not imply cloud sync. |
| State | Server-side persistence | Temporary only | Story Lab uses transient memory receipts and client-carried/browser-local state. | Pick Vercel-compatible durable storage before accounts/cloud history. |
| Routes | `/api/health` | Working | Production health returned `success: true` and `services.grok: "configured"`. | CORS origin still reports localhost default in health output; review production origin config later. |
| Routes | `/api/story-lab/stories` | Working | Direct production POST returned HTTP 200 with Grok output. | Validate after deploy and monitor latency. |
| Routes | `/api/story-lab/continue` | Likely working | Covered by previous production browser smoke and current service path. | Reconfirm after browser smoke fix. |
| Routes | `/api/story/stream` | Present but not true token streaming | Documented as effectively final-result SSE rather than token-by-token streaming. | Rebuild streaming around real provider streaming if it matters for UX. |
| Proving Grounds | Prompt/testing workspace | Present, not shipping-critical | Ported as a routed Story Lab prompt-testing page with server-side evaluation fallback. | Reassess after core UI is fixed. |
| Export/Image | Export and image API stubs/services | Present, not recently validated | Routes exist in current Vercel layout. | Audit before presenting as product features. |
| Audio | Audio runtime | Deferred/inactive | Audio ideas were mined; active audio routes/services are not in scope. | Rebuild later from mined ideas instead of merging old audio PRs. |
| CI/Validation | Recovery CI | Working | `ab4de1a` passed Recovery CI. | GitHub Actions Node 20 deprecation warning needs future workflow update. |
| CI/Validation | Story/API tests | Working locally | `verify-ai-fixes`, `test:story-lab-real-engine`, `test:story-quality`, `scripts/recovery/preflight.sh --quick --skip-status`, `npm run smoke:grok` skip path, and mock Story Lab UI smoke passed after the model-default change. | Add a lightweight direct production API smoke script. |
| Security | Runtime audit | Good at last check | Runtime audit was clean in prior shipping evidence. | Full dev/test audit still has known Karma/socket findings. |
| Reviews | Recent PR review comments | Addressed before merge, not freshly rechecked | Known Sonar/Gemini/review issues were fixed before PR #98/#99 merge. | GitHub API timed out during current fresh recheck; retry later if needed. |
