import {FileTransferClient as BLEFileTransferClient} from '@adafruit/ble-file-transfer-js';
//import {FileTransferClient as BLEFileTransferClient} from '../../../ble-file-transfer-js/adafruit-ble-file-transfer.js';

// Wrapper for BLEFileTransferClient to add additional functionality
class FileTransferClient extends BLEFileTransferClient {
    constructor(bleDevice, bufferSize) {
        super(bleDevice, bufferSize);
    }

    async readOnly() {
        // Probe whether the BLE filesystem accepts writes.
        //
        // We can't rely on a specific firmware status code: older CircuitPython
        // returned STATUS_ERROR_READONLY (0x05), but recent versions collapse that
        // into STATUS_ERROR (0x02) on some code paths (see issue #376 and
        // adafruit/circuitpython#10972). Instead, attempt to create and delete a
        // hidden zero-byte file at the root and treat any failure as read-only.
        const testPath = '/._ble_readonly_check';
        let readonly = false;
        let wrote = false;
        try {
            await this.writeFile(testPath, 0, new Uint8Array(0));
            wrote = true;
        } catch (e) {
            readonly = true;
        }
        if (wrote) {
            // Best-effort cleanup; if the delete fails we still consider the FS
            // writable since the write succeeded.
            try {
                await this.deleteFile(testPath);
            } catch (e) {
                console.warn("Failed to clean up read-only probe file:", e);
            }
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