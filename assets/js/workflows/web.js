/*
 * This class will encapsulate all of the workflow functions specific to Web 
 */

import {FileTransferClient} from '../common/web-file-transfer.js';
import {Workflow, CONNTYPE} from './workflow.js'
import {GenericModal} from '../common/dialogs.js';

const CHAR_TITLE_START = "\x1b]0;";
const CHAR_TITLE_END = "\x1b\\";

const CONNECT_TIMEOUT_MS = 30000
const PING_INTERVAL_MS = 5000
const PING_TIMEOUT_MS = 2000

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
        this.connIntervalId = null;
        this.type = CONNTYPE.Web;
    }

    async init(params) {
        await super.init(params, "web-loader");
        document.getElementById('terminal-title');
    }

    // This is called when a user clicks the main disconnect button
    async disconnectButtonHandler(e) {
        await super.disconnectButtonHandler(e);
        if (this.connectionStatus()) {
            await this.onDisconnected(null, false);
        }
    }

    async onSerialReceive(e) {
        // Use an open web socket to display received serial data
        if (e.data == CHAR_TITLE_START) {
            this.titleMode = true;
            this.setTerminalTitle("");
        } else if (e.data == CHAR_TITLE_END) {
            this.titleMode = false;
        } else if (this.titleMode) {
            this.setTerminalTitle(e.data, true);
        } else {
            this.writeToTerminal(e.data);
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
            this.websocket.onopen = this.onConnected.bind(this);
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
        let success;
        try {
            console.log('Initializing File Transfer Client...');
            this.fileClient = new FileTransferClient(host, this.connectionStatus.bind(this));
            await this.fileClient.listDir('/');
            success = await this.initSerial(host);
        } catch(error) {
            console.log("Device not found");
            return false;
        }
        // Wait for a connection with a timeout
        console.log("Waiting for connection...");
        try {
            await this.timeout(
                async () => {
                    while(!this.connectionStatus()) {
                        await this.sleep(100);
                    }
                }, CONNECT_TIMEOUT_MS
            );
        } catch(error) {
            console.log("Connection timed out");
            return false;
        }

        if (success && this.connectionStatus()) {
            await this.loadEditor();
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
        await super.connect();
        return await this.connectToHost(this.host);
    }

    async onConnected(e) {
        await super.onConnected(e);
        //this.connIntervalId = setInterval(this.checkConnection.bind(this), PING_INTERVAL_MS);
    }

    async onDisconnected(e, reconnect=true) {
        if (this.connIntervalId) {
            clearInterval(this.connIntervalId);
            this.connIntervalId = null;
        }
        await super.onDisconnected(e, reconnect);
    }

    async activeConnection() {
        try {
            let version = await this.fileClient.versionInfo();
            if (!version) {
                return false;
            }
        } catch (error) {
            return false;
        }
        
        return true;
    }

    async checkConnection() {
        try {
            await this.timeout(
                async () => {
                    await this.activeConnection()
                }, PING_TIMEOUT_MS
            );                
        } catch (error) {
            console.log("Ping timed out. Closing connection.");
            //this.websocket.close();
            await this.onDisconnected(null, false);
        }
    }

    async parseParams(urlParams) {
        if ((location.hostname == "localhost") && ("host" in urlParams)) {
            this.host = urlParams.host.toLowerCase();
        } else if (location.hostname.search(/cpy-[0-9a-f]{6}.local/gi) >= 0) {
            this.host = location.hostname;
        }

        if (this.host != null) {
            return true;
        }

        return false;
    }
}

export {WebWorkflow};