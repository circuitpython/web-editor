/**
 * WebAssembly-as-U2IF Bridge
 * 
 * This module makes a WebAssembly CircuitPython build function like a U2IF device,
 * intercepting hardware operations and forwarding them to a physical device.
 * 
 * Benefits:
 * - Code runs in WebAssembly (full debugging, introspection)  
 * - Hardware operations execute on real device
 * - Seamless integration between virtual and physical
 * - Can simulate sensors while controlling real actuators
 */

export class WebAssemblyU2IFBridge {
    constructor(options = {}) {
        this.options = {
            targetBoard: 'auto',         // Auto-detect or specify board type
            baudRate: 115200,
            bufferSize: 4096,
            commandTimeout: 5000,
            enableBidirectional: true,   // Allow sensor data from device
            enableLogging: false,
            ...options
        };
        
        // Connection management
        this.physicalDevice = null;
        this.connectionType = null;     // 'webserial', 'webusb', null
        this.isConnected = false;
        this.commandQueue = [];
        this.isProcessingCommands = false;
        
        // Hardware abstraction
        this.hardwareShim = new HardwareAbstractionShim(this);
        this.commandInterceptor = new REPLCommandInterceptor(this);
        
        // State management
        this.virtualState = new Map();  // Virtual pin/sensor states
        this.physicalState = new Map(); // Actual hardware states
        this.stateSync = new StateSync(this);
    }
    
    /**
     * Connect to physical device and set up bridge
     */
    async connect() {
        this.log('Attempting to connect to physical device...');
        
        try {
            // Try WebSerial first (most common for CircuitPython)
            this.physicalDevice = await this.connectWebSerial();
            this.connectionType = 'webserial';
        } catch (error) {
            this.log('WebSerial failed, trying WebUSB...');
            
            try {
                this.physicalDevice = await this.connectWebUSB();
                this.connectionType = 'webusb';
            } catch (usbError) {
                throw new Error('No compatible physical device found');
            }
        }
        
        // Initialize the bridge
        await this.initializeBridge();
        
        this.isConnected = true;
        this.log(`Connected via ${this.connectionType}`);
        
        return this.connectionType;
    }
    
    /**
     * Connect via WebSerial
     */
    async connectWebSerial() {
        const port = await navigator.serial.requestPort({
            filters: [
                { usbVendorId: 0x239A }, // Adafruit
                { usbVendorId: 0x2E8A }, // Raspberry Pi
            ]
        });
        
        await port.open({ 
            baudRate: this.options.baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        return new WebSerialDevice(port, this.options);
    }
    
    /**
     * Connect via WebUSB
     */
    async connectWebUSB() {
        const device = await navigator.usb.requestDevice({
            filters: [
                { vendorId: 0x239A }, // Adafruit devices
                { vendorId: 0x2E8A }, // Raspberry Pi devices
            ]
        });
        
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        return new WebUSBDevice(device, this.options);
    }
    
    /**
     * Initialize the bridge system
     */
    async initializeBridge() {
        // Set up hardware abstraction layer on physical device
        await this.setupPhysicalHardwareLayer();
        
        // Start command processing
        this.startCommandProcessor();
        
        // Start bidirectional state sync if enabled
        if (this.options.enableBidirectional) {
            this.stateSync.start();
        }
        
        this.log('Bridge initialized successfully');
    }
    
    /**
     * Set up hardware abstraction layer on the physical device
     */
    async setupPhysicalHardwareLayer() {
        const setupCode = `
# WebAssembly-to-Hardware Bridge Setup
import board
import digitalio
import analogio
import pwmio
import time
import json
import sys

# Hardware abstraction layer
_hw_pins = {}
_hw_pwm = {}
_hw_analog = {}

def _hw_setup():
    """Initialize hardware bridge"""
    print("BRIDGE_READY")
    return True

def _hw_digital_setup(pin_name, direction='output'):
    """Set up digital pin"""
    try:
        if pin_name in _hw_pins:
            _hw_pins[pin_name].deinit()
        
        pin_obj = getattr(board, pin_name)
        dio = digitalio.DigitalInOut(pin_obj)
        
        if direction == 'output':
            dio.direction = digitalio.Direction.OUTPUT
        else:
            dio.direction = digitalio.Direction.INPUT
            dio.pull = digitalio.Pull.UP
            
        _hw_pins[pin_name] = dio
        return True
    except Exception as e:
        print(f"ERROR:{e}")
        return False

def _hw_digital_write(pin_name, value):
    """Write digital pin"""
    try:
        if pin_name not in _hw_pins:
            _hw_digital_setup(pin_name, 'output')
        _hw_pins[pin_name].value = bool(value)
        return True
    except Exception as e:
        print(f"ERROR:{e}")
        return False

def _hw_digital_read(pin_name):
    """Read digital pin"""
    try:
        if pin_name not in _hw_pins:
            _hw_digital_setup(pin_name, 'input')
        value = int(_hw_pins[pin_name].value)
        print(f"DIGITAL_VALUE:{pin_name}:{value}")
        return value
    except Exception as e:
        print(f"ERROR:{e}")
        return 0

def _hw_pwm_setup(pin_name, frequency=1000):
    """Set up PWM pin"""
    try:
        if pin_name in _hw_pwm:
            _hw_pwm[pin_name].deinit()
            
        pin_obj = getattr(board, pin_name)
        pwm = pwmio.PWMOut(pin_obj, frequency=frequency)
        _hw_pwm[pin_name] = pwm
        return True
    except Exception as e:
        print(f"ERROR:{e}")
        return False

def _hw_pwm_write(pin_name, duty_cycle):
    """Write PWM duty cycle (0.0 to 1.0)"""
    try:
        if pin_name not in _hw_pwm:
            _hw_pwm_setup(pin_name)
        duty = int(duty_cycle * 65535)
        _hw_pwm[pin_name].duty_cycle = duty
        return True
    except Exception as e:
        print(f"ERROR:{e}")
        return False

def _hw_analog_setup(pin_name):
    """Set up analog input"""
    try:
        if pin_name in _hw_analog:
            return True
        pin_obj = getattr(board, pin_name)
        analog = analogio.AnalogIn(pin_obj)
        _hw_analog[pin_name] = analog
        return True
    except Exception as e:
        print(f"ERROR:{e}")
        return False

def _hw_analog_read(pin_name):
    """Read analog value (0.0 to 1.0)"""
    try:
        if pin_name not in _hw_analog:
            _hw_analog_setup(pin_name)
        # Convert to voltage ratio
        voltage = _hw_analog[pin_name].value * 3.3 / 65536
        print(f"ANALOG_VALUE:{pin_name}:{voltage}")
        return voltage
    except Exception as e:
        print(f"ERROR:{e}")
        return 0.0

def _hw_cleanup():
    """Clean up all hardware"""
    try:
        for pin in _hw_pins.values():
            pin.deinit()
        for pwm in _hw_pwm.values():
            pwm.deinit()
        _hw_pins.clear()
        _hw_pwm.clear()
        _hw_analog.clear()
        return True
    except Exception as e:
        print(f"ERROR:{e}")
        return False

# Initialize bridge
_hw_setup()
`;
        
        await this.physicalDevice.execute(setupCode);
        
        // Wait for bridge ready signal
        const response = await this.physicalDevice.waitForResponse('BRIDGE_READY', 5000);
        if (!response) {
            throw new Error('Failed to initialize hardware bridge on physical device');
        }
    }
    
    /**
     * Start command processor
     */
    startCommandProcessor() {
        this.isProcessingCommands = true;
        this.processCommands();
    }
    
    /**
     * Process queued hardware commands
     */
    async processCommands() {
        while (this.isProcessingCommands && this.isConnected) {
            if (this.commandQueue.length > 0) {
                const command = this.commandQueue.shift();
                
                try {
                    await this.executePhysicalCommand(command);
                } catch (error) {
                    this.log(`Command execution failed: ${error.message}`);
                    
                    // Notify command failure
                    if (command.callback) {
                        command.callback(new Error(`Hardware command failed: ${error.message}`));
                    }
                }
            }
            
            // Small delay to prevent busy waiting
            await new Promise(resolve => setTimeout(resolve, 1));
        }
    }
    
    /**
     * Execute command on physical device
     */
    async executePhysicalCommand(command) {
        const { type, pin, value, callback } = command;
        
        switch (type) {
            case 'digital_write':
                await this.physicalDevice.execute(`_hw_digital_write("${pin}", ${value})`);
                if (callback) callback(null, true);
                break;
                
            case 'digital_read':
                await this.physicalDevice.execute(`_hw_digital_read("${pin}")`);
                const digitalValue = await this.physicalDevice.waitForResponse(`DIGITAL_VALUE:${pin}:`);
                const digitalResult = digitalValue ? parseInt(digitalValue.split(':')[2]) : 0;
                if (callback) callback(null, digitalResult);
                break;
                
            case 'pwm_write':
                await this.physicalDevice.execute(`_hw_pwm_write("${pin}", ${value})`);
                if (callback) callback(null, true);
                break;
                
            case 'analog_read':
                await this.physicalDevice.execute(`_hw_analog_read("${pin}")`);
                const analogValue = await this.physicalDevice.waitForResponse(`ANALOG_VALUE:${pin}:`);
                const analogResult = analogValue ? parseFloat(analogValue.split(':')[2]) : 0.0;
                if (callback) callback(null, analogResult);
                break;
                
            default:
                throw new Error(`Unknown command type: ${type}`);
        }
    }
    
    /**
     * Queue hardware command for execution
     */
    queueCommand(type, pin, value = null) {
        return new Promise((resolve, reject) => {
            this.commandQueue.push({
                type,
                pin,
                value,
                callback: (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            });
        });
    }
    
    /**
     * Create hardware abstraction shims for WebAssembly
     */
    createHardwareShims(wasmModule) {
        // Override digitalio functions
        const originalDigitalInOut = wasmModule.digitalio?.DigitalInOut;
        
        if (originalDigitalInOut) {
            wasmModule.digitalio.DigitalInOut = class BridgedDigitalInOut {
                constructor(pin) {
                    this.pin = pin;
                    this._direction = null;
                    this._value = 0;
                }
                
                set direction(dir) {
                    this._direction = dir;
                    // Set up physical pin
                    const dirStr = dir === 'output' ? 'output' : 'input';
                    this.bridge.queueCommand('digital_setup', this.pin.toString(), dirStr);
                }
                
                get direction() {
                    return this._direction;
                }
                
                set value(val) {
                    this._value = val ? 1 : 0;
                    // Send to physical device
                    this.bridge.queueCommand('digital_write', this.pin.toString(), this._value);
                }
                
                get value() {
                    if (this._direction === 'input') {
                        // Read from physical device
                        return this.bridge.queueCommand('digital_read', this.pin.toString());
                    }
                    return this._value;
                }
            };
            
            // Inject bridge reference
            wasmModule.digitalio.DigitalInOut.prototype.bridge = this;
        }
        
        // Override analogio functions
        if (wasmModule.analogio) {
            wasmModule.analogio.AnalogIn = class BridgedAnalogIn {
                constructor(pin) {
                    this.pin = pin;
                    this.bridge.queueCommand('analog_setup', this.pin.toString());
                }
                
                get value() {
                    return this.bridge.queueCommand('analog_read', this.pin.toString());
                }
            };
            
            wasmModule.analogio.AnalogIn.prototype.bridge = this;
        }
        
        // Override pwmio functions  
        if (wasmModule.pwmio) {
            wasmModule.pwmio.PWMOut = class BridgedPWMOut {
                constructor(pin, frequency = 1000) {
                    this.pin = pin;
                    this.frequency = frequency;
                    this._duty_cycle = 0;
                    this.bridge.queueCommand('pwm_setup', this.pin.toString(), frequency);
                }
                
                set duty_cycle(duty) {
                    this._duty_cycle = duty;
                    const dutyCycleRatio = duty / 65535.0;
                    this.bridge.queueCommand('pwm_write', this.pin.toString(), dutyCycleRatio);
                }
                
                get duty_cycle() {
                    return this._duty_cycle;
                }
            };
            
            wasmModule.pwmio.PWMOut.prototype.bridge = this;
        }
        
        this.log('Hardware shims installed');
    }
    
    /**
     * Disconnect from physical device
     */
    async disconnect() {
        this.isProcessingCommands = false;
        this.isConnected = false;
        
        if (this.stateSync) {
            this.stateSync.stop();
        }
        
        // Clean up hardware on physical device
        try {
            await this.physicalDevice.execute('_hw_cleanup()');
        } catch (error) {
            this.log('Cleanup warning:', error.message);
        }
        
        // Disconnect physical device
        if (this.physicalDevice) {
            await this.physicalDevice.disconnect();
            this.physicalDevice = null;
        }
        
        this.connectionType = null;
        this.log('Disconnected from physical device');
    }
    
    /**
     * Get bridge status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            connectionType: this.connectionType,
            queueLength: this.commandQueue.length,
            processingCommands: this.isProcessingCommands,
            bidirectionalSync: this.options.enableBidirectional,
            virtualStates: this.virtualState.size,
            physicalStates: this.physicalState.size
        };
    }
    
    /**
     * Logging utility
     */
    log(...args) {
        if (this.options.enableLogging) {
            console.log('[WASM-U2IF-Bridge]', ...args);
        }
    }
}

/**
 * Bidirectional State Synchronization
 */
class StateSync {
    constructor(bridge) {
        this.bridge = bridge;
        this.syncInterval = null;
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.syncInterval = setInterval(() => {
            this.syncStates();
        }, 100); // 100ms sync interval
        
        this.bridge.log('Bidirectional state sync started');
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.bridge.log('Bidirectional state sync stopped');
    }
    
    async syncStates() {
        // Read sensor inputs from physical device and update virtual state
        // This enables hybrid scenarios like virtual logic + real sensors
        
        try {
            // Example: Read all analog inputs
            const analogPins = ['A0', 'A1', 'A2', 'A3'];
            
            for (const pin of analogPins) {
                const value = await this.bridge.queueCommand('analog_read', pin);
                this.bridge.virtualState.set(`analog_${pin}`, value);
            }
            
            // Read digital inputs
            const inputPins = ['D0', 'D1', 'BUTTON'];
            
            for (const pin of inputPins) {
                const value = await this.bridge.queueCommand('digital_read', pin);
                this.bridge.virtualState.set(`digital_${pin}`, value);
            }
            
        } catch (error) {
            // Sync errors are non-fatal
            this.bridge.log('Sync error:', error.message);
        }
    }
}

/**
 * WebSerial Device Wrapper
 */
class WebSerialDevice {
    constructor(port, options) {
        this.port = port;
        this.options = options;
        this.reader = null;
        this.writer = null;
        this.responseBuffer = '';
        this.responseWaiters = new Map();
    }
    
    async execute(code) {
        if (!this.writer) {
            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();
            this.startReading();
        }
        
        // Send code in raw REPL format
        const codeBytes = new TextEncoder().encode(code + '\r\n');
        await this.writer.write(codeBytes);
    }
    
    async startReading() {
        try {
            while (this.reader) {
                const { value, done } = await this.reader.read();
                if (done) break;
                
                const text = new TextDecoder().decode(value);
                this.responseBuffer += text;
                this.processResponses();
            }
        } catch (error) {
            console.error('WebSerial read error:', error);
        }
    }
    
    processResponses() {
        const lines = this.responseBuffer.split('\n');
        this.responseBuffer = lines.pop() || '';
        
        lines.forEach(line => {
            // Check for waiting responses
            for (const [pattern, resolve] of this.responseWaiters) {
                if (line.includes(pattern)) {
                    this.responseWaiters.delete(pattern);
                    resolve(line.trim());
                    return;
                }
            }
        });
    }
    
    async waitForResponse(pattern, timeout = 5000) {
        return new Promise((resolve) => {
            this.responseWaiters.set(pattern, resolve);
            
            setTimeout(() => {
                if (this.responseWaiters.has(pattern)) {
                    this.responseWaiters.delete(pattern);
                    resolve(null);
                }
            }, timeout);
        });
    }
    
    async disconnect() {
        if (this.reader) {
            await this.reader.cancel();
            this.reader.releaseLock();
            this.reader = null;
        }
        
        if (this.writer) {
            await this.writer.close();
            this.writer = null;
        }
        
        await this.port.close();
    }
}

/**
 * WebUSB Device Wrapper
 */
class WebUSBDevice {
    constructor(device, options) {
        this.device = device;
        this.options = options;
    }
    
    async execute(code) {
        // Implementation would depend on specific USB protocol
        // This is a placeholder for WebUSB implementation
        throw new Error('WebUSB execution not implemented yet');
    }
    
    async waitForResponse(pattern, timeout) {
        // Placeholder
        return null;
    }
    
    async disconnect() {
        await this.device.close();
    }
}

export default WebAssemblyU2IFBridge;