// Created: 2026-06-04 00:00 EDT

import { ERROR_CODES } from '../../errorCodes';
import type { AuthUser } from './authPort';

export interface ProjectAccessRecord {
  projectId: string;
  ownerUserId: string;
}

export interface ProjectAccessDecision {
  authorized: true;
  projectId: string;
  ownerUserId: string;
}

export class ProjectAuthorizationError extends Error {
  readonly code = ERROR_CODES.FORBIDDEN;
  readonly statusCode = 403;
  readonly projectId: string;

  constructor(projectId: string, message = 'You do not have access to this Story Lab project.') {
    super(message);
    this.name = 'ProjectAuthorizationError';
    this.projectId = projectId;
  }
}

export function authorizeProjectAccess(user: AuthUser, project: ProjectAccessRecord): ProjectAccessDecision {
  if (user.userId !== project.ownerUserId) {
    throw new ProjectAuthorizationError(project.projectId);
  }

  return {
    authorized: true,
    projectId: project.projectId,
    ownerUserId: project.ownerUserId
  };
}

export function isProjectAuthorizationError(error: unknown): error is ProjectAuthorizationError {
  return error instanceof ProjectAuthorizationError;
}
