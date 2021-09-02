import {FileTransferClient} from '@adafruit/ble-file-transfer';
const bleNusServiceUUID  = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharRXUUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharTXUUID   = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

var bleDevice;
var serialDevice;
var bleServer;
var serialService;
var rxCharacteristic;
var txCharacteristic;
var client;
var terminal;
var decoder = new TextDecoder();
var dirty = false;
var filename = null;

const BYTES_PER_WRITE = 20;

let connect = document.querySelector('#connectToBluetoothDevices');
let request = document.querySelector('#requestBluetoothDevice');
let bond = document.querySelector('#promptBond');
let request_serial = document.querySelector('#requestSerialDevice');

const btnModeEditor = document.getElementById('btn-mode-editor');
const btnModeSerial = document.getElementById('btn-mode-serial');
const mainContent = document.getElementById('main-content');
//const btnNew = document.getElementById('btn-new');
//const btnOpen = document.getElementById('btn-open');
//const btnSaveAs = document.getElementById('btn-save-as');
const btnSaveRun = document.getElementById('btn-save-run');

const MODE_EDITOR = 1;
const MODE_SERIAL = 2;
const MODE_LANDING = 3;

/*
btnNew.addEventListener('click', function(e) {
    if (dirty) {
        if (window.confirm("Current changes will be lost. Click OK to continue.")) {
            saveFile();
        } else {
            return;
        }
    }
    editor.state.doc = '';
    dirty = false;
    filename = null;
    e.preventDefault();
    e.stopPropagation();
});
btnOpen.addEventListener('click', function(e) {
    if (!client) {
        console.log("no client");
        return;
    }
    console.log(client);
    let results = client.listDir("/");
    console.log(results);
    e.preventDefault();
    e.stopPropagation();
});
btnSaveAs.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
});
*/
btnSaveRun.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
});
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

function saveFile() {
    if (filename === null) {
        // Prompt for filename

        filename = "whatever_was_chosen";
    }
    // Check if file exists
    // If so prompt for overwrite

    // Use the client to write the file
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
    serialService = await bleServer.getPrimaryService(bleNusServiceUUID);
    // TODO: create a terminal for each serial service
    txCharacteristic = await serialService.getCharacteristic(bleNusCharTXUUID);
    rxCharacteristic = await serialService.getCharacteristic(bleNusCharRXUUID);

    txCharacteristic.addEventListener('characteristicvaluechanged', onBLESerialReceive);
    await txCharacteristic.startNotifications();
}

class IntegratedFileTransferClient extends FileTransferClient {
    async onDisconnected() {
        super.onDisconnected();
        // We need to be in landing Screen Mode
        changeMode(MODE_LANDING);
        updateUIConnected(false);
    }
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
    client = new IntegratedFileTransferClient(bleDevice);
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

var unchanged = 0;
async function onBond() {
    console.log("bond");
    await client.bond();
    var contents = await client.readFile("/code.py");
    editor.setState(EditorState.create({
        doc: contents,
        extensions: [
        basicSetup,
        python(),
        editorTheme,
        EditorView.updateListener.of(onTextChange)]
    }));
    unchanged = editor.state.doc.length;
    console.log("doc length", unchanged);
    updateUIConnected(true);
    changeMode(MODE_EDITOR);
    console.log("bond done");
}

async function onDisconnected() {
    debugLog("disconnected");
    await bleServer.connect();
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
        await client.writeFile("/code.py", offset, contents);
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
    currentTimeout = setTimeout(writeText, 750);
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
