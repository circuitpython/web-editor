import {EditorState, EditorView, basicSetup, } from "@codemirror/basic-setup"
import {python} from "@codemirror/lang-python"
import {classHighlightStyle} from "@codemirror/highlight"
import {BLEWorkflow, loaderId} from '../workflows/ble.js'

var terminal;
var currentFilename = null;
var unchanged = 0;

const workflow = new BLEWorkflow();

const loader = document.getElementById(loaderId);
const btnModeEditor = document.getElementById('btn-mode-editor');
const btnModeSerial = document.getElementById('btn-mode-serial');
const btnRestart = document.getElementById('btn-restart');
const mainContent = document.getElementById('main-content');
const btnConnect = document.querySelectorAll('a.btn-connect');
const btnNew = document.querySelectorAll('a.btn-new');
const btnOpen = document.querySelectorAll('a.btn-open');
const btnSaveAs = document.querySelectorAll('a.btn-save-as');
const btnSaveRun = document.querySelectorAll('a.btn-save-run');

const MODE_EDITOR = 1;
const MODE_SERIAL = 2;
const MODE_LANDING = 3;
const CHAR_CTRL_C = '\x03';
const CHAR_CTRL_D = '\x04';
const CHAR_CRLF = '\x0a\x0d';
const fileDialog = new FileDialog("files", ".body-blackout", showBusy);
const unsavedDialog = new UnsavedDialog("unsaved", ".body-blackout");

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
            let path = await fileDialog.open(workflow.fileClient, FILE_DIALOG_OPEN);
            if (path !== null) {
                let contents = await showBusy(workflow.fileClient.readFile(path));
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

// Use the editors functions to check if anything has changed
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

async function showBusy(functionPromise) {
    loader.classList.add("busy");
    let result = await functionPromise;
    loader.classList.remove("busy");
    return result;
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

async function fileExists(path) {
    // Get the current path
    let pathParts = path.split("/");
    const filename = pathParts.pop();
    const folder = pathParts.join("/");

    // Get a list of files in current path
    const files = await showBusy(workflow.fileClient.listDir(folder));

    // See if the file is in the list of files
    for (let fileObj of files) {
        if (fileObj.path[0] == ".") continue;
        if (fileObj.path == filename) {
            return true;
        }
    }
    return false;
}

async function saveAs() {
    let path = await fileDialog.open(workflow.fileClient, FILE_DIALOG_SAVE);
    if (path !== null) {
        // check if filename exists
        if (path != currentFilename && await fileExists(path)) {
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
    } else if (mode == MODE_LANDING) {
        mainContent.classList.add("mode-landing");
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
        console.log("Connected");
        btnConnect.forEach((element) => { 
            element.innerHTML = "Disconnect"; 
            element.disabled = false;
        });
    } else {
        // Set to Disconnected State
        console.log("Disconnected");
        btnConnect.forEach((element) => { 
            element.innerHTML = "Connect";
            element.disabled = false; 
        });
    }
    // Update any workflow specific UI changes
    workflow.updateConnected(isConnected);
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
    if (await fileExists("/code.py")) {
        setFilename("/code.py");
        var contents = await showBusy(workflow.fileClient.readFile(currentFilename));
    } else {
        setFilename(null);
        contents = "";
    }
    loadEditorContents(contents);
    unchanged = editor.state.doc.length;
    console.log("doc length", unchanged);
    updateUIConnected(true);
    changeMode(MODE_EDITOR);
}

var editor;
var currentTimeout = null;
async function writeText() {
    console.log("sync starting at", unchanged, "to", editor.state.doc.length);
    if (!workflow.fileClient) {
        console.log("no file client");
        return;
    }
    let encoder = new TextEncoder();
    let doc = editor.state.doc;
    let same = doc.sliceString(0, unchanged);
    let offset = encoder.encode(same).byteLength
    let different = doc.sliceString(unchanged);
    let contents = encoder.encode(different);
    console.log(offset, different);
    let oldUnchanged = unchanged;
    unchanged = doc.length;
    try {
        console.log("write");
        await showBusy(workflow.fileClient.writeFile(currentFilename, offset, contents));
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
    changeMode(MODE_LANDING);
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

        debugLog("connect to a device above");

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
            console.log("resize", columns, rows);
        };

        // You can call io.push() to foreground a fresh io context, which can
        // be uses to give control of the terminal to something else.  When that
        // thing is complete, should call io.pop() to restore control to the
        // previous io object.
    };
    t.decorate(document.querySelector('#terminal'));
    t.installKeyboard();
}

// This will be whatever normal entry/initialization point your project uses.
window.onload = async function() {
    await lib.init();
    setupHterm();
    if (navigator.bluetooth) {
        btnConnect.forEach((element) => {
            element.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();    
                await workflow.connectButtonHandler();
            });
        });
    }
    workflow.init({
        terminal: terminal,
        loadEditorFunc: loadEditor,
        debugLogFunc: debugLog,
        disconnectFunc: disconnectCallback
    });
};
