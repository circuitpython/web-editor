import {GenericModal} from './dialogs.js';

class SettingsDialog extends GenericModal {
    constructor(modalId, settingsData) {
        super(modalId);
        this._settingsData = settingsData;
        this._settings = {}
    }

    async open(settings) {
        let p = super.open();
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._handleOkButton);

        const contentDiv = this._currentModal.querySelector("#settings-content");
        contentDiv.innerHTML = '';

        for (const setting of this._settingsData) {
            const label = document.createElement('label');
            label.textContent = setting.label;
            if (setting.icon) {
                const icon = document.createElement('i');
                icon.className = `fa-solid fa-${setting.icon} setting-item-icon`;
                label.prepend(icon);
            }
            label.htmlFor = `setting-${setting.key}`;
            contentDiv.appendChild(label);

            const control = await this._createControl(setting);
            control.value = settings[setting.key];
            contentDiv.appendChild(control);
        }

        return p;
    }

    async _handleOkButton() {
        let settings = {}
        for (const setting of this._settingsData) {
            const control = this._currentModal.querySelector(`#setting-${setting.key}`);
            settings[setting.key] = control.value;
        }
        this._returnValue(settings);
    }

    async _createControl(settingData) {
        // Return the created control
        let control;
        if (settingData.type === 'select') {
            control = document.createElement('select');
            for (const optionValue of settingData.options) {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue.charAt(0).toUpperCase() + optionValue.slice(1);
                control.appendChild(option);
            }
        }
        control.id = `setting-${settingData.key}`;

        // this will also call this._addDialogElement to add event listeners as needed
        this._addDialogElement(`setting-${settingData.key}`, control);
        return control;
    }
}

class Settings {
    // This is a class that handles loading/saving settings as well as providing a settings dialog
    constructor() {
        // This will hold the layout/save data for the settings
        this._settingsData = [
            { key: 'theme', type: 'select', label: 'Editor Theme', icon: 'palette', options: ['dark', 'light'], default: 'dark' }
        ];
        this._settings = {};
        this._loadSettings();

        this._settingsDialog = new SettingsDialog('settings', this._settingsData);
    }

    _loadSettings() {
        // Load all saved settings or defaults
        for (const setting of this._settingsData) {
            this._settings[setting.key] = this._loadSetting(setting.key, setting.default);
        }
    }

    _saveSettings() {
        // Save all settings
        for (const key in this._settings) {
            this._saveSetting(key, this._settings[key]);
        }
    }

    _loadSetting(setting, defaultValue) {
        let value = JSON.parse(window.localStorage.getItem(setting));
        if (value == null) {
            return defaultValue;
        }

        return value;
    }

    _saveSetting(setting, value) {
        window.localStorage.setItem(setting, JSON.stringify(value));
    }

    getSetting(key) {
        return this._settings[key];
    }

    async showDialog() {
        this._settings = await this._settingsDialog.open(this._settings);
        if (this._settings) {
            this._saveSettings();
            return true;
        }
        return false;
    }
}


export {
    Settings
};
