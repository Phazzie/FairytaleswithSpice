/**
 * Authentication Middleware
 * 
 * Provides API key authentication for securing endpoints.
 * Usage: Add authenticateRequest() at the start of API handlers
 */

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
    req.headers['x-api-key'] || 
    req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return {
      authenticated: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key required. Include X-API-Key header or Authorization Bearer token'
      }
    };
  }
  
  // Validate API key against environment variable
  const validKeys = (process.env['API_KEYS'] || '').split(',').filter(k => k.trim());
  
  if (validKeys.length === 0) {
    // No API keys configured - allow request in development mode
    console.warn('⚠️  No API keys configured. Set API_KEYS environment variable for production.');
    return {
      authenticated: true,
      userId: 'development_user'
    };
  }
  
  if (!validKeys.includes(apiKey)) {
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
 * Rate Limiting Middleware
 * 
 * Implements in-memory rate limiting to prevent abuse.
 * In production, use a distributed cache like Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage (replace with Redis in production)
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

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);
