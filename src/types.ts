import type { Client } from "irc-framework";
import { z } from "zod";

export type { Client };

/**
 * Logger interface for structured logging throughout the plugin.
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug?(message: string): void;
}

export interface IrcSaslConfig {
  username: string;
  password: string;
}

export interface IrcGroupConfig {
  users: string[];
}

export interface IrcAccountConfig {
  enabled: boolean;
  server: string;
  port: number;
  ssl: boolean;
  nickname: string;
  username?: string;
  realname: string;
  sasl?: IrcSaslConfig;
  nickservPassword?: string;
  channels: string[];
  dm: {
    policy: "open" | "pairing" | "disabled";
    allowFrom: string[];
  };
  groupPolicy: "allowlist" | "denylist" | "all";
  groups: Record<string, IrcGroupConfig>;
}

export interface ResolvedIrcAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  config: IrcAccountConfig;
}

export interface IrcConnectionState {
  connected: boolean;
  registered: boolean;
  nickname: string | null;
  channels: Set<string>;
  lastError: string | null;
  reconnectAttempts: number;
}

export interface IrcClientWrapper {
  client: Client;
  state: IrcConnectionState;
  accountId: string;
  config: IrcAccountConfig;
  connect(): Promise<void>;
  disconnect(): void;
  say(target: string, message: string): void;
  join(channel: string): void;
  part(channel: string): void;
}

export type ChatType = "direct" | "group";

export interface InboundMessage {
  channel: "irc";
  accountId: string;
  senderId: string;
  chatType: ChatType;
  chatId: string;
  text: string;
  raw?: unknown;
  reply: (text: string) => Promise<void>;
}

// Zod schema for IRC configuration
export const IrcConfigSchema = z.object({
  enabled: z.boolean().default(true),
  server: z.string().min(1).describe("IRC server hostname"),
  port: z.number().int().min(1).max(65535).default(6697).describe("IRC server port"),
  ssl: z.boolean().default(true).describe("Use TLS/SSL connection"),
  nickname: z.string().min(1).max(16).describe("Bot nickname"),
  username: z.string().min(1).max(16).optional().describe("IRC username (defaults to nickname)"),
  realname: z.string().max(128).default("OpenClaw IRC Agent").describe("Real name / GECOS"),
  sasl: z
    .object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
    .optional()
    .describe("SASL PLAIN authentication credentials"),
  nickservPassword: z.string().optional().describe("NickServ password (fallback if no SASL)"),
  channels: z.array(z.string().startsWith("#")).default([]).describe("Channels to auto-join"),
  dm: z
    .object({
      policy: z.enum(["open", "pairing", "disabled"]).default("pairing"),
      allowFrom: z.array(z.string()).default([]),
    })
    .default({ policy: "pairing", allowFrom: [] })
    .describe("Direct message policy"),
  groupPolicy: z.enum(["allowlist", "denylist", "all"]).default("allowlist"),
  groups: z.record(z.string(), z.object({ users: z.array(z.string()).default(["*"]) })).default({}),
});
