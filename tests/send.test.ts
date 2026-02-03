import { describe, it, expect } from "vitest";
import { chunkMessage } from "../src/irc/send.js";

describe("chunkMessage", () => {
  it("should return empty array for empty string", () => {
    expect(chunkMessage("")).toEqual([]);
  });

  it("should return single chunk for short messages", () => {
    expect(chunkMessage("hello")).toEqual(["hello"]);
    expect(chunkMessage("a".repeat(450))).toEqual(["a".repeat(450)]);
  });

  it("should split long messages at word boundaries", () => {
    const words = Array(100).fill("word").join(" ");
    const chunks = chunkMessage(words, 50);

    // Each chunk should be <= 50 characters
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }

    // Should have multiple chunks
    expect(chunks.length).toBeGreaterThan(1);

    // Chunks should not end with spaces (trimEnd applied)
    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.trimEnd());
    }
  });

  it("should split at newlines when possible", () => {
    const text = "line one is here\nline two is here\nline three is here";
    const chunks = chunkMessage(text, 30);

    // Should prefer splitting at newlines
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe("line one is here");
    expect(chunks[1]).toBe("line two is here");
    expect(chunks[2]).toBe("line three is here");
  });

  it("should force split very long words", () => {
    const longWord = "a".repeat(500);
    const chunks = chunkMessage(longWord, 100);

    // Should have multiple chunks
    expect(chunks.length).toBe(5);

    // Each chunk should be exactly 100 chars (forced split)
    for (const chunk of chunks) {
      expect(chunk.length).toBe(100);
    }
  });

  it("should handle mixed content", () => {
    const text = "Short. " + "a".repeat(100) + " end.";
    const chunks = chunkMessage(text, 50);

    // Should handle the mix of short and long segments
    expect(chunks.length).toBeGreaterThan(1);

    // No chunk should exceed limit
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it("should preserve intentional spacing in content", () => {
    const text = "code:    indented content";
    const chunks = chunkMessage(text, 100);

    // Should preserve the spacing
    expect(chunks[0]).toBe("code:    indented content");
  });

  it("should handle custom max length", () => {
    const text = "hello world this is a test";
    const chunks = chunkMessage(text, 10);

    // Should split appropriately
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(10);
    }
  });

  it("should not create empty chunks", () => {
    const text = "   hello   world   ";
    const chunks = chunkMessage(text, 5);

    // No empty chunks
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it("should handle unicode characters", () => {
    const text = "Hello 世界! 🌍 test";
    const chunks = chunkMessage(text, 100);

    expect(chunks[0]).toBe("Hello 世界! 🌍 test");
  });
});
