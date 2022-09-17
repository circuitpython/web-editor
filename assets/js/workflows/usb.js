/*
 * This class will encapsulate all of the workflow functions specific to USB.
 */

import {Workflow, CONNTYPE} from './workflow.js';
import {GenericModal} from '../common/dialogs.js';

class USBWorkflow extends Workflow {
    constructor() {
        super();
        this.serialDevice = null;
        this.titleMode = false;
        this.websocket = null;
        this.serialService = null;
        this.connectDialog = new GenericModal("usb-connect");
        this.type = CONNTYPE.Usb;
    }

    async init(params) {
        await super.init(params);
    }

    async connectButtonHandler(e) {
        // Empty for now. Eventually this will handle Web Serial connection
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

    async serialTransmit(msg) {
        if (serialDevice && serialDevice.writable) {
            const encoder = new TextEncoder();
            const writer = serialDevice.writable.getWriter();
            await writer.write(encoder.encode(s));
            writer.releaseLock();
        }
    }

    async onConnected(e) {
        await super.onConnected(e);

    }

    async onDisconnected(e, reconnect = true) {

        await super.onDisconnected(e, reconnect);
    }

    async showConnect(document, docChangePos) {
        let p = this.connectDialog.open();
        let modal = this.connectDialog.getModal();
        /*
        btnRequestBluetoothDevice = modal.querySelector('#requestBluetoothDevice');
        btnBond = modal.querySelector('#promptBond');
        btnReconnect = modal.querySelector('#bleReconnect');

        btnRequestBluetoothDevice.addEventListener('click', async (event) => {
            await this.onRequestBluetoothDeviceButtonClick();
        });
        btnBond.addEventListener('click', async (event) =>  {
            await this.onBond();
        });
        btnReconnect.addEventListener('click', async (event) =>  {
            await this.reconnectButtonHandler(event);
        });

        if (await this.available() instanceof Error) {
            btnRequestBluetoothDevice.disabled = true;
            btnReconnect.disabled = true;
        }
        btnBond.disabled = true;*/

        return await p;
    }

    async onConnected(e) {
        console.log(e, "connected!");
    }

    async onDisconnected(e) {
        console.log(e, "disconnected");
    }

    async available() {
        if (!window.WebSocket) {
            return Error("WebSockets are not supported in this browser");
        }
        return true;
    }

    // Workflow specific functions
    async switchToDevice(device) {
        if (serialDevice) {
            await serialDevice.close();
        }
        this.serialDevice = device;
        device.addEventListener("connect", this.onSerialConnected);
        device.addEventListener("disconnect", this.onSerialDisconnected);
        console.log("switch to", device);
        await device.open({baudRate: 115200});
        console.log("opened");
        let reader;
        while (device.readable) {
            reader = device.readable.getReader();
            try {
                while (true) {
                    const {value, done} = await reader.read();
                    if (done) {
                        // |reader| has been canceled.
                        break;
                    }
                    terminal.io.print(decoder.decode(value));
                }
            } catch (error) {
                // Handle |error|...
                console.log("error", error);
            } finally {
                reader.releaseLock();
            }
        }
    }
}

export {USBWorkflow};