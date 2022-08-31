import {sleep, timeout} from '../common/utilities.js';

/*
 * This class will encapsulate all of the common workflow-related functions 
 */

const CONNTYPE = {
    None: 1,
    Ble: 2,
    Usb: 3,
    Web: 4
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
        this.timeout = timeout;
        this.sleep = sleep;
        this.connectDialog = null;
        this._connected = false;
        this.currentFilename = null;
    }

    async init(params, loaderId) {
        this.terminal = params.terminal;
        this.debugLog = params.debugLogFunc;
        this.disconnectCallback = params.disconnectFunc;
        this.loadEditor = params.loadEditorFunc;
        this.loader = document.getElementById(loaderId);
        if ("terminalTitle" in params) {
            this.terminalTitle = params.terminalTitle;
        }
        this.currentFilename = params.currentFilename;
    }

    async getDeviceFileContents() {
        let filename = this.currentFilename;
        if (!filename) {
            return "";
        }
        return await this.showBusy(this.fileClient.readFile(this.currentFilename));
    }

    async disconnectButtonHandler(e) {

    }

    async connect() {

    }

    async onDisconnected(e, reconnect=true) {
        this.debugLog("disconnected");
        this.updateConnected(false);
        // Update Common UI Elements
        if (this.disconnectCallback) {
            this.disconnectCallback();
        }
        if (reconnect) {
            await this.connect();
        }
    }

    async onConnected(e) {
        this.debugLog("connected");
        console.log("Connected!");
        this.updateConnected(true);
        if (this.connectDialog) {
            this.connectDialog.close();
        }
    }

    connectionStatus() {
        return this._connected;
    }

    async deinit() {

    }

    updateConnected(isConnected) {
        this._connected = isConnected;
    }

    async showBusy(functionPromise) {
        if (this.loader) {
            this.loader.classList.add("busy");
        }
        let result = await functionPromise;
        if (this.loader) {
            this.loader.classList.remove("busy");
        }
        return result;
    }

    async parseParams(urlParams) {
        // Connection specific params check
        return false;
    }

    writeToTerminal(data) {
        this.terminal.write(data);
    }

    static getUrlParams() {
        // This should look for and validate very specific values
        var hashParams = {};
        if (location.hash) {
            location.hash.substr(1).split("&").forEach(function(item) {hashParams[item.split("=")[0]] = item.split("=")[1]});
        }
        return hashParams;
    }

    async showConnect() {
        return await this.connectDialog.open();
    }
}

export {Workflow, CONNTYPE};