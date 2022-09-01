import {EditorState, EditorView, basicSetup} from "../../_snowpack/pkg/@codemirror/basic-setup.js"
import {python} from "../../_snowpack/pkg/@codemirror/lang-python.js"
import {classHighlightStyle} from "../../_snowpack/pkg/@codemirror/highlight.js"
import {BLEWorkflow} from './workflows/ble.js'
import {WebWorkflow} from './workflows/web.js'
import {CONNTYPE, Workflow} from './workflows/workflow.js'
import {FileDialog, ButtonValueDialog, UnsavedDialog, MessageModal, FILE_DIALOG_OPEN, FILE_DIALOG_SAVE} from './common/dialogs.js';
import {FileHelper} from './common/file.js'
import {sleep} from './common/utilities.js'

var terminal;
var fitter;
var unchanged = 0;
var workflow = null;

var validBackends = {
    "web": CONNTYPE.Web,
    "ble": CONNTYPE.Ble,
    "usb": CONNTYPE.Usb,
}

// Instantiate workflows
var workflows = {}
workflows[CONNTYPE.Ble] = new BLEWorkflow();
workflows[CONNTYPE.Web] = new WebWorkflow();

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
const CHAR_CTRL_C = '\x03';
const CHAR_CTRL_D = '\x04';
const CHAR_CRLF = '\x0a\x0d';
var fileDialog = null;
var fileHelper = null;

const unsavedDialog = new UnsavedDialog("unsaved");
const messageDialog = new MessageModal("message");
const connectionType = new ButtonValueDialog("connection-type");

const editorTheme = EditorView.theme({}, {dark: true})
const editorExtensions = [
    basicSetup,
    python(),
    editorTheme,
    classHighlightStyle,
    EditorView.updateListener.of(onTextChange)
]
// New Buttons (Mobile and Desktop Layout)
btnNew.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await checkConnected();
        if (await checkSaved()) {
            loadEditorContents("");
            unchanged = editor.state.doc.length;
            setFilename(null);
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
        if (await checkSaved()) {
            let path = await fileDialog.open(fileHelper, FILE_DIALOG_OPEN);
            if (path !== null) {
                let contents = await workflow.showBusy(fileHelper.readFile(path));
                loadEditorContents(contents);
                unchanged = editor.state.doc.length;
                setFilename(path);
                console.log("Current File Changed to: " + workflow.currentFilename);
            }
        }
    });
});

// Save As Buttons (Mobile and Desktop Layout)
btnSaveAs.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await checkConnected();
        let path = await saveAs();
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
        await saveFile();
        await runCode(workflow.currentFilename);
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
    await workflow.showInfo(editor.state.doc.sliceString(0));
});

async function checkConnected() {
    let connected = workflow != null && workflow.connectionStatus();
    if (!connected) {
        let connType = await chooseConnection();
        // For now just connect to last workflow
        if (!connType) {
            return;
        }
        await loadWorkflow(connType);

        // Connect if we're local
        let isLocal = WebWorkflow.isLocal();
        if (isLocal && workflow.host) {
            await workflow.showBusy(workflow.connect());
        }

        if (!workflow.connectionStatus()) {
            // Display the appropriate connection dialog
            await workflow.showConnect(editor.state.doc.sliceString(0));
        } else if (workflow.type === CONNTYPE.Web) {
            // We're connected, local, and using Web Workflow
            await workflow.showInfo(editor.state.doc.sliceString(0));
        }
    }
}

function setFilename(path) {
    if (path === null) {
        path = "[New Document]";
    } else if (!workflow) {
        throw Error("Unable to set path when no workflow is loaded");
    }
    if (workflow) {
        workflow.currentFilename = path;
    }
    document.querySelector('#editor-bar .file-path').innerHTML = path;
    document.querySelector('#mobile-editor-bar .file-path').innerHTML = path.split("/")[path.split("/").length - 1];
}

async function chooseConnection() {
    // Get the promise first
    let p = connectionType.open();

    // Disable any buttons in validBackends, but not in workflows
    let modal = connectionType.getModal();
    let buttons = modal.querySelectorAll("button");
    buttons.forEach((button) => {
        if (button.value in validBackends && !(validBackends[button.value] in workflows)) {
            button.disabled = true;
        }
    });

    // Wait for the user to click a button
    let connType = await p;
    if (connType in validBackends) {
        return validBackends[connType];
    }

    // Outside of dialog was clicked
    return null;
}

// Dynamically Load a Workflow (where the magic happens)
async function loadWorkflow(workflowType=null) {
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
                currentFilename: currentFilename,
            });
            fileDialog = new FileDialog("files", workflow.showBusy.bind(workflow));
        } else {
            console.log("Reload workflow");
        }
    } else {
        console.log("Unload workflow");
        if (workflow != null) {
            // Update Workflow specific UI elements
            await workflow.disconnectButtonHandler();
        }
        // Unload whatever
        workflow = null;
        fileDialog = null;
        fileHelper = null;
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
}
setFilename(null);

async function runCode(path) {
    if (path == "/code.py") {
        await workflow.serialTransmit(CHAR_CTRL_D);
    }

    let extension = path.split('.').pop();
    if (extension === null) {
        console.log("Extension not found");
        return false;
    }
    if (String(extension).toLowerCase() != "py") {
        console.log("Extension not py, twas " + String(extension).toLowerCase());
        return false;
    }
    path = path.substr(1, path.length - 4);
    path = path.replace(/\//g, ".");

    await changeMode(MODE_SERIAL);
    await workflow.serialTransmit(CHAR_CTRL_C + "import " + path + CHAR_CRLF);
}

async function showMessage(message) {
    return await messageDialog.open(message);
}

async function checkSaved() {
    if (isDirty()) {
        await checkConnected();
        let result = await unsavedDialog.open("Current changes will be lost. Do you want to save?");
        if (result !== null) {
            if (!result || await saveFile()) {
                return true;
            }
        }
        return false;
    }
    return true;
}

async function saveFile(path) {
    const previousFile = workflow.currentFilename;
    if (path !== undefined) {
        // All good, continue
    } else if (workflow.currentFilename !== null) {
        path = workflow.currentFilename;
    } else {
        path = await saveAs();
    }
    if (path !== null) {
        if (path !== previousFile) {
            // This is a different file, so we write everything
            unchanged = 0;
        }
        setFilename(path);
        await writeText();
        return true;
    }
    return false;
}

async function saveAs() {
    let path = await fileDialog.open(fileHelper, FILE_DIALOG_SAVE);
    if (path !== null) {
        // check if filename exists
        if (path != workflow.currentFilename && await fileHelper.fileExists(path)) {
            if (window.confirm("Overwrite existing file '" + path + "'?")) {
                await saveFile(path);
            } else {
                return null;
            }
        } else {
            await saveFile(path);
        }
    }
    return path;
}

async function changeMode(mode) {
    if (mode > 0) {
        mainContent.classList.remove("mode-landing", "mode-editor", "mode-serial");
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

var connected = false;

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
    connected = isConnected;
}

function fixViewportHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    if (fitter) {
        fitter.fit();
    }
}

/*window.onbeforeunload = () => {
    if (isDirty()) {
        return "You have unsaved changed, exit anyways?"
    }
};*/

fixViewportHeight();
window.addEventListener("resize", fixViewportHeight);

async function loadEditor() {
    fileHelper = new FileHelper(workflow);
    const readOnly = await fileHelper.readOnly();
    btnSaveAs.forEach((element) => {
        element.disabled = readOnly;
    });
    btnSaveRun.forEach((element) => {
        element.disabled = readOnly;
    });
    if (readOnly) {
        await showMessage("Warning: File System is in read only mode. Disable the USB drive to allow write access.");
    }

    let documentState = loadParameterizedContent();
    if (documentState) {
        setFilename(documentState.path);
        loadEditorContents(documentState.contents);
    } else if (editor.state.doc.length == 0 && await fileHelper.fileExists("/code.py")) {
        setFilename("/code.py");
        loadEditorContents(await workflow.getDeviceFileContents());
    } else {
        setFilename(null);
        loadEditorContents(await workflow.getDeviceFileContents());
    }

    unchanged = editor.state.doc.length;
    //console.log("doc length", unchanged);
    updateUIConnected(true);
    await changeMode(MODE_EDITOR);
}

var editor;
var currentTimeout = null;
async function writeText() {
    if (workflow.partialWrites) {
        console.log("sync starting at", unchanged, "to", editor.state.doc.length);
    }
    if (!fileHelper) {
        console.log("no file client");
        return;
    }
    let encoder = new TextEncoder();
    let doc = editor.state.doc;
    let same = doc.sliceString(0, unchanged);
    let offset = 0;
    let different = doc.sliceString(unchanged);
    let contents = doc.sliceString(0);
    if (workflow.partialWrites) {
        offset = encoder.encode(same).byteLength;
        contents = encoder.encode(different);
        console.log(offset, different);
    }
    let oldUnchanged = unchanged;
    unchanged = doc.length;
    try {
        console.log("write");
        await workflow.showBusy(fileHelper.writeFile(workflow.currentFilename, offset, contents));
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
})

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

// TODO: Check parameters if on code.circuitpython.org for #backend
function getBackend() {
    if (WebWorkflow.isLocal()) {
        return validBackends["web"];
    }

    return null;
}

function loadParameterizedContent() {
    let urlParams = Workflow.getUrlParams();
    if ("state" in urlParams) {
        let documentState = JSON.parse(decodeURIComponent(urlParams["state"]));
        delete urlParams["state"];
        let currentURL = new URL(window.location);
        currentURL.hash = WebWorkflow.buildHash(urlParams);
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

                // Web Workflow Notes
                // ------------------------
                // Possible Entry Points
                // 1. User goes to /code/ on device
                //      It is already handled without issue
                // 2. User goes to https://code.circuitpython.org and clicks Connect -> Web Workflow
                //      Instructions appear and tell the user to go to http://circuitpython.local/code/
                //      Perhaps some instructions regarding how to set up the device
                //      Is there a good way to transfer their work via parameters or a POST???
                //      What happens when they're redirected to cpy-XXXXXX.local?
                //          hashtag remains
                //      Continue to Entry Point 1
                // 3. User has already connected from Device and clicks Disconect -> Connect -> Web Workflow
                //      Show the connection options (BLE and Web Workflow for now)
                //      If user chooses BLE, user should be forwarded to code.circuitpython.org
                //          Work should be transferred as well
                //          We don't want to destroy any work they've done at this point,
                //          but what if they unplugged the device or hit reset?
                //              It should be in a disconnected state
                //      If user chooses Web Workflow:
                //          It connects to last device and
                //          shows List of any other devices
                //          If they click one, can we transfer work again like in Entry 2?
                // 4. They click a link from Device Discovery
                //      Same as #1 really
                //
                // Is there an easier way to allow the user to see other devices?
                // Perhaps a button that only appears for Web Workflow.
                // Where is a good place for it? Maybe next to Save As
                // Device Discovery is the Web Workflow analog to the Web Bluetooth List and Web Serial Device List
                // Device Info could be shown about each device in the discovery dialog (perhaps a hover?)

                // Device Discovery should be similar to the one on the welcome screen
            }
        });
    });

    // Check backend param and load appropriate type if specified
    let backend = getBackend();
    if (backend) {
        await loadWorkflow(backend);
        // If we don't have all the info we need to connect
        if (!workflow.parseParams()) {
            if (backend == validBackends["web"]) {
                await showMessage("You are connected with localhost, but didn't supply the device hostname.");
            } else {
                await workflow.showConnect(editor.state.doc.sliceString(0));
            }
        } else {
            if (!(await workflow.showBusy(workflow.connect()))) {
                showMessage("Unable to connect. Be sure device is plugged in and set up properly.");
            }
        }
    }
});