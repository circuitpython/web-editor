/**
 * Example JavaScript Pin Backend for CircuitPython WebAssembly Unport
 * 
 * This shows how to implement JavaScript-backed CircuitPython I/O interfaces.
 * This enables web-based hardware simulation, GPIO over WebUSB, or any custom JS backend.
 */

const { loadCircuitPython } = require('./api.js');

// Example JavaScript Pin class that simulates hardware
class VirtualPin {
    constructor(name, number, capabilities) {
        this.name = name;
        this.number = number;
        this.capabilities = capabilities;
        this.digitalInOut = null;
        
        console.log(`Created virtual pin ${name} (#${number}) with capabilities:`, this._capabilitiesToString(capabilities));
    }
    
    // Required by digitalio - create a DigitalInOut interface for this pin
    createDigitalInOut() {
        if (this.digitalInOut) {
            throw new Error(`Pin ${this.name} already has an active DigitalInOut`);
        }
        
        this.digitalInOut = new VirtualDigitalInOut(this);
        console.log(`Created DigitalInOut for pin ${this.name}`);
        
        // Return a unique reference ID (in real implementation, you'd use a reference manager)
        return Math.floor(Math.random() * 1000000);
    }
    
    _capabilitiesToString(caps) {
        const names = [];
        if (caps & (1 << 0)) names.push('digital_io');
        if (caps & (1 << 1)) names.push('analog_in'); 
        if (caps & (1 << 2)) names.push('analog_out');
        if (caps & (1 << 3)) names.push('pwm');
        if (caps & (1 << 4)) names.push('spi');
        if (caps & (1 << 5)) names.push('i2c');
        if (caps & (1 << 6)) names.push('uart');
        return names.join(', ');
    }
}

// JavaScript implementation of DigitalInOut functionality
class VirtualDigitalInOut {
    constructor(pin) {
        this.pin = pin;
        this.direction = 0; // INPUT
        this.value = false;
        this.pull = 0; // NONE
        this.driveMode = 0; // PUSH_PULL
        
        console.log(`VirtualDigitalInOut created for ${pin.name}`);
    }
    
    deinit() {
        console.log(`VirtualDigitalInOut deinit for ${this.pin.name}`);
        this.pin.digitalInOut = null;
    }
    
    switchToInput(pull) {
        this.direction = 0; // INPUT
        this.pull = pull;
        console.log(`Pin ${this.pin.name}: switch to input, pull=${this._pullToString(pull)}`);
    }
    
    switchToOutput(value, driveMode) {
        this.direction = 1; // OUTPUT
        this.value = value;
        this.driveMode = driveMode;
        console.log(`Pin ${this.pin.name}: switch to output, value=${value}, driveMode=${this._driveModeToString(driveMode)}`);
        
        // Simulate hardware: blink LED if this is the LED pin
        if (this.pin.name === 'LED' && value) {
            this._simulateHardware();
        }
    }
    
    setValue(value) {
        if (this.direction !== 1) {
            throw new Error(`Pin ${this.pin.name} is not configured as output`);
        }
        
        const oldValue = this.value;
        this.value = value;
        console.log(`Pin ${this.pin.name}: set value ${oldValue} -> ${value}`);
        
        if (this.pin.name === 'LED') {
            this._simulateHardware();
        }
    }
    
    setPull(pull) {
        this.pull = pull;
        console.log(`Pin ${this.pin.name}: set pull to ${this._pullToString(pull)}`);
    }
    
    setDriveMode(driveMode) {
        this.driveMode = driveMode;
        console.log(`Pin ${this.pin.name}: set drive mode to ${this._driveModeToString(driveMode)}`);
    }
    
    _pullToString(pull) {
        return ['NONE', 'UP', 'DOWN'][pull] || 'UNKNOWN';
    }
    
    _driveModeToString(driveMode) {
        return ['PUSH_PULL', 'OPEN_DRAIN'][driveMode] || 'UNKNOWN';
    }
    
    _simulateHardware() {
        // Simulate LED behavior in console
        if (this.value) {
            console.log(`💡 LED ON  (Pin ${this.pin.name})`);
        } else {
            console.log(`💡 LED OFF (Pin ${this.pin.name})`);
        }
    }
}

// Example board configuration
const boardConfig = {
    // Board identification
    name: "Virtual Development Board",
    
    // Define available pins with their capabilities
    pins: [
        {
            name: "LED",
            number: 13,
            capabilities: ['digital_io', 'pwm'], // LED can be digital output or PWM
        },
        {
            name: "BUTTON", 
            number: 0,
            capabilities: ['digital_io'], // Button is digital input only
        },
        {
            name: "A0",
            number: 14, 
            capabilities: ['digital_io', 'analog_in'], // Analog input pin
        },
        {
            name: "SDA",
            number: 21,
            capabilities: ['digital_io', 'i2c'], // I2C data
        },
        {
            name: "SCL", 
            number: 22,
            capabilities: ['digital_io', 'i2c'], // I2C clock
        }
    ],
    
    // Board initialization function (called by board.init())
    init() {
        console.log("🚀 Virtual board initialized!");
    },
    
    // Board cleanup function (called by board.deinit())
    deinit() {
        console.log("🛑 Virtual board deinitialized!");
    },
    
    // Safe mode check (called by board.requests_safe_mode())
    requestsSafeMode() {
        return false; // Never request safe mode for virtual board
    }
};

async function demonstrateJavaScriptBackedIO() {
    console.log("=== CircuitPython JavaScript-Backed I/O Demo ===\n");
    
    // Load CircuitPython with our virtual board configuration
    const circuitPython = await loadCircuitPython({
        heapsize: 256 * 1024,
        stdout: (data) => process.stdout.write(data),
        boardConfiguration: boardConfig
    });
    
    console.log("\n=== Testing Python digitalio with JavaScript backend ===\n");
    
    // Test the digitalio module with JavaScript backend
    const testCode = `
import board
import digitalio
import time

print("Available pins:", dir(board))

# Create a DigitalInOut for the LED
led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

print("Blinking LED...")
for i in range(3):
    led.value = True
    time.sleep(0.5)
    led.value = False  
    time.sleep(0.5)

print("LED control complete!")

# Test input with pull-up
button = digitalio.DigitalInOut(board.BUTTON)  
button.direction = digitalio.Direction.INPUT
button.pull = digitalio.Pull.UP

print(f"Button value: {button.value}")

# Cleanup
led.deinit()
button.deinit()
print("Demo complete!")
    `;
    
    try {
        circuitPython.runPython(testCode);
    } catch (error) {
        console.error("Python execution error:", error.message);
    }
}

// Run the demonstration
if (require.main === module) {
    demonstrateJavaScriptBackedIO().catch(console.error);
}

module.exports = { VirtualPin, VirtualDigitalInOut, boardConfig };