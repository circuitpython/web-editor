import {EditorView, basicSetup} from "codemirror";
import {EditorState} from "@codemirror/state";
import {python} from "@codemirror/lang-python";
import {classHighlighter} from "@lezer/highlight";
import {syntaxHighlighting} from "@codemirror/language";
import {BLEWorkflow} from './workflows/ble.js';
import {WebWorkflow} from './workflows/web.js';
import {USBWorkflow} from './workflows/usb.js';
import {CONNTYPE, CHAR_CTRL_D} from './workflows/workflow.js';
import {ButtonValueDialog, MessageModal} from './common/dialogs.js';
import {sleep, buildHash, isLocal, getUrlParams, getUrlParam} from './common/utilities.js';

var terminal;
var fitter;
var unchanged = 0;
var workflow = null;

var validBackends = {
    "web": CONNTYPE.Web,
    "ble": CONNTYPE.Ble,
    "usb": CONNTYPE.Usb,
};

// Instantiate workflows
var workflows = {};
workflows[CONNTYPE.Ble] = new BLEWorkflow();
workflows[CONNTYPE.Web] = new WebWorkflow();
workflows[CONNTYPE.Usb] = new USBWorkflow();

const btnModeEditor = document.getElementById('btn-mode-editor');
const btnModeSerial = document.getElementById('btn-mode-serial');
const btnRestart = document.getElementById('btn-restart');
const mainContent = document.getElementById('main-content');
const btnConnect = document.querySelectorAll('.btn-connect');
const btnNew = document.querySelectorAll('.btn-new');
const btnOpen = document.querySelectorAll('.btn-open');
const btnSaveAs = document.querySelectorAll('.btn-save-as');
const btnSaveRun = document.querySelectorAll('.btn-save-run');
const btnInfo = document.getElementById('btn-info');
const terminalTitle = document.getElementById('terminal-title');

const MODE_EDITOR = 1;
const MODE_SERIAL = 2;

const messageDialog = new MessageModal("message");
const connectionType = new ButtonValueDialog("connection-type");

const editorTheme = EditorView.theme({}, {dark: true});
const editorExtensions = [
    basicSetup,
    python(),
    editorTheme,
    syntaxHighlighting(classHighlighter),
    EditorView.updateListener.of(onTextChange)
];

// New Buttons (Mobile and Desktop Layout)
btnNew.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await checkConnected();
        if (await workflow.checkSaved()) {
            loadEditorContents("");
            setFilename(null);
            setSaved(true);
            console.log("Current File Changed to: " + workflow.currentFilename);
        }
    });
});

// Open Buttons (Mobile and Desktop Layout)
btnOpen.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await checkConnected();
        await workflow.openFile();
        if (!isDirty()) {
            setSaved(true);
        }
    });
});

// Save As Buttons (Mobile and Desktop Layout)
btnSaveAs.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await checkConnected();
        let path = await workflow.saveAs();
        if (path !== null) {
            console.log("Current File Changed to: " + workflow.currentFilename);
        }
    });
});

// Save + Run Buttons (Mobile and Desktop Layout)
btnSaveRun.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await checkConnected();
        if (await workflow.saveFile()) {
            setSaved(true);
            await workflow.runCode();
        }
    });
});

// Restart Button
btnRestart.addEventListener('click', async function(e) {
    await checkConnected();
    // Send the Ctrl+D control character to the board via serial
    await workflow.serialTransmit(CHAR_CTRL_D);
});

// Mode Buttons
btnModeEditor.addEventListener('click', async function(e) {
    await changeMode(MODE_EDITOR);
});

btnModeSerial.addEventListener('click', async function(e) {
    await changeMode(MODE_SERIAL);
});

btnInfo.addEventListener('click', async function(e) {
    await checkConnected();
    await workflow.showInfo(editor.state.doc.sliceString(0), unchanged);
});

function setSaved(saved) {
    if (saved) {
        mainContent.classList.remove("unsaved");
    } else {
        mainContent.classList.add("unsaved");
    }
}

async function checkConnected() {
    if (!workflow || !workflow.connectionStatus()) {
        let connType = await chooseConnection();
        if (!connType) {
            return;
        }
        await loadWorkflow(connType);

        // Connect if we're local
        if (isLocal() && workflow.host) {
            if (await workflowConnect()) {
                await checkReadOnly();
            }
        }

        if (!workflow.connectionStatus()) {
            // Display the appropriate connection dialog
            await workflow.showConnect(workflow.makeDocState(editor.state.doc.sliceString(0), unchanged));
        } else if (workflow.type === CONNTYPE.Web) {
            // We're connected, local, and using Web Workflow
            await workflow.showInfo(editor.state.doc.sliceString(0), unchanged);
        }
    }
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
    if (readOnly) {
        await showMessage("Warning: File System is in read only mode. Disable the USB drive to allow write access.");
    }
}

/* Update the filename and update the UI */
function setFilename(path) {
    let filename = path;
    if (path === null) {
        filename = "[New Document]";
    } else if (!workflow) {
        throw Error("Unable to set path when no workflow is loaded");
    }
    if (workflow) {
        workflow.currentFilename = path;
    }
    document.querySelector('#editor-bar .file-path').innerHTML = filename;
    document.querySelector('#mobile-editor-bar .file-path').innerHTML = path === null ? filename : filename.split("/")[filename.split("/").length - 1];
}

async function chooseConnection() {
    // Get the promise first
    let p = connectionType.open();

    // Disable any buttons in validBackends, but not in workflows
    let modal = connectionType.getModal();
    let buttons = modal.querySelectorAll("button");
    for (let button of buttons) {
        if (!(button.value in validBackends) ||
            !(validBackends[button.value] in workflows)
        ) {
            button.disabled = true;
        }
    };

    // Wait for the user to click a button
    let connType = await p;
    if (connType in validBackends) {
        return validBackends[connType];
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
            console.log("Load workflow");
            if (workflow) {
                currentFilename = workflow.currentFilename;
            }
            workflow = workflows[workflowType];
            // Initialize the workflow
            await workflow.init({
                terminal: terminal,
                terminalTitle: terminalTitle,
                loadEditorFunc: loadEditor,
                debugLogFunc: debugLog,
                disconnectFunc: disconnectCallback,
                isDirtyFunc: isDirty,
                setFilenameFunc: setFilename,
                writeTextFunc: writeText,
                loadEditorContentsFunc: loadEditorContents,
                currentFilename: currentFilename,
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

async function changeMode(mode) {
    if (mode > 0) {
        mainContent.classList.remove("mode-editor", "mode-serial");
    }
    if (mode == MODE_EDITOR) {
        mainContent.classList.add("mode-editor");
    } else if (mode == MODE_SERIAL) {
        mainContent.classList.add("mode-serial");
        // Wait for the terminal to load and then resize it
        while (!document.querySelector('#terminal .xterm-screen').style.width) {
            await sleep(10);
        }
        fitter.fit();
    }
}

async function debugLog(msg) {
    terminal.write(`\x1b[93m${msg}\x1b[m\n`);
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

function fixViewportHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    if (fitter) {
        fitter.fit();
    }
}

window.onbeforeunload = () => {
    if (isDirty()) {
        return "You have unsaved changed, exit anyways?";
    }
};

fixViewportHeight();
window.addEventListener("resize", fixViewportHeight);

async function loadEditor() {
    let documentState = loadParameterizedContent();
    if (documentState) {
        loadEditorContents(documentState.contents);
        setFilename(documentState.path);
        unchanged = documentState.pos;
        setSaved(!isDirty());
    }

    updateUIConnected(true);
    await changeMode(MODE_EDITOR);
}

var editor;
var currentTimeout = null;
async function writeText(writeFrom = null) {
    if (writeFrom !== null) {
        unchanged = writeFrom;
    }
    let doc = editor.state.doc;
    let offset = 0;
    let contents = doc.sliceString(0);
    if (workflow.partialWrites) {
        offset = unchanged;
        console.log("sync starting at", unchanged, "to", editor.state.doc.length);
    }
    let oldUnchanged = unchanged;
    unchanged = doc.length;
    try {
        console.log("write");
        if (await workflow.writeFile(contents, offset)) {
            setFilename(workflow.currentFilename);
            setSaved(true);
        } else {
            await showMessage(`Saving file '${workflow.currentFilename} failed.`);
        }
    } catch (e) {
        console.log("write failed", e, e.stack);
        unchanged = Math.min(oldUnchanged, unchanged);
        if (currentTimeout != null) {
            clearTimeout(currentTimeout);
        }
        currentTimeout = setTimeout(writeText, 2000);
    }
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

    if (currentTimeout != null) {
        clearTimeout(currentTimeout);
    }

    setSaved(false);
}

function disconnectCallback() {
    updateUIConnected(false);
}

editor = new EditorView({
    state: EditorState.create({
        doc: "",
        extensions: editorExtensions
    }),
    parent: document.querySelector('#editor')
});

function setupXterm() {
    terminal = new Terminal({
        theme: {
            background: '#333',
            foreground: '#ddd',
            cursor: '#ddd',
        }
    });
    fitter = new FitAddon.FitAddon();
    terminal.loadAddon(fitter);
    terminal.open(document.getElementById('terminal'));
    terminal.onData((data) => {
        workflow.serialTransmit(data);
    });
}

function getBackend() {
    let backend = getUrlParam("backend");
    if (backend && (backend in validBackends)) {
        return validBackends[backend];
    } else if (isLocal()) {
        return validBackends["web"];
    }

    return null;
}

function loadParameterizedContent() {
    let urlParams = getUrlParams();
    if ("state" in urlParams) {
        let documentState = JSON.parse(decodeURIComponent(urlParams["state"]));
        delete urlParams["state"];
        let currentURL = new URL(window.location);
        currentURL.hash = buildHash(urlParams);
        window.history.replaceState({}, '', currentURL);
        return documentState;
    }
    return null;
}

document.addEventListener('DOMContentLoaded', async (event) => {
    setupXterm();
    btnConnect.forEach((element) => {
        element.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Check if we have an active connection
            if (workflow != null && workflow.connectionStatus()) {
                // If so, unload the current workflow
                await workflow.disconnectButtonHandler(null);
                //await loadWorkflow(CONNTYPE.None);
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
        if (!workflow.parseParams()) {
            if (workflow.type === CONNTYPE.Web) {
                await showMessage("You are connected with localhost, but didn't supply the device hostname.");
            } else {
                await workflow.showConnect(workflow.makeDocState(editor.state.doc.sliceString(0), unchanged));
            }
        } else {
            if (await workflowConnect() && workflow.type === CONNTYPE.Web) {
                await checkReadOnly();
                // We're connected, local, and using Web Workflow
                await workflow.showInfo(editor.state.doc.sliceString(0), unchanged);
            }
        }
    } else {
        await checkConnected();
    }
});