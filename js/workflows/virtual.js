import {Workflow} from './workflow.js';
import {CONNTYPE, CONNSTATE} from '../constants.js';
import {GenericModal} from '../common/dialogs.js';

/**
 * Virtual CircuitPython Workflow
 * Provides a virtual CircuitPython environment with hardware simulation
 */
export class VirtualWorkflow extends Workflow {
    constructor() {
        super();
        this.type = CONNTYPE.Virtual;
        this.connectDialog = new GenericModal("virtual-connect");
        this.circuitPythonModule = null;
        this.virtualHardwarePanel = null;
        this.currentInputLine = '';  // Track current input line for echo management
        this.waitingForPrompt = false;  // Track if we're waiting to show a prompt
        this.commandHistory = [];  // Store command history for arrow key navigation
        this.historyIndex = -1;  // Current position in history (-1 = not browsing)
        this.escapeSequence = '';  // Buffer for escape sequences (arrow keys)
    }

    async init(params) {
        await super.init(params);
        this.setTerminalTitle("Virtual CircuitPython REPL");
        
        // Add global error handler for WASM issues to prevent page resets
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && (event.reason.toString().includes('WASM') || 
                event.reason.toString().includes('CircuitPython') ||
                event.reason.toString().includes('table index'))) {
                console.error('Unhandled CircuitPython WASM error:', event.reason);
                console.warn('Preventing page reset due to WASM error');
                event.preventDefault(); // Prevent default page reset behavior
            }
        });
        
        // Load CircuitPython WASM module during initialization
        console.log("Loading CircuitPython WASM module...");
        try {
            const { default: _createCircuitPythonModule } = await import('../../lib/circuitpython-wasm/circuitpython.mjs');

            // Create the WASM module with proper callbacks
            this.circuitPythonModule = await _createCircuitPythonModule({
                locateFile: (path, prefix) => {
                    // Ensure WASM file is loaded from the correct path
                    if (path.endsWith('.wasm')) {
                        return '../lib/circuitpython-wasm/' + path;
                    }
                    return prefix + path;
                },

                // Handle stdout - both from EM_ASM and write() calls
                print: (text) => {
                    console.log('CircuitPython stdout:', JSON.stringify(text));
                    // Don't add extra newlines, CircuitPython handles them
                    this.handleModuleOutput(text);
                },

                printErr: (text) => {
                    console.log('CircuitPython stderr:', JSON.stringify(text));
                    this.handleModuleOutput(`\x1b[31m${text}\x1b[0m`); // Red for errors
                },

                // Runtime initialization complete
                onRuntimeInitialized: () => {
                    console.log('CircuitPython WASM runtime initialized');
                    
                    // Skip FS setup for now as it's causing issues in browser
                    // The print/printErr callbacks above should handle all output
                    console.log('Skipping FS setup, using print callbacks only');
                }
            });

            // No longer using EM_ASM output callbacks - using standard POSIX write(1)
            // Output will come through the print() callback above

            console.log("CircuitPython WASM module loaded successfully");
            
        } catch (error) {
            console.error("Failed to load CircuitPython WASM module:", error);
            throw error;
        }
    }

    async available() {
        // Virtual workflow is always available
        return true;
    }

    async connect() {
        console.log("Connecting to Virtual CircuitPython WASM...");

        try {
            // Module should already be loaded in init()
            if (!this.circuitPythonModule) {
                return new Error("CircuitPython WASM module not loaded. Did init() complete successfully?");
            }

            // Initialize CircuitPython and start the REPL
            console.log('About to call initializeCircuitPython() after module assignment...');
            this.initializeCircuitPython();

            this.updateConnected(CONNSTATE.connected);
            console.log("CircuitPython WASM connected successfully");
            return true;

        } catch (error) {
            console.error("Failed to connect to CircuitPython WASM:", error);
            this.updateConnected(CONNSTATE.disconnected);
            return new Error("Failed to connect to CircuitPython: " + error.message);
        }
    }


    handleModuleOutput(text) {
        // Convert lone \r to \r\n for proper terminal display
        // CircuitPython outputs \r but xterm.js needs \r\n to advance lines
        let convertedText = text.replace(/\r(?!\n)/g, '\r\n');
        
        // Create a message event like other workflows do for serial data
        const messageEvent = {
            data: convertedText
        };
        
        // Check if we have terminal before processing
        if (!this.terminal) {
            console.error('No terminal available in handleModuleOutput');
            return;
        }
        
        // Process through the standard REPL system like other workflows
        this.onSerialReceive(messageEvent);
        
        // Detect when to show a new prompt
        // The REPL outputs in this pattern:
        // - Command echo: ">>> command\r"
        // - Result (if any): "result\r"
        // - Then nothing more until next input
        
        if (text.startsWith('>>> ')) {
            // This is a command echo
            this.waitingForPrompt = true;
            
            // Check if this is just ">>> \r" (empty command)
            if (text === '>>> \r') {
                // Empty command, show prompt immediately
                this.waitingForPrompt = false;
                setTimeout(() => {
                    this.terminal.write('>>> ');
                }, 10);
            }
        } else if (this.waitingForPrompt && text.endsWith('\r')) {
            // This is the result after a command, show prompt after it
            this.waitingForPrompt = false;
            setTimeout(() => {
                this.terminal.write('>>> ');
            }, 10);
        }
    }

    initializeCircuitPython() {
        console.log('initializeCircuitPython() called, module:', !!this.circuitPythonModule);
        if (!this.circuitPythonModule) {
            console.log('No circuitPythonModule available');
            return;
        }

        try {
            console.log('Available WASM functions:', Object.keys(this.circuitPythonModule).filter(k => k.startsWith('_mp') || k.startsWith('_hal')));
            
            // Initialize CircuitPython with conservative heap to avoid OOM issues
            const heapSize = 512 * 1024; // 512KB - very conservative size
            console.log('About to call _mp_js_init_with_heap...');
            try {
                this.circuitPythonModule._mp_js_init_with_heap(heapSize);
            } catch (initError) {
                console.error('Failed to initialize WASM heap:', initError);
                throw new Error(`WASM initialization failed: ${initError.message}`);
            }
            console.log(`CircuitPython initialized with ${heapSize} byte heap`);

            // Initialize REPL system - this should send the welcome message
            console.log('About to call _mp_js_repl_init...');
            this.circuitPythonModule._mp_js_repl_init();
            console.log('CircuitPython REPL initialized');
            
            // Help function is now available via selective feature enabling in WASM build
            
            // Display the initial prompt since the REPL doesn't output it until first input
            // Wait a tiny bit for the banner to be displayed first
            setTimeout(() => {
                this.terminal.write('>>> ');
            }, 150);

        } catch (error) {
            console.error('Error initializing CircuitPython:', error);
            this.handleModuleOutput(`\r\nError: Failed to initialize CircuitPython\r\n${error.message}\r\n`);
        }
    }

    async disconnectButtonHandler(e) {
        console.log("Disconnecting from Virtual CircuitPython...");

        if (this.circuitPythonModule) {
            // Clean up WASM module
            this.circuitPythonModule = null;
        }

        // Hide virtual hardware panel
        if (this.virtualHardwarePanel) {
            this.virtualHardwarePanel.classList.add('hidden');
        }

        this.updateConnected(CONNSTATE.disconnected);
        await super.disconnectButtonHandler(e);
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) {
            return; // No history available
        }
        
        // Calculate new history index
        if (this.historyIndex === -1) {
            // Starting to navigate history
            this.historyIndex = direction < 0 ? this.commandHistory.length - 1 : 0;
        } else {
            // Continue navigating
            this.historyIndex += direction;
            
            // Clamp to valid range
            if (this.historyIndex < 0) {
                this.historyIndex = 0;
            } else if (this.historyIndex >= this.commandHistory.length) {
                this.historyIndex = this.commandHistory.length - 1;
            }
        }
        
        // Clear current input line and replace with history command
        const charsToDelete = this.currentInputLine.length;
        
        // Delete current input
        for (let i = 0; i < charsToDelete; i++) {
            this.terminal.write('\b \b');
        }
        
        // Get command from history and display it
        const historyCommand = this.commandHistory[this.historyIndex];
        this.terminal.write(historyCommand);
        this.currentInputLine = historyCommand;
    }

    async restartDevice() {
        if (this.circuitPythonModule) {
            // Reset CircuitPython REPL - the WASM will output its own banner
            this.handleModuleOutput('\r\n--- Virtual device restart ---\r\n');
            try {
                this.circuitPythonModule._mp_js_repl_init();
            } catch (error) {
                console.error('Error restarting CircuitPython:', error);
                this.handleModuleOutput(`\r\nError: ${error.message}\r\n>>> `);
            }
        }
    }

    async runCurrentCode() {
        if (!this.circuitPythonModule) {
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
            this.handleModuleOutput(`\r\n>>> # Running ${path}\r\n`);
            // Execute code by sending it through the REPL character by character
            for (let i = 0; i < editorContent.length; i++) {
                const charCode = editorContent.charCodeAt(i);
                this.circuitPythonModule._mp_js_repl_process_char(charCode);
            }
            // Send enter to execute
            this.circuitPythonModule._mp_js_repl_process_char(10); // \n
            return true;
        } catch (error) {
            this.handleModuleOutput(`Error executing code: ${error.message}\r\n`);
            return false;
        }
    }

    async serialTransmit(data) {
        // Send input data directly to WASM REPL - treat it like sending serial data to a device
        if (!this.circuitPythonModule) {
            console.error('No CircuitPython module available');
            return;
        }
        
        try {
            // Check if module is still valid
            if (typeof this.circuitPythonModule._mp_js_repl_process_char !== 'function') {
                console.error('_mp_js_repl_process_char function not available - module may be corrupted');
                this.handleModuleOutput('\r\nError: WASM module corrupted, please reconnect\r\n');
                return;
            }
            
            // Echo the input immediately to the terminal for better UX
            // The REPL won't echo until Enter is pressed, so we do it here
            // Handle escape sequences (arrow keys)
            if (data === '\x1b') {
                // Start of escape sequence
                this.escapeSequence = '\x1b';
                return; // Don't process further until sequence is complete
            } else if (this.escapeSequence) {
                // Continue building escape sequence
                this.escapeSequence += data;
                
                // Check for complete arrow key sequences
                if (this.escapeSequence === '\x1b[A') {
                    // Up arrow - previous command in history
                    this.navigateHistory(-1);
                    this.escapeSequence = '';
                    return;
                } else if (this.escapeSequence === '\x1b[B') {
                    // Down arrow - next command in history
                    this.navigateHistory(1);
                    this.escapeSequence = '';
                    return;
                } else if (this.escapeSequence.length > 3) {
                    // Unknown escape sequence, clear it
                    this.escapeSequence = '';
                }
                
                // If sequence is not complete, wait for more characters
                if (this.escapeSequence.length < 3) {
                    return;
                }
            }
            
            // Handle special characters appropriately
            if (data === '\r' || data === '\n') {
                // Save command to history if it's not empty
                if (this.currentInputLine.trim()) {
                    this.commandHistory.push(this.currentInputLine.trim());
                    // Limit history to last 50 commands
                    if (this.commandHistory.length > 50) {
                        this.commandHistory.shift();
                    }
                }
                this.historyIndex = -1; // Reset history navigation
                
                // When Enter is pressed, clear the entire line (prompt + input)
                // We've displayed: ">>> " (4 chars) + user's input
                const charsToDelete = 4 + this.currentInputLine.length;
                
                // Clear the line using backspace-space-backspace pattern
                for (let i = 0; i < charsToDelete; i++) {
                    this.terminal.write('\b \b');
                }
                
                this.currentInputLine = '';
                
                // For commands that don't produce output (like x = 5),
                // we need to ensure a prompt appears after the command echo
                // Set a timeout to display prompt if we're still waiting
                setTimeout(() => {
                    if (this.waitingForPrompt) {
                        // No output received after command echo, show prompt
                        this.waitingForPrompt = false;
                        this.terminal.write('>>> ');
                    }
                }, 50);
            } else if (data === '\x7f' || data === '\b') {
                // Handle backspace - move cursor back and clear character
                if (this.currentInputLine.length > 0) {
                    this.terminal.write('\b \b');
                    this.currentInputLine = this.currentInputLine.slice(0, -1);
                }
            } else {
                // Echo normal characters immediately
                this.terminal.write(data);
                this.currentInputLine += data;
            }
            
            // Send each character directly to the WASM REPL for processing
            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i);
                
                try {
                    const result = this.circuitPythonModule._mp_js_repl_process_char(charCode);
                } catch (wasmError) {
                    console.error('WASM function call failed:', wasmError);
                    this.handleModuleOutput(`\r\nError: WASM execution failed: ${wasmError.message}\r\n>>> `);
                    // Don't continue processing more characters if one fails
                    break;
                }
            }
        } catch (error) {
            console.error('Error sending input to virtual CircuitPython device:', error);
            this.handleModuleOutput(`\r\nError: ${error.message}\r\n>>> `);
            
            // If there's a persistent error, disconnect to prevent further issues
            console.warn('Persistent error detected, disconnecting...');
            this.updateConnected(CONNSTATE.disconnected);
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
            version: "10.0.0-beta.2",
            builddate: new Date().toISOString().split('T')[0],
            mcuname: "WASM",
            boardid: "virtual_circuitpython",
            uid: "virtual-" + Math.random().toString(36).substring(2, 11)
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
