import {CONNTYPE, CONNSTATE} from '../constants.js';
import {Workflow} from './workflow.js';
import {GenericModal, DeviceInfoModal} from '../common/dialogs.js';
import {FileOps} from '@adafruit/circuitpython-repl-js'; // Use this to determine which FileTransferClient to load
import {FileTransferClient as ReplFileTransferClient} from '../common/repl-file-transfer.js';
import {FileTransferClient as FSAPIFileTransferClient} from '../common/fsapi-file-transfer.js';
import { isChromeOs, isMicrosoftWindows } from '../common/utilities.js';

let btnRequestSerialDevice, btnSelectHostFolder, btnUseHostFolder, lblWorkingfolder;

class USBWorkflow extends Workflow {
    constructor() {
        super();
        this._serialDevice = null;
        this.titleMode = false;
        this.reader = null;
        this.writer = null;
        this.connectDialog = new GenericModal("usb-connect");
        this.infoDialog = new DeviceInfoModal("device-info");
        this._fileContents = null;
        this.type = CONNTYPE.Usb;
        this._partialToken = null;
        this._uid = null;
        this._readLoopPromise = null;
        this._messageCallback = null;
        this._btnSelectHostFolderCallback = null;
        this._btnUseHostFolderCallback = null;
        this.buttonStates = [
            {request: false, select: false},
            {request: true, select: false},
            {request: false, select: true},
        ];
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
        this.debugLog("connected");
        super.onConnected(e);
    }

    async onDisconnected(e, reconnect = true) {
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (error) {
                console.warn("Error calling reader.cancel:", error);
            }
            this.reader = null;
        }
        if (this.writer) {
            try {
                await this.writer.releaseLock();
            } catch (error) {
                console.warn("Error calling writer.releaseLock:", error);
            }
            this.writer = null;
        }

        if (this._serialDevice) {
            try {
                await this._serialDevice.close();
            } catch (error) {
                console.warn("Error calling _serialDevice.close:", error);
            }
            this._serialDevice = null;
        }

        super.onDisconnected(e, reconnect);
    }

    async serialTransmit(msg) {
        const encoder = new TextEncoder();
        if (this.writer) {
            const encMessage = encoder.encode(msg);
            await this.writer.ready.catch((err) => {
                console.error(`Ready error: ${err}`);
            });
            await this.writer.write(encMessage).catch((err) => {
                console.error(`Chunk error: ${err}`);
            });
            await this.writer.ready;
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
        // There's no way to reference a specific port, so we just hope the user
        // only has a single device stored and connected. However, we can check that
        // the device on the stored port is currently connected by checking if the
        // readable and writable properties are null.

        // Can throw a Security Error if permissions are not granted
        let allDevices = await navigator.serial.getPorts();
        let connectedDevices = [];
        for (let device of allDevices) {
            let devInfo = await device.getInfo();
            if (devInfo.readable && devInfo.writable) {
                connectedDevices.push(device);
            }
        }
        let device = null;

        if (connectedDevices.length == 1) {
            device = connectedDevices[0];
            deviceInfo = await device.getInfo()
            console.log(`Got previously connected device: ${deviceInfo}`);
            try {
                // Attempt to connect to the saved device. If it's not found, this will fail.
                await this._switchToDevice(device);
            } catch (e) {
                // We should probably remove existing devices if it fails here
                await device.forget();

                console.log("Failed to automatically connect to saved device. Prompting user to select a device.");
                // If the user doesn't select a port, an exception is thrown
                device = await navigator.serial.requestPort();
            }
        } else {
            console.log('No previously connected device. Prompting user to select a device.');
            // If the user doesn't select a port, an exception is thrown
            device = await navigator.serial.requestPort();
        }
        console.log(`Selected device: ${device}`);


        // If we didn't automatically use a saved device
        if (!this._serialDevice) {
            console.log('> Requested ', device);
            await this._switchToDevice(device);
        }

        if (this._serialDevice != null) {
            console.log(`Current serial device is: ${this._serialDevice}. Proceeding to step 2.`);
            this.connectionStep(2);
            return true;
        }
        console.log("Couldn't connect to serial port");
        return false;
    }

    async showConnect(documentState) {
        let p = this.connectDialog.open();
        let modal = this.connectDialog.getModal();
        btnRequestSerialDevice = modal.querySelector('#requestSerialDevice');
        btnSelectHostFolder = modal.querySelector('#selectHostFolder');
        btnUseHostFolder = modal.querySelector('#useHostFolder');
        lblWorkingfolder = modal.querySelector('#workingFolder');

        // Map the button states to the buttons
        this.connectButtons = {
            request: btnRequestSerialDevice,
            select: btnSelectHostFolder,
        };

        btnRequestSerialDevice.disabled = true;
        btnSelectHostFolder.disabled = true;
        this.clearConnectStatus();
        let serialConnect = async (event) => {
            try {
                this.clearConnectStatus();
                await this.connectToSerial();
            } catch (e) {
                console.log('connectToSerial() returned error: ', e);
                this.showConnectStatus(this._suggestSerialConnectActions(e));
            }
        };
        btnRequestSerialDevice.removeEventListener('click', serialConnect);
        btnRequestSerialDevice.addEventListener('click', serialConnect);

        btnSelectHostFolder.removeEventListener('click', this._btnSelectHostFolderCallback)
        this._btnSelectHostFolderCallback = async (event) => {
            try {
                this.clearConnectStatus();
                await this._selectHostFolder();
            } catch (e) {
                this.showConnectStatus(this._suggestFileConnectActions(e));
        }
        };
        btnSelectHostFolder.addEventListener('click', this._btnSelectHostFolderCallback);


        btnUseHostFolder.removeEventListener('click', this._btnUseHostFolderCallback);
        this._btnUseHostFolderCallback = async (event) => {
            await this._useHostFolder();
        }
        btnUseHostFolder.addEventListener('click', this._btnUseHostFolderCallback);

        // Check if WebSerial is available
        if (!(await this.available() instanceof Error)) {
            // If so, hide the WebSerial Unavailable Message
            let stepOne;
            if (stepOne = modal.querySelector('.step:first-of-type')) {
                stepOne.classList.add("hidden");
            }
            this.connectionStep(1);
        } else {
            // If not, hide all steps beyond the message
            modal.querySelectorAll('.step:not(:first-of-type)').forEach((stepItem) => {
                stepItem.classList.add("hidden");
            });
            this.connectionStep(0);
        }

        // Hide the last step until we determine that we need it
        let lastStep;
        if (lastStep = modal.querySelector('.step:last-of-type')) {
            lastStep.classList.add("hidden");
        }

        // TODO: If this is closed before all steps are completed (when using FSAPI), we should close the
        // serial connection probably by calling onDisconnect()

        return await p;
    }

    async available() {
        if (!('serial' in navigator)) {
            return Error("Web Serial is not enabled in this browser");
        }
        return true;
    }

    // FSAPI specific functions
    async _selectHostFolder() {
        console.log('Initializing File Transfer Client...');
        const fileClient = this.fileHelper.getFileClient();
        const changed = await fileClient.loadDirHandle(false);
        if (changed) {
            await this._hostFolderChanged();
        }
    }

    async _useHostFolder() {
        await this.fileHelper.listDir('/');
        this.onConnected();
    }

    async _hostFolderChanged() {
        const fileClient = this.fileHelper.getFileClient();
        const folderName = fileClient.getWorkingDirectoryName();
        console.log("New folder name:", folderName);
        if (folderName) {
            // Set the working folder label
            if (isMicrosoftWindows() || isChromeOs()) {
                lblWorkingfolder.innerHTML = "OK";
            } else {
                lblWorkingfolder.innerHTML = `Use ${folderName}`;
            }
            btnUseHostFolder.classList.remove("hidden");
            btnSelectHostFolder.innerHTML = "Select Different Folder";
            btnSelectHostFolder.classList.add("inverted");
            btnSelectHostFolder.classList.remove("first-item");
        }
    }

    // Workflow specific Functions
    async _switchToDevice(device) {
        device.removeEventListener("message", this._messageCallback);
        this._messageCallback = this.onSerialReceive.bind(this);
        device.addEventListener("message", this._messageCallback);

        let onDisconnect = async (e) => {
            try {
                await this.onDisconnected(e, false);
            } catch (error) {
                console.warn("Error calling onDisconnected (maybe already disconnected):", error);
            }
        };
        device.removeEventListener("disconnect", onDisconnect);
        device.addEventListener("disconnect", onDisconnect);

        this._serialDevice = device;
        console.log("switch to", this._serialDevice);
        await this._serialDevice.open({baudRate: 115200}); // Throws if something else is already connected or it isn't found.
        console.log("Starting Read Loop");
        this._readLoopPromise = this._readSerialLoop().catch(
            async function(error) {
                await this.onDisconnected();
            }.bind(this)
        );

        if (this._serialDevice.writable) {
            this.writer = this._serialDevice.writable.getWriter();
            await this.writer.ready;
        }

        this.updateConnected(CONNSTATE.connected);

        // At this point we should see if we should init the file client and check if have a saved dir handle
        let fileops = new FileOps(this.repl, false);
        if (await this.showBusy(fileops.isReadOnly())) {
            // UID Only needed for matching the CIRCUITPY drive with the Serial Terminal
            await this.showBusy(this._getDeviceUid());
            let modal = this.connectDialog.getModal();

            // Show the last step
            let lastStep;
            if (lastStep = modal.querySelector('.step:last-of-type')) {
                lastStep.classList.remove("hidden");
            }

            // File System is read only, so we'll assume there is a CIRCUITPY drive mounted
            this.initFileClient(new FSAPIFileTransferClient(this.connectionStatus.bind(this), this._uid));
            const fileClient = this.fileHelper.getFileClient();
            const result = await fileClient.loadSavedDirHandle();
            if (result) {
                console.log("Successfully loaded directory:", fileClient.getWorkingDirectoryName());
                await this._hostFolderChanged();
            } else {
                console.log("Failed to load directory");
            }
        } else {
            // File System is writable, so we can use the REPL File Transfer Client
            this.initFileClient(new ReplFileTransferClient(this.connectionStatus.bind(this), this.repl));
            //await this.fileHelper.listDir('/');
            this.onConnected();
        }
    }

    async _getDeviceUid() {
        // TODO: Make this python code more robust for older devices
        // For instance what if there is an import error with binascii
        // or uid is not set due to older firmware
        // or microcontroller is a list
        // It might be better to take a minimal python approach and do most of
        // the conversion in the javascript code

        console.log("Getting Device UID...");
        let result = await this.repl.runCode(
`import microcontroller
import binascii
print(binascii.hexlify(microcontroller.cpu.uid).decode('ascii').upper())`
        );
        // Strip out whitespace as well as start and end quotes
        if (result) {
            this._uid = result.trim().slice(1, -1);
            console.log("Device UID: " + this._uid);
            this.debugLog("Device UID: " + this._uid)
        } else {
            console.log("Failed to get Device UID, result was", result);
        }
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

    // Analyzes the error returned from the WebSerial API and returns human readable feedback.
    _suggestSerialConnectActions(error) {
        if (error.name == "NetworkError" && error.message.includes("Failed to open serial port")) {
            return "The serial port could not be opened. Make sure the correct port is selected and no other program is using it. For more information, see the JavaScript console.";
        } else if (error.name == "NotFoundError" && error.message.includes("No port selected")) {
            return "No serial port was selected. Press the 'Connect to Device' button to try again.";
        } else if (error.name == "SecurityError") {
            return "Permissions to access the serial port were not granted. Please check your browser settings and try again.";
        }
        return `Connect to Serial Port returned error: ${error}`;
    }

    // Analyzes the error from the FSAPI and returns human readable feedback
    _suggestFileConnectActions(error) {
        if (error.name == "SecurityError") {
            return "Permissions to access the filesystem were not granted. Please check your browser settings and try again.";
        } else if (error.name == "AbortError") {
            return "No folder selected. Press the 'Select New Folder' button to try again.";
        } else if (error.name == "TypeError")
        return `Connect to Filesystem returned error: ${error}`;

    }

    async showInfo(documentState) {
        return await this.infoDialog.open(this, documentState);
    }
}

export {USBWorkflow};
