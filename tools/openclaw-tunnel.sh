#!/bin/bash
# OpenClaw SSH Tunnel Launcher
# Creates SSH tunnel to remote server and opens the dashboard

# === CONFIGURATION - Edit these values ===
REMOTE_HOST="user@your-server"    # SSH destination (e.g., user@192.168.1.100)
LOCAL_PORT=18789                   # Local port for tunnel
REMOTE_PORT=18789                  # Remote port where OpenClaw listens
# =========================================

DASHBOARD_URL="http://127.0.0.1:${LOCAL_PORT}/__openclaw__/dashboard/"

# Check if tunnel already exists
if ss -tln | grep -q ":${LOCAL_PORT}"; then
    echo "Tunnel already active on port ${LOCAL_PORT}"
else
    echo "Starting SSH tunnel to ${REMOTE_HOST}..."
    ssh -f -N -L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT} ${REMOTE_HOST}
    sleep 2
fi

# Verify tunnel is up
if ss -tln | grep -q ":${LOCAL_PORT}"; then
    echo "Tunnel active, launching browser..."
    # Launch browser in app mode - adjust command for your browser
    # Examples:
    #   Firefox:  firefox --new-window "${DASHBOARD_URL}"
    #   Chrome:   google-chrome --app="${DASHBOARD_URL}"
    #   Chromium: chromium --app="${DASHBOARD_URL}"
    #   Flatpak:  flatpak run com.google.Chrome --app="${DASHBOARD_URL}"
    xdg-open "${DASHBOARD_URL}" 2>/dev/null &
else
    echo "ERROR: Failed to establish tunnel"
    notify-send -u critical "OpenClaw" "Failed to establish SSH tunnel"
    exit 1
fi
