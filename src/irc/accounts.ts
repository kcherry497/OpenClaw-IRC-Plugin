import type { ResolvedIrcAccount, IrcAccountConfig } from "../types.js";

const accounts = new Map<string, ResolvedIrcAccount>();

export function registerAccount(
  accountId: string,
  name: string,
  enabled: boolean,
  configured: boolean,
  config: IrcAccountConfig
): ResolvedIrcAccount {
  const account: ResolvedIrcAccount = { accountId, name, enabled, configured, config };
  accounts.set(accountId, account);
  return account;
}

export function getAccount(accountId: string): ResolvedIrcAccount | undefined {
  return accounts.get(accountId);
}

export function getAllAccounts(): ResolvedIrcAccount[] {
  return Array.from(accounts.values());
}

export function removeAccount(accountId: string): boolean {
  return accounts.delete(accountId);
}

export function hasAccount(accountId: string): boolean {
  return accounts.has(accountId);
}

export function clearAccounts(): void {
  accounts.clear();
}

export function resolveAccountByNickname(nickname: string): ResolvedIrcAccount | undefined {
  const normalizedNick = nickname.toLowerCase();
  for (const account of accounts.values()) {
    if (account.config.nickname.toLowerCase() === normalizedNick) {
      return account;
    }
  }
  return undefined;
}

export function resolveAccountByServer(server: string): ResolvedIrcAccount | undefined {
  const normalizedServer = server.toLowerCase();
  for (const account of accounts.values()) {
    if (account.config.server.toLowerCase() === normalizedServer) {
      return account;
    }
  }
  return undefined;
}
