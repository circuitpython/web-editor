import {REPL} from '@adafruit/circuitpython-repl-js';
//import {REPL} from '../../../circuitpython-repl-js/repl.js';

import {FileHelper} from '../common/file.js';
import {ButtonValueDialog, UnsavedDialog} from '../common/dialogs.js';
import {FileDialog, FILE_DIALOG_OPEN, FILE_DIALOG_SAVE} from '../common/file_dialog.js';
import {CONNTYPE, CONNSTATE} from '../constants.js';
import {plotValues} from '../common/plotter.js'
import {isLinux, sleep} from '../common/utilities.js';

// How long we are willing to wait for the host kernel to flush a pending
// FSAPI write down to the CIRCUITPY drive before we send Ctrl-D. The kernel's
// default dirty_expire_centisecs on most Linux distros is 3000 (=30s), but
// laptop-mode and similar power-saving configs can push it to 60s or beyond,
// and slow USB buses or large files extend the actual flush time further.
// 60s covers the common laptop-mode case while still falling through to the
// existing save-retry loop if the flush genuinely never completes. Issue #229.
const HOST_FLUSH_TIMEOUT_MS = 60000;
// Poll interval while waiting. Keep low so we proceed quickly once the kernel
// does flush. Each poll opens the file on the device and checksums its
// contents to confirm the data sectors (not just the FAT directory entry)
// have been flushed by the host kernel.
const HOST_FLUSH_POLL_MS = 500;

/*
 * This class will encapsulate all of the common workflow-related functions
 */

const validBackends = {
    "web": CONNTYPE.Web,
    "ble": CONNTYPE.Ble,
    "usb": CONNTYPE.Usb,
};

function isValidBackend(backend) {
    return backend in validBackends;
}

function getBackendWorkflow(backend) {
    if (isValidBackend(backend)) {
        return validBackends[backend];
    }
    return null;
}

function getWorkflowBackendName(workflow) {
    return Object.keys(validBackends).find(key => validBackends[key] === workflow) || null;
}

class Workflow {
    constructor() {
        this.terminal = null;
        this.terminalTitle = null;
        this.debugLog = null;
        this.loader = null;
        this.type = CONNTYPE.None;
        this.partialWrites = false;
        this.disconnectCallback = null;
        this.loadEditor = null;
        this.connectDialog = null;
        this._okCancelDialog = new ButtonValueDialog("ok-cancel");
        this._connected = false;
        this.currentFilename = null;
        this.fileHelper = null;
        this._unsavedDialog = new UnsavedDialog("unsaved");
        this._fileDialog = new FileDialog("files", this.showBusy.bind(this));
        this.repl = new REPL();
        this.plotterEnabled = false;
        this.plotterChart = false;
        this.buttonStates = [];
        this.connectButtons = {};
        // Caller-supplied callback used by the "back to workflow chooser"
        // button on each connect dialog (issue #373). Set in init().
        this.chooseConnection = null;
    }

    async init(params) {
        this.terminal = params.terminal;
        this.debugLog = params.debugLogFunc;
        this.disconnectCallback = params.disconnectFunc;
        this.loadEditor = params.loadEditorFunc;
        this._isDirty = params.isDirtyFunc;
        this._saveFileContents = params.saveFileFunc;
        this._loadFileContents = params.loadFileFunc;
        this._showMessage = params.showMessageFunc;
        this.loader = document.getElementById("loader");
        this.plotterBufferSize = document.getElementById('buffer-size');
        this.plotterGridLines = document.getElementById('plot-gridlines-select');
        if ("terminalTitle" in params) {
            this.terminalTitle = params.terminalTitle;
        }
        this.currentFilename = params.currentFilename;
        this._showSerial = params.showSerialFunc;
        if (params.chooseConnectionFunc) {
            this.chooseConnection = params.chooseConnectionFunc;
        }

        this.repl.setTitle = this.setTerminalTitle.bind(this);
        this.repl.writeToTerminal = this.writeToTerminal.bind(this);
        this.repl.serialTransmit = this.serialTransmit.bind(this);
    }

    async initFileClient(fileClient) {
        this.fileHelper = new FileHelper(fileClient);
    }

    async disconnectButtonHandler(e) {

    }

    async connect() {
        this.clearConnectStatus();
        return await this.available();
    }

    // On Linux + FSAPI workflow, the host kernel can hold a just-written file
    // in its page cache for up to ~30s before flushing to the vfat-mounted
    // CIRCUITPY drive. Sending Ctrl-D before that happens makes CircuitPython
    // try to import a half-written file and bail with OSError [Errno 5].
    //
    // This helper polls the device's view of the filesystem via REPL until it
    // sees the file at the expected size (= host has flushed) or we hit the
    // timeout (in which case we fall through and let the caller proceed,
    // because waiting forever is worse than a possibly-failing reboot that
    // the existing retry path can recover from). See issue #229.
    //
    // Public wrapper shows the busy loader for the duration of the wait so
    // the user knows the UI is not frozen during the (potentially ~30s) wait.
    async _waitForHostFlush() {
        // Quick non-async checks first so we never flash the loader when
        // there is nothing to wait for. Mirrors early-exits in the impl.
        if (!isLinux() || !this.fileHelper) {
            return;
        }
        const fileClient = this.fileHelper.getFileClient?.();
        if (!fileClient || typeof fileClient.getLastWrite !== "function") {
            return;
        }
        if (!fileClient.getLastWrite()) {
            return;
        }
        await this.showBusy(this._waitForHostFlushImpl(fileClient));
    }

    // Intercepted serial-transmit used by the terminal panel. When the user
    // types Ctrl-D directly in the terminal we route it through the same
    // host-flush wait used by the Run / Reboot buttons. Without this, a
    // user-initiated Ctrl-D right after a save would race the kernel page
    // cache flush and trigger OSError [Errno 5]. Issue #229.
    async serialTransmitWithFlushGuard(data) {
        // \x04 = Ctrl-D, which CircuitPython interprets as a soft reboot
        // when received at the normal prompt. Only intercept if our
        // host-flush guard has something pending; otherwise pass straight
        // through to keep terminal latency low.
        if (typeof data === "string" && data.includes("\x04")
                && isLinux() && this.fileHelper) {
            const fileClient = this.fileHelper.getFileClient?.();
            if (fileClient && typeof fileClient.getLastWrite === "function"
                    && fileClient.getLastWrite()) {
                await this._waitForHostFlush();
            }
        }
        return await this.serialTransmit(data);
    }

    async _waitForHostFlushImpl(fileClient) {
        const pending = fileClient.getLastWrite();
        if (!pending) {
            return;
        }
        const {path, byteLength, checksum} = pending;
        // Escape any single quotes / backslashes in the path before injecting
        // into the python snippet below.
        const safePath = String(path).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        // Probe both the FAT directory entry (os.stat) AND the file's data
        // sectors (read all bytes and xor-checksum them). Linux can update
        // the directory metadata block before flushing the data block, so
        // os.stat alone is not a sufficient flush detector. We compare the
        // xor sum to the host-computed value to confirm correct content is
        // present on the device.
        const code = `
try:
    import os
    _s = os.stat('${safePath}')[6]
    with open('${safePath}', 'rb') as _f:
        _b = _f.read()
    _c = 0
    for _x in _b:
        _c = (_c ^ _x) & 0xff
    print(_s, _c, len(_b))
except OSError:
    print(-1, -1, -1)
`;
        const start = Date.now();
        while (Date.now() - start < HOST_FLUSH_TIMEOUT_MS) {
            let result;
            try {
                result = await this.repl.runCode(code);
            } catch (e) {
                console.warn("Host-flush poll failed, proceeding without wait:", e);
                return;
            }
            const match = String(result || "").match(/(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
            if (match) {
                const size = parseInt(match[1], 10);
                const devChecksum = parseInt(match[2], 10);
                const readLen = parseInt(match[3], 10);
                // Require all three to confirm the data sectors (not just
                // the FAT directory entry) are flushed: correct size, full
                // readable length, and matching checksum. Linux can update
                // the directory block before the data block, so os.stat
                // alone is not a sufficient flush detector.
                if (size >= byteLength && readLen >= byteLength
                        && (checksum < 0 || devChecksum === checksum)) {
                    fileClient.clearLastWrite?.();
                    return;
                }
            }
            await sleep(HOST_FLUSH_POLL_MS);
        }
        console.warn(
            `Host-flush wait timed out after ${HOST_FLUSH_TIMEOUT_MS}ms for ` +
            `${path} (expected ${byteLength} bytes). Proceeding anyway; if the ` +
            `reboot fails the editor's save-retry logic will recover.`
        );
        // Leave the tracker set so the next softRestart will retry the wait
        // in case the kernel eventually flushes between now and then.
    }

    async restartDevice() {
        if (await this.safeMode()) {
            let result = await this._okCancelDialog.open("Device is currently in safe mode. Reboot device?");
            if (result === "ok") {
                console.log("Rebooting device from safe mode");
                await this.rebootDevice();
            }
        }
        await this._waitForHostFlush();
        await this.repl.softRestart();
    }

    async rebootDevice() {
        let code = `
try:
    import microcontroller
    microcontroller.reset()
except ImportError:
    pass
`;
        await this.showBusy(this.repl.runCode(code));
    }

    async haltScript() {
        await this.repl.interruptCode();
    }

    makeDocState(document, docChangePos) {
        return {
            path: this.currentFilename,
            contents: document,
            pos: docChangePos,
        };
    }

    async onDisconnected(e, reconnect = true) {
        console.log("onDisconnected called in workflow");
        this.debugLog("disconnected");
        this.updateConnected(CONNSTATE.disconnected);
        // Update Common UI Elements
        if (this.disconnectCallback) {
            this.disconnectCallback();
        }
        if (reconnect) {
            await this.connect();
        }
    }

    async onConnected(e) {
        console.log("Connected!");
        this.updateConnected(CONNSTATE.connected);
        if (this.connectDialog) {
            this.connectDialog.close();
        }
    }

    async onSerialReceive(e) {
        await this.repl.onSerialReceive(e);
    }

    connectionStatus(partialConnectionsAllowed = false) {
        if (partialConnectionsAllowed) {
            return this._connected != CONNSTATE.disconnected;
        }

        // Require both the connection state flag and an initialized fileHelper.
        // This guards against a race where the underlying transport reports
        // "connected" before the file client has been wired up (see #327).
        return this._connected == CONNSTATE.connected && this.fileHelper != null;
    }

    async deinit() {

    }

    updateConnected(connectionState) {
        if (Object.values(CONNSTATE).includes(connectionState)) {
            this._connected = connectionState;
        }
    }

    async showBusy(functionPromise, darkBackground = true) {
        try {
            if (this.loader) {
                if (darkBackground) {
                    this.loader.classList.add("overlay");
                } else {
                    this.loader.classList.remove("overlay");
                }
                this.loader.classList.add("busy");
            }
            let result = await functionPromise;
            
            return result;
        } finally {
            if (this.loader) {
                this.loader.classList.remove("busy");
            }
        }
    }

    async parseParams(urlParams) {
        // Workflow specific params check
        return false;
    }

    writeToTerminal(data) {
        if (this.plotterEnabled) {
            plotValues(this.plotterChart, data, this.plotterBufferSize.value);
        }
        this.terminal.write(data);
    }

    setTerminalTitle(title, append = false) {
        if (this.terminalTitle == null) {
            return;
        }

        if (append) {
            title = this.terminalTitle.textContent + title;
        }

        this.terminalTitle.textContent = title;
        this.terminalTitle.title = title;
    }

    async showConnect(documentState) {
        return await this.connectDialog.open();
    }

    // Wires up the "Choose a different workflow" link inside a connect
    // dialog. Each subclass calls this from showConnect() after it has
    // resolved its modal. The link/button is selected by the
    // `.connect-back` class so the markup stays consistent across dialogs.
    _wireBackToChooser(modal) {
        if (!modal || !this.chooseConnection) {
            return;
        }
        const backLinks = modal.querySelectorAll('.connect-back');
        backLinks.forEach((el) => {
            const handler = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.chooseConnection();
            };
            // Remove a previously attached handler (idempotent re-open)
            if (el._connectBackHandler) {
                el.removeEventListener('click', el._connectBackHandler);
            }
            el._connectBackHandler = handler;
            el.addEventListener('click', handler);
        });
    }

    async runCurrentCode() {
        let path = this.currentFilename;

        if (!path) {
            console.log("File has not been saved");
            return false;
        }

        let extension = path.split('.').pop();
        if (extension === null) {
            console.log("Extension not found");
            return false;
        }
        if (String(extension).toLowerCase() != "py") {
            console.log("Extension not .py, it was ." + String(extension).toLowerCase());
            return false;
        }

        await this._showSerial();

        // Wait for any pending Linux page-cache flush before either path:
        // Ctrl-D would race code.py's read on a soft restart, and `import X`
        // would race X.py's bytecode read on first import. See issue #229.
        await this._waitForHostFlush();

        if (path == "/code.py") {
            await this.repl.softRestart();
        } else {
            path = path.slice(1, -3);
            path = path.replace(/\//g, ".");
            this.repl.writeToTerminal("\r\nRunning 'import " + path + "'...\r\n");
            this.repl.writeToTerminal(await (this.repl.runCode("import " + path)));
            this.repl.writeToTerminal("\r\nCode done running.\r\n");
        }
    }

    async checkSaved() {
        if (this._isDirty()) {
            let result = await this._unsavedDialog.open("Current changes will be lost. Do you want to save?");
            if (result !== null) {
                if (!result || await this.saveFile()) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    async saveFile(path = null) {
        if (path == null) {
            if (this.currentFilename != null) {
                path = this.currentFilename;
            } else {
                path = await this.saveFileAs();
            }
        }
        // Use loose equality so an undefined return from saveFileAs (e.g., dialog
        // canceled or rejected) is treated the same as null and does not get
        // forwarded to writeFile, where it would crash in _splitPath. See #327.
        if (path != null) {
            // Propagate the actual save result so Save+Run and other callers
            // can avoid taking follow-up actions (soft-restart, import) when
            // the underlying PUT failed. _saveFileContents returns false on
            // exhausted retries; treating only an explicit `false` as failure
            // keeps backwards compatibility with older saveFileFunc callbacks
            // that returned undefined on success (issue #460).
            const result = await this._saveFileContents(path);
            return result !== false;
        }
        return false;
    }

    async saveFileAs() {
        let path = await this.saveFileDialog();
        // Normalize undefined to null so callers can use a single check.
        if (path == null) {
            return null;
        }
        // check if filename exists
        if (path != this.currentFilename && await this.fileExists(path) && !window.confirm("Overwrite existing file '" + path + "'?")) {
            return null;
        }
        this.currentFilename = path;
        await this.saveFile(path);
        return path;
    }

    async fileExists(path) {
        return await this.showBusy(this.fileHelper.fileExists(path));
    }

    async openFile() {
        if (await this.checkSaved()) {
            await this.openFileDialog(this.fileLoadHandler.bind(this));
        }
    }

    async fileLoadHandler(path) {
        console.log("Path:", path);
        if (path !== null) {
            let contents = await this.readFile(path);
            this._loadFileContents(path, contents);
        }
    }

    // Open a file dialog and return the path or null if canceled
    async saveFileDialog() {
        return await this._fileDialog.open(this.fileHelper, FILE_DIALOG_SAVE);
    }

    async openFileDialog(callback) {
        let path = await this._fileDialog.open(this.fileHelper, FILE_DIALOG_OPEN);
        await callback(path);
    }

    async writeFile(path, contents, offset = 0) {
        return await this.showBusy(
            this.fileHelper.writeFile(path, offset, contents)
        );
    }

    async readFile(path) {
        return await this.showBusy(this.fileHelper.readFile(path));
    }

    async readOnly() {
        if (this.fileHelper) {
            return await this.fileHelper.readOnly();
        }
        return false;
    }

    async safeMode() {
        let code = `
try:
    import supervisor
    print(supervisor.runtime.safe_mode_reason is not supervisor.SafeModeReason.NONE)
except ImportError:
    print(False)
`;
        let result = await this.showBusy(this.repl.runCode(code));
        let isSafeMode = result.match("True") != null;

        return isSafeMode;
    }

    async parseParams() {
        return true;
    }

    async available() {
        return Error("This work flow is not available.");
    }

    // Handle the different button states for various connection steps
    connectionStep(step) {
        // Check if a dialog exists
        if (!this.connectDialog.isOpen()) {
            return;
        }

        if (step < 0) step = 0;
        if (step > this.buttonStates.length - 1) step = this.buttonStates.length - 1;

        for (let button in this.connectButtons) {
            this.connectButtons[button].disabled = !this.buttonStates[step][button];
        }

        // Mark all previous steps as completed (hidden or not)
        for (let stepNumber = 0; stepNumber < step; stepNumber++) {
            this._markStepCompleted(stepNumber);
        }
    }

    _markStepCompleted(stepNumber) {
        let modal = this.connectDialog.getModal();
        let steps = modal.querySelectorAll('.step');
        // For any steps prior to the last step, add a checkmark
        for (let i = 0; i < steps.length - 1; i++) {
            let step = steps[stepNumber];
            if (!step.classList.contains('completed')) {
                step.classList.add('completed');
            }
        }
    }

     clearConnectStatus(modal) {
        // Check if a dialog exists
        if (!this.connectDialog.isOpen()) {
            return;
        }

        try {
            const modal = this.connectDialog.getModal();
            modal.querySelector('.connect-status').hidden = true;
        } catch (e) {
            console.log("Modal not active on clearStatus()", e);
        }
    }

    showConnectStatus(message) {
        try {
            const modal = this.connectDialog.getModal();
            const statusBox = modal.querySelector('.connect-status');
            statusBox.hidden = false;
            let statusContentBox = statusBox.querySelector('.connect-status-content');
            statusContentBox.innerHTML = message;
        } catch (e) {
            console.log("Modal not active on showStatus()", e);
        }
    }
}

export {
    Workflow,
    isValidBackend,
    getBackendWorkflow,
    getWorkflowBackendName
};
