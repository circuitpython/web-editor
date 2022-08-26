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

    // Return a list of features to enable in the file dialog
    async features() {
        // Possible flow
        // We could start building up a list by checking if certain functions exist like move
        // We could then check if it is readonly and disable the write features
        // Then maybe could check against the workflow for certain things to disable
        // (like uploading for ble)

        // BLE file uploads may just work without doing anything special
        // If nbot we could check workflow.partialWrites
    }
}

export {FileHelper}