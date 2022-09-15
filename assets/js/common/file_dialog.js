import { GenericModal, ProgressDialog, ButtonValueDialog } from './dialogs.js';
import { saveAs } from 'file-saver';

const FILE_DIALOG_OPEN = 1;
const FILE_DIALOG_SAVE = 2;
const FILE_DIALOG_MOVE = 3;
const FILE_DIALOG_COPY = 4;

// Hide any file or folder matching these exact names
const HIDDEN_FILES = [".Trashes", ".metadata_never_index", ".fseventsd"];

// Hide any file or folder starting with these strings
const HIDDEN_PREFIXES = ["._"];

// This is for mapping file extensions to font awesome icons
const extensionMap = {
    "wav": {style:"r", icon: "file-audio", type: "bin"},
    "mp3": {style:"r", icon: "file-audio", type: "bin"},
    "bmp": {style:"r", icon: "file-image", type: "bin"},
    "gif": {style:"r", icon: "file-image", type: "bin"},
    "jpg": {style:"r", icon: "file-image", type: "bin"},
    "jpeg": {style:"r", icon: "file-image", type: "bin"},
    "zip": {style:"r", icon: "file-archive", type: "bin"},
    "py": {style:"r", icon: "file-alt", type: "text"},
    "json": {style:"r", icon: "file-code", type: "text"},
    "mpy": {style:"r", icon: "file", type: "bin"},
    "txt": {style:"r", icon: "file-alt", type: "text"},
    "mov": {style:"r", icon: "file-video", type: "bin"},
    "mp4": {style:"r", icon: "file-video", type: "bin"},
    "avi": {style:"r", icon: "file-video", type: "bin"},
    "wmv": {style:"r", icon: "file-video", type: "bin"},
}

const FOLDER_ICON = ["far", "fa-folder"];
const DEFAULT_FILE_ICON = ["far", "fa-file"];

const FILESIZE_UNITS = ["bytes", "KB", "MB", "GB"];
const COMPACT_UNITS = ["", "K", "M", "G"];

class FileDialog extends GenericModal {
    constructor(modalId, showBusy) {
        super(modalId);
        this._showBusy = showBusy;
        this._currentPath = "/";
        this._fileHelper = null;
        this._readOnlyMode = false;
        this._progressDialog = null;
    }

    _removeAllChildNodes(parent) {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
    }

    _getExtension(filename) {
        let extension = filename.split('.').pop();
        if (extension !== null) {
            return String(extension).toLowerCase()
        }
        return extension;
    }

    _getIcon(fileObj) {
        if (fileObj.isDir) return FOLDER_ICON;
        const fileExtension = this._getExtension(fileObj.path);
        if (fileExtension in extensionMap) {
            return ["fa" + extensionMap[fileExtension].style, "fa-" + extensionMap[fileExtension].icon];
        }

        return DEFAULT_FILE_ICON;
    }

    _getType(fileObj) {
        if (fileObj.isDir) return "folder";
        if (this._hiddenFile(fileObj)) return "text";
        const fileExtension = this._getExtension(fileObj.path);
        if (fileExtension in extensionMap) {
            return extensionMap[fileExtension].type;
        }

        return "bin";
    }

    async open(fileHelper, type, hidePaths=null) {
        if (![FILE_DIALOG_OPEN, FILE_DIALOG_SAVE, FILE_DIALOG_MOVE, FILE_DIALOG_COPY].includes(type)) {
            return;
        }
        this._fileHelper = fileHelper;
        this._readOnlyMode = await this._showBusy(this._fileHelper.readOnly());
        this._hidePaths = hidePaths ? hidePaths : new Set();

        let p = super.open()
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._handleOkButton);
        this._setElementEnabled('okButton', this._validSelectableFolder());
        const delButton = this._currentModal.querySelector("#del-button");
        this._addDialogElement('delButton', delButton, 'click', this._handleDelButton);
        this._setElementEnabled('delButton', false);
        const renameButton = this._currentModal.querySelector("#rename-button");
        this._addDialogElement('renameButton', renameButton, 'click', this._handleRenameButton);
        this._setElementEnabled('renameButton', false);
        const downloadButton = this._currentModal.querySelector("#download-button");
        this._addDialogElement('downloadButton', downloadButton, 'click', this._handleDownloadButton);
        this._setElementEnabled('downloadButton', true);
        const uploadButton = this._currentModal.querySelector("#upload-button");
        this._addDialogElement('uploadButton', uploadButton, 'click', this._handleUploadButton);
        this._setElementEnabled('uploadButton', !this._readOnlyMode);
        const newFolderButton = this._currentModal.querySelector("#new-folder-button");
        this._addDialogElement('newFolderButton', newFolderButton, 'click', this._handleNewFolderButton);
        this._setElementEnabled('newFolderButton', !this._readOnlyMode);
        const moveButton = this._currentModal.querySelector("#move-button");
        this._addDialogElement('moveButton', moveButton, 'click', this._handleMoveButton);
        this._setElementEnabled('moveButton', false);
        const fileNameField= this._currentModal.querySelector("#filename");

        if (type == FILE_DIALOG_OPEN) {
            this._currentModal.setAttribute("data-type", "open");
            this._setElementHtml('okButton', "Open");
            this._addDialogElement('fileNameField', fileNameField);
        } else if (type == FILE_DIALOG_SAVE) {
            this._currentModal.setAttribute("data-type", "save");
            this._setElementHtml('okButton', "Save");
            this._addDialogElement('fileNameField', fileNameField, 'input', this._handleFilenameUpdate);
        } else if (type == FILE_DIALOG_MOVE) {
            this._currentModal.setAttribute("data-type", "folder-select");
            this._setElementHtml('okButton', "Move");
            this._addDialogElement('fileNameField', fileNameField);
        } else if (type == FILE_DIALOG_COPY) {
            this._currentModal.setAttribute("data-type", "folder-select");
            this._setElementHtml('okButton', "Copy");
            this._addDialogElement('fileNameField', fileNameField);
        }

        this._setElementValue('fileNameField', "");
        this._setElementEnabled('fileNameField', type == FILE_DIALOG_SAVE);
        this._addDialogElement('fileList', this._currentModal.querySelector("#file-list"));
        this._addDialogElement('currentPathLabel', this._currentModal.querySelector("#current-path"));
        this._progressDialog = new ProgressDialog("progress");

        await this._openFolder();

        return p;
    }

    async _openFolder(path) {
        const fileList = this._getElement('fileList');
        this._removeAllChildNodes(fileList);
        if (path !== undefined) {
            this._currentPath = path;
        }
        const currentPathLabel = this._getElement('currentPathLabel');
        currentPathLabel.innerHTML = this._currentPath;

        if (this._currentPath != "/") {
            this._addFile({path: "..", isDir: true}, "fa-folder-open");
        }
        if (!this._fileHelper) {
            console.log("no client");
            return;
        }

        try {
            const files = this._sortFolderFirst(await this._showBusy(this._fileHelper.listDir(this._currentPath)));
            for (let fileObj of files) {
                if (!this._validName(fileObj.path)) continue;
                if (this._currentModal.getAttribute("data-type") == "folder-select" && !fileObj.isDir) continue;
                if (this._hidePaths.has(this._currentPath + fileObj.path)) continue;
                this._addFile(fileObj);
            }
        } catch(e) {
            console.log(e);
        }
        this._setElementValue('fileNameField', "");
        this._setElementEnabled('okButton', this._validSelectableFolder());
        this._updateToolbar();
    }

    _validSelectableFolder() {
        if (this._currentModal.getAttribute("data-type") != "folder-select") {
            return false;
        }
        if (this._hidePaths.has(this._currentPath)) {
            return false;
        }
        return true;
    }

    _handleFileClick(clickedItem) {
        for (let listItem of this._getElement('fileList').childNodes) {
            listItem.setAttribute("data-selected", listItem.isEqualNode(clickedItem));
            if (listItem.isEqualNode(clickedItem)) {
                listItem.classList.add("selected");
            } else {
                listItem.classList.remove("selected");
            }
        }
        if (clickedItem.getAttribute("data-type") != "folder") {
            this._getElement('fileNameField').value = clickedItem.querySelector("span").innerHTML;
        }
        this._setElementEnabled('okButton', clickedItem.getAttribute("data-type") != "bin");
        this._updateToolbar();
    }

    _updateToolbar() {
        this._setElementEnabled('delButton', this._canPerformWritableFileOperation());
        this._setElementEnabled('renameButton', this._canPerformWritableFileOperation());
        this._setElementEnabled('moveButton', this._canPerformWritableFileOperation());
        this._setElementEnabled('downloadButton', this._canDownload());
    }

    _handleFilenameUpdate() {
        const fileNameField = this._getElement('fileNameField');
        this._setElementEnabled('okButton', this._validFilename(fileNameField.value));
    }

    _validFilename(filename) {
        const fileList = this._getElement('fileList');

        // Check for invalid characters
        if (!this._validName(filename)) {
            return false;
        }

        // Check if filename is a folder that exists
        for (let listItem of fileList.childNodes) {
            if (listItem.getAttribute("data-type") == "folder") {
                if (listItem.querySelector("span").innerHTML == filename) {
                    return false;
                }
            }
        }

        return true;
    }

    _validName(name) {
        if (!name || name == '' || name == "." || name == ".." || name.includes("/")) {
            return false;
        }

        for (let prefix of HIDDEN_PREFIXES) {
            if (name.slice(0, prefix.length) == prefix) {
                return false;
            }
        }

        if (HIDDEN_FILES.includes(name)) {
            return false;
        }

        return true;
    }

    _hiddenFile(fileObj) {
        return fileObj.path[0] == "." && fileObj.path != "." && fileObj.path != "..";
    }

    _nameExists(fileName) {
        const fileList = this._getElement('fileList');

        // Check if a file or folder already exists
        for (let listItem of fileList.childNodes) {
            if (listItem.querySelector("span").innerHTML == fileName) {
                return true;
            }
        }

        return false;
    }

    _canPerformWritableFileOperation(includeFolder=true) {
        if (this._readOnlyMode) {
            return false;
        }
        let selectedItem = this._getSelectedFile();
        if (!selectedItem) {
            return false;
        }
        let filename = selectedItem.querySelector("span").innerHTML;
        if (!this._validName(filename)) {
            return false;
        }
        if (!includeFolder && selectedItem.getAttribute("data-type") == "folder") {
            return false;
        }
        return true;
    }

    _canDownload() {
        let selectedItem = this._getSelectedFile();
        if (!selectedItem) {
            return true;
        }
        if (!this._validName(selectedItem.querySelector("span").innerHTML)) {
            return false;
        }
        return true;
    }

    async _handleOkButton() {
        await this._openItem();
    }

    async _handleDelButton() {
        if (!this._canPerformWritableFileOperation()) return;

        let filename = this._getSelectedFilename();
        filename = this._currentPath + filename;

        if (!confirm(`Are you sure you want to delete ${filename}?`)) {
            return; // If cancelled, do nothing
        }

        // Delete the item
        await this._showBusy(this._fileHelper.delete(filename));
        // Refresh the file list
        await this._openFolder();
    };

    async _handleUploadButton() {
        if (this._readOnlyMode) return;

        const uploadTypeDialog = new ButtonValueDialog("upload-type");
        const uploadType = await uploadTypeDialog.open();

        if (uploadType == "files") {
            await this._upload(false);
        } else if (uploadType == "folders") {
            await this._upload(true);
        }
    }

    round(number, decimalPlaces) {
        if (decimalPlaces < 1) {
            return Math.round(number);
        }

        return Math.round(number * (decimalPlaces * 10)) / (decimalPlaces * 10);
    }

    prettySize(filesize, decimals=1, units=FILESIZE_UNITS) {
        let [size, unit] = this._getUnit(filesize, units);
        return `${this.round(size, decimals)} ${unit}`;
    }

    _getUnit(size, units) {
        let unitIndex = 0;
        while (size > 1024 && unitIndex < units.length) {
            unitIndex += 1;
            size /= 1024;
        }
        return [size, units[unitIndex]];
    }

    async _upload(onlyFolders=false) {
        if (this._readOnlyMode) return;

        let input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.webkitdirectory = onlyFolders;
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
                let totalBytes = 0;
                let bytesCompleted = 0;
                for(let file of files) {
                    totalBytes += file.size;
                }

                let madeDirs = new Set();
                this._progressDialog.open();
                for(let [index, file] of files.entries()) {
                    let filename = file.name;
                    if (file.webkitRelativePath) {
                        filename = file.webkitRelativePath;
                        let parentDir = filename.split("/").slice(0, -1).join("/");
                        if (!madeDirs.has(parentDir)) {
                            this._progressDialog.setStatus(`Creating Folder ${parentDir}...`);
                            await this._fileHelper.makeDir(this._currentPath + parentDir);
                            await this._openFolder();
                            madeDirs.add(parentDir);
                        }
                    }
                    bytesCompleted += file.size;
                    if (this._nameExists(filename) && !confirm(`${filename} already exists. Overwrite?`)) {
                        this._progressDialog.setPercentage(bytesCompleted / totalBytes * 100);
                        continue; // If cancelled, continue
                    }

                    let contents = await readUploadedFileAsArrayBuffer(file);
                    this._progressDialog.setStatus(`Uploading file ${filename} (${this.prettySize(file.size)})...`);
                    await this._showBusy(this._fileHelper.writeFile(
                        this._currentPath + filename,
                        0,
                        contents,
                        file.lastModified,
                        true
                    ), false);
                    this._progressDialog.setPercentage(bytesCompleted / totalBytes * 100);
                };
                this._progressDialog.close();

                // Refresh the file list
                await this._openFolder();
            } catch(error) {
                this._progressDialog.close();
                await this._showMessage(`Error: ${error.message}`);
                console.error(error);
            }
        });
        input.click();
    }

    // Currently only files are downloadable, but it would be nice to eventually download zipped folders
    async _handleDownloadButton() {
        await this._download(this._getSelectedFilename());
    }

    async _download(filename) {
        if (!this._canDownload()) return;

        let type, folder, blob;

        let getBlob = async (path) => {
            let response = await this._fileHelper.readFile(path, true);
            return response.blob();
        }

        if (filename) {
            type = this._getSelectedFileType();
        }

        if (type == "folder" || !filename) {
            folder = this._currentPath;
            if (filename) {
                folder += filename + "/";
                filename = `${filename}.zip`;
            } else {
                if (folder == "/") {
                    filename = "CIRCUITPY.zip";
                } else {
                    filename = folder.split("/").slice(-2).join("") + ".zip";
                }
            }

            let files = await this._fileHelper.findContainedFiles(folder, true);
            let zip = new JSZip();
            for (let location of files) {
                let contents = await this._showBusy(getBlob(folder + location));
                zip.file(location, contents);
            }
            blob = await zip.generateAsync({type:"blob"});
        } else {
            blob = await this._showBusy(getBlob(this._currentPath + filename));
        }
        saveAs(blob, filename);
    }

    async _handleMoveButton() {
        const newFolderDialog = new FileDialog("folder-select", this._showBusy);
        let hidePaths = new Set();
        hidePaths.add(this._getSelectedFilePath());
        hidePaths.add(this._currentPath);
        let newFolder = await newFolderDialog.open(this._fileHelper, FILE_DIALOG_MOVE, hidePaths);

        if (newFolder) {
            const filename = this._getSelectedFilename();
            const filetype = this._getSelectedFileType() == "folder" ? "folder" : "file";
            const oldPath = this._currentPath + filename;
            const newPath = newFolder + filename;
            if (await this._showBusy(this._fileHelper.fileExists(newPath))) {
                this._showMessage(`Error moving ${oldPath}. Another ${filetype} with the same name already exists at ${newPath}.`);
            } else if (!(await this._showBusy(this._fileHelper.move(oldPath, newPath)))) {
                this._showMessage(`Error moving ${oldPath} to ${newPath}. Make sure the ${filetype} you are moving exists.`);
            } else {
                // Go to the new location
                await this._openFolder(newFolder);
            }
        }
    }

    async _handleRenameButton() {
        if (!this._canPerformWritableFileOperation()) return;

        let oldName = this._getSelectedFilename();
        let newName = prompt("Enter a new folder name", oldName);
        // If cancelled, do nothing
        if (!newName) {
            return;
        }
        // If invalid, display message
        if (newName == oldName) {
            return;
        } else if (!this._validName(newName)) {
            await this._showMessage(`'${newName}' is an invalid name.`);
            return;
        } else if (this._nameExists(newName)) {
            await this._showMessage(`'${newName}' already exists.`);
            return;
        }

        // Rename the file, by moving in the same folder
        await this._showBusy(
            this._fileHelper.move(
                this._currentPath + oldName,
                this._currentPath + newName
            )
        );

        // Refresh the file list
        await this._openFolder();
    }

    async _handleNewFolderButton() {
        if (this._readOnlyMode) return;
        // prompt for new folder name
        let folderName = prompt("Enter a new folder name");
        // If cancelled, do nothing
        if (!folderName) {
            return;
        }
        // If invalid, display message
        if (!this._validName(folderName)) {
            await this._showMessage(`'${folderName}' is an invalid name.`);
            return;
        } else if (this._nameExists(folderName)) {
            await this._showMessage(`'${folderName}' already exists.`);
            return;
        }

        // otherwise create a folder
        await this._showBusy(this._fileHelper.makeDir(this._currentPath + folderName));

        // Refresh the file list
        await this._openFolder();
    };

    _getSelectedFile() {
        // Loop through items and see if any have data-selected
        for (let listItem of this._getElement('fileList').childNodes) {
            if ((/true/i).test(listItem.getAttribute("data-selected"))) {
                return listItem;
            }
        }

        return null;
    }

    _getSelectedFilename() {
        let file = this._getSelectedFile();
        if (file) {
            return file.querySelector("span").innerHTML
        }
        return null;
    }

    _getSelectedFileType() {
        let file = this._getSelectedFile();
        if (file) {
            return file.getAttribute("data-type");
        }
        return null;
    }

    _getSelectedFilePath() {
        let filename = this._getSelectedFilename();
        if (!filename) return null;

        if (this._getSelectedFileType() != "folder") {
            return this._currentPath;
        }

        return this._currentPath + filename;
    }

    async _openItem(item, forceNavigate=false) {
        const fileNameField = this._getElement('fileNameField');
        let filetype, filename;
        let selectedItem = this._getSelectedFile();

        if (item !== undefined) {
            filetype = item.getAttribute("data-type");
            filename = item.querySelector("span").innerHTML;
        } else if (this._validFilename(fileNameField.value)) {
            // This only makes sense if opening a file, otherwise it should be the opposite
            if (selectedItem !== null && fileNameField.value != selectedItem.querySelector("span").innerHTML && this._currentModal.getAttribute("data-type") == "open") {
                filetype = selectedItem.getAttribute("data-type");
                filename = selectedItem.querySelector("span").innerHTML;
            } else {
                filename = fileNameField.value;
                filetype = "text";
            }
        } else if (selectedItem !== null) {
            filetype = selectedItem.getAttribute("data-type");
            filename = selectedItem.querySelector("span").innerHTML;
        }

        if (filename !== undefined && filetype !== undefined) {
            if (filetype == "folder") {
                if (filename == "..") {
                    let pathParts = this._currentPath.split("/");
                    pathParts.pop();
                    pathParts.pop();
                    this._currentPath = pathParts.join("/") + "/";
                    await this._openFolder();
                } else {
                    if (forceNavigate || (this._currentModal.getAttribute("data-type") != "folder-select")) {
                        await this._openFolder(this._currentPath + filename + "/");
                    } else {
                        this._returnValue(this._currentPath + filename + "/");
                    }
                }
            } else if (filetype == "text") {
                this._returnValue(this._currentPath + filename);
            } else {
                await this._showMessage("Unable to use this type of file");
            }
        } else if (!forceNavigate && this._validSelectableFolder()) {
            this._returnValue(this._currentPath);
        }
    }

    _sortFolderFirst(fileObjects) {
        let files = [];
        let folders = [];

        for (let fileObj of fileObjects) {
            if (fileObj.isDir) {
                folders.push(fileObj);
            } else {
                files.push(fileObj);
            }
        }

        return this._sortAlpha(folders).concat(this._sortAlpha(files));
    }

    _sortAlpha(files) {
        return files.sort(function(a, b) {
            var keyA = a.path;
            var keyB = b.path;
            return keyA.localeCompare(keyB);
        });
    }

    _addFile(fileObj, iconClass, iconStyle="far") {
        const fileList = this._getElement('fileList');
        let styles = [];
        let fileItem = document.createElement("a");
        if (this._hiddenFile(fileObj)) {
            fileItem.classList.add("hidden-file");
        }
        fileItem.setAttribute("data-type", this._getType(fileObj));

        // Add Events
        fileItem.addEventListener("click", (event) => {
            let clickedItem = event.target;
            if (clickedItem.tagName.toLowerCase() != "a") {
                clickedItem = clickedItem.parentNode;
            }
            this._handleFileClick(clickedItem);
        });
        fileItem.addEventListener("dblclick", async (event) => {
            let clickedItem = event.target;
            if (clickedItem.tagName.toLowerCase() != "a") {
                clickedItem = clickedItem.parentNode;
            }
            this._openItem(clickedItem, true);
        });

        // Icon
        let iconElement = document.createElement("i");
        if (iconClass !== undefined) {
            styles = [iconStyle, iconClass];
        } else {
            styles = this._getIcon(fileObj);
        }
        styles.forEach(iconElement.classList.add, iconElement.classList);

        // Filename
        let filename = document.createElement("span");
        filename.classList.add("filename");
        filename.innerText = fileObj.path;
        filename.title = fileObj.path;

        // Size
        let size = document.createElement("span");
        size.classList.add("filesize");
        if (!fileObj.isDir) {
            size.innerText = this.prettySize(fileObj.fileSize, 0, COMPACT_UNITS);
        }

        // Modified Date
        let date = document.createElement("span");
        date.classList.add("filedate");
        if (fileObj.fileDate) {
            let dateString = (new Date(fileObj.fileDate)).toLocaleString();
            date.innerText = dateString;
            date.title = dateString;
        }

        fileItem.appendChild(iconElement);
        fileItem.appendChild(filename);
        fileItem.appendChild(size);
        fileItem.appendChild(date);

        fileList.appendChild(fileItem);
    }
}

export {
    FileDialog,
    FILE_DIALOG_OPEN,
    FILE_DIALOG_SAVE,
    FILE_DIALOG_MOVE,
    FILE_DIALOG_COPY
}