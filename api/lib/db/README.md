# Story State Persistence Schema

The story state service persists character arcs, plot threads, and continuity notes so the Angular UI can surface live tracking data. Provision the DigitalOcean Postgres database with the schema in [`schema.sql`](./schema.sql) before deploying the updated API.

## Required Tables

- `stories`: high-level story metadata and chapter counts.
- `story_summaries`: aggregated overview, key moments, and continuity notes.
- `chapters`: individual chapter payloads plus per-chapter continuity notes.
- `character_arcs`: serialized character progression, goals, and relationships.
- `plot_threads`: active, dormant, and resolved plot threads.
- `continuity_devices`: Chekhov-style devices planted for future payoffs.
- `continuity_events`: chronological log of continuity notes and deltas.

Run the SQL locally or via the DigitalOcean control panel:

```bash
psql "$DATABASE_URL" -f api/lib/db/schema.sql
```

The `StoryStateService` automatically falls back to an in-memory store when `DATABASE_URL` is undefined, making local development possible without a database.
