// Created: 2026-06-08 10:40 EDT

import { AuthError, type AuthPort, type AuthRequestLike, type AuthUser } from './authPort';

export interface VerifiedClerkSession {
  userId: string;
  email?: string;
}

export interface ClerkAuthPortOptions {
  verifySessionToken?: (token: string, req: AuthRequestLike) => Promise<VerifiedClerkSession | null>;
}

export function createClerkAuthPort(options: ClerkAuthPortOptions = {}): AuthPort {
  return {
    async getCurrentUser(req) {
      if (!options.verifySessionToken) {
        return null;
      }

      const token = readClerkSessionToken(req);
      if (!token) {
        return null;
      }

      try {
        const session = await options.verifySessionToken(token, req);
        return session ? toAuthUser(session) : null;
      } catch {
        return null;
      }
    },

    async requireUser(req) {
      if (!options.verifySessionToken) {
        throw new AuthError('Clerk account authentication is not configured for this route.');
      }

      const token = readClerkSessionToken(req);
      if (!token) {
        throw new AuthError('Clerk session token is required.');
      }

      try {
        const session = await options.verifySessionToken(token, req);
        if (!session) {
          throw new AuthError('Clerk session could not be verified.');
        }
        return toAuthUser(session);
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        throw new AuthError('Clerk session could not be verified.');
      }
    }
  };
}

export function readClerkSessionToken(req: AuthRequestLike): string | null {
  const bearerToken = readBearerToken(req);
  if (bearerToken) {
    return bearerToken;
  }

  const cookieSession = req.cookies?.['__session']?.trim();
  if (cookieSession) {
    return cookieSession;
  }

  const rawCookieHeader = readHeader(req, 'cookie');
  return rawCookieHeader ? readCookieValue(rawCookieHeader, '__session') : null;
}

function readBearerToken(req: AuthRequestLike): string | null {
  const authorization = readHeader(req, 'authorization');
  if (!authorization) {
    return null;
  }

  const separatorIndex = findFirstWhitespaceIndex(authorization);
  if (separatorIndex <= 0) {
    return null;
  }

  const scheme = authorization.slice(0, separatorIndex).toLowerCase();
  if (scheme !== 'bearer') {
    return null;
  }

  const token = authorization.slice(separatorIndex + 1).trim();
  return token || null;
}

function readHeader(req: AuthRequestLike, headerName: string): string | null {
  const headers = req.headers ?? {};
  const matchingKey = Object.keys(headers).find(key => key.toLowerCase() === headerName.toLowerCase());
  const value = matchingKey ? headers[matchingKey] : undefined;
  if (Array.isArray(value)) {
    return value.find(item => item.trim())?.trim() ?? null;
  }
  return value?.trim() || null;
}

function readCookieValue(rawCookieHeader: string, cookieName: string): string | null {
  for (const chunk of rawCookieHeader.split(';')) {
    const [name, ...valueParts] = chunk.split('=');
    if (name.trim() === cookieName) {
      const rawValue = valueParts.join('=').trim();
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue || null;
      }
    }
  }
  return null;
}

function findFirstWhitespaceIndex(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === ' ' || char === '\t') {
      return index;
    }
  }
  return -1;
}

function toAuthUser(session: VerifiedClerkSession): AuthUser {
  return {
    userId: session.userId,
    email: session.email
  };
}
