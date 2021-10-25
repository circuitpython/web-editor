import {FileTransferClient} from '@adafruit/ble-file-transfer';
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

let connect = document.querySelector('#connectToBluetoothDevices');
let request = document.querySelector('#requestBluetoothDevice');
let bond = document.querySelector('#promptBond');
let request_serial = document.querySelector('#requestSerialDevice');

const btnModeEditor = document.getElementById('btn-mode-editor');
const btnModeSerial = document.getElementById('btn-mode-serial');
const mainContent = document.getElementById('main-content');
const btnNew = document.getElementById('btn-new');
const btnOpen = document.getElementById('btn-open');
const btnSaveAs = document.getElementById('btn-save-as');
const btnSaveRun = document.getElementById('btn-save-run');

const MODE_EDITOR = 1;
const MODE_SERIAL = 2;
const MODE_LANDING = 3;
const fileDialog = new FileDialog("files", ".body-blackout");

const editorTheme = EditorView.theme({
    "&": {
      color: "#ddd",
      backgroundColor: "#333",
      lineHeight: 1.5,
      fontFamily: "'Operator Mono', 'Source Code Pro', Menlo, Monaco, Consolas, Courier New, monospace",
      height: "calc(100vh - 215px)",
    },
    ".cm-activeLine": {
        backgroundColor: "#333",
    },
    ".cm-content": {
        caretColor: "orange"
    },
    ".cm-comment": {
        fontStyle: "italic",
        color: "#676B79"
    },
    ".cm-operator": {
        color: "#f3f3f3"
    },
    ".cm-string": {
        color: "#19F9D8"
    },
    ".cm-string-2": {
        color: "#FFB86C"
    },
    ".cm-tag": {
        color: "#ff2c6d"
    },
    ".cm-meta": {
        color: "#b084eb"
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "orange"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "orange"
    },
    ".cm-gutters": {
        backgroundColor: "#292a2b",
        color: "#ddd",
        border: "none"
    },
    ".cm-scroller": {
        overflow: "auto"
    }
}, {dark: true})

const editorExtensions = [
    basicSetup,
    python(),
    editorTheme,
    EditorView.updateListener.of(onTextChange)
]
// New Button
btnNew.addEventListener('click', async function(e) {
    if (await checkSaved()) {
        loadEditorContents("");
        unchanged = editor.state.doc.length;
        currentFilename = null;  
        console.log("Current File Changed to: " + currentFilename);  
    }
    e.preventDefault();
    e.stopPropagation();    
});

// Open Button
btnOpen.addEventListener('click', async function(e) {
    if (await checkSaved()) {
        let path = await fileDialog.open(client, FILE_DIALOG_OPEN);
        if (path !== null) {
            let contents = await client.readFile(path);
            loadEditorContents(contents);
            unchanged = editor.state.doc.length;
            currentFilename = path;
            console.log("Current File Changed to: " + currentFilename);
        }
    }
    e.preventDefault();
    e.stopPropagation();    
});

// Save As Button
btnSaveAs.addEventListener('click', async function(e) {
    let path = await saveAs();
    if (path !== null) {
        currentFilename = path;
        console.log("Current File Changed to: " + currentFilename);
    }
    e.preventDefault();
    e.stopPropagation();    
});

// Save + Run Button
btnSaveRun.addEventListener('click', async function(e) {
    await saveFile();
    e.preventDefault();
    e.stopPropagation();    
});

// Mode Buttons
btnModeEditor.addEventListener('click', function(e) {
    changeMode(MODE_EDITOR);
    e.preventDefault();
    e.stopPropagation();
});

btnModeSerial.addEventListener('click', function(e) {
    changeMode(MODE_SERIAL);
    e.preventDefault();
    e.stopPropagation();
});

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

async function checkSaved() {
    if (isDirty()) {
        if (window.confirm("Current changes will be lost. Click OK to continue.")) {
            if (await saveFile()) {
                return true;
            }
        }
        return false;
    }
    return true;
}

async function saveFile(filename) {
    const previousFile = currentFilename;
    if (filename !== undefined) {
        // All good, continue
    } else if (currentFilename !== null) {
        filename = currentFilename;
    } else {
        filename = saveAs();
    }
    if (filename !== null) {
        if (filename !== previousFile) {
            // This is a different file, so we write everything
            unchanged = 0;
        }
        currentFilename = filename;
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
    const files = await client.listDir(folder);

    // See if the file is in the list of files
    for (let fileObj of files) {
        if (fileObj.path[0] == ".") continue;
        if (fileObj.path == filename) {
            return true;
        }
    }
    return false;
}

// Currently it disconnects while saving over an existing file. We may have to delete the file first.

async function saveAs() {
    let path = await fileDialog.open(client, FILE_DIALOG_SAVE);
    if (path !== null) {
        // check if filename exists
        if (await fileExists(path)) {
            if (window.confirm("Overwrite existing file '" + path + "'?")) {
                await client.delete(path);
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
        //returnToLanding();
    }
}

function returnToLanding() {
    // We need to be in landing Screen Mode
    updateUIConnected(false);
    changeMode(MODE_LANDING);
}

function updateUIConnected(isConnected) {
    if (isConnected) {
        connect.innerHTML = "Disconnect";
        connect.disabled = false;
    } else {
        connect.innerHTML = "Connect";
        bond.disabled = true;
        connect.disabled = false;
        request.disabled = false;
    }
    connected = isConnected;
}

async function switchToDevice(device) {
    bleDevice = device;
    bleDevice.addEventListener("gattserverdisconnected", onDisconnected);
    bleServer = bleDevice.gatt;
    console.log("connected", bleServer);

    const services = await bleServer.getPrimaryServices();
    console.log(services);

    console.log('Getting Transfer Service...');
    client = new FileTransferClient(bleDevice);
    debugLog("connected");
    connectToBLESerial();

    bond.disabled = false;
    connect.disabled = true;
    request.disabled = true;
}

async function onSerialConnected(e) {
    console.log(e, "connected!");
}

async function onSerialDisconnected(e) {
    console.log(e, "disconnected");
}

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
        if (await fileExists("/code.py")) {
            currentFilename = "/code.py";
            var contents = await client.readFile(currentFilename);
        } else {
            contents = "";
        }
        loadEditorContents(contents);
        unchanged = editor.state.doc.length;
        console.log("doc length", unchanged);
        updateUIConnected(true);
        changeMode(MODE_EDITOR);
        console.log("bond done");
    } catch(e) {
        console.log(e, e.stack);
    }
}

async function onDisconnected() {
    debugLog("disconnected");
    updateUIConnected(false);
    await bleServer.connect();
    updateUIConnected(true);
    debugLog("connected");
    connectToBLESerial();
}

async function onRequestBluetoothDeviceButtonClick() {
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
        switchToDevice(bleDevice);
    }
    catch(error) {
        console.log('Argh! ' + error);
        debugLog('No device selected. Try to connect to existing.');
    }
}

async function onRequestSerialDeviceButtonClick() {
    let devices = await navigator.serial.getPorts()
    if (devices.length == 1) {
        let device = devices[0];
        switchToSerial(device);
        return;
    }
    try {
        console.log('Requesting any serial device...');
        let device = await navigator.serial.requestPort();

        console.log('> Requested ');
        console.log(device);
        switchToSerial(device);
        return;
    }
    catch(error) {
        console.log('Argh! ');
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
        await client.writeFile(currentFilename, offset, contents);
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
    connect.addEventListener('click', function(e) {
        onConnectToBluetoothDevicesButtonClick();
        e.preventDefault();
        e.stopPropagation();    
    });
    request.addEventListener('click', function(e) {
        onRequestBluetoothDeviceButtonClick();
        e.preventDefault();
        e.stopPropagation();    
    });
    bond.addEventListener('click', function(e) {
        onBond();
        e.preventDefault();
        e.stopPropagation();    
    });

    bond.disabled = true;

} else {
    console.log("bluetooth not supported on this browser");
}

/*if (navigator.serial) {
    request_serial.addEventListener('click', function() {
        onRequestSerialDeviceButtonClick();
    });
} else {
    request_serial.disabled = true;
}*/

import {EditorState, EditorView, basicSetup} from "@codemirror/basic-setup"
import {python} from "@codemirror/lang-python"

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
