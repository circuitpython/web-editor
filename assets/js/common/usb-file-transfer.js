class FileTransferClient {
    async readOnly() {
        return false;
    }

    async readFile(path, rawResponse = false, rootDir = '/fs') {
        console.warn(`Attempting to Read from ${path}`);
        // TODO: File upload
        return "";
    }

    async checkWritable() {
        return true;
    }

    async writeFile(path, offset, contents, modificationTime, raw = false) {
        // TODO: File download
        console.warn(`Attempting to Write at ${path}`);
    }

    // Makes the directory and any missing parents
    async makeDir(path, modificationTime = Date.now()) {
        console.error(`Attempting to Make Directory at ${path}`);
        return true;
    }

    // Returns a list of tuples, one tuple for each file or directory in the given path
    async listDir(path) {
        console.error(`Attempting to List Directory at ${path}`);
        return [];
    }

    // Deletes the file or directory at the given path. Directories must be empty.
    async delete(path) {
        console.error(`Attempting to Delete at ${path}`);
        return true;
    }

    // Moves the file or directory from oldPath to newPath.
    async move(oldPath, newPath) {
        console.error(`Attempting to Move from ${oldPath} to ${newPath}`);
        return true;

    }
}

export {FileTransferClient};