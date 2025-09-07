/**
 * Universal CircuitPython Entry Point
 * 
 * Auto-detects environment and provides the best available implementation:
 * - Node.js: Full-featured with native serial and filesystem
 * - Browser: WebSerial/WebUSB with visualization
 * - Worker: Non-blocking execution with parallel processing
 * - Fallback: Virtual mode with simulation
 */

import { UniversalHardwareBridge } from '../universal-hardware-bridge.js';

// Environment detection
const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node;
const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
const isWorker = typeof importScripts === 'function';

export class UniversalCircuitPython {
    constructor(options = {}) {
        this.options = {
            // Universal defaults
            autoDetectEnvironment: true,
            fallbackToVirtual: true,
            enableOptimalFeatures: true,
            preferredEnvironment: null,  // 'node', 'browser', 'worker', null
            ...options
        };
        
        // Environment info
        this.environment = this.detectEnvironment();
        this.implementation = null;
        this.hardwareBridge = null;
        this.isInitialized = false;
        
        // Capabilities based on environment
        this.capabilities = this.detectCapabilities();
    }
    
    /**
     * Detect runtime environment
     */
    detectEnvironment() {
        if (isNode) {
            return {
                type: 'nodejs',
                features: ['native-serial', 'filesystem', 'process-control', 'device-discovery'],
                optimal: 'hardware-development'
            };
        } else if (isWorker) {
            return {
                type: 'webworker', 
                features: ['parallel-execution', 'non-blocking', 'shared-memory'],
                optimal: 'computation-intensive'
            };
        } else if (isBrowser) {
            return {
                type: 'browser',
                features: ['webserial', 'webusb', 'visualization', 'dom-integration'],
                optimal: 'interactive-learning'
            };
        } else {
            return {
                type: 'unknown',
                features: ['virtual-simulation'],
                optimal: 'testing-only'
            };
        }
    }
    
    /**
     * Detect available capabilities
     */
    detectCapabilities() {
        const caps = {
            hardwareAccess: false,
            visualization: false,
            filesystem: false,
            parallelExecution: false,
            realTimeSync: false,
            deviceDiscovery: false
        };
        
        if (isNode) {
            caps.hardwareAccess = true;
            caps.filesystem = true;
            caps.realTimeSync = true;
            caps.deviceDiscovery = true;
        } else if (isBrowser) {
            caps.hardwareAccess = 'serial' in navigator || 'usb' in navigator;
            caps.visualization = true;
        } else if (isWorker) {
            caps.parallelExecution = true;
            caps.hardwareAccess = false; // Workers can't access WebSerial/WebUSB directly
        }
        
        return caps;
    }
    
    /**
     * Initialize with optimal implementation for environment
     */
    async init() {
        if (this.isInitialized) return this;
        
        console.log(`🌍 Initializing Universal CircuitPython for ${this.environment.type}...`);
        
        try {
            // Choose optimal implementation
            const implType = this.options.preferredEnvironment || this.environment.type;
            
            switch (implType) {
                case 'nodejs':
                    await this.initializeNodeJS();
                    break;
                    
                case 'browser':
                    await this.initializeBrowser();
                    break;
                    
                case 'webworker':
                    await this.initializeWorker();
                    break;
                    
                default:
                    await this.initializeVirtual();
                    break;
            }
            
            // Initialize universal hardware bridge
            this.hardwareBridge = new UniversalHardwareBridge({
                ...this.options,
                preferredMode: this.getPreferredHardwareMode()
            });
            
            if (this.options.autoConnect !== false) {
                await this.hardwareBridge.connect();
            }
            
            this.isInitialized = true;
            console.log(`✅ Universal CircuitPython ready (${this.environment.type})`);
            
            return this;
            
        } catch (error) {
            console.error('❌ Universal CircuitPython initialization failed:', error);
            
            if (this.options.fallbackToVirtual && !this.implementation) {
                console.log('🔄 Falling back to virtual mode...');
                await this.initializeVirtual();
                return this;
            }
            
            throw error;
        }
    }
    
    /**
     * Initialize Node.js implementation
     */
    async initializeNodeJS() {
        if (!isNode) {
            throw new Error('Node.js implementation requested but not in Node.js environment');
        }
        
        const { default: nodeCtPy } = await import('./node.js');
        this.implementation = await nodeCtPy(this.options);
    }
    
    /**
     * Initialize Browser implementation
     */
    async initializeBrowser() {
        if (!isBrowser) {
            throw new Error('Browser implementation requested but not in browser environment');
        }
        
        const { default: browserCtPy } = await import('./browser.js');
        this.implementation = await browserCtPy(this.options);
    }
    
    /**
     * Initialize Worker implementation
     */
    async initializeWorker() {
        if (!isWorker && !isBrowser) {
            throw new Error('Worker implementation requires browser or worker environment');
        }
        
        const { default: workerCtPy } = await import('./worker.js');
        this.implementation = await workerCtPy(this.options);
    }
    
    /**
     * Initialize virtual-only implementation
     */
    async initializeVirtual() {
        const { default: minimalCtPy } = await import('./minimal.js');
        this.implementation = await minimalCtPy({
            ...this.options,
            virtualOnly: true
        });
    }
    
    /**
     * Get preferred hardware mode based on environment
     */
    getPreferredHardwareMode() {
        if (isNode) return 'nodejs';
        if (isBrowser && 'serial' in navigator) return 'webserial';
        if (isBrowser && 'usb' in navigator) return 'u2if';
        return 'virtual';
    }
    
    /**
     * Execute Python code with universal interface
     */
    async execute(code, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Universal CircuitPython not initialized');
        }
        
        // Add universal enhancements
        const enhancedCode = this.addUniversalEnhancements(code);
        
        return await this.implementation.execute(enhancedCode, options);
    }
    
    /**
     * Add universal enhancements to code
     */
    addUniversalEnhancements(code) {
        const universalPrefix = `
# Universal CircuitPython Enhancements
import sys

# Environment detection
_env_info = {
    'platform': sys.platform,
    'implementation': sys.implementation.name,
    'version': sys.version_info[:3],
    'runtime': '${this.environment.type}'
}

def get_runtime_info():
    return _env_info

# Universal print function
def universal_print(*args, **kwargs):
    prefix = f"[{_env_info['runtime']}]"
    print(prefix, *args, **kwargs)

# User code starts here:
${code}
`;
        
        return universalPrefix;
    }
    
    /**
     * Hardware operations with universal interface
     */
    async setPin(pinId, value) {
        if (this.hardwareBridge) {
            return await this.hardwareBridge.setPin(pinId, value);
        } else if (this.implementation && this.implementation.setPin) {
            return await this.implementation.setPin(pinId, value);
        } else {
            throw new Error('Hardware operations not available');
        }
    }
    
    async getPin(pinId) {
        if (this.hardwareBridge) {
            return await this.hardwareBridge.getPin(pinId);
        } else if (this.implementation && this.implementation.getPin) {
            return await this.implementation.getPin(pinId);
        } else {
            throw new Error('Hardware operations not available');
        }
    }
    
    async readAnalog(pinId) {
        if (this.hardwareBridge) {
            return await this.hardwareBridge.readAnalog(pinId);
        } else {
            throw new Error('Analog operations not available');
        }
    }
    
    async setPWM(pinId, dutyCycle) {
        if (this.hardwareBridge) {
            return await this.hardwareBridge.setPWM(pinId, dutyCycle);
        } else {
            throw new Error('PWM operations not available');
        }
    }
    
    /**
     * Connect to hardware with universal interface
     */
    async connectHardware() {
        if (this.hardwareBridge) {
            return await this.hardwareBridge.connect();
        } else if (this.implementation && this.implementation.connect) {
            return await this.implementation.connect();
        } else {
            throw new Error('Hardware connection not supported in this environment');
        }
    }
    
    /**
     * Get comprehensive universal status
     */
    getStatus() {
        const universalStatus = {
            environment: this.environment,
            capabilities: this.capabilities,
            isInitialized: this.isInitialized,
            implementationType: this.implementation ? this.implementation.constructor.name : 'none'
        };
        
        // Add implementation-specific status
        if (this.implementation && this.implementation.getStatus) {
            universalStatus.implementation = this.implementation.getStatus();
        }
        
        // Add hardware bridge status
        if (this.hardwareBridge) {
            universalStatus.hardware = this.hardwareBridge.getStatus();
        }
        
        return universalStatus;
    }
    
    /**
     * Get usage recommendations for current environment
     */
    getUsageRecommendations() {
        const recommendations = {
            environment: this.environment.type,
            optimal_use: this.environment.optimal,
            available_features: this.environment.features,
            capabilities: this.capabilities
        };
        
        if (isNode) {
            recommendations.suggestions = [
                'Use for production hardware development',
                'Take advantage of filesystem integration',
                'Utilize native device discovery',
                'Enable real-time synchronization'
            ];
        } else if (isBrowser) {
            recommendations.suggestions = [
                'Great for interactive learning',
                'Use visualization features for education',
                'Request device permissions for hardware access',
                'Consider service worker for offline use'
            ];
        } else if (isWorker) {
            recommendations.suggestions = [
                'Ideal for computation-intensive tasks',
                'Use parallel execution capabilities',
                'Leverage shared memory for performance',
                'Suitable for background processing'
            ];
        } else {
            recommendations.suggestions = [
                'Virtual mode suitable for testing',
                'Use for learning Python basics',
                'No hardware interaction available',
                'Consider upgrading environment for full features'
            ];
        }
        
        return recommendations;
    }
    
    /**
     * Import helper for environment-specific modules
     */
    async importModule(moduleName, options = {}) {
        // Try to import from current implementation
        if (this.implementation && this.implementation.importModule) {
            return await this.implementation.importModule(moduleName);
        }
        
        // Fall back to basic import via execute
        return await this.execute(`import ${moduleName}`, options);
    }
    
    /**
     * File operations (if available in environment)
     */
    async writeFileToDevice(filename, content) {
        if (this.implementation && this.implementation.writeCodeToDevice) {
            return await this.implementation.writeCodeToDevice(content, filename);
        } else if (this.hardwareBridge && this.hardwareBridge.writeFileToDevice) {
            return await this.hardwareBridge.writeFileToDevice(filename, content);
        } else {
            throw new Error('File operations not available in current environment');
        }
    }
    
    async readFileFromDevice(filename) {
        if (this.implementation && this.implementation.readCodeFromDevice) {
            return await this.implementation.readCodeFromDevice(filename);
        } else {
            throw new Error('File operations not available in current environment');
        }
    }
    
    /**
     * Cleanup universal resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up Universal CircuitPython...');
        
        if (this.hardwareBridge) {
            await this.hardwareBridge.disconnect();
        }
        
        if (this.implementation && this.implementation.cleanup) {
            await this.implementation.cleanup();
        }
        
        this.isInitialized = false;
        console.log('✅ Universal cleanup complete');
    }
    
    /**
     * Create environment-specific instance
     */
    static async createForEnvironment(environment, options = {}) {
        const instance = new UniversalCircuitPython({
            ...options,
            preferredEnvironment: environment
        });
        
        await instance.init();
        return instance;
    }
}

/**
 * Factory function for Universal CircuitPython
 */
export default async function universalCtPy(options = {}) {
    const instance = new UniversalCircuitPython(options);
    await instance.init();
    return instance;
}

// Convenience factory functions
export const forNode = (options = {}) => 
    UniversalCircuitPython.createForEnvironment('nodejs', options);

export const forBrowser = (options = {}) => 
    UniversalCircuitPython.createForEnvironment('browser', options);

export const forWorker = (options = {}) => 
    UniversalCircuitPython.createForEnvironment('webworker', options);

export { UniversalCircuitPython };