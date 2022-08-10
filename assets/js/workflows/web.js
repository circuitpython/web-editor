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
        this.titleMode = false;
        this.websocket = null;
        this.serialService = null;
        this.loadEditor = null;
        this.fileClient = null;
        this.connectDialog = new GenericModal("web-connect");
    }

    async init(params) {
        await super.init(params, "web-loader");
        document.getElementById('terminal-title');
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
        if (e.data == "\x1b]0;") {
            this.titleMode = true;
            this.setTerminalTitle("");
        } else if (e.data == "\x1b\\") {
            this.titleMode = false;
        } else if (this.titleMode) {
            this.setTerminalTitle(e.data, true);
        } else {
            this.terminal.io.print(e.data);
        }
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

    async initSerial(host) {
        try {
            this.websocket = new WebSocket("ws://" + host + "/cp/serial/");
            this.websocket.onopen = function() {
                // Stuff to do on successful connection
                this.updateConnected(true);
            }.bind(this); 
            this.websocket.onmessage = this.onSerialReceive.bind(this);
            this.websocket.onclose = this.onDisconnected.bind(this);
            
            this.websocket.onerror = function(e) {
                console.log("WebSocket Error:", e);
                if (this.connected) {
                    this.websocket.close();
                }
                this.websocket = null;
            }.bind(this);
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
        let success = await this.initSerial(host);
        // Wait for a connection with a 30 second timeout
        console.log("Waiting for connection...");
        await this.timeout(
            async () => {
                while(!this.connectionStatus()) {
                    await this.sleep(100);
                }
            }, 30000
        );

        if (success && this.connectionStatus()) {
            console.log("Connected!");
            this.connectDialog.close();
            if (this.connectionStatus()) {
                await this.loadEditor();
            }
            return true;
        }
        console.log("Connection timed out");

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
        //await this.initSerial();
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