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
// connection. We wait briefly, then reconnect to the same already-paired
// device without a user gesture. See circuitpython/web-editor#377.
const RECONNECT_DELAYS_MS = [1500, 2500, 4000];
const POST_OP_RECONNECT_WINDOW_MS = 8000;
// How long awaitPostOpReconnect() waits for the disconnect to fire after
// a mutating op completes. Observed up to ~2s on CLUE / nRF52840 between
// MOVE_STATUS=OK arriving over BLE and the firmware's VM reset actually
// tearing down the GATT server. If no disconnect happens by then, assume
// the firmware didn't autoreload (e.g. some future CP version) and proceed.
const POST_OP_DISCONNECT_GRACE_MS = 4000;
// After GATT reconnects post-autoreload, the firmware VM is still
// booting. boot.py runs, code.py may start, BLE service finishes
// initializing, and the CIRCUITPY filesystem mount/lock settles. If we
// let the next mutating op fire too early, the firmware returns
// STATUS_ERROR_READONLY because filesystem_lock() can't be acquired
// during this window. Empirically ~1.5s is enough on CLUE / nRF52840;
// budget 2s for slower boards.
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
        // Tracks when we last issued a mutating BLE-FT op. If we lose the
        // GATT connection within POST_OP_RECONNECT_WINDOW_MS after one of
        // those, treat it as an expected firmware autoreload and silently
        // reconnect. See circuitpython/web-editor#377.
        this._lastMutatingOpAt = 0;
        this._silentReconnectInFlight = false;
        // Resolved by _attemptSilentReconnect; awaited by
        // awaitPostOpReconnect() so callers can block on the reconnect
        // before issuing follow-up BLE-FT calls (e.g. listDir to refresh
        // the file dialog).
        this._silentReconnectPromise = null;
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

    // Called by the FileTransferClient wrapper after a mutating op's
    // upstream call resolves. Waits long enough for the disconnect to
    // fire (it usually arrives ~10-100ms after MOVE_STATUS), then for
    // the silent reconnect to complete, so any follow-up BLE-FT call
    // (e.g. listDir for file-dialog refresh) sees a live GATT.
    //
    // If no disconnect fires within POST_OP_DISCONNECT_GRACE_MS, assume
    // the firmware did NOT autoreload and return immediately. This keeps
    // the wrapper safe against future firmware that fixes the autoreload
    // behavior on its own.
    async awaitPostOpReconnect() {
        const startedAt = Date.now();
        while (Date.now() - startedAt < POST_OP_DISCONNECT_GRACE_MS) {
            // bleDevice.gatt.connected flips false BEFORE the
            // gattserverdisconnected event fires on the next tick. Catch
            // that earlier so we never let the caller continue on a dead
            // GATT while we wait for the event-loop hop.
            if (this.bleDevice && this.bleDevice.gatt && !this.bleDevice.gatt.connected) {
                // Wait up to grace window for the connect() flow to
                // wire up _silentReconnectPromise.
                const waitForPromise = Date.now();
                while (!this._silentReconnectPromise && Date.now() - waitForPromise < POST_OP_DISCONNECT_GRACE_MS) {
                    await sleep(25);
                }
                break;
            }
            if (this._silentReconnectPromise) {
                break;
            }
            // gattserverdisconnected hasn't fired yet. Yield briefly.
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
            // Disconnect BlueTooth and Reset things
            if (this.bleDevice !== undefined && this.bleDevice.gatt.connected) {
                this.bleDevice.gatt.disconnect();
            }
            await this.onDisconnected(e, false);
        }
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

        btnRequestBluetoothDevice.addEventListener('click', this.onRequestBluetoothDeviceButtonClick.bind(this));
        btnReconnect.addEventListener('click', this.reconnectButtonHandler.bind(this));

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

            // Remove any existing event listeners to prevent multiple reads
            this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.onSerialReceive.bind(this));
            this.txCharacteristic.addEventListener('characteristicvaluechanged', this.onSerialReceive.bind(this));
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

        async function onAdvertisementReceived(event) {
            console.log('> Received advertisement from "' + device.name + '"...');
            // Stop watching advertisements to conserve battery life.
            abortController.abort();
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

        device.removeEventListener('advertisementreceived', onAdvertisementReceived.bind(this));
        device.addEventListener('advertisementreceived', onAdvertisementReceived.bind(this));

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
        this.bleDevice.removeEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
        this.bleDevice.addEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
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
        // Note: parentheses fix an operator-precedence bug from the original
        // code, where `instanceof` bound tighter than `=`, leaving `result`
        // as a boolean rather than the actual super.connect() return value.
        const result = await super.connect();
        if (result instanceof Error) {
            return result;
        }

        // Unexpected disconnect right after a mutating BLE-FT op: this is
        // almost certainly the firmware autoreload. Reconnect silently to
        // the same device handle without prompting the user.
        if (this.bleDevice && this._wasMutatingOpRecent()) {
            // Expose the in-flight reconnect to awaitPostOpReconnect so
            // mutating-op promises chain correctly through the reload.
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
            // Fell through: silent reconnect failed. Fall back to the
            // normal reconnect-to-permitted-devices path below.
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

    // Try to reconnect to the same already-paired device, after a brief
    // delay to let the firmware finish its autoreload. We skip the
    // watchAdvertisements dance because CircuitPython starts advertising
    // immediately on boot and we already have a permitted device handle.
    //
    // Unlike switchToDevice(), this path REUSES the existing
    // FileTransferClient / FileHelper so that callers holding bound
    // references (e.g. FileDialog grabbed fileHelper.move at open time)
    // keep working. The upstream FileTransferClient.checkConnection()
    // method re-fetches its characteristics on the next op when its
    // internal _transfer is null (which onDisconnected sets it to).
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

    // Re-establish characteristic references AFTER a silent reconnect,
    // without rebuilding fileHelper / FileTransferClient. Caller has
    // already confirmed this.bleServer.connected is true.
    async _rebindAfterSilentReconnect() {
        // Re-attach the disconnect listener (some browsers detach it on
        // GATT teardown, others don't — idempotent re-add is safe).
        this.bleDevice.removeEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
        this.bleDevice.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

        // Re-fetch the NUS serial characteristics. The BLE file-transfer
        // client's characteristics get re-fetched lazily by its own
        // checkConnection() on next op, so we don't touch fileHelper.
        await this.connectToSerial();

        // Mark the workflow as connected so the UI clears any
        // "disconnected" flicker without closing the active dialog.
        this.updateConnected(CONNSTATE.connected);
    }

    updateConnected(connectionState) {
        super.updateConnected(connectionState);
        this.connectionStep(2);
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
