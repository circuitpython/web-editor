import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands"
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, indentUnit } from "@codemirror/language";
import { classHighlighter } from "@lezer/highlight";
import { getFileIcon } from "./common/file_dialog.js";

import { Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';

import state from './state.js'
import { BLEWorkflow } from './workflows/ble.js';
import { USBWorkflow } from './workflows/usb.js';
import { WebWorkflow } from './workflows/web.js';
import { isValidBackend, getBackendWorkflow, getWorkflowBackendName } from './workflows/workflow.js';
import { ButtonValueDialog, MessageModal } from './common/dialogs.js';
import { isLocal, isMdns, isIp, switchUrl, getUrlParam } from './common/utilities.js';
import { Settings } from './common/settings.js';
import { CONNTYPE } from './constants.js';
import './layout.js'; // load for side effects only
import { setupPlotterChart } from "./common/plotter.js";
import { mainContent, showSerial } from './layout.js';

// Instantiate workflows
let workflows = {};
workflows[CONNTYPE.Ble] = new BLEWorkflow();
workflows[CONNTYPE.Usb] = new USBWorkflow();
workflows[CONNTYPE.Web] = new WebWorkflow();

let workflow = null;
let unchanged = 0;
let connectionPromise = null;
let debugMessageAnsi = null;

const btnRestart = document.querySelector('.btn-restart');
const btnHalt = document.querySelector('.btn-halt');
const btnPlotter = document.querySelector('.btn-plotter');
const btnClear = document.querySelector('.btn-clear');
const btnConnect = document.querySelectorAll('.btn-connect');
const btnNew = document.querySelectorAll('.btn-new');
const btnOpen = document.querySelectorAll('.btn-open');
const btnSave = document.querySelectorAll('.btn-save');
const btnSaveAs = document.querySelectorAll('.btn-save-as');
const btnSaveRun = document.querySelectorAll('.btn-save-run');
const btnInfo = document.querySelector('.btn-info');
const btnSettings = document.querySelector('.btn-settings');
const terminalTitle = document.getElementById('terminal-title');
const serialPlotter = document.getElementById('plotter');

const messageDialog = new MessageModal("message");
const connectionType = new ButtonValueDialog("connection-type");
const settings = new Settings();

// localStorage key used to remember the most recently chosen backend
// ("web" | "ble" | "usb"). When the user clicks Connect after a
// disconnect, we prefer the last backend over re-prompting for one.
const LAST_BACKEND_KEY = "webeditor.lastBackend";

function getLastBackend() {
    try {
        const name = window.localStorage.getItem(LAST_BACKEND_KEY);
        if (name && isValidBackend(name)) {
            return getBackendWorkflow(name);
        }
    } catch (e) {
        // localStorage may be unavailable (privacy mode, etc.) — that's fine
    }
    return null;
}

function rememberLastBackend(workflowType) {
    try {
        const name = getWorkflowBackendName(workflowType);
        if (name) {
            window.localStorage.setItem(LAST_BACKEND_KEY, name);
        }
    } catch (e) {
        // ignore — non-fatal
    }
}

const editorTheme = EditorView.theme({}, {dark: getCssVar('editor-theme-dark').trim() === '1'});

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('mobile-menu-button').addEventListener('click', handleMobileToggle);
    document.querySelectorAll('#mobile-menu-contents li a').forEach((element) => {
        element.addEventListener('click', handleMobileToggle);
    });
});

function handleMobileToggle(event) {
    event.preventDefault();

    var menuContainer = document.getElementById('mobile-menu-contents');

    menuContainer.classList.toggle('hidden');

    var menuIcon = document.querySelector('#mobile-menu-button > i');
    if (menuContainer.classList.contains('hidden')) {
        menuIcon.classList.replace('fa-times', 'fa-bars');
    } else {
        menuIcon.classList.replace('fa-bars', 'fa-times');
    }
}

// New Link/Button (Mobile and Desktop Layout)
btnNew.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await newFile();
    });
});

// Open Link/Button (Mobile and Desktop Layout)
btnOpen.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await openFile();
    });
});

// Save Link/Button (Mobile and Desktop Layout)
btnSave.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await saveFile();
    });
});

// Save As Link/Button (Mobile and Desktop Layout)
btnSaveAs.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (await checkConnected()) {
            let path = await workflow.saveFileAs();
            if (path !== null) {
                console.log("Current File Changed to: " + workflow.currentFilename);
            }
        }
    });
});

// Save + Run Link/Button (Mobile and Desktop Layout)
btnSaveRun.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await saveRunFile();
    });
});

// Restart Button
btnRestart.addEventListener('click', async function(e) {
    if (await checkConnected()) {
        // Perform a device soft restart
        await workflow.restartDevice();
    }
});

// Halt Button
btnHalt.addEventListener('click', async function(e) {
    if (await checkConnected()) {
        // Perform a device soft halt
        await workflow.haltScript();
    }
});

// Clear Button
btnClear.addEventListener('click', async function(e) {
    if (workflow.plotterChart){
        workflow.plotterChart.data.datasets.forEach((dataSet, index) => {
            workflow.plotterChart.data.datasets[index].data = [];
        });
        workflow.plotterChart.data.labels = [];
        workflow.plotterChart.options.scales.y.min = -1;
        workflow.plotterChart.options.scales.y.max = 1;
        workflow.plotterChart.update();
    }
    state.terminal.clear();
});

// Plotter Button
btnPlotter.addEventListener('click', async function(e){
    serialPlotter.classList.toggle("hidden");
    if (workflow && !workflow.plotterEnabled){
        await setupPlotterChart(workflow);
        workflow.plotterEnabled = true;
    }
});

btnInfo.addEventListener('click', async function(e) {
    if (await checkConnected()) {
        await workflow.showInfo(getDocState());
    }
});

btnSettings.addEventListener('click', async function(e) {
    if (await settings.showDialog()) {
        applySettings();
    }
});

// Basic functions used for buttons and hotkeys
async function openFile() {
    if (await checkConnected()) {
        workflow.openFile();
    }
}

async function saveFile() {
    if (await checkConnected()) {
        await workflow.saveFile();
    }
}

async function newFile() {
    if (await checkConnected()) {
        if (await workflow.checkSaved()) {
            loadFileContents(null, "");
        }
    }
}

async function saveRunFile() {
    if (await checkConnected()) {
        // workflow.saveFile() now propagates the real save result -- only
        // soft-restart / re-import once the PUT actually succeeded. Otherwise
        // we would reboot the board running the old code.py while the editor
        // still had the unsaved edits (issue #460).
        if (await workflow.saveFile()) {
            await workflow.runCurrentCode();
        }
    }
}

function setSaved(saved) {
    if (saved) {
        mainContent.classList.remove("unsaved");
    } else {
        mainContent.classList.add("unsaved");
    }
}

async function checkConnected() {
    if (!workflow || !workflow.connectionStatus()) {
        let connType;

        // Prefer the last backend the user successfully connected with
        // (issue #373) so clicking Connect after a disconnect skips the
        // chooser. The connect dialog itself has a "back" link that calls
        // chooseAndShowConnect() if the user wants to switch workflows.
        const lastBackend = getLastBackend();
        if (lastBackend) {
            connType = lastBackend;
        } else {
            connType = await chooseConnection();
            if (!connType) {
                return false;
            }
        }
        await loadWorkflow(connType);

        // Connect if we're local (Web Workflow Only)
        if ((isLocal()) && workflow.host) {
            if (await workflowConnect()) {
                await checkReadOnly();
            }
        }

        if (!workflow.connectionStatus()) {
            // Display the appropriate connection dialog
            await workflow.showConnect(getDocState());
        } else if (workflow.type === CONNTYPE.Web) {
            // We're connected, local, and using Web Workflow
            await workflow.showInfo(getDocState());
        }
    }

    return true;
}

// Closes whatever connect dialog is open and re-opens the workflow chooser,
// then loads/connects to whichever workflow the user picks. Used by the
// "back" button inside each connect dialog (issue #373).
async function chooseAndShowConnect() {
    if (workflow && workflow.connectDialog && workflow.connectDialog.isOpen()) {
        workflow.connectDialog.close();
    }
    let connType = await chooseConnection();
    if (!connType) {
        return false;
    }
    await loadWorkflow(connType);
    if (!workflow.connectionStatus()) {
        await workflow.showConnect(getDocState());
    }
    return true;
}

function getDocState() {
    return workflow.makeDocState(editor.state.doc.sliceString(0), unchanged);
}

async function workflowConnect() {
    let returnVal;
    if (!workflow) return false;

    if ((returnVal = await workflow.showBusy(workflow.connect())) instanceof Error) {
        await showMessage(`Unable to connect. ${returnVal.message}`);
        return false;
    }

    return true;
}

async function checkReadOnly() {
    const readOnly = await workflow.readOnly();
    btnSaveAs.forEach((element) => {
        element.disabled = readOnly;
    });
    btnSaveRun.forEach((element) => {
        element.disabled = readOnly;
    });
    if (readOnly instanceof Error) {
        await showMessage(readOnly);
        return false;
    } else if (readOnly) {
        await showMessage("Warning: File System is in read only mode. Disable the USB drive to allow write access.");
    }
    return true;
}

/* Update the filename and update the UI */
function setFilename(path) {
    // Use the extension_map to figure out the file icon
    let filename = path;

    // Prepend an icon to the path
    const [style, icon] = getFileIcon(path);
    filename = `<i class="${style} ${icon}"></i> ` + filename;

    if (path === null) {
        filename = "[New Document]";
        btnSave.forEach((b) => b.style.display = 'none');
    } else if (!workflow) {
        throw Error("Unable to set path when no workflow is loaded");
    } else {
        btnSave.forEach((b) => b.style.display = null);
    }
    if (workflow) {
        workflow.currentFilename = path;
    }
    document.querySelector('#editor-bar .file-path').innerHTML = filename;
    document.querySelector('#mobile-editor-bar .file-path').innerHTML = path === null ? filename : filename.split("/")[filename.split("/").length - 1];
}

async function chooseConnection() {
    // Don't allow more than one dialog
    if (connectionPromise) return;
    // Get the promise first
    connectionPromise = connectionType.open();

    // Disable any buttons in validBackends, but not in workflows
    let modal = connectionType.getModal();
    let buttons = modal.querySelectorAll("button");
    for (let button of buttons) {
        if (!getBackendWorkflow(button.value)) {
            button.disabled = true;
        }
    };

    // Wait for the user to click a button
    let connType = await connectionPromise;
    connectionPromise = null
    if (isValidBackend(connType)) {
        return getBackendWorkflow(connType);
    }

    // Outside of dialog was clicked
    return null;
}

// Dynamically Load a Workflow (where the magic happens)
async function loadWorkflow(workflowType = null) {
    let currentFilename = null;

    if (workflow && workflowType == null) {
        // Get the last workflow
        workflowType = workflow.type;
    }

    if (!(workflowType in workflows) && workflowType != CONNTYPE.None) {
        return false;
    }

    // Unload anything from the current workflow
    if (workflow != null) {
        // Update Workflow specific UI elements
        await workflow.deinit();
    }

    if (workflowType != CONNTYPE.None) {
        // Is the requested workflow different than the currently loaded one?
        if (workflow != workflows[workflowType]) {
            console.log("Load different workflow");
            if (workflow) {
                currentFilename = workflow.currentFilename;

                if (isLocal()) {
                    let url = "https://code.circuitpython.org";
                    if (location.hostname == "localhost" || location.hostname == "127.0.0.1") {
                        url = `${location.protocol}//${location.host}`;
                    }
                    switchUrl(url, getDocState(), getWorkflowBackendName(workflowType));
                }
            }
            workflow = workflows[workflowType];
            rememberLastBackend(workflowType);
            // Initialize the workflow
            await workflow.init({
                terminal: state.terminal,
                terminalTitle: terminalTitle,
                loadEditorFunc: loadEditor,
                debugLogFunc: debugLog,
                disconnectFunc: disconnectCallback,
                isDirtyFunc: isDirty,
                setFilenameFunc: setFilename,
                saveFileFunc: saveFileContents,
                loadFileFunc: loadFileContents,
                loadEditorContentsFunc: loadEditorContents,
                showMessageFunc: showMessage,
                currentFilename: currentFilename,
                showSerialFunc: showSerial,
                chooseConnectionFunc: chooseAndShowConnect,
            });
        } else {
            console.log("Reload workflow");
        }
    } else {
        console.log("Unload workflow");
        if (workflow != null) {
            // Update Workflow specific UI elements
            await workflow.disconnectButtonHandler();
        }
        // Unload workflow
        workflow = null;
    }
}

const hotkeyMap = [
    { key: "Mod-s", run: saveFile },
    { key: "Mod-o", run: openFile },
    { key: "Alt-n", run: newFile },
    { key: "Mod-r", run: saveRunFile },
];
const editorExtensions = [
    basicSetup,
    keymap.of([indentWithTab]),
    keymap.of(hotkeyMap),
    indentUnit.of("    "),
    python(),
    editorTheme,
    syntaxHighlighting(classHighlighter),
    EditorView.updateListener.of(onTextChange)
];

// Use the editor's function to check if anything has changed
function isDirty() {
    if (unchanged == editor.state.doc.length) return false;
    return true;
}

function loadEditorContents(content) {
    editor.setState(EditorState.create({
        doc: content,
        extensions: editorExtensions
    }));
    unchanged = editor.state.doc.length;
    //console.log("doc length", unchanged);
}

setFilename(null);

async function showMessage(message) {
    return await messageDialog.open(message);
}

async function debugLog(msg) {
    if (debugMessageAnsi === null) {
        const colorCode = getCssVar('debug-message-color').trim();
        debugMessageAnsi = `\x1b[38;2;${parseInt(colorCode.slice(1,3),16)};${parseInt(colorCode.slice(3,5),16)};${parseInt(colorCode.slice(5,7),16)}m`;
    }
    state.terminal.writeln(''); // get a fresh line without any prior content (a '>>>' prompt might be there without newline)
    state.terminal.writeln(`${debugMessageAnsi}${msg}\x1b[0m`);
}

function updateUIConnected(isConnected) {
    if (isConnected) {
        // Set to Connected State
        btnConnect.forEach((element) => {
            element.innerHTML = "Disconnect";
            element.disabled = false;
        });
        if (workflow.showInfo !== undefined) {
            btnInfo.disabled = false;
        }
    } else {
        // Set to Disconnected State
        btnConnect.forEach((element) => {
            element.innerHTML = "Connect";
            element.disabled = false;
        });
        btnInfo.disabled = true;
    }
}

window.onbeforeunload = () => {
    if (isDirty()) {
        return "You have unsaved changed, exit anyways?";
    }
};

async function loadEditor() {
    let documentState = loadParameterizedContent();
    if (documentState) {
        loadFileContents(documentState.path, documentState.contents, null);
        unchanged = documentState.pos;
        setSaved(!isDirty());
    }

    updateUIConnected(true);
}

var editor;
const MAX_SAVE_RETRIES = 3;
const SAVE_RETRY_DELAY_MS = 2000;
let saveInFlight = false;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Save the File Contents and update the UI. Returns true on success, false
// on final failure (after all retries). Retries inline so callers (Save+Run,
// hotkeys, dialogs) can actually await the outcome -- previously this used
// a fire-and-forget setTimeout, which let Save+Run soft-restart the board
// before the PUT had succeeded (issue #460).
async function saveFileContents(path) {
    if (saveInFlight) {
        // Re-entrant save (e.g. user mashing Ctrl-S / Save+Run). The first
        // call will report success/failure; the second would race the same
        // bytes onto the wire and confuse partialWrites bookkeeping.
        console.log("saveFileContents: already in flight, ignoring re-entry");
        return false;
    }
    saveInFlight = true;
    try {
        // If this is a different file, we write everything
        if (path !== workflow.currentFilename) {
            unchanged = 0;
        }
        let doc = editor.state.doc;
        let contents = doc.sliceString(0);
        let baseUnchanged = unchanged;
        let docLengthAtStart = doc.length;

        for (let attempt = 1; attempt <= MAX_SAVE_RETRIES; attempt++) {
            // Recompute offset each attempt -- if onTextChange fired between
            // retries, `unchanged` may have shrunk and we need to resend more.
            let offset = 0;
            if (workflow.partialWrites) {
                offset = Math.min(baseUnchanged, unchanged);
                console.log("sync starting at", offset, "to", editor.state.doc.length);
            }
            // Optimistically mark the bytes-being-sent as unchanged. If the
            // write throws we'll roll back to baseUnchanged for the next try.
            unchanged = docLengthAtStart;
            try {
                if (await workflow.writeFile(path, contents, offset)) {
                    setFilename(workflow.currentFilename);
                    setSaved(true);
                    return true;
                }
                // writeFile returned a falsy value without throwing -- treat
                // as a soft failure and surface a message immediately.
                await showMessage(`Saving file '${workflow.currentFilename}' failed.`);
                setSaved(false);
                return false;
            } catch (e) {
                console.error(`write failed (attempt ${attempt} of ${MAX_SAVE_RETRIES})`, e, e.stack);
                unchanged = Math.min(baseUnchanged, unchanged);
                // If the device cleanly told us the filesystem is held by
                // someone else (most commonly USB-MSC: the host has
                // CIRCUITPY mounted), retrying won't help -- surface an
                // actionable hint immediately and bail. Older CircuitPython
                // firmware returns 500 for this case, newer firmware
                // returns 409 Conflict; web-file-transfer.js tags both
                // with `writeProtected` so we can treat them the same way.
                if (e && e.writeProtected) {
                    setSaved(false);
                    const hint = e.hint || "The filesystem is currently read-only.";
                    await showMessage(
                        `Saving file '${workflow.currentFilename}' failed: ${hint} ` +
                        `Your edits are still in the editor -- save again once the drive is released.`
                    );
                    return false;
                }
                if (attempt < MAX_SAVE_RETRIES) {
                    await sleep(SAVE_RETRY_DELAY_MS);
                    // Bail out if the user disconnected mid-retry.
                    if (!workflow || !workflow.connectionStatus()) {
                        setSaved(false);
                        return false;
                    }
                }
            }
        }
        // All retries exhausted. Leave the editor marked dirty so the user
        // knows the file on the board is still stale.
        setSaved(false);
        await showMessage(`Saving file '${workflow.currentFilename}' failed after multiple attempts. Check your connection and try again.`);
        return false;
    } finally {
        saveInFlight = false;
    }
}

// Load the File Contents and Path into the UI
function loadFileContents(path, contents, saved = true) {
    setFilename(path);
    loadEditorContents(contents);
    if (saved !== null) {
        setSaved(saved);
    }
    console.log("Current File Changed to: " + workflow.currentFilename);
}

async function onTextChange(update) {
    if (!update.docChanged) {
        return;
    }

    var hasGap = false;
    update.changes.desc.iterGaps(function(posA, posB, length) {
        // this are unchanged gaps.
        hasGap = true;
        if (posA != 0 && posB != 0) {
            return;
        } else if (posA == 0 && posB == 0) {
            unchanged = Math.min(length, unchanged);
        } else {
            unchanged = 0;
        }
    });
    // Everything has changed.
    if (!hasGap) {
        unchanged = 0;
    }

    setSaved(false);
}

function disconnectCallback() {
    // saveInFlight is intentionally not forced here -- the in-flight
    // saveFileContents loop checks connectionStatus() between retries and
    // exits cleanly on its own, then clears the flag in its finally block.
    updateUIConnected(false);
}

editor = new EditorView({
    state: EditorState.create({
        doc: "",
        extensions: editorExtensions
    }),
    parent: document.querySelector('#editor')
});

function getCssVar(varName) {
    return window.getComputedStyle(document.body).getPropertyValue("--" + varName);
}

async function setupXterm() {
    state.terminal = new Terminal({
        theme: {
            background: getCssVar('background-color'),
            foreground: getCssVar('terminal-text-color'),
            cursor: getCssVar('terminal-text-color'),
        }
    });

    state.terminal.loadAddon(new WebLinksAddon());

    state.terminal.open(document.getElementById('terminal'));
    state.terminal.onData(async (data) => {
        if (await checkConnected()) {
            // Route through the flush-guard wrapper so a user-typed Ctrl-D
            // right after a save waits for the host kernel to flush before
            // the device reads code.py. See issue #229.
            await workflow.serialTransmitWithFlushGuard(data);
        }
    });
}

function getBackend() {
    let backend = getUrlParam("backend");
    if (backend && isValidBackend(backend)) {
        return getBackendWorkflow(backend);
    } else if (isLocal()) {
        // Only auto-select Web Workflow when we're actually running on a
        // device (mdns/IP host serving /code/) or the user has supplied a
        // host= override. Bare localhost should fall through to the connect
        // dialog so the user can pick BLE/Serial/USB.
        if (isMdns() || isIp() || getUrlParam("host", false)) {
            return getBackendWorkflow("web");
        }
    }

    return null;
}

function loadParameterizedContent() {
    let documentState = getUrlParam("state");
    if (documentState) {
        documentState = JSON.parse(decodeURIComponent(documentState));
    }
    return documentState;
}

function applySettings() {
    // ----- Themes -----
    const theme = settings.getSetting('theme');
    // Remove all theme-[option] classes from body
    document.body.classList.forEach((className) => {
        if (className.startsWith('theme-')) {
            document.body.classList.remove(className);
        }
    });

    // Add the selected theme class
    document.body.classList.add(`theme-${theme}`);

    // Apply to EditorView.theme dark parameter
    editor.darkTheme = getCssVar('editor-theme-dark').trim() === '1';

    // Apply to xterm
    state.terminal.options.theme = {
        background: getCssVar('background-color'),
        foreground: getCssVar('terminal-text-color'),
        cursor: getCssVar('terminal-text-color'),
    };

    debugMessageAnsi = null;

    // Note: Debug Message color is applied on next debug message or reload
    // I'm not sure how to go through the xterm's existing content and change escape sequences
    // Changing the CSS style reverts to the old style on terminal update/redraw

}

document.addEventListener('DOMContentLoaded', async (event) => {
    await setupXterm();
    applySettings();
    btnConnect.forEach((element) => {
        element.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Check if we have an active connection
            if (workflow != null && workflow.connectionStatus()) {
                // If so, unload the current workflow
                await workflow.disconnectButtonHandler(null);
            } else {
                // If not, it should display the available connections
                await checkConnected();
            }
        });
    });

    // Check backend param and load appropriate type if specified
    let backend = getBackend();
    if (backend) {
        await loadWorkflow(backend);
        // If we don't have all the info we need to connect
        let returnVal = await workflow.parseParams();
        if (returnVal === true && await workflowConnect() && workflow.type === CONNTYPE.Web) {
            if (await checkReadOnly()) {
                // We're connected, local, no errors, and using Web Workflow
                await workflow.showInfo(getDocState());
            }
        } else {
            if (returnVal instanceof Error) {
                await showMessage(returnVal);
            } else {
                loadEditor();
                await workflow.showConnect(getDocState());
            }
        }
    } else {
        await checkConnected();
    }
});
