class FileTransferClient {
    constructor(hostname, connectionStatusCB) {
        this.hostname = hostname;
        this.connectionStatus = connectionStatusCB;
        this._allowedMethods = null;
    }

    async readOnly() {
        await this._checkConnection();
        console.log("Checking read only");
        const response = await this._fetch("/fs/", {method: "GET", headers: {"Accept": "application/json"}})
        const result = await response.json();
        //TODO: Tyeth: cache this value until reconnection, as listdir / connect already fetch it
        return result.writable === undefined || result.writable === false || !this._allowedMethods.includes("DELETE");
    }

    async _checkConnection() {
        if (!this.connectionStatus() && this._allowedMethods !== null) {
            throw new Error("Unable to perform file operation. Not Connected.");
        }

        //TODO: Tyeth: reset this on reconnection
        if (this._allowedMethods === null) {
            const status = await this._fetch("/fs/", {method: "OPTIONS"});
            this._allowedMethods = status.headers.get("Access-Control-Allow-Methods").split(/,/).map(method => {return method.trim().toUpperCase();});
        }
    }

    async readFile(path, raw = false) {
        return await this._readFile(path, raw, '/fs');
    }

    async _readFile(path, raw, rootDir) {
        await this._checkConnection();
        const response = await this._fetch(`${rootDir}${path}`);

        if (response.ok) {
            return raw ? await response.blob() : await response.text();
        } else {
            return raw ? null : "";
        }
    }

    async _checkWritable() {
        if (await this.readOnly()) {
            throw new Error("File System is Read Only. Try disabling the USB Drive.");
        }
    }

    async writeFile(path, offset, contents, modificationTime, raw = false) {
        await this._checkConnection();
        await this._checkWritable();

        let options = {
            method: 'PUT',
            body: contents,
            headers: {
                "X-Timestamp": modificationTime
            }
        };

        if (raw) {
            options.headers['Content-Type'] = "application/octet-stream";
        }

        await this._fetch(`/fs${path}`, options);
    }

    // Makes the directory and any missing parents
    async makeDir(path, modificationTime = Date.now()) {
        await this._checkConnection();
        await this._checkWritable();

        if (!path.length || path.substr(-1) != "/") {
            path += "/";
        }

        let options = {
            method: 'PUT',
            headers: {
                "X-Timestamp": modificationTime
            }
        };

        const response = await this._fetch(`/fs${path}`, options);
        return response.ok;
    }

    async _fetch(location, options = {}) {
        let response;
        let fetchOptions = {
            credentials: 'include',
            ...options
        };

        if (fetchOptions.method && fetchOptions.method.toUpperCase() != 'OPTIONS') {
            if (!this._isMethodAllowed(fetchOptions.method)) {
                if (fetchOptions.method.toUpperCase() == "MOVE") {
                    // This should only happen if rename is used and the user doesn't have latest version
                    console.warn("Please upgrade to the latest version of CircuitPython. Allowing MOVE for now.");
                } else {
                    throw new ProtocolError(`${fetchOptions.method} is not allowed.`);
                }
            }
        }

        try {
            response = await fetch(new URL(location, `http://${this.hostname}`), fetchOptions);
        } catch (error) {
            throw new ProtocolError(`Host '${this.hostname}' not found.`);
        }

        if (!response.ok) {
            throw new ProtocolError(response.statusText);
        }

        return response;
    }

    async _isMethodAllowed(method) {
        if (this._allowedMethods) {
            return this._allowedMethods.includes(method.toUpperCase);
        }

        return false;
    }

    // Returns an array of objects, one object for each file or directory in the given path
    async listDir(path) {
        await this._checkConnection();

        let contents = [];
        if (!path.length || path.substr(-1) != "/") {
            path += "/";
        }

        const response = await this._fetch(`/fs${path}`, {headers: {"Accept": "application/json"}});
        const results = await response.json();
        let listings = results
        if (results.files !== undefined) {
            listings = results.files;
        }
        for (let listing of listings) {
            contents.push({
                path: listing.name,
                isDir: listing.directory,
                fileSize: listing.file_size,
                fileDate: Number(listing.modified_ns / 1000000),
            });
        }

        return contents;
    }

    // Deletes the file or directory at the given path. Directories must be empty.
    async delete(path) {
        await this._checkConnection();
        await this._checkWritable();

        const response = await this._fetch(`/fs${path}`, {method: "DELETE"});
        return response.ok;
    }

    // Moves the file or directory from oldPath to newPath.
    async move(oldPath, newPath) {
        await this._checkConnection();
        await this._checkWritable();

        let options = {
            method: 'MOVE',
            headers: {
                "X-Destination": `/fs${newPath}`
            }
        };

        const response = await this._fetch(`/fs${oldPath}`, options);
        return response.ok;
    }

    async versionInfo() {
        let response = await this._readFile('/version.json', false, '/cp');
        if (!response) {
            return null;
        }

        return JSON.parse(response);
    }

    async otherDevices() {
        let response = await this._readFile('/devices.json', false, '/cp');
        if (!response) {
            return null;
        }

        return JSON.parse(response);
    }

    static async getRedirectedHost(host) {
        let versionResponse;
        try {
            versionResponse = await fetch(`http://${host}/cp/version.json`, {mode: "cors"});
        } catch (error) {
            //console.error(`Host '${host}' not found.`);
            throw new ProtocolError(`Host '${host}' not found.`);
        }
        return new URL("/", versionResponse.url).host;
    }
}

class ProtocolError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProtocolError";
    }
}

export {FileTransferClient, ProtocolError};