import {REPL} from '@adafruit/circuitpython-repl-js';

import {FileHelper} from '../common/file.js';
import {UnsavedDialog} from '../common/dialogs.js';
import {FileDialog, FILE_DIALOG_OPEN, FILE_DIALOG_SAVE} from '../common/file_dialog.js';
import {CONNTYPE, CONNSTATE} from '../constants.js';
import {plotValues} from '../common/plotter.js'

/*
 * This class will encapsulate all of the common workflow-related functions
 */

const validBackends = {
    "web": CONNTYPE.Web,
    "ble": CONNTYPE.Ble,
    "usb": CONNTYPE.Usb,
};

function isValidBackend(backend) {
    return backend in validBackends;
}

function getBackendWorkflow(backend) {
    if (isValidBackend(backend)) {
        return validBackends[backend];
    }
    return null;
}

function getWorkflowBackendName(workflow) {
    return Object.keys(validBackends).find(key => validBackends[key] === workflow) || null;
}

class Workflow {
    constructor() {
        this.terminal = null;
        this.terminalTitle = null;
        this.debugLog = null;
        this.loader = null;
        this.type = CONNTYPE.None;
        this.partialWrites = false;
        this.disconnectCallback = null;
        this.loadEditor = null;
        this.connectDialog = null;
        this._connected = false;
        this.currentFilename = null;
        this.fileHelper = null;
        this._unsavedDialog = new UnsavedDialog("unsaved");
        this._fileDialog = new FileDialog("files", this.showBusy.bind(this));
        this.repl = new REPL();
        this.plotterEnabled = false;
        this.plotterChart = false;
        this.buttonStates = [];
        this.connectButtons = {};
    }

    async init(params) {
        this.terminal = params.terminal;
        this.debugLog = params.debugLogFunc;
        this.disconnectCallback = params.disconnectFunc;
        this.loadEditor = params.loadEditorFunc;
        this._isDirty = params.isDirtyFunc;
        this._saveFileContents = params.saveFileFunc;
        this._loadFileContents = params.loadFileFunc;
        this._showMessage = params.showMessageFunc;
        this.loader = document.getElementById("loader");
        this.plotterBufferSize = document.getElementById('buffer-size');
        this.plotterGridLines = document.getElementById('plot-gridlines-select');
        if ("terminalTitle" in params) {
            this.terminalTitle = params.terminalTitle;
        }
        this.currentFilename = params.currentFilename;
        this._showSerial = params.showSerialFunc;

        this.repl.setTitle = this.setTerminalTitle.bind(this);
        this.repl.writeToTerminal = this.writeToTerminal.bind(this);
        this.repl.serialTransmit = this.serialTransmit.bind(this);
    }

    async initFileClient(fileClient) {
        this.fileHelper = new FileHelper(fileClient);
    }

    async disconnectButtonHandler(e) {

    }

    async connect() {
        this.clearConnectStatus();
        return await this.available();
    }

    async restartDevice() {
        this.repl.softRestart();
    }

    makeDocState(document, docChangePos) {
        return {
            path: this.currentFilename,
            contents: document,
            pos: docChangePos,
        };
    }

    async onDisconnected(e, reconnect = true) {
        console.log("onDisconnected called in workflow");
        this.debugLog("disconnected");
        this.updateConnected(CONNSTATE.disconnected);
        // Update Common UI Elements
        if (this.disconnectCallback) {
            this.disconnectCallback();
        }
        if (reconnect) {
            await this.connect();
        }
    }

    async onConnected(e) {
        console.log("Connected!");
        this.updateConnected(CONNSTATE.connected);
        if (this.connectDialog) {
            this.connectDialog.close();
        }
    }

    async onSerialReceive(e) {
        await this.repl.onSerialReceive(e);
    }

    connectionStatus(partialConnectionsAllowed = false) {
        if (partialConnectionsAllowed) {
            return this._connected != CONNSTATE.disconnected;
        }

        return this._connected == CONNSTATE.connected;
    }

    async deinit() {

    }

    updateConnected(connectionState) {
        if (Object.values(CONNSTATE).includes(connectionState)) {
            this._connected = connectionState;
        }
    }

    async showBusy(functionPromise, darkBackground = true) {
        if (this.loader) {
            if (darkBackground) {
                this.loader.classList.add("overlay");
            } else {
                this.loader.classList.remove("overlay");
            }
            this.loader.classList.add("busy");
        }
        let result = await functionPromise;
        if (this.loader) {
            this.loader.classList.remove("busy");
        }
        return result;
    }

    async parseParams(urlParams) {
        // Workflow specific params check
        return false;
    }

    writeToTerminal(data) {
        if (this.plotterEnabled) {
            plotValues(this.plotterChart, data, this.plotterBufferSize.value);
        }
        this.terminal.write(data);
    }

    setTerminalTitle(title, append = false) {
        if (this.terminalTitle == null) {
            return;
        }

        if (append) {
            title = this.terminalTitle.textContent + title;
        }

        this.terminalTitle.textContent = title;
    }

    async showConnect(documentState) {
        return await this.connectDialog.open();
    }

    async runCurrentCode() {
        let path = this.currentFilename;

        if (!path) {
            console.log("File has not been saved");
            return false;
        }

        let extension = path.split('.').pop();
        if (extension === null) {
            console.log("Extension not found");
            return false;
        }
        if (String(extension).toLowerCase() != "py") {
            console.log("Extension not .py, it was ." + String(extension).toLowerCase());
            return false;
        }

        await this._showSerial();

        if (path == "/code.py") {
            await this.repl.softRestart();
        } else {
            path = path.slice(1, -3);
            path = path.replace(/\//g, ".");
            await (this.repl.runCode("import " + path));
        }
    }

    async checkSaved() {
        if (this._isDirty()) {
            let result = await this._unsavedDialog.open("Current changes will be lost. Do you want to save?");
            if (result !== null) {
                if (!result || await this.saveFile()) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    async saveFile(path = null) {
        if (path === null) {
            if (this.currentFilename !== null) {
                path = this.currentFilename;
            } else {
                path = await this.saveFileAs();
            }
        }
        if (path !== null) {
            await this._saveFileContents(path);
            return true;
        }
        return false;
    }

    async saveFileAs() {
        let path = await this.saveFileDialog();
        if (path !== null) {
            // check if filename exists
            if (path != this.currentFilename && await this.fileExists(path) && !window.confirm("Overwrite existing file '" + path + "'?")) {
                return null;
            }
            this.currentFilename = path;
            await this.saveFile(path);
        }
        return path;
    }

    async fileExists(path) {
        return await this.showBusy(this.fileHelper.fileExists(path));
    }

    async openFile() {
        if (await this.checkSaved()) {
            await this.openFileDialog(this.fileLoadHandler.bind(this));
        }
    }

    async fileLoadHandler(path) {
        console.log("Path:", path);
        if (path !== null) {
            let contents = await this.readFile(path);
            this._loadFileContents(path, contents);
        }
    }

    // Open a file dialog and return the path or null if canceled
    async saveFileDialog() {
        return await this._fileDialog.open(this.fileHelper, FILE_DIALOG_SAVE);
    }

    async openFileDialog(callback) {
        let path = await this._fileDialog.open(this.fileHelper, FILE_DIALOG_OPEN);
        await callback(path);
    }

    async writeFile(path, contents, offset = 0) {
        return await this.showBusy(
            this.fileHelper.writeFile(path, offset, contents)
        );
    }

    async readFile(path) {
        return await this.showBusy(this.fileHelper.readFile(path));
    }

    async readOnly() {
        if (this.fileHelper) {
            return await this.fileHelper.readOnly();
        }
        return false;
    }

    async parseParams() {
        return true;
    }

    async available() {
        return Error("This work flow is not available.");
    }

    // Handle the different button states for various connection steps
    connectionStep(step) {
        // Check if a dialog exists
        if (!this.connectDialog.isOpen()) {
            return;
        }

        if (step < 0) step = 0;
        if (step > this.buttonStates.length - 1) step = this.buttonStates.length - 1;

        for (let button in this.connectButtons) {
            this.connectButtons[button].disabled = !this.buttonStates[step][button];
        }

        // Mark all previous steps as completed (hidden or not)
        for (let stepNumber = 0; stepNumber < step; stepNumber++) {
            this._markStepCompleted(stepNumber);
        }
    }

    _markStepCompleted(stepNumber) {
        let modal = this.connectDialog.getModal();
        let steps = modal.querySelectorAll('.step');
        // For any steps prior to the last step, add a checkmark
        for (let i = 0; i < steps.length - 1; i++) {
            let step = steps[stepNumber];
            if (!step.classList.contains('completed')) {
                step.classList.add('completed');
            }
        }
    }

     clearConnectStatus(modal) {
        // Check if a dialog exists
        if (!this.connectDialog.isOpen()) {
            return;
        }

        try {
            const modal = this.connectDialog.getModal();
            modal.querySelector('.connect-status').hidden = true;
        } catch (e) {
            console.log("Modal not active on clearStatus()", e);
        }
    }

    showConnectStatus(message) {
        try {
            const modal = this.connectDialog.getModal();
            const statusBox = modal.querySelector('.connect-status');
            statusBox.hidden = false;
            let statusContentBox = statusBox.querySelector('.connect-status-content');
            statusContentBox.innerHTML = message;
        } catch (e) {
            console.log("Modal not active on showStatus()", e);
        }
    }
}

export {
    Workflow,
    isValidBackend,
    getBackendWorkflow,
    getWorkflowBackendName
};
