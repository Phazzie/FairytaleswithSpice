# Origin CI

GitHub Actions is stopped for this account (billing lock). CI moves to Cursor Origin, which runs GitHub Actions-syntax YAML from `.depot/workflows/` on `depot-ubuntu-24.04` after the repository is detached from GitHub.

`.github/workflows/recovery-ci.yml` stays in the tree so the old definition is still readable. It will not run once the repo is detached, and it cannot run now.

The Depot workflow is `.depot/workflows/ci.yml`. The AI review script is `scripts/ai-review.mjs`. The pattern matches [Phazzie/streetroyalty](https://github.com/Phazzie/streetroyalty) (`.depot/workflows/ci.yml` and `scripts/ai-review.mjs`): locked `npm ci`, real project commands, and a pull-request review that posts with the Origin CLI.

## Workflow map

| GitHub workflow | What it runs | Depot equivalent |
|---|---|---|
| `.github/workflows/recovery-ci.yml` job `validate` (`Validate Vercel recovery build`) | Node 20. `npm ci` at the repo root and in `story-generator`. `scripts/recovery/preflight.sh --skip-status`. A `vercel.json` shape check (`buildCommand` and `outputDirectory`). | Job `verify` (`Validate recovery build`) on `depot-ubuntu-24.04`, Node 20. Same two locked installs (`npm ci --no-audit --no-fund` against `package-lock.json` and `story-generator/package-lock.json`). The preflight script's typecheck, Vercel function-count, and whitespace checks run as `scripts/recovery/preflight.sh --skip-status --skip-tests --skip-build`. The same `vercel.json` shape check runs unchanged. Root `npm test` (that script is `test:all`), `npm run build`, and `npm run build:verify` replace the test and non-production build inside preflight so each command runs once. `story-generator` `npm test` is the Angular Karma suite (non-watch, `ChromeHeadlessNoSandbox`). `story-generator` `npm run build:prod` is the production bundle, which the GitHub preflight did not build. |
| — | — | Job `ai-review` on pull requests only. Root `npm ci`, `node --test scripts/ai-review.test.mjs`, then `node scripts/ai-review.mjs`. |

`npm test` at the root is `npm run test:all`. The Depot job runs `npm test` once.

Triggers for the Depot workflow: every pull request, and pushes to `main` (the default branch). `ai-review` is limited to `pull_request`.

## Commands the verify job runs

1. `npm ci --no-audit --no-fund` (root)
2. `npm ci --no-audit --no-fund` in `story-generator`
3. `scripts/recovery/preflight.sh --skip-status --skip-tests --skip-build`
4. `vercel.json` must exist and define `buildCommand` and `outputDirectory`
5. `npm test`
6. `npm run build`
7. `npm run build:verify`
8. `npm test` in `story-generator`
9. `npm run build:prod` in `story-generator`

There is no ESLint script in either `package.json`. Nothing in CI runs a separate linter.

## AI review

On pull requests the job calls Grok (`grok-4.5` on `https://api.x.ai/v1/chat/completions`) with `XAI_API_KEY`. It posts one comment:

```bash
origin pr comment <PR_NUMBER> --body-file <file> --edit-last --create-if-none
```

When `XAI_API_KEY` is unset or blank, the script logs `AI review skipped: XAI_API_KEY is not set` and exits 0. When the Origin CLI is missing, it prints the review to the log and exits 0. A failed Origin comment is also logged and does not fail the job. An xAI HTTP error, after the key is present, still fails the job.

The job sets `GITHUB_TOKEN` and `GITHUB_REPOSITORY` to empty so a runner token cannot send the comment to the GitHub API. With a pull request number and no GitHub token, the script uses the Origin CLI. With neither a token nor a pull request number, it prints the review and exits 0.

## GitHub-only pieces that will be dropped

These exist only on the GitHub Actions workflow and are not carried into Depot:

- `workflow_dispatch` (manual runs from the GitHub UI).
- Push triggers for `recovery-*` and `recovery/**`. Depot runs on pull requests and on pushes to `main`.
- `permissions: contents: read`.
- `concurrency` with `cancel-in-progress`.
- `actions/checkout` pinned to `34e114876b0b11c390a56381ad16ebd13914f8d5` with `persist-credentials: false`. Depot uses `actions/checkout@v4`.
- `actions/setup-node` pinned to `49933ea5288caeca8642d1e84afbd3f7d6820020`. Depot uses `actions/setup-node@v4` with the same Node 20 and the same two lockfiles.
- `runs-on: ubuntu-latest`. Depot uses `depot-ubuntu-24.04`.
- The GitHub check name `Validate Vercel recovery build`. Branch protection that requires that check cannot go green while Actions billing is locked, and the check disappears after detach.

Not workflows, and not migrated:

- `.github/copilot-instructions.md` stays. GitHub Copilot review will not run after detach.
- There is no `dependabot.yml`, CodeQL workflow, or SonarCloud workflow in this repo. SonarCloud and Copilot, when they ran, were GitHub App checks. They are not part of Depot CI.

## Deploys after detach

Depot CI does not deploy. It only installs, tests, and builds.

**DigitalOcean App Platform must be retargeted after the GitHub detach.** Both specs deploy from GitHub on every push to `main`:

- `.do/app.yaml` — `github.repo: Phazzie/FairytaleswithSpice`, `branch: main`, `deploy_on_push: true`. Build is `cd story-generator && npm install && npm run build:prod`.
- `.do/app.yaml.buildpack` — the same GitHub repo, branch, and `deploy_on_push: true`. Build is `npm run install:all && npm run build`.

`deploy_on_push` from GitHub stops when the repo is detached. Point the DigitalOcean app at the Origin repository (or turn off GitHub auto-deploy and deploy from the new remote) before the detach, or production will stop updating.

**Vercel** is the other production target (`vercel.json`: `installCommand` `npm run install:all`, `buildCommand` `npm run build`, `outputDirectory` `story-generator/dist/story-generator/browser`). This repo has no Vercel deploy workflow. Deploys come from the Vercel project's Git connection. A GitHub-linked Vercel project will also stop receiving pushes after detach and needs to be reconnected to the Origin repo (or deployed another way). The Depot `verify` job only checks that `vercel.json` still has `buildCommand` and `outputDirectory`.

## Secrets to re-enter in Depot

The GitHub workflow used no secrets. Depot needs one:

| Secret | Where | If it is missing |
|---|---|---|
| `XAI_API_KEY` | Depot project secrets, read by the `ai-review` job | The job logs a skip and exits 0. Reviews start when the secret is added. |

Do not copy a `GITHUB_TOKEN` into Depot. The Origin CLI on the runner posts the review.

These are runtime secrets for Vercel or DigitalOcean, not for this CI workflow. Re-enter them on the hosting project if that project is recreated. CI tests run without them (mock mode when `XAI_API_KEY` is absent).

| Secret | Used for |
|---|---|
| `XAI_API_KEY` | Live story, image, and review calls. Same key as the Depot review secret if you want one value in both places. |
| `ELEVENLABS_API_KEY` | Narration preview. DigitalOcean `.do/app.yaml` already marks it secret. |
| `ELEVENLABS_VOICE_NARRATOR`, `ELEVENLABS_VOICE_DEFAULT`, `ELEVENLABS_VOICE_POOL`, `ELEVENLABS_VOICE_<NAME>` | Voice ids. Optional. |
| `DATABASE_URL` | Story Lab cloud storage and durable job rows. |
| `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` | Signed-in account routes. |
| `API_KEYS` | Optional API key gate. |
| `STORY_LAB_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`, `FRONTEND_URL` | CORS / app URL. DigitalOcean injects `APP_URL` into `ALLOWED_ORIGINS` or `FRONTEND_URL`. |
| `STORY_LAB_AUTH_PROVIDER` | Auth provider selection. |
| `XAI_STORY_MODEL`, `XAI_FAST_MODEL`, `XAI_STORY_REASONING_EFFORT`, `XAI_RESPONSES_API_URL` | Optional model overrides. |

## Local note

`story-generator` `npm test` used to be `ng test`, which watches until interrupted. CI and local `npm test` now run `ng test --watch=false --browsers=ChromeHeadlessNoSandbox`. Interactive watch is still `npx ng test` in `story-generator`.

The Angular test target sets `karmaConfig` to `karma.conf.js`. Without that, `@angular/build:karma` ignored the file and Chrome's socket ping (25s interval plus a 5s timeout) dropped the browser at about 30s. `pingTimeout` is 60000. One spec, `retries the sign-in-time profile fetch under the current identity instead of applying a stale response`, called `fixture.detectChanges()` on the full `App` template and hung the browser. It now calls `syncStoryLabProfileDefaultsWithAuthState` directly, which is the method that effect forwards into. There is no ESLint script. Lockfiles already matched `npm ci` at the root and in `story-generator`.
