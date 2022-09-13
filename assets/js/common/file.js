// This is a wrapper that builds on top of file transfer clients
// with a common set of additional functions
class FileHelper {
    constructor(fileClient) {
        this.readFile = fileClient.readFile.bind(fileClient);
        this._writeFile = fileClient.writeFile.bind(fileClient);
        this.listDir = fileClient.listDir.bind(fileClient);
        this.makeDir = fileClient.makeDir.bind(fileClient);
        this.move = fileClient.move.bind(fileClient);
        this.delete = fileClient.delete.bind(fileClient);
        if (fileClient.readOnly !== undefined) {
            this.readOnly = fileClient.readOnly.bind(fileClient);
        } else {
            this.readOnly = this._falseFunction;
        }
        if (fileClient.versionInfo !== undefined) {
            this.versionInfo = fileClient.versionInfo.bind(fileClient);
        } else {
            this.versionInfo = this._nullFunction;
        }
        if (fileClient.bond !== undefined) {
            this.bond = fileClient.bond.bind(fileClient);
        } else {
            this.bond = this._nullFunction;
        }
        if (fileClient.otherDevices !== undefined) {
            this.otherDevices = fileClient.otherDevices.bind(fileClient);
        } else {
            this.otherDevices = this._nullFunction;
        }
    }

    async _nullFunction() {
        return null;
    }

    async _falseFunction() {
        return false;
    }

    async fileExists(path) {
        // Get the current path
        let pathParts = path.split("/");
        const filename = pathParts.pop();
        const folder = pathParts.join("/");
    
        // Get a list of files in current path
        const files = await this.listDir(folder);
    
        // See if the file is in the list of files
        for (let fileObj of files) {
            if (fileObj.path[0] == ".") continue;
            if (fileObj.path == filename) {
                return true;
            }
        }
        return false;
    }

    async writeFile(path, offset, contents, modificationTime=Date.now(), raw=false) {
        try {
            await this._writeFile(path, offset, contents, modificationTime, raw);
        } catch(e) {
            return false;
        }
        return true;
    }

    async findContainedFiles(containingFolder, relative=false) {
        return await this._findFiles(containingFolder, relative);
    }

    async _findFiles(containingFolder, relative, rootFolder=null) {
        let paths = [];
        if (!rootFolder) rootFolder = containingFolder;
        const files = await this.listDir(containingFolder);
        for (let fileObj of files) {
            if (fileObj.path[0] == ".") continue;
            if (fileObj.isDir) {
                paths.push(...(await this._findFiles(containingFolder + fileObj.path + "/", relative, rootFolder)));
            } else if (relative) {
                paths.push((containingFolder + fileObj.path).slice(rootFolder.length));
            } else {
                paths.push(containingFolder + fileObj.path);
            }
        }
        return paths;
    }

}

export {FileHelper}