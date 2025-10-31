import { PoolClient } from 'pg';
import {
  StoryState,
  StoryStateDelta,
  StorySummary,
  ContinuityDevice,
  CharacterArc,
  PlotThread
} from '../types/contracts';
import { getPool, withTransaction, query } from '../db/client';
import { logError } from '../utils/logger';

interface ChapterPersistenceInput {
  chapterId: string;
  chapterNumber: number;
  title: string;
  content: string;
  summary: StorySummary;
  continuityNotes: string[];
  createdAt: Date;
}

const memoryStates = new Map<string, StoryState>();
const memoryChapters = new Map<string, ChapterPersistenceInput[]>();

function cloneState(state: StoryState): StoryState {
  return {
    ...state,
    lastUpdated: new Date(state.lastUpdated),
    characterArcs: state.characterArcs.map(arc => ({
      ...arc,
      relationships: arc.relationships.map(rel => ({ ...rel }))
    })),
    plotThreads: state.plotThreads.map(thread => ({ ...thread })),
    continuityDevices: state.continuityDevices.map(device => ({ ...device })),
    continuityNotes: [...state.continuityNotes],
    summary: {
      ...state.summary,
      keyMoments: [...state.summary.keyMoments],
      continuityNotes: [...state.summary.continuityNotes]
    }
  };
}

function hasDatabaseConnection(): boolean {
  return !!getPool();
}

export class StoryStateService {
  async getStoryState(storyId: string): Promise<StoryState | null> {
    if (!hasDatabaseConnection()) {
      const state = memoryStates.get(storyId);
      return state ? cloneState(state) : null;
    }

    try {
      const storyRow = await query<{ id: string; last_updated: string; chapter_count: number }>(
        'SELECT id, last_updated, chapter_count FROM stories WHERE id = $1',
        [storyId]
      );

      if (storyRow.rowCount === 0) {
        return null;
      }

      const summaryRow = await query<{
        overview: string;
        last_chapter_title: string;
        key_moments: any;
        continuity_notes: any;
        chapter_count: number;
        updated_at: string;
      }>(
        'SELECT overview, last_chapter_title, key_moments, continuity_notes, chapter_count, updated_at FROM story_summaries WHERE story_id = $1',
        [storyId]
      );

      const characterRows = await query<{
        arc_id: string;
        name: string;
        role: string;
        current_status: string;
        goals: any;
        secrets: any;
        relationships: any;
        introduced_in_chapter: number;
        last_updated_chapter: number;
      }>(
        'SELECT arc_id, name, role, current_status, goals, secrets, relationships, introduced_in_chapter, last_updated_chapter FROM character_arcs WHERE story_id = $1',
        [storyId]
      );

      const plotThreadRows = await query<{
        thread_id: string;
        title: string;
        description: string;
        status: string;
        introduced_in_chapter: number;
        resolved_in_chapter: number | null;
        clues: any;
        outstanding_questions: any;
      }>(
        'SELECT thread_id, title, description, status, introduced_in_chapter, resolved_in_chapter, clues, outstanding_questions FROM plot_threads WHERE story_id = $1',
        [storyId]
      );

      const deviceRows = await query<{
        device_id: string;
        description: string;
        introduced_in_chapter: number;
        status: string;
        payoff_plan: string | null;
      }>(
        'SELECT device_id, description, introduced_in_chapter, status, payoff_plan FROM continuity_devices WHERE story_id = $1',
        [storyId]
      );

      const continuityRows = await query<{
        description: string;
      }>(
        'SELECT description FROM continuity_events WHERE story_id = $1 ORDER BY created_at ASC',
        [storyId]
      );

      const summaryRecord = summaryRow.rows[0];

      const summary: StorySummary = summaryRecord
        ? {
            overview: summaryRecord.overview,
            lastChapterTitle: summaryRecord.last_chapter_title,
            chapterCount: summaryRecord.chapter_count,
            keyMoments: Array.isArray(summaryRecord.key_moments)
              ? summaryRecord.key_moments
              : summaryRecord.key_moments?.elements || [],
            continuityNotes: Array.isArray(summaryRecord.continuity_notes)
              ? summaryRecord.continuity_notes
              : summaryRecord.continuity_notes?.elements || []
          }
        : {
            overview: '',
            lastChapterTitle: '',
            chapterCount: storyRow.rows[0].chapter_count,
            keyMoments: [],
            continuityNotes: []
          };

      const characterArcs: CharacterArc[] = characterRows.rows.map(row => ({
        arcId: row.arc_id,
        name: row.name,
        role: row.role as CharacterArc['role'],
        currentStatus: row.current_status,
        goals: Array.isArray(row.goals) ? row.goals : row.goals?.elements || [],
        secrets: Array.isArray(row.secrets) ? row.secrets : row.secrets?.elements || [],
        relationships: Array.isArray(row.relationships) ? row.relationships : row.relationships?.elements || [],
        introducedInChapter: row.introduced_in_chapter,
        lastUpdatedChapter: row.last_updated_chapter
      }));

      const plotThreads: PlotThread[] = plotThreadRows.rows.map(row => ({
        threadId: row.thread_id,
        title: row.title,
        description: row.description,
        status: row.status as PlotThread['status'],
        introducedInChapter: row.introduced_in_chapter,
        resolvedInChapter: row.resolved_in_chapter ?? undefined,
        clues: Array.isArray(row.clues) ? row.clues : row.clues?.elements || [],
        outstandingQuestions: Array.isArray(row.outstanding_questions)
          ? row.outstanding_questions
          : row.outstanding_questions?.elements || []
      }));

      const continuityDevices: ContinuityDevice[] = deviceRows.rows.map(row => ({
        deviceId: row.device_id,
        description: row.description,
        introducedInChapter: row.introduced_in_chapter,
        status: row.status as ContinuityDevice['status'],
        payoffPlan: row.payoff_plan ?? undefined
      }));

      const continuityNotes = continuityRows.rows.map(row => row.description);

      return {
        storyId: storyId,
        lastUpdated: new Date(storyRow.rows[0].last_updated),
        chapterCount: storyRow.rows[0].chapter_count,
        characterArcs,
        plotThreads,
        continuityDevices,
        continuityNotes,
        summary
      };
    } catch (error) {
      logError('Failed to load story state from database', error, {
        subsystem: 'database',
        module: 'storyStateService',
        storyId
      });
      throw error;
    }
  }

  async saveStoryState(state: StoryState): Promise<void> {
    if (!hasDatabaseConnection()) {
      memoryStates.set(state.storyId, cloneState(state));
      return;
    }

    await withTransaction(async (client: PoolClient) => {
      await client.query(
        `INSERT INTO stories (id, last_updated, chapter_count)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE
         SET last_updated = EXCLUDED.last_updated,
             chapter_count = EXCLUDED.chapter_count`,
        [state.storyId, state.lastUpdated.toISOString(), state.chapterCount]
      );

      await client.query(
        `INSERT INTO story_summaries (story_id, overview, last_chapter_title, key_moments, continuity_notes, chapter_count, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
         ON CONFLICT (story_id) DO UPDATE
         SET overview = EXCLUDED.overview,
             last_chapter_title = EXCLUDED.last_chapter_title,
             key_moments = EXCLUDED.key_moments,
             continuity_notes = EXCLUDED.continuity_notes,
             chapter_count = EXCLUDED.chapter_count,
             updated_at = EXCLUDED.updated_at`,
        [
          state.storyId,
          state.summary.overview,
          state.summary.lastChapterTitle,
          JSON.stringify(state.summary.keyMoments),
          JSON.stringify(state.summary.continuityNotes),
          state.summary.chapterCount,
          state.lastUpdated.toISOString()
        ]
      );

      await client.query('DELETE FROM character_arcs WHERE story_id = $1', [state.storyId]);
      for (const arc of state.characterArcs) {
        await client.query(
          `INSERT INTO character_arcs (story_id, arc_id, name, role, current_status, goals, secrets, relationships, introduced_in_chapter, last_updated_chapter)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
          [
            state.storyId,
            arc.arcId,
            arc.name,
            arc.role,
            arc.currentStatus,
            JSON.stringify(arc.goals),
            JSON.stringify(arc.secrets),
            JSON.stringify(arc.relationships),
            arc.introducedInChapter,
            arc.lastUpdatedChapter
          ]
        );
      }

      await client.query('DELETE FROM plot_threads WHERE story_id = $1', [state.storyId]);
      for (const thread of state.plotThreads) {
        await client.query(
          `INSERT INTO plot_threads (story_id, thread_id, title, description, status, introduced_in_chapter, resolved_in_chapter, clues, outstanding_questions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`
          , [
            state.storyId,
            thread.threadId,
            thread.title,
            thread.description,
            thread.status,
            thread.introducedInChapter,
            thread.resolvedInChapter ?? null,
            JSON.stringify(thread.clues),
            JSON.stringify(thread.outstandingQuestions)
          ]
        );
      }

      await client.query('DELETE FROM continuity_devices WHERE story_id = $1', [state.storyId]);
      for (const device of state.continuityDevices) {
        await client.query(
          `INSERT INTO continuity_devices (story_id, device_id, description, introduced_in_chapter, status, payoff_plan)
           VALUES ($1, $2, $3, $4, $5, $6)`
          , [
            state.storyId,
            device.deviceId,
            device.description,
            device.introducedInChapter,
            device.status,
            device.payoffPlan ?? null
          ]
        );
      }

      await client.query('DELETE FROM continuity_events WHERE story_id = $1', [state.storyId]);
      for (const [index, note] of state.continuityNotes.entries()) {
        await client.query(
          `INSERT INTO continuity_events (story_id, event_type, description, chapter_number, created_at)
           VALUES ($1, $2, $3, $4, $5)`
          , [
            state.storyId,
            'note',
            note,
            index + 1,
            state.lastUpdated.toISOString()
          ]
        );
      }
    });
  }

  async appendChapter(storyId: string, chapter: ChapterPersistenceInput, delta: StoryStateDelta): Promise<void> {
    if (!hasDatabaseConnection()) {
      const chapters = memoryChapters.get(storyId) || [];
      chapters.push({ ...chapter, continuityNotes: [...chapter.continuityNotes] });
      memoryChapters.set(storyId, chapters);
      const state = memoryStates.get(storyId);
      if (state) {
        state.continuityNotes = [...state.continuityNotes, ...delta.continuityNotes];
        state.lastUpdated = new Date(chapter.createdAt);
        state.chapterCount = chapter.chapterNumber;
        memoryStates.set(storyId, cloneState(state));
      }
      return;
    }

    await withTransaction(async (client: PoolClient) => {
      await client.query(
        `INSERT INTO chapters (id, story_id, chapter_number, title, content, summary, continuity_notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
         ON CONFLICT (id) DO UPDATE
         SET chapter_number = EXCLUDED.chapter_number,
             title = EXCLUDED.title,
             content = EXCLUDED.content,
             summary = EXCLUDED.summary,
             continuity_notes = EXCLUDED.continuity_notes,
             updated_at = NOW()`
        , [
          chapter.chapterId,
          storyId,
          chapter.chapterNumber,
          chapter.title,
          chapter.content,
          JSON.stringify({
            overview: chapter.summary.overview,
            keyMoments: chapter.summary.keyMoments,
            continuityNotes: chapter.summary.continuityNotes
          }),
          JSON.stringify(chapter.continuityNotes),
          chapter.createdAt.toISOString()
        ]
      );

      for (const note of delta.continuityNotes) {
        await client.query(
          `INSERT INTO continuity_events (story_id, event_type, description, chapter_number, created_at)
           VALUES ($1, $2, $3, $4, $5)`
          , [
            storyId,
            'update',
            note,
            chapter.chapterNumber,
            chapter.createdAt.toISOString()
          ]
        );
      }
    });
  }
}

export type { ChapterPersistenceInput };
