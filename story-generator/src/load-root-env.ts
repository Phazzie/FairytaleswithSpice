// Created: 2026-09-03 05:20 EDT

import { config } from 'dotenv';

/**
 * Loads the repo-root `.env` regardless of the working directory the server
 * process was launched from.
 *
 * `dotenv/config`'s own default (`path.resolve(process.cwd(), '.env')`) only
 * finds the root `.env` when launched from the repo root. But
 * `story-generator/package.json`'s own `start:prod`/`serve:ssr:*` scripts are
 * run with `story-generator/` as `process.cwd()` (`npm run <script>`
 * preserves the directory the invoked `package.json` lives in), so that
 * default would look for (and silently not find) `story-generator/.env`
 * instead - Clerk would report unconfigured with no error, not fail loudly.
 *
 * `import.meta.url` isn't `process.cwd()`-relative, so it's used instead:
 * once esbuild bundles this file into `server.mjs`, `import.meta.url` is
 * that compiled file's own location (`dist/story-generator/server/`, four
 * directories below the repo root), not wherever the process happened to be
 * launched from.
 */
config({ path: new URL('../../../../.env', import.meta.url) });
