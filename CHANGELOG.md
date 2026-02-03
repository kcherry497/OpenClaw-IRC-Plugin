# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-03

### Added
- **Access control enforcement** for DM and channel messages
  - DM policies: `disabled`, `pairing`, `open`
  - Channel policies: `allowlist`, `denylist`, `all`
  - Wildcard (`*`) support for allowing all users
- **Per-user rate limiting** to prevent abuse
  - Default: 5 requests per 60 seconds per user
  - Configurable via `rateLimit.maxRequests` and `rateLimit.windowMs`
  - Users notified once when rate limited
- **Error reference IDs** for troubleshooting
  - Generic error messages sent to IRC users
  - Full error details (including stack traces) logged server-side
  - Reference IDs correlate user-facing errors to server logs
- New `allowInsecureNickServ` config option for explicit opt-in to plaintext auth
- Comprehensive test suites for authorization and rate limiting (28 new tests)

### Changed
- NickServ authentication now requires `allowInsecureNickServ: true` to use
  - Previously would fall back automatically with only a warning
  - Now logs an error and refuses to authenticate unless explicitly enabled

### Security
- Fixed missing access control enforcement (policies were defined but not checked)
- Added rate limiting to prevent API abuse and cost runaway
- Sanitized error messages to prevent information disclosure

## [1.0.0] - 2026-02-03

### Added
- Initial release of OpenClaw IRC plugin
- SASL PLAIN authentication over TLS (recommended)
- NickServ authentication fallback (with security warning)
- Auto-join configured channels
- Send/receive messages (channels and DMs)
- Mention detection (@botname)
- Message chunking for IRC's 512-byte message limit
- Reconnection with exponential backoff
- Message sanitization (strips IRC formatting/control characters)
- CTCP ACTION support (/me messages)
- Multi-account support
- Comprehensive test suite
- Documentation and KISS security whitepaper
- SSH tunnel helper script for secure remote access

[1.1.0]: https://github.com/kcherry497/OpenClaw-IRC-Plugin/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/kcherry497/OpenClaw-IRC-Plugin/releases/tag/v1.0.0
