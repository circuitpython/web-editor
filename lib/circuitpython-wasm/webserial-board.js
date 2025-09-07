/**
 * WebSerial Board Bridge
 * 
 * Connects to CircuitPython devices via WebSerial API
 * Enables direct communication with CircuitPython REPL for hardware control
 */

export class WebSerialBoard {
    constructor(port) {
        this.port = port;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.responseBuffer = '';
        this.pendingResponses = new Map();
        this.commandId = 0;
        
        // Pin management
        this.pinCache = new Map(); // Cache pin objects to avoid recreating
        this.initialized = false;
    }
    
    /**
     * Connect to a CircuitPython device via WebSerial
     */
    static async connect() {
        // Request serial port from user
        const port = await navigator.serial.requestPort({
            filters: [
                { usbVendorId: 0x239A }, // Adafruit
                { usbVendorId: 0x2E8A }, // Raspberry Pi Foundation
            ]
        });
        
        // Open the port
        await port.open({ 
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });
        
        const board = new WebSerialBoard(port);
        await board.initialize();
        return board;
    }
    
    /**
     * Initialize the connection and set up CircuitPython environment
     */
    async initialize() {
        // Set up reader and writer
        this.reader = this.port.readable.getReader();
        this.writer = this.port.writable.getWriter();
        this.isConnected = true;
        
        // Start reading responses
        this.startReading();
        
        // Wait a moment for any existing output
        await this.delay(100);
        
        // Clear any existing output
        await this.clearBuffer();
        
        // Interrupt any running code
        await this.sendCtrlC();
        
        // Switch to raw REPL mode for reliable communication
        await this.enterRawRepl();
        
        // Set up our hardware abstraction layer
        await this.setupHardwareLayer();
        
        this.initialized = true;
        console.log('WebSerial CircuitPython board initialized');
    }
    
    /**
     * Start reading from the serial port
     */
    async startReading() {
        try {
            while (this.isConnected && this.reader) {
                const { value, done } = await this.reader.read();
                if (done) break;
                
                // Convert bytes to string
                const text = new TextDecoder().decode(value);
                this.responseBuffer += text;
                
                // Process complete responses (ended with specific markers)
                this.processResponses();
            }
        } catch (error) {
            console.error('WebSerial read error:', error);
            this.isConnected = false;
        }
    }
    
    /**
     * Process accumulated responses
     */
    processResponses() {
        // In raw REPL mode, responses end with \x04 (EOT)
        const responses = this.responseBuffer.split('\x04');
        this.responseBuffer = responses.pop(); // Keep incomplete response
        
        responses.forEach(response => {
            if (response.trim()) {
                this.handleResponse(response);
            }
        });
    }
    
    /**
     * Handle a complete response
     */
    handleResponse(response) {
        // Check for error responses (start with 'Traceback')
        if (response.includes('Traceback')) {
            console.error('CircuitPython error:', response);
        }
        
        // Resolve any pending command promises
        // For simplicity, we'll resolve the oldest pending command
        const [commandId, resolver] = this.pendingResponses.entries().next().value || [];
        if (resolver) {
            this.pendingResponses.delete(commandId);
            resolver.resolve(response);
        }
    }
    
    /**
     * Send data to the device
     */
    async send(data) {
        if (!this.writer) throw new Error('WebSerial writer not available');
        
        if (typeof data === 'string') {
            data = new TextEncoder().encode(data);
        }
        
        await this.writer.write(data);
    }
    
    /**
     * Execute Python code and wait for response
     */
    async executeCode(code, timeout = 5000) {
        if (!this.initialized) {
            throw new Error('WebSerial board not initialized');
        }
        
        const commandId = this.commandId++;
        
        return new Promise(async (resolve, reject) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.pendingResponses.delete(commandId);
                reject(new Error('Command timeout'));
            }, timeout);
            
            // Store resolver
            this.pendingResponses.set(commandId, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
            
            try {
                // Send the code
                await this.send(code + '\x04'); // End with EOT to execute
            } catch (error) {
                clearTimeout(timeoutId);
                this.pendingResponses.delete(commandId);
                reject(error);
            }
        });
    }
    
    /**
     * Clear the response buffer
     */
    async clearBuffer() {
        this.responseBuffer = '';
        // Send some newlines and wait
        await this.send('\r\n\r\n');
        await this.delay(100);
    }
    
    /**
     * Send Ctrl+C to interrupt
     */
    async sendCtrlC() {
        await this.send(new Uint8Array([0x03])); // Ctrl+C
        await this.delay(100);
    }
    
    /**
     * Enter raw REPL mode
     */
    async enterRawRepl() {
        await this.send(new Uint8Array([0x01])); // Ctrl+A for raw REPL
        await this.delay(200);
        
        // Clear any response
        this.responseBuffer = '';
    }
    
    /**
     * Set up hardware abstraction layer in CircuitPython
     */
    async setupHardwareLayer() {
        const setupCode = `
# Hardware abstraction for WebSerial bridge
import board
import digitalio
import analogio
import time
import gc

# Pin management
_pins = {}
_pin_directions = {}

def _setup_digital_pin(pin_name, direction='output'):
    """Set up a digital pin with specified direction"""
    try:
        if pin_name in _pins:
            _pins[pin_name].deinit()
        
        pin_obj = getattr(board, pin_name)
        dio = digitalio.DigitalInOut(pin_obj)
        
        if direction == 'output':
            dio.direction = digitalio.Direction.OUTPUT
        else:
            dio.direction = digitalio.Direction.INPUT
            dio.pull = digitalio.Pull.UP
            
        _pins[pin_name] = dio
        _pin_directions[pin_name] = direction
        return True
    except Exception as e:
        print(f"Error setting up pin {pin_name}: {e}")
        return False

def _set_pin(pin_name, value):
    """Set digital pin value"""
    try:
        if pin_name not in _pins:
            _setup_digital_pin(pin_name, 'output')
        
        if _pin_directions.get(pin_name) != 'output':
            _setup_digital_pin(pin_name, 'output')
            
        _pins[pin_name].value = bool(value)
        return True
    except Exception as e:
        print(f"Error setting pin {pin_name}: {e}")
        return False

def _get_pin(pin_name):
    """Get digital pin value"""
    try:
        if pin_name not in _pins:
            _setup_digital_pin(pin_name, 'input')
        
        if _pin_directions.get(pin_name) != 'input':
            _setup_digital_pin(pin_name, 'input')
            
        return int(_pins[pin_name].value)
    except Exception as e:
        print(f"Error reading pin {pin_name}: {e}")
        return 0

def _set_pin_analog(pin_name, value):
    """Set analog output (PWM) - simplified for demo"""
    try:
        # This would need PWMOut for real analog output
        # For now, treat as digital threshold
        _set_pin(pin_name, value > 0.5)
        return True
    except Exception as e:
        print(f"Error setting analog pin {pin_name}: {e}")
        return False

def _get_pin_analog(pin_name):
    """Get analog input value"""
    try:
        if pin_name not in _pins:
            pin_obj = getattr(board, pin_name)
            _pins[pin_name] = analogio.AnalogIn(pin_obj)
            _pin_directions[pin_name] = 'analog_in'
        
        # Return voltage as 0-1 value
        voltage = _pins[pin_name].value * 3.3 / 65536
        return voltage
    except Exception as e:
        print(f"Error reading analog pin {pin_name}: {e}")
        return 0.0

def _list_pins():
    """List available pins"""
    try:
        pins = [attr for attr in dir(board) if not attr.startswith('_')]
        return pins
    except Exception as e:
        print(f"Error listing pins: {e}")
        return []

def _cleanup_pins():
    """Clean up all pins"""
    try:
        for pin in _pins.values():
            pin.deinit()
        _pins.clear()
        _pin_directions.clear()
        gc.collect()
        return True
    except Exception as e:
        print(f"Error cleaning up pins: {e}")
        return False

# Set up is complete
print("WebSerial hardware layer ready")
`;
        
        try {
            const response = await this.executeCode(setupCode);
            if (response.includes('hardware layer ready')) {
                console.log('Hardware layer initialized successfully');
            } else {
                console.warn('Hardware layer setup response:', response);
            }
        } catch (error) {
            console.error('Failed to set up hardware layer:', error);
            throw error;
        }
    }
    
    /**
     * Set digital pin value
     */
    async setPin(pinId, value) {
        const code = `print("RESULT:", _set_pin("${pinId}", ${value ? 1 : 0}))`;
        const response = await this.executeCode(code);
        return response.includes('RESULT: True');
    }
    
    /**
     * Read digital pin value
     */
    async readPin(pinId) {
        const code = `print("RESULT:", _get_pin("${pinId}"))`;
        const response = await this.executeCode(code);
        
        // Parse the result
        const match = response.match(/RESULT:\s*(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }
    
    /**
     * Set analog pin value (PWM)
     */
    async setPinAnalog(pinId, value) {
        const code = `print("RESULT:", _set_pin_analog("${pinId}", ${value}))`;
        const response = await this.executeCode(code);
        return response.includes('RESULT: True');
    }
    
    /**
     * Read analog pin value
     */
    async readPinAnalog(pinId) {
        const code = `print("RESULT:", _get_pin_analog("${pinId}"))`;
        const response = await this.executeCode(code);
        
        // Parse the result
        const match = response.match(/RESULT:\s*([\d.]+)/);
        return match ? parseFloat(match[1]) : 0.0;
    }
    
    /**
     * List available pins
     */
    async listPins() {
        const code = `print("PINS:", _list_pins())`;
        const response = await this.executeCode(code);
        
        try {
            const match = response.match(/PINS:\s*(\[.*\])/);
            if (match) {
                return JSON.parse(match[1].replace(/'/g, '"'));
            }
        } catch (e) {
            console.error('Failed to parse pin list:', e);
        }
        
        return [];
    }
    
    /**
     * Get board information
     */
    async getBoardInfo() {
        const code = `
import sys
import os
print("BOARD_INFO:", {
    "platform": sys.platform,
    "implementation": sys.implementation.name,
    "version": ".".join(map(str, sys.version_info[:3])),
    "board_id": getattr(board, "board_id", "unknown") if 'board' in dir() else "unknown"
})
`;
        
        try {
            const response = await this.executeCode(code);
            const match = response.match(/BOARD_INFO:\s*({.*})/);
            if (match) {
                return JSON.parse(match[1].replace(/'/g, '"'));
            }
        } catch (e) {
            console.error('Failed to get board info:', e);
        }
        
        return { platform: 'unknown', implementation: 'unknown', version: 'unknown' };
    }
    
    /**
     * Execute arbitrary Python code
     */
    async runCode(code) {
        return await this.executeCode(code);
    }
    
    /**
     * Disconnect from the board
     */
    async disconnect() {
        this.isConnected = false;
        
        try {
            // Clean up pins on the device
            await this.executeCode('_cleanup_pins()');
        } catch (e) {
            // Ignore cleanup errors during disconnect
        }
        
        // Release reader and writer
        if (this.reader) {
            await this.reader.cancel();
            this.reader.releaseLock();
            this.reader = null;
        }
        
        if (this.writer) {
            await this.writer.close();
            this.writer = null;
        }
        
        // Close the port
        if (this.port) {
            await this.port.close();
        }
        
        console.log('WebSerial board disconnected');
    }
    
    /**
     * Utility: delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default WebSerialBoard;