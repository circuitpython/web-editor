import {Workflow, CONNTYPE} from './workflow.js';
import {FileTransferClient} from '../common/web-file-transfer.js';
import {GenericModal} from '../common/dialogs.js';
import {regexEscape} from '../common/utilities.js';
import {FILE_DIALOG_OPEN, FILE_DIALOG_SAVE} from '../common/file_dialog.js';

let btnRequestSerialDevice;

class USBWorkflow extends Workflow {
    constructor() {
        super();
        this.serialDevice = null;
        this.titleMode = false;
        this.readSerialPromise = null;
        this.connectDialog = new GenericModal("usb-connect");
        this.type = CONNTYPE.Usb;
    }

    async init(params) {
        await super.init(params);
    }

    // This is called when a user clicks the main disconnect button
    async disconnectButtonHandler(e) {
        await super.disconnectButtonHandler(e);
        if (this.connectionStatus()) {
            await this.onDisconnected(null, false);
        }
    }

    async onSerialReceive(e) {
        // Tokenize the larger string and send to the parent
        const chunks = this.tokenize(e.data);
        for (let chunk of chunks) {
            e.data = chunk;
            super.onSerialReceive(e);
        }
    }

    async serialTransmit(msg) {
        if (this.serialDevice && this.serialDevice.writable) {
            const encoder = new TextEncoder();
            const writer = this.serialDevice.writable.getWriter();
            await writer.write(encoder.encode(msg));
            writer.releaseLock();
        }
    }

    async showConnect(documentState) {
        let p = this.connectDialog.open();
        let modal = this.connectDialog.getModal();

        btnRequestSerialDevice = modal.querySelector('#requestSerialDevice');
        btnRequestSerialDevice.disabled = true;

        if (!(await this.available() instanceof Error)) {
            let stepOne;
            if (stepOne = modal.querySelector('.step:first-of-type')) {
                stepOne.classList.add("hidden");
            }
            btnRequestSerialDevice.disabled = false;
        }

        btnRequestSerialDevice.addEventListener('click', async (event) => {
            await this.onRequestSerialDeviceButtonClick();
        });

        return await p;
    }

    async available() {
        if (!('serial' in navigator)) {
            return Error("Web Serial is not enabled in this browser");
        }
        return true;
    }

    async openFileDialog(type) {
        // Open a file dialog and return the path or null if canceled
    }

    // Workflow specific functions
    async switchToDevice(device) {
        if (this.serialDevice) {
            await this.serialDevice.close();
        }
        this.serialDevice = device;
        this.serialDevice.addEventListener("connect", this.onConnected.bind(this));
        this.serialDevice.addEventListener("disconnect", this.onDisconnected.bind(this));
        this.serialDevice.addEventListener("message", this.onSerialReceive.bind(this));
        this.initFileClient(new FileTransferClient());
        console.log("switch to", this.serialDevice);
        await this.serialDevice.open({baudRate: 115200});
        console.log("opened");

        this.readSerialPromise = this.readSerialLoop();
        this.connectDialog.close();
        await this.loadEditor();
    }

    async readSerialLoop() {
        if (!this.serialDevice) {
            return;
        }

        let reader;
        const messageEvent = new Event("message");
        const decoder = new TextDecoder();

        while (this.serialDevice.readable) {
            reader = this.serialDevice.readable.getReader();
            try {
                while (true) {
                    const {value, done} = await reader.read();
                    if (done) {
                        // |reader| has been canceled.
                        break;
                    }
                    messageEvent.data = decoder.decode(value);
                    this.serialDevice.dispatchEvent(messageEvent);
                }
            } catch (error) {
                // Handle |error|...
                // TODO: A hard reset ends up here. It should dispatch a disconnect event.
                console.log("error", error);
            } finally {
                reader.releaseLock();
            }
        }

        this.serialDevice = null;
        this.readSerialPromise = null;
    }

    async onRequestSerialDeviceButtonClick() {
        let devices = await navigator.serial.getPorts();
        if (devices.length == 1) {
            let device = devices[0];
            this.switchToDevice(device);
            return;
        }
        try {
            console.log('Requesting any serial device...');
            let device = await navigator.serial.requestPort();

            console.log('> Requested ');
            console.log(device);
            this.switchToDevice(device);
            return;
        }
        catch (error) {
            console.log('Argh! ');
        }
    }
}

export {USBWorkflow};