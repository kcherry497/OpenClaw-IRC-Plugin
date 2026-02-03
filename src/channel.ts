import {
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  type ChannelPlugin,
} from "openclaw/plugin-sdk";
import { spawn } from "child_process";

import { type ResolvedIrcAccount, type Logger } from "./types.js";
import { getRuntimeSafe } from "./runtime.js";
import { createIrcClient } from "./irc/client.js";
import { setupMonitor } from "./irc/monitor.js";
import { sendMessageIrc } from "./irc/send.js";
import { formatTarget } from "./irc/normalize.js";
import type { IrcClientWrapper } from "./types.js";

/**
 * Active IRC client instances by account ID.
 * Managed by the gateway adapter to track connections.
 */
const activeBuses = new Map<string, IrcClientWrapper>();

/**
 * Stop callbacks by account ID for cleanup on reload.
 * This prevents connection leaks when the plugin is reloaded.
 */
const stopCallbacks = new Map<string, () => void>();

/**
 * Send a message to the agent via the openclaw CLI and get a response.
 */
async function sendToAgent(
  sessionKey: string,
  message: string,
  replyFn: (text: string) => Promise<void>,
  log?: Logger
): Promise<void> {
  return new Promise((resolve, reject) => {
    log?.info(`[irc] Sending to agent via CLI: ${message.slice(0, 50)}...`);

    // Use openclaw agent command with --deliver to send to IRC
    const proc = spawn("openclaw", [
      "agent",
      "--session-id", sessionKey,
      "--message", message,
      "--json",
    ], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        log?.error(`[irc] Agent command failed (code ${code}): ${stderr}`);
        reject(new Error(`Agent command failed: ${stderr || "unknown error"}`));
        return;
      }

      try {
        // Parse the JSON response (multi-line formatted JSON)
        const json = JSON.parse(stdout.trim());
        let response = "";

        // Extract text from result.payloads[0].text
        if (json.result?.payloads?.[0]?.text) {
          response = json.result.payloads[0].text;
        } else if (json.text) {
          response = json.text;
        } else if (json.response) {
          response = json.response;
        }

        if (response) {
          log?.info(`[irc] Agent response: ${response.slice(0, 100)}...`);
          await replyFn(response);
        } else {
          log?.warn("[irc] No response from agent, stdout: " + stdout.slice(0, 200));
        }

        resolve();
      } catch (err) {
        log?.error(`[irc] Failed to parse agent response: ${err}`);
        reject(err);
      }
    });

    proc.on("error", (err) => {
      log?.error(`[irc] Failed to spawn agent command: ${err.message}`);
      reject(err);
    });

    // Set timeout
    setTimeout(() => {
      proc.kill();
      reject(new Error("Agent command timed out"));
    }, 120000); // 2 minute timeout
  });
}

/**
 * Disconnect all active IRC connections.
 * Called during plugin reload to prevent connection leaks.
 */
export function disconnectAll(): void {
  for (const [accountId, stopFn] of stopCallbacks) {
    try {
      stopFn();
    } catch {
      // Ignore errors during cleanup
    }
    stopCallbacks.delete(accountId);
  }
  activeBuses.clear();
}

/**
 * Get the active client for an account.
 */
export function getActiveClient(accountId: string): IrcClientWrapper | undefined {
  return activeBuses.get(accountId);
}

function listIrcAccountIds(cfg: unknown): string[] {
  const config = cfg as { channels?: { irc?: { accounts?: Record<string, unknown> } } };
  const accounts = config?.channels?.irc?.accounts;
  if (accounts && typeof accounts === "object") {
    return Object.keys(accounts);
  }
  if (config?.channels?.irc) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return [];
}

function resolveDefaultIrcAccountId(cfg: unknown): string {
  const ids = listIrcAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveIrcAccount(params: { cfg: unknown; accountId?: string }): ResolvedIrcAccount {
  const { cfg, accountId = DEFAULT_ACCOUNT_ID } = params;
  const config = cfg as {
    channels?: {
      irc?: {
        enabled?: boolean;
        server?: string;
        port?: number;
        ssl?: boolean;
        nickname?: string;
        username?: string;
        realname?: string;
        sasl?: { username: string; password: string };
        nickservPassword?: string;
        channels?: string[];
        dm?: { policy?: string; allowFrom?: string[] };
        groupPolicy?: string;
        groups?: Record<string, { users: string[] }>;
        accounts?: Record<string, unknown>;
      };
    };
  };

  const ircConfig = config?.channels?.irc;
  const accountConfig =
    accountId !== DEFAULT_ACCOUNT_ID
      ? (ircConfig?.accounts?.[accountId] as typeof ircConfig)
      : ircConfig;

  const enabled = accountConfig?.enabled ?? true;
  const server = accountConfig?.server ?? "";
  const port = accountConfig?.port ?? 6697;
  const ssl = accountConfig?.ssl ?? true;
  const nickname = accountConfig?.nickname ?? "openclaw";
  const username = accountConfig?.username ?? nickname;
  const realname = accountConfig?.realname ?? "OpenClaw IRC Agent";
  const sasl = accountConfig?.sasl;
  const nickservPassword = accountConfig?.nickservPassword;
  const channels = accountConfig?.channels ?? [];
  const dm = accountConfig?.dm ?? { policy: "pairing", allowFrom: [] };
  const groupPolicy = accountConfig?.groupPolicy ?? "allowlist";
  const groups = accountConfig?.groups ?? {};

  const configured = Boolean(server?.trim());

  return {
    accountId,
    name: nickname,
    enabled,
    configured,
    config: {
      enabled,
      server,
      port,
      ssl,
      nickname,
      username,
      realname,
      sasl,
      nickservPassword,
      channels,
      dm: {
        policy: (dm.policy as "open" | "pairing" | "disabled") ?? "pairing",
        allowFrom: dm.allowFrom ?? [],
      },
      groupPolicy: (groupPolicy as "allowlist" | "denylist" | "all") ?? "allowlist",
      groups,
    },
  };
}

export const ircPlugin: ChannelPlugin<ResolvedIrcAccount> = {
  id: "irc",
  meta: {
    id: "irc",
    label: "IRC",
    selectionLabel: "IRC",
    docsPath: "/channels/irc",
    docsLabel: "irc",
    blurb: "Internet Relay Chat with SASL+TLS authentication",
    order: 100,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
  },
  reload: { configPrefixes: ["channels.irc"] },

  config: {
    listAccountIds: (cfg) => listIrcAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveIrcAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultIrcAccountId(cfg),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      server: account.config.server,
      nickname: account.config.nickname,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveIrcAccount({ cfg, accountId }).config.dm?.allowFrom ?? []).map((entry) =>
        String(entry)
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },

  pairing: {
    idLabel: "ircNick",
    normalizeAllowEntry: (entry) => entry.toLowerCase().trim(),
    notifyApproval: async ({ id }) => {
      // Send approval notification via all active accounts
      // Since the SDK doesn't provide accountId, we notify on all connected accounts
      const runtime = getRuntimeSafe();
      const log = runtime?.log as Logger | undefined;

      for (const [accountId, bus] of activeBuses) {
        try {
          await sendMessageIrc(bus, id, "Your pairing request has been approved!", log);
          log?.info(`[${accountId}] Sent pairing approval to ${id}`);
          // Only send once - first successful account wins
          break;
        } catch (err) {
          // Try next account if this one fails
          log?.debug?.(`[${accountId}] Failed to send approval to ${id}, trying next account`);
        }
      }
    },
  },

  security: {
    resolveDmPolicy: ({ account }) => {
      return {
        policy: account.config.dm?.policy ?? "pairing",
        allowFrom: account.config.dm?.allowFrom ?? [],
        policyPath: "channels.irc.dm.policy",
        allowFromPath: "channels.irc.dm.allowFrom",
        approveHint: formatPairingApproveHint("irc"),
        normalizeEntry: (raw) => raw.toLowerCase().trim(),
      };
    },
  },

  messaging: {
    normalizeTarget: (target) => formatTarget(target),
    targetResolver: {
      looksLikeId: (input) => {
        const trimmed = input.trim();
        return trimmed.startsWith("#") || /^[a-zA-Z\[\]\\`_^{|}][a-zA-Z0-9\[\]\\`_^{|}-]*$/.test(trimmed);
      },
      hint: "<#channel|nickname>",
    },
  },

  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 450,
    sendText: async ({ to, text, accountId }) => {
      const runtime = getRuntimeSafe();
      const log = runtime?.log as Logger | undefined;

      const aid = accountId ?? DEFAULT_ACCOUNT_ID;
      const bus = activeBuses.get(aid);
      if (!bus) {
        throw new Error(`IRC client not running for account ${aid}`);
      }

      try {
        // Simple text send - IRC doesn't need markdown table conversion
        const normalizedTo = formatTarget(to);
        await sendMessageIrc(bus, normalizedTo, text ?? "", log);
        return { channel: "irc", to: normalizedTo };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log?.error(`[${aid}] Failed to send message to ${to}: ${errorMessage}`);
        throw err;
      }
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts: Array<{ accountId?: string; lastError?: string }>) =>
      accounts.flatMap((account) => {
        const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
        if (!lastError) return [];
        return [
          {
            channel: "irc",
            accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
            kind: "runtime" as const,
            message: `Channel error: ${lastError}`,
          },
        ];
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      server: snapshot.server ?? null,
      nickname: snapshot.nickname ?? null,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      server: account.config.server,
      nickname: account.config.nickname,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },

  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;

      // Clean up any existing connection for this account
      const existingStop = stopCallbacks.get(account.accountId);
      if (existingStop) {
        try {
          existingStop();
        } catch {
          // Ignore cleanup errors
        }
        stopCallbacks.delete(account.accountId);
        activeBuses.delete(account.accountId);
      }

      ctx.setStatus({
        accountId: account.accountId,
        running: true,
      });

      const log = ctx.log as Logger | undefined;
      log?.info(
        `[${account.accountId}] Starting IRC provider (${account.config.nickname}@${account.config.server}:${account.config.port})`
      );

      if (!account.configured) {
        throw new Error("IRC server not configured");
      }

      const client = createIrcClient(
        account.accountId,
        account.config,
        () => {}, // onMessage handled by monitor
        (error) => {
          log?.error(`[${account.accountId}] IRC error: ${error.message}`);
        },
        log
      );

      // Set up inbound message handler with logging
      setupMonitor(client, async (message) => {
        log?.info(
          `[${account.accountId}] Message from ${message.senderId} in ${message.chatId}: ${message.text.slice(0, 100)}...`
        );

        try {
          // Build session key for this chat
          const isGroup = message.chatType === "group";
          const sessionKey = isGroup
            ? `irc:${account.accountId}:${message.chatId}`
            : `irc:${account.accountId}:${message.senderId}`;

          // Send to agent via WebSocket
          await sendToAgent(
            sessionKey,
            message.text,
            message.reply,
            log
          );
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log?.error(`[${account.accountId}] Failed to handle inbound message: ${errorMessage}`);

          // Send error message back to IRC
          try {
            await message.reply(`Error: ${errorMessage}`);
          } catch {
            // Ignore send errors
          }
        }
      }, log);

      activeBuses.set(account.accountId, client);

      try {
        await client.connect();
        log?.info(
          `[${account.accountId}] IRC provider started, connected as ${client.state.nickname}`
        );
      } catch (err) {
        activeBuses.delete(account.accountId);
        throw err;
      }

      // Create stop callback for cleanup
      const stop = () => {
        client.disconnect();
        activeBuses.delete(account.accountId);
        stopCallbacks.delete(account.accountId);
        log?.info(`[${account.accountId}] IRC provider stopped`);
      };

      // Track the stop callback for reload cleanup
      stopCallbacks.set(account.accountId, stop);

      return { stop };
    },
  },
};
