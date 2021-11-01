import {FileTransferClient} from '../../_snowpack/pkg/@adafruit/ble-file-transfer.js';
import {EditorState, EditorView, basicSetup, } from "../../_snowpack/pkg/@codemirror/basic-setup.js"
import {python} from "../../_snowpack/pkg/@codemirror/lang-python.js"
import {classHighlightStyle} from "../../_snowpack/pkg/@codemirror/highlight.js"

const bleNusServiceUUID  = 'adaf0001-4369-7263-7569-74507974686e';
const bleNusCharRXUUID   = 'adaf0002-4369-7263-7569-74507974686e';
const bleNusCharTXUUID   = 'adaf0003-4369-7263-7569-74507974686e';

var bleDevice;
var serialDevice;
var bleServer;
var serialService;
var rxCharacteristic;
var txCharacteristic;
var client;
var terminal;
var decoder = new TextDecoder();
var currentFilename = null;

const BYTES_PER_WRITE = 20;

const btnRequestBluetoothDevice = document.querySelector('#requestBluetoothDevice');
const btnBond = document.querySelector('#promptBond');
const loader = document.querySelector('.loader');
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
// New Buttons
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

// Open Buttons
btnOpen.forEach((element) => {
    element.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (await checkSaved()) {
            let path = await fileDialog.open(client, FILE_DIALOG_OPEN);
            if (path !== null) {
                let contents = await showBusy(client.readFile(path));
                loadEditorContents(contents);
                unchanged = editor.state.doc.length;
                setFilename(path);
                console.log("Current File Changed to: " + currentFilename);
            }
        }
    });
});

// Save As Buttons
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

// Save + Run Buttons
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
    await serialTransmit(CHAR_CTRL_D);
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
        await serialTransmit(CHAR_CTRL_D);
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
    await serialTransmit(CHAR_CTRL_C + "import " + path + CHAR_CRLF);
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
    const files = await showBusy(client.listDir(folder));

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
    let path = await fileDialog.open(client, FILE_DIALOG_SAVE);
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var connected = false;

async function onConnectToBluetoothDevicesButtonClick() {
    if (connected) {
        // Disconnect BlueTooth and Reset things
        if (bleDevice !== undefined && bleDevice.gatt.connected) {
            bleDevice.gatt.disconnect();
        }
        changeMode(MODE_LANDING);
        updateUIConnected(false);
    } else {
        try {
            console.log('Getting existing permitted Bluetooth devices...');
            const devices = await navigator.bluetooth.getDevices();

            console.log('> Got ' + devices.length + ' Bluetooth devices.');
            // These devices may not be powered on or in range, so scan for
            // advertisement packets from them before connecting.
            for (const device of devices) {
                connectToBluetoothDevice(device);
            }
        }
        catch(error) {
            console.log('Argh! ' + error);
        }
    }
}

async function debugLog(msg) {
    terminal.io.print('\x1b[93m');
    terminal.io.print(msg);
    terminal.io.println('\x1b[m');
}

async function onBLESerialReceive(e) {
    // console.log("rcv", e.target.value.buffer);
    terminal.io.print(decoder.decode(e.target.value.buffer, {stream: true}));
}

async function serialTransmit(msg) {
    if (serialDevice && serialDevice.writable) {
        const encoder = new TextEncoder();
        const writer = serialDevice.writable.getWriter();
        await writer.write(encoder.encode(s));
        writer.releaseLock();
    }
    if (rxCharacteristic) {
        let encoder = new TextEncoder();
        let value = encoder.encode(msg);
        try {
            if (value.byteLength < BYTES_PER_WRITE) {
                await rxCharacteristic.writeValueWithoutResponse(value);
                return;
            }
            var offset = 0;
            while (offset < value.byteLength) {
                let len = Math.min(value.byteLength - offset, BYTES_PER_WRITE);
                let chunk_contents = value.slice(offset, offset + len);
                console.log("write subarray", offset, chunk_contents);
                // Delay to ensure the last value was written to the device.
                await sleep(100);
                await rxCharacteristic.writeValueWithoutResponse(chunk_contents);
                offset += len;
            }
        } catch (e) {
            console.log("caught write error", e, e.stack);
        }
    }
}

async function connectToBLESerial() {
    try {
        serialService = await bleServer.getPrimaryService(bleNusServiceUUID);
        // TODO: create a terminal for each serial service
        txCharacteristic = await serialService.getCharacteristic(bleNusCharTXUUID);
        rxCharacteristic = await serialService.getCharacteristic(bleNusCharRXUUID);
    
        txCharacteristic.addEventListener('characteristicvaluechanged', onBLESerialReceive);
        await txCharacteristic.startNotifications();    
    } catch(e) {
        console.log(e, e.stack);
    }
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
        btnBond.disabled = true;
        btnRequestBluetoothDevice.disabled = false;
    }
    connected = isConnected;
}

async function switchToDevice(device) {
    bleDevice = device;
    bleDevice.addEventListener("gattserverdisconnected", onDisconnected);
    bleServer = bleDevice.gatt;
    console.log("connected", bleServer);
    let services;

    try {
        services = await bleServer.getPrimaryServices();
    } catch(e) {
        console.log(e, e.stack);
    }
    console.log(services);

    console.log('Getting Transfer Service...');
    client = new FileTransferClient(bleDevice, 65536);
    debugLog("connected");
    connectToBLESerial();

    btnBond.disabled = false;
    btnConnect.forEach((element) => { element.disabled = true; });
    btnRequestBluetoothDevice.disabled = true;
    await loadEditor();
}

async function onSerialConnected(e) {
    console.log(e, "connected!");
}

async function onSerialDisconnected(e) {
    console.log(e, "disconnected");
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

async function switchToSerial(device) {
    if (serialDevice) {
        await serialDevice.close();
    }
    serialDevice = device;
    device.addEventListener("connect", onSerialConnected);
    device.addEventListener("disconnect", onSerialDisconnected);
    console.log("switch to", device);
    await device.open({baudRate: 115200});
    console.log("opened");
    let reader;
    while (device.readable) {
        reader = device.readable.getReader();
        try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
            // |reader| has been canceled.
            break;
            }
            terminal.io.print(decoder.decode(value));
        }
        } catch (error) {
        // Handle |error|...
        console.log("error", error);
        } finally {
        reader.releaseLock();
        }
    }
}

async function connectToBluetoothDevice(device) {
    const abortController = new AbortController();

    device.addEventListener('advertisementreceived', async (event) => {
        console.log('> Received advertisement from "' + device.name + '"...');
        // Stop watching advertisements to conserve battery life.
        abortController.abort();
        console.log('Connecting to GATT Server from "' + device.name + '"...');
        try {
            await device.gatt.connect()
            console.log('> Bluetooth device "' +  device.name + ' connected.');

            await switchToDevice(device);
        }
        catch(error) {
            console.log('Argh! ' + error);
        }
    }, { once: true });
    debugLog("connecting to " + device.name);
    try {
        console.log('Watching advertisements from "' + device.name + '"...');
        await device.watchAdvertisements({ signal: abortController.signal });
    }
    catch(error) {
        console.log('Argh! ' + error);
    }
}

var unchanged = 0;
async function onBond() {
    try {
        console.log("bond");
        await client.bond();
        console.log("bond done");
    } catch(e) {
        console.log(e, e.stack);
    }
    await loadEditor();
}

async function loadEditor() {
    if (await fileExists("/code.py")) {
        setFilename("/code.py");
        var contents = await showBusy(client.readFile(currentFilename));
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

async function onDisconnected() {
    debugLog("disconnected");
    await bleServer.connect();
    console.log(bleServer.connected);
    debugLog("connected");
    connectToBLESerial();
}

async function onRequestBluetoothDeviceButtonClick(e) {
    try {
        console.log('Requesting any Bluetooth device...');
        debugLog("Requesting device. Cancel if empty and try existing");
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{services: [0xfebb]},], // <- Prefer filters to save energy & show relevant devices.
            // acceptAllDevices: true,,
            optionalServices: [0xfebb, bleNusServiceUUID]
        });

        console.log('> Requested ' + bleDevice.name);
        await bleDevice.gatt.connect();
        await switchToDevice(bleDevice);
    }
    catch(error) {
        console.log('Argh: ' + error);
        debugLog('No device selected. Try to connect to existing.');
    }
}

var editor;
var currentTimeout = null;
async function writeText() {
    console.log("sync starting at", unchanged, "to", editor.state.doc.length);
    if (!client) {
        console.log("no client");
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
        await showBusy(client.writeFile(currentFilename, offset, contents));
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

if (navigator.bluetooth) {
    btnConnect.forEach((element) => {
        element.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();    
            await onConnectToBluetoothDevicesButtonClick();
        });
    });
    btnRequestBluetoothDevice.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();    
        await onRequestBluetoothDeviceButtonClick();
    });
    btnBond.addEventListener('click', async function(e) {
        await onBond();
        e.preventDefault();
        e.stopPropagation();    
    });

    btnBond.disabled = true;

} else {
    console.log("bluetooth not supported on this browser");
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
            serialTransmit(str);
        };

        io.sendString = async (str) => {
            serialTransmit(str);
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
};
