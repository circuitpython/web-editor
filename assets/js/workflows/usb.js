import {Workflow, CONNTYPE, CONNSTATE} from './workflow.js';
import {GenericModal} from '../common/dialogs.js';
import {FileTransferClient} from '../common/usb-file-transfer.js';

let btnRequestSerialDevice, btnSelectHostFolder;

class USBWorkflow extends Workflow {
    constructor() {
        super();
        this._serialDevice = null;
        this.titleMode = false;
        this.reader = null;
        this.connectDialog = new GenericModal("usb-connect");
        this._fileContents = null;
        this.type = CONNTYPE.Usb;
        this._partialToken = null;
        this._uid = null;
        this._readLoopPromise = null;
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
        this.connectDialog.close();
        await this.loadEditor();
        super.onConnected(e);
    }

    async onDisconnected(e, reconnect = true) {
        if (this.reader) {
            await this.reader.cancel();
            this.reader = null;
        }

        if (this._serialDevice) {
            await this._serialDevice.close();
            this._serialDevice = null;
        }

        super.onDisconnected(e, reconnect);
    }

    async onSerialReceive(e) {
        // Prepend a partial token if it exists
        if (this._partialToken) {
            e.data = this._partialToken + e.data;
            this._partialToken = null;
        }

        // Tokenize the larger string and send to the parent
        let tokens = this._tokenize(e.data);

        // Remove any partial tokens and store for the next serial data receive
        if (tokens.length && this._hasPartialToken(tokens.slice(-1))) {
            this._partialToken = tokens.pop();
        }

        // Send only full tokens to the parent function
        for (let token of tokens) {
            e.data = token;
            super.onSerialReceive(e);
        }
    }

    async serialTransmit(msg) {
        if (this._serialDevice && this._serialDevice.writable) {
            const encoder = new TextEncoder();
            const writer = this._serialDevice.writable.getWriter();
            await writer.write(encoder.encode(msg));
            writer.releaseLock();
        }
    }

    async connect() {
        let result;
        if (result = await super.connect() instanceof Error) {
            return result;
        }

        return await this.connectToDevice();
    }

    async connectToDevice() {
        return await this.connectToSerial();
    }

    async connectToSerial() {
        console.log('Connecting to Serial...');

        // There's no way to reference a specific port, so we just hope the user
        // only has a single port stored. If not, we'll prompt the user to select
        // a device port.
        let devices = await navigator.serial.getPorts();
        let device = null;

        if (devices.length == 1) {
            device = devices[0];
            console.log(await device.getInfo());
            try {
                // Attempt to connect to the saved device. If it's not found, this will fail.
                await this._switchToDevice(device);
            } catch (e) {
                // TODO: We should probably remove existing devices if it fails here
                console.log("Failed to automatically connect to saved device. Prompting user to select a device.");
                console.log(e);
                alert(e.message);
                device = await navigator.serial.requestPort();
                console.log(device);
            }

            // TODO: Make it more obvious to user that something happened for smaller screens
            // Perhaps providing checkmarks by adding a css class when a step is complete would be helpful
            // This would help with other workflows as well
        } else {
            console.log('Requesting any serial device...');
            device = await navigator.serial.requestPort();
        }

        // If we didn't automatically use a saved device
        if (!this._serialDevice) {
            console.log('> Requested ', device);
            await this._switchToDevice(device);
        }

        if (this._serialDevice != null) {
            this._connectionStep(2);
            return true;
        }

        return false;
    }

    async showConnect(documentState) {
        let p = this.connectDialog.open();
        let modal = this.connectDialog.getModal();

        btnRequestSerialDevice = modal.querySelector('#requestSerialDevice');
        btnSelectHostFolder = modal.querySelector('#selectHostFolder');

        btnRequestSerialDevice.disabled = true;
        btnSelectHostFolder.disabled = true;

        btnRequestSerialDevice.addEventListener('click', async (event) => {
            try {
                await this.connectToSerial();
            } catch (e) {
                //console.log(e);
                //alert(e.message);
                //alert("Unable to connect to device. Make sure it is not already in use.");
                // TODO: I think this also occurs if the user cancels the requestPort dialog
            }
        });

        btnSelectHostFolder.addEventListener('click', async (event) => {
            await this._selectHostFolder();
        });

        if (!(await this.available() instanceof Error)) {
            let stepOne;
            if (stepOne = modal.querySelector('.step:first-of-type')) {
                stepOne.classList.add("hidden");
            }
            this._connectionStep(1);
        } else {
            this._connectionStep(0);
        }

        // TODO: If this is closed before all steps are completed, we should close the serial connection
        // probably by calling onDisconnect()

        return await p;
    }

    async available() {
        if (!('serial' in navigator)) {
            return Error("Web Serial is not enabled in this browser");
        }
        return true;
    }

    // Workflow specific functions
    async _selectHostFolder() {
        console.log('Initializing File Transfer Client...');
        // try {
        this.initFileClient(new FileTransferClient(this.connectionStatus.bind(this)));
        //} catch (error) {
        //    return new Error(`The device was not found. Be sure it is plugged in and set up properly.`);
        //}
        await this.fileHelper.listDir('/');
        this.onConnected();
    }

    async _switchToDevice(device) {
        device.addEventListener("message", this.onSerialReceive.bind(this));

        this._serialDevice = device;
        console.log("switch to", this._serialDevice);
        await this._serialDevice.open({baudRate: 115200}); // TODO: Will fail if something else is already connected or it isn't found.

        // Start the read loop
        this._readLoopPromise = this._readSerialLoop().catch(
            async function(error) {
                await this.onDisconnected();
            }.bind(this)
        );
        // TODO: Get the UID from the device and store it in this._uid then pass it to the file transfer client to match up the device
        // We could get the UID with:
        // >>> import microcontroller
        // >>> microcontroller.cpu.uid
        // bytearray(b'O!\xaf\x95kJ')
        //
        // We would need a way to get the output from runPythonCodeOnDevice() first

        let result = await this.runPythonCodeOnDevice("import microcontroller\nmicrocontroller.cpu.uid");
        console.log(result);
        this.updateConnected(CONNSTATE.partial);
    }

    async _readSerialLoop() {
        console.log("Read Loop Init");
        if (!this._serialDevice) {
            return;
        }

        const messageEvent = new Event("message");
        const decoder = new TextDecoder();

        if (this._serialDevice.readable) {
            this.reader = this._serialDevice.readable.getReader();
            console.log("Read Loop Started");
            while (true) {
                const {value, done} = await this.reader.read();
                if (value) {
                    messageEvent.data = decoder.decode(value);
                    this._serialDevice.dispatchEvent(messageEvent);
                }
                if (done) {
                    this.reader.releaseLock();
                    break;
                }
            }
        }

        console.log("Read Loop Stopped. Closing Serial Port.");
    }

    // Handle the different button states for various connection steps
    _connectionStep(step) {
        const buttonStates = [
            {request: false, select: false},
            {request: true, select: false},
            {request: true, select: true},
        ];

        if (step < 0) step = 0;
        if (step > buttonStates.length - 1) step = buttonStates.length - 1;

        btnRequestSerialDevice.disabled = !buttonStates[step].request;
        btnSelectHostFolder.disabled = !buttonStates[step].select;
    }
}

export {USBWorkflow};