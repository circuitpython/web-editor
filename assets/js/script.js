import {EditorState, EditorView, basicSetup} from "../../_snowpack/pkg/@codemirror/basic-setup.js"
import {python} from "../../_snowpack/pkg/@codemirror/lang-python.js"
import {classHighlightStyle} from "../../_snowpack/pkg/@codemirror/highlight.js"
import {BLEWorkflow} from './workflows/ble.js'
import {WebWorkflow} from './workflows/web.js'
import {CONNTYPE} from './workflows/workflow.js'
import {FileDialog, UnsavedDialog, MessageModal, FILE_DIALOG_OPEN, FILE_DIALOG_SAVE} from './common/dialogs.js';
import {FileHelper} from './common/file.js'

var terminal;
var currentFilename = null;
var unchanged = 0;
var backend = null;
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
    element.addEventListener('click',  async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (await checkSaved()) {
            loadEditorContents("");
            unchanged = editor.state.doc.length;
            setFilename(null);
            console.log("Current File Changed to: " + currentFilename);
        }
    });
});

// Open Buttons (Mobile and Desktop Layout)
btnOpen.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (await checkSaved()) {
            let path = await fileDialog.open(fileHelper, FILE_DIALOG_OPEN);
            if (path !== null) {
                let contents = await workflow.showBusy(fileHelper.readFile(path));
                loadEditorContents(contents);
                unchanged = editor.state.doc.length;
                setFilename(path);
                console.log("Current File Changed to: " + currentFilename);
            }
        }
    });
});

// Save As Buttons (Mobile and Desktop Layout)
btnSaveAs.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        let path = await saveAs();
        if (path !== null) {
            console.log("Current File Changed to: " + currentFilename);
        }
    });
});

// Save + Run Buttons (Mobile and Desktop Layout)
btnSaveRun.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await saveFile();
        await runCode(currentFilename);
    });
});

// Restart Button
btnRestart.addEventListener('click', async function(e) {
    // Send the Ctrl+D control character to the board via serial
    e.preventDefault();
    e.stopPropagation();
    await workflow.serialTransmit(CHAR_CTRL_D);
});

// Mode Buttons
btnModeEditor.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    changeMode(MODE_EDITOR);
});

btnModeSerial.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    changeMode(MODE_SERIAL);
});

function setFilename(path) {
    currentFilename = path;
    if (path === null) {
        path = "[New Document]";
    }
    document.querySelector('#editor-bar .file-path').innerHTML = path;
    document.querySelector('#mobile-editor-bar .file-path').innerHTML = path.split("/")[path.split("/").length - 1];
}

// Dynamically Load a Workflow (where the magic happens)
async function loadWorkflow(workflowType) {
    if (!(workflowType in workflows)) {
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
            workflow = workflows[workflowType];
            // Initialize the workflow
            await workflow.init({
                terminal: terminal,
                terminalTitle: terminalTitle,
                loadEditorFunc: loadEditor,
                debugLogFunc: debugLog,
                disconnectFunc: disconnectCallback,
            });
            fileDialog = new FileDialog("files", workflow.showBusy.bind(workflow));
        }
    } else {
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

    changeMode(MODE_SERIAL);
    await workflow.serialTransmit(CHAR_CTRL_C + "import " + path + CHAR_CRLF);
}

async function showMessage(message) {
    return await messageDialog.open(message);
}

async function checkSaved() {
    if (isDirty()) {
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
    const previousFile = currentFilename;
    if (path !== undefined) {
        // All good, continue
    } else if (currentFilename !== null) {
        path = currentFilename;
    } else {
        path = saveAs();
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
        if (path != currentFilename && await fileHelper.fileExists(path)) {
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

function changeMode(mode) {
    if (mode > 0) {
        mainContent.classList.remove("mode-landing", "mode-editor", "mode-serial");
    }
    if (mode == MODE_EDITOR) {
        mainContent.classList.add("mode-editor");
    } else if (mode == MODE_SERIAL) {
        mainContent.classList.add("mode-serial");
    }
}

var connected = false;

async function debugLog(msg) {
    terminal.io.print('\x1b[93m');
    terminal.io.print(msg);
    terminal.io.println('\x1b[m');
}

function updateUIConnected(isConnected) {
    if (isConnected) {
        // Set to Connected State
        btnConnect.forEach((element) => { 
            element.innerHTML = "Disconnect"; 
            element.disabled = false;
        });
    } else {
        // Set to Disconnected State
        btnConnect.forEach((element) => { 
            element.innerHTML = "Connect";
            element.disabled = false; 
        });
    }
    connected = isConnected;
}

function fixViewportHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);  
}

window.onbeforeunload = () => {
    if (connected) {
        return "You are still connected, exit anyways?"
    }
}
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
    if (await fileHelper.fileExists("/code.py")) {
        setFilename("/code.py");
        var contents = await workflow.showBusy(workflow.getDeviceFileContents(currentFilename));
    } else {
        setFilename(null);
        contents = "";
    }
    loadEditorContents(contents);
    unchanged = editor.state.doc.length;
    //console.log("doc length", unchanged);
    updateUIConnected(true);
    changeMode(MODE_EDITOR);
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
    let contents = doc;
    if (workflow.partialWrites) {
        offset = encoder.encode(same).byteLength;
        contents = encoder.encode(different);
        console.log(offset, different);
    }
    let oldUnchanged = unchanged;
    unchanged = doc.length;
    try {
        console.log("write");
        await workflow.showBusy(fileHelper.writeFile(currentFilename, offset, contents));
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
    //currentTimeout = setTimeout(writeText, 750);
}

function disconnectCallback() {
    updateUIConnected(false);
}

editor = new EditorView({
    state: EditorState.create({
        doc: "Connect to load code.py",
        extensions: [basicSetup, editorTheme]
    }),
    parent: document.querySelector('#editor')
})

function setupHterm() {
    // hterm.defaultStorage = new lib.Storage.Local();
    // profileId is the name of the terminal profile to load, or "default" if
    // not specified.  If you're using one of the persistent storage
    // implementations then this will scope all preferences read/writes to this
    // name.
    const t = new hterm.Terminal();
    terminal = t;
    t.prefs_.set('background-color', '#333');
    t.prefs_.set('foreground-color', '#ddd')
    t.prefs_.set('cursor-color', '#ddd')
    t.onTerminalReady = function() {
        // Create a new terminal IO object and give it the foreground.
        // (The default IO object just prints warning messages about unhandled
        // things to the the JS console.)
        const io = t.io.push();

        io.onVTKeystroke = async (str) => {
            workflow.serialTransmit(str);
        };

        io.sendString = async (str) => {
            workflow.serialTransmit(str);
        };

        io.onTerminalResize = (columns, rows) => {
            // React to size changes here.
            // Secure Shell pokes at NaCl, which eventually results in
            // some ioctls on the host.
            //console.log("resize", columns, rows);
        };

        // You can call io.push() to foreground a fresh io context, which can
        // be uses to give control of the terminal to something else.  When that
        // thing is complete, should call io.pop() to restore control to the
        // previous io object.
    };
    t.decorate(document.getElementById('terminal'));
    t.installKeyboard();
}

function getBackend() {
    if (location.hostname.search(/cpy-[0-9A-F].local/gi) >= 0 || (location.hostname == "localhost")) {
        if (location.pathname == "/code/") {
            return validBackends["web"];
        }
    }

    return null;
}

function getUrlParams() {
    // This should look for and validate very specific values
    var hashParams = {};
    if (location.hash) {
        location.hash.substr(1).split("&").forEach(function(item) {hashParams[item.split("=")[0]] = item.split("=")[1]});
    }
    return hashParams;
}

// This will be whatever normal entry/initialization point your project uses.
window.onload = async function() {
    await lib.init();
    setupHterm();
    btnConnect.forEach((element) => {
        element.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Check if we have an active connection
            if (workflow != null && workflow.connectionType != CONNTYPE.None) {
                console.log("Unload workflow");
                // If so, unload the current workflow
                await loadWorkflow(CONNTYPE.None);
            } else {
                console.log("Load workflow");
                // If not, it should display the available connections
                // For now just connect BLE
                await loadWorkflow(CONNTYPE.Ble);
                // Eventually, the available connections dialog should call the appropriate loadWorkflow which should trigger a connect method
                if (workflow.connectionType == CONNTYPE.None) {
                    // Display the appropriate connection dialog
                    await workflow.connectDialog.open();
                }
            }
        });
    });

    // Check backend param and load appropriate type if specified
    backend = getBackend();
    if (backend) {
        await loadWorkflow(backend);

        // If we don't have all the info we need to connect
        if (!(await workflow.parseParams(getUrlParams()))) {
            if (backend == validBackends["web"]) {
                showMessage("You are connected with localhost, but didn't supply the device hostname.");
            } else {
                await workflow.connectDialog.open();
            }
        } else {
            if (!(await workflow.showBusy(workflow.connect()))) {
                showMessage("Unable to connect");
            }
        }
    }
};