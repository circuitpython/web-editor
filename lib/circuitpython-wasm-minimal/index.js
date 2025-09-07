/**
 * Minimal CircuitPython WebAssembly Implementation for Web Editor Demo
 * This is a simplified version that doesn't depend on the full WASM build
 */

export class MinimalCircuitPython {
    constructor(options = {}) {
        this.options = {
            enableVirtualHardware: true,
            enableBasicModules: true,
            enableREPL: true,
            ...options
        };
        
        this.virtualHardware = new Map();
        this.isInitialized = false;
        this.outputCallback = options.onOutput || console.log;
        
        // Initialize virtual pins
        this.initializeVirtualHardware();
    }
    
    async init() {
        if (this.isInitialized) return this;
        
        console.log('🔄 Initializing Minimal CircuitPython (Demo Mode)...');
        
        // Simulate initialization
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.isInitialized = true;
        console.log('✅ Minimal CircuitPython ready!');
        
        return this;
    }
    
    initializeVirtualHardware() {
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
    }
    
    async execute(code) {
        if (!this.isInitialized) {
            throw new Error('CircuitPython not initialized');
        }
        
        this.outputCallback(`Executing: ${code.split('\n')[0]}...`);
        
        // Simulate code execution with virtual hardware responses
        await this.simulateExecution(code);
        
        return {
            success: true,
            output: 'Code executed successfully',
            environment: 'minimal-demo'
        };
    }
    
    async simulateExecution(code) {
        // Simple pattern matching to simulate CircuitPython behavior
        const lines = code.split('\n').map(line => line.trim()).filter(line => line);
        
        for (const line of lines) {
            if (line.startsWith('import ')) {
                const module = line.replace('import ', '').split(' as')[0].trim();
                this.outputCallback(`MINIMAL_MODULE_IMPORT:${module}`);
                await this.sleep(100);
            }
            
            else if (line.includes('= digitalio.DigitalInOut(')) {
                const match = line.match(/(\w+)\s*=\s*digitalio\.DigitalInOut\(\s*board\.(\w+)\s*\)/);
                if (match) {
                    const [, varName, pinName] = match;
                    this.outputCallback(`MINIMAL_PIN_INIT:${pinName}`);
                    await this.sleep(100);
                }
            }
            
            else if (line.includes('.direction = ')) {
                const match = line.match(/(\w+)\.direction\s*=\s*digitalio\.Direction\.(\w+)/);
                if (match) {
                    const [, varName, direction] = match;
                    // Find pin associated with this variable (simplified)
                    const pinName = this.findPinForVariable(varName) || 'LED';
                    this.outputCallback(`MINIMAL_PIN_DIRECTION:${pinName}:${direction.toLowerCase()}`);
                    await this.sleep(100);
                }
            }
            
            else if (line.includes('.value = ')) {
                const match = line.match(/(\w+)\.value\s*=\s*(.+)/);
                if (match) {
                    const [, varName, value] = match;
                    const pinName = this.findPinForVariable(varName) || 'LED';
                    const boolValue = this.evaluateValue(value);
                    this.outputCallback(`MINIMAL_PIN_WRITE:${pinName}:${boolValue ? 1 : 0}`);
                    await this.sleep(100);
                }
            }
            
            else if (line.includes('= analogio.AnalogIn(')) {
                const match = line.match(/(\w+)\s*=\s*analogio\.AnalogIn\(\s*board\.(\w+)\s*\)/);
                if (match) {
                    const [, varName, pinName] = match;
                    this.outputCallback(`MINIMAL_ANALOG_INIT:${pinName}`);
                    await this.sleep(100);
                }
            }
            
            else if (line.includes('.value') && !line.includes('=')) {
                // Reading analog value
                const match = line.match(/(\w+)\.value/);
                if (match) {
                    const [, varName] = match;
                    const pinName = this.findPinForVariable(varName) || 'A0';
                    const randomValue = Math.floor(Math.random() * 65536);
                    this.outputCallback(`MINIMAL_ANALOG_READ:${pinName}:${randomValue}`);
                    await this.sleep(100);
                }
            }
            
            else if (line.includes('time.sleep(')) {
                const match = line.match(/time\.sleep\(\s*([\d.]+)\s*\)/);
                if (match) {
                    const duration = parseFloat(match[1]);
                    this.outputCallback(`MINIMAL_SLEEP:${duration}`);
                    await this.sleep(duration * 1000);
                }
            }
            
            else if (line.startsWith('print(')) {
                const match = line.match(/print\(\s*(.+)\s*\)/);
                if (match) {
                    let content = match[1];
                    // Simple string evaluation
                    if (content.startsWith('"') && content.endsWith('"')) {
                        content = content.slice(1, -1);
                    } else if (content.startsWith("'") && content.endsWith("'")) {
                        content = content.slice(1, -1);
                    }
                    // Format output like real CircuitPython REPL
                    this.outputCallback(content);
                    await this.sleep(50);
                }
            }
            
            else if (line.startsWith('>>> ') || line.startsWith('... ')) {
                // Skip REPL prompts in code
                continue;
            }
            
            else if (line.includes('for ') && line.includes(' in range(')) {
                // Handle simple for loops
                const match = line.match(/for\s+(\w+)\s+in\s+range\(\s*(\d+)\s*\):/);
                if (match) {
                    const [, varName, count] = match;
                    this.outputCallback(`Starting loop: ${count} iterations`);
                    await this.sleep(100);
                }
            }
            
            else if (line.includes('# ') || line.startsWith('#')) {
                // Skip comments
                continue;
            }
            
            else if (line.length > 0) {
                // Generic statement
                await this.sleep(50);
            }
        }
    }
    
    findPinForVariable(varName) {
        // Simple mapping for demo purposes
        const mapping = {
            'led': 'LED',
            'button': 'BUTTON',
            'sensor': 'A0',
            'pin0': 'GP0',
            'pin1': 'GP1',
            'pin2': 'GP2',
            'pin3': 'GP3'
        };
        return mapping[varName.toLowerCase()] || null;
    }
    
    evaluateValue(value) {
        if (value === 'True' || value === 'true' || value === '1') return true;
        if (value === 'False' || value === 'false' || value === '0') return false;
        if (value.includes('not ')) {
            // Simple not evaluation
            return !this.evaluateValue(value.replace('not ', '').trim());
        }
        return false;
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async setPin(pinId, value) {
        const pin = this.virtualHardware.get(pinId);
        if (pin) {
            pin.value = value ? 1 : 0;
            pin.lastUpdate = Date.now();
        }
        return true;
    }
    
    async getPin(pinId) {
        const pin = this.virtualHardware.get(pinId);
        if (!pin) return 0;
        
        // Simulate button input
        if (pinId === 'BUTTON') {
            pin.value = Math.random() > 0.9 ? 1 : 0;
        }
        
        // Simulate analog readings  
        if (pin.type === 'analog') {
            pin.value = Math.random();
        }
        
        pin.lastUpdate = Date.now();
        return pin.value;
    }
    
    resetVirtualHardware() {
        for (const [pinId, pin] of this.virtualHardware) {
            pin.value = 0;
            pin.direction = 'input';
            pin.lastUpdate = Date.now();
        }
        this.outputCallback('🔄 Virtual hardware reset');
    }
    
    getStatus() {
        return {
            environment: 'minimal-demo',
            isInitialized: this.isInitialized,
            virtualHardware: Object.fromEntries(this.virtualHardware),
            features: {
                codeExecution: true,
                virtualHardware: this.options.enableVirtualHardware,
                basicModules: this.options.enableBasicModules,
                repl: this.options.enableREPL
            }
        };
    }
}

// Factory function
export async function minimalCtPy(options = {}) {
    const instance = new MinimalCircuitPython(options);
    await instance.init();
    return instance;
}

// Web editor helper
export async function createWebEditorInstance(outputCallback) {
    const cp = await minimalCtPy({
        onOutput: outputCallback,
        enableVirtualHardware: true,
        enableBasicModules: true,
        enableREPL: true
    });
    
    return {
        instance: cp,
        execute: (code) => cp.execute(code),
        getStatus: () => cp.getStatus(),
        setPin: (pin, value) => cp.setPin(pin, value),
        getPin: (pin) => cp.getPin(pin),
        reset: () => cp.resetVirtualHardware()
    };
}

// Environment detection helpers
export const environment = {
    isNode: typeof window === 'undefined' && typeof process !== 'undefined',
    isBrowser: typeof window !== 'undefined' && typeof navigator !== 'undefined',
    hasWebSerial: typeof navigator !== 'undefined' && 'serial' in navigator,
    hasWebUSB: typeof navigator !== 'undefined' && 'usb' in navigator,
    hasWebWorkers: typeof Worker !== 'undefined'
};

export default minimalCtPy;