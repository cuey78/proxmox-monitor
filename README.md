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
- `hddtemp-lt` for extended disk support

---

## ⚙️ Setup Instructions

scp the proxmox-monitor.sh to your servers /tmp dir 
you need a passwordless ssh key setup a script is inclued to do this -  setup_proxmox_ssh.sh will need to edit user and server details inside the script
copy the proxmox-monitor@github.com folder to your /home/user/.local/share/gnome-shell/extensions
log out and back in and enable in extension manager enter details in the settings
