import {Workflow} from './workflow.js';
import {CONNTYPE, CONNSTATE} from '../constants.js';
import {GenericModal} from '../common/dialogs.js';
import {HardwarePanel} from '../common/hardware-panel.js';

/**
 * VirtualFileClient
 * Provides file system access for the virtual workflow
 * Compatible with FileHelper interface for use with FileDialog
 */
class VirtualFileClient {
    constructor(circuitPython) {
        this.circuitPython = circuitPython;
    }

    async readOnly() {
        return false; // Virtual filesystem is always writable
    }

    async readFile(path, raw = false) {
        if (!this.circuitPython || !this.circuitPython.FS) {
            throw new Error("CircuitPython not initialized");
        }

        const pathInfo = await this.circuitPython.FS.analyzePath(path);
        if (!pathInfo.exists) {
            return raw ? null : "";
        }

        const content = await this.circuitPython.FS.readFile(path, { encoding: raw ? undefined : 'utf8' });
        if (raw) {
            // Convert to Blob for compatibility
            return new Blob([content]);
        }
        return content;
    }

    async writeFile(path, offset, contents, modificationTime = Date.now(), raw = false) {
        if (!this.circuitPython) {
            throw new Error("CircuitPython not initialized");
        }

        // For virtual filesystem, we ignore offset and modificationTime
        // Convert contents to appropriate format
        let data = contents;
        if (raw && contents instanceof ArrayBuffer) {
            data = new Uint8Array(contents);
        } else if (raw && contents instanceof Blob) {
            data = new Uint8Array(await contents.arrayBuffer());
        } else if (typeof contents !== 'string') {
            data = new TextDecoder().decode(contents);
        }

        if (this.circuitPython.saveFile) {
            await this.circuitPython.saveFile(path, data);
        } else {
            await this.circuitPython.FS.writeFile(path, data);
        }
        return true;
    }

    async listDir(path) {
        if (!this.circuitPython) {
            throw new Error("CircuitPython not initialized");
        }

        // Remove trailing slash for consistency with worker
        const checkPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;

        // Check if path exists
        const pathInfo = await this.circuitPython.FS.analyzePath(checkPath);
        if (!pathInfo.exists) {
            return [];
        }

        // Use proxied listDir method which calls into the worker
        const results = await this.circuitPython.listDir(checkPath);
        return results;
    }

    async makeDir(path, modificationTime = Date.now()) {
        if (!this.circuitPython) {
            throw new Error("CircuitPython not initialized");
        }

        // Remove trailing slash for mkdir
        const dirPath = path.endsWith('/') ? path.slice(0, -1) : path;

        // Use proxied makeDir method which calls into the worker
        await this.circuitPython.makeDir(dirPath);
        return true;
    }

    async delete(path) {
        if (!this.circuitPython) {
            throw new Error("CircuitPython not initialized");
        }

        const pathInfo = await this.circuitPython.FS.analyzePath(path);
        if (!pathInfo.exists) {
            return false;
        }

        // Use proxied deleteFile method which calls into the worker
        await this.circuitPython.deleteFile(path);
        return true;
    }

    async move(oldPath, newPath) {
        if (!this.circuitPython) {
            throw new Error("CircuitPython not initialized");
        }

        // Use proxied moveFile method which calls into the worker
        await this.circuitPython.moveFile(oldPath, newPath);
        return true;
    }
}

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
        this.blinkaInjected = false;  // Track if we've injected Blinka character into banner
        this.bannerBuffer = '';  // Buffer to accumulate banner text character-by-character
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
            // Use worker-based loader for real-time output during time.sleep()
            // Import directly from worker-proxy to avoid instantiating in main thread
            const { loadCircuitPythonWorker } = await import('../../public/wasm/circuitpython-worker-proxy.js');

            // Load CircuitPython in a Web Worker to prevent blocking the UI thread
            // This enables real-time output during execution (e.g., during time.sleep())
            this.circuitPython = await loadCircuitPythonWorker({
                heapsize: 512 * 1024,  // 512KB - conservative size for browser
                pystack: 8 * 1024,     // 8K words for Python stack (default is 2K, too small for user code)
                stdout: (data) => {
                    // When using worker, data is already decoded to string by worker
                    // (worker does the TextDecoder conversion before posting message)
                    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
                    this.handleModuleOutput(text);
                },
                linebuffer: false, // Character-by-character for proper REPL output timing
                verbose: false,    // Clean output - no infrastructure messages
                filesystem: 'indexeddb'  // Enable persistent filesystem with IndexedDB
            });

            // Note: When using worker, the underlying module runs in a separate thread
            // We can't access _module directly, but the API is proxied
            this.circuitPythonModule = this.circuitPython; // For compatibility checks

            console.log("CircuitPython WASM module loaded successfully in worker");
            
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

            // Initialize file client for file browser support
            const fileClient = new VirtualFileClient(this.circuitPython);
            await this.initFileClient(fileClient);
            console.log("Virtual file client initialized");

            // Initialize hardware panel
            if (!this.virtualHardwarePanel) {
                this.virtualHardwarePanel = new HardwarePanel();
                this.virtualHardwarePanel.init();
                this.virtualHardwarePanel.setCircuitPython(this.circuitPython);
                console.log("Virtual hardware panel initialized");
            }

            // Initialize CircuitPython and start the REPL
            console.log('About to call initializeCircuitPython() after module assignment...');
            this.initializeCircuitPython();

            // Try to load saved code.py from the virtual board if it exists
            try {
                if (await this.fileExists('/home/code.py')) {
                    const savedCode = await this.readFile('/home/code.py');
                    console.log('Found saved code.py on virtual board, loading into editor...');

                    // Use the provided load mechanism which properly updates the editor
                    if (this._loadFileContents) {
                        this._loadFileContents('/home/code.py', savedCode, true);
                        console.log('Loaded code.py into editor');
                    }
                }
            } catch (error) {
                console.log('No saved code.py found or error loading:', error.message);
            }

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
        // Check if we have terminal before processing
        if (!this.terminal) {
            console.error('No terminal available in handleModuleOutput');
            return;
        }

        // Buffer the entire banner line until we see a newline
        if (!this.blinkaInjected) {
            this.bannerBuffer += text;

            // Check if we've received the end of the banner line
            // Look for "Emscripten" followed by a newline (end of banner)
            const hasFullBanner = this.bannerBuffer.includes('Emscripten');
            const hasEndingNewline = /Emscripten[\r\n]/.test(this.bannerBuffer);

            if (hasFullBanner && hasEndingNewline) {
                const blinkaChar = String.fromCharCode(0xE000); // U+E000 Blinka character

                // Trim any leading whitespace from banner
                let bannerTrimmed = this.bannerBuffer.trimStart();

                // Clean up banner: remove git hash and add newline after semicolon
                // Remove git hash pattern: -2-g6f273e72f9-dirty or -2-g6f273e72f9
                bannerTrimmed = bannerTrimmed
                    .replace(/-\d+-g[0-9a-fA-F]+(-dirty)?/g, '')  // Remove git hash
                    .replace(/; /g, ';\r\n');                     // Replace "; " with ";\r\n"

                // Convert any remaining \r to \r\n for xterm
                const bannerConverted = bannerTrimmed.replace(/\r(?!\n)/g, '\r\n');

                // Write complete banner with Blinka DIRECTLY to terminal (bypass REPL)
                this.terminal.write(blinkaChar + ' ' + bannerConverted);

                this.blinkaInjected = true;
                this.bannerBuffer = '';
                return;
            }

            // Still buffering, don't output yet
            return;
        }

        // Normal output processing (after banner)
        // Convert lone \r to \r\n for proper terminal display
        let convertedText = text.replace(/\r(?!\n)/g, '\r\n');

        // Create a message event like other workflows do for serial data
        const messageEvent = {
            data: convertedText
        };

        // Process through the standard REPL system like other workflows
        this.onSerialReceive(messageEvent);
    }

    initializeCircuitPython() {
        console.log('initializeCircuitPython() called, module:', !!this.circuitPython);
        if (!this.circuitPython) {
            console.log('No circuitPython available');
            return;
        }

        try {
            // Note: CircuitPython heap is already initialized by loadCircuitPython()
            // We just need to initialize the REPL system here

            // Initialize REPL system - this should send the welcome message
            console.log('About to call replInit...');
            this.circuitPython.replInit();
            console.log('CircuitPython REPL initialized');

            // Help function is now available via selective feature enabling in WASM build

            // Don't manually add prompt - REPL outputs it automatically

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

        // Reset flags for next connection
        this.blinkaInjected = false;
        this.bannerBuffer = '';

        // Clean up virtual hardware panel
        if (this.virtualHardwarePanel) {
            this.virtualHardwarePanel.destroy();
            this.virtualHardwarePanel = null;
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
        
        // Clear current input line by sending backspaces to REPL
        const charsToDelete = this.currentInputLine.length;

        // Send backspace characters to REPL to clear the line
        for (let i = 0; i < charsToDelete; i++) {
            this.circuitPython.replProcessChar(0x08); // Backspace
        }

        // Get command from history and send it to REPL
        const historyCommand = this.commandHistory[this.historyIndex];
        for (let i = 0; i < historyCommand.length; i++) {
            this.circuitPython.replProcessChar(historyCommand.charCodeAt(i));
        }
        this.currentInputLine = historyCommand;
    }

    async restartDevice() {
        if (this.circuitPython) {
            // Reset CircuitPython REPL - the WASM will output its own banner
            this.handleModuleOutput('\r\n--- Virtual device restart ---\r\n\r\n');
            
            // Reset flags so Blinka appears on the new banner
            this.blinkaInjected = false;
            this.bannerBuffer = '';
            try {
                this.circuitPython.replInit();
            } catch (error) {
                console.error('Error restarting CircuitPython:', error);
                this.handleModuleOutput(`\r\nError: ${error.message}\r\n>>> `);
            }
        }
    }

    async runCurrentCode() {
        if (!this.circuitPython) {
            console.error("Virtual CircuitPython not connected");
            return false;
        }

        await this._showSerial();

        try {
            // Determine the file path to run
            // Use current filename or default to /home/code.py
            const filePath = this.currentFilename || '/home/code.py';

            // Check if file exists in VFS (should be synced from IndexedDB)
            const pathInfo = await this.circuitPython.FS.analyzePath(filePath);
            if (!pathInfo.exists) {
                this.handleModuleOutput(`\r\nError: File not found: ${filePath}\r\n`);
                return false;
            }

            this.handleModuleOutput(`\r\n`);

            // Execute the file from VFS
            // The file should already be saved to IndexedDB and synced to VFS
            await this.circuitPython.runFile(filePath);

            this.handleModuleOutput(`\r\n`);

            return true;
        } catch (error) {
            this.handleModuleOutput(`\r\nError executing code: ${error.message}\r\n`);
            console.error('Run error:', error);
            return false;
        }
    }

    async serialTransmit(data) {
        // Send input data directly to WASM REPL - treat it like sending serial data to a device
        if (!this.circuitPython) {
            console.error('No CircuitPython module available');
            return;
        }

        try {
            // Check if module is still valid
            if (typeof this.circuitPython.replProcessChar !== 'function') {
                console.error('replProcessChar function not available - module may be corrupted');
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
                this.currentInputLine = ''; // Reset for next input

                // Don't clear the terminal - REPL handles all display
                // Don't manually add prompts - handleModuleOutput manages them
            } else if (data === '\x7f' || data === '\b') {
                // Handle backspace - let REPL handle echo and visual feedback
                if (this.currentInputLine.length > 0) {
                    this.currentInputLine = this.currentInputLine.slice(0, -1);
                }
                // Don't manually write to terminal - REPL echoes backspace
            } else {
                // Don't manually echo - CircuitPython's readline handles echoing
                // Just track the input for history
                this.currentInputLine += data;
            }
            
            // Send each character directly to the WASM REPL for processing
            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i);

                try {
                    const result = this.circuitPython.replProcessChar(charCode);
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

    // Virtual file operations - using WASM filesystem with IndexedDB persistence
    async saveFile(path = null) {
        // For virtual workflow, default to /home/code.py if no path specified
        if (path === null) {
            if (this.currentFilename !== null) {
                path = this.currentFilename;
            } else {
                // Default to code.py for virtual board
                path = '/home/code.py';
                this.currentFilename = path;
            }
        }

        // Ensure path starts with / for VFS
        if (!path.startsWith('/')) {
            path = '/' + path;
            this.currentFilename = path;
        }

        // Use the parent's save mechanism which calls this.writeFile()
        // The parent's _saveFileContents already gets editor content properly
        if (this._saveFileContents) {
            await this._saveFileContents(path);
            console.log(`Saved to virtual board: ${path}`);
            return true;
        }

        console.error('No save mechanism available');
        return false;
    }

    async readFile(path) {
        // Read file from virtual board's VFS
        if (!this.circuitPython || !this.circuitPython.FS) {
            throw new Error("Virtual CircuitPython not connected");
        }

        try {
            // Check if file exists first (worker proxy FS methods are async)
            const pathInfo = await this.circuitPython.FS.analyzePath(path);
            if (!pathInfo.exists) {
                throw new Error(`File not found: ${path}`);
            }

            // Read file from VFS (worker proxy FS methods are async)
            const content = await this.circuitPython.FS.readFile(path, { encoding: 'utf8' });
            return content;
        } catch (error) {
            console.error(`Error reading file ${path}:`, error);
            throw error;
        }
    }

    async writeFile(path, contents) {
        // Write file to virtual board's VFS and persist to IndexedDB
        if (!this.circuitPython) {
            throw new Error("Virtual CircuitPython not connected");
        }

        try {
            // Use the WASM's saveFile helper which handles both VFS and IndexedDB
            if (this.circuitPython.saveFile) {
                await this.circuitPython.saveFile(path, contents);
                console.log(`Wrote to virtual board VFS and IndexedDB: ${path}`);
            } else {
                // Fallback: just write to VFS (won't persist across reloads)
                // Worker proxy FS methods are async
                await this.circuitPython.FS.writeFile(path, contents);
                console.log(`Wrote to virtual board VFS (not persisted): ${path}`);
            }
            return true;
        } catch (error) {
            console.error(`Error writing file ${path}:`, error);
            throw error;
        }
    }

    async fileExists(path) {
        // Check if file exists in virtual board's VFS
        if (!this.circuitPython || !this.circuitPython.FS) {
            return false;
        }

        try {
            // Worker proxy FS methods are async
            const pathInfo = await this.circuitPython.FS.analyzePath(path);
            return pathInfo.exists;
        } catch (error) {
            return false;
        }
    }

    async parseParams() {
        // No special URL params needed for virtual workflow
        return true;
    }
}
