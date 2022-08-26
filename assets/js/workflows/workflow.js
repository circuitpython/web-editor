import {sleep, timeout} from '../common/utilities.js';

/*
 * This class will encapsulate all of the common workflow-related functions 
 */

const CONNTYPE = {
    None: 1,
    Ble: 2,
    Usb: 3,
    Web: 4
}

class Workflow {
    constructor() {
        this.terminal = null;
        this.terminalTitle = null;
        this.debugLog = null;
        this.loader = null;
        this.connectionType = CONNTYPE.None;
        this.partialWrites = false;
        this.disconnect = function() {};
        this.timeout = timeout;
        this.sleep = sleep;
    }

    async init(params, loaderId) {
        this.terminal = params.terminal;
        this.debugLog = params.debugLogFunc;
        this.disconnect = params.disconnectFunc;
        this.loadEditor = params.loadEditorFunc;
        this.loader = document.getElementById(loaderId);
        if ("terminalTitle" in params) {
            this.terminalTitle = params.terminalTitle;
        }
    }

    async deinit() {

    }

    async showBusy(functionPromise) {
        if (this.loader) {
            this.loader.classList.add("busy");
        }
        let result = await functionPromise;
        if (this.loader) {
            this.loader.classList.remove("busy");
        }
        return result;
    }

    async parseParams(urlParams) {
        // Connection specific params check
        return false;
    }

    writeToTerminal(data) {
        this.terminal.write(data);
    }

    // This function should run callback and if it takes longer than ms, retun
    timeout(callback, ms) {
        return new Promise(
            resolve => {
                setTimeout(
                    () => {
                        console.log("timeout func fail")
                        resolve();
                    }
                , ms)
                callback();
                console.log("timeout func success")
                resolve();
            }
        );
    }
}

export {Workflow, CONNTYPE};