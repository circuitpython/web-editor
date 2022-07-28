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
        this.debugLog = null;
        this.connectionType = CONNTYPE.None;
        this.disconnect = function() {};
    }

    async init(params) {
        this.terminal = params.terminal;
        this.debugLog = params.debugLogFunc;
        this.disconnect = params.disconnectFunc;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export {Workflow, CONNTYPE};