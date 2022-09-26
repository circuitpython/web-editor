class FileTransferClient {
    async readOnly() {
        return false;
    }

    async readFile(path, raw = false) {
        console.warn(`Attempting to Read from ${path}`);
        const textDecoder = new TextDecoder();

        let input = document.createElement("input");
        let contents;
        input.type = 'file';
        input.addEventListener('change', async (event) => {
            try {
                const readUploadedFileAsArrayBuffer = (inputFile) => {
                    const reader = new FileReader();

                    return new Promise((resolve, reject) => {
                        reader.onerror = () => {
                            reader.abort();
                            reject(new DOMException("Problem parsing input file."));
                        };

                        reader.onload = () => {
                            resolve(reader.result);
                        };
                        reader.readAsArrayBuffer(inputFile);
                    });
                };
                let files = Array.from(input.files);
                for (let [index, file] of files.entries()) {
                    contents = await readUploadedFileAsArrayBuffer(file);
                };

            } catch (error) {
                console.error(error);
            }
        });

        input.click();

        return raw ? new Blob(contents) : textDecoder.decode(contents);
    }

    async checkWritable() {
        return true;
    }

    async writeFile(path, offset, contents, modificationTime, raw = false) {
        // TODO: File download
        // Use raw to decided whether to send it through TextEncoder or not
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