/**
 * Authorization module for IRC message handling.
 * Enforces DM policies and group access control.
 */

import type { IrcAccountConfig, Logger } from "../types.js";

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

/**
 * Normalize a nickname for comparison (lowercase, trimmed).
 */
function normalizeNick(nick: string): string {
  return nick.toLowerCase().trim();
}

/**
 * Check if a user matches an allowlist/denylist entry.
 * Supports wildcard (*) for "all users".
 */
function matchesEntry(nick: string, entry: string): boolean {
  if (entry === "*") return true;
  return normalizeNick(nick) === normalizeNick(entry);
}

/**
 * Check if a user is in a list of entries.
 */
function isInList(nick: string, entries: string[]): boolean {
  return entries.some((entry) => matchesEntry(nick, entry));
}

/**
 * Check if a user is authorized to send direct messages.
 */
export function isAuthorizedForDm(
  nick: string,
  config: IrcAccountConfig,
  log?: Logger
): AuthorizationResult {
  const policy = config.dm?.policy ?? "pairing";
  const allowFrom = config.dm?.allowFrom ?? [];

  switch (policy) {
    case "disabled":
      log?.debug?.(`[auth] DM from ${nick} rejected: DMs are disabled`);
      return { authorized: false, reason: "DMs are disabled" };

    case "open":
      // Open policy - allow all DMs
      return { authorized: true };

    case "pairing":
      // Pairing mode - check allowFrom list
      // If allowFrom is empty, no one is authorized yet (they need to be paired first)
      // If allowFrom contains entries, check if user is in the list
      if (allowFrom.length === 0) {
        log?.debug?.(`[auth] DM from ${nick} rejected: No users paired yet`);
        return { authorized: false, reason: "Not paired" };
      }
      if (isInList(nick, allowFrom)) {
        return { authorized: true };
      }
      log?.debug?.(`[auth] DM from ${nick} rejected: Not in allowFrom list`);
      return { authorized: false, reason: "Not paired" };

    default:
      log?.warn?.(`[auth] Unknown DM policy: ${policy}, defaulting to deny`);
      return { authorized: false, reason: "Unknown policy" };
  }
}

/**
 * Check if a user is authorized to send messages in a channel.
 */
export function isAuthorizedForChannel(
  nick: string,
  channel: string,
  config: IrcAccountConfig,
  log?: Logger
): AuthorizationResult {
  const groupPolicy = config.groupPolicy ?? "allowlist";
  const groups = config.groups ?? {};
  const channelConfig = groups[channel] || groups[channel.toLowerCase()];

  switch (groupPolicy) {
    case "all":
      // Allow all users in all channels
      return { authorized: true };

    case "allowlist":
      // Only allow users explicitly listed for this channel
      if (!channelConfig) {
        log?.debug?.(`[auth] Channel ${channel} not in groups config, denying ${nick}`);
        return { authorized: false, reason: "Channel not configured" };
      }
      if (isInList(nick, channelConfig.users)) {
        return { authorized: true };
      }
      log?.debug?.(`[auth] ${nick} not in allowlist for ${channel}`);
      return { authorized: false, reason: "Not in allowlist" };

    case "denylist":
      // Allow all users except those explicitly denied
      if (!channelConfig) {
        // No denylist for this channel means everyone is allowed
        return { authorized: true };
      }
      if (isInList(nick, channelConfig.users)) {
        log?.debug?.(`[auth] ${nick} is in denylist for ${channel}`);
        return { authorized: false, reason: "In denylist" };
      }
      return { authorized: true };

    default:
      log?.warn?.(`[auth] Unknown group policy: ${groupPolicy}, defaulting to deny`);
      return { authorized: false, reason: "Unknown policy" };
  }
}

/**
 * Check if a user is authorized to send a message.
 * Handles both DMs and channel messages.
 */
export function isAuthorized(
  nick: string,
  target: string,
  config: IrcAccountConfig,
  log?: Logger
): AuthorizationResult {
  const isDirectMessage = !target.startsWith("#");

  if (isDirectMessage) {
    return isAuthorizedForDm(nick, config, log);
  }

  return isAuthorizedForChannel(nick, target, config, log);
}
