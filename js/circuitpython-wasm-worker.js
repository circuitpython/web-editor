/**
 * CircuitPython WebAssembly Worker
 * Runs the actual CircuitPython WASM module and handles REPL I/O
 */

class CircuitPythonWASM {
    constructor() {
        this.module = null;
        this.initialized = false;
        this.outputCallback = null;
        this.inputBuffer = [];
    }
    
    async initialize(outputCallback) {
        if (this.initialized) return;
        
        this.outputCallback = outputCallback || console.log;
        
        try {
            // Load the actual CircuitPython WASM module
            const CircuitPython = await import('../lib/circuitpython-wasm/circuitpython.mjs');
            
            // Initialize with proper callbacks for terminal I/O
            this.module = await CircuitPython.default({
                // Handle stdout character by character
                stdout: (charCode) => {
                    const char = String.fromCharCode(charCode);
                    
                    // Just output everything normally - let the terminal handle display
                    if (this.outputCallback) {
                        this.outputCallback(char);
                    }
                },
                // Handle stderr
                stderr: (charCode) => {
                    const char = String.fromCharCode(charCode);
                    if (this.outputCallback) {
                        this.outputCallback(char);
                    }
                },
                // Handle print for compatibility
                print: (text) => {
                    if (this.outputCallback) {
                        this.outputCallback(text + '\n');
                    }
                },
                printErr: (text) => {
                    if (this.outputCallback) {
                        this.outputCallback(text + '\n');
                    }
                }
            });
            
            // Initialize CircuitPython with 8MB heap
            this.module._mp_js_init_with_heap(8 * 1024 * 1024);
            
            // Initialize proxy system
            if (this.module._proxy_c_init) {
                this.module._proxy_c_init();
            }
            
            // Initialize REPL
            this.module._mp_js_repl_init();
            
            this.initialized = true;
            console.log('CircuitPython WASM initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize CircuitPython WASM:', error);
            throw error;
        }
    }
    
    /**
     * Process a character input to the REPL
     */
    processChar(char) {
        if (!this.initialized || !this.module) {
            console.error('CircuitPython not initialized');
            return;
        }
        
        const charCode = char.charCodeAt(0);
        
        try {
            // Send character to REPL
            if (this.module._mp_js_repl_process_char) {
                this.module._mp_js_repl_process_char(charCode);
            } else {
                console.error('REPL process_char function not found');
            }
        } catch (error) {
            console.error('Error processing character:', error);
        }
    }
    
    /**
     * Process a complete line of input
     */
    processInput(input) {
        if (!this.initialized) return;
        
        // Process each character
        for (let i = 0; i < input.length; i++) {
            this.processChar(input[i]);
        }
        // Send Enter key
        this.processChar('\r');
    }
    
    /**
     * Execute Python code directly
     */
    executeCode(code) {
        if (!this.initialized || !this.module) {
            console.error('CircuitPython not initialized');
            return;
        }
        
        try {
            if (this.module._mp_js_exec) {
                const result = this.module._mp_js_exec(code);
                return result;
            } else {
                // Fall back to processing as REPL input
                this.processInput(code);
            }
        } catch (error) {
            console.error('Error executing code:', error);
            if (this.outputCallback) {
                this.outputCallback(`Error: ${error.message}\n`);
            }
        }
    }
    
    /**
     * Reset the interpreter
     */
    reset() {
        if (!this.initialized || !this.module) return;
        
        try {
            // Send Ctrl+D to soft reset
            this.processChar('\x04');
        } catch (error) {
            console.error('Error resetting:', error);
        }
    }
}

// Export for use in virtual workflow
export { CircuitPythonWASM };