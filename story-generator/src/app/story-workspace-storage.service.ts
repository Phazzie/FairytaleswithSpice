import { Injectable } from '@angular/core';
import { SavedStoryProject } from './contracts';

type StorageResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  message: string;
};

@Injectable({ providedIn: 'root' })
export class StoryWorkspaceStorageService {
  private readonly storageKey = 'fairytales_story_lab_projects_v1';
  private readonly maxProjects = 12;

  listProjects(): SavedStoryProject[] {
    return [...this.readProjects()].sort(byNewestUpdateFirst);
  }

  saveProject(project: SavedStoryProject): StorageResult<SavedStoryProject> {
    if (!this.hasLocalStorage()) {
      return {
        success: false,
        message: 'Local story saving is unavailable in this browser.'
      };
    }

    const now = new Date().toISOString();
    const normalizedProject: SavedStoryProject = {
      ...project,
      id: project.id || project.storyId,
      title: project.title || project.summary.title,
      synopsis: project.synopsis || project.summary.synopsis,
      createdAt: project.createdAt || now,
      updatedAt: now
    };
    const remainingProjects = this.readProjects().filter(item => item.id !== normalizedProject.id);
    const nextProjects = [normalizedProject, ...remainingProjects]
      .sort(byNewestUpdateFirst)
      .slice(0, this.maxProjects);

    const writeResult = this.writeProjects(nextProjects);
    if (!writeResult.success) {
      return writeResult;
    }

    return {
      success: true,
      data: normalizedProject
    };
  }

  loadProject(projectId: string): SavedStoryProject | null {
    return this.readProjects().find(project => project.id === projectId) ?? null;
  }

  deleteProject(projectId: string): StorageResult<SavedStoryProject[]> {
    if (!this.hasLocalStorage()) {
      return {
        success: false,
        message: 'Local story saving is unavailable in this browser.'
      };
    }

    const nextProjects = this.readProjects().filter(project => project.id !== projectId);
    const writeResult = this.writeProjects(nextProjects);
    if (!writeResult.success) {
      return writeResult;
    }

    return {
      success: true,
      data: nextProjects
    };
  }

  private readProjects(): SavedStoryProject[] {
    if (!this.hasLocalStorage()) {
      return [];
    }

    try {
      const rawProjects = localStorage.getItem(this.storageKey);
      if (!rawProjects) {
        return [];
      }

      const parsed = JSON.parse(rawProjects) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(isSavedStoryProject);
    } catch {
      return [];
    }
  }

  private writeProjects(projects: SavedStoryProject[]): StorageResult<SavedStoryProject[]> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(projects));
      return {
        success: true,
        data: projects
      };
    } catch {
      return {
        success: false,
        message: 'The browser could not save this story. Local storage may be full or disabled.'
      };
    }
  }

  private hasLocalStorage(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }
}

/**
 * Order saved projects newest-first by `updatedAt`.
 *
 * `Date.parse` answers `NaN` for a timestamp it cannot read, and the entries
 * this compares come back out of `localStorage`, where `isSavedStoryProject`
 * asks only that `updatedAt` be a non-empty string — a half-written write, a
 * hand-edited value, or an entry left by an older shape of this record all
 * satisfy that. Subtracting through a `NaN` gives `NaN`, and a comparator that
 * answers `NaN` is read as *equal*: `Array.prototype.sort` coerces it to `+0`
 * and, being stable, then leaves the pair exactly where it found it. One
 * unreadable entry therefore compares equal to every other, which is enough to
 * pin the whole list in the order it happened to be built in — the sort quietly
 * stops sorting rather than failing.
 *
 * That order is close to the reverse of the intended one. `readProjects`
 * returns the stored list, which `saveProject` writes newest-first, so
 * `listProjects` hands the library oldest-first, and `saveProject` — which
 * truncates to `maxProjects` on the very next line — drops the *newest* stored
 * project and keeps the oldest. The corrupt entry survives every trim, so the
 * damage repeats on each save until the newest twelve stories are gone.
 *
 * Treating an unreadable timestamp as older than any real one keeps the
 * comparator a real ordering: the valid entries sort among themselves again,
 * and the corrupt entry lands at the end of the list, first in line to be
 * trimmed, instead of deciding where everything else goes.
 */
function byNewestUpdateFirst(first: SavedStoryProject, second: SavedStoryProject): number {
  return toSortableTimestamp(second.updatedAt) - toSortableTimestamp(first.updatedAt);
}

/**
 * A finite floor rather than `-Infinity`, so two unreadable timestamps compare
 * equal instead of subtracting to `NaN` and reintroducing the same problem.
 */
function toSortableTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MIN_SAFE_INTEGER : parsed;
}

function isSavedStoryProject(value: unknown): value is SavedStoryProject {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SavedStoryProject>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.storyId)
    && isNonEmptyString(candidate.title)
    && isNonEmptyString(candidate.updatedAt)
    && Array.isArray(candidate.chapters)
    && Boolean(candidate.summary)
    && Boolean(candidate.state)
    && Boolean(candidate.blueprint);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
