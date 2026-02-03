import { Client } from "irc-framework";
import type { ConnectOptions, PrivmsgEvent } from "irc-framework";
import type { IrcClientWrapper, IrcConnectionState, IrcAccountConfig, Logger } from "../types.js";

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 300000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Create an IRC client wrapper with connection management and event handling.
 *
 * @param accountId - Unique identifier for this account
 * @param config - IRC account configuration
 * @param onMessage - Callback for incoming messages
 * @param onError - Callback for errors
 * @param log - Optional logger for structured logging
 */
export function createIrcClient(
  accountId: string,
  config: IrcAccountConfig,
  onMessage: (event: PrivmsgEvent) => void,
  onError: (error: Error) => void,
  log?: Logger
): IrcClientWrapper {
  const client = new Client();

  const state: IrcConnectionState = {
    connected: false,
    registered: false,
    nickname: null,
    channels: new Set(),
    lastError: null,
    reconnectAttempts: 0,
  };

  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = true;
  let isDestroyed = false;

  const wrapper: IrcClientWrapper = {
    client,
    state,
    accountId,
    config,

    async connect(): Promise<void> {
      if (isDestroyed) {
        throw new Error("Client has been destroyed and cannot reconnect");
      }
      shouldReconnect = true;
      state.reconnectAttempts = 0;
      return doConnect();
    },

    disconnect(): void {
      shouldReconnect = false;
      isDestroyed = true;

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      if (state.connected) {
        try {
          client.quit("Goodbye");
        } catch {
          // Ignore errors during disconnect
        }
      }

      state.connected = false;
      state.registered = false;
      state.channels.clear();

      // Remove all listeners to prevent memory leaks
      client.removeAllListeners();
    },

    say(target: string, message: string): void {
      if (state.connected && state.registered) {
        client.say(target, message);
      }
    },

    join(channel: string): void {
      if (state.connected && state.registered) {
        client.join(channel);
      }
    },

    part(channel: string): void {
      if (state.connected && state.registered) {
        client.part(channel);
        state.channels.delete(channel.toLowerCase());
      }
    },
  };

  function doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (isDestroyed) {
        reject(new Error("Client has been destroyed"));
        return;
      }

      const connectOptions: ConnectOptions = {
        host: config.server,
        port: config.port,
        tls: config.ssl,
        nick: config.nickname,
        username: config.username || config.nickname,
        gecos: config.realname,
      };

      // SASL authentication (preferred)
      if (config.sasl) {
        connectOptions.account = {
          account: config.sasl.username,
          password: config.sasl.password,
        };
        log?.info(`[${accountId}] Using SASL authentication for ${config.sasl.username}`);
      } else if (config.nickservPassword) {
        // NickServ fallback - LOG SECURITY WARNING
        log?.warn(
          `[${accountId}] WARNING: Using NickServ authentication is insecure. ` +
          `The IDENTIFY command is sent as plain text and may be logged by the IRC server. ` +
          `Please migrate to SASL authentication for better security.`
        );
      }

      let resolved = false;

      client.on("registered", () => {
        state.connected = true;
        state.registered = true;
        state.nickname = client.user.nick;
        state.lastError = null;
        state.reconnectAttempts = 0;

        log?.info(`[${accountId}] Registered as ${state.nickname}`);

        // NickServ authentication fallback (with security warning already logged)
        if (config.nickservPassword && !config.sasl) {
          // Note: This is inherently insecure - password sent in plain text
          client.say("NickServ", `IDENTIFY ${config.nickservPassword}`);
        }

        for (const channel of config.channels) {
          log?.info(`[${accountId}] Joining ${channel}`);
          client.join(channel);
        }

        if (!resolved) {
          resolved = true;
          resolve();
        }
      });

      client.on("join", (event: { channel: string; nick: string }) => {
        if (event.nick === state.nickname) {
          state.channels.add(event.channel.toLowerCase());
          log?.info(`[${accountId}] Joined ${event.channel}`);
        }
      });

      client.on("part", (event: { channel: string; nick: string }) => {
        if (event.nick === state.nickname) {
          state.channels.delete(event.channel.toLowerCase());
          log?.info(`[${accountId}] Left ${event.channel}`);
        }
      });

      client.on("kick", (event: { channel: string; kicked: string; nick: string; message?: string }) => {
        if (event.kicked === state.nickname) {
          state.channels.delete(event.channel.toLowerCase());
          log?.warn(`[${accountId}] Kicked from ${event.channel} by ${event.nick}: ${event.message || "no reason"}`);
        }
      });

      client.on("privmsg", (event: PrivmsgEvent) => {
        onMessage(event);
      });

      client.on("nick", (event: { nick: string; new_nick: string }) => {
        if (event.nick === state.nickname) {
          state.nickname = event.new_nick;
          log?.info(`[${accountId}] Nick changed to ${event.new_nick}`);
        }
      });

      client.on("socket close", () => {
        const wasConnected = state.connected;
        state.connected = false;
        state.registered = false;
        state.channels.clear();

        if (wasConnected) {
          log?.warn(`[${accountId}] Connection closed`);
        }

        if (shouldReconnect && !isDestroyed) {
          scheduleReconnect();
        }
      });

      client.on("socket error", (err: Error) => {
        state.lastError = err.message;
        log?.error(`[${accountId}] Socket error: ${err.message}`);
        onError(err);
      });

      client.on("irc error", (event: { error: string; reason?: string }) => {
        state.lastError = event.reason || event.error;
        log?.error(`[${accountId}] IRC error: ${state.lastError}`);
        onError(new Error(state.lastError));

        if (!resolved) {
          resolved = true;
          reject(new Error(state.lastError));
        }
      });

      client.connect(connectOptions);
    });
  }

  function scheduleReconnect(): void {
    if (!shouldReconnect || isDestroyed || state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const message = `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`;
      log?.error(`[${accountId}] ${message}`);
      onError(new Error(message));
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, state.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );

    state.reconnectAttempts++;

    log?.info(`[${accountId}] Scheduling reconnect attempt ${state.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

    reconnectTimeout = setTimeout(async () => {
      if (isDestroyed) return;

      try {
        await doConnect();
        log?.info(`[${accountId}] Reconnected successfully`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log?.error(`[${accountId}] Reconnect failed: ${errorMessage}`);
        scheduleReconnect();
      }
    }, delay);
  }

  return wrapper;
}
