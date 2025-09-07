/**
 * CircuitPython WebAssembly Bridge
 * Modern JavaScript interface for CircuitPython WASM with proper async support
 */

export class CircuitPythonBridge {
    constructor() {
        this.module = null;
        this.initialized = false;
        this.outputBuffer = [];
        this.errorBuffer = [];
        
        // SharedArrayBuffer for efficient communication (if available)
        if (typeof SharedArrayBuffer !== 'undefined') {
            this.sharedMemory = new SharedArrayBuffer(1024 * 1024);
            this.inputBuffer = new Uint8Array(this.sharedMemory, 0, 4096);
            this.outputSharedBuffer = new Uint8Array(this.sharedMemory, 4096, 4096);
        }
    }
    
    /**
     * Initialize CircuitPython WebAssembly module
     */
    async init(options = {}) {
        const defaultOptions = {
            heapSize: 8 * 1024 * 1024,  // 8MB heap
            stackSize: 256 * 1024,        // 256KB stack
            print: (text) => {
                this.outputBuffer.push(text);
                if (options.onOutput) {
                    options.onOutput(text);
                }
            },
            printErr: (text) => {
                this.errorBuffer.push(text);
                if (options.onError) {
                    options.onError(text);
                }
            }
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        
        // Import the CircuitPython module
        const CircuitPython = await import('./circuitpython.mjs');
        this.module = await CircuitPython.default(mergedOptions);
        
        // Initialize the interpreter
        this.module._mp_js_init_with_heap(mergedOptions.heapSize);
        
        // Initialize proxy system safely
        if (this.module._proxy_c_init_safe) {
            this.module._proxy_c_init_safe();
        } else {
            this.module._proxy_c_init();
        }
        
        // Initialize REPL
        this.module._mp_js_repl_init();
        
        this.initialized = true;
        return this;
    }
    
    /**
     * Execute Python code asynchronously
     */
    async execute(code) {
        if (!this.initialized) {
            throw new Error('CircuitPython not initialized. Call init() first.');
        }
        
        return new Promise((resolve, reject) => {
            try {
                // Use the simple _mp_js_exec that works with our current build
                if (this.module._mp_js_exec) {
                    const result = this.module._mp_js_exec(code);
                    
                    resolve({
                        success: true,
                        output: this.outputBuffer.join(''),
                        result: result
                    });
                } else {
                    throw new Error('_mp_js_exec function not available');
                }
                
                // Clear buffers
                this.outputBuffer = [];
                this.errorBuffer = [];
            } catch (error) {
                // Clear buffers on error too
                this.outputBuffer = [];
                this.errorBuffer = [];
                
                reject({
                    success: false,
                    error: error.message
                });
            }
        });
    }
    
    /**
     * Import a Python module
     */
    async importModule(moduleName) {
        if (!this.initialized) {
            throw new Error('CircuitPython not initialized. Call init() first.');
        }
        
        // Use the simple execute method to import modules
        return await this.execute(`import ${moduleName}`);
    }
    
    /**
     * REPL interaction
     */
    processReplChar(char) {
        if (!this.initialized) {
            throw new Error('CircuitPython not initialized. Call init() first.');
        }
        
        return this.module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    
    /**
     * Process a complete REPL line
     */
    async processReplLine(line) {
        const results = [];
        for (const char of line) {
            results.push(this.processReplChar(char));
        }
        results.push(this.processReplChar('\n'));
        
        return {
            complete: results[results.length - 1] === 0,
            output: this.outputBuffer.join(''),
            error: this.errorBuffer.join('')
        };
    }
    
    /**
     * Register JavaScript module for Python import
     */
    registerJsModule(name, jsObject) {
        if (!this.initialized) {
            throw new Error('CircuitPython not initialized. Call init() first.');
        }
        
        const namePtr = this.module.allocateUTF8(name);
        const objRef = this.module.proxy_js_ref(jsObject);
        
        this.module._mp_js_register_js_module(namePtr, objRef);
        this.module._free(namePtr);
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        if (this.module) {
            // Clean up any allocated memory
            this.module = null;
        }
        this.initialized = false;
    }
}

/**
 * Factory function for creating CircuitPython instance
 */
export async function createCircuitPython(options = {}) {
    const bridge = new CircuitPythonBridge();
    await bridge.init(options);
    return bridge;
}

/**
 * Web Worker support for non-blocking execution
 */
export class CircuitPythonWorker {
    constructor() {
        this.worker = null;
        this.messageId = 0;
        this.pendingMessages = new Map();
    }
    
    async init() {
        // Create worker from inline code
        const workerCode = `
            import('./circuitpython-bridge.js').then(async ({ createCircuitPython }) => {
                let cp = null;
                
                self.onmessage = async (e) => {
                    const { id, type, data } = e.data;
                    
                    try {
                        let result;
                        
                        switch (type) {
                            case 'init':
                                cp = await createCircuitPython(data);
                                result = { success: true };
                                break;
                                
                            case 'execute':
                                result = await cp.execute(data.code);
                                break;
                                
                            case 'import':
                                result = await cp.importModule(data.module);
                                break;
                                
                            case 'repl':
                                result = await cp.processReplLine(data.line);
                                break;
                                
                            default:
                                throw new Error(\`Unknown message type: \${type}\`);
                        }
                        
                        self.postMessage({ id, success: true, result });
                    } catch (error) {
                        self.postMessage({ id, success: false, error: error.message });
                    }
                };
            });
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl, { type: 'module' });
        
        // Initialize the worker
        await this.sendMessage('init', {});
        
        return this;
    }
    
    sendMessage(type, data) {
        return new Promise((resolve, reject) => {
            const id = this.messageId++;
            
            this.pendingMessages.set(id, { resolve, reject });
            
            this.worker.onmessage = (e) => {
                const { id, success, result, error } = e.data;
                const pending = this.pendingMessages.get(id);
                
                if (pending) {
                    this.pendingMessages.delete(id);
                    
                    if (success) {
                        pending.resolve(result);
                    } else {
                        pending.reject(new Error(error));
                    }
                }
            };
            
            this.worker.postMessage({ id, type, data });
        });
    }
    
    async execute(code) {
        return this.sendMessage('execute', { code });
    }
    
    async importModule(moduleName) {
        return this.sendMessage('import', { module: moduleName });
    }
    
    async processReplLine(line) {
        return this.sendMessage('repl', { line });
    }
    
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Default export
export default { CircuitPythonBridge, CircuitPythonWorker, createCircuitPython };