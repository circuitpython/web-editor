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
    }    

    _openModal() {
        const modal = document.querySelector(`[data-popup-modal="${this._modalId}"]`);
        if (!modal) {
            throw new Error(`Modal with ID "${this._modalId}" not found.`);
        }
        const bodyBlackout = document.querySelector(SELECTOR_BLACKOUT);
        modal.classList.add('is--visible');
        if (bodyBlackout) {
            bodyBlackout.classList.add('is-blacked-out');
            bodyBlackout.addEventListener('click', this.closeModal);
        }
        const closeButton = modal.querySelector(SELECTOR_CLOSE_BUTTON);
        if (closeButton) {
            closeButton.addEventListener('click', this.closeModal);
        }
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
            const bodyBlackout = document.querySelector(SELECTOR_BLACKOUT);
            if (bodyBlackout) {
                bodyBlackout.removeEventListener('click', this.closeModal);
                bodyBlackout.classList.remove('is-blacked-out');
            }
            const closeButton = this._currentModal.querySelector(SELECTOR_CLOSE_BUTTON);
            if (closeButton) {
                closeButton.removeEventListener('click', this.closeModal);
            }
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
    constructor(modalId) {
        super(modalId);
        this.handleSaveButton = this._handleSaveButton.bind(this);
        this.handleDontSaveButton = this._handleDontSaveButton.bind(this);
    }    

    _closeModal() {
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        cancelButton.removeEventListener("click", this.closeModal);
        const saveButton = this._currentModal.querySelector("button.ok-button");
        saveButton.removeEventListener("click", this.handleSaveButton);
        const dontSaveButton = this._currentModal.querySelector("button.not-ok-button");
        dontSaveButton.removeEventListener("click", this.handleDontSaveButton);
        super._closeModal();
    }

    _handleSaveButton() {
        this._returnValue(true);
    }

    _handleDontSaveButton() {
        this._returnValue(false);
    }

    async open(message) {
        let p = super.open()
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        cancelButton.addEventListener("click", this.closeModal);
        const saveButton = this._currentModal.querySelector("button.ok-button");
        saveButton.addEventListener("click", this.handleSaveButton);
        const dontSaveButton = this._currentModal.querySelector("button.not-ok-button");
        dontSaveButton.addEventListener("click", this.handleDontSaveButton);
        const messageLabel = this._currentModal.querySelector("#message");
        messageLabel.innerHTML = message;

        return p;
    }
}

class FileDialog extends GenericModal {
    constructor(modalId, showBusy) {
        super(modalId);
        this._showBusy = showBusy;
        this._currentPath = "/";
        this._fileClient = null;
        this.handleOkButton = this._handleOkButton.bind(this);
        this.handleFilenameUpdate = this._handleFilenameUpdate.bind(this);
    }

    _closeModal() {
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        cancelButton.removeEventListener("click", this.closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        okButton.removeEventListener("click", this.handleOkButton);
        const fileName = this._currentModal.querySelector("#filename");
        fileName.removeEventListener("input", this.handleFilenameUpdate);
        super._closeModal();
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
        cancelButton.addEventListener("click", this.closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        okButton.disabled = true;
        okButton.addEventListener("click", this.handleOkButton);
        const fileName = this._currentModal.querySelector("#filename");
        fileName.disabled = type == FILE_DIALOG_OPEN;
        fileName.value = "";

        if (type == FILE_DIALOG_OPEN) {
            this._currentModal.setAttribute("data-type", "open");
            okButton.innerHTML = "Open";
        } else if (type == FILE_DIALOG_SAVE) {
            this._currentModal.setAttribute("data-type", "save");
            okButton.innerHTML = "Save";
            fileName.addEventListener("input", this.handleFilenameUpdate);
        }

        this._openFolder();

        return p;
    }

    async _openFolder(path) {
        const fileList = this._currentModal.querySelector("#file-list");
        const okButton = this._currentModal.querySelector("button.ok-button");
        const fileName = this._currentModal.querySelector("#filename");
        this._removeAllChildNodes(fileList);
        if (path !== undefined) {
            this._currentPath = path;
        }
        const currentPathLabel = this._currentModal.querySelector("#current-path");
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
        fileName.value = "";
        okButton.disabled = true;
    }

    _handleFileClick(clickedItem) {
        const fileList = this._currentModal.querySelector("#file-list");
        const fileName = this._currentModal.querySelector("#filename");
        const okButton = this._currentModal.querySelector("button.ok-button");

        for (let listItem of fileList.childNodes) {
            listItem.setAttribute("data-selected", listItem.isEqualNode(clickedItem));
            if (listItem.isEqualNode(clickedItem)) {
                listItem.classList.add("selected");
            } else {
                listItem.classList.remove("selected");
            }
        }
        if (clickedItem.getAttribute("data-type") != "folder") {
            fileName.value = clickedItem.querySelector("span").innerHTML;
        }

        okButton.disabled = clickedItem.getAttribute("data-type") == "bin";
    }

    _handleFilenameUpdate() {
        const fileNameField = this._currentModal.querySelector("#filename");
        const okButton = this._currentModal.querySelector("button.ok-button");
        okButton.disabled = !this._validFilename(fileNameField.value);
    }

    _validFilename(filename) {
        const fileList = this._currentModal.querySelector("#file-list");
        if (filename == '' || filename[0] == "." || filename.includes("/")) {
            return false;
        } else {
            for (let listItem of fileList.childNodes) {
                if (listItem.getAttribute("data-type") == "folder") {
                    if (listItem.querySelector("span").innerHTML == filename) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    async _handleOkButton() {
        await this._openItem();
    }

    async _openItem(item) {
        const fileNameField = this._currentModal.querySelector("#filename");
        const fileList = this._currentModal.querySelector("#file-list");
        let filetype, filename;
        let selectedItem = null;

        // Loop through items and see if any have data-selected
        for (let listItem of fileList.childNodes) {
            if ((/true/i).test(listItem.getAttribute("data-selected"))) {
                selectedItem = listItem;
            }
        }

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
        const fileList = this._currentModal.querySelector("#file-list");
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