const FILE_DIALOG_OPEN = 1;
const FILE_DIALOG_SAVE = 2;

// This is for mapping file extensions to font awesome icons
const extensions = {
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

class FileDialog {
    constructor(modalId, blackoutSelector) {
        this._blackoutSelector = blackoutSelector;
        this._modalId = modalId;
        this._currentPath = "/";
        this._currentModal = null;
        this._fileClient = null;
        this._resolve = null;
        this._reject = null;
        this.closeModal = this._closeModal.bind(this);
        this.handleOkButton = this._handleOkButton.bind(this);
        this.handleFilenameUpdate = this._handleFilenameUpdate.bind(this);
    }

    _openModal() {
        const bodyBlackout = document.querySelector(this._blackoutSelector);
        const modal = document.querySelector(`[data-popup-modal="${this._modalId}"]`);
        modal.classList.add('is--visible');
        bodyBlackout.classList.add('is-blacked-out');
        modal.querySelector('.popup-modal__close').addEventListener('click', this.closeModal);
        
        bodyBlackout.addEventListener('click', this.closeModal);
        document.body.style.overflow = 'hidden';
        bodyBlackout.style.top = `${window.scrollY}px`;

        return modal;
    }

    _closeModal() {
        this._currentModal.querySelector('.popup-modal__close').removeEventListener('click', this.closeModal);
        const bodyBlackout = document.querySelector(this._blackoutSelector);
        bodyBlackout.removeEventListener('click', this.closeModal);
        this._currentModal.classList.remove('is--visible');
        bodyBlackout.classList.remove('is-blacked-out');
        const scrollY = document.body.style.top;
        document.body.style.overflow = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        cancelButton.removeEventListener("click", this.closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        okButton.removeEventListener("click", this.handleOkButton);
        const fileName = this._currentModal.querySelector("#filename");
        fileName.removeEventListener("input", this.handleFilenameUpdate);
        this._currentModal = null;

        if (this._resolve !== null) {
            this._resolve(null);
            this._resolve = null;
            this._reject = null;
        }
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
        if (fileExtension in extensions) {
            return "fa-" + extensions[fileExtension].icon;
        }

        return "fa-file";
    }

    _getType(fileObj) {
        if (fileObj.isDir) return "folder";
        const fileExtension = this._getExtension(fileObj.path);
        if (fileExtension in extensions) {
            return extensions[fileExtension].type;
        }

        return "bin";
    }

    async open(fileClient, type) {
        if (type != FILE_DIALOG_OPEN && type != FILE_DIALOG_SAVE) {
            return;
        }
        this._fileClient = fileClient;
        this._currentModal = this._openModal();
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        cancelButton.addEventListener("click", this.closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        const fileName = this._currentModal.querySelector("#filename");
        fileName.disabled = type == FILE_DIALOG_OPEN;
        fileName.value = "";
        okButton.disabled = true;
        okButton.addEventListener("click", this.handleOkButton);

        if (type == FILE_DIALOG_OPEN) {
            this._currentModal.setAttribute("data-type", "open");
            okButton.innerHTML = "Open";
        } else if (type == FILE_DIALOG_SAVE) {
            this._currentModal.setAttribute("data-type", "save");
            okButton.innerHTML = "Save";
            fileName.addEventListener("input", this.handleFilenameUpdate);
        }

        let p = new Promise((resolve, reject) => {
            this._openFolder();
            this._resolve = resolve;
            this._reject = reject;
        });

        return p;
    }

    async _openFolder(path) {
        const fileList = this._currentModal.querySelector("#file-list");
        const okButton = this._currentModal.querySelector("button.ok-button");
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
            const files = this._sortAlpha(await this._fileClient.listDir(this._currentPath));

            for (let fileObj of files) {
                if (fileObj.path[0] == ".") continue;
                this._addFile(fileObj);
            }    
        } catch(e) {
            console.log(e);
        }
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
        let filetype, filename;

        if (item !== undefined) {
            filetype = item.getAttribute("data-type");
            filename = item.querySelector("span").innerHTML;
        } else if (this._validFilename(fileNameField.value)) {
            filename = fileNameField.value;
            filetype = "text";
        } else {
            // Loop through items and see if any have data-selected
            const fileList = this._currentModal.querySelector("#file-list");
            for (let listItem of fileList.childNodes) {
                if ((/true/i).test(listItem.getAttribute("data-selected"))) {
                    item = listItem;
                }
            }
            if (item !== undefined) {
                filetype = item.getAttribute("data-type");
                filename = item.querySelector("span").innerHTML;
            }
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
                this._resolve(this._currentPath + filename);
                this._resolve = null;
                this._reject = null;
                this._closeModal();
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