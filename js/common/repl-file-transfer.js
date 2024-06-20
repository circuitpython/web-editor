import {FileOps} from '@adafruit/circuitpython-repl-js';

class FileTransferClient {
    constructor(connectionStatusCB, repl) {
        this.connectionStatus = connectionStatusCB;
        this._dirHandle = null;
        this._fileops = new FileOps(repl, false);
        this._isReadOnly = null;
    }

    async readOnly() {
        await this._checkConnection();
        return this._isReadOnly;
    }

    async _checkConnection() {
        if (!this.connectionStatus(true)) {
            throw new Error("Unable to perform file operation. Not Connected.");
        }

        if (this._isReadOnly === null) {
            this._isReadOnly = await this._fileops.isReadOnly();
        }
    }

    async _checkWritable() {
        if (await this.readOnly()) {
            throw new Error("File System is Read Only.");
        }
    }

    async readFile(path, raw = false) {
        await this._checkConnection();
        let contents = await this._fileops.readFile(path, raw);
        if (contents === null) {
            return raw ? null : "";
        }
        return contents;
    }

    async writeFile(path, offset, contents, modificationTime, raw = false) {
        await this._checkConnection();
        await this._checkWritable();

        if (!raw) {
            let encoder = new TextEncoder();
            let same = contents.slice(0, offset);
            let different = contents.slice(offset);
            offset = encoder.encode(same).byteLength;
            contents = encoder.encode(different);
        } else if (offset > 0) {
            contents = contents.slice(offset);
        }

        return await this._fileops.writeFile(path, contents, offset, modificationTime, raw);
    }

    async makeDir(path, modificationTime = Date.now()) {
        await this._checkConnection();
        await this._checkWritable();

        return await this._fileops.makeDir(path, modificationTime);
    }

    // Returns an array of objects, one object for each file or directory in the given path
    async listDir(path) {
        await this._checkConnection();
        return await this._fileops.listDir(path);
    }

    // Deletes the file or directory at the given path. Directories must be empty.
    async delete(path) {
        await this._checkConnection();
        await this._checkWritable();

        return await this._fileops.delete(path);
    }

    // Moves the file or directory from oldPath to newPath.
    async move(oldPath, newPath) {
        await this._checkConnection();
        await this._checkWritable();

        return await this._fileops.move(oldPath, newPath);
    }

    async versionInfo() {
        // Possibly open /boot_out.txt and read the version info
        let versionInfo = {};
        console.log("Reading version info");
        let bootout = await this.readFile('/boot_out.txt', false);
        console.log(bootout);
        if (!bootout) {
            return null;
        }

        // Add these items as they are found
        const searchItems = {
            version: /Adafruit CircuitPython (.*?) on/,
            build_date: /on ([0-9]{4}-[0-9]{2}-[0-9]{2});/,
            board_name: /; (.*?) with/,
            mcu_name: /with (.*?)\r?\n/,
            board_id: /Board ID:(.*?)\r?\n/,
            uid: /UID:([0-9A-F]{12})\r?\n/,
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
