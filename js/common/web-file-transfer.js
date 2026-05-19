class FileTransferClient {
    constructor(hostname, connectionStatusCB) {
        this.hostname = hostname;
        this.connectionStatus = connectionStatusCB;
        this._allowedMethods = null;
        // Cached `writable` flag from the /fs/ JSON response. Populated by
        // listDir() and by readOnly() when listDir hasn't been called yet.
        // A new FileTransferClient is created on every (re)connect, so this
        // cache resets naturally with the connection lifecycle.
        this._writable = null;
    }

    async readOnly() {
        await this._checkConnection();
        // Older CircuitPython releases advertised DELETE in OPTIONS even when
        // the filesystem was actually read-only (USB had it), so we use the
        // `writable` field from the /fs/ JSON response instead -- same source
        // of truth as circup. If we already pulled it via listDir, reuse it.
        if (this._writable === null) {
            const response = await this._fetch("/fs/", {method: "GET", headers: {"Accept": "application/json"}});
            const result = await response.json();
            this._writable = result.writable === true;
        }
        return !this._writable;
    }

    async _checkConnection() {
        if (!this.connectionStatus() && this._allowedMethods !== null) {
            throw new Error("Unable to perform file operation. Not Connected.");
        }

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

    // Build a ProtocolError-shaped error that callers can recognize as
    // "the device's filesystem is currently held by something else"
    // (typically USB MSC). Tagged identically to the runtime PUT 409/500
    // path so `saveFileContents()` can show the same actionable dialog
    // whether the check trips on the cached writable flag or on the
    // actual response from the device.
    _writeProtectedError() {
        const err = new ProtocolError("File System is Read Only.");
        err.status = 409;
        err.writeProtected = true;
        err.hint = "The board's filesystem is currently locked, " +
                   "usually because CIRCUITPY is mounted on a " +
                   "computer over USB. Disconnect the USB cable, " +
                   "or disable USB Mass Storage in boot.py, then " +
                   "reset the board and try saving again. " +
                   "(Ejecting the drive in your OS may not be " +
                   "enough on its own.)";
        err.helpUrl = "https://learn.adafruit.com/getting-started-with-web-workflow-using-the-code-editor/device-setup#disabling-usb-mass-storage-3125964";
        err.helpLabel = "Disabling USB Mass Storage (Adafruit Learn)";
        return err;
    }

    async _checkWritable() {
        // Force a re-read of the writable flag so the user can recover
        // without disconnecting: if they just released the drive (or
        // disabled USB MSC and reset), the next save attempt should
        // succeed, not bounce off a stale `false` cache.
        this._writable = null;
        if (await this.readOnly()) {
            throw this._writeProtectedError();
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

        const response = await this._fetch(`/fs${path}`, options);
        return response.ok;
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
            if (!await this._isMethodAllowed(fetchOptions.method)) {
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
            // Attach the status code + a friendly hint when we recognize
            // the failure mode, so callers can branch on it (e.g. show an
            // actionable message and skip retries that won't help).
            const err = new ProtocolError(response.statusText || `HTTP ${response.status}`);
            err.status = response.status;
            err.method = (fetchOptions.method || "GET").toUpperCase();
            err.path = location;
            // /fs/ PUT against a write-protected filesystem currently returns
            // 500 on shipped CircuitPython firmware. A fix is pending to
            // return 409 Conflict (matching DELETE / MOVE / mkdir-PUT in
            // the same file). Treat both the same way until enough users
            // are on the patched firmware that 500 can be left generic.
            const isFsWrite = err.method === "PUT" &&
                              typeof location === "string" &&
                              location.startsWith("/fs/");
            if (isFsWrite && (response.status === 409 || response.status === 500)) {
                // Reuse the same wording/hint as the cached-flag
                // _checkWritable() path, so users see one consistent
                // message regardless of which layer caught the lock.
                const wp = this._writeProtectedError();
                err.writeProtected = true;
                err.hint = wp.hint;
                err.helpUrl = wp.helpUrl;
                err.helpLabel = wp.helpLabel;
            }
            throw err;
        }

        return response;
    }

    async _isMethodAllowed(method) {
        if (this._allowedMethods) {
            return this._allowedMethods.includes(method.toUpperCase());
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
        // Cache the writable flag whenever the FS root response carries it,
        // so readOnly() doesn't need a separate round-trip.
        if (results.writable !== undefined) {
            this._writable = results.writable === true;
        }
        let listings = results;
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