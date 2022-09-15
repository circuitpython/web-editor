/*
 * This class will encapsulate all of the workflow functions specific to Web
 */

import {FileTransferClient} from '../common/web-file-transfer.js';
import {Workflow, CONNTYPE} from './workflow.js';
import {GenericModal, DiscoveryModal} from '../common/dialogs.js';
import {isTestHost, isMdns, isIp, makeUrl, getUrlParams} from '../common/utilities.js';

const CHAR_TITLE_START = "\x1b]0;";
const CHAR_TITLE_END = "\x1b\\";

const CONNECT_TIMEOUT_MS = 30000;
const PING_INTERVAL_MS = 5000;
const PING_TIMEOUT_MS = 2000;

class WebWorkflow extends Workflow {
    constructor() {
        super();
        this.host = null;
        this.titleMode = false;
        this.websocket = null;
        this.serialService = null;
        this.loadEditor = null;
        this.connectDialog = new GenericModal("web-connect");
        this.deviceDiscoveryDialog = new DiscoveryModal("device-discovery");
        this.connIntervalId = null;
        this.type = CONNTYPE.Web;
    }

    async init(params) {
        await super.init(params);
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
            return true;
        } catch (e) {
            //console.log(e, e.stack);
            return new Error("Error initializing Web Socket.");
        }
    }

    async connectToHost(host) {
        let returnVal;
        console.log('Initializing File Transfer Client...');
        this.initFileClient(new FileTransferClient(host, this.connectionStatus.bind(this)));
        try {
            await this.fileHelper.listDir('/');
        } catch (error) {
            return new Error(`The device ${host} was not found. Be sure it is plugged in and set up properly.`);
        }
        returnVal = await this.initSerial(host);
        if (returnVal instanceof Error) {
            return returnVal;
        }
        // Wait for a connection with a timeout
        console.log("Waiting for connection...");
        try {
            await this.timeout(
                async () => {
                    while (!this.connectionStatus()) {
                        await this.sleep(100);
                    }
                }, CONNECT_TIMEOUT_MS
            );
        } catch (error) {
            return new Error("Connection timed out. Make sure you don't have more than one browser tab open.");
        }

        if (this.connectionStatus()) {
            await this.loadEditor();
            return true;
        }

        return new Error("Unknown Error. Try resetting the device.");
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

    async connect() {
        await super.connect();
        if (!await this.checkHost()) {
            return false;
        }
        return await this.connectToHost(this.host);
    }

    async checkHost() {
        if (!this.host) {
            this.parseParams();
        }
        if (this.host.toLowerCase() == "circuitpython.local") {
            try {
                this.host = await FileTransferClient.getRedirectedHost(this.host);
                console.log("New Host", this.host);
            } catch (e) {
                console.error("Unable to forward to device. Ensure they are set up and connected to the same local network.");
                return false;
            }
        }

        return true;
    }

    async onConnected(e) {
        await super.onConnected(e);
        //this.connIntervalId = setInterval(this.checkConnection.bind(this), PING_INTERVAL_MS);
    }

    async onDisconnected(e, reconnect = true) {
        if (this.connIntervalId) {
            clearInterval(this.connIntervalId);
            this.connIntervalId = null;
        }

        if (this.websocket) {
            if (!reconnect) {
                // Prevent this function from called again when WebSocket is closed
                this.websocket.onclose = () => {};
                this.websocket.close();
            }
            this.websocket = null;
        }

        await super.onDisconnected(e, reconnect);
    }

    async activeConnection() {
        try {
            let version = await this.fileHelper.versionInfo();
            if (!version) {
                return false;
            }
        } catch (error) {
            return false;
        }

        return true;
    }

    async showConnect(document, docChangePos) {
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
            this.switchDevice(new URL(clickedItem.href).host, document, docChangePos);
        });
        return await p;
    }

    switchDevice(deviceHost, document, docChangePos) {
        let documentState = {
            path: this.currentFilename,
            contents: document,
            pos: docChangePos,
        };
        let url = `http://${deviceHost}/code/`;
        let server = makeUrl(url, {
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

    async showInfo(document, docChangePos) {
        return await this.deviceDiscoveryDialog.open(this, document, docChangePos);
    }

    async checkConnection() {
        try {
            await this.timeout(
                async () => {
                    await this.activeConnection();
                }, PING_TIMEOUT_MS
            );
        } catch (error) {
            console.log("Ping timed out. Closing connection.");
            await this.onDisconnected(null, false);
        }
    }

    parseParams() {
        let urlParams = getUrlParams();
        if (isTestHost() && "host" in urlParams) {
            this.host = urlParams.host.toLowerCase();
        } else if (isMdns()) {
            this.host = location.hostname;
        } else if (isIp()) {
            this.host = location.hostname;
        }

        if (this.host != null) {
            return true;
        }

        return false;
    }
}

export {WebWorkflow};