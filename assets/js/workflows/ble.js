/*
 * This class will encapsulate all of the workflow functions specific to BLE
 */

import {FileTransferClient} from 'https://cdn.jsdelivr.net/gh/adafruit/ble-file-transfer-js@1.0.2/adafruit-ble-file-transfer.js';
import {Workflow, CONNTYPE, CONNSTATE} from './workflow.js';
import {GenericModal} from '../common/dialogs.js';
import {sleep, getUrlParam} from '../common/utilities.js';

const bleNusServiceUUID = 'adaf0001-4369-7263-7569-74507974686e';
const bleNusCharRXUUID = 'adaf0002-4369-7263-7569-74507974686e';
const bleNusCharTXUUID = 'adaf0003-4369-7263-7569-74507974686e';

const BYTES_PER_WRITE = 20;

let btnRequestBluetoothDevice, btnBond, btnReconnect;

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
        this.partialWrites = true;
        this.type = CONNTYPE.Ble;
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
        btnBond = modal.querySelector('#promptBond');
        btnReconnect = modal.querySelector('#bleReconnect');

        btnRequestBluetoothDevice.addEventListener('click', async (event) => {
            await this.onRequestBluetoothDeviceButtonClick(event);
        });
        btnBond.addEventListener('click', async (event) =>  {
            await this.onBond(event);
        });
        btnReconnect.addEventListener('click', async (event) =>  {
            await this.reconnectButtonHandler(event);
        });

        if (!(await this.available() instanceof Error)) {
            let stepOne;
            if (stepOne = modal.querySelector('.step:first-of-type')) {
                stepOne.classList.add("hidden");
            }
            const devices = await navigator.bluetooth.getDevices();
            this.connectionStep(devices.length > 0 ? 2 : 1);
        } else {
            this.connectionStep(0);
        }

        return await p;
    }

    async onSerialReceive(e) {;
        // TODO: Make use of super.onSerialReceive() so that title can be extracted
        this.writeToTerminal(this.decoder.decode(e.target.value.buffer, {stream: true}));
    }

    async connectToSerial() {
        try {
            this.serialService = await this.bleServer.getPrimaryService(bleNusServiceUUID);
            // TODO: create a terminal for each serial service (maybe?)
            this.txCharacteristic = await this.serialService.getCharacteristic(bleNusCharTXUUID);
            this.rxCharacteristic = await this.serialService.getCharacteristic(bleNusCharRXUUID);

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

                console.log('> Got ' + devices.length + ' Bluetooth devices.');
                // These devices may not be powered on or in range, so scan for
                // advertisement packets from them before connecting.
                for (const device of devices) {
                    await this.connectToBluetoothDevice(device);
                }
            }
            catch (error) {
                console.log('Argh! ' + error);
            }
        }
    }

    async connectToBluetoothDevice(device) {
        const abortController = new AbortController();

        device.addEventListener('advertisementreceived', async (event) => {
            console.log('> Received advertisement from "' + device.name + '"...');
            // Stop watching advertisements to conserve battery life.
            abortController.abort();
            console.log('Connecting to GATT Server from "' + device.name + '"...');
            try {
                await this.showBusy(device.gatt.connect());
                console.log('> Bluetooth device "' +  device.name + ' connected.');
                await this.switchToDevice(device);
            }
            catch (error) {
                console.log('Argh! ' + error);
            }
        }, {once: true});

        //await this.showBusy(device.gatt.connect());
        await navigator.bluetooth.requestDevice({
            filters: [{services: [0xfebb]},], // <- Prefer filters to save energy & show relevant devices.
            optionalServices: [0xfebb, bleNusServiceUUID]
        });

        this.debugLog("connecting to " + device.name);
        try {
            console.log('Watching advertisements from "' + device.name + '"...');
            await device.watchAdvertisements({signal: abortController.signal});
        }
        catch (error) {
            console.log('Argh! ' + error);
        }
    }

    // Request Bluetooth Device
    async onRequestBluetoothDeviceButtonClick(e) {
        try {
            console.log('Requesting any Bluetooth device...');
            this.debugLog("Requesting device. Cancel if empty and try existing");
            let device = await navigator.bluetooth.requestDevice({
                filters: [{services: [0xfebb]},], // <- Prefer filters to save energy & show relevant devices.
                optionalServices: [0xfebb, bleNusServiceUUID]
            });

            await this.showBusy(device.gatt.connect());
            console.log('> Requested ' + device.name);

            await this.switchToDevice(device);
        }
        catch (error) {
            console.log('Argh: ' + error);
            this.debugLog('No device selected. Try to connect to existing.');
        }
    }

    async switchToDevice(device) {
        console.log(device);
        this.bleDevice = device;
        this.bleDevice.addEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
        this.bleServer = this.bleDevice.gatt;
        console.log("connected", this.bleServer);
        let services;

        try {
            services = await this.bleServer.getPrimaryServices();
        } catch (e) {
            console.log(e, e.stack);
        }
        console.log(services);

        console.log('Initializing File Transfer Client...');
        this.initFileClient(new FileTransferClient(this.bleDevice, 65536));
        this.debugLog("connected");
        await this.connectToSerial();

        // Enable/Disable UI buttons
        this.connectionStep(3);

        await this.onConnected();
        this.connectDialog.close();
        await this.loadEditor();
    }

    // Bond
    async onBond(e) {
        try {
            console.log("bond");
            await this.fileHelper.bond();
            console.log("bond done");
        } catch (e) {
            console.log(e, e.stack);
        }
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
        if (!this.bleDevice) {
            let devices = await navigator.bluetooth.getDevices();
            for (const device of devices) {
                await this.connectToBluetoothDevice(device);
            }
        }

        if (this.bleDevice && !this.bleServer) {
            await await this.showBusy(this.bleDevice.gatt.connect());
            this.switchToDevice(this.bleDevice);
        }
    }

    updateConnected(connectionState) {
        super.updateConnected(connectionState);
        this.connectionStep(2);
    }

    async available() {
        if (!('bluetooth' in navigator)) {
            return Error("Bluetooth not supported on this browser");
        } else if (!(await navigator.bluetooth.getAvailability())) {
            return Error("No bluetooth adapter founnd");
        }

        return true;
    }

    // Handle the different button states for various connection steps
    connectionStep(step) {
        const buttonStates = [
            {reconnect: false, request: false, bond: false},
            {reconnect: false, request: true, bond: false},
            {reconnect: true, request: true, bond: false},
            {reconnect: false, request: false, bond: true},
        ];

        if (step < 0) step = 0;
        if (step > buttonStates.length - 1) step = buttonStates.length - 1;

        btnReconnect.disabled = !buttonStates[step].reconnect;
        btnRequestBluetoothDevice.disabled = !buttonStates[step].request;
        btnBond.disabled = !buttonStates[step].bond;
    }
}

export {BLEWorkflow};