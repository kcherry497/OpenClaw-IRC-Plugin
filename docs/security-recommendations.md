# Security Recommendations

This document provides specific guidance for securing your OpenClaw IRC deployment.

## Network Security

### Inbound Firewall Rules

If running your own IRC server, restrict access to the IRC port to authorized IPs only:

```bash
# Allow from specific IP
iptables -A INPUT -p tcp --dport 6667 -s YOUR.IP.HERE -j ACCEPT

# Allow from VPN subnet
iptables -A INPUT -p tcp --dport 6667 -s 10.0.0.0/24 -j ACCEPT

# Drop all other traffic to this port
iptables -A INPUT -p tcp --dport 6667 -j DROP
```

For TLS connections (recommended):

```bash
iptables -A INPUT -p tcp --dport 6697 -s YOUR.IP.HERE -j ACCEPT
iptables -A INPUT -p tcp --dport 6697 -j DROP
```

### VPN Integration

For access from dynamic IPs or multiple locations:

1. Deploy a VPN server (WireGuard recommended for simplicity)
2. Configure MFA on VPN authentication
3. Allow the VPN subnet in your firewall rules
4. Access OpenClaw only through the VPN tunnel

Example WireGuard server config snippet:

```ini
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <server-private-key>

[Peer]
PublicKey = <client-public-key>
AllowedIPs = 10.0.0.2/32
```

### Egress Filtering

Restrict outbound connections to required destinations:

```bash
# Allow DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT

# Allow Anthropic API
iptables -A OUTPUT -p tcp -d api.anthropic.com --dport 443 -j ACCEPT

# Allow IRC server (if using external)
iptables -A OUTPUT -p tcp -d irc.libera.chat --dport 6697 -j ACCEPT

# Allow established connections
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Drop everything else (adjust based on your needs)
iptables -A OUTPUT -j DROP
```

## IRC Security

### Use TLS

Always use TLS for IRC connections. Most servers support TLS on port 6697.

```json
{
  "server": "irc.example.com",
  "port": 6697,
  "ssl": true
}
```

### Use SASL Authentication

SASL sends credentials securely during connection, before joining channels. Never use plaintext NickServ authentication.

```json
{
  "sasl": {
    "username": "your-nick",
    "password": "your-password"
  }
}
```

### Channel Security

For private deployments, consider:

1. **Private channel with key:**
   ```
   /mode #yourchannel +k secretkey
   ```

2. **Invite-only channel:**
   ```
   /mode #yourchannel +i
   ```

3. **Registered users only:**
   ```
   /mode #yourchannel +r
   ```

### Self-Hosted IRC Server

For maximum control, run your own IRC server on the same host or local network as OpenClaw. This eliminates external network exposure entirely.

## API Key Protection

- Never commit API keys to the repository
- Use environment variables or a config file excluded from git
- Ensure the config file has restricted permissions:
  ```bash
  chmod 600 ~/.openclaw/openclaw.json
  ```

## SSH Tunnel Access

The included `tools/openclaw-tunnel.sh` script provides secure remote access via SSH tunnel:

1. Edit the script to set your server details
2. Run the script to establish tunnel and open dashboard
3. All traffic is encrypted through SSH

## Monitoring

Consider logging and monitoring:

- IRC connection events
- Failed authentication attempts
- Unusual message patterns
- API usage and costs

## For More Information

See the full [KISS Security for OpenClaw](kiss-security.md) whitepaper for the philosophy behind this security model.
