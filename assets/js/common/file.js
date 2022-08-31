// This is a wrapper that builds on top of file transfer clients
// with a common set of additional functions
class FileHelper {
    constructor(workflow) {
        this.readFile = workflow.fileClient.readFile.bind(workflow.fileClient);
        this.writeFile = workflow.fileClient.writeFile.bind(workflow.fileClient);
        this.listDir = workflow.fileClient.listDir.bind(workflow.fileClient);
        this.makeDir = workflow.fileClient.makeDir.bind(workflow.fileClient);
        this.move = workflow.fileClient.move.bind(workflow.fileClient);
        this.delete = workflow.fileClient.delete.bind(workflow.fileClient);
        this._showBusy = workflow.showBusy.bind(workflow);
        if (workflow.fileClient.readOnly !== undefined) {
            this.readOnly = workflow.fileClient.readOnly.bind(workflow.fileClient);
        } else {
            this.readOnly = async () => { return false; }
        }
        if (workflow.fileClient.versionInfo !== undefined) {
            this.versionInfo = workflow.fileClient.versionInfo.bind(workflow.fileClient);
        } else {
            this.versionInfo = async () => { return null; }
        }
        if (workflow.fileClient.otherDevices !== undefined) {
            this.otherDevices = workflow.fileClient.otherDevices.bind(workflow.fileClient);
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