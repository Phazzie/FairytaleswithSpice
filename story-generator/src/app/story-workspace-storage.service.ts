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
    const projects = this.readProjects();
    return [...projects].sort((first, second) =>
      Date.parse(second.updatedAt) - Date.parse(first.updatedAt)
    );
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
      .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
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
