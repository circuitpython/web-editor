/*
 * This class will encapsulate all of the workflow functions specific to Web
 */

import {CONNTYPE, CONNSTATE} from '../constants.js';
import {FileTransferClient} from '../common/web-file-transfer.js';
import {Workflow} from './workflow.js';
import {GenericModal, DiscoveryModal} from '../common/dialogs.js';
import {isTestHost, isMdns, isIp, getUrlParam, switchDevice, sleep, timeout} from '../common/utilities.js';

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
        this.connectDialog = new GenericModal("web-connect");
        this.deviceDiscoveryDialog = new DiscoveryModal("device-discovery");
        this.connIntervalId = null;
        this.type = CONNTYPE.Web;
    }

    // This is called when a user clicks the main disconnect button
    async disconnectButtonHandler(e) {
        await super.disconnectButtonHandler(e);
        if (this.connectionStatus()) {
            await this.onDisconnected(null, false);
        }
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
        let result;
        if (result = await super.connect() instanceof Error) {
            return result;
        }
        if (!await this.checkHost()) {
            return false;
        }
        return await this.connectToHost(this.host);
    }

    async onConnected(e) {
        await super.onConnected(e);
        //this.connIntervalId = setInterval(this._checkConnection.bind(this), PING_INTERVAL_MS);
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

    async showConnect(documentState) {
        const p = this.connectDialog.open();
        const modal = this.connectDialog.getModal();
        const deviceLink = modal.querySelector("#device-link");
        deviceLink.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            let clickedItem = event.target;
            if (clickedItem.tagName.toLowerCase() != "a") {
                clickedItem = clickedItem.parentNode;
            }
            switchDevice(new URL(clickedItem.href).host, documentState);
        });
        return await p;
    }

    async parseParams() {
        let host = getUrlParam("host", false);
        if (isTestHost()) {
            if (host) {
                this.host = host.toLowerCase();
            } else {
                return Error("You are connected with localhost, but didn't supply the device hostname.");
            }
        } else if (isMdns() || isIp()) {
            this.host = location.host;
        }

        if (this.host != null) {
            return true;
        }

        return false;
    }

    async available() {
        if (!window.WebSocket) {
            return Error("WebSockets are not supported in this browser");
        }
        return true;
    }

    // Workflow specific functions
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
            await timeout(
                async () => {
                    while (!this.connectionStatus()) {
                        await sleep(100);
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

    async showInfo(documentState) {
        return await this.deviceDiscoveryDialog.open(this, documentState);
    }

    async _checkConnection() {
        try {
            await timeout(
                async () => {
                    await this.activeConnection();
                }, PING_TIMEOUT_MS
            );
        } catch (error) {
            console.log("Ping timed out. Closing connection.");
            await this.onDisconnected(null, false);
        }
    }
}

export {WebWorkflow};