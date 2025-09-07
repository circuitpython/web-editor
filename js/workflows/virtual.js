import {Workflow} from './workflow.js';
import {CONNTYPE, CONNSTATE} from '../constants.js';
import {GenericModal} from '../common/dialogs.js';
import {CircuitPythonWASM} from '../circuitpython-wasm-worker.js';

/**
 * Virtual CircuitPython Workflow
 * Provides a virtual CircuitPython environment with hardware simulation
 */
export class VirtualWorkflow extends Workflow {
    constructor() {
        super();
        this.type = CONNTYPE.Virtual;
        this.connectDialog = new GenericModal("virtual-connect");
        this.circuitPython = null;
        this.virtualHardwarePanel = null;
    }

    async init(params) {
        await super.init(params);
        this.setTerminalTitle("Virtual CircuitPython REPL");
    }

    async available() {
        // Virtual workflow is always available
        return true;
    }

    async connect() {
        console.log("Connecting to Virtual CircuitPython WASM...");
        
        try {
            // Create real CircuitPython WASM instance
            this.circuitPython = new CircuitPythonWASM();
            
            // Initialize with terminal output callback
            await this.circuitPython.initialize((text) => {
                // Write directly to terminal without adding extra newlines
                this.writeToTerminal(text);
            });
            
            this.updateConnected(CONNSTATE.connected);
            
            console.log("Virtual CircuitPython WASM connected successfully");
            return true;
            
        } catch (error) {
            console.error("Failed to connect to Virtual CircuitPython WASM:", error);
            this.updateConnected(CONNSTATE.disconnected);
            return new Error("Failed to connect to Virtual CircuitPython: " + error.message);
        }
    }

    async disconnectButtonHandler(e) {
        console.log("Disconnecting from Virtual CircuitPython...");
        
        if (this.circuitPython) {
            // Clean up virtual hardware
            if (this.circuitPython.reset) {
                await this.circuitPython.reset();
            }
            this.circuitPython = null;
        }
        
        // Hide virtual hardware panel
        if (this.virtualHardwarePanel) {
            this.virtualHardwarePanel.classList.add('hidden');
        }
        
        this.updateConnected(CONNSTATE.disconnected);
        await super.disconnectButtonHandler(e);
    }

    async restartDevice() {
        if (this.circuitPython) {
            // Reset virtual hardware - the WASM will output its own banner
            this.writeToTerminal('\r\n--- Virtual device restart ---\r\n');
            if (this.circuitPython.reset) {
                this.circuitPython.reset();
            }
        }
    }

    async runCurrentCode() {
        if (!this.circuitPython) {
            console.error("Virtual CircuitPython not connected");
            return false;
        }

        let path = this.currentFilename;
        if (!path) {
            console.log("File has not been saved");
            return false;
        }

        let extension = path.split('.').pop();
        if (String(extension).toLowerCase() !== "py") {
            console.log("Extension not .py, it was ." + String(extension).toLowerCase());
            return false;
        }

        await this._showSerial();

        // Get the current file content from the editor
        const editorContent = document.querySelector('.cm-content').textContent || '';
        
        try {
            this.writeToTerminal(`\r\n>>> # Running ${path}\r\n`);
            // Execute code directly in the WASM REPL
            this.circuitPython.executeCode(editorContent);
            return true;
        } catch (error) {
            this.writeToTerminal(`Error executing code: ${error.message}\r\n`);
            return false;
        }
    }

    serialTransmit(data) {
        // Send input to the real CircuitPython REPL
        if (this.circuitPython && this.circuitPython.initialized) {
            // Process each character in the input
            for (let i = 0; i < data.length; i++) {
                this.circuitPython.processChar(data[i]);
            }
        }
    }

    async showConnect(documentState) {
        let p = this.connectDialog.open();
        let modal = this.connectDialog.getModal();
        
        // Handle the connect button click
        const connectButton = modal.querySelector('#connectVirtualDevice');
        if (connectButton) {
            connectButton.onclick = async () => {
                // Close the dialog first
                this.connectDialog.close();
                
                // Connect to virtual hardware
                const result = await this.connect();
                if (result === true) {
                    // Successfully connected, switch to serial view
                    this._showSerial();
                } else if (result instanceof Error) {
                    console.error("Failed to connect to virtual hardware:", result.message);
                }
            };
        }
        
        return p;
    }

    async showInfo(documentState) {
        // Show virtual device info
        const info = {
            board: "Virtual CircuitPython Board",
            version: "9.1.4",
            builddate: new Date().toISOString().split('T')[0],
            mcuname: "Virtual Hardware Simulator",
            boardid: "virtual_circuitpython",
            uid: "virtual-" + Math.random().toString(36).substr(2, 9)
        };

        // Update the device info modal with virtual info
        const modal = document.querySelector('[data-popup-modal="device-info"]');
        if (modal) {
            modal.querySelector('#board').textContent = info.board;
            modal.querySelector('#version').textContent = info.version;
            modal.querySelector('#builddate').textContent = info.builddate;
            modal.querySelector('#mcuname').textContent = info.mcuname;
            modal.querySelector('#boardid').textContent = info.boardid;
            modal.querySelector('#uid').textContent = info.uid;
            
            // Show the modal
            modal.classList.add('open');
        }
    }

    // Virtual file operations - simulate file system
    async saveFile(path = null) {
        // For virtual workflow, we just save to browser storage or handle normally
        return await super.saveFile(path);
    }

    async readFile(path) {
        // Virtual file system would be implemented here
        // For now, delegate to parent
        throw new Error("Virtual file system not yet implemented");
    }

    async writeFile(path, contents, offset = 0) {
        // Virtual file system would be implemented here
        // For now, just log the operation
        console.log(`Virtual file write: ${path}`);
        return true;
    }

    async fileExists(path) {
        // Virtual file system check
        return false; // For now, assume files don't exist in virtual FS
    }

    async parseParams() {
        // No special URL params needed for virtual workflow
        return true;
    }
}