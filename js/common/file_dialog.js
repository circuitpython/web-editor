import {GenericModal, ProgressDialog, ButtonValueDialog} from './dialogs.js';
import {readUploadedFileAsArrayBuffer} from './utilities.js';
import {saveAs} from 'file-saver';
import JSZip from 'jszip';

const FILE_DIALOG_OPEN = 1;
const FILE_DIALOG_SAVE = 2;
const FILE_DIALOG_MOVE = 3;
const FILE_DIALOG_COPY = 4;

// Font Awesome Styles
const FA_STYLE_REGULAR = "fa-regular";
const FA_STYLE_SOLID = "fa-solid";
const FA_STYLE_BRANDS = "fa-brands";

const MODIFIER_SHIFT = "shift";
const MODIFIER_CTRL = "ctrl";

// Hide any file or folder matching these exact names
const HIDDEN_FILES = [".Trashes", ".metadata_never_index", ".fseventsd"];

// Hide any file or folder starting with these strings
const HIDDEN_PREFIXES = ["._"];

// This is for mapping file extensions to font awesome icons
const extensionMap = {
    "avi":  {style: FA_STYLE_REGULAR, icon: "file-video", type: "bin"},
    "bmp":  {style: FA_STYLE_REGULAR, icon: "file-image", type: "bin"},
    "css":  {style: FA_STYLE_REGULAR, icon: "file-lines", type: "text"},
    "gif":  {style: FA_STYLE_REGULAR, icon: "file-image", type: "bin"},
    "htm":  {style: FA_STYLE_REGULAR, icon: "file-code", type: "text"},
    "html": {style: FA_STYLE_REGULAR, icon: "file-code", type: "text"},
    "ini": {style: FA_STYLE_REGULAR, icon: "file-code", type: "text"},
    "inf": {style: FA_STYLE_REGULAR, icon: "file-code", type: "text"},
    "jpeg": {style: FA_STYLE_REGULAR, icon: "file-image", type: "bin"},
    "jpg":  {style: FA_STYLE_REGULAR, icon: "file-image", type: "bin"},
    "js":   {style: FA_STYLE_REGULAR, icon: "file-code", type: "text"},
    "json": {style: FA_STYLE_REGULAR, icon: "file-code", type: "text"},
    "md":   {style: FA_STYLE_REGULAR, icon: "file-lines", type: "text"},
    "mov":  {style: FA_STYLE_REGULAR, icon: "file-video", type: "bin"},
    "mp3":  {style: FA_STYLE_REGULAR, icon: "file-audio", type: "bin"},
    "mp4":  {style: FA_STYLE_REGULAR, icon: "file-video", type: "bin"},
    "mpy":  {style: FA_STYLE_REGULAR, icon: "file", type: "bin"},
    "pdf":  {style: FA_STYLE_REGULAR, icon: "file-pdf", type: "bin"},
    "py":   {style: FA_STYLE_REGULAR, icon: "file-code", type: "text"},
    "toml": {style: FA_STYLE_REGULAR, icon: "file-lines", type: "text"},
    "txt":  {style: FA_STYLE_REGULAR, icon: "file-lines", type: "text"},
    "wav":  {style: FA_STYLE_REGULAR, icon: "file-audio", type: "bin"},
    "wmv":  {style: FA_STYLE_REGULAR, icon: "file-video", type: "bin"},
    "zip":  {style: FA_STYLE_REGULAR, icon: "file-archive", type: "bin"},
};

const FOLDER_ICON = [FA_STYLE_REGULAR, "fa-folder"];
const DEFAULT_FILE_ICON = [FA_STYLE_REGULAR, "fa-file"];

const FILESIZE_UNITS = ["bytes", "KB", "MB", "GB", "TB"];
const COMPACT_UNITS = ["", "K", "M", "G", "T"];

function getFileExtension(filename) {
    if (filename === null) {
        return null;
    }
    let extension = filename.split('.').pop();
    if (extension !== null) {
        return String(extension).toLowerCase();
    }
    return extension;
}

function getFileIcon(path, isDir = false) {
    if (isDir) return FOLDER_ICON;
    const fileExtension = getFileExtension(path);
    if (fileExtension in extensionMap) {
        return [extensionMap[fileExtension].style, "fa-" + extensionMap[fileExtension].icon];
    }

    return DEFAULT_FILE_ICON;
}

function isHiddenFile(path) {
    return path[0] == "." && path != "." && path != "..";
}

function getFileType(path, isDir = false) {
    if (isDir) return "folder";
    if (isHiddenFile(path)) return "text";
    const fileExtension = getFileExtension(path);
    if (fileExtension in extensionMap) {
        return extensionMap[fileExtension].type;
    }

    return "bin";
}

class FileDialog extends GenericModal {
    constructor(modalId, showBusy) {
        super(modalId);
        this._showBusy = showBusy;
        this._currentPath = "/";
        this._fileHelper = null;
        this._readOnlyMode = false;
        this._progressDialog = null;
        this._lastSelectedNode = null;
    }

    _removeAllChildNodes(parent) {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
    }

    _getType(fileObj) {
        if (fileObj.isDir) return "folder";
        if (isHiddenFile(fileObj.path)) return "text";
        const fileExtension = getFileExtension(fileObj.path);
        if (fileExtension in extensionMap) {
            return extensionMap[fileExtension].type;
        }

        return "bin";
    }

    async open(fileHelper, type, hidePaths = null, allowMultiple = true) {
        if (![FILE_DIALOG_OPEN, FILE_DIALOG_SAVE, FILE_DIALOG_MOVE, FILE_DIALOG_COPY].includes(type)) {
            return;
        }
        this._fileHelper = fileHelper;
        this._readOnlyMode = await this._showBusy(this._fileHelper.readOnly());
        this._hidePaths = hidePaths ? hidePaths : new Set();
        this._allowMultiple = allowMultiple;

        let p = super.open();
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
        const fileNameField = this._currentModal.querySelector("#filename");

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
        this._lastSelectedNode = null;
        if (path !== undefined) {
            this._currentPath = path;
        }
        const currentPathLabel = this._getElement('currentPathLabel');
        currentPathLabel.innerHTML = `<i class="${FA_STYLE_REGULAR} fa-folder-open"></i> ` + this._currentPath;

        if (this._currentPath != "/") {
            this._addFile({path: "..", isDir: true}, "fa-folder-open");
        }
        if (!this._fileHelper) {
            console.error("no client");
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
        } catch (e) {
            console.error(e);
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
        if (this._multipleItemsSelected()) {
            return false;
        }
        return true;
    }

    _handleFileClick(clickedItem, event) {
        // Get a list of nodes that have the data-selected attribute and store them in an array
        let listItem;
        let previouslySelectedNodes = [];
        for (let listItem of this._getElement('fileList').childNodes) {
            if (this._isSelected(listItem)) {
                previouslySelectedNodes.push(listItem);
            }
        }

        // Get a list of modifier keys that are currently pressed if event was passed in
        let modifierKeys = [];
        if (this._allowMultiple && event.shiftKey && this._lastSelectedNode !== null) {
            modifierKeys.push(MODIFIER_SHIFT);
        }

        // Command for macs, Control for Windows
        if (this._allowMultiple && (event.metaKey || event.ctrlKey)) {
            modifierKeys.push(MODIFIER_CTRL);
        }

        // Go through and add which files should be selected. This will be the key for updating the UI for the
        // files that should be selected
        let selectedFiles = [];

        // If control is held down, we should start by populating the list with everything currently selected
        if (modifierKeys.includes(MODIFIER_CTRL)) {
            selectedFiles = previouslySelectedNodes;
        }

        // If shift is held down, we should add all the files between the last selected file and the current file
        if (modifierKeys.includes(MODIFIER_SHIFT)) {
            let lastSelectedIndex = Array.from(this._getElement('fileList').childNodes).indexOf(this._lastSelectedNode);
            let currentSelectedIndex = Array.from(this._getElement('fileList').childNodes).indexOf(clickedItem);
            let startIndex = Math.min(lastSelectedIndex, currentSelectedIndex);
            let endIndex = Math.max(lastSelectedIndex, currentSelectedIndex);
            for (let i = startIndex; i <= endIndex; i++) {
                selectedFiles.push(this._getElement('fileList').childNodes[i]);
            }
        } else if (modifierKeys.includes(MODIFIER_CTRL)) {
            if (selectedFiles.includes(clickedItem)) {
                selectedFiles.splice(selectedFiles.indexOf(clickedItem), 1);
            } else {
                selectedFiles.push(clickedItem);
            }
        } else {
            selectedFiles.push(clickedItem);
        }

        // Go through and update the UI for all of the files that should be selected or delselected
        for (listItem of this._getElement('fileList').childNodes) {
            // If Control key is pressed, toggle selection
            this._selectItem(listItem, selectedFiles.includes(listItem));
        }

        if (this._multipleItemsSelected()) {
            this._getElement('fileNameField').value = "";
        } else if (clickedItem.getAttribute("data-type") != "folder") {
            this._getElement('fileNameField').value = clickedItem.querySelector("span").innerHTML;
        }

        this._lastSelectedNode = clickedItem;
        this._setElementEnabled('okButton', !this._multipleItemsSelected() && clickedItem.getAttribute("data-type") != "bin");
        this._updateToolbar();
    }

    _selectItem(listItem, value) {
        listItem.setAttribute("data-selected", value);
        if (value) {
            listItem.classList.add("selected");
        } else {
            listItem.classList.remove("selected");
        }
    }

    _isSelected(listItem) {
        return (/true/i).test(listItem.getAttribute("data-selected"));
    }

    _multipleItemsSelected() {
        let selectedItems = 0;
        for (let listItem of this._getElement('fileList').childNodes) {
            if (this._isSelected(listItem)) {
                selectedItems++;
            }
        }
        return selectedItems > 1;
    }

    _updateToolbar() {
        this._setElementEnabled('delButton', this._canPerformWritableFileOperation());
        this._setElementEnabled('renameButton', !this._multipleItemsSelected() && this._canPerformWritableFileOperation());
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

    _canPerformWritableFileOperation(includeFolder = true) {
        if (this._readOnlyMode) {
            return false;
        }

        let selectedItems = this._getSelectedFilesInfo();

        if (selectedItems.length < 1) {
            return false;
        }

        for (let item of selectedItems) {
            if (!this._validName(item.filename)) {
                return false;
            }
        }

        if (!includeFolder) {
            for (let item of selectedItems) {
                if (item.filetype == "folder") {
                    return false;
                }
            }
        }

        return true;
    }

    _canDownload() {
        let selectedItems = this._getSelectedFilesInfo();
        for (let item of selectedItems) {
            if (!this._validName(item.filename)) {
                return false;
            }
        }

        return true;
    }

    async _handleOkButton() {
        await this._openItem();
    }

    async _handleDelButton() {
        if (!this._canPerformWritableFileOperation()) return;

        let filenames = this._getSelectedFilenames();
        let displayFilename = '';
        if (filenames.length == 0) return;

        if (filenames.length > 1) {
            displayFilename = `${filenames.length} items`;
        } else {
            displayFilename = this._currentPath + filenames[0];
        }

        if (!confirm(`Are you sure you want to delete ${displayFilename}?`)) {
            return; // If cancelled, do nothing
        }

        for (let filename of filenames) {
            // Delete the item
            await this._showBusy(this._fileHelper.delete(filename));
        }

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

    prettySize(filesize, decimals = 1, units = FILESIZE_UNITS) {
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

    async _upload(onlyFolders = false) {
        if (this._readOnlyMode) return;

        let input = document.createElement("input");
        input.type = 'file';
        input.multiple = true;
        input.webkitdirectory = onlyFolders;
        input.addEventListener('change', async (event) => {
            try {
                let files = Array.from(input.files);
                let totalBytes = 0;
                let bytesCompleted = 0;
                for (let file of files) {
                    totalBytes += file.size;
                }

                let madeDirs = new Set();
                this._progressDialog.open();
                for (let [index, file] of files.entries()) {
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
                    // TODO: Improve performance by caching all files in each folder so we don't have to do a listDir call each time
                    if (await this._fileHelper.fileExists(this._currentPath + filename) && !confirm(`${filename} already exists. Overwrite?`)) {
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
            } catch (error) {
                this._progressDialog.close();
                await this._showMessage(`Error: ${error.message}`);
                console.error(error);
            }
        });
        input.click();
    }

    async _handleDownloadButton() {
        await this._showBusy(this._download(this._getSelectedFilesInfo()));
    }

    async _download(files) {
        if (!this._canDownload()) return;

        let blob, filename;

        // Function to read the file contents as a blob
        let getBlob = async (path) => {
            return await this._fileHelper.readFile(path, true);
        };

        let getParentFolderName = () => {
            if (this._currentPath == "/") {
                return "CIRCUITPY";
            } else {
                return this._currentPath.split("/").slice(-2).join("");
            }
        };

        let addFileContentsToZip = async (zip, folder, location) => {
            let contents = await getBlob(folder + location);
            // Get the filename only from the path
            zip.file(location, contents);
        };

        if (files.length == 1 && files[0].filetype != "folder") {
            // Single File Selected
            filename = files[0].filename;
            blob = await getBlob(this._currentPath + filename);
        } else {
            // We either have more than 1 item selected or we have a folder selected or we have no file selected and want to download the current folder
            // If we have nothing selected, we will download the current folder
            filename = `${getParentFolderName()}.zip`;
            if (files.length == 0) {
                // No Files Selected, so get everything in current folder
                const filesInFolder = await this._fileHelper.listDir(this._currentPath);

                // Add all files in current folder to files array
                for (let fileObj of filesInFolder) {
                    if (this._hidePaths.has(this._currentPath + fileObj.path)) continue;
                    files.push({filename: fileObj.path, filetype: fileObj.isDir ? "folder" : "file", path: this._currentPath});
                }
            } else if (files.length == 1) {
                // Single Folder Selected
                filename = `${files[0].filename}.zip`;
            }

            let zip = new JSZip();
            for (let item of files) {
                if (item.filetype == "folder") {
                    let containedFiles = await this._fileHelper.findContainedFiles(item.path + item.filename + "/", true);
                    for (let location of containedFiles) {
                        await addFileContentsToZip(zip, item.path, item.filename + "/" + location);
                    }
                } else {
                    await addFileContentsToZip(zip, item.path, item.filename);
                }
            }
            blob = await zip.generateAsync({type: "blob"});
        }

        saveAs(blob, filename);
    }

    async _handleMoveButton() {
        // Get the new path
        const newFolderDialog = new FileDialog("folder-select", this._showBusy);
        let hidePaths = new Set();
        hidePaths.add(this._getSelectedFilePath());
        hidePaths.add(this._currentPath);
        let newFolder = await newFolderDialog.open(this._fileHelper, FILE_DIALOG_MOVE, hidePaths, false);
        let errors = false;
        if (newFolder) {
            const files = this._getSelectedFilesInfo();
            for (let file of files) {
                const filename = file.filename;
                const filetype = file.filetype == "folder" ? "folder" : "file";
                const oldPath = this._currentPath + filename;
                const newPath = newFolder + filename;
                if (await this._showBusy(this._fileHelper.fileExists(newPath))) {
                    this._showMessage(`Error moving ${oldPath}. Another ${filetype} with the same name already exists at ${newPath}.`);
                    errors = true;
                } else if (!(await this._showBusy(this._fileHelper.move(oldPath, newPath)))) {
                    this._showMessage(`Error moving ${oldPath} to ${newPath}. Make sure the file you are moving exists.`);
                    errors = true;
                }
            }
            if (!errors) {
                // Go to the new location
                await this._openFolder(newFolder);
            }
        }
    }

    async _handleRenameButton() {
        if (!this._canPerformWritableFileOperation()) return;

        let oldName = this._getSelectedFilenames();
        if (oldName.length != 1) {
            return;
        }
        oldName = oldName[0];
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

    _getSelectedFiles() {
        let files = [];

        // Loop through items and see if any have data-selected
        for (let listItem of this._getElement('fileList').childNodes) {
            if ((/true/i).test(listItem.getAttribute("data-selected"))) {
                files.push(listItem);
            }
        }

        return files;
    }

    _getSelectedFilesInfo() {
        let files = [];
        let selectedFles = this._getSelectedFiles();
        for (let file of selectedFles) {
            let info = {
                filename: file.querySelector("span").innerHTML,
                filetype: file.getAttribute("data-type"),
                path: file.getAttribute("data-type") == "folder" ? this._currentPath : this._currentPath + file.querySelector("span").innerHTML,
            };
            files.push(info);
        }

        return files;
    }

    _getSelectedFilenames() {
        let filenames = [];
        let files = this._getSelectedFiles();
        for (let file of files) {
            filenames.push(file.querySelector("span").innerHTML);
        }

        return filenames;
    }

    _getSelectedFileType() {
        let file = this._getSelectedFiles();
        if (file) {
            return file.getAttribute("data-type");
        }
        return null;
    }

    _getSelectedFilePath() {
        // Get the paths of all selected files. These will not be valid paths to move to.
        let paths = [];
        let files = this._getSelectedFilesInfo();
        if (files.length < 1) return [];

        for (let file of files) {
            if (file.filetype != "folder") {
                if (!paths.includes(this._currentPath)) {
                    paths.push(this._currentPath);
                }
            } else {
                paths.push(this._currentPath + filename);
            }
        }

        return paths;
    }

    async _openItem(item, forceNavigate = false) {
        const fileNameField = this._getElement('fileNameField');
        let filetype, filename;
        let selectedItem = this._getSelectedFiles();
        if (selectedItem.length > 1) {
            // We don't currently support opening multiple items
            return;
        }
        selectedItem = selectedItem.length == 1 ? selectedItem[0] : null;

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

    _addFile(fileObj, iconClass, iconStyle = FA_STYLE_REGULAR) {
        const fileList = this._getElement('fileList');
        let styles = [];
        let fileItem = document.createElement("a");
        if (isHiddenFile(fileObj.path)) {
            fileItem.classList.add("hidden-file");
        }
        fileItem.setAttribute("data-type", getFileType(fileObj.path, fileObj.isDir));

        // Add Events
        fileItem.addEventListener("click", (event) => {
            let clickedItem = event.target;
            if (clickedItem.tagName.toLowerCase() != "a") {
                clickedItem = clickedItem.parentNode;
            }
            this._handleFileClick(clickedItem, event);
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
            styles = getFileIcon(fileObj.path, fileObj.isDir);
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
    FILE_DIALOG_COPY,
    getFileExtension,
    getFileIcon,
    isHiddenFile,
    getFileType
};
