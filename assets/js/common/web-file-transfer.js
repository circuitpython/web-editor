class FileTransferClient {
    constructor(hostname, connectionStatusCB) {
        this.hostname = hostname;
        this.connectionStatus = connectionStatusCB;
    }

    async checkConnection() {
        if (!this.connectionStatus()) {
            throw new Error("Unable to perform file operation. Not Connected");
        }
    }

    async readFile(filename) {
        await this.checkConnection();
        const response = await this.fetch(`/fs${filename}`);
        return response.status === 200 ? await response.text() : "";
    }

    async writeFile(path, offset, contents, modificationTime) {
        let options = {
            method: 'PUT',
            body: contents,
            headers: {
                "X-Timestamp": modificationTime
            }
        }

        await this.checkConnection();
        const response = await this.fetch(`/fs${path}`, options);
        return await response.text();
    }

    // Makes the directory and any missing parents
    async makeDir(path, modificationTime) {
        await this.checkConnection();
        return true;
    }

    async fetch(location, options = {}) {
        let fetchOptions = {
            headers: {},
            credentials: 'include',
            ...options
        }

        return await fetch(new URL(location, `http://${this.hostname}`), fetchOptions);
    }

    // Returns a list of tuples, one tuple for each file or directory in the given path
    async listDir(path) {
        await this.checkConnection();

        let paths = [];
        if (!path.length || path.substr(-1) != "/") {
            path += "/";
        }

        const response = await this.fetch(`/fs${path}`, {headers: {"Accept": "application/json"}});
        const results = await response.json();
        for (let result of results) {
            paths.push({
                path: result.name,
                isDir: result.directory,
                fileSize: result.file_size,
                fileDate: Number(result.modified_ns / 1000000),
            });
        }
        
        return paths;
    }

    // Deletes the file or directory at the given path. Directories must be empty.
    async delete(path) {
        await this.checkConnection();
        return true;
    }

    // Moves the file or directory from oldPath to newPath.
    async move(oldPath, newPath) {
        await this.checkConnection();
        /* Since no move feature exists in CircuitPython, this may be able to be 
        accomplished for files only with the following strategy:
            1. Get file info and verify this is a file with listDir()
            2. Read file into memory with readFile()
            3. Write file to new location using file info in step 1 using writeFile()
                3a. If insufficient space, delete file copy, set error, and return false
            4. Delete old file using delete() and return true
        */
        return true;
    }
}

export {FileTransferClient}