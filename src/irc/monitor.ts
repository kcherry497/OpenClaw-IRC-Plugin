import type { PrivmsgEvent } from "irc-framework";
import type { IrcClientWrapper, InboundMessage, ChatType, Logger } from "../types.js";
import { isChannel, extractMention, sanitizeMessage, isValidMessageContent } from "./normalize.js";
import { sendMessageIrc } from "./send.js";

export type MessageHandler = (message: InboundMessage) => Promise<void>;

/**
 * Create a message handler that processes incoming IRC messages.
 * Includes message sanitization and validation.
 */
export function createMessageHandler(
  client: IrcClientWrapper,
  onMessage: MessageHandler,
  log?: Logger
) {
  return async function handlePrivmsg(event: PrivmsgEvent): Promise<void> {
    const { nick, target, message } = event;

    // Ignore messages from self
    if (nick === client.state.nickname) {
      return;
    }

    // Sanitize the incoming message
    const sanitized = sanitizeMessage(message);

    // Skip non-ACTION CTCP messages (VERSION, PING, etc.)
    if (sanitized.isCtcp && sanitized.ctcpCommand !== "ACTION") {
      log?.debug?.(`[${client.accountId}] Ignoring CTCP ${sanitized.ctcpCommand} from ${nick}`);
      return;
    }

    // Validate message content
    if (!isValidMessageContent(sanitized.text)) {
      log?.debug?.(`[${client.accountId}] Rejecting invalid message from ${nick}`);
      return;
    }

    const chatType: ChatType = isChannel(target) ? "group" : "direct";
    const chatId = chatType === "group" ? target : nick;

    const { mentioned, cleanText } = extractMention(sanitized.text, client.config.nickname);

    // Process all messages (DMs and channel messages)
    // TODO: Add config option to require mention in busy channels

    // Use ACTION text if it was a /me message
    const messageText = sanitized.ctcpCommand === "ACTION"
      ? `* ${nick} ${cleanText || sanitized.text}`
      : cleanText || sanitized.text;

    const inboundMessage: InboundMessage = {
      channel: "irc",
      accountId: client.accountId,
      senderId: nick,
      chatType,
      chatId,
      text: messageText,
      raw: event,
      reply: async (text: string) => {
        const replyTarget = chatType === "group" ? target : nick;
        await sendMessageIrc(client, replyTarget, text, log);
      },
    };

    try {
      await onMessage(inboundMessage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log?.error(`[${client.accountId}] Error handling inbound message from ${nick}: ${errorMessage}`);
    }
  };
}

/**
 * Set up the message monitor for an IRC client.
 * Attaches the message handler to the client's privmsg events.
 */
export function setupMonitor(
  client: IrcClientWrapper,
  onMessage: MessageHandler,
  log?: Logger
): void {
  const handler = createMessageHandler(client, onMessage, log);
  client.client.on("privmsg", handler);
}
