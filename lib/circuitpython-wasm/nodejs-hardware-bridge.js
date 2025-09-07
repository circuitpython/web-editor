/**
 * Node.js Hardware Bridge for CircuitPython WebAssembly
 * 
 * This creates a much more direct and efficient bridge when running in Node.js
 * on the same host as the physical CircuitPython device. Advantages:
 * 
 * - Native serialport access (no WebSerial limitations)
 * - Direct filesystem access to CIRCUITPY drive
 * - Process-level device discovery and management
 * - Bidirectional file synchronization
 * - Much lower latency hardware operations
 */

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { existsSync, readFileSync, writeFileSync, watchFile } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

export class NodeJSHardwareBridge {
    constructor(options = {}) {
        this.options = {
            baudRate: 115200,
            autoDetect: true,
            circuitpyPath: null,          // Auto-detect CIRCUITPY drive
            enableFileSync: true,         // Sync files to/from device
            enableDirectControl: true,    // Direct hardware control
            commandTimeout: 5000,
            syncInterval: 500,
            enableLogging: true,
            ...options
        };
        
        // Device connection
        this.serialPort = null;
        this.parser = null;
        this.isConnected = false;
        this.deviceInfo = null;
        
        // Command processing
        this.commandQueue = [];
        this.pendingCommands = new Map();
        this.commandId = 0;
        this.isProcessing = false;
        
        // File system integration
        this.circuitpyDrive = null;
        this.fileWatchers = new Map();
        this.fileSyncEnabled = false;
        
        // Hardware abstraction
        this.hardwareState = new Map();
        this.pinMappings = new Map();
        
        // Performance monitoring
        this.stats = {
            commandsExecuted: 0,
            averageLatency: 0,
            totalLatency: 0,
            filesSynced: 0,
            connectionUptime: 0
        };
    }
    
    /**
     * Auto-discover and connect to CircuitPython device
     */
    async connect() {
        this.log('Starting device discovery...');
        
        try {
            // Auto-detect CircuitPython device
            const device = await this.discoverCircuitPythonDevice();
            if (!device) {
                throw new Error('No CircuitPython device found');
            }
            
            // Connect to serial port
            await this.connectSerial(device.path);
            
            // Detect CIRCUITPY filesystem
            if (this.options.enableFileSync) {
                await this.detectCircuitPyDrive();
            }
            
            // Initialize hardware abstraction
            await this.initializeHardwareLayer();
            
            // Start file synchronization
            if (this.fileSyncEnabled) {
                this.startFileSync();
            }
            
            this.isConnected = true;
            this.stats.connectionUptime = Date.now();
            
            this.log(`Connected to ${device.manufacturer || 'Unknown'} device on ${device.path}`);
            return device;
            
        } catch (error) {
            this.log(`Connection failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Discover CircuitPython devices via serial port enumeration
     */
    async discoverCircuitPythonDevice() {
        const ports = await SerialPort.list();
        
        // Look for common CircuitPython device signatures
        const circuitpySignatures = [
            { vendorId: '239A', productId: 'FEATHER' },  // Adafruit
            { vendorId: '2E8A', productId: 'PICO' },     // Raspberry Pi
            { vendorId: '239A', productId: '8014' },     // Various Adafruit boards
        ];
        
        for (const port of ports) {
            // Check vendor/product ID
            const isKnownVendor = circuitpySignatures.some(sig => 
                port.vendorId?.toUpperCase() === sig.vendorId ||
                port.productId?.toUpperCase().includes(sig.productId)
            );
            
            // Check manufacturer string
            const isCircuitPy = port.manufacturer?.toLowerCase().includes('adafruit') ||
                               port.manufacturer?.toLowerCase().includes('circuitpython') ||
                               port.serialNumber?.toLowerCase().includes('circuitpy');
            
            if (isKnownVendor || isCircuitPy) {
                this.log(`Found potential CircuitPython device: ${port.path} (${port.manufacturer})`);
                return port;
            }
        }
        
        // If no obvious match, try the first available serial port
        if (ports.length > 0) {
            this.log(`No obvious CircuitPython device found, trying first available: ${ports[0].path}`);
            return ports[0];
        }
        
        return null;
    }
    
    /**
     * Connect to serial port
     */
    async connectSerial(portPath) {
        return new Promise((resolve, reject) => {
            this.serialPort = new SerialPort({
                path: portPath,
                baudRate: this.options.baudRate,
                autoOpen: false
            });
            
            this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
            
            this.serialPort.open((error) => {
                if (error) {
                    reject(new Error(`Failed to open serial port: ${error.message}`));
                    return;
                }
                
                // Set up response handling
                this.setupResponseHandling();
                
                // Send initial commands to identify device
                setTimeout(() => {
                    this.identifyDevice().then(resolve).catch(reject);
                }, 1000); // Give device time to settle
            });
        });
    }
    
    /**
     * Set up response handling from device
     */
    setupResponseHandling() {
        this.parser.on('data', (line) => {
            const trimmedLine = line.trim();
            
            // Handle command responses
            this.handleCommandResponse(trimmedLine);
            
            // Handle hardware state updates
            this.handleHardwareStateUpdate(trimmedLine);
            
            // Log general output if enabled
            if (this.options.enableLogging && !trimmedLine.startsWith('CMD_RESPONSE:')) {
                this.log(`Device: ${trimmedLine}`);
            }
        });
        
        this.serialPort.on('error', (error) => {
            this.log(`Serial error: ${error.message}`);
        });
    }
    
    /**
     * Identify connected device
     */
    async identifyDevice() {
        // Send Ctrl+C to interrupt any running code
        this.serialPort.write('\x03');
        await this.delay(100);
        
        // Get device info
        const deviceInfo = await this.executeCommand(`
import sys, board, os
print("DEVICE_INFO:", {
    "platform": sys.platform,
    "version": ".".join(map(str, sys.version_info[:3])),
    "board_id": getattr(board, "board_id", "unknown"),
    "implementation": sys.implementation.name
})
`);
        
        try {
            const infoMatch = deviceInfo.match(/DEVICE_INFO: (.+)/);
            if (infoMatch) {
                this.deviceInfo = JSON.parse(infoMatch[1].replace(/'/g, '"'));
                this.log(`Device identified: ${this.deviceInfo.board_id} (${this.deviceInfo.platform})`);
            }
        } catch (e) {
            this.log('Could not parse device info');
        }
        
        return this.deviceInfo;
    }
    
    /**
     * Detect CIRCUITPY filesystem drive
     */
    async detectCircuitPyDrive() {
        // Common mount points for CIRCUITPY
        const possiblePaths = [
            '/media/CIRCUITPY',
            '/Volumes/CIRCUITPY',
            'D:\\',  // Windows
            'E:\\',  // Windows alternative
            '/mnt/CIRCUITPY'
        ];
        
        for (const path of possiblePaths) {
            if (existsSync(path)) {
                // Verify it's actually a CircuitPython drive
                const bootPyPath = join(path, 'boot.py');
                const codePyPath = join(path, 'code.py');
                
                if (existsSync(bootPyPath) || existsSync(codePyPath)) {
                    this.circuitpyDrive = path;
                    this.fileSyncEnabled = true;
                    this.log(`CIRCUITPY drive detected at: ${path}`);
                    return path;
                }
            }
        }
        
        this.log('CIRCUITPY drive not found - file sync disabled');
        return null;
    }
    
    /**
     * Initialize hardware abstraction layer on device
     */
    async initializeHardwareLayer() {
        const hardwareCode = `
# Node.js Hardware Bridge Layer
import board
import digitalio
import analogio
import pwmio
import time
import gc

# Hardware management
_hw = {
    'pins': {},
    'pwm': {},
    'analog': {},
    'state': {}
}

def hw_init():
    print("HW_BRIDGE_READY")
    return True

def hw_pin_setup(pin_name, direction='output', pull=None):
    try:
        if pin_name in _hw['pins']:
            _hw['pins'][pin_name].deinit()
        
        pin_obj = getattr(board, pin_name)
        dio = digitalio.DigitalInOut(pin_obj)
        
        if direction == 'output':
            dio.direction = digitalio.Direction.OUTPUT
        else:
            dio.direction = digitalio.Direction.INPUT
            if pull == 'up':
                dio.pull = digitalio.Pull.UP
            elif pull == 'down':
                dio.pull = digitalio.Pull.DOWN
        
        _hw['pins'][pin_name] = dio
        print(f"CMD_RESPONSE:SETUP_OK:{pin_name}")
        return True
    except Exception as e:
        print(f"CMD_RESPONSE:ERROR:setup:{pin_name}:{e}")
        return False

def hw_digital_write(pin_name, value):
    try:
        if pin_name not in _hw['pins']:
            hw_pin_setup(pin_name, 'output')
        
        _hw['pins'][pin_name].value = bool(value)
        _hw['state'][f'digital_{pin_name}'] = bool(value)
        print(f"CMD_RESPONSE:WRITE_OK:{pin_name}:{value}")
        return True
    except Exception as e:
        print(f"CMD_RESPONSE:ERROR:write:{pin_name}:{e}")
        return False

def hw_digital_read(pin_name):
    try:
        if pin_name not in _hw['pins']:
            hw_pin_setup(pin_name, 'input', 'up')
        
        value = _hw['pins'][pin_name].value
        _hw['state'][f'digital_{pin_name}'] = value
        print(f"CMD_RESPONSE:READ_OK:{pin_name}:{int(value)}")
        return value
    except Exception as e:
        print(f"CMD_RESPONSE:ERROR:read:{pin_name}:{e}")
        return False

def hw_pwm_setup(pin_name, frequency=1000):
    try:
        if pin_name in _hw['pwm']:
            _hw['pwm'][pin_name].deinit()
        
        pin_obj = getattr(board, pin_name)
        pwm = pwmio.PWMOut(pin_obj, frequency=frequency)
        _hw['pwm'][pin_name] = pwm
        print(f"CMD_RESPONSE:PWM_SETUP_OK:{pin_name}:{frequency}")
        return True
    except Exception as e:
        print(f"CMD_RESPONSE:ERROR:pwm_setup:{pin_name}:{e}")
        return False

def hw_pwm_write(pin_name, duty_cycle):
    try:
        if pin_name not in _hw['pwm']:
            hw_pwm_setup(pin_name)
        
        duty = int(duty_cycle * 65535)
        _hw['pwm'][pin_name].duty_cycle = duty
        _hw['state'][f'pwm_{pin_name}'] = duty_cycle
        print(f"CMD_RESPONSE:PWM_WRITE_OK:{pin_name}:{duty_cycle}")
        return True
    except Exception as e:
        print(f"CMD_RESPONSE:ERROR:pwm_write:{pin_name}:{e}")
        return False

def hw_analog_read(pin_name):
    try:
        if pin_name not in _hw['analog']:
            pin_obj = getattr(board, pin_name)
            _hw['analog'][pin_name] = analogio.AnalogIn(pin_obj)
        
        raw_value = _hw['analog'][pin_name].value
        voltage = raw_value * 3.3 / 65536
        _hw['state'][f'analog_{pin_name}'] = voltage
        print(f"CMD_RESPONSE:ANALOG_OK:{pin_name}:{voltage}")
        return voltage
    except Exception as e:
        print(f"CMD_RESPONSE:ERROR:analog:{pin_name}:{e}")
        return 0.0

def hw_get_state():
    print(f"CMD_RESPONSE:STATE_OK:{_hw['state']}")
    return _hw['state']

def hw_cleanup():
    try:
        for pin in _hw['pins'].values():
            pin.deinit()
        for pwm in _hw['pwm'].values():
            pwm.deinit()
        
        _hw['pins'].clear()
        _hw['pwm'].clear()
        _hw['analog'].clear()
        _hw['state'].clear()
        
        gc.collect()
        print("CMD_RESPONSE:CLEANUP_OK")
        return True
    except Exception as e:
        print(f"CMD_RESPONSE:ERROR:cleanup:{e}")
        return False

# Initialize
hw_init()
`;
        
        await this.executeCommand(hardwareCode);
        
        // Wait for initialization confirmation
        await this.waitForResponse('HW_BRIDGE_READY', 5000);
        
        // Start command processor
        this.startCommandProcessor();
    }
    
    /**
     * Execute command on device
     */
    async executeCommand(command, timeout = null) {
        return new Promise((resolve, reject) => {
            const cmdTimeout = timeout || this.options.commandTimeout;
            const cmdId = this.commandId++;
            
            const timeoutId = setTimeout(() => {
                this.pendingCommands.delete(cmdId);
                reject(new Error('Command timeout'));
            }, cmdTimeout);
            
            this.pendingCommands.set(cmdId, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                },
                command,
                startTime: Date.now()
            });
            
            // Send command
            this.serialPort.write(command + '\r\n');
        });
    }
    
    /**
     * Wait for specific response pattern
     */
    async waitForResponse(pattern, timeout = 5000) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this.parser.off('data', handler);
                resolve(null);
            }, timeout);
            
            const handler = (line) => {
                if (line.includes(pattern)) {
                    clearTimeout(timeoutId);
                    this.parser.off('data', handler);
                    resolve(line.trim());
                }
            };
            
            this.parser.on('data', handler);
        });
    }
    
    /**
     * Handle command responses from device
     */
    handleCommandResponse(line) {
        if (!line.startsWith('CMD_RESPONSE:')) return;
        
        // Parse response: CMD_RESPONSE:TYPE:DATA
        const parts = line.substring(13).split(':');
        const responseType = parts[0];
        const responseData = parts.slice(1).join(':');
        
        // Update statistics
        this.stats.commandsExecuted++;
        
        // Handle specific response types
        switch (responseType) {
            case 'WRITE_OK':
            case 'READ_OK':
            case 'PWM_WRITE_OK':
            case 'ANALOG_OK':
                // Update hardware state
                const [pin, value] = responseData.split(':');
                this.hardwareState.set(pin, parseFloat(value) || value);
                break;
            
            case 'ERROR':
                this.log(`Hardware error: ${responseData}`);
                break;
        }
        
        // Resolve any pending commands
        const oldestPending = this.pendingCommands.entries().next().value;
        if (oldestPending) {
            const [cmdId, pendingCommand] = oldestPending;
            this.pendingCommands.delete(cmdId);
            
            // Calculate latency
            const latency = Date.now() - pendingCommand.startTime;
            this.stats.totalLatency += latency;
            this.stats.averageLatency = this.stats.totalLatency / this.stats.commandsExecuted;
            
            pendingCommand.resolve(line);
        }
    }
    
    /**
     * Handle hardware state updates
     */
    handleHardwareStateUpdate(line) {
        // Handle state broadcasts from device
        if (line.includes('HARDWARE_STATE:')) {
            try {
                const stateData = line.substring(line.indexOf('{'));
                const state = JSON.parse(stateData.replace(/'/g, '"'));
                
                for (const [key, value] of Object.entries(state)) {
                    this.hardwareState.set(key, value);
                }
            } catch (e) {
                // Ignore malformed state updates
            }
        }
    }
    
    /**
     * Start command processor
     */
    startCommandProcessor() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processCommands();
    }
    
    /**
     * Process command queue
     */
    async processCommands() {
        while (this.isProcessing && this.isConnected) {
            if (this.commandQueue.length > 0) {
                const command = this.commandQueue.shift();
                
                try {
                    const response = await this.executeCommand(command.code);
                    
                    if (command.callback) {
                        command.callback(null, response);
                    }
                } catch (error) {
                    if (command.callback) {
                        command.callback(error);
                    }
                }
            }
            
            await this.delay(1);
        }
    }
    
    /**
     * Queue hardware command
     */
    queueHardwareCommand(type, pin, value = null) {
        return new Promise((resolve, reject) => {
            let code;
            
            switch (type) {
                case 'digital_write':
                    code = `hw_digital_write("${pin}", ${value})`;
                    break;
                case 'digital_read':
                    code = `hw_digital_read("${pin}")`;
                    break;
                case 'pwm_write':
                    code = `hw_pwm_write("${pin}", ${value})`;
                    break;
                case 'analog_read':
                    code = `hw_analog_read("${pin}")`;
                    break;
                default:
                    reject(new Error(`Unknown command type: ${type}`));
                    return;
            }
            
            this.commandQueue.push({
                code,
                callback: (error, response) => {
                    if (error) reject(error);
                    else resolve(response);
                }
            });
        });
    }
    
    /**
     * Start file synchronization
     */
    startFileSync() {
        if (!this.circuitpyDrive) return;
        
        const codePyPath = join(this.circuitpyDrive, 'code.py');
        
        // Watch for changes to code.py
        if (existsSync(codePyPath)) {
            this.fileWatchers.set('code.py', watchFile(codePyPath, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    this.log('code.py changed on device');
                    this.handleFileChange('code.py', codePyPath);
                }
            }));
        }
        
        this.log('File synchronization started');
    }
    
    /**
     * Handle file changes
     */
    handleFileChange(filename, filepath) {
        try {
            const content = readFileSync(filepath, 'utf8');
            this.log(`File ${filename} updated (${content.length} bytes)`);
            
            // Optionally notify external listeners
            this.emit?.('file-changed', { filename, content, filepath });
            
        } catch (error) {
            this.log(`Error reading changed file ${filename}: ${error.message}`);
        }
    }
    
    /**
     * Write file to device
     */
    writeFileToDevice(filename, content) {
        if (!this.circuitpyDrive) {
            throw new Error('CIRCUITPY drive not available');
        }
        
        const filepath = join(this.circuitpyDrive, filename);
        writeFileSync(filepath, content, 'utf8');
        this.stats.filesSynced++;
        
        this.log(`Wrote ${content.length} bytes to ${filename}`);
    }
    
    /**
     * Get bridge statistics
     */
    getStats() {
        return {
            ...this.stats,
            isConnected: this.isConnected,
            deviceInfo: this.deviceInfo,
            circuitpyDrive: this.circuitpyDrive,
            hardwareStates: this.hardwareState.size,
            queueLength: this.commandQueue.length,
            uptime: this.isConnected ? Date.now() - this.stats.connectionUptime : 0
        };
    }
    
    /**
     * Disconnect from device
     */
    async disconnect() {
        this.isProcessing = false;
        this.isConnected = false;
        
        // Stop file watchers
        for (const watcher of this.fileWatchers.values()) {
            watcher.close?.();
        }
        this.fileWatchers.clear();
        
        // Clean up hardware on device
        try {
            await this.executeCommand('hw_cleanup()');
        } catch (error) {
            this.log(`Cleanup warning: ${error.message}`);
        }
        
        // Close serial port
        if (this.serialPort && this.serialPort.isOpen) {
            await new Promise((resolve) => {
                this.serialPort.close(resolve);
            });
        }
        
        this.log('Disconnected from device');
    }
    
    /**
     * Utility: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Logging utility
     */
    log(...args) {
        if (this.options.enableLogging) {
            console.log('[NodeJS-HW-Bridge]', ...args);
        }
    }
}

export default NodeJSHardwareBridge;