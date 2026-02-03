# Installation Guide

## Prerequisites

- Node.js 18.0.0 or later
- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- Anthropic API key
- IRC server access (public or self-hosted)

## Quick Start

### 1. Install the Plugin

```bash
# Clone the repository
git clone https://github.com/openclaw/openclaw-irc.git ~/.openclaw/extensions/irc

# Install dependencies
cd ~/.openclaw/extensions/irc
npm install --production

# Build
npm run build
```

### 2. Configure OpenClaw

Add the IRC channel configuration to `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "irc": {
      "enabled": true,
      "server": "irc.libera.chat",
      "port": 6697,
      "ssl": true,
      "nickname": "your-bot-nick",
      "username": "your-bot-nick",
      "realname": "OpenClaw IRC Agent",
      "sasl": {
        "username": "your-registered-nick",
        "password": "your-nickserv-password"
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

### 3. Start OpenClaw

```bash
openclaw start
```

The bot should connect to IRC and join your configured channels.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the IRC channel |
| `server` | string | required | IRC server hostname |
| `port` | number | `6697` | IRC server port |
| `ssl` | boolean | `true` | Use TLS/SSL connection |
| `nickname` | string | required | Bot nickname (max 16 chars) |
| `username` | string | nickname | IRC username |
| `realname` | string | `"OpenClaw IRC Agent"` | Real name / GECOS |
| `sasl.username` | string | - | SASL username |
| `sasl.password` | string | - | SASL password |
| `channels` | string[] | `[]` | Channels to auto-join |
| `dm.policy` | string | `"pairing"` | DM policy: `open`, `pairing`, `disabled` |
| `dm.allowFrom` | string[] | `[]` | Allowed DM senders (when policy is `pairing`) |
| `groupPolicy` | string | `"allowlist"` | Group policy: `allowlist`, `denylist`, `all` |
| `groups` | object | `{}` | Per-channel user configurations |

## Authentication

### SASL Authentication (Recommended)

Always use SASL authentication when available. SASL credentials are sent securely during the connection handshake before you join any channels.

```json
{
  "sasl": {
    "username": "your-nick",
    "password": "your-password"
  }
}
```

### Self-Hosted IRC Server

For maximum security, consider running your own IRC server. Popular options:

- [InspIRCd](https://www.inspircd.org/) - Modular, feature-rich
- [UnrealIRCd](https://www.unrealircd.org/) - Widely used, well-documented
- [Ergo](https://ergo.chat/) - Modern, Go-based, easy to configure

## DM Policies

| Policy | Description |
|--------|-------------|
| `disabled` | No direct messages accepted |
| `pairing` | Users must be in `allowFrom` list to DM (recommended) |
| `open` | Anyone can DM the bot (use with caution) |

## Verifying the Installation

1. Check OpenClaw logs for successful IRC connection
2. Join your configured channel with an IRC client
3. Send a message mentioning the bot: `@botname hello`
4. The bot should respond

## Troubleshooting

### Bot doesn't connect

- Verify server hostname and port
- Check if TLS is required (most servers use port 6697 for TLS)
- Ensure SASL credentials are correct
- Check firewall rules allow outbound connections

### Bot connects but doesn't respond

- Verify the bot joined the channel (check channel user list)
- Check if you're in the allowed users list
- Review OpenClaw logs for errors

### SASL authentication fails

- Double-check username and password
- Ensure the nick is registered with NickServ
- Some servers require the SASL username to match the nickname

## Next Steps

- Read [Security Recommendations](security-recommendations.md) to harden your deployment
- Review the [KISS Security Whitepaper](kiss-security.md) for the security philosophy
