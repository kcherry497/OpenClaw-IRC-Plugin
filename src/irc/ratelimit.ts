/**
 * Rate limiting module for IRC message handling.
 * Implements a simple sliding window rate limiter per user.
 */

import type { Logger } from "../types.js";

export interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitEntry {
  /** Number of requests in current window */
  count: number;
  /** Timestamp when the window resets */
  resetTime: number;
  /** Whether we've already notified this user about rate limiting */
  notified: boolean;
}

/** Default rate limit: 5 requests per minute */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60000,
};

/** Per-user rate limit tracking */
const rateLimits = new Map<string, RateLimitEntry>();

/** Cleanup interval for stale entries (5 minutes) */
const CLEANUP_INTERVAL = 300000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Normalize a nickname for rate limit key.
 */
function normalizeKey(nick: string): string {
  return nick.toLowerCase().trim();
}

/**
 * Start the cleanup timer to remove stale rate limit entries.
 */
function ensureCleanupTimer(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimits) {
      if (now > entry.resetTime) {
        rateLimits.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);

  // Don't prevent process exit
  cleanupTimer.unref?.();
}

/**
 * Check if a user is rate limited.
 * Returns true if the user should be blocked, false if allowed.
 */
export function isRateLimited(
  nick: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
  log?: Logger
): { limited: boolean; shouldNotify: boolean } {
  ensureCleanupTimer();

  const key = normalizeKey(nick);
  const now = Date.now();
  const entry = rateLimits.get(key);

  // New user or window has reset
  if (!entry || now > entry.resetTime) {
    rateLimits.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      notified: false,
    });
    return { limited: false, shouldNotify: false };
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    const shouldNotify = !entry.notified;
    if (shouldNotify) {
      entry.notified = true;
      log?.debug?.(`[ratelimit] ${nick} hit rate limit (${config.maxRequests}/${config.windowMs}ms)`);
    }
    return { limited: true, shouldNotify };
  }

  // Increment counter
  entry.count++;
  return { limited: false, shouldNotify: false };
}

/**
 * Reset rate limit for a user (useful for testing).
 */
export function resetRateLimit(nick: string): void {
  rateLimits.delete(normalizeKey(nick));
}

/**
 * Clear all rate limits (useful for testing and cleanup).
 */
export function clearAllRateLimits(): void {
  rateLimits.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Get current rate limit status for a user (useful for testing).
 */
export function getRateLimitStatus(nick: string): { count: number; remainingMs: number } | null {
  const entry = rateLimits.get(normalizeKey(nick));
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.resetTime) return null;

  return {
    count: entry.count,
    remainingMs: entry.resetTime - now,
  };
}
