declare module "openclaw/plugin-sdk" {
  import { z } from "zod";

  export const DEFAULT_ACCOUNT_ID: string;

  export function formatPairingApproveHint(channel: string): string;

  export function buildChannelConfigSchema<T extends z.ZodTypeAny>(
    schema: T
  ): z.ZodType<z.infer<T>>;

  export function emptyPluginConfigSchema(): z.ZodType<Record<string, never>>;

  export interface ChannelMeta {
    id: string;
    label: string;
    selectionLabel: string;
    docsPath: string;
    docsLabel: string;
    blurb: string;
    order: number;
  }

  export interface ChannelCapabilities {
    chatTypes: Array<"direct" | "group" | "channel" | "thread">;
    media?: boolean;
    polls?: boolean;
    reactions?: boolean;
    threads?: boolean;
    nativeCommands?: boolean;
  }

  export interface ChannelConfigAdapter<TAccount> {
    listAccountIds: (cfg: unknown) => string[];
    resolveAccount: (cfg: unknown, accountId?: string) => TAccount;
    defaultAccountId: (cfg: unknown) => string;
    isConfigured: (account: TAccount) => boolean;
    describeAccount: (account: TAccount) => Record<string, unknown>;
    resolveAllowFrom?: (params: { cfg: unknown; accountId?: string }) => string[];
    formatAllowFrom?: (params: { allowFrom: string[] }) => string[];
    setAccountEnabled?: (params: {
      cfg: unknown;
      accountId: string;
      enabled: boolean;
    }) => unknown;
    deleteAccount?: (params: { cfg: unknown; accountId: string }) => unknown;
  }

  export interface ChannelPairingAdapter {
    idLabel: string;
    normalizeAllowEntry: (entry: string) => string;
    notifyApproval?: (params: { id: string }) => Promise<void>;
  }

  export interface DmPolicyResolution {
    policy: "open" | "pairing" | "disabled";
    allowFrom: string[];
    policyPath?: string;
    allowFromPath?: string;
    approveHint?: string;
    normalizeEntry?: (raw: string) => string;
  }

  export interface ChannelSecurityAdapter<TAccount> {
    resolveDmPolicy: (params: {
      cfg?: unknown;
      accountId?: string;
      account: TAccount;
    }) => DmPolicyResolution;
    collectWarnings?: (params: {
      account: TAccount;
      cfg: unknown;
    }) => string[];
  }

  export interface ChannelMessagingAdapter {
    normalizeTarget: (target: string) => string;
    targetResolver?: {
      looksLikeId: (input: string) => boolean;
      hint: string;
    };
  }

  export interface OutboundResult {
    channel: string;
    to?: string;
    messageId?: string;
  }

  export interface ChannelOutboundAdapter {
    deliveryMode: "direct" | "queue";
    textChunkLimit?: number;
    pollMaxOptions?: number;
    chunker?: unknown;
    sendText: (params: {
      to: string;
      text: string;
      accountId?: string;
      deps?: unknown;
      replyToId?: string;
    }) => Promise<OutboundResult>;
    sendMedia?: (params: {
      to: string;
      text: string;
      mediaUrl: string;
      accountId?: string;
      deps?: unknown;
      replyToId?: string;
    }) => Promise<OutboundResult>;
    sendPoll?: (params: {
      to: string;
      poll: unknown;
      accountId?: string;
    }) => Promise<OutboundResult>;
  }

  export interface RuntimeStatus {
    accountId: string;
    running: boolean;
    lastStartAt: number | null;
    lastStopAt: number | null;
    lastError: string | null;
    lastInboundAt?: number | null;
    lastOutboundAt?: number | null;
  }

  export interface StatusIssue {
    channel: string;
    accountId: string;
    kind: "runtime" | "config";
    message: string;
  }

  export interface ChannelStatusAdapter<TAccount> {
    defaultRuntime: RuntimeStatus;
    collectStatusIssues: (accounts: Array<Record<string, unknown>>) => StatusIssue[];
    buildChannelSummary: (params: { snapshot: Record<string, unknown> }) => Record<string, unknown>;
    buildAccountSnapshot: (params: {
      account: TAccount;
      runtime?: RuntimeStatus;
      probe?: unknown;
      audit?: unknown;
    }) => Record<string, unknown>;
    probeAccount?: (params: {
      account: TAccount;
      timeoutMs?: number;
    }) => Promise<unknown>;
    auditAccount?: (params: {
      account: TAccount;
      timeoutMs?: number;
      cfg?: unknown;
    }) => Promise<unknown>;
  }

  export interface GatewayContext<TAccount> {
    account: TAccount;
    cfg: unknown;
    runtime: unknown;
    abortSignal?: AbortSignal;
    log?: {
      debug?: (message: string, ...args: unknown[]) => void;
      info: (message: string, ...args: unknown[]) => void;
      warn: (message: string, ...args: unknown[]) => void;
      error: (message: string, ...args: unknown[]) => void;
    };
    setStatus: (status: Partial<RuntimeStatus>) => void;
  }

  export interface GatewayHandle {
    stop: () => void;
  }

  export interface ChannelGatewayAdapter<TAccount> {
    startAccount: (ctx: GatewayContext<TAccount>) => Promise<GatewayHandle>;
  }

  export interface ChannelPlugin<TAccount = unknown> {
    id: string;
    meta: ChannelMeta;
    capabilities: ChannelCapabilities;
    reload?: { configPrefixes: string[] };
    configSchema?: z.ZodType<unknown>;
    config: ChannelConfigAdapter<TAccount>;
    pairing?: ChannelPairingAdapter;
    security?: ChannelSecurityAdapter<TAccount>;
    groups?: unknown;
    mentions?: unknown;
    threading?: unknown;
    messaging?: ChannelMessagingAdapter;
    directory?: unknown;
    resolver?: unknown;
    actions?: unknown;
    setup?: unknown;
    outbound: ChannelOutboundAdapter;
    status: ChannelStatusAdapter<TAccount>;
    gateway: ChannelGatewayAdapter<TAccount>;
    streaming?: unknown;
    onboarding?: unknown;
  }

  export interface OpenClawPluginApi {
    runtime: unknown;
    registerChannel: <T>(params: { plugin: ChannelPlugin<T> }) => void;
  }
}
