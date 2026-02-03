/**
 * Runtime context management for the IRC plugin.
 * Provides typed access to the OpenClaw runtime API.
 */

/**
 * OpenClaw runtime interface - typed subset of the plugin API.
 * This replaces the previous `any` types for better type safety.
 */
export interface OpenClawRuntime {
  config: {
    loadConfig(): unknown;
  };
  channel: {
    text: {
      resolveMarkdownTableMode(params: {
        cfg: unknown;
        channel: string;
        accountId: string;
      }): string;
      convertMarkdownTables(text: string, mode: string): string;
    };
    reply: {
      handleInboundMessage(params: {
        channel: string;
        accountId: string;
        senderId: string;
        chatType: "direct" | "group";
        chatId: string;
        text: string;
        reply: (text: string) => Promise<void>;
      }): Promise<void>;
    };
  };
  log?: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
  };
}

let runtimeInstance: OpenClawRuntime | null = null;

/**
 * Set the runtime instance. Called during plugin registration.
 */
export function setRuntime(runtime: OpenClawRuntime): void {
  runtimeInstance = runtime;
}

/**
 * Get the runtime instance. Throws if not initialized.
 * Use hasRuntime() to check before calling if you need to handle the missing case.
 */
export function getRuntime(): OpenClawRuntime {
  if (!runtimeInstance) {
    throw new Error("IRC plugin runtime not initialized - ensure plugin is properly registered");
  }
  return runtimeInstance;
}

/**
 * Safely get the runtime instance, returning null if not initialized.
 * Prefer this over getRuntime() when the missing runtime case needs handling.
 */
export function getRuntimeSafe(): OpenClawRuntime | null {
  return runtimeInstance;
}

/**
 * Check if the runtime has been initialized.
 */
export function hasRuntime(): boolean {
  return runtimeInstance !== null;
}

/**
 * Clear the runtime instance. Called during plugin cleanup/reload.
 */
export function clearRuntime(): void {
  runtimeInstance = null;
}
