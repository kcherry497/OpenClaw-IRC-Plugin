import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { z } from "zod";

import { ircPlugin, disconnectAll } from "./src/channel.js";
import { setRuntime, clearRuntime } from "./src/runtime.js";
import type { OpenClawRuntime } from "./src/runtime.js";

const ircPluginConfigSchema = z.object({}).optional();

const plugin = {
  id: "irc",
  name: "IRC",
  description: "IRC channel plugin with SASL+TLS authentication",
  configSchema: ircPluginConfigSchema,

  register(api: OpenClawPluginApi) {
    setRuntime(api.runtime as OpenClawRuntime);
    api.registerChannel({ plugin: ircPlugin });
  },

  /**
   * Called when the plugin is being unloaded or reloaded.
   * Cleans up all active connections to prevent leaks.
   */
  unload() {
    disconnectAll();
    clearRuntime();
  },
};

export default plugin;

// Export utilities for external use
export { disconnectAll } from "./src/channel.js";
export { getActiveClient } from "./src/channel.js";
export type { OpenClawRuntime } from "./src/runtime.js";
