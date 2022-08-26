/*
 * This class will encapsulate all of the workflow functions specific to BLE 
 */

import {FileTransferClient} from 'https://cdn.jsdelivr.net/gh/adafruit/ble-file-transfer-js@1.0.1/adafruit-ble-file-transfer.js';
import {Workflow, CONNTYPE} from './workflow.js'
import {GenericModal} from '../common/dialogs.js';

const bleNusServiceUUID  = 'adaf0001-4369-7263-7569-74507974686e';
const bleNusCharRXUUID   = 'adaf0002-4369-7263-7569-74507974686e';
const bleNusCharTXUUID   = 'adaf0003-4369-7263-7569-74507974686e';

const BYTES_PER_WRITE = 20;
const btnRequestBluetoothDevice = document.querySelector('#requestBluetoothDevice');
const btnBond = document.querySelector('#promptBond');
const btnReconnect = document.querySelector('#bleReconnect');

class BLEWorkflow extends Workflow {
    constructor() {
        super();
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        this.serialService = null;
        this.bleServer = null;
        this.bleDevice = null;
        this.decoder = new TextDecoder();
        this.loadEditor = null;
        this.fileClient = null;
        this.connectDialog = new GenericModal("ble-connect");
        this.partialWrites = true;
        this.type = CONNTYPE.Ble;
    }

    async init(params) {
        await super.init(params, "ble-loader");
        this.loadEditor = params.loadEditorFunc;
        if (navigator.bluetooth) {
            btnRequestBluetoothDevice.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();    
                await this.onRequestBluetoothDeviceButtonClick();
            }.bind(this));
            btnBond.addEventListener('click', async function(e) {
                await this.onBond();
                e.preventDefault();
                e.stopPropagation();    
            }.bind(this));
            btnReconnect.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                await this.reconnectButtonHandler(e);
            }.bind(this));
            btnBond.disabled = true;
        } else {
            console.log("bluetooth not supported on this browser");
        }
    }

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
            catch(error) {
                console.log('Argh! ' + error);
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

    async onSerialReceive(e) {
        // console.log("rcv", e.target.value.buffer);
        this.writeToTerminal(this.decoder.decode(e.target.value.buffer, {stream: true}));
    }

    async connectToSerial() {
        try {
            this.serialService = await this.bleServer.getPrimaryService(bleNusServiceUUID);
            // TODO: create a terminal for each serial service
            this.txCharacteristic = await this.serialService.getCharacteristic(bleNusCharTXUUID);
            this.rxCharacteristic = await this.serialService.getCharacteristic(bleNusCharRXUUID);
        
            this.txCharacteristic.addEventListener('characteristicvaluechanged', this.onSerialReceive.bind(this));
            await this.txCharacteristic.startNotifications();    
        } catch(e) {
            console.log(e, e.stack);
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
                await device.gatt.connect()
                console.log('> Bluetooth device "' +  device.name + ' connected.');
    
                await this.switchToDevice(device);
            }
            catch(error) {
                console.log('Argh! ' + error);
            }
        }, { once: true });
        this.debugLog("connecting to " + device.name);
        try {
            console.log('Watching advertisements from "' + device.name + '"...');
            await device.watchAdvertisements({ signal: abortController.signal });
        }
        catch(error) {
            console.log('Argh! ' + error);
        }
    }

    async getDeviceFileContents(filename) {
        return await this.fileClient.readFile(filename);
    }

    async switchToDevice(device) {
        this.bleDevice = device;
        this.bleDevice.addEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
        this.bleServer = this.bleDevice.gatt;
        console.log("connected", this.bleServer);
        let services;
    
        try {
            services = await this.bleServer.getPrimaryServices();
        } catch(e) {
            console.log(e, e.stack);
        }
        console.log(services);
    
        console.log('Initializing File Transfer Client...');
        this.fileClient = new FileTransferClient(this.bleDevice, 65536);
        this.debugLog("connected");
        await this.connectToSerial();
    
        // Enable/Disable UI buttons
        btnBond.disabled = false;
        btnRequestBluetoothDevice.disabled = true;
        btnReconnect.disabled = true;

        await this.onConnected();
        this.connectDialog.close();
        await this.loadEditor();
    }

    async onBond() {
        try {
            console.log("bond");
            await this.fileClient.bond();
            console.log("bond done");
        } catch(e) {
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
                    await workflow.sleep(100);
                    await this.rxCharacteristic.writeValueWithoutResponse(chunk_contents);
                    offset += len;
                }
            } catch (e) {
                console.log("caught write error", e, e.stack);
            }
        }
    }

    async onRequestBluetoothDeviceButtonClick(e) {
        try {
            console.log('Requesting any Bluetooth device...');
            this.debugLog("Requesting device. Cancel if empty and try existing");
            this.bleDevice = await navigator.bluetooth.requestDevice({
                filters: [{services: [0xfebb]},], // <- Prefer filters to save energy & show relevant devices.
                // acceptAllDevices: true,,
                optionalServices: [0xfebb, bleNusServiceUUID]
            });
    
            console.log('> Requested ' + this.bleDevice.name);
            await this.bleDevice.gatt.connect();
            await this.switchToDevice(this.bleDevice);
        }
        catch(error) {
            console.log('Argh: ' + error);
            this.debugLog('No device selected. Try to connect to existing.');
        }
    }

    async connect() {
        await super.connect();
        await this.bleServer.connect();
        console.log(this.bleServer.connected);
        return await this.connectToSerial();
    }

    updateConnected(isConnected) {
        super.updateConnected(isConnected);
        this._connected = true;
        if (!isConnected) {
            btnBond.disabled = true;
            btnRequestBluetoothDevice.disabled = false;
            btnReconnect.disabled = false;
        }
    }

    async parseParams(urlParams) {
        return false;
    }
}

export {BLEWorkflow};