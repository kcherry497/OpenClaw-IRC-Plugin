import { describe, it, expect } from "vitest";
import {
  normalizeTarget,
  isChannel,
  isValidNickname,
  isValidChannel,
  formatTarget,
  extractMention,
  sanitizeMessage,
  isValidMessageContent,
} from "../src/irc/normalize.js";

describe("normalizeTarget", () => {
  it("should lowercase and trim target", () => {
    expect(normalizeTarget("  #Channel  ")).toBe("#channel");
    expect(normalizeTarget("NickName")).toBe("nickname");
  });
});

describe("isChannel", () => {
  it("should return true for channel targets", () => {
    expect(isChannel("#channel")).toBe(true);
    expect(isChannel("&channel")).toBe(true);
  });

  it("should return false for non-channel targets", () => {
    expect(isChannel("nickname")).toBe(false);
    expect(isChannel("")).toBe(false);
  });
});

describe("isValidNickname", () => {
  it("should validate correct nicknames", () => {
    expect(isValidNickname("nick")).toBe(true);
    expect(isValidNickname("nick123")).toBe(true);
    expect(isValidNickname("_nick")).toBe(true);
    expect(isValidNickname("[nick]")).toBe(true);
    expect(isValidNickname("nick-name")).toBe(true);
  });

  it("should reject invalid nicknames", () => {
    expect(isValidNickname("")).toBe(false);
    expect(isValidNickname("123nick")).toBe(false); // Can't start with number
    expect(isValidNickname("-nick")).toBe(false); // Can't start with hyphen
    expect(isValidNickname("a".repeat(17))).toBe(false); // Too long
    expect(isValidNickname("nick name")).toBe(false); // No spaces
  });
});

describe("isValidChannel", () => {
  it("should validate correct channels", () => {
    expect(isValidChannel("#channel")).toBe(true);
    expect(isValidChannel("&channel")).toBe(true);
    expect(isValidChannel("#chan-nel_123")).toBe(true);
  });

  it("should reject invalid channels", () => {
    expect(isValidChannel("")).toBe(false);
    expect(isValidChannel("#")).toBe(false); // Too short
    expect(isValidChannel("channel")).toBe(false); // Missing prefix
    expect(isValidChannel("#chan nel")).toBe(false); // No spaces
    expect(isValidChannel("#chan,nel")).toBe(false); // No commas
    expect(isValidChannel("#" + "a".repeat(50))).toBe(false); // Too long
  });
});

describe("formatTarget", () => {
  it("should lowercase channels", () => {
    expect(formatTarget("#Channel")).toBe("#channel");
    expect(formatTarget("&Channel")).toBe("&channel");
  });

  it("should preserve nickname case", () => {
    expect(formatTarget("NickName")).toBe("NickName");
  });

  it("should trim whitespace", () => {
    expect(formatTarget("  #channel  ")).toBe("#channel");
    expect(formatTarget("  NickName  ")).toBe("NickName");
  });
});

describe("extractMention", () => {
  it("should detect @nickname mentions", () => {
    const result = extractMention("@bot hello", "bot");
    expect(result.mentioned).toBe(true);
    expect(result.cleanText).toBe("hello");
  });

  it("should detect nickname: mentions", () => {
    const result = extractMention("bot: hello", "bot");
    expect(result.mentioned).toBe(true);
    expect(result.cleanText).toBe("hello");
  });

  it("should detect nickname, mentions", () => {
    const result = extractMention("bot, hello", "bot");
    expect(result.mentioned).toBe(true);
    expect(result.cleanText).toBe("hello");
  });

  it("should detect inline @mentions", () => {
    const result = extractMention("hey @bot check this", "bot");
    expect(result.mentioned).toBe(true);
    expect(result.cleanText).toBe("hey check this");
  });

  it("should be case insensitive", () => {
    const result = extractMention("@BOT hello", "bot");
    expect(result.mentioned).toBe(true);
    expect(result.cleanText).toBe("hello");
  });

  it("should return false for no mention", () => {
    const result = extractMention("hello world", "bot");
    expect(result.mentioned).toBe(false);
    expect(result.cleanText).toBe("hello world");
  });
});

describe("sanitizeMessage", () => {
  it("should return plain text unchanged", () => {
    const result = sanitizeMessage("hello world");
    expect(result.text).toBe("hello world");
    expect(result.isCtcp).toBe(false);
  });

  it("should strip IRC color codes", () => {
    const result = sanitizeMessage("\x0312,4colored text\x03 normal");
    expect(result.text).toBe("colored text normal");
    expect(result.isCtcp).toBe(false);
  });

  it("should strip bold/italic formatting", () => {
    const result = sanitizeMessage("\x02bold\x02 \x1Ditalic\x1D");
    expect(result.text).toBe("bold italic");
  });

  it("should handle ACTION CTCP", () => {
    const result = sanitizeMessage("\x01ACTION waves\x01");
    expect(result.isCtcp).toBe(true);
    expect(result.ctcpCommand).toBe("ACTION");
    expect(result.ctcpText).toBe("waves");
    expect(result.text).toBe("waves");
  });

  it("should handle non-ACTION CTCP", () => {
    const result = sanitizeMessage("\x01VERSION\x01");
    expect(result.isCtcp).toBe(true);
    expect(result.ctcpCommand).toBe("VERSION");
    expect(result.text).toBe("");
  });

  it("should handle CTCP with arguments", () => {
    const result = sanitizeMessage("\x01PING 12345\x01");
    expect(result.isCtcp).toBe(true);
    expect(result.ctcpCommand).toBe("PING");
    expect(result.ctcpText).toBe("12345");
  });
});

describe("isValidMessageContent", () => {
  it("should accept valid messages", () => {
    expect(isValidMessageContent("hello world")).toBe(true);
    expect(isValidMessageContent("   hello   ")).toBe(true);
  });

  it("should reject empty messages", () => {
    expect(isValidMessageContent("")).toBe(false);
    expect(isValidMessageContent("   ")).toBe(false);
  });

  it("should reject messages with null bytes", () => {
    expect(isValidMessageContent("hello\x00world")).toBe(false);
  });

  it("should reject overly long messages", () => {
    expect(isValidMessageContent("a".repeat(2001))).toBe(false);
  });

  it("should accept messages at the length limit", () => {
    expect(isValidMessageContent("a".repeat(2000))).toBe(true);
  });
});
