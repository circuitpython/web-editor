/**
 * Node.js Optimized CircuitPython Entry Point
 * 
 * This entry point provides the full-featured Node.js experience with:
 * - Native serial port access via serialport
 * - Direct filesystem integration with CIRCUITPY drives  
 * - Process-level device discovery and management
 * - Ultra-low latency hardware operations
 * - Real-time file synchronization
 * - Advanced debugging and monitoring
 */

import { createCircuitPython } from '../circuitpython-bridge.js';
import NodeJSHardwareBridge from '../nodejs-hardware-bridge.js';
import { BoardShadowRuntime } from '../board-shadow-runtime.js';

export class NodeCircuitPython {
    constructor(options = {}) {
        this.options = {
            // Node.js optimized defaults
            heapSize: 16 * 1024 * 1024,  // 16MB heap (more available in Node.js)
            enableFileSync: true,
            enableDeviceDiscovery: true,
            enableProcessMonitoring: true,
            autoConnect: true,
            circuitpyPath: null,          // Auto-detect
            serialBaudRate: 115200,
            syncInterval: 100,            // Faster sync in Node.js
            enableAdvancedLogging: true,
            ...options
        };
        
        this.circuitPython = null;
        this.hardwareBridge = null;
        this.boardShadow = null;
        this.isInitialized = false;
        
        // Node.js specific features
        this.processMonitor = null;
        this.deviceWatcher = null;
        this.performanceMetrics = {
            startTime: Date.now(),
            commandsExecuted: 0,
            averageLatency: 0,
            filesSynced: 0
        };
    }
    
    /**
     * Initialize Node.js optimized CircuitPython
     */
    async init() {
        if (this.isInitialized) return this;
        
        console.log('🚀 Initializing Node.js CircuitPython with advanced features...');
        
        try {
            // Initialize CircuitPython WASM with Node.js optimizations
            this.circuitPython = await createCircuitPython({
                heapSize: this.options.heapSize,
                onOutput: (text) => this.handleOutput(text),
                onError: (text) => this.handleError(text),
                // Node.js specific options
                enableSourceMaps: true,
                enableProfiling: this.options.enableAdvancedLogging
            });
            
            // Initialize hardware bridge
            this.hardwareBridge = new NodeJSHardwareBridge({
                baudRate: this.options.serialBaudRate,
                enableFileSync: this.options.enableFileSync,
                enableLogging: this.options.enableAdvancedLogging,
                syncInterval: this.options.syncInterval,
                circuitpyPath: this.options.circuitpyPath
            });
            
            // Initialize board shadow runtime
            this.boardShadow = new BoardShadowRuntime({
                enableLogging: this.options.enableAdvancedLogging,
                syncInterval: this.options.syncInterval
            });
            
            // Auto-connect if enabled
            if (this.options.autoConnect) {
                await this.connect();
            }
            
            // Start Node.js specific monitoring
            if (this.options.enableProcessMonitoring) {
                this.startProcessMonitoring();
            }
            
            if (this.options.enableDeviceDiscovery) {
                this.startDeviceWatcher();
            }
            
            this.isInitialized = true;
            console.log('✅ Node.js CircuitPython ready with advanced features');
            
            return this;
            
        } catch (error) {
            console.error('❌ Node.js CircuitPython initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Connect to physical device with Node.js optimizations
     */
    async connect() {
        try {
            console.log('🔌 Connecting to CircuitPython device...');
            
            const deviceInfo = await this.hardwareBridge.connect();
            
            // Integrate hardware bridge with board shadow
            this.integrateHardwareBridge();
            
            console.log(`✅ Connected to ${deviceInfo?.manufacturer || 'CircuitPython'} device`);
            return deviceInfo;
            
        } catch (error) {
            console.error('❌ Connection failed:', error);
            
            // Fallback to virtual mode
            console.log('⚠️  Falling back to virtual mode');
            await this.boardShadow.connectPhysicalBoard(); // Will use virtual
            
            return { type: 'virtual', status: 'fallback' };
        }
    }
    
    /**
     * Integrate hardware bridge with board shadow runtime
     */
    integrateHardwareBridge() {
        // Forward hardware operations from board shadow to Node.js bridge
        this.boardShadow.setPin = async (pinId, value) => {
            const result = await this.hardwareBridge.queueHardwareCommand('digital_write', pinId, value);
            this.boardShadow.updateShadowState(pinId, value, 'physical');
            this.performanceMetrics.commandsExecuted++;
            return result;
        };
        
        this.boardShadow.getPin = async (pinId) => {
            const result = await this.hardwareBridge.queueHardwareCommand('digital_read', pinId);
            this.boardShadow.updateShadowState(pinId, result, 'physical');
            return result;
        };
        
        // Set up bidirectional sync
        setInterval(() => {
            this.syncHardwareState();
        }, this.options.syncInterval);
    }
    
    /**
     * Sync hardware state between bridge and shadow
     */
    async syncHardwareState() {
        try {
            const hardwareState = this.hardwareBridge.hardwareState;
            
            for (const [pinId, value] of hardwareState) {
                const shadowValue = this.boardShadow.getPin(pinId);
                
                if (value !== shadowValue) {
                    this.boardShadow.updateShadowState(pinId, value, 'physical');
                }
            }
        } catch (error) {
            // Sync errors are non-fatal
            if (this.options.enableAdvancedLogging) {
                console.warn('Hardware sync warning:', error.message);
            }
        }
    }
    
    /**
     * Execute Python code with Node.js optimizations
     */
    async execute(code, options = {}) {
        const startTime = Date.now();
        
        try {
            // Enhanced error context for Node.js
            const enhancedCode = this.enhanceCodeForNode(code);
            
            const result = await this.circuitPython.execute(enhancedCode);
            
            // Update performance metrics
            const latency = Date.now() - startTime;
            this.performanceMetrics.averageLatency = 
                (this.performanceMetrics.averageLatency + latency) / 2;
            
            if (options.saveToDevice && this.hardwareBridge.circuitpyDrive) {
                const filename = options.filename || 'code.py';
                this.hardwareBridge.writeFileToDevice(filename, code);
                this.performanceMetrics.filesSynced++;
            }
            
            return result;
            
        } catch (error) {
            this.handleExecutionError(error, code);
            throw error;
        }
    }
    
    /**
     * Enhance code with Node.js specific integrations
     */
    enhanceCodeForNode(code) {
        // Add Node.js specific hardware integration
        const nodeIntegration = `
# Node.js CircuitPython Integration
import sys
import time

# Enhanced error reporting for Node.js
class NodeErrorReporter:
    def __init__(self):
        self.context = []
    
    def add_context(self, info):
        self.context.append(info)
    
    def report_error(self, error):
        print(f"NODE_ERROR:{error}")
        for ctx in self.context:
            print(f"NODE_CONTEXT:{ctx}")

_node_reporter = NodeErrorReporter()

# Enhanced hardware abstraction for Node.js
class NodeHardwareProxy:
    def __init__(self, pin_name):
        self.pin_name = pin_name
        _node_reporter.add_context(f"Pin {pin_name} initialized")
    
    def __setattr__(self, name, value):
        if name == 'value' and hasattr(self, 'pin_name'):
            print(f"NODE_HW_WRITE:{self.pin_name}:{value}")
        super().__setattr__(name, value)
    
    def __getattribute__(self, name):
        if name == 'value' and hasattr(self, 'pin_name'):
            print(f"NODE_HW_READ:{self.pin_name}")
        return super().__getattribute__(name)

# User code starts here:
${code}
`;
        
        return nodeIntegration;
    }
    
    /**
     * Write code directly to connected device
     */
    async writeCodeToDevice(code, filename = 'code.py') {
        if (!this.hardwareBridge.circuitpyDrive) {
            throw new Error('CIRCUITPY drive not available');
        }
        
        this.hardwareBridge.writeFileToDevice(filename, code);
        this.performanceMetrics.filesSynced++;
        
        console.log(`📝 Wrote ${code.length} bytes to device:${filename}`);
        return { filename, size: code.length };
    }
    
    /**
     * Read code from connected device
     */
    async readCodeFromDevice(filename = 'code.py') {
        if (!this.hardwareBridge.circuitpyDrive) {
            throw new Error('CIRCUITPY drive not available');
        }
        
        const fs = await import('fs');
        const path = await import('path');
        
        const filepath = path.join(this.hardwareBridge.circuitpyDrive, filename);
        
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            console.log(`📖 Read ${content.length} bytes from device:${filename}`);
            return content;
        } catch (error) {
            throw new Error(`Failed to read ${filename}: ${error.message}`);
        }
    }
    
    /**
     * Start process monitoring (Node.js specific)
     */
    startProcessMonitoring() {
        this.processMonitor = setInterval(() => {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            if (this.options.enableAdvancedLogging) {
                console.log('📊 Process Stats:', {
                    memory: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                    heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                    uptime: `${Math.round(process.uptime())}s`,
                    commands: this.performanceMetrics.commandsExecuted,
                    avgLatency: `${this.performanceMetrics.averageLatency.toFixed(1)}ms`
                });
            }
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Start device watcher (Node.js specific)
     */
    startDeviceWatcher() {
        // Watch for device connections/disconnections
        this.deviceWatcher = setInterval(async () => {
            if (!this.hardwareBridge.isConnected) {
                // Try to reconnect
                try {
                    await this.connect();
                } catch (error) {
                    // Reconnection failed, continue monitoring
                }
            }
        }, 5000); // Every 5 seconds
    }
    
    /**
     * Get comprehensive status (Node.js enhanced)
     */
    getStatus() {
        const baseStatus = {
            initialized: this.isInitialized,
            uptime: Date.now() - this.performanceMetrics.startTime,
            performance: this.performanceMetrics,
            environment: 'nodejs',
            features: {
                nativeSerial: true,
                filesystem: true,
                processMonitoring: true,
                deviceWatcher: true,
                fileSync: this.options.enableFileSync
            }
        };
        
        if (this.hardwareBridge) {
            baseStatus.hardware = this.hardwareBridge.getStats();
        }
        
        if (this.boardShadow) {
            baseStatus.shadow = this.boardShadow.getHardwareStatus();
        }
        
        // Node.js specific process information
        baseStatus.process = {
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
        
        return baseStatus;
    }
    
    /**
     * Handle output with Node.js enhancements
     */
    handleOutput(text) {
        // Parse Node.js specific commands
        if (text.startsWith('NODE_HW_')) {
            this.handleNodeHardwareCommand(text);
            return;
        }
        
        if (text.startsWith('NODE_ERROR:')) {
            console.error('🔴 Python Error:', text.substring(11));
            return;
        }
        
        if (text.startsWith('NODE_CONTEXT:')) {
            console.log('📋 Context:', text.substring(13));
            return;
        }
        
        // Regular output
        console.log('🐍', text);
    }
    
    /**
     * Handle Node.js hardware commands
     */
    handleNodeHardwareCommand(command) {
        const [type, pin, value] = command.split(':').slice(1);
        
        if (type === 'WRITE') {
            this.boardShadow.setPin(pin, parseInt(value));
        } else if (type === 'READ') {
            // Hardware read request from Python code
            this.boardShadow.getPin(pin);
        }
    }
    
    /**
     * Handle errors with Node.js context
     */
    handleError(text) {
        console.error('🔥 CircuitPython Error:', text);
    }
    
    /**
     * Handle execution errors with enhanced context
     */
    handleExecutionError(error, code) {
        console.error('💥 Execution Error:', error.message);
        
        if (this.options.enableAdvancedLogging) {
            console.error('📝 Code context:', code.split('\n').slice(-5).join('\n'));
            console.error('🔍 Hardware state:', this.boardShadow?.exportState());
        }
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up Node.js CircuitPython...');
        
        if (this.processMonitor) {
            clearInterval(this.processMonitor);
        }
        
        if (this.deviceWatcher) {
            clearInterval(this.deviceWatcher);
        }
        
        if (this.hardwareBridge) {
            await this.hardwareBridge.disconnect();
        }
        
        if (this.boardShadow) {
            this.boardShadow.dispose();
        }
        
        if (this.circuitPython) {
            this.circuitPython.dispose();
        }
        
        this.isInitialized = false;
        console.log('✅ Cleanup complete');
    }
}

/**
 * Factory function for Node.js CircuitPython
 */
export default async function nodeCtPy(options = {}) {
    const instance = new NodeCircuitPython(options);
    await instance.init();
    return instance;
}

// Handle process cleanup
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, cleaning up...');
    // Global cleanup would go here
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    // Could notify any active instances
});

export { NodeCircuitPython };