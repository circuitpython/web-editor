import {sleep} from './utilities.js'
import {WebWorkflow} from '../workflows/web.js'

const FILE_DIALOG_OPEN = 1;
const FILE_DIALOG_SAVE = 2;

const SELECTOR_CLOSE_BUTTON = ".popup-modal__close";
const SELECTOR_BLACKOUT = "#blackout";
const SELECTOR_CLICKBLOCK = "#clickblock";
const BLACKOUT_ZINDEX = 1000;

// This is for mapping file extensions to font awesome icons
const extensionMap = {
    "wav": {icon: "file-audio", type: "bin"},
    "mp3": {icon: "file-audio", type: "bin"},
    "bmp": {icon: "file-image", type: "bin"},
    "gif": {icon: "file-image", type: "bin"},
    "jpg": {icon: "file-image", type: "bin"},
    "jpeg": {icon: "file-image", type: "bin"},
    "zip": {icon: "file-archive", type: "bin"},
    "py": {icon: "file-alt", type: "text"},
    "json": {icon: "file-code", type: "text"},
    "mpy": {icon: "file", type: "bin"},
    "txt": {icon: "file-alt", type: "text"},
    "mov": {icon: "file-video", type: "bin"},
    "mp4": {icon: "file-video", type: "bin"},
    "avi": {icon: "file-video", type: "bin"},
    "wmv": {icon: "file-video", type: "bin"},
}

var modalLayers = [];

class GenericModal {
    constructor(modalId) {
        this._modalId = modalId;
        this._currentModal = null;
        this._resolve = null;
        this._reject = null;
        this.closeModal = this._closeModal.bind(this);
        this._elements = {};
        this._modalLayerId;
    }

    _addDialogElement(elementId, domElement, eventName = null, eventHandler = null) {
        if (elementId in this._elements) {
            this._removeDialogElement(elementId);
        }
        if (domElement) {
            let newElement = {
                element: domElement,
                event: eventName,
                handler: eventHandler ? eventHandler.bind(this) : null
            }
            if (newElement.handler && newElement.event) {
                newElement.element.addEventListener(newElement.event, newElement.handler);
            }
            this._elements[elementId] = newElement;
        }
    }

    _removeDialogElement(elementId) {
        if (!(elementId in this._elements)) {
            return false;
        }
        if (this._elements[elementId].handler && this._elements[elementId].event) {
            this._elements[elementId].element.removeEventListener(this._elements[elementId].event, this._elements[elementId].handler);
        }
        delete this._elements[elementId];
        return true;
    }

    _removeAllDialogElements() {
        let elementIdsToRemove = Object.keys(this._elements);
        for (const elementId of elementIdsToRemove) {
            this._removeDialogElement(elementId);
        }
    }

    _getElement(elementId) {
        if (elementId in this._elements) {
            return this._elements[elementId].element;
        }
        return null;
    }

    async _showMessage(message) {
        const messageDialog = new MessageModal("message");
        return await messageDialog.open(message);
    }

    _addModalLayer(modal) {
        if (modalLayers < 1) {
            const bodyBlackout = document.querySelector(SELECTOR_BLACKOUT);
            if (bodyBlackout) {
                bodyBlackout.classList.add('is-blacked-out');
                bodyBlackout.style.zIndex = BLACKOUT_ZINDEX;
            }
            this._addDialogElement('bodyBlackout', bodyBlackout, 'click', this._closeModal);
            document.body.style.overflow = 'hidden';
            bodyBlackout.style.top = `${window.scrollY}px`;
        }

        modalLayers.push(modal);
        this._modalLayerId = modalLayers.length;
        modal.style.zIndex = BLACKOUT_ZINDEX + 1 + (this._modalLayerId * 2);

        if (modalLayers.length > 1) {
            // Then we will make it so the clickblock layer appears
            const clickBlock = document.querySelector(SELECTOR_CLICKBLOCK);
            if (clickBlock) {
                clickBlock.classList.add('is-blacked-out');
                clickBlock.style.zIndex = modal.style.zIndex - 1
            }
        }
        document.body.appendChild(modal);
    }

    _removeTopModalLayer() {
        const modal = modalLayers.pop()
        if (modalLayers.length < 1) {
            const bodyBlackout = document.querySelector(SELECTOR_BLACKOUT);
            if (bodyBlackout) {
                bodyBlackout.classList.remove('is-blacked-out');
                const scrollY = document.body.style.top;
                document.body.style.overflow = '';
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        } else {
            const clickBlock = document.querySelector(SELECTOR_CLICKBLOCK);
            if (clickBlock) {
                if (modalLayers.length < 2) {
                    clickBlock.classList.remove('is-blacked-out');
                } else {
                    // Move click block just underneath topmost layer
                    clickBlock.style.zIndex = modalLayers[modalLayers.length - 1].style.zIndex - 1
                }
            }
        }
        modal.remove();
    }

    _openModal() {
        const modal = document.querySelector(`[data-popup-modal="${this._modalId}"]`).cloneNode(true);
        if (!modal) {
            throw new Error(`Modal with ID "${this._modalId}" not found.`);
        }
        modal.classList.add('is--visible');
        this._addModalLayer(modal);
        const closeButton = modal.querySelector(SELECTOR_CLOSE_BUTTON);
        this._addDialogElement('closeButton', closeButton, 'click', this._closeModal);

        return modal;
    }

    _closeModal() {
        // If promise has not been resolved yet, resolve it with null
        if (this._resolve !== null) {
            this._resolve(null);
            this._resolve = null;
            this._reject = null;
        }

        if (this._currentModal) {
            this._removeTopModalLayer();
            this._removeAllDialogElements();
            this._currentModal.classList.remove('is--visible');
            this._currentModal = null;
        }
    }

    _returnValue(value) {
        this._resolve(value);
        this._resolve = null;
        this._reject = null;
        this._closeModal();
    }

    isVisible() {
        var style = window.getComputedStyle(this._currentModal);
        return style.display !== 'none';
    }

    close() {
        this._closeModal();
    }

    getModal() {
        if (this._currentModal) {
            return this._currentModal;
        }
        throw Error("Modal has not been opened yet. No instance available");
    }

    async open() {
        this._currentModal = this._openModal();

        let p = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        return p;
    }
}

class MessageModal extends GenericModal {
    async open(message) {
        let p = super.open()
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._closeModal);
        this._currentModal.querySelector("#message").innerHTML = message;

        return p;
    }
}

class ProgressDialog extends GenericModal {
    async open() {
        let p = super.open();
        while(!this.isVisible()) {
            await sleep(10);
        }
        this.setPercentage(0);
        return p;
    }

    setPercentage(percentage) {
        percentage = Math.round(percentage);
        this._currentModal.querySelector("#percentage").innerHTML = `${percentage}%`;
        this._currentModal.querySelector("progress").value = percentage / 100;
    }
}

class UnsavedDialog extends GenericModal {
    _handleSaveButton() {
        this._returnValue(true);
    }

    _handleDontSaveButton() {
        this._returnValue(false);
    }

    async open(message) {
        let p = super.open()
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const saveButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('saveButton', saveButton, 'click', this._handleSaveButton);
        const dontSaveButton = this._currentModal.querySelector("button.not-ok-button");
        this._addDialogElement('dontSaveButton', dontSaveButton, 'click', this._handleDontSaveButton);
        this._currentModal.querySelector("#message").innerHTML = message;

        return p;
    }
}

// Returns the value of the clicked Button except cancel
// (This should eventually replace the UnsavedDialog and possibly the MessageModal)
class ButtonValueDialog extends GenericModal {
    _handleOtherButton(event) {
        let button = event.target;
        if (button.tagName.toLowerCase() !== 'button') {
            button = button.parentNode;
        }
        this._returnValue(button.value);
    }

    async open(message = null) {
        let p = super.open()
        let buttons = this._currentModal.querySelectorAll("button")
        buttons.forEach((button) => {
            if (button.classList.contains("cancel-button")) {
                this._addDialogElement('cancelButton', button, 'click', this._closeModal);
            } else {
                const buttonName = button.id.replace(/-([a-z])/g, (g) => {
                    return g[1].toUpperCase();
                }) + 'Button';
                this._addDialogElement(buttonName, button, 'click', this._handleOtherButton);
            }
        });

        const msgElement = this._currentModal.querySelector("#message");
        if (message && msgElement) {
            msgElement.innerHTML = message;
        }

        return p;
    }
}

class DiscoveryModal extends GenericModal {
    async _getDeviceInfo() {
        const deviceInfo = await this._showBusy(this._fileHelper.versionInfo());
        this._currentModal.querySelector("#version").textContent = deviceInfo.version;
        const boardLink = this._currentModal.querySelector("#board");
        boardLink.href = `https://circuitpython.org/board/${deviceInfo.board_id}/`;
        boardLink.textContent = deviceInfo.board_name;
        const hostname = this._currentModal.querySelector("#hostname");
        let port = `${deviceInfo.port != 80 ? ':' + deviceInfo.port : ''}`;
        hostname.href = `http://${deviceInfo.hostname}.local${port}/code/`;
        hostname.textContent = deviceInfo.hostname;
        let ip = this._currentModal.querySelector("#ip");
        ip.href = `http://${deviceInfo.ip + port}/code/`;
        ip.textContent = deviceInfo.ip;
    }

    async _refreshDevices() {
        const otherDevices = await this._showBusy(this._fileHelper.otherDevices());
        let newDevices = [];
        if (otherDevices.total == 0) {
            let span = document.createElement("span");
            span.textContent = "No devices found.";
            newDevices.push(span);
        } else {
            for (let device of otherDevices.devices) {
                let a = document.createElement("a");
                let port = `${device.port != 80 ? ':' + device.port : ''}`;
                let server = WebWorkflow.isIp() ? device.ip : device.hostname + ".local";
                a.setAttribute("device-host", `${server}${port}`);
                a.addEventListener("click", (event) => {
                    let clickedItem = event.target;
                    if (clickedItem.tagName.toLowerCase() != "a") {
                        clickedItem = clickedItem.parentNode;
                    }
                    let deviceHost = clickedItem.getAttribute("device-host");
                    this._workflow.switchDevice(deviceHost, this._document);
                });
                a.textContent = `${device.instance_name} (${device.hostname})`;
                newDevices.push(a);
            }
        }
        this._currentModal.querySelector("#devices").replaceChildren(...newDevices);
    }

    async open(workflow, document) {
        this._workflow = workflow;
        this._fileHelper = workflow.fileClient;
        this._showBusy = workflow.showBusy.bind(workflow);
        this._document = document;

        let p = super.open();
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._closeModal);

        const refreshIcon = this._currentModal.querySelector("i.refresh");
        this._addDialogElement('refreshIcon', refreshIcon, 'click', this._refreshDevices);

        await this._getDeviceInfo();
        await this._refreshDevices();
        return p;
    }
}

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
        if (fileObj.isDir) return "fa-folder";
        const fileExtension = this._getExtension(fileObj.path);
        if (fileExtension in extensionMap) {
            return "fa-" + extensionMap[fileExtension].icon;
        }

        return "fa-file";
    }

    _getType(fileObj) {
        if (fileObj.isDir) return "folder";
        const fileExtension = this._getExtension(fileObj.path);
        if (fileExtension in extensionMap) {
            return extensionMap[fileExtension].type;
        }

        return "bin";
    }

    async open(fileHelper, type) {
        if (type != FILE_DIALOG_OPEN && type != FILE_DIALOG_SAVE) {
            return;
        }
        this._fileHelper = fileHelper;
        this._readOnlyMode = await this._showBusy(this._fileHelper.readOnly());

        let p = super.open()
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        okButton.disabled = true;
        this._addDialogElement('okButton', okButton, 'click', this._handleOkButton);
        const delButton = this._currentModal.querySelector("#del-button");
        delButton.disabled = true;
        this._addDialogElement('delButton', delButton, 'click', this._handleDelButton);
        const renameButton = this._currentModal.querySelector("#rename-button");
        renameButton.disabled = true;
        this._addDialogElement('renameButton', renameButton, 'click', this._handleRenameButton);
        const downloadButton = this._currentModal.querySelector("#download-button");
        downloadButton.disabled = true;
        this._addDialogElement('downloadButton', downloadButton, 'click', this._handleDownloadButton);
        const uploadButton = this._currentModal.querySelector("#upload-button");
        uploadButton.disabled = this._readOnlyMode;
        this._addDialogElement('uploadButton', uploadButton, 'click', this._handleUploadFilesButton);
        const newFolderButton = this._currentModal.querySelector("#new-folder-button");
        newFolderButton.disabled = this._readOnlyMode;
        this._addDialogElement('newFolderButton', newFolderButton, 'click', this._handleNewFolderButton);
        const fileNameField= this._currentModal.querySelector("#filename");
        fileNameField.disabled = type == FILE_DIALOG_OPEN;
        fileNameField.value = "";

        if (type == FILE_DIALOG_OPEN) {
            this._currentModal.setAttribute("data-type", "open");
            okButton.innerHTML = "Open";
            this._addDialogElement('fileNameField', fileNameField);
        } else if (type == FILE_DIALOG_SAVE) {
            this._currentModal.setAttribute("data-type", "save");
            okButton.innerHTML = "Save";
            this._addDialogElement('fileNameField', fileNameField, 'input', this._handleFilenameUpdate);
        }
        this._addDialogElement('fileList', this._currentModal.querySelector("#file-list"));
        this._addDialogElement('currentPathLabel', this._currentModal.querySelector("#current-path"));
        this._progressDialog = new ProgressDialog("progress");

        await this._openFolder();

        return p;
    }

    async _openFolder(path) {
        const fileList = this._getElement('fileList');
        const okButton = this._getElement('okButton');
        const fileNameField = this._getElement('fileNameField');
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
                if (fileObj.path[0] == ".") continue;
                this._addFile(fileObj);
            }    
        } catch(e) {
            console.log(e);
        }
        fileNameField.value = "";
        okButton.disabled = true;
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

        this._getElement('okButton').disabled = clickedItem.getAttribute("data-type") == "bin";
        this._getElement('delButton').disabled = !this._canDeleteOrRename();
        this._getElement('renameButton').disabled = !this._canDeleteOrRename();
        this._getElement('downloadButton').disabled = !this._canDownload();
    }

    _handleFilenameUpdate() {
        const fileNameField = this._getElement('fileNameField');
        this._getElement('okButton').disabled = !this._validFilename(fileNameField.value);
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

        // For now, don't allow hidden files
        if (name[0] == ".") {
            return false;
        }

        return true;
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

    _canDeleteOrRename() {
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
        return true;
    }

    _canDownload() {
        let selectedItem = this._getSelectedFile();
        if (!selectedItem) {
            return false;
        }
        let filetype = selectedItem.getAttribute("data-type");
        let filename = selectedItem.querySelector("span").innerHTML;
        if (filetype == "folder") {
            return false;
        }
        if (!this._validName(filename)) {
            return false;
        }
        return true;
    }

    async _handleOkButton() {
        await this._openItem();
    }

    async _handleDelButton() {
        if (!this._canDeleteOrRename()) return;

        let filename = this._getSelectedFile().querySelector("span").innerHTML;
        filename = this._currentPath + filename;

        if (!confirm(`Are you sure you want to delete ${filename}?`)) {
            return; // If cancelled, do nothing
        }

        // Delete the item
        await this._showBusy(this._fileHelper.delete(filename));
        // Refresh the file list
        await this._openFolder();
    };

    async _handleUploadFilesButton() {
        if (this._readOnlyMode) return;

        let input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.addEventListener('change', async (event) => {
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

            this._progressDialog.open();
            for(let file of files) {
                let filename = file.name;
                bytesCompleted += file.size;
                if (this._nameExists(filename) && !confirm(`${filename} already exists. Overwrite?`)) {
                    this._progressDialog.setPercentage(bytesCompleted / totalBytes * 100);
                    continue; // If cancelled, continue
                }

                let contents = await readUploadedFileAsArrayBuffer(file);

                await this._fileHelper.writeFile(
                    this._currentPath + filename,
                    0,
                    contents,
                    file.lastModified,
                    true
                );
                this._progressDialog.setPercentage(bytesCompleted / totalBytes * 100);
            };
            this._progressDialog.close();

            // Refresh the file list
            await this._openFolder();
        });
        input.click();
    }

    // Currently only files are downloadable, but it would be nice to eventually download zipped folders
    async _handleDownloadButton() {
        if (!this._canDownload()) return;

        let filename = this._getSelectedFile().querySelector("span").innerHTML;
        let getBlob = async () => {
            let response = await this._fileHelper.readFile(this._currentPath + filename, true);
            return response.blob();
        }
        let blob = await this._showBusy(getBlob());
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.setAttribute('download', filename);
        a.click();
    }

    async _handleRenameButton() {
        if (!this._canDeleteOrRename()) return;

        let oldName = this._getSelectedFile().querySelector("span").innerHTML;
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

    async _openItem(item) {
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
                    await this._openFolder(this._currentPath + filename + "/");
                }
            } else if (filetype == "text") {
                this._returnValue(this._currentPath + filename);
            } else {
                await this._showMessage("Unable to use this type of file");
            }
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

        return this._sortAlpha(folders).concat(this._sortAlpha(files))
    }

    _sortAlpha(files) {
        return files.sort(function(a, b) {
            var keyA = a.path;
            var keyB = b.path;
            return keyA.localeCompare(keyB);
          });
    }
    
    _addFile(fileObj, iconClass) {
        const fileList = this._getElement('fileList');
        let fileItem = document.createElement("A");
        fileItem.setAttribute("data-type", this._getType(fileObj));
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
            this._openItem(clickedItem);
        });

        let iconElement = document.createElement("I");
        iconElement.classList.add("far");
        if (iconClass !== undefined) {
            iconElement.classList.add(iconClass);
        } else {
            iconElement.classList.add(this._getIcon(fileObj));
        }
        let filename = document.createElement("SPAN");
        filename.innerHTML = fileObj.path;
        fileItem.appendChild(iconElement);
        fileItem.appendChild(filename);
        fileList.appendChild(fileItem);
    }
}

export {
    GenericModal,
    MessageModal,
    ButtonValueDialog,
    UnsavedDialog,
    DiscoveryModal,
    FileDialog,
    FILE_DIALOG_OPEN,
    FILE_DIALOG_SAVE
}