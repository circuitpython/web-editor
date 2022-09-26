import {Workflow, CONNTYPE} from './workflow.js';
import {GenericModal} from '../common/dialogs.js';
import {readUploadedFileAsArrayBuffer} from '../common/utilities.js';
import {saveAs} from 'file-saver';

let btnRequestSerialDevice;

class USBWorkflow extends Workflow {
    constructor() {
        super();
        this.serialDevice = null;
        this.titleMode = false;
        this.reader = null;
        this.connectDialog = new GenericModal("usb-connect");
        this._fileContents = null;
        this.type = CONNTYPE.Usb;
        this._partialTokenChunk = null;
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

    async onConnected(e) {
        this.readSerialLoop().catch(
            async function(error) {
                await this.onDisconnected();
            }
        );
        this.connectDialog.close();
        await this.loadEditor();
        super.onConnected(e);
    }

    async onDisconnected(e) {
        if (this.reader) {
            await this.reader.cancel();
            this.reader = null;
        }

        if (this.serialDevice) {
            await this.serialDevice.close();
            this.serialDevice = null;
        }

        super.onDisconnected(e);
    }

    async onSerialReceive(e) {
        console.log(e.data);
        // Prepend any partial chunks
        if (this._partialTokenChunk) {
            e.data = this._partialTokenChunk + e.data;
            this._partialTokenChunk = null;
        }

        // Tokenize the larger string and send to the parent
        let chunks = this.tokenize(e.data);

        // Remove any chunks containing partial tokens
        if (chunks.length && this.hasPartialToken(chunks.slice(-1))) {
            this._partialTokenChunk = chunks.pop();
        }

        // Send all full chunks to the parent function
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

    async saveFileDialog() {
        let defaultFilename = this.currentFilename;
        console.log(defaultFilename);
        if (!defaultFilename) {
            defaultFilename = "code.py";
        }
        return prompt("What filename would you like to save this document as?", defaultFilename);
    }

    async openFileDialog(callback) {
        let input = document.createElement("input");
        input.type = 'file';

        input.addEventListener("change", async (event) => {
            try {
                await callback(input.files[0]);
            } catch (error) {
                await this._showMessage(`Error: ${error.message}`);
            }
        }, {once: true});

        input.click();
    }

    async writeFile(path, contents, offset = 0) {
        try {
            saveAs(new Blob([contents]), path);
        } catch(e) {
            return false;
        }
        return true;
    }

    isBinaryFile(mimeType) {
        const textType = new RegExp("^text\/.*?");
        return mimeType !== "" && !textType.test(mimeType);
    }

    async fileLoadHandler(file) {
        const textDecoder = new TextDecoder();

        if (this.isBinaryFile(file.type)) {
            throw new Error("You selected a binary file.");
        }
        let contents = textDecoder.decode(await readUploadedFileAsArrayBuffer(file));
        this._loadFileContents(file.name, contents);
    }

    async fileExists(path) {
        false;
    }

    async readOnly() {
        return false;
    }

    // Workflow specific functions
    async switchToDevice(device) {
        device.addEventListener("message", this.onSerialReceive.bind(this));

        this.serialDevice = device;
        console.log("switch to", this.serialDevice);
        await this.serialDevice.open({baudRate: 115200});
        this.onConnected();
    }

    async readSerialLoop() {
        console.log("Read Loop Init");
        if (!this.serialDevice) {
            return;
        }

        const messageEvent = new Event("message");
        const decoder = new TextDecoder();

        while (this.serialDevice.readable) {
            this.reader = this.serialDevice.readable.getReader();
            console.log("Read Loop Started");
            while (true) {
                const {value, done} = await this.reader.read();
                if (value) {
                    messageEvent.data = decoder.decode(value);
                    this.serialDevice.dispatchEvent(messageEvent);
                }
                if (done) {
                    this.reader.releaseLock();
                    break;
                }

            }
        }

        this.serialDevice = null;
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

            console.log('> Requested ', device);
            this.switchToDevice(device);
            return;
        }
        catch (error) {
            console.log('Argh! ');
        }
    }
}

export {USBWorkflow};