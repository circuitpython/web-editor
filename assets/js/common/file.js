// This is a wrapper that builds on top of file transfer clients
// with a common set of additional functions
class FileHelper {
    constructor(fileClient, showBusy) {
        this.readFile = fileClient.readFile.bind(fileClient);
        this.writeFile = fileClient.writeFile.bind(fileClient);
        this.listDir = fileClient.listDir.bind(fileClient);
        this.makeDir = fileClient.makeDir.bind(fileClient);
        this.move = fileClient.move.bind(fileClient);
        this.delete = fileClient.delete.bind(fileClient);
        this._showBusy = showBusy;
        if (fileClient.readOnly !== undefined) {
            this.readOnly = fileClient.readOnly.bind(fileClient);
        } else {
            this.readOnly = async () => { return false; }
        }
        if (fileClient.versionInfo !== undefined) {
            this.versionInfo = fileClient.versionInfo.bind(fileClient);
        } else {
            this.versionInfo = async () => { return null; }
        }
        if (fileClient.otherDevices !== undefined) {
            this.otherDevices = fileClient.otherDevices.bind(fileClient);
        } else {
            this.otherDevices = async () => { return null; }
        }
    }

    async fileExists(path) {
        // Get the current path
        let pathParts = path.split("/");
        const filename = pathParts.pop();
        const folder = pathParts.join("/");
    
        // Get a list of files in current path
        const files = await this._showBusy(this.listDir(folder));
    
        // See if the file is in the list of files
        for (let fileObj of files) {
            if (fileObj.path[0] == ".") continue;
            if (fileObj.path == filename) {
                return true;
            }
        }
        return false;
    }
}

export {FileHelper}