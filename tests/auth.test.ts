import { describe, it, expect } from "vitest";
import {
  isAuthorized,
  isAuthorizedForDm,
  isAuthorizedForChannel,
} from "../src/irc/auth.js";
import type { IrcAccountConfig } from "../src/types.js";

function createConfig(overrides: Partial<IrcAccountConfig> = {}): IrcAccountConfig {
  return {
    enabled: true,
    server: "irc.example.com",
    port: 6697,
    ssl: true,
    nickname: "testbot",
    realname: "Test Bot",
    channels: ["#test"],
    dm: {
      policy: "pairing",
      allowFrom: [],
    },
    groupPolicy: "allowlist",
    groups: {},
    ...overrides,
  };
}

describe("auth", () => {
  describe("isAuthorizedForDm", () => {
    it("should reject DMs when policy is disabled", () => {
      const config = createConfig({
        dm: { policy: "disabled", allowFrom: [] },
      });
      const result = isAuthorizedForDm("someuser", config);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("DMs are disabled");
    });

    it("should allow DMs when policy is open", () => {
      const config = createConfig({
        dm: { policy: "open", allowFrom: [] },
      });
      const result = isAuthorizedForDm("anyuser", config);
      expect(result.authorized).toBe(true);
    });

    it("should reject DMs when policy is pairing and allowFrom is empty", () => {
      const config = createConfig({
        dm: { policy: "pairing", allowFrom: [] },
      });
      const result = isAuthorizedForDm("someuser", config);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("Not paired");
    });

    it("should allow DMs when user is in allowFrom list", () => {
      const config = createConfig({
        dm: { policy: "pairing", allowFrom: ["alloweduser"] },
      });
      const result = isAuthorizedForDm("alloweduser", config);
      expect(result.authorized).toBe(true);
    });

    it("should allow DMs when user is in allowFrom list (case insensitive)", () => {
      const config = createConfig({
        dm: { policy: "pairing", allowFrom: ["AllowedUser"] },
      });
      const result = isAuthorizedForDm("alloweduser", config);
      expect(result.authorized).toBe(true);
    });

    it("should reject DMs when user is not in allowFrom list", () => {
      const config = createConfig({
        dm: { policy: "pairing", allowFrom: ["otheruser"] },
      });
      const result = isAuthorizedForDm("someuser", config);
      expect(result.authorized).toBe(false);
    });

    it("should allow DMs when wildcard is in allowFrom list", () => {
      const config = createConfig({
        dm: { policy: "pairing", allowFrom: ["*"] },
      });
      const result = isAuthorizedForDm("anyuser", config);
      expect(result.authorized).toBe(true);
    });
  });

  describe("isAuthorizedForChannel", () => {
    it("should allow all users when policy is 'all'", () => {
      const config = createConfig({
        groupPolicy: "all",
        groups: {},
      });
      const result = isAuthorizedForChannel("anyuser", "#test", config);
      expect(result.authorized).toBe(true);
    });

    it("should reject when channel not in groups (allowlist mode)", () => {
      const config = createConfig({
        groupPolicy: "allowlist",
        groups: {},
      });
      const result = isAuthorizedForChannel("someuser", "#unconfigured", config);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("Channel not configured");
    });

    it("should allow user when in allowlist for channel", () => {
      const config = createConfig({
        groupPolicy: "allowlist",
        groups: {
          "#test": { users: ["alloweduser"] },
        },
      });
      const result = isAuthorizedForChannel("alloweduser", "#test", config);
      expect(result.authorized).toBe(true);
    });

    it("should reject user when not in allowlist for channel", () => {
      const config = createConfig({
        groupPolicy: "allowlist",
        groups: {
          "#test": { users: ["otheruser"] },
        },
      });
      const result = isAuthorizedForChannel("someuser", "#test", config);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("Not in allowlist");
    });

    it("should allow all users when wildcard in allowlist", () => {
      const config = createConfig({
        groupPolicy: "allowlist",
        groups: {
          "#test": { users: ["*"] },
        },
      });
      const result = isAuthorizedForChannel("anyuser", "#test", config);
      expect(result.authorized).toBe(true);
    });

    it("should allow user when not in denylist", () => {
      const config = createConfig({
        groupPolicy: "denylist",
        groups: {
          "#test": { users: ["baduser"] },
        },
      });
      const result = isAuthorizedForChannel("gooduser", "#test", config);
      expect(result.authorized).toBe(true);
    });

    it("should reject user when in denylist", () => {
      const config = createConfig({
        groupPolicy: "denylist",
        groups: {
          "#test": { users: ["baduser"] },
        },
      });
      const result = isAuthorizedForChannel("baduser", "#test", config);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("In denylist");
    });

    it("should allow all users when channel not in denylist groups", () => {
      const config = createConfig({
        groupPolicy: "denylist",
        groups: {},
      });
      const result = isAuthorizedForChannel("anyuser", "#unconfigured", config);
      expect(result.authorized).toBe(true);
    });

    it("should match channel names case-insensitively", () => {
      const config = createConfig({
        groupPolicy: "allowlist",
        groups: {
          "#test": { users: ["alloweduser"] },
        },
      });
      // The channel in groups is "#test" but we're checking "#test"
      const result = isAuthorizedForChannel("alloweduser", "#test", config);
      expect(result.authorized).toBe(true);
    });
  });

  describe("isAuthorized", () => {
    it("should route DMs to DM authorization", () => {
      const config = createConfig({
        dm: { policy: "disabled", allowFrom: [] },
      });
      // DM target doesn't start with #
      const result = isAuthorized("someuser", "botname", config);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("DMs are disabled");
    });

    it("should route channel messages to channel authorization", () => {
      const config = createConfig({
        groupPolicy: "allowlist",
        groups: {},
      });
      // Channel target starts with #
      const result = isAuthorized("someuser", "#channel", config);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("Channel not configured");
    });
  });
});
