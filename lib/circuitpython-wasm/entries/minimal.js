/**
 * Minimal CircuitPython Entry Point
 * 
 * Provides just the core Python interpreter with basic CircuitPython compatibility:
 * - Minimal memory footprint (~150KB WASM)
 * - Core Python language features
 * - Basic module imports
 * - Virtual hardware simulation
 * - Fast initialization
 * - Perfect for code validation and learning
 */

import { createCircuitPython } from '../circuitpython-bridge.js';

export class MinimalCircuitPython {
    constructor(options = {}) {
        this.options = {
            // Minimal defaults - optimized for size and speed
            heapSize: 2 * 1024 * 1024,   // 2MB heap (minimal)
            stackSize: 64 * 1024,        // 64KB stack
            enableVirtualHardware: true,
            enableBasicModules: true,
            enableREPL: true,
            enableDebugging: false,      // Disable to save space
            enableAdvancedFeatures: false,
            virtualOnly: false,
            ...options
        };
        
        this.circuitPython = null;
        this.virtualHardware = new Map();
        this.isInitialized = false;
        
        // Minimal feature set
        this.features = {
            coreInterpreter: true,
            basicModules: this.options.enableBasicModules,
            virtualHardware: this.options.enableVirtualHardware,
            repl: this.options.enableREPL,
            debugging: this.options.enableDebugging
        };
        
        // Performance metrics
        this.metrics = {
            initTime: 0,
            executionCount: 0,
            totalExecutionTime: 0,
            memoryUsage: 0
        };
    }
    
    /**
     * Initialize minimal CircuitPython interpreter
     */
    async init() {
        if (this.isInitialized) return this;
        
        const startTime = Date.now();
        console.log('⚡ Initializing Minimal CircuitPython...');
        
        try {
            // Initialize with minimal configuration
            this.circuitPython = await createCircuitPython({
                heapSize: this.options.heapSize,
                stackSize: this.options.stackSize,
                onOutput: (text) => this.handleOutput(text),
                onError: (text) => this.handleError(text),
                // Minimal optimizations
                enableSourceMaps: false,
                enableProfiling: false,
                enableWebGL: false,
                enableOffscreenCanvas: false
            });
            
            // Set up virtual hardware if enabled
            if (this.options.enableVirtualHardware) {
                this.initializeVirtualHardware();
            }
            
            // Set up basic module compatibility
            if (this.options.enableBasicModules) {
                await this.setupBasicModules();
            }
            
            this.metrics.initTime = Date.now() - startTime;
            this.isInitialized = true;
            
            console.log(`✅ Minimal CircuitPython ready (${this.metrics.initTime}ms)`);
            return this;
            
        } catch (error) {
            console.error('❌ Minimal CircuitPython initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Initialize virtual hardware simulation
     */
    initializeVirtualHardware() {
        // Create virtual pins with basic functionality
        const virtualPins = [
            'GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5',
            'LED', 'BUTTON', 'A0', 'A1', 'A2'
        ];
        
        virtualPins.forEach(pinId => {
            this.virtualHardware.set(pinId, {
                value: 0,
                direction: 'input',
                type: pinId.startsWith('A') ? 'analog' : 'digital',
                lastUpdate: Date.now()
            });
        });
        
        console.log(`📟 Virtual hardware initialized (${virtualPins.length} pins)`);
    }
    
    /**
     * Set up basic CircuitPython module compatibility
     */
    async setupBasicModules() {
        const moduleSetup = `
# Minimal CircuitPython Module Compatibility Layer

# Virtual board module
class VirtualBoard:
    # Basic pin definitions
    GP0 = "GP0"
    GP1 = "GP1" 
    GP2 = "GP2"
    GP3 = "GP3"
    GP4 = "GP4"
    GP5 = "GP5"
    LED = "LED"
    BUTTON = "BUTTON"
    A0 = "A0"
    A1 = "A1"
    A2 = "A2"
    
    board_id = "minimal_virtual"

# Install virtual board
import sys
sys.modules['board'] = VirtualBoard()

# Minimal digitalio module
class DigitalInOut:
    class Direction:
        INPUT = "input"
        OUTPUT = "output"
    
    class Pull:
        UP = "up"
        DOWN = "down"
    
    def __init__(self, pin):
        self.pin = str(pin)
        self._direction = self.Direction.INPUT
        self._value = False
        print(f"MINIMAL_PIN_INIT:{self.pin}")
    
    @property
    def direction(self):
        return self._direction
    
    @direction.setter
    def direction(self, dir):
        self._direction = dir
        print(f"MINIMAL_PIN_DIRECTION:{self.pin}:{dir}")
    
    @property
    def value(self):
        print(f"MINIMAL_PIN_READ:{self.pin}")
        return self._value
    
    @value.setter
    def value(self, val):
        self._value = bool(val)
        print(f"MINIMAL_PIN_WRITE:{self.pin}:{val}")

class DigitalIOModule:
    DigitalInOut = DigitalInOut

sys.modules['digitalio'] = DigitalIOModule()

# Minimal analogio module  
class AnalogIn:
    def __init__(self, pin):
        self.pin = str(pin)
        print(f"MINIMAL_ANALOG_INIT:{self.pin}")
    
    @property
    def value(self):
        # Simulate analog reading
        import random
        val = random.randint(0, 65535)
        print(f"MINIMAL_ANALOG_READ:{self.pin}:{val}")
        return val

class AnalogIOModule:
    AnalogIn = AnalogIn

sys.modules['analogio'] = AnalogIOModule()

# Minimal time module enhancements
import time
_original_sleep = time.sleep

def minimal_sleep(seconds):
    print(f"MINIMAL_SLEEP:{seconds}")
    _original_sleep(seconds)

time.sleep = minimal_sleep

print("MINIMAL_MODULES_READY")
`;
        
        try {
            await this.circuitPython.execute(moduleSetup);
            console.log('📦 Basic modules installed');
        } catch (error) {
            console.warn('⚠️  Basic module setup failed:', error);
        }
    }
    
    /**
     * Execute code with minimal overhead
     */
    async execute(code, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Minimal CircuitPython not initialized');
        }
        
        const startTime = Date.now();
        
        try {
            // Add minimal enhancements if needed
            const enhancedCode = this.options.enableAdvancedFeatures ? 
                this.addMinimalEnhancements(code) : code;
            
            const result = await this.circuitPython.execute(enhancedCode);
            
            // Update metrics
            const executionTime = Date.now() - startTime;
            this.metrics.executionCount++;
            this.metrics.totalExecutionTime += executionTime;
            
            return {
                ...result,
                executionTime,
                environment: 'minimal'
            };
            
        } catch (error) {
            console.error('Execution failed:', error);
            throw error;
        }
    }
    
    /**
     * Add minimal enhancements to code
     */
    addMinimalEnhancements(code) {
        return `
# Minimal CircuitPython Enhancement Layer
import sys
import gc

# Memory-efficient execution
gc.collect()  # Clean up before execution

# User code:
${code}

# Clean up after execution
gc.collect()
`;
    }
    
    /**
     * Virtual pin operations
     */
    async setPin(pinId, value) {
        if (!this.options.enableVirtualHardware) {
            throw new Error('Virtual hardware not enabled');
        }
        
        const pin = this.virtualHardware.get(pinId);
        if (!pin) {
            throw new Error(`Unknown pin: ${pinId}`);
        }
        
        pin.value = value ? 1 : 0;
        pin.lastUpdate = Date.now();
        
        console.log(`📍 Pin ${pinId} set to ${pin.value}`);
        return true;
    }
    
    async getPin(pinId) {
        if (!this.options.enableVirtualHardware) {
            throw new Error('Virtual hardware not enabled');
        }
        
        const pin = this.virtualHardware.get(pinId);
        if (!pin) {
            throw new Error(`Unknown pin: ${pinId}`);
        }
        
        // Simulate button input for BUTTON pin
        if (pinId === 'BUTTON') {
            pin.value = Math.random() > 0.9 ? 1 : 0; // 10% chance of press
        }
        
        // Simulate analog readings
        if (pin.type === 'analog') {
            pin.value = Math.random(); // 0.0 to 1.0
        }
        
        pin.lastUpdate = Date.now();
        return pin.value;
    }
    
    /**
     * Import module with minimal overhead
     */
    async importModule(moduleName) {
        try {
            const result = await this.circuitPython.execute(`import ${moduleName}`);
            console.log(`📥 Module '${moduleName}' imported`);
            return result;
        } catch (error) {
            console.error(`Failed to import '${moduleName}':`, error.message);
            throw error;
        }
    }
    
    /**
     * REPL interface (if enabled)
     */
    async processReplLine(line) {
        if (!this.options.enableREPL) {
            throw new Error('REPL not enabled in minimal mode');
        }
        
        try {
            const result = await this.execute(line);
            return {
                success: true,
                output: result.output || '',
                error: null
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error.message
            };
        }
    }
    
    /**
     * Handle output from interpreter
     */
    handleOutput(text) {
        // Handle minimal-specific output
        if (text.startsWith('MINIMAL_PIN_')) {
            this.handleVirtualHardware(text);
            return;
        }
        
        if (text.startsWith('MINIMAL_SLEEP:')) {
            const duration = parseFloat(text.substring(14));
            console.log(`⏱️  Sleep: ${duration}s`);
            return;
        }
        
        if (text === 'MINIMAL_MODULES_READY') {
            console.log('📦 Minimal modules ready');
            return;
        }
        
        // Regular output
        console.log('🐍', text);
    }
    
    /**
     * Handle virtual hardware operations
     */
    handleVirtualHardware(command) {
        const [operation, pin, value] = command.split(':').slice(1);
        
        switch (operation) {
            case 'INIT':
                console.log(`📟 Virtual pin ${pin} initialized`);
                break;
                
            case 'DIRECTION':
                console.log(`📍 Pin ${pin} direction: ${value}`);
                break;
                
            case 'WRITE':
                this.setPin(pin, parseInt(value));
                break;
                
            case 'READ':
                // Pin read logged by getPin
                break;
                
            case 'ANALOG_INIT':
                console.log(`📊 Analog pin ${pin} initialized`);
                break;
                
            case 'ANALOG_READ':
                console.log(`📊 Analog ${pin}: ${value}`);
                break;
        }
    }
    
    /**
     * Handle errors
     */
    handleError(text) {
        console.error('🔥', text);
    }
    
    /**
     * Get minimal status information
     */
    getStatus() {
        return {
            environment: 'minimal',
            isInitialized: this.isInitialized,
            features: this.features,
            metrics: {
                ...this.metrics,
                averageExecutionTime: this.metrics.executionCount > 0 ? 
                    this.metrics.totalExecutionTime / this.metrics.executionCount : 0
            },
            virtualHardware: this.options.enableVirtualHardware ? {
                pins: Array.from(this.virtualHardware.keys()),
                totalPins: this.virtualHardware.size
            } : null,
            memoryFootprint: 'minimal (~2MB)',
            capabilities: {
                codeExecution: true,
                moduleImport: this.options.enableBasicModules,
                virtualPins: this.options.enableVirtualHardware,
                repl: this.options.enableREPL,
                debugging: this.options.enableDebugging,
                hardwareAccess: false,
                fileSystem: false,
                visualization: false
            }
        };
    }
    
    /**
     * Get virtual hardware state
     */
    getVirtualHardwareState() {
        if (!this.options.enableVirtualHardware) {
            return null;
        }
        
        const state = {};
        for (const [pinId, pin] of this.virtualHardware) {
            state[pinId] = {
                value: pin.value,
                type: pin.type,
                direction: pin.direction,
                lastUpdate: pin.lastUpdate
            };
        }
        
        return state;
    }
    
    /**
     * Reset virtual hardware
     */
    resetVirtualHardware() {
        if (!this.options.enableVirtualHardware) return;
        
        for (const [pinId, pin] of this.virtualHardware) {
            pin.value = 0;
            pin.direction = 'input';
            pin.lastUpdate = Date.now();
        }
        
        console.log('🔄 Virtual hardware reset');
    }
    
    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            averageExecutionTime: this.metrics.executionCount > 0 ? 
                this.metrics.totalExecutionTime / this.metrics.executionCount : 0,
            executionsPerSecond: this.metrics.executionCount > 0 ?
                this.metrics.executionCount / (this.metrics.totalExecutionTime / 1000) : 0
        };
    }
    
    /**
     * Minimal cleanup
     */
    async cleanup() {
        console.log('🧹 Cleaning up Minimal CircuitPython...');
        
        if (this.circuitPython) {
            this.circuitPython.dispose();
        }
        
        this.virtualHardware.clear();
        this.isInitialized = false;
        
        console.log('✅ Minimal cleanup complete');
    }
}

/**
 * Factory function for Minimal CircuitPython
 */
export default async function minimalCtPy(options = {}) {
    const instance = new MinimalCircuitPython(options);
    await instance.init();
    return instance;
}

/**
 * Quick start function for basic usage
 */
export async function quickStart(code) {
    const cp = await minimalCtPy({
        enableVirtualHardware: true,
        enableBasicModules: true
    });
    
    return await cp.execute(code);
}

/**
 * Code validation function
 */
export async function validateCode(code) {
    try {
        const cp = await minimalCtPy({
            enableVirtualHardware: false,
            enableBasicModules: false,
            enableDebugging: false
        });
        
        await cp.execute(code);
        return { valid: true, error: null };
        
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

export { MinimalCircuitPython };