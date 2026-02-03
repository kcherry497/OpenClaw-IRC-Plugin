import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setRuntime,
  getRuntime,
  getRuntimeSafe,
  hasRuntime,
  clearRuntime,
  type OpenClawRuntime,
} from "../src/runtime.js";

const mockRuntime: OpenClawRuntime = {
  config: {
    loadConfig: () => ({}),
  },
  channel: {
    text: {
      resolveMarkdownTableMode: () => "preserve",
      convertMarkdownTables: (text) => text,
    },
    reply: {
      handleInboundMessage: async () => {},
    },
  },
  log: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
};

describe("runtime", () => {
  beforeEach(() => {
    clearRuntime();
  });

  afterEach(() => {
    clearRuntime();
  });

  describe("hasRuntime", () => {
    it("should return false when runtime is not set", () => {
      expect(hasRuntime()).toBe(false);
    });

    it("should return true when runtime is set", () => {
      setRuntime(mockRuntime);
      expect(hasRuntime()).toBe(true);
    });
  });

  describe("getRuntime", () => {
    it("should throw when runtime is not set", () => {
      expect(() => getRuntime()).toThrow("IRC plugin runtime not initialized");
    });

    it("should return runtime when set", () => {
      setRuntime(mockRuntime);
      expect(getRuntime()).toBe(mockRuntime);
    });
  });

  describe("getRuntimeSafe", () => {
    it("should return null when runtime is not set", () => {
      expect(getRuntimeSafe()).toBeNull();
    });

    it("should return runtime when set", () => {
      setRuntime(mockRuntime);
      expect(getRuntimeSafe()).toBe(mockRuntime);
    });
  });

  describe("clearRuntime", () => {
    it("should clear the runtime", () => {
      setRuntime(mockRuntime);
      expect(hasRuntime()).toBe(true);

      clearRuntime();
      expect(hasRuntime()).toBe(false);
    });
  });

  describe("setRuntime", () => {
    it("should set the runtime", () => {
      expect(hasRuntime()).toBe(false);

      setRuntime(mockRuntime);

      expect(hasRuntime()).toBe(true);
      expect(getRuntime()).toBe(mockRuntime);
    });

    it("should allow replacing the runtime", () => {
      const runtime1 = { ...mockRuntime };
      const runtime2 = { ...mockRuntime };

      setRuntime(runtime1);
      expect(getRuntime()).toBe(runtime1);

      setRuntime(runtime2);
      expect(getRuntime()).toBe(runtime2);
    });
  });
});
