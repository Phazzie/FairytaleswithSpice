// Created: 2026-06-04 00:00 EDT

import { ERROR_CODES } from '../../errorCodes';

export interface AuthUser {
  userId: string;
  email?: string;
}

export interface AuthRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
}

export interface AuthPort {
  getCurrentUser(req: AuthRequestLike): Promise<AuthUser | null>;
  requireUser(req: AuthRequestLike): Promise<AuthUser>;
}

export class AuthError extends Error {
  readonly code = ERROR_CODES.UNAUTHORIZED;
  readonly statusCode = 401;

  constructor(message = 'Account authentication is required.') {
    super(message);
    this.name = 'AuthError';
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function createDenyByDefaultAuthPort(): AuthPort {
  return {
    async getCurrentUser() {
      return null;
    },
    async requireUser() {
      throw new AuthError('Account authentication is not configured for this route.');
    }
  };
}

export const denyByDefaultAuthPort = createDenyByDefaultAuthPort();
