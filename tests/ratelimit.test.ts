import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isRateLimited,
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitStatus,
} from "../src/irc/ratelimit.js";

describe("ratelimit", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  afterEach(() => {
    clearAllRateLimits();
  });

  describe("isRateLimited", () => {
    it("should not rate limit first request", () => {
      const result = isRateLimited("user1", { maxRequests: 5, windowMs: 60000 });
      expect(result.limited).toBe(false);
      expect(result.shouldNotify).toBe(false);
    });

    it("should not rate limit requests under limit", () => {
      const config = { maxRequests: 3, windowMs: 60000 };

      expect(isRateLimited("user1", config).limited).toBe(false);
      expect(isRateLimited("user1", config).limited).toBe(false);
      expect(isRateLimited("user1", config).limited).toBe(false);
    });

    it("should rate limit requests at limit", () => {
      const config = { maxRequests: 3, windowMs: 60000 };

      expect(isRateLimited("user1", config).limited).toBe(false); // 1
      expect(isRateLimited("user1", config).limited).toBe(false); // 2
      expect(isRateLimited("user1", config).limited).toBe(false); // 3

      const result = isRateLimited("user1", config);
      expect(result.limited).toBe(true);
      expect(result.shouldNotify).toBe(true); // First time hitting limit
    });

    it("should only notify once per rate limit window", () => {
      const config = { maxRequests: 2, windowMs: 60000 };

      isRateLimited("user1", config); // 1
      isRateLimited("user1", config); // 2

      const first = isRateLimited("user1", config);
      expect(first.limited).toBe(true);
      expect(first.shouldNotify).toBe(true);

      const second = isRateLimited("user1", config);
      expect(second.limited).toBe(true);
      expect(second.shouldNotify).toBe(false); // Already notified
    });

    it("should track users independently", () => {
      const config = { maxRequests: 2, windowMs: 60000 };

      isRateLimited("user1", config);
      isRateLimited("user1", config);
      expect(isRateLimited("user1", config).limited).toBe(true);

      // user2 should not be limited
      expect(isRateLimited("user2", config).limited).toBe(false);
    });

    it("should normalize nicknames (case insensitive)", () => {
      const config = { maxRequests: 2, windowMs: 60000 };

      isRateLimited("User1", config);
      isRateLimited("USER1", config);

      const result = isRateLimited("user1", config);
      expect(result.limited).toBe(true);
    });

    it("should reset after window expires", async () => {
      vi.useFakeTimers();
      const config = { maxRequests: 2, windowMs: 1000 };

      isRateLimited("user1", config);
      isRateLimited("user1", config);
      expect(isRateLimited("user1", config).limited).toBe(true);

      // Advance time past window
      vi.advanceTimersByTime(1100);

      // Should be allowed again
      expect(isRateLimited("user1", config).limited).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("resetRateLimit", () => {
    it("should reset rate limit for a user", () => {
      const config = { maxRequests: 2, windowMs: 60000 };

      isRateLimited("user1", config);
      isRateLimited("user1", config);
      expect(isRateLimited("user1", config).limited).toBe(true);

      resetRateLimit("user1");

      expect(isRateLimited("user1", config).limited).toBe(false);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return null for unknown user", () => {
      expect(getRateLimitStatus("unknown")).toBeNull();
    });

    it("should return status for tracked user", () => {
      const config = { maxRequests: 5, windowMs: 60000 };

      isRateLimited("user1", config);
      isRateLimited("user1", config);

      const status = getRateLimitStatus("user1");
      expect(status).not.toBeNull();
      expect(status?.count).toBe(2);
      expect(status?.remainingMs).toBeGreaterThan(0);
      expect(status?.remainingMs).toBeLessThanOrEqual(60000);
    });
  });
});
