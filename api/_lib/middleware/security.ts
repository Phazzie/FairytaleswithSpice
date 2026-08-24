/**
 * Authentication Middleware
 * 
 * Provides API key authentication for securing endpoints.
 * Usage: Add authenticateRequest() at the start of API handlers
 */

import { timingSafeEqual } from 'node:crypto';

export interface AuthenticatedRequest {
  userId?: string;
  apiKey?: string;
  method: string;
  headers: any;
  body: any;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Authenticate API request using API key
 * 
 * Checks for API key in:
 * 1. X-API-Key header
 * 2. Authorization Bearer token
 * 
 * To enable authentication, set API_KEYS environment variable:
 * API_KEYS=key1,key2,key3
 * 
 * @param req - Request object
 * @returns Authentication result with user ID if successful
 */
export async function authenticateRequest(req: AuthenticatedRequest): Promise<AuthResult> {
  // Extract API key from header
  const apiKey =
    readHeader(req.headers, 'x-api-key') ||
    stripBearerPrefix(readHeader(req.headers, 'authorization'));

  if (!apiKey) {
    return {
      authenticated: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key required. Include X-API-Key header or Authorization Bearer token'
      }
    };
  }
  
  // Validate API key against environment variable.
  // Entries are trimmed so `API_KEYS=key1, key2` accepts `key2`.
  const validKeys = (process.env['API_KEYS'] || '')
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  if (validKeys.length === 0) {
    // No API keys configured - allow request in development mode
    console.warn('⚠️  No API keys configured. Set API_KEYS environment variable for production.');
    return {
      authenticated: true,
      userId: 'development_user'
    };
  }
  
  if (!validKeys.some(validKey => matchesApiKey(validKey, apiKey))) {
    return {
      authenticated: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      }
    };
  }

  // Map API key to user ID (in production, this would query a database)
  const userId = `user_${apiKey.substring(0, 8)}`;
  
  return {
    authenticated: true,
    userId
  };
}

/**
 * Read a single header value, tolerating the string[] form Node uses for
 * repeated headers.
 *
 * HTTP header names are case-insensitive (RFC 7230 §3.2), and callers reach
 * this function with header bags that have not always been through Node's
 * lowercasing `IncomingMessage.headers` — a hand-built object, a fetch-style
 * adapter, or a test fixture may carry the canonical `X-API-Key` /
 * `Authorization` casing that the documentation and the MISSING_API_KEY
 * message tell clients to send. Match on the lowercased key so every casing
 * resolves to the same header.
 */
function readHeader(headers: any, name: string): string | undefined {
  const raw = findHeaderValue(headers, name);
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function findHeaderValue(headers: any, name: string): unknown {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  // Node lowercases incoming header names, so the direct hit is the common path.
  const target = name.toLowerCase();
  const direct = headers[target];
  if (direct !== undefined) {
    return direct;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }

  return undefined;
}

/**
 * Strip an `Authorization: Bearer <key>` prefix. The scheme is case-insensitive
 * per RFC 7235 and only counts at the start of the value. A Bearer scheme with
 * no credentials after it counts as no key at all, so the caller reports it as
 * missing rather than as an invalid key named "Bearer".
 */
function stripBearerPrefix(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const scheme = 'bearer';
  if (value.slice(0, scheme.length).toLowerCase() !== scheme) {
    return value;
  }

  const separator = value.charAt(scheme.length);
  if (separator !== '' && separator.trim() !== '') {
    // Something like `bearerkey`: the value only starts with the scheme name,
    // so it is a key in its own right.
    return value;
  }

  return value.slice(scheme.length).trim() || undefined;
}

/**
 * Compare a candidate key against a configured key in constant time so that
 * timing differences cannot be used to recover a valid key byte by byte.
 */
function matchesApiKey(validKey: string, candidate: string): boolean {
  const validBuffer = Buffer.from(validKey, 'utf8');
  const candidateBuffer = Buffer.from(candidate, 'utf8');

  if (validBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(validBuffer, candidateBuffer);
}

/**
 * Rate Limiting Middleware
 *
 * Implements in-memory rate limiting to prevent abuse.
 * In production, use a distributed cache like Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage (suitable only for single-instance or development environments).
// For multi-instance deployments (e.g., horizontal scaling, serverless, load-balanced setups), replace with a distributed cache like Redis.
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if request exceeds rate limit
 * 
 * @param userId - User identifier (from API key)
 * @param endpoint - Endpoint being accessed
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Whether request should be allowed
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Initialize or reset if window has passed
  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs
    };
    rateLimitStore.set(key, entry);
  }
  
  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }
  
  // Increment count and allow
  entry.count++;
  
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes. Unref'd so the timer never keeps a serverless
// invocation, CLI run, or test process alive on its own.
const rateLimitCleanupTimer = setInterval(cleanupRateLimits, 5 * 60 * 1000);
rateLimitCleanupTimer.unref?.();
