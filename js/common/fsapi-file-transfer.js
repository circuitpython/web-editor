import { get, set } from 'idb-keyval';

class FileTransferClient {
    constructor(connectionStatusCB, uid) {
        this.connectionStatus = connectionStatusCB;
        this._dirHandle = null;
        this._uid = uid;
    }

    async readOnly() {
        return await this._readOnly();
    }

    async _readOnly(path = null) {
        await this._checkConnection();

        let folderHandle = this._dirHandle;
        if (path) {
            folderHandle = await this._getSubfolderHandle(path);
        }

        return !(await this._verifyPermission(folderHandle));
    }

    async _checkConnection() {
        if (!this.connectionStatus(true)) {
            throw new Error("Unable to perform file operation. Not Connected.");
        }

        if (!this._dirHandle) {
            await this.loadDirHandle();

            if (this._dirHandle) {
                const info = await this.versionInfo();
                console.log(info);
                console.log("Found via REPL: " + this._uid);
                if (info) {
                    console.log("Found via boot_out.txt: " + info.uid);
                } else {
                    console.log("Unable to read boot_out.txt");
                }

                // TODO: This needs to be more reliable before we stop the user from continuing
                if (info && info.uid && this._uid) {
                    if (this._uid == info.uid) {
                        console.log("UIDs found in REPL and boot_out.txt match!");
                    }
                }

                if (!info === null) {
                    // We're likely not in the root directory of the device because
                    // boot_out.txt probably wasn't found
                }

                // TODO: Verify this is a circuitpython drive
                // Perhaps check boot_out.txt, Certain structural elements, etc.
                // Not sure how to verify it's the same device that we are using webserial for
                // Perhaps we can match something in boot_out.txt to the device name

                // For now we're just going to trust the user
            }
        }

        if (!this._dirHandle) {
            throw new Error("Unable to perform file operation. No Working Folder Selected.");
        }
    }

    async loadSavedDirHandle() {
        try {
            const savedDirHandle = await get('usb-working-directory');
            // Request permission to make it writable
            if (savedDirHandle && (await this._verifyPermission(savedDirHandle))) {
                // Check if the stored directory is available. It will fail if not.
                await savedDirHandle.getFileHandle("boot_out.txt");
                this._dirHandle = savedDirHandle;
                return true;
            }
        } catch (e) {
            console.error("Unable to access boot_out.txt in saved directory handle:", e);
        }
        return false;
    }

    async loadDirHandle(preferSaved = true) {
        if (preferSaved) {
            const result = await this.loadSavedDirHandle();
            if (!result) {
                return true;
            }
        }

        const dirHandle = await window.showDirectoryPicker({mode: 'readwrite'});
        if (dirHandle) {
            await set('usb-working-directory', dirHandle);
            this._dirHandle = dirHandle;
            return true;
        }
        return false;
    }

    getWorkingDirectoryName() {
        if (this._dirHandle) {
            return this._dirHandle.name;
        }
        return null;
    }

    async _verifyPermission(folderHandle) {
        const options = {mode: 'readwrite'};

        if (await folderHandle.queryPermission(options) === 'granted') {
            return true;
        }

        if (await folderHandle.requestPermission(options) === 'granted') {
            return true;
        }

        return false;
    }

    async readFile(path, raw = false) {
        await this._checkConnection();

        const [folder, filename] = this._splitPath(path);

        try {
            const folderHandle = await this._getSubfolderHandle(folder);
            const fileHandle = await folderHandle.getFileHandle(filename);
            const fileData = await fileHandle.getFile();

            return raw ? fileData : await fileData.text();
        } catch (e) {
            return raw ? null : "";
        }
    }

    async _checkWritable() {
        if (await this.readOnly()) {
            throw new Error("File System is Read Only.");
        }
    }

    async writeFile(path, offset, contents, modificationTime = null, raw = false) {
        await this._checkConnection();
        await this._checkWritable();

        /*if (modificationTime) {
            console.warn("Setting modification time not currently supported in USB Workflow.");
        }*/

        if (!raw) {
            let encoder = new TextEncoder();
            let same = contents.slice(0, offset);
            let different = contents.slice(offset);
            offset = encoder.encode(same).byteLength;
            contents = encoder.encode(different);
        } else if (offset > 0) {
            contents = contents.slice(offset);
        }

        const [folder, filename] = this._splitPath(path);

        const folderHandle = await this._getSubfolderHandle(folder);
        const fileHandle = await folderHandle.getFileHandle(filename, {create: true});

        const writable = await fileHandle.createWritable();
        if (offset > 0) {
            await writable.seek(offset);
        }
        await writable.write(contents);
        await writable.close();
    }

    _splitPath(path) {
        let pathParts = path.split("/");
        const filename = pathParts.pop();
        const folder = pathParts.join("/");

        return [folder, filename];
    }

    // Makes the directory and any missing parents
    async makeDir(path, modificationTime = null) {
        await this._checkConnection();
        await this._checkWritable();

        if (modificationTime) {
            console.warn("Setting modification time not currently supported in USB Workflow.");
        }

        const [parentFolder, folderName] = this._splitPath(path);
        const parentFolderHandle = await this._getSubfolderHandle(parentFolder, true);

        for await (const [entryName, entryHandle] of parentFolderHandle.entries()) {
            if (entryName === folderName) {
                throw new Error("Folder already exists.");
            }
        }

        await parentFolderHandle.getDirectoryHandle(folderName, { create: true });

        return true;
    }

    // Returns an array of objects, one object for each file or directory in the given path
    async listDir(path, subfolderHandle=null) {
        await this._checkConnection();

        let contents = [];
        if (!subfolderHandle) {
            subfolderHandle = await this._getSubfolderHandle(path);
        }

        // Get all files and folders in the folder
        for await (const [filename, entryHandle] of subfolderHandle.entries()) {
            let result = null;
            if (entryHandle.kind === 'file') {
                result = await entryHandle.getFile();
                contents.push({
                    path: result.name,
                    isDir: false,
                    fileSize: result.size,
                    fileDate: Number(result.lastModified),
                });
            } else if (entryHandle.kind === 'directory') {
                result = await entryHandle;
                contents.push({
                    path: result.name,
                    isDir: true,
                    fileSize: 0,
                    fileDate: null,
                });
            }
        }

        return contents;
    }

    async _getSubfolderHandle(path, createIfMissing = false) {
        if (!path.length || path.substr(-1) != "/") {
            path += "/";
        }

        // Navigate to folder
        let currentDirHandle = this._dirHandle;
        const subfolders = path.split("/").slice(1, -1);
        let currentPath = "/";

        if (subfolders.length) {
            for (const subfolder of subfolders) {
                try {
                    if ((await this._getItemKind(currentDirHandle, subfolder)) === 'directory') {
                        currentDirHandle = await currentDirHandle.getDirectoryHandle(subfolder, {create: !this.readOnly() && createIfMissing});
                        currentPath += subfolder + "/";
                    } else {
                        return currentDirHandle;
                    }
                } catch (e) {
                    if (e.name === 'NotFoundError') {
                        throw new Error(`Folder ${subfolder} not found in ${currentPath}`);
                    } else {
                        console.log(e.name);
                        throw e;
                    }
                }
            }
        }

        return currentDirHandle;
    }

    async _getItemKind(directoryHandle, itemName) {
        for await (const [filename, entryHandle] of directoryHandle.entries()) {
            if (filename === itemName) {
                return entryHandle.kind;
            }
        }

        return null;
    }

    // Deletes the file or directory at the given path. Directories must be empty.
    async delete(path) {
        await this._checkConnection();
        await this._checkWritable();

        const [parentFolder, itemName] = this._splitPath(path);
        const parentFolderHandle = await this._getSubfolderHandle(parentFolder);

        await parentFolderHandle.removeEntry(itemName);

        return true;
    }

    // Moves the file or directory from oldPath to newPath.
    async move(oldPath, newPath) {
        await this._checkConnection();
        await this._checkWritable();

        // Check that this is a file and not a folder
        const [oldPathFolder, oldItemName] = this._splitPath(oldPath);
        const oldPathHandle = await this._getSubfolderHandle(oldPathFolder);
        if (await this._getItemKind(oldPathHandle, oldItemName) == "directory") {
            throw new Error("Folder moving is not supported.");
        }

        // Copy the fileby reading from the old path and writing to the new one
        const fileData = await this.readFile(oldPath, true);
        await this.writeFile(newPath, 0, fileData, null, true);

        // Delete the old file
        await this.delete(oldPath);

        console.warn(`Attempting to Move from ${oldPath} to ${newPath}`);

        return true;
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
