
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ProxmoxMonitorPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'Proxmox Server Settings',
        });
        page.add(group);

        // Host entry
        const hostRow = new Adw.EntryRow({
            title: 'Server Host',
        });
        hostRow.set_text(settings.get_string('server-host'));
        hostRow.connect('changed', () => settings.set_string('server-host', hostRow.get_text()));
        group.add(hostRow);

        // Username entry
        const userRow = new Adw.EntryRow({
            title: 'SSH Username',
        });
        userRow.set_text(settings.get_string('server-username'));
        userRow.connect('changed', () => settings.set_string('server-username', userRow.get_text()));
        group.add(userRow);

        // Port entry
        const portRow = new Adw.SpinRow({
            title: 'SSH Port',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 65535,
                step_increment: 1,
                value: settings.get_int('server-port'),
            }),
        });
        portRow.connect('notify::value', () => settings.set_int('server-port', portRow.get_value()));
        group.add(portRow);

        // Identity file
        const identityRow = new Adw.EntryRow({
            title: 'Identity File',
        });
        identityRow.set_text(settings.get_string('server-identity-file'));
        identityRow.connect('changed', () => settings.set_string('server-identity-file', identityRow.get_text()));
        group.add(identityRow);

        // Panel Placement selector
        const placementRow = new Adw.ComboRow({
            title: 'Panel Placement',
            model: Gtk.StringList.new(['left', 'center', 'right']),
            selected: ['left', 'center', 'right'].indexOf(settings.get_string('placement')),
        });
        placementRow.connect('notify::selected', () => {
            const val = ['left', 'center', 'right'][placementRow.get_selected()];
            settings.set_string('placement', val);
        });
        group.add(placementRow);

        // Refresh interval spinbox
        const intervalRow = new Adw.SpinRow({
            title: 'Refresh Interval (seconds)',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 3600,
                step_increment: 1,
                value: settings.get_int('refresh-interval'),
            }),
        });
        intervalRow.connect('notify::value', () => {
            settings.set_int('refresh-interval', intervalRow.get_value());
        });
        group.add(intervalRow);

        // Upload script section
        const uploadGroup = new Adw.PreferencesGroup({
            title: 'Script Upload',
        });
        page.add(uploadGroup);

        // Instructions
        const instructionsRow = new Adw.ActionRow({
            title: 'Instructions',
            subtitle: 'Select the proxmox-monitor.sh file to upload to your server',
        });
        uploadGroup.add(instructionsRow);

        // File chooser button
        const fileRow = new Adw.ActionRow({
            title: 'Script File',
            subtitle: 'No file selected',
        });

        let selectedFile = null;
        
        const fileButton = new Gtk.Button({
            label: "Choose File",
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });

        fileButton.connect("clicked", () => {
            const fileChooser = new Gtk.FileChooserNative({
                transient_for: window,
                title: "Select proxmox-monitor.sh",
                action: Gtk.FileChooserAction.OPEN,
            });

            // Filter for shell scripts
            const filter = new Gtk.FileFilter();
            filter.set_name("Shell scripts");
            filter.add_pattern("*.sh");
            fileChooser.add_filter(filter);

            fileChooser.connect("response", (dialog, response) => {
                if (response === Gtk.ResponseType.ACCEPT) {
                    selectedFile = fileChooser.get_file();
                    if (selectedFile) {
                        fileRow.set_subtitle(selectedFile.get_basename());
                    }
                }
                dialog.destroy();
            });

            fileChooser.show();
        });

        fileRow.add_suffix(fileButton);
        uploadGroup.add(fileRow);

        // Upload button
        const uploadButton = new Gtk.Button({
            label: "Upload Script to Server",
            halign: Gtk.Align.FILL,
            margin_top: 12,
            margin_bottom: 6,
        });

        uploadButton.connect("clicked", () => {
            this._uploadScript(window, settings, selectedFile);
        });

        uploadGroup.add(uploadButton);
    }

    _uploadScript(window, settings, selectedFile) {
        if (!selectedFile) {
            this._showError(window, "Please select a script file first");
            return;
        }

        const host = settings.get_string("server-host");
        const username = settings.get_string("server-username");
        const identity = settings.get_string("server-identity-file");
        const port = settings.get_int("server-port");

        if (!host || !username || !identity) {
            this._showError(window, "Missing SSH fields (host, username or identity file)");
            return;
        }

        const localPath = selectedFile.get_path();
        const remotePath = "/tmp/proxmox-monitor.sh";

        // Show progress dialog
        const progressDialog = new Gtk.MessageDialog({
            transient_for: window,
            text: "Uploading Script",
            secondary_text: "Please wait while the script is uploaded to the server...",
            modal: true,
            buttons: Gtk.ButtonsType.NONE,
            message_type: Gtk.MessageType.INFO,
        });
        progressDialog.present();

        try {
            // First command: SCP upload
            const scpCommand = [
                'scp',
                '-P', port.toString(),
                '-i', identity,
                '-o', 'ConnectTimeout=10',
                '-o', 'BatchMode=yes',
                localPath,
                `${username}@${host}:${remotePath}`
            ];

            // Second command: Set execute permissions
            const chmodCommand = [
                'ssh',
                '-p', port.toString(),
                '-i', identity,
                '-o', 'ConnectTimeout=10',
                '-o', 'BatchMode=yes',
                `${username}@${host}`,
                `chmod +x ${remotePath}`
            ];

            // Execute SCP command
            const [scpSuccess, , , scpExitStatus] = GLib.spawn_sync(
                null, // working directory
                scpCommand,
                null, // environment
                GLib.SpawnFlags.SEARCH_PATH,
                null  // child setup
            );

            if (!scpSuccess || scpExitStatus !== 0) {
                progressDialog.destroy();
                this._showError(window, "SCP upload failed. Check your SSH settings and network connection.");
                return;
            }

            // Execute chmod command
            const [chmodSuccess, , , chmodExitStatus] = GLib.spawn_sync(
                null,
                chmodCommand,
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );

            progressDialog.destroy();

            if (!chmodSuccess || chmodExitStatus !== 0) {
                this._showError(window, "Upload completed but failed to set execute permissions.");
                return;
            }

            this._showSuccess(window, 
                "Script successfully uploaded!\n\n" +
                `File location: ${remotePath}\n` +
                "Execute permissions have been set.\n\n" +
                "The extension should now be able to monitor your Proxmox server."
            );

        } catch (e) {
            progressDialog.destroy();
            this._showError(window, "Upload failed: " + e.message);
        }
    }

    _showError(window, msg) {
        const dialog = new Gtk.MessageDialog({
            transient_for: window,
            text: "Error",
            secondary_text: msg,
            modal: true,
            buttons: Gtk.ButtonsType.OK,
            message_type: Gtk.MessageType.ERROR,
        });
        dialog.connect("response", () => dialog.destroy());
        dialog.present();
    }

    _showSuccess(window, msg) {
        const dialog = new Gtk.MessageDialog({
            transient_for: window,
            text: "Success",
            secondary_text: msg,
            modal: true,
            buttons: Gtk.ButtonsType.OK,
            message_type: Gtk.MessageType.INFO,
        });
        dialog.connect("response", () => dialog.destroy());
        dialog.present();
    }
}

