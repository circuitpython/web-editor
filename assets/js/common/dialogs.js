const FILE_DIALOG_OPEN = 1;
const FILE_DIALOG_SAVE = 2;

const SELECTOR_CLOSE_BUTTON = ".popup-modal__close";
const SELECTOR_BLACKOUT = ".body-blackout";

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

class GenericModal {
    constructor(modalId) {
        this._modalId = modalId;
        this._currentModal = null;
        this._resolve = null;
        this._reject = null;
        this.closeModal = this._closeModal.bind(this);
        this._elements = {};
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

    _openModal() {
        const modal = document.querySelector(`[data-popup-modal="${this._modalId}"]`);
        if (!modal) {
            throw new Error(`Modal with ID "${this._modalId}" not found.`);
        }
        modal.classList.add('is--visible');
        const bodyBlackout = document.querySelector(SELECTOR_BLACKOUT);
        if (bodyBlackout) {
            bodyBlackout.classList.add('is-blacked-out');
        }
        this._addDialogElement('bodyBlackout', bodyBlackout, 'click', this._closeModal);
        const closeButton = modal.querySelector(SELECTOR_CLOSE_BUTTON);
        this._addDialogElement('closeButton', closeButton, 'click', this._closeModal);
        document.body.style.overflow = 'hidden';
        bodyBlackout.style.top = `${window.scrollY}px`;

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
            const bodyBlackout = this._getElement('bodyBlackout');
            if (bodyBlackout) {
                bodyBlackout.classList.remove('is-blacked-out');
            }
            this._removeAllDialogElements();
            this._currentModal.classList.remove('is--visible');
            const scrollY = document.body.style.top;
            document.body.style.overflow = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
            this._currentModal = null;
        }
    }

    _returnValue(value) {
        this._resolve(value);
        this._resolve = null;
        this._reject = null;
        this._closeModal();
    }

    close() {
        this._closeModal();
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

class FileDialog extends GenericModal {
    constructor(modalId, showBusy) {
        super(modalId);
        this._showBusy = showBusy;
        this._currentPath = "/";
        this._fileClient = null;
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

    async open(fileClient, type) {
        if (type != FILE_DIALOG_OPEN && type != FILE_DIALOG_SAVE) {
            return;
        }
        this._fileClient = fileClient;

        let p = super.open()
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        okButton.disabled = true;
        this._addDialogElement('okButton', okButton, 'click', this._handleOkButton);
        const delButton = this._currentModal.querySelector("#del-button");
        delButton.disabled = true;
        this._addDialogElement('delButton', delButton, 'click', this._handleDelButton);
        const newFolderButton = this._currentModal.querySelector("#new-folder-button");
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
        if (!this._fileClient) {
            console.log("no client");
            return;
        }

        try {
            const files = this._sortAlpha(await this._showBusy(this._fileClient.listDir(this._currentPath)));

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
        this._getElement('delButton').disabled = !this._canDelete();        
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
        if (name == '' || name[0] == "." || name.includes("/")) {
            return false;
        }

        return true;
    }

    _folderNameExists(folderName) {
        const fileList = this._getElement('fileList');

        // Check if a file or folder already exists
        for (let listItem of fileList.childNodes) {
            if (listItem.querySelector("span").innerHTML == folderName) {
                return true;
            }
        }

        return false;
    }

    _canDelete() {
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

    async _handleOkButton() {
        await this._openItem();
    }

    async _handleDelButton() {
        if (!this._canDelete()) {
            // Not sure how we got here, but this is for safety
            return;
        }
        let filename = this._getSelectedFile().querySelector("span").innerHTML;
        filename = this._currentPath + filename;

        // prompt if user is sure
        if (!confirm(`Are you sure you want to delete ${filename}?`)) {
            // If cancelled, do nothing
            return;
        }

        // otherwise delete the item
        await this._showBusy(this._fileClient.delete(filename));
        // Refresh the file list
        await this._openFolder();
    };

    async _handleNewFolderButton() {
        // prompt for new folder name
        let folderName = prompt("Enter a new folder name");
        // If cancelled, do nothing
        if (!folderName) {
            return;
        }
        // If invalid, display alert
        if (!this._validName(filename)) {
            alert(`'${folderName}' is an invalid name.`);
            return;
        } else if (this._folderNameExists(folderName)) {
            alert(`'${folderName}' already exists.`);
            return;
        }

        // otherwise create a folder
        await this._showBusy(this._fileClient.makeDir(this._currentPath + folderName));

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
                alert("Unable to use this type of file");
            }
        }
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

export {GenericModal, UnsavedDialog, FileDialog, FILE_DIALOG_OPEN, FILE_DIALOG_SAVE}