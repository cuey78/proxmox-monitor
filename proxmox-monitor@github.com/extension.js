/* Proxmox Server Monitor Extension
 * Compatible with GNOME 49+
 * Shows Proxmox server status with temperature monitoring
 * by cuey78 (modified for Proxmox monitoring)
 */

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ProxmoxMonitorExtension extends Extension {
    _indicator = null;
    _settings = null;
    _timeoutId = 0;
    _icon = null;
    _label = null;
    _menu = null;

    enable() {
        this._settings = this.getSettings();

        // Create indicator
        this._buildIndicator();

        // Add to panel
        Main.panel.addToStatusArea(
            'proxmox-monitor-indicator',
            this._indicator,
            1,
            this._getPanelPosition()
        );

        // Start refresh timer
        this._restartRefreshTimer();

        // Watch for settings changes
        this._settings.connect('changed', (settings, key) => {
            if (key === 'placement') {
                this._repositionIndicator();
            } else if (key === 'refresh-interval') {
                this._restartRefreshTimer();
            } else if (key.startsWith('server-')) {
                this._refreshStatus();
            }
        });
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }

    _buildIndicator() {
        this._indicator = new PanelMenu.Button(0.0, 'Proxmox Monitor');
        this._menu = this._indicator.menu;

        this._icon = new St.Icon({
            icon_name: 'computer-symbolic',
            style_class: 'system-status-icon',
        });

        this._label = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        box.add_child(this._icon);
        box.add_child(this._label);
        this._indicator.add_child(box);

        this._refreshStatus();
    }

    _getPanelPosition() {
        const placement = this._settings.get_string('placement');
        switch (placement) {
            case 'left':
                return 'left';
            case 'center':
                return 'center';
            case 'right':
                return 'right';
            default:
                return 'right';
        }
    }

    _restartRefreshTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const interval = this._settings.get_int('refresh-interval');
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this._refreshStatus();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _repositionIndicator() {
        if (!this._indicator)
            return;

        this._indicator.destroy();
        this._indicator = null;
        
        this._buildIndicator();

        Main.panel.addToStatusArea(
            'proxmox-monitor-indicator',
            this._indicator,
            1,
            this._getPanelPosition()
        );
    }

    _refreshStatus() {
        const host = this._settings.get_string('server-host');
        const port = this._settings.get_int('server-port');
        const username = this._settings.get_string('server-username');

        if (!host || !username) {
            this._label.set_text('Not Configured');
            this._icon.set_icon_name('computer-fail-symbolic');
            this._updateMenu(null);
            return;
        }

        this._executeSSHCommand(host, port, username, (success, data) => {
            if (success) {
                try {
                    const serverData = JSON.parse(data);
                    this._updateDisplay(serverData);
                } catch (e) {
                    this._label.set_text('Data Error');
                    this._icon.set_icon_name('computer-fail-symbolic');
                    this._updateMenu(null);
                    logError(e);
                }
            } else {
                this._label.set_text('Offline');
                this._icon.set_icon_name('computer-fail-symbolic');
                this._updateMenu(null);
            }
        });
    }

    _executeSSHCommand(host, port, username, callback) {
    const identityFile = this._settings.get_string('server-identity-file');
    const remoteCommand = 'bash /tmp/proxmox-monitor.sh';

    let sshArgs = ['ssh', '-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes'];

    if (identityFile && identityFile.trim() !== '')
        sshArgs.push('-i', identityFile);

    if (port && port !== 22)
        sshArgs.push('-p', port.toString());

    sshArgs.push(`${username}@${host}`, remoteCommand);

    try {
        // Create a subprocess — runs completely async
        const proc = new Gio.Subprocess({
            argv: sshArgs,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });

        proc.init(null);

        // Read output asynchronously to avoid blocking the GNOME Shell main loop
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                const [ok, stdout, stderr] = proc.communicate_utf8_finish(res);

                if (!ok || proc.get_exit_status() !== 0) {
                    logError(new Error(`SSH failed: ${stderr.trim()}`));
                    callback(false, null);
                    return;
                }

                const data = stdout.trim();
                if (data.length === 0) {
                    log('Proxmox Monitor: Empty SSH output');
                    callback(false, null);
                    return;
                }

                callback(true, data);
            } catch (e) {
                logError(e);
                callback(false, null);
            }
        });
    } catch (e) {
        logError(e);
        callback(false, null);
    }
}


    _updateDisplay(serverData) {
        if (!serverData) {
            this._label.set_text('No Data');
            this._icon.set_icon_name('computer-fail-symbolic');
            return;
        }

        const hostname = serverData.system_info.hostname;
        const cpuTemp = serverData.cpu_temp;
        
        // Truncate long hostnames for panel display
        const displayName = hostname.length > 12 ? hostname.substring(0, 12) + '...' : hostname;
        this._label.set_text(displayName);
        
        // Set icon based on temperatures
        let iconName = 'computer-symbolic';
        
        // Check CPU temperature
        if (cpuTemp !== null && cpuTemp > 80) {
            iconName = 'computer-fail-symbolic';
        } else if (cpuTemp !== null && cpuTemp > 60) {
            iconName = 'computer-warning-symbolic';
        } else {
            // Check HDD temperatures (filter out unrealistic temps)
            const validHddTemps = serverData.hdd_temps.filter(hdd => hdd.temp < 100);
            const highHddTemp = validHddTemps.some(hdd => hdd.temp > 50);
            if (highHddTemp) {
                iconName = 'computer-warning-symbolic';
            }
        }
        
        this._icon.set_icon_name(iconName);
        this._updateMenu(serverData);
    }

    _updateMenu(serverData) {
        // Clear existing menu items
        this._menu.removeAll();

        if (!serverData) {
            const item = new PopupMenu.PopupMenuItem('No server data available');
            this._menu.addMenuItem(item);
            return;
        }

        const sysInfo = serverData.system_info;
        const cpuTemp = serverData.cpu_temp;
        const hddTemps = serverData.hdd_temps;

        // Server header
        const header = new PopupMenu.PopupMenuItem(sysInfo.hostname);
        header.label.clutter_text.set_markup(`<b>${sysInfo.hostname}</b>`);
        this._menu.addMenuItem(header);

        // Uptime
        const uptimeItem = new PopupMenu.PopupMenuItem(`Uptime: ${sysInfo.uptime}`);
        this._menu.addMenuItem(uptimeItem);

        // Load average
        const loadParts = sysInfo.load.split(',');
        const loadItem = new PopupMenu.PopupMenuItem(`Load: ${loadParts[0]}, ${loadParts[1]}, ${loadParts[2]}`);
        this._menu.addMenuItem(loadItem);

        // Memory usage - convert from KB to GB for better readability
        const memoryUsedGB = (sysInfo.memory_used / 1024 / 1024).toFixed(1);
        const memoryTotalGB = (sysInfo.memory_total / 1024 / 1024).toFixed(1);
        const memoryPercent = Math.round((sysInfo.memory_used / sysInfo.memory_total) * 100);
        const memoryItem = new PopupMenu.PopupMenuItem(`Memory: ${memoryUsedGB}GB / ${memoryTotalGB}GB (${memoryPercent}%)`);
        this._menu.addMenuItem(memoryItem);

        // CPU Temperature
        const cpuItem = new PopupMenu.PopupMenuItem(`CPU Temp: ${cpuTemp !== null ? cpuTemp + '°C' : 'N/A'}`);
        this._menu.addMenuItem(cpuItem);

        // HDD Temperatures
        const hddHeader = new PopupMenu.PopupMenuItem('HDD Temperatures:');
        this._menu.addMenuItem(hddHeader);
        
        // Filter out unrealistic temperatures
        const validHddTemps = hddTemps.filter(hdd => hdd.temp < 100);
        
        if (validHddTemps.length === 0) {
            const noHddItem = new PopupMenu.PopupMenuItem('  No HDD data available');
            this._menu.addMenuItem(noHddItem);
        } else {
            for (const hdd of validHddTemps) {
                const status = hdd.temp > 45 ? '⚠️' : '✓';
                const hddItem = new PopupMenu.PopupMenuItem(`  ${hdd.drive}: ${hdd.temp}°C ${status}`);
                this._menu.addMenuItem(hddItem);
            }
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Last update time
        const updateTime = new Date(serverData.timestamp).toLocaleTimeString();
        const timeItem = new PopupMenu.PopupMenuItem(`Last update: ${updateTime}`);
        this._menu.addMenuItem(timeItem);
    }
}
