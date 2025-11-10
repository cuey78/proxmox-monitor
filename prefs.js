import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ProxmoxMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // General page
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(generalPage);

        // Appearance group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure how the indicator appears'),
        });
        generalPage.add(appearanceGroup);

        // Placement row
        const placementRow = new Adw.ComboRow({
            title: _('Panel Placement'),
            subtitle: _('Where to show the indicator in the panel'),
        });
        
        const placementModel = new Gtk.StringList();
        placementModel.append('Left');
        placementModel.append('Center');
        placementModel.append('Right');
        placementRow.set_model(placementModel);
        
        // Connect to placement changes
        placementRow.connect('notify::selected', () => {
            const selected = placementRow.get_selected();
            let value;
            switch (selected) {
                case 0: value = 'left'; break;
                case 1: value = 'center'; break;
                case 2: value = 'right'; break;
                default: value = 'right';
            }
            settings.set_string('placement', value);
        });
        
        // Set initial selection based on current setting
        const currentPlacement = settings.get_string('placement');
        let initialSelection = 2; // default to right
        switch (currentPlacement) {
            case 'left': initialSelection = 0; break;
            case 'center': initialSelection = 1; break;
            case 'right': initialSelection = 2; break;
        }
        placementRow.set_selected(initialSelection);
        
        appearanceGroup.add(placementRow);

        // Behavior group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Configure how the indicator behaves'),
        });
        generalPage.add(behaviorGroup);

        // Refresh interval row
        const refreshRow = new Adw.SpinRow({
            title: _('Refresh Interval'),
            subtitle: _('Seconds between server status checks'),
            adjustment: new Gtk.Adjustment({
                value: 300,
                lower: 30,
                upper: 3600,
                step_increment: 30,
            }),
        });
        behaviorGroup.add(refreshRow);

        // Server Configuration page
        const serverPage = new Adw.PreferencesPage({
            title: _('Server Configuration'),
            icon_name: 'network-server-symbolic',
        });
        window.add(serverPage);

        const serverGroup = new Adw.PreferencesGroup({
            title: _('Proxmox Server Settings'),
            description: _('Configure connection to your Proxmox server'),
        });
        serverPage.add(serverGroup);

        // Server host
        const hostRow = new Adw.EntryRow({
            title: _('Server Host'),
        });
        hostRow.set_show_apply_button(true);
        serverGroup.add(hostRow);

        // Server port
        const portRow = new Adw.SpinRow({
            title: _('SSH Port'),
            subtitle: _('SSH port (default: 22)'),
            adjustment: new Gtk.Adjustment({
                value: 22,
                lower: 1,
                upper: 65535,
                step_increment: 1,
            }),
        });
        serverGroup.add(portRow);

        // Username
        const usernameRow = new Adw.EntryRow({
            title: _('Username'),
        });
        usernameRow.set_show_apply_button(true);
        serverGroup.add(usernameRow);

        // Password (optional - prefer key-based auth)
        const passwordRow = new Adw.PasswordEntryRow({
            title: _('Password'),
        });
        passwordRow.set_show_apply_button(true);
        serverGroup.add(passwordRow);

        // Identity file - use ActionRow with Entry for subtitle support
        const identityRow = new Adw.ActionRow({
            title: _('Identity File'),
            subtitle: _('Path to SSH private key file (optional)'),
        });
        const identityEntry = new Gtk.Entry();
        identityEntry.set_hexpand(true);
        identityRow.add_suffix(identityEntry);
        identityRow.set_activatable_widget(identityEntry);
        serverGroup.add(identityRow);

        // Test connection button
        const testButton = new Gtk.Button({
            label: _('Test Connection'),
            halign: Gtk.Align.CENTER,
            margin_top: 12,
        });
        
        testButton.connect('clicked', () => {
            this._testConnection(settings, window);
        });
        
        const testButtonRow = new Adw.ActionRow();
        testButtonRow.add_suffix(testButton);
        testButtonRow.set_activatable_widget(testButton);
        serverGroup.add(testButtonRow);

        // Bind all settings
        settings.bind('refresh-interval', refreshRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('server-host', hostRow, 'text',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('server-port', portRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('server-username', usernameRow, 'text',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('server-password', passwordRow, 'text',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('server-identity-file', identityEntry, 'text',
            Gio.SettingsBindFlags.DEFAULT);
    }

    _testConnection(settings, window) {
        const host = settings.get_string('server-host');
        const port = settings.get_int('server-port');
        const username = settings.get_string('server-username');
        const identityFile = settings.get_string('server-identity-file');

        if (!host || !username) {
            this._showTestResult(false, 'Please fill in Server Host and Username', window);
            return;
        }

        // Build SSH command
        let sshCommand = ['ssh', '-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes', '-o', 'PasswordAuthentication=no'];
        
        if (identityFile && identityFile.trim() !== '') {
            sshCommand.push('-i', identityFile);
        }
        
        if (port && port !== 22) {
            sshCommand.push('-p', port.toString());
        }
        
        const connection = `${username}@${host}`;
        const remoteCommand = 'echo "Connection successful"';
        
        sshCommand.push(connection, remoteCommand);
        
        const command = sshCommand.join(' ');

        try {
            const [success, stdout, stderr] = GLib.spawn_command_line_sync(command);
            
            if (success) {
                const output = new TextDecoder().decode(stdout);
                if (output && output.includes('Connection successful')) {
                    this._showTestResult(true, 'Connection successful!', window);
                } else {
                    this._showTestResult(false, 'Connection failed: No response', window);
                }
            } else {
                const error = new TextDecoder().decode(stderr);
                this._showTestResult(false, `Connection failed: ${error}`, window);
            }
        } catch (e) {
            this._showTestResult(false, `Connection error: ${e.message}`, window);
        }
    }

    _showTestResult(success, message, window) {
        const dialog = new Gtk.MessageDialog({
            transient_for: window,
            modal: true,
            buttons: Gtk.ButtonsType.OK,
            message_type: success ? Gtk.MessageType.INFO : Gtk.MessageType.ERROR,
            text: success ? 'Connection Test Successful' : 'Connection Test Failed',
            secondary_text: message,
        });

        dialog.connect('response', () => {
            dialog.destroy();
        });

        dialog.present();
    }
}
