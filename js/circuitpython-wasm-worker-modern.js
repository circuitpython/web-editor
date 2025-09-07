/**
 * Modern CircuitPython WebAssembly Worker
 * Uses the CircuitPythonBridge architecture following ARCHITECTURE_RECOMMENDATIONS.md
 */

import { CircuitPythonBridge } from '../lib/circuitpython-wasm/circuitpython-bridge.js';

class ModernCircuitPythonWASM {
    constructor() {
        this.bridge = null;
        this.initialized = false;
        this.outputCallback = null;
    }
    
    async initialize(outputCallback) {
        if (this.initialized) return;
        
        this.outputCallback = outputCallback || console.log;
        
        try {
            // Initialize with modern bridge
            this.bridge = new CircuitPythonBridge();
            
            await this.bridge.init({
                heapSize: 8 * 1024 * 1024, // 8MB heap
                onOutput: (text) => {
                    if (this.outputCallback) {
                        this.outputCallback(text);
                    }
                },
                onError: (text) => {
                    if (this.outputCallback) {
                        this.outputCallback(text);
                    }
                }
            });
            
            this.initialized = true;
            console.log('Modern CircuitPython WASM bridge initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize modern CircuitPython WASM bridge:', error);
            throw error;
        }
    }
    
    /**
     * Execute Python code using the modern async API
     */
    async executeCode(code) {
        if (!this.initialized || !this.bridge) {
            console.error('CircuitPython bridge not initialized');
            return;
        }
        
        try {
            // Use the modern async execution method
            const result = await this.bridge.execute(code);
            return result;
        } catch (error) {
            console.error('Error executing code:', error);
            if (this.outputCallback) {
                this.outputCallback(`Error: ${error.message}\n`);
            }
        }
    }
    
    /**
     * Process input - use modern execution instead of broken REPL
     */
    async processInput(input) {
        if (!input.trim()) return;
        
        // Echo the input to show what was entered
        if (this.outputCallback) {
            this.outputCallback(`>>> ${input}\n`);
        }
        
        return await this.executeCode(input.trim());
    }
    
    /**
     * Reset the interpreter
     */
    async reset() {
        if (!this.initialized || !this.bridge) return;
        
        try {
            // Use modern reset method
            await this.bridge.reset();
            if (this.outputCallback) {
                this.outputCallback('\n--- Interpreter reset ---\n');
            }
        } catch (error) {
            console.error('Error resetting interpreter:', error);
        }
    }
    
    /**
     * Get available modules
     */
    async getAvailableModules() {
        if (!this.initialized || !this.bridge) return [];
        
        try {
            return await this.bridge.getAvailableModules();
        } catch (error) {
            console.error('Error getting available modules:', error);
            return [];
        }
    }
    
    /**
     * Check if a module can be imported
     */
    async canImport(moduleName) {
        if (!this.initialized || !this.bridge) return false;
        
        try {
            const result = await this.bridge.execute(`
try:
    import ${moduleName}
    print("import_success")
except ImportError:
    print("import_failed")
except Exception as e:
    print(f"import_error: {e}")
            `);
            
            return result && result.output && result.output.includes('import_success');
        } catch (error) {
            return false;
        }
    }
}

// Export for use in virtual workflow
export { ModernCircuitPythonWASM };