/*
 * This class will encapsulate all of the workflow functions specific to Web 
 */

import {FileTransferClient} from '../common/web-file-transfer.js';
import {Workflow, CONNTYPE} from './workflow.js'
import {GenericModal} from '../common/dialogs.js';

//const IGNORE_OPCODES = ["\x1b]0;", "\x1b\\"];

class WebWorkflow extends Workflow {
    constructor() {
        super();
        this.host = null;
        this.title = "";
        this.titleMode = false;
        this.websocket = null;
        this.serialService = null;
        this.loadEditor = null;
        this.fileClient = null;
        this.connectDialog = new GenericModal("web-connect");
    }

    async init(params) {
        await super.init(params, "web-loader");
    }

    // This is called when a user clicks the main disconnect button
    async disconnectButtonHandler(e) {
        if (this.connectionType == CONNTYPE.Web) {
            this.connectionType == CONNTYPE.None;
            // Update Common UI
            this.disconnect();
        }
    }

    async onSerialReceive(e) {
        // Use an open web socket to display received serial data
        this.terminal.io.print(e.data);
    }

    async connectToSerial(host) {
        try {
            this.websocket = new WebSocket("ws://" + host + "/cp/serial/");
            this.websocket.onopen = function() {
                // Stuff to do on successful connection
                this.updateConnected(true);
            }; 
            this.websocket.onmessage = this.onSerialReceive.bind(this);
            this.websocket.onclose = this.onDisconnected.bind(this);
            
            this.websocket.onerror = function(e) {
                console.log("WebSocket Error:", e);
                if (this.connected) {
                    this.websocket.close();
                }
                this.websocket = null;
            };
            return true;
        } catch(e) {
            //console.log(e, e.stack);
            return false;
        }
    }

    async getDeviceFileContents(filename) {
        return await this.fileClient.readFile(filename);
    }

    async connectToHost(host) {
        console.log('Initializing File Transfer Client...');
        this.fileClient = new FileTransferClient(host, this.connectionStatus);
        this.debugLog("connected");
        let success = await this.connectToSerial(host);
        if (success) {
            this.connectDialog.close();
            if (this.connectionStatus()) {
                await this.loadEditor();
            }
            return true;
        }

        return false;
    }

    async serialTransmit(msg) {
        // Use an open web socket to transmit serial data
        if (this.websocket) {
            let value = decodeURIComponent(escape(msg));
            try {
                this.websocket.send(value);
            } catch (e) {
                console.log("caught write error", e, e.stack);
            }
        }
    }

    async onConnectButtonClick(e) {
        try {
            await this.connectToHost(this.host);
        }
        catch(error) {
            console.log('Argh: ' + error);
            this.debugLog('No device selected. Try to connect to existing.');
        }
    }

    async connect() {
        return await this.connectToHost(this.host);
    }

    async onDisconnected() {
        this.debugLog("disconnected");
        this.updateConnected(false);
        this.debugLog("connected");
        //await this.connectToSerial();
    }

    updateConnected(isConnected) {
        if (isConnected) {
            this.connectionType = CONNTYPE.Web;
        } else {
            this.connectionType = CONNTYPE.None;
        }
    }

    connectionStatus() {
        return this.connectionType != CONNTYPE.None;
    }

    async parseParams(urlParams) {
        if ("host" in urlParams) {
            this.host = urlParams.host.toLowerCase();
        }

        if (this.host != null) {
            return true;
        }

        return false;
    }
}

export {WebWorkflow};