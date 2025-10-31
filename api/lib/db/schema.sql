-- Story state persistence schema for DigitalOcean Postgres
-- Run these statements to provision the required tables.

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY,
  title TEXT,
  creature TEXT,
  spicy_level INTEGER,
  themes TEXT[],
  word_count INTEGER,
  chapter_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_summaries (
  story_id UUID PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
  overview TEXT NOT NULL,
  last_chapter_title TEXT NOT NULL,
  key_moments JSONB NOT NULL DEFAULT '[]'::jsonb,
  continuity_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  chapter_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  continuity_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chapters_story_number_idx
  ON chapters (story_id, chapter_number);

CREATE TABLE IF NOT EXISTS character_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  arc_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  current_status TEXT NOT NULL,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  secrets JSONB NOT NULL DEFAULT '[]'::jsonb,
  relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
  introduced_in_chapter INTEGER NOT NULL,
  last_updated_chapter INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS character_arcs_story_idx
  ON character_arcs (story_id, name);

CREATE TABLE IF NOT EXISTS plot_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  introduced_in_chapter INTEGER NOT NULL,
  resolved_in_chapter INTEGER,
  clues JSONB NOT NULL DEFAULT '[]'::jsonb,
  outstanding_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plot_threads_story_idx
  ON plot_threads (story_id, status);

CREATE TABLE IF NOT EXISTS continuity_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  description TEXT NOT NULL,
  introduced_in_chapter INTEGER NOT NULL,
  status TEXT NOT NULL,
  payoff_plan TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS continuity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  chapter_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS continuity_events_story_idx
  ON continuity_events (story_id, created_at);
