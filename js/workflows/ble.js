/*
 * This class will encapsulate all of the workflow functions specific to BLE
 */

import {FileTransferClient} from '../common/ble-file-transfer.js';
import {CONNTYPE, CONNSTATE} from '../constants.js';
import {Workflow} from './workflow.js';
import {GenericModal, DeviceInfoModal} from '../common/dialogs.js';
import {sleep} from '../common/utilities.js';

const bleNusServiceUUID = 'adaf0001-4369-7263-7569-74507974686e';
const bleNusCharRXUUID = 'adaf0002-4369-7263-7569-74507974686e';
const bleNusCharTXUUID = 'adaf0003-4369-7263-7569-74507974686e';

const BYTES_PER_WRITE = 20;

// Tunables for silent auto-reconnect after firmware autoreload.
// CircuitPython's BLE file transfer triggers an autoreload after every
// mutating op (write/move/delete/mkdir), which tears down the GATT
// Silent reconnect after firmware autoreload. See #377.
const RECONNECT_DELAYS_MS = [1500, 2500, 4000];
const POST_OP_RECONNECT_WINDOW_MS = 8000;
// How long to wait for the post-op disconnect to fire (~2s observed).
const POST_OP_DISCONNECT_GRACE_MS = 4000;
// Wait after GATT reconnects so the VM finishes booting before the next op.
const POST_RECONNECT_SETTLE_MS = 2000;

let btnRequestBluetoothDevice, btnReconnect;

class BLEWorkflow extends Workflow {
    constructor() {
        super();
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        this.serialService = null;
        this.bleServer = null;
        this.bleDevice = null;
        this.decoder = new TextDecoder();
        this.connectDialog = new GenericModal("ble-connect");
        this.infoDialog = new DeviceInfoModal("device-info");
        this.partialWrites = true;
        this.type = CONNTYPE.Ble;
        this.buttonStates = [
            {reconnect: false, request: false},
            {reconnect: false, request: true},
            {reconnect: true, request: true},
        ];
        // Mutating-op disconnects within this window trigger silent reconnect.
        this._lastMutatingOpAt = 0;
        this._silentReconnectInFlight = false;
        this._silentReconnectPromise = null;

        // Cached bound handlers so add/remove use the same reference.
        // Without this, .bind() returns a fresh function every call and
        // removeEventListener becomes a no-op, leaking listeners on every
        // connect/reconnect cycle. See #410.
        this._onRequestBluetoothDeviceClick = this.onRequestBluetoothDeviceButtonClick.bind(this);
        this._onReconnectClick = this.reconnectButtonHandler.bind(this);
        this._onSerialReceiveBound = this.onSerialReceive.bind(this);
        this._onDisconnectedBound = this.onDisconnected.bind(this);

        // Track in-flight watchAdvertisements abort controllers so we can
        // cancel them when any device wins or when we tear down (#410).
        this._pendingAdvAborts = new Set();
    }

    // Called by the FileTransferClient wrapper right before any mutating
    // BLE-FT op (write/move/delete/mkdir). Marks the moment so that the
    // disconnect handler can recognize the next disconnect as an expected
    // autoreload and recover silently.
    markMutatingOp() {
        this._lastMutatingOpAt = Date.now();
    }

    _wasMutatingOpRecent() {
        return (Date.now() - this._lastMutatingOpAt) < POST_OP_RECONNECT_WINDOW_MS;
    }

    // Awaited by mutating-op wrappers so callers see a live GATT before proceeding.
    async awaitPostOpReconnect() {
        const startedAt = Date.now();
        while (Date.now() - startedAt < POST_OP_DISCONNECT_GRACE_MS) {
            // gatt.connected flips false before gattserverdisconnected fires.
            if (this.bleDevice && this.bleDevice.gatt && !this.bleDevice.gatt.connected) {
                const waitForPromise = Date.now();
                while (!this._silentReconnectPromise && Date.now() - waitForPromise < POST_OP_DISCONNECT_GRACE_MS) {
                    await sleep(25);
                }
                break;
            }
            if (this._silentReconnectPromise) {
                break;
            }
            await sleep(25);
        }
        if (this._silentReconnectPromise) {
            try {
                await this._silentReconnectPromise;
            } catch (e) {
                console.log('awaitPostOpReconnect: silent reconnect rejected:', e);
            }
        }
    }

    // This is called when a user clicks the main disconnect button
    async disconnectButtonHandler(e) {
        await super.disconnectButtonHandler(e);
        if (this.connectionStatus()) {
            if (this.bleDevice !== undefined && this.bleDevice.gatt.connected) {
                // gatt.disconnect() fires gattserverdisconnected which calls
                // onDisconnected via our listener — don't call onDisconnected
                // again here or we double-log and double-fire UI updates.
                // See #410.
                this.bleDevice.gatt.disconnect();
            } else {
                // Already torn down at the GATT layer; run our cleanup directly.
                await this.onDisconnected(e, false);
            }
        }
    }

    async onDisconnected(e, reconnect = true) {
        // Detach the gattserverdisconnected listener so a stale device handle
        // can't fire onDisconnected later (the cause of the duplicate log
        // accumulation in #410).
        if (this.bleDevice) {
            this.bleDevice.removeEventListener('gattserverdisconnected', this._onDisconnectedBound);
        }
        if (this.txCharacteristic) {
            this.txCharacteristic.removeEventListener('characteristicvaluechanged', this._onSerialReceiveBound);
        }
        // Cancel any in-flight watchAdvertisements so a subsequent reconnect
        // doesn't pile up Chrome's per-device watch quota (#410).
        for (const ctrl of this._pendingAdvAborts) {
            ctrl.abort();
        }
        this._pendingAdvAborts.clear();
        await super.onDisconnected(e, reconnect);
    }

    async showConnect(documentState) {
        let p = this.connectDialog.open();
        let modal = this.connectDialog.getModal();
        this._wireBackToChooser(modal);
        btnRequestBluetoothDevice = modal.querySelector('#requestBluetoothDevice');
        btnReconnect = modal.querySelector('#bleReconnect');

        // Map the button states to the buttons
        this.connectButtons = {
            reconnect: btnReconnect,
            request: btnRequestBluetoothDevice
        };

        btnRequestBluetoothDevice.removeEventListener('click', this._onRequestBluetoothDeviceClick);
        btnRequestBluetoothDevice.addEventListener('click', this._onRequestBluetoothDeviceClick);
        btnReconnect.removeEventListener('click', this._onReconnectClick);
        btnReconnect.addEventListener('click', this._onReconnectClick);

        // Check if Web Bluetooth is available
        if (!(await this.available() instanceof Error)) {
            let stepOne;
            if (stepOne = modal.querySelector('.step:first-of-type')) {
                stepOne.classList.add("hidden");
            }
            try {
                this.clearConnectStatus();
                const devices = await navigator.bluetooth.getDevices();
                this.connectionStep(devices.length > 0 ? 2 : 1);
            } catch (error) {
                console.error(error);
                this.showConnectStatus(this._suggestBLEConnectActions(error));
            }
        } else {
            modal.querySelectorAll('.step:not(:first-of-type)').forEach((stepItem) => {
                stepItem.classList.add("hidden");
            });
            this.connectionStep(0);
        }

        return await p;
    }

    async onSerialReceive(e) {;
        // TODO: Make use of super.onSerialReceive() so that title can be extracted
        let output = this.decoder.decode(e.target.value.buffer, {stream: true});
        console.log(output);
        this.writeToTerminal(output);
    }

    async connectToSerial() {
        try {
            this.serialService = await this.bleServer.getPrimaryService(bleNusServiceUUID);
            // TODO: create a terminal for each serial service (maybe?)
            this.txCharacteristic = await this.serialService.getCharacteristic(bleNusCharTXUUID);
            this.rxCharacteristic = await this.serialService.getCharacteristic(bleNusCharRXUUID);

            // Use cached bound handler so removeEventListener actually matches.
            this.txCharacteristic.removeEventListener('characteristicvaluechanged', this._onSerialReceiveBound);
            this.txCharacteristic.addEventListener('characteristicvaluechanged', this._onSerialReceiveBound);
            await this.txCharacteristic.startNotifications();
            return true;
        } catch (e) {
            console.log(e, e.stack);
            return e;
        }
    }

    // Reconnect
    async reconnectButtonHandler(e) {
        if (!this.connectionStatus()) {
            try {
                console.log('Getting existing permitted Bluetooth devices...');
                const devices = await navigator.bluetooth.getDevices();

                console.log('> Found ' + devices.length + ' Bluetooth device(s).');
                // These devices may not be powered on or in range, so scan for
                // advertisement packets from them before connecting.
                for (const device of devices) {
                    await this.connectToBluetoothDevice(device);
                }
            }
            catch (error) {
                console.error(error);
                this.showConnectStatus(this._suggestBLEConnectActions(error));
            }
        }
    }

    // Bring up a dialog to request a device
    async requestDevice() {
        return navigator.bluetooth.requestDevice({
            filters: [{services: [0xfebb]},], // <- Prefer filters to save energy & show relevant devices.
            optionalServices: [0xfebb, bleNusServiceUUID]
        });
    }

    async connectToBluetoothDevice(device) {
        const abortController = new AbortController();
        this._pendingAdvAborts.add(abortController);
        let advHandled = false;

        async function onAdvertisementReceived(event) {
            // Multiple ads can land in the same event-loop tick before
            // abortController.abort() takes effect on the listener. Guard
            // so we only run the connect flow once per device. See #410.
            if (advHandled) {
                return;
            }
            advHandled = true;
            console.log('> Received advertisement from "' + device.name + '"...');
            // This device won. Abort ALL pending watchAdvertisements
            // (including this one) so other paired devices stop scanning
            // and don't pile up Chrome's per-device watch quota.
            for (const ctrl of this._pendingAdvAborts) {
                ctrl.abort();
            }
            this._pendingAdvAborts.clear();
            console.log('Connecting to GATT Server from "' + device.name + '"...');
            try {
                this.bleServer = await device.gatt.connect();
            } catch (error) {
                console.log(error);
                // TODO(ericzundel): Add to suggestBLEConnectAction if we can determine the exception type
                this.showConnectStatus("Failed to connect to device. Try forgetting device from OS bluetooth devices and try again.");
                // Disable the reconnect button
                this.connectionStep(1);
            }
            if (this.bleServer && this.bleServer.connected) {
                console.log('> Bluetooth device "' +  device.name + ' connected.');
                await this.switchToDevice(device);
            } else {
                console.log('Unable to connect to bluetooth device "' +  device.name + '.');
            }
        }

        // Use the abortController signal so we don't need to manage the
        // handler reference manually — the listener is auto-removed when
        // onAdvertisementReceived calls abortController.abort().
        device.addEventListener('advertisementreceived',
            onAdvertisementReceived.bind(this),
            {signal: abortController.signal});

        this.debugLog("Attempting to connect to " + device.name + "...");
        try {
            this.clearConnectStatus();
            console.log('Watching advertisements from "' + device.name + '"...');
            console.log('If no advertisements are received, make sure the device is powered on and in range. You can also try resetting the device.');
            await device.watchAdvertisements({signal: abortController.signal});
        }
        catch (error) {
            console.error(error);
            this.showConnectStatus(this._suggestBLEConnectActions(error));
        }
    }

    // Request Bluetooth Device
    async onRequestBluetoothDeviceButtonClick(e) {
        console.log('Requesting any Bluetooth device...');
        this.debugLog("Requesting device. Cancel if empty and try existing");
        let device = await this.requestDevice();

        console.log('> Requested ' + device.name);
        await this.connectToBluetoothDevice(device);
    }

    async onConnected(e) {
        this.debugLog("Connected to " + this.bleDevice.name);
        await super.onConnected(e);
    }

    async switchToDevice(device) {
        this.bleDevice = device;
        this.bleDevice.removeEventListener("gattserverdisconnected", this._onDisconnectedBound);
        this.bleDevice.addEventListener("gattserverdisconnected", this._onDisconnectedBound);
        console.log("connected", this.bleServer);

        try {
            let services;
            services = await this.bleServer.getPrimaryServices();
            console.log(services);
        } catch (e) {
            console.log(e, e.stack);
        }

        console.log('Initializing File Transfer Client...');
        this.initFileClient(new FileTransferClient(this.bleDevice, 65536, this));
        await this.fileHelper.bond();
        await this.connectToSerial();

        await this.onConnected();
        this.connectDialog.close();
        await this.loadEditor();
    }

    async serialTransmit(msg) {
        if (this.rxCharacteristic) {
            let encoder = new TextEncoder();
            let value = encoder.encode(msg);
            try {
                if (value.byteLength < BYTES_PER_WRITE) {
                    await this.rxCharacteristic.writeValueWithoutResponse(value);
                    return;
                }
                var offset = 0;
                while (offset < value.byteLength) {
                    let len = Math.min(value.byteLength - offset, BYTES_PER_WRITE);
                    let chunk_contents = value.slice(offset, offset + len);
                    console.log("write subarray", offset, chunk_contents);
                    // Delay to ensure the last value was written to the device.
                    await sleep(100);
                    await this.rxCharacteristic.writeValueWithoutResponse(chunk_contents);
                    offset += len;
                }
            } catch (e) {
                console.log("caught write error", e, e.stack);
            }
        }
    }

    async connect() {
        const result = await super.connect();
        if (result instanceof Error) {
            return result;
        }

        // Disconnect right after a mutating op = firmware autoreload. Reconnect silently.
        if (this.bleDevice && this._wasMutatingOpRecent()) {
            this._silentReconnectPromise = this._attemptSilentReconnect();
            let ok = false;
            try {
                ok = await this._silentReconnectPromise;
            } finally {
                this._silentReconnectPromise = null;
            }
            if (ok) {
                return;
            }
            // Silent reconnect failed; fall through to normal reconnect.
        }

        // Is this a new connection?
        if (!this.bleDevice) {
            try {
                let devices = await navigator.bluetooth.getDevices();
                for (const device of devices) {
                    await this.connectToBluetoothDevice(device);
                }
            } catch (error) {
                console.error(error);
                this.showConnectStatus(this._suggestBLEConnectActions(error));
            }
        }
    }

    // Reconnect to the same paired device after firmware autoreload.
    // Reuses the existing FileTransferClient so FileDialog bindings stay live;
    // upstream checkConnection() re-fetches characteristics on next op.
    async _attemptSilentReconnect() {
        if (this._silentReconnectInFlight) {
            return false;
        }
        this._silentReconnectInFlight = true;
        try {
            for (const delay of RECONNECT_DELAYS_MS) {
                await sleep(delay);
                try {
                    console.log(`Silent reconnect: attempting after ${delay}ms…`);
                    this.bleServer = await this.bleDevice.gatt.connect();
                    if (this.bleServer && this.bleServer.connected) {
                        console.log('Silent reconnect: GATT reconnected, rebinding characteristics…');
                        await this._rebindAfterSilentReconnect();
                        console.log('Silent reconnect succeeded.');
                        return true;
                    }
                } catch (error) {
                    console.log(`Silent reconnect attempt failed: ${error}. Retrying…`);
                }
            }
            console.log('Silent reconnect exhausted; falling back to manual reconnect UI.');
            return false;
        } finally {
            this._silentReconnectInFlight = false;
        }
    }

    // Rebind characteristics after silent reconnect without rebuilding fileHelper.
    async _rebindAfterSilentReconnect() {
        // Re-attach disconnect listener (idempotent thanks to cached bound ref).
        this.bleDevice.removeEventListener('gattserverdisconnected', this._onDisconnectedBound);
        this.bleDevice.addEventListener('gattserverdisconnected', this._onDisconnectedBound);

        // NUS serial chars need re-fetch; BLE-FT chars re-fetched lazily by checkConnection().
        await this.connectToSerial();

        this.updateConnected(CONNSTATE.connected);
    }

    updateConnected(connectionState) {
        super.updateConnected(connectionState);
        if (this.connectDialog && this.connectDialog.isOpen()) {
            this.connectionStep(2);
        }
    }

    async available() {
        if (!('bluetooth' in navigator)) {
            return Error("Web Bluetooth is not enabled in this browser");
        } else if (!(await navigator.bluetooth.getAvailability())) {
            return Error("No bluetooth adapter found");
        }
        return true;
    }

    async showInfo(documentState) {
        return await this.infoDialog.open(this, documentState);
    }

    // Analyze an exception and make user friendly suggestions
     _suggestBLEConnectActions(error) {
        if (error.name == "TypeError" &&
            (error.message.includes("getDevices is not a function")
            || error.message.includes("watchAdvertisements is not a function"))) {
            return "Bluetooth API not available. Make sure you are loading from a secure context (HTTPS), then go to chrome://flags/#enable-web-bluetooth-new-permissions-backend to enable.";
        }
        return `Connect via Bluetooth returned error: ${error}`;
    }
}

export {BLEWorkflow};
