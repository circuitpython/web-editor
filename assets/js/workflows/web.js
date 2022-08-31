/*
 * This class will encapsulate all of the workflow functions specific to Web 
 */

import {FileTransferClient} from '../common/web-file-transfer.js';
import {Workflow, CONNTYPE} from './workflow.js'
import {GenericModal, DiscoveryModal} from '../common/dialogs.js';

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
        this.deviceDiscoveryDialog = new DiscoveryModal("device-discovery");
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
            await this.checkHost();
            await this.connectToHost(this.host);
        }
        catch(error) {
            console.log('Argh: ' + error);
            this.debugLog('No device selected. Try to connect to existing.');
        }
    }

    async connect() {
        await super.connect();
        await this.checkHost();
        return await this.connectToHost(this.host);
    }

    async checkHost() {
        if (!this.host) {
            this.parseParams();
        }

        if (this.host.toLowerCase() == "circuitpython.local") {
            this.host = await FileTransferClient.getRedirectedHost(this.host);
            console.log("New Host", this.host);
        }
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

    async showConnect(document) {
        let p = this.connectDialog.open();
        let modal = this.connectDialog.getModal();
        let deviceLink = modal.querySelector("#device-link");
        deviceLink.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            let clickedItem = event.target;
            if (clickedItem.tagName.toLowerCase() != "a") {
                clickedItem = clickedItem.parentNode;
            }
            this.switchDevice(new URL(clickedItem.href).host, document);
        });
        return await p;
    }

    switchDevice(deviceHost, document) {
        let documentState = {
            path: this.currentFilename,
            contents: document,
        };
        let url = `http://${deviceHost}/code/`;
        let server = this.constructor.makeUrl(url, {
            state: encodeURIComponent(JSON.stringify(documentState))
        });
        let oldHost = window.location.host;
        let oldPath = window.location.pathname;
        window.location.href = server;
        let serverUrl = new URL(server);
        if (serverUrl.host == oldHost && serverUrl.pathname == oldPath) {
            window.location.reload();
        }
    }

    async showInfo(document) {
        return await this.deviceDiscoveryDialog.open(this, document);
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

    parseParams() {
        let urlParams = Workflow.getUrlParams();
        if (this.constructor.isTestHost() && "host" in urlParams) {
            this.host = urlParams.host.toLowerCase();
        } else if (this.constructor.isMdns()) {
            this.host = location.hostname;
        } else if (this.constructor.isIp()) {
            this.host = location.hostname;
        }

        if (this.host != null) {
            return true;
        }

        return false;
    }

    static isTestHost() {
        return location.hostname == "localhost" || location.hostname == "127.0.0.1";
    }

    static buildHash(hashParams) {
        let segments = [];
        for (const item in hashParams) {
            segments.push(`${item}=${hashParams[item]}`);
        }
        if (segments.length == 0) {
            return '';
        }

        return '#'+segments.join('&');
    }

    static makeUrl(url, extraParams = {}) {
        let urlParams = {
            ...Workflow.getUrlParams(),
            ...extraParams
        }        
        let oldUrl = new URL(url);
        if (this.isTestHost()) {
            urlParams.host = oldUrl.hostname;
            return new URL(oldUrl.pathname, `http://${location.host}/`) + this.buildHash(urlParams);
        }

        return new URL(oldUrl) + this.buildHash(urlParams);
    }
    
    static isMdns() {
        return location.hostname.search(/cpy-[0-9a-f]{6}.local/gi) == 0;
    }

    static isIp() {
        return location.hostname.search(/([0-9]{1,3}.){4}/gi) == 0;
    }

    static isLocal() {
        return (this.isMdns() || location.hostname == "localhost" || this.isIp()) && (location.pathname == "/code/");
    }
}

export {WebWorkflow};