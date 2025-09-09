/*
 * This class will encapsulate all of the workflow functions specific to BLE
 */

import {FileTransferClient} from '../common/ble-file-transfer.js';
import {CONNTYPE} from '../constants.js';
import {Workflow} from './workflow.js';
import {GenericModal, DeviceInfoModal} from '../common/dialogs.js';
import {sleep} from '../common/utilities.js';
import {bluetooth} from 'webbluetooth';

const bleNusServiceUUID = 'adaf0001-4369-7263-7569-74507974686e';
const bleNusCharRXUUID = 'adaf0002-4369-7263-7569-74507974686e';
const bleNusCharTXUUID = 'adaf0003-4369-7263-7569-74507974686e';

const BYTES_PER_WRITE = 20;

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
                const devices = await bluetooth.getDevices();
                console.log(devices);
                this.connectionStep(devices.length > 0 ? 2 : 1);
            } catch (e) {
                console.log("New Permissions backend for Web Bluetooth not enabled. Go to chrome://flags/#enable-web-bluetooth-new-permissions-backend to enable.", e);
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
                const devices = await bluetooth.getDevices();

                console.log('> Found ' + devices.length + ' Bluetooth device(s).');
                // These devices may not be powered on or in range, so scan for
                // advertisement packets from them before connecting.
                for (const device of devices) {
                    await this.connectToBluetoothDevice(device);
                }
            }
            catch (error) {
                console.error(error);
                await this._showMessage(error);
            }
        }
    }

    // Bring up a dialog to request a device
    async requestDevice() {
        return bluetooth.requestDevice({
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
                await this._showMessage("Failed to connect to device. Try forgetting device from OS bluetooth devices and try again.");
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

        this.debugLog("connecting to " + device.name);
        try {
            console.log('Watching advertisements from "' + device.name + '"...');
            console.log('If no advertisements are received, make sure the device is powered on and in range. You can also try resetting the device.');
            await device.watchAdvertisements({signal: abortController.signal});
        }
        catch (error) {
            console.error(error);
            await this._showMessage(error);
        }
    }

    // Request Bluetooth Device
    async onRequestBluetoothDeviceButtonClick(e) {
        //try {
            console.log('Requesting any Bluetooth device...');
            this.debugLog("Requesting device. Cancel if empty and try existing");
            let device = await this.requestDevice();

            console.log('> Requested ' + device.name);
            await this.connectToBluetoothDevice(device);
        /*}
        catch (error) {
            console.error(error);
            await this._showMessage(error);
            this.debugLog('No device selected. Try to connect to existing.');
        }*/
    }

    async switchToDevice(device) {
        console.log(device);
        this.bleDevice = device;
        this.bleDevice.removeEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
        this.bleDevice.addEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
        //this.bleServer = this.bleDevice.gatt;
        console.log("connected", this.bleServer);
        let services;

        console.log(device.gatt.connected);
        //try {
            services = await this.bleServer.getPrimaryServices();
        /*} catch (e) {
            console.log(e, e.stack);
        }*/
        console.log(services);

        console.log('Initializing File Transfer Client...');
        this.initFileClient(new FileTransferClient(this.bleDevice, 65536));
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
        let result;
        if (result = await super.connect() instanceof Error) {
            return result;
        }
        // Is this a new connection?
        if (!this.bleDevice) {
            let devices = await bluetooth.getDevices();
            for (const device of devices) {
                await this.connectToBluetoothDevice(device);
            }
        }
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
}

export {BLEWorkflow};
