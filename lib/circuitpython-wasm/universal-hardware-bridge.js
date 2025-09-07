/**
 * Universal Hardware Bridge for CircuitPython WebAssembly
 * 
 * Automatically detects runtime environment and provides appropriate hardware bridge:
 * - Node.js: Direct serial port access, filesystem integration, native device discovery  
 * - Browser: WebSerial/WebUSB APIs, limited but functional
 * - Other: Graceful fallback to virtual-only mode
 */

// Environment detection
const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node;
const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
const hasWebSerial = isBrowser && 'serial' in navigator;
const hasWebUSB = isBrowser && 'usb' in navigator;

let NodeJSHardwareBridge = null;
let WebSerialBoard = null;
let U2IFBoard = null;

// Dynamic imports based on environment
if (isNode) {
    // Node.js environment - full featured bridge
    try {
        const nodeModule = await import('./nodejs-hardware-bridge.js');
        NodeJSHardwareBridge = nodeModule.default;
    } catch (error) {
        console.warn('Node.js hardware bridge not available:', error.message);
    }
} else if (isBrowser) {
    // Browser environment - web API bridge
    try {
        if (hasWebSerial) {
            const webSerialModule = await import('./webserial-board.js');
            WebSerialBoard = webSerialModule.default;
        }
        
        if (hasWebUSB) {
            const u2ifModule = await import('./u2if-board.js');
            U2IFBoard = u2ifModule.default;
        }
    } catch (error) {
        console.warn('Browser hardware bridges not available:', error.message);
    }
}

export class UniversalHardwareBridge {
    constructor(options = {}) {
        this.options = {
            preferredMode: 'auto',        // 'node', 'webserial', 'u2if', 'virtual', 'auto'
            fallbackToVirtual: true,
            enableLogging: true,
            ...options
        };
        
        // Runtime environment info
        this.environment = {
            type: isNode ? 'nodejs' : (isBrowser ? 'browser' : 'unknown'),
            capabilities: this.detectCapabilities(),
            features: this.detectFeatures()
        };
        
        // Bridge implementation
        this.activeBridge = null;
        this.bridgeType = null;
        this.isConnected = false;
        
        // Virtual fallback
        this.virtualMode = false;
        this.virtualState = new Map();
        
        this.log('Universal bridge initialized:', this.environment);
    }
    
    /**
     * Detect available hardware capabilities
     */
    detectCapabilities() {
        const capabilities = {
            serialPort: false,
            usbDevice: false,
            filesystem: false,
            nativeDiscovery: false,
            fileWatching: false,
            processControl: false
        };
        
        if (isNode) {
            capabilities.serialPort = true;
            capabilities.filesystem = true;
            capabilities.nativeDiscovery = true;
            capabilities.fileWatching = true;
            capabilities.processControl = true;
        } else if (isBrowser) {
            capabilities.serialPort = hasWebSerial;
            capabilities.usbDevice = hasWebUSB;
            capabilities.filesystem = false; // Limited File System Access API
        }
        
        return capabilities;
    }
    
    /**
     * Detect available bridge features
     */
    detectFeatures() {
        const features = {
            directSerial: isNode || hasWebSerial,
            usbCommunication: isNode || hasWebUSB,
            fileSystemSync: isNode,
            deviceAutoDiscovery: isNode,
            lowLatencyControl: isNode,
            bidirectionalSync: isNode || hasWebSerial,
            virtualFallback: true
        };
        
        return features;
    }
    
    /**
     * Connect using best available method
     */
    async connect() {
        this.log('Attempting connection with best available method...');
        
        const preferredMode = this.options.preferredMode;
        
        try {
            // Try preferred mode first if specified
            if (preferredMode !== 'auto') {
                const result = await this.connectWithMode(preferredMode);
                if (result) return result;
            }
            
            // Auto-detect best connection method
            return await this.autoConnect();
            
        } catch (error) {
            this.log(`Connection failed: ${error.message}`);
            
            if (this.options.fallbackToVirtual) {
                return this.enableVirtualMode();
            }
            
            throw error;
        }
    }
    
    /**
     * Auto-detect and connect with best method
     */
    async autoConnect() {
        const methods = this.getPrioritizedConnectionMethods();
        
        for (const method of methods) {
            try {
                this.log(`Trying ${method} connection...`);
                const result = await this.connectWithMode(method);
                if (result) {
                    this.log(`Successfully connected via ${method}`);
                    return result;
                }
            } catch (error) {
                this.log(`${method} failed: ${error.message}`);
                continue;
            }
        }
        
        throw new Error('All connection methods failed');
    }
    
    /**
     * Get prioritized list of connection methods based on environment
     */
    getPrioritizedConnectionMethods() {
        const methods = [];
        
        if (isNode && NodeJSHardwareBridge) {
            methods.push('nodejs');
        }
        
        if (hasWebSerial && WebSerialBoard) {
            methods.push('webserial');
        }
        
        if (hasWebUSB && U2IFBoard) {
            methods.push('u2if');
        }
        
        // Virtual mode as last resort
        if (this.options.fallbackToVirtual) {
            methods.push('virtual');
        }
        
        return methods;
    }
    
    /**
     * Connect with specific mode
     */
    async connectWithMode(mode) {
        switch (mode) {
            case 'nodejs':
                return await this.connectNodeJS();
                
            case 'webserial':
                return await this.connectWebSerial();
                
            case 'u2if':
                return await this.connectU2IF();
                
            case 'virtual':
                return this.enableVirtualMode();
                
            default:
                throw new Error(`Unknown connection mode: ${mode}`);
        }
    }
    
    /**
     * Connect via Node.js native bridge
     */
    async connectNodeJS() {
        if (!NodeJSHardwareBridge) {
            throw new Error('Node.js bridge not available');
        }
        
        this.activeBridge = new NodeJSHardwareBridge(this.options);
        const deviceInfo = await this.activeBridge.connect();
        
        this.bridgeType = 'nodejs';
        this.isConnected = true;
        
        return {
            type: 'nodejs',
            device: deviceInfo,
            capabilities: ['serial', 'filesystem', 'discovery', 'sync'],
            latency: 'ultra-low',
            features: this.environment.features
        };
    }
    
    /**
     * Connect via WebSerial
     */
    async connectWebSerial() {
        if (!WebSerialBoard) {
            throw new Error('WebSerial bridge not available');
        }
        
        this.activeBridge = await WebSerialBoard.connect();
        this.bridgeType = 'webserial';
        this.isConnected = true;
        
        return {
            type: 'webserial',
            device: await this.activeBridge.getBoardInfo(),
            capabilities: ['serial', 'repl'],
            latency: 'low',
            features: { directSerial: true, bidirectionalSync: true }
        };
    }
    
    /**
     * Connect via U2IF (WebUSB)
     */
    async connectU2IF() {
        if (!U2IFBoard) {
            throw new Error('U2IF bridge not available');
        }
        
        this.activeBridge = await U2IFBoard.connect();
        this.bridgeType = 'u2if';
        this.isConnected = true;
        
        return {
            type: 'u2if',
            device: await this.activeBridge.getBoardInfo(),
            capabilities: ['usb', 'direct_control'],
            latency: 'very-low',
            features: { usbCommunication: true, lowLatencyControl: true }
        };
    }
    
    /**
     * Enable virtual-only mode
     */
    enableVirtualMode() {
        this.virtualMode = true;
        this.bridgeType = 'virtual';
        this.isConnected = true;
        
        this.log('Operating in virtual-only mode');
        
        return {
            type: 'virtual',
            device: { name: 'Virtual CircuitPython Board', platform: 'simulation' },
            capabilities: ['simulation', 'visualization'],
            latency: 'instant',
            features: { virtualFallback: true }
        };
    }
    
    /**
     * Universal pin control interface
     */
    async setPin(pinId, value) {
        if (this.virtualMode) {
            this.virtualState.set(pinId, value);
            this.notifyPinChange(pinId, value, 'virtual');
            return Promise.resolve(true);
        }
        
        if (!this.activeBridge) {
            throw new Error('No active bridge connection');
        }
        
        // Delegate to active bridge
        switch (this.bridgeType) {
            case 'nodejs':
                return await this.activeBridge.queueHardwareCommand('digital_write', pinId, value);
                
            case 'webserial':
                return await this.activeBridge.setPin(pinId, value);
                
            case 'u2if':
                return await this.activeBridge.setPin(pinId, value);
                
            default:
                throw new Error(`Unsupported bridge type: ${this.bridgeType}`);
        }
    }
    
    /**
     * Universal pin read interface
     */
    async getPin(pinId) {
        if (this.virtualMode) {
            return this.virtualState.get(pinId) || 0;
        }
        
        if (!this.activeBridge) {
            throw new Error('No active bridge connection');
        }
        
        switch (this.bridgeType) {
            case 'nodejs':
                return await this.activeBridge.queueHardwareCommand('digital_read', pinId);
                
            case 'webserial':
                return await this.activeBridge.readPin(pinId);
                
            case 'u2if':
                return await this.activeBridge.readPin(pinId);
                
            default:
                throw new Error(`Unsupported bridge type: ${this.bridgeType}`);
        }
    }
    
    /**
     * Universal analog read interface
     */
    async readAnalog(pinId) {
        if (this.virtualMode) {
            // Simulate sensor readings
            return Math.random() * 3.3; // 0-3.3V simulation
        }
        
        if (!this.activeBridge) {
            throw new Error('No active bridge connection');
        }
        
        switch (this.bridgeType) {
            case 'nodejs':
                return await this.activeBridge.queueHardwareCommand('analog_read', pinId);
                
            case 'webserial':
                return await this.activeBridge.readPinAnalog(pinId);
                
            case 'u2if':
                return await this.activeBridge.readAnalog(pinId);
                
            default:
                throw new Error(`Unsupported bridge type: ${this.bridgeType}`);
        }
    }
    
    /**
     * Universal PWM control interface
     */
    async setPWM(pinId, dutyCycle) {
        if (this.virtualMode) {
            this.virtualState.set(`pwm_${pinId}`, dutyCycle);
            this.notifyPinChange(pinId, dutyCycle, 'virtual-pwm');
            return Promise.resolve(true);
        }
        
        if (!this.activeBridge) {
            throw new Error('No active bridge connection');
        }
        
        switch (this.bridgeType) {
            case 'nodejs':
                return await this.activeBridge.queueHardwareCommand('pwm_write', pinId, dutyCycle);
                
            case 'webserial':
                return await this.activeBridge.setPinAnalog(pinId, dutyCycle);
                
            case 'u2if':
                return await this.activeBridge.setPWM(pinId, dutyCycle);
                
            default:
                throw new Error(`Unsupported bridge type: ${this.bridgeType}`);
        }
    }
    
    /**
     * Get comprehensive bridge status
     */
    getStatus() {
        const baseStatus = {
            environment: this.environment,
            bridgeType: this.bridgeType,
            isConnected: this.isConnected,
            virtualMode: this.virtualMode,
            capabilities: this.environment.capabilities,
            features: this.environment.features
        };
        
        if (this.activeBridge && this.activeBridge.getStats) {
            baseStatus.bridgeStats = this.activeBridge.getStats();
        }
        
        if (this.virtualMode) {
            baseStatus.virtualStates = Object.fromEntries(this.virtualState);
        }
        
        return baseStatus;
    }
    
    /**
     * Write code to device (if filesystem available)
     */
    async writeCodeToDevice(filename, content) {
        if (this.bridgeType === 'nodejs' && this.activeBridge.writeFileToDevice) {
            return this.activeBridge.writeFileToDevice(filename, content);
        } else {
            throw new Error('File writing not supported in current mode');
        }
    }
    
    /**
     * Execute code on device
     */
    async executeCode(code) {
        if (!this.activeBridge) {
            throw new Error('No active bridge connection');
        }
        
        if (this.activeBridge.executeCommand) {
            return await this.activeBridge.executeCommand(code);
        } else if (this.activeBridge.runCode) {
            return await this.activeBridge.runCode(code);
        } else {
            throw new Error('Code execution not supported in current mode');
        }
    }
    
    /**
     * Pin change notification (for virtual mode)
     */
    notifyPinChange(pinId, value, source) {
        // Emit events if EventEmitter is available
        if (this.emit) {
            this.emit('pin-change', { pinId, value, source });
        }
        
        // Call callback if provided
        if (this.options.onPinChange) {
            this.options.onPinChange(pinId, value, source);
        }
    }
    
    /**
     * Disconnect from device
     */
    async disconnect() {
        if (this.activeBridge && this.activeBridge.disconnect) {
            await this.activeBridge.disconnect();
        }
        
        this.activeBridge = null;
        this.bridgeType = null;
        this.isConnected = false;
        this.virtualMode = false;
        this.virtualState.clear();
        
        this.log('Disconnected from all devices');
    }
    
    /**
     * Get recommended usage based on environment
     */
    getRecommendedUsage() {
        if (isNode) {
            return {
                primary: 'Direct hardware control via Node.js',
                benefits: [
                    'Ultra-low latency hardware operations',
                    'Filesystem integration with CIRCUITPY drive',
                    'Automatic device discovery and management',
                    'Real-time file synchronization',
                    'Process-level control and monitoring'
                ],
                limitations: []
            };
        } else if (hasWebSerial && hasWebUSB) {
            return {
                primary: 'Browser-based hardware control',
                benefits: [
                    'Direct device communication from browser',
                    'No additional software required',
                    'Cross-platform compatibility',
                    'Real-time hardware interaction'
                ],
                limitations: [
                    'Requires user permission for device access',
                    'Limited filesystem integration',
                    'Higher latency than native solutions'
                ]
            };
        } else {
            return {
                primary: 'Virtual simulation mode',
                benefits: [
                    'No physical hardware required',
                    'Perfect for learning and testing',
                    'Instant response and feedback',
                    'Safe experimentation environment'
                ],
                limitations: [
                    'No real hardware interaction',
                    'Simulated sensor readings only'
                ]
            };
        }
    }
    
    /**
     * Logging utility
     */
    log(...args) {
        if (this.options.enableLogging) {
            console.log('[Universal-HW-Bridge]', ...args);
        }
    }
}

/**
 * Factory function for easy instantiation
 */
export async function createHardwareBridge(options = {}) {
    const bridge = new UniversalHardwareBridge(options);
    
    // Optionally auto-connect
    if (options.autoConnect !== false) {
        try {
            await bridge.connect();
        } catch (error) {
            console.warn('Auto-connection failed:', error.message);
            
            if (!options.fallbackToVirtual) {
                throw error;
            }
        }
    }
    
    return bridge;
}

export default UniversalHardwareBridge;