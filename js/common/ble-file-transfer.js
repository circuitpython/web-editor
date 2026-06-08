import {FileTransferClient as BLEFileTransferClient} from '@adafruit/ble-file-transfer-js';
//import {FileTransferClient as BLEFileTransferClient} from '../../../ble-file-transfer-js/adafruit-ble-file-transfer.js';

// Wrapper for BLEFileTransferClient to add additional functionality.
// Optionally accepts a workflow reference so that mutating ops can notify
// the workflow about the impending firmware autoreload (see
// circuitpython/web-editor#377).
//
// Mutating ops (write/move/delete/mkdir) trigger a CircuitPython VM
// autoreload, which kills the GATT connection. We hold the op's promise
// open until either (a) the connection is restored, or (b) the silent
// reconnect window expires, so callers like FileDialog can chain
// `await fileHelper.move(...); await this._openFolder();` without
// blowing up on a torn-down GATT in the second await.
class FileTransferClient extends BLEFileTransferClient {
    constructor(bleDevice, bufferSize, workflow = null) {
        super(bleDevice, bufferSize);
        this._workflow = workflow;
    }

    _signalMutatingOp() {
        if (this._workflow && typeof this._workflow.markMutatingOp === 'function') {
            this._workflow.markMutatingOp();
        }
    }

    async _awaitReconnectIfNeeded() {
        if (this._workflow && typeof this._workflow.awaitPostOpReconnect === 'function') {
            await this._workflow.awaitPostOpReconnect();
        }
    }

    async writeFile(path, offset, contents, modificationTime, raw) {
        this._signalMutatingOp();
        const result = await super.writeFile(path, offset, contents, modificationTime, raw);
        await this._awaitReconnectIfNeeded();
        return result;
    }

    async move(oldPath, newPath) {
        this._signalMutatingOp();
        const result = await super.move(oldPath, newPath);
        await this._awaitReconnectIfNeeded();
        return result;
    }

    async delete(path) {
        this._signalMutatingOp();
        const result = await super.delete(path);
        await this._awaitReconnectIfNeeded();
        return result;
    }

    async makeDir(path, modificationTime) {
        this._signalMutatingOp();
        const result = await super.makeDir(path, modificationTime);
        await this._awaitReconnectIfNeeded();
        return result;
    }

    async readOnly() {
        let readonly = false;
        return false;
        // Check if the device is read only
        console.log("Checking if device is read only");
        // Attempt to write a 0-byte temp file and remove it
        const testPath = '/._ble_readonly_check';
        try {
            await this.writeFile(testPath, 0, new Uint8Array(0));
            await this.deleteFile(testPath);
        } catch (e) {
            readonly = true;
        }
        return readonly;
    }

    async versionInfo() {
        // Possibly open /boot_out.txt and read the version info
        let versionInfo = {};
        console.log("Reading version info");
        let bootout = await this.readFile('/boot_out.txt', false);
        console.log(bootout);
        if (!bootout) {
            console.error("Unable to read boot_out.txt");
            return null;
        }
        bootout += "\n";

        // Add these items as they are found
        const searchItems = {
            version: /Adafruit CircuitPython (.*?) on/,
            build_date: /on ([0-9]{4}-[0-9]{2}-[0-9]{2});/,
            board_name: /; (.*?) with/,
            mcu_name: /with (.*?)\r?\n/,
            board_id: /Board ID:(.*?)\r?\n/,
            uid: /UID:([0-9A-F]{12,16})\r?\n/,
        }

        for (const [key, regex] of Object.entries(searchItems)) {
            const match = bootout.match(regex);

            if (match) {
                versionInfo[key] = match[1];
            }
        }

        return versionInfo;
    }
}

export {FileTransferClient};