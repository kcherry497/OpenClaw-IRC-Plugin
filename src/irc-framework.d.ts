declare module "irc-framework" {
  import { EventEmitter } from "events";

  export interface ConnectOptions {
    host: string;
    port: number;
    tls?: boolean;
    nick: string;
    username?: string;
    gecos?: string;
    account?: {
      account: string;
      password: string;
    };
    encoding?: string;
    version?: string;
    auto_reconnect?: boolean;
    auto_reconnect_wait?: number;
    auto_reconnect_max_retries?: number;
    ping_interval?: number;
    ping_timeout?: number;
  }

  export interface PrivmsgEvent {
    nick: string;
    ident: string;
    hostname: string;
    target: string;
    message: string;
    tags: Record<string, string>;
    reply: (message: string) => void;
  }

  export interface JoinEvent {
    channel: string;
    nick: string;
    ident: string;
    hostname: string;
    gecos: string;
    account: string | boolean;
    time: number;
  }

  export interface PartEvent {
    channel: string;
    nick: string;
    ident: string;
    hostname: string;
    message: string;
    time: number;
  }

  export interface KickEvent {
    channel: string;
    kicked: string;
    nick: string;
    ident: string;
    hostname: string;
    message: string;
    time: number;
  }

  export interface NickEvent {
    nick: string;
    new_nick: string;
    ident: string;
    hostname: string;
    time: number;
  }

  export interface ErrorEvent {
    error: string;
    reason?: string;
  }

  export interface User {
    nick: string;
    username: string;
    gecos: string;
    host: string;
    away: string;
    modes: Map<string, string>;
  }

  export interface Channel {
    name: string;
    users: Map<string, User>;
    join_time: number;
  }

  export class Client extends EventEmitter {
    user: User;

    constructor();

    connect(options: ConnectOptions): void;
    quit(message?: string): void;

    say(target: string, message: string): void;
    notice(target: string, message: string): void;
    action(target: string, message: string): void;
    ctcpRequest(target: string, type: string, params?: string): void;
    ctcpResponse(target: string, type: string, params?: string): void;

    join(channel: string, key?: string): void;
    part(channel: string, message?: string): void;

    whois(nick: string): void;
    who(target: string): void;

    raw(line: string): void;
    rawString(...args: string[]): string;

    changeNick(nick: string): void;

    on(event: "registered", listener: () => void): this;
    on(event: "connected", listener: () => void): this;
    on(event: "reconnecting", listener: () => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "socket close", listener: () => void): this;
    on(event: "socket error", listener: (error: Error) => void): this;
    on(event: "raw", listener: (event: { line: string; from_server: boolean }) => void): this;
    on(event: "privmsg", listener: (event: PrivmsgEvent) => void): this;
    on(event: "notice", listener: (event: PrivmsgEvent) => void): this;
    on(event: "action", listener: (event: PrivmsgEvent) => void): this;
    on(event: "join", listener: (event: JoinEvent) => void): this;
    on(event: "part", listener: (event: PartEvent) => void): this;
    on(event: "kick", listener: (event: KickEvent) => void): this;
    on(event: "nick", listener: (event: NickEvent) => void): this;
    on(event: "irc error", listener: (event: ErrorEvent) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export default {
    Client,
  };
}
