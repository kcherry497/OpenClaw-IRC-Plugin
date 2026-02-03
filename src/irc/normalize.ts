/**
 * IRC control character codes that should be stripped from messages.
 * - \x01: CTCP delimiter (ACTION, VERSION, etc.)
 * - \x02: Bold
 * - \x03: Color (followed by color codes)
 * - \x0F: Reset formatting
 * - \x16: Reverse/Italic
 * - \x1D: Italic
 * - \x1F: Underline
 */
const IRC_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Color code pattern: \x03 followed by optional foreground,background numbers
 */
const IRC_COLOR_CODES = /\x03(\d{1,2}(,\d{1,2})?)?/g;

/**
 * CTCP message pattern: \x01COMMAND text\x01
 */
const CTCP_PATTERN = /^\x01([A-Z]+)\s*(.*?)\x01?$/;

/**
 * Sanitize IRC message text by stripping control characters and color codes.
 * Returns the cleaned text and whether it was a CTCP message.
 */
export function sanitizeMessage(text: string): {
  text: string;
  isCtcp: boolean;
  ctcpCommand?: string;
  ctcpText?: string;
} {
  // Check for CTCP messages first
  const ctcpMatch = text.match(CTCP_PATTERN);
  if (ctcpMatch) {
    const ctcpCommand = ctcpMatch[1];
    const ctcpText = ctcpMatch[2] || "";

    // Handle ACTION specially - it's a valid message type
    if (ctcpCommand === "ACTION") {
      return {
        text: sanitizeText(ctcpText),
        isCtcp: true,
        ctcpCommand: "ACTION",
        ctcpText: sanitizeText(ctcpText),
      };
    }

    // Other CTCP commands (VERSION, PING, etc.) - return empty text
    return {
      text: "",
      isCtcp: true,
      ctcpCommand,
      ctcpText: sanitizeText(ctcpText),
    };
  }

  return {
    text: sanitizeText(text),
    isCtcp: false,
  };
}

/**
 * Strip IRC formatting codes from text.
 */
function sanitizeText(text: string): string {
  return text
    .replace(IRC_COLOR_CODES, "")  // Remove color codes first (includes \x03)
    .replace(IRC_CONTROL_CHARS, "") // Then remove other control chars
    .trim();
}

/**
 * Validate that text doesn't contain potentially dangerous content.
 * Returns true if text is safe, false if it should be rejected.
 */
export function isValidMessageContent(text: string): boolean {
  // Reject empty messages
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Reject messages that are too long (IRC limit is typically 512 bytes total)
  if (text.length > 2000) {
    return false;
  }

  // Reject messages with null bytes
  if (text.includes("\x00")) {
    return false;
  }

  return true;
}

export function normalizeTarget(target: string): string {
  return target.toLowerCase().trim();
}

export function isChannel(target: string): boolean {
  return target.startsWith("#") || target.startsWith("&");
}

export function isValidNickname(nick: string): boolean {
  if (!nick || nick.length === 0 || nick.length > 16) {
    return false;
  }
  return /^[a-zA-Z\[\]\\`_^{|}][a-zA-Z0-9\[\]\\`_^{|}-]*$/.test(nick);
}

export function isValidChannel(channel: string): boolean {
  if (!channel || channel.length < 2 || channel.length > 50) {
    return false;
  }
  if (!channel.startsWith("#") && !channel.startsWith("&")) {
    return false;
  }
  return !/[\s,\x07]/.test(channel);
}

export function formatTarget(target: string): string {
  const normalized = target.trim();
  if (isChannel(normalized)) {
    return normalized.toLowerCase();
  }
  return normalized;
}

export function extractMention(text: string, nickname: string): { mentioned: boolean; cleanText: string } {
  const patterns = [
    new RegExp(`^@?${escapeRegex(nickname)}[,:]?\\s*`, "i"),
    new RegExp(`\\s@${escapeRegex(nickname)}\\b`, "gi"),
  ];

  let cleanText = text;
  let mentioned = false;

  for (const pattern of patterns) {
    if (pattern.test(cleanText)) {
      mentioned = true;
      cleanText = cleanText.replace(pattern, " ");
    }
  }

  // Collapse multiple spaces and trim
  cleanText = cleanText.replace(/\s+/g, " ").trim();

  return { mentioned, cleanText };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
