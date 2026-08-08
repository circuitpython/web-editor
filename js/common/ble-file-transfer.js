import {FileTransferClient as BLEFileTransferClient} from '@adafruit/ble-file-transfer-js';
//import {FileTransferClient as BLEFileTransferClient} from '../../../ble-file-transfer-js/adafruit-ble-file-transfer.js';

// Wrapper that holds mutating-op promises open across the firmware
// autoreload + silent reconnect, so callers see a live GATT on return.
// See circuitpython/web-editor#377.
class FileTransferClient extends BLEFileTransferClient {
    constructor(bleDevice, bufferSize, workflow = null) {
        super(bleDevice, bufferSize);
        this._workflow = workflow;
        this._bleDevice = bleDevice;
    }

    // Reject a read if the GATT link is already down, or drops while it is in
    // flight, instead of returning a promise that can never settle.
    //
    // Upstream readFile()/listDir() install their promise's reject handler
    // AFTER writing the request:
    //
    //     await this._write(header);
    //     await this._write(encoded);
    //     let p = new Promise((resolve, reject) => {
    //         this._resolve = resolve;
    //         this._reject = reject;      // too late
    //     });
    //
    // On a dead link `_transfer` is null, so both writes throw; _write()
    // swallows the error and calls onDisconnected(), which has no `_reject` to
    // call yet. checkConnection() likewise catches its own failure and returns
    // normally rather than rethrowing, so the read proceeds regardless. The
    // returned promise is then never settled by anyone and the caller hangs --
    // which is what left the editor spinning on "Current Device Info".
    //
    // Bound on liveness rather than elapsed time: a large file read over BLE can
    // legitimately take tens of seconds, so a stopwatch would produce false
    // failures, while a dropped link is unambiguous.
    _whileConnected(operation) {
        const device = this._bleDevice;
        if (!device || !device.gatt || !device.gatt.connected) {
            return Promise.reject(new Error("Bluetooth device is not connected"));
        }
        return new Promise((resolve, reject) => {
            const onDisconnected = () => reject(new Error("Bluetooth device disconnected"));
            device.addEventListener("gattserverdisconnected", onDisconnected, {once: true});
            operation().then(resolve, reject).finally(() => {
                device.removeEventListener("gattserverdisconnected", onDisconnected);
            });
        });
    }

    async readFile(path, raw = false) {
        return await this._whileConnected(() => super.readFile(path, raw));
    }

    async listDir(path) {
        return await this._whileConnected(() => super.listDir(path));
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