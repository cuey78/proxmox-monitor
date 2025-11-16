#!/bin/bash
#
# Automate SSH key setup for Proxmox Monitor GNOME Extension
#

set -e
#Fillin your server Details
# === CONFIG ===
SSH_USER=""
SSH_HOST=""
SSH_PORT="22"
SSH_KEY="$HOME/.ssh/"
# ==============

echo "🔧 Setting up SSH key for $SSH_USER@$SSH_HOST..."

# Generate key if missing
if [ ! -f "$SSH_KEY" ]; then
    echo "🗝️  No key found at $SSH_KEY — generating new one..."
    ssh-keygen -t ed25519 -f "$SSH_KEY" -C "proxmox-monitor" -N ""
else
    echo "✅ SSH key already exists: $SSH_KEY"
fi

# Copy public key to server
echo "📤 Copying public key to $SSH_USER@$SSH_HOST..."
if ! command -v ssh-copy-id >/dev/null 2>&1; then
    echo "⚠️  ssh-copy-id not found, using manual copy method..."
    cat "${SSH_KEY}.pub" | ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" \
        'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys'
else
    ssh-copy-id -i "${SSH_KEY}.pub" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST"
fi

# Test connection
echo "🔍 Testing passwordless SSH..."
if ssh -i "$SSH_KEY" -p "$SSH_PORT" -o BatchMode=yes -o ConnectTimeout=5 "$SSH_USER@$SSH_HOST" "echo connection OK" 2>/dev/null | grep -q "connection OK"; then
    echo "✅ Passwordless SSH setup successful!"
    echo ""
    echo "➡️  Use these values in your GNOME extension settings:"
    echo "   • Server Host: $SSH_HOST"
    echo "   • Server Port: $SSH_PORT"
    echo "   • Server Username: $SSH_USER"
    echo "   • Identity File: $SSH_KEY"
else
    echo "❌ Passwordless SSH test failed."
    echo "   Check that ~/.ssh/authorized_keys exists on $SSH_HOST and permissions are correct."
    exit 1
fi
