import type { IrcClientWrapper, Logger } from "../types.js";

const MAX_MESSAGE_LENGTH = 450;
const CHUNK_DELAY_MS = 500;

/**
 * Split a message into chunks that fit within IRC's message length limits.
 * Preserves whitespace within chunks, only trimming trailing whitespace.
 *
 * @param text - The text to chunk
 * @param maxLength - Maximum length per chunk (default 450)
 * @returns Array of message chunks
 */
export function chunkMessage(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string[] {
  // Handle empty or short messages
  if (!text || text.length === 0) {
    return [];
  }

  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      // Last chunk - add if non-empty after trimming trailing whitespace
      const final = remaining.trimEnd();
      if (final.length > 0) {
        chunks.push(final);
      }
      break;
    }

    // Find a good split point
    let splitIndex = -1;

    // First, try to split at a newline within the limit
    const newlineIndex = remaining.lastIndexOf("\n", maxLength);
    if (newlineIndex > maxLength * 0.3) {
      splitIndex = newlineIndex;
    }

    // If no good newline, try to split at a space
    if (splitIndex === -1) {
      const spaceIndex = remaining.lastIndexOf(" ", maxLength);
      if (spaceIndex > maxLength * 0.3) {
        splitIndex = spaceIndex;
      }
    }

    // If no good word boundary, force split at maxLength
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    // Extract the chunk, preserving leading whitespace but trimming trailing
    const chunk = remaining.slice(0, splitIndex).trimEnd();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move past the split point, preserving any leading content
    // but skip the split character if it was whitespace
    const nextChar = remaining[splitIndex];
    const skipChar = nextChar === " " || nextChar === "\n" ? 1 : 0;
    remaining = remaining.slice(splitIndex + skipChar);
  }

  return chunks;
}

/**
 * Send a message to an IRC target, splitting into multiple lines if needed.
 * Adds a delay between chunks to avoid flooding.
 *
 * @param client - The IRC client wrapper
 * @param target - The target (channel or nickname)
 * @param text - The message text
 * @param log - Optional logger for debugging
 */
export async function sendMessageIrc(
  client: IrcClientWrapper,
  target: string,
  text: string,
  log?: Logger
): Promise<void> {
  if (!client.state.connected) {
    throw new Error("IRC client not connected");
  }

  if (!client.state.registered) {
    throw new Error("IRC client not registered");
  }

  // Split by newlines first, preserving empty lines as intentional breaks
  const lines = text.split("\n");
  const allChunks: string[] = [];

  for (const line of lines) {
    // Skip completely empty lines (but preserve lines with whitespace)
    if (line.length === 0) {
      continue;
    }

    // Chunk each line individually
    const lineChunks = chunkMessage(line);
    allChunks.push(...lineChunks);
  }

  // Send each chunk with delay
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    log?.debug?.(`[${client.accountId}] Sending to ${target}: ${chunk.slice(0, 50)}${chunk.length > 50 ? "..." : ""}`);

    client.say(target, chunk);

    // Delay between chunks to avoid flooding
    if (i < allChunks.length - 1) {
      await delay(CHUNK_DELAY_MS);
    }
  }
}

/**
 * Send a CTCP ACTION (/me) message to an IRC target.
 *
 * @param client - The IRC client wrapper
 * @param target - The target (channel or nickname)
 * @param action - The action text
 */
export function sendActionIrc(
  client: IrcClientWrapper,
  target: string,
  action: string
): void {
  if (!client.state.connected) {
    throw new Error("IRC client not connected");
  }

  if (!client.state.registered) {
    throw new Error("IRC client not registered");
  }

  const ctcpAction = `\x01ACTION ${action}\x01`;
  client.say(target, ctcpAction);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
