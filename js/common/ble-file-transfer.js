import {FileTransferClient as BLEFileTransferClient} from '@adafruit/ble-file-transfer-js';

// Wrapper for BLEFileTransferClient to add additional functionality
class FileTransferClient extends BLEFileTransferClient {
    constructor(bleDevice, bufferSize) {
        super(bleDevice, bufferSize);
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