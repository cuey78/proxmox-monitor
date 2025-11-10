# 🧠 Proxmox Server Monitor (GNOME Extension)

**Proxmox Server Monitor** is a GNOME Shell extension that displays real-time system information from a remote **Proxmox server** — including CPU temperature, disk temperatures, memory usage, and uptime — directly in your top panel.

It communicates securely over SSH and updates at regular intervals, so you can keep an eye on your Proxmox host without opening the web UI.

--- Work in Progress - personal use but feel free to fork it 

## ✨ Features

- 📡 Connects to your Proxmox server over SSH  
- 🧊 Displays CPU temperature, HDD temperatures, load averages, memory use, and uptime  
- 🔁 Configurable refresh interval  
- 🧩 Customizable panel placement (left, center, right)  
- ⚙️ key-based authentication using your SSH private key  
- 🧠 Asynchronous SSH execution — **no more UI lag or freezes**  
- 🕐 Tooltip + popup menu with full server stats and last update time  

---

## 🧰 Requirements

### On your Fedora (client) system
- GNOME Shell 48, 49, or newer  
- `ssh` command available  
- A working SSH key that allows passwordless login to your Proxmox server  
- The `gnome-shell-extension-manager` tool to configure the extension

### On your Proxmox (server)
- `smartmontools` *(for SMART disk temps)*
- `lm_sensors` *(for CPU temps)*
- `hddtemp-lt` for extended disk support - https://github.com/slowpeek/hddtemp

---

## ⚙️ Setup Instructions

Step 1: Deploy the Monitoring Script
scp proxmox-monitor.sh root@your-proxmox-server:/tmp/
ssh root@your-proxmox-server "chmod +x /tmp/proxmox-monitor.sh"

Step 2: Set Up Passwordless SSH Authentication
# Edit the setup script with your server details first
nano setup_proxmox_ssh.sh

# Make executable and run
chmod +x setup_proxmox_ssh.sh
./setup_proxmox_ssh.sh

Step 3: Install the GNOME Extension
cp -r proxmox-monitor@github.com ~/.local/share/gnome-shell/extensions/

Step 4: Activate the Extension
- Log out and log back into your GNOME session
- Open the Extensions application
- Enable "Proxmox Server Monitor"

Step 5: Configure Connection Settings
- Open extension settings
- Enter your Proxmox server details
- Server Host: Your Proxmox server IP/hostname
- SSH Port: (default: 22)
- Username: SSH username (usually 'root')
- Identity File: Path to SSH private key (if using custom key)
