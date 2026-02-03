# OpenClaw IRC

An IRC interface for [OpenClaw](https://github.com/openclaw/openclaw), enabling access to Claude AI through standard IRC clients.

## Why IRC?

- **Minimal attack surface** - No browser, no JavaScript supply chain, no WebSocket complexity
- **Mature protocol** - Decades of stability, well-understood security model
- **Universal client support** - Works with any IRC client on any platform
- **Simple access control** - Firewall at Layer 3, authenticate via VPN if needed

This project is part of a broader philosophy of securing self-hosted AI services through simplicity rather than complexity. See the [KISS Security for OpenClaw](docs/kiss-security.md) whitepaper for the full rationale.

## Features

- SASL PLAIN authentication over TLS (recommended)
- Auto-join configured channels
- Send/receive messages (channels and DMs)
- Mention detection (@botname)
- Message chunking for IRC's message length limits
- Reconnection with exponential backoff
- Message sanitization (strips IRC formatting/control characters)
- CTCP ACTION support (/me messages)
- Multi-account support
- Comprehensive test suite

## Requirements

- [OpenClaw](https://github.com/openclaw/openclaw) instance
- IRC server (public like Libera.Chat, or self-hosted)
- Anthropic API key configured in OpenClaw

## Installation

### From Local Path

```bash
# Copy to OpenClaw extensions directory
cp -r . ~/.openclaw/extensions/irc
cd ~/.openclaw/extensions/irc
npm install --production
```

### From npm (after publishing)

```bash
openclaw plugins install @openclaw/irc
```

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "irc": {
      "enabled": true,
      "server": "irc.libera.chat",
      "port": 6697,
      "ssl": true,
      "nickname": "openclaw",
      "username": "openclaw",
      "realname": "OpenClaw IRC Agent",
      "sasl": {
        "username": "openclaw",
        "password": "your-password"
      },
      "channels": ["#your-channel"],
      "dm": {
        "policy": "pairing",
        "allowFrom": []
      },
      "groupPolicy": "allowlist",
      "groups": {
        "#your-channel": {
          "users": ["*"]
        }
      }
    }
  }
}
```

See [docs/installation.md](docs/installation.md) for detailed configuration options.

## Security Model

This plugin is designed to be deployed behind network-layer security controls:

1. **Firewall inbound** - Permit only authorized source IPs
2. **VPN for remote access** - Authenticate at the network layer with MFA
3. **Egress filtering** - Restrict outbound to required destinations only
4. **No exposed authentication endpoints** - The service is simply unreachable to attackers

For detailed security guidance, see [KISS Security for OpenClaw](docs/kiss-security.md).

## Documentation

- [Installation Guide](docs/installation.md)
- [Security Recommendations](docs/security-recommendations.md)
- [KISS Security Whitepaper](docs/kiss-security.md)

## Tools

The `tools/` directory contains helper scripts:

- `openclaw-tunnel.sh` - SSH tunnel launcher for secure remote access
- `openclaw.desktop` - Linux desktop entry for PWA-style access
- `openclaw-icon.png` - Application icon

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Contributing

Contributions welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT License - see [LICENSE](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=kcherry/OpenClaw-IRC-Plugin&type=Date)](https://star-history.com/#kcherry/OpenClaw-IRC-Plugin&Date)

## Links

- [OpenClaw Project](https://github.com/openclaw/openclaw)
- [Project Documentation](docs/)
