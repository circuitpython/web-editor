/**
 * U2IF Board Bridge
 * 
 * Connects to U2IF (USB to interfaces) firmware
 * Provides direct hardware access via USB for CircuitPython learning
 * 
 * Based on Adafruit's U2IF implementation:
 * https://github.com/adafruit/u2if
 */

export class U2IFBoard {
    constructor(device) {
        this.device = device;
        this.isConnected = false;
        this.pinModes = new Map(); // Track pin configurations
        this.interfaceNumber = 0;
        
        // U2IF command constants
        this.CMD = {
            GPIO_CONFIG: 0x01,
            GPIO_WRITE: 0x02, 
            GPIO_READ: 0x03,
            PWM_CONFIG: 0x04,
            PWM_WRITE: 0x05,
            ADC_CONFIG: 0x06,
            ADC_READ: 0x07,
            I2C_CONFIG: 0x08,
            I2C_WRITE: 0x09,
            I2C_READ: 0x0A,
            SPI_CONFIG: 0x0B,
            SPI_WRITE: 0x0C,
            SPI_READ: 0x0D,
            NEOPIXEL_WRITE: 0x0E,
            BOARD_INFO: 0x0F
        };
    }
    
    /**
     * Connect to U2IF device via WebUSB
     */
    static async connect() {
        // Request USB device with U2IF-compatible firmware
        const device = await navigator.usb.requestDevice({
            filters: [
                { vendorId: 0x239A, productId: 0x0049 }, // Adafruit Pi Pico w/ U2IF
                { vendorId: 0x239A, productId: 0x80F1 }, // Adafruit KB2040 w/ U2IF
                { vendorId: 0x2E8A, productId: 0x0049 }, // Raspberry Pi Pico w/ U2IF
            ]
        });
        
        // Open device and claim interface
        await device.open();
        
        // Usually interface 0 for U2IF
        const interfaceNumber = 0;
        await device.selectConfiguration(1);
        await device.claimInterface(interfaceNumber);
        
        const board = new U2IFBoard(device);
        board.interfaceNumber = interfaceNumber;
        await board.initialize();
        return board;
    }
    
    /**
     * Initialize the U2IF board
     */
    async initialize() {
        this.isConnected = true;
        
        // Get board information
        try {
            const boardInfo = await this.getBoardInfo();
            console.log('U2IF Board Info:', boardInfo);
        } catch (error) {
            console.warn('Could not get board info:', error);
        }
        
        console.log('U2IF board initialized');
    }
    
    /**
     * Send command to U2IF device
     */
    async sendCommand(command, data = new Uint8Array(0)) {
        // U2IF uses endpoint 1 for commands (OUT)
        const endpointOut = 1;
        
        // Construct command packet: [command, ...data]
        const packet = new Uint8Array([command, ...data]);
        
        try {
            const result = await this.device.transferOut(endpointOut, packet);
            if (result.status !== 'ok') {
                throw new Error(`USB transfer failed: ${result.status}`);
            }
            return result;
        } catch (error) {
            console.error('U2IF command failed:', error);
            throw error;
        }
    }
    
    /**
     * Read response from U2IF device
     */
    async readResponse(expectedLength = 64) {
        // U2IF uses endpoint 1 for responses (IN)
        const endpointIn = 0x81;
        
        try {
            const result = await this.device.transferIn(endpointIn, expectedLength);
            if (result.status !== 'ok') {
                throw new Error(`USB read failed: ${result.status}`);
            }
            return new Uint8Array(result.data.buffer);
        } catch (error) {
            console.error('U2IF read failed:', error);
            throw error;
        }
    }
    
    /**
     * Configure GPIO pin
     */
    async configurePin(pinNumber, mode, pull = 'none') {
        const modeMap = {
            'input': 0x00,
            'output': 0x01,
            'output_od': 0x02  // Open drain
        };
        
        const pullMap = {
            'none': 0x00,
            'up': 0x01,
            'down': 0x02
        };
        
        const modeValue = modeMap[mode] || 0x01;
        const pullValue = pullMap[pull] || 0x00;
        
        const data = new Uint8Array([
            pinNumber,     // Pin number
            modeValue,     // Mode
            pullValue      // Pull resistor
        ]);
        
        await this.sendCommand(this.CMD.GPIO_CONFIG, data);
        this.pinModes.set(pinNumber, { mode, pull });
    }
    
    /**
     * Set digital pin value
     */
    async setPin(pinId, value) {
        const pinNumber = this.parsePinId(pinId);
        
        // Ensure pin is configured as output
        if (!this.pinModes.has(pinNumber) || this.pinModes.get(pinNumber).mode !== 'output') {
            await this.configurePin(pinNumber, 'output');
        }
        
        const data = new Uint8Array([
            pinNumber,           // Pin number
            value ? 0x01 : 0x00  // Value (0 or 1)
        ]);
        
        await this.sendCommand(this.CMD.GPIO_WRITE, data);
    }
    
    /**
     * Read digital pin value
     */
    async readPin(pinId) {
        const pinNumber = this.parsePinId(pinId);
        
        // Ensure pin is configured as input
        if (!this.pinModes.has(pinNumber) || this.pinModes.get(pinNumber).mode !== 'input') {
            await this.configurePin(pinNumber, 'input', 'up');
        }
        
        const data = new Uint8Array([pinNumber]);
        await this.sendCommand(this.CMD.GPIO_READ, data);
        
        const response = await this.readResponse(4);
        return response[1]; // Pin value is in byte 1
    }
    
    /**
     * Configure PWM on a pin
     */
    async configurePWM(pinId, frequency = 1000) {
        const pinNumber = this.parsePinId(pinId);
        
        // Convert frequency to bytes (little endian)
        const freqBytes = new Uint8Array(4);
        new DataView(freqBytes.buffer).setUint32(0, frequency, true);
        
        const data = new Uint8Array([
            pinNumber,
            ...freqBytes  // Frequency as 32-bit little endian
        ]);
        
        await this.sendCommand(this.CMD.PWM_CONFIG, data);
    }
    
    /**
     * Set PWM duty cycle (0.0 to 1.0)
     */
    async setPWM(pinId, dutyCycle) {
        const pinNumber = this.parsePinId(pinId);
        
        // Convert duty cycle to 16-bit value (0-65535)
        const dutyValue = Math.round(dutyCycle * 65535);
        const dutyBytes = new Uint8Array(2);
        new DataView(dutyBytes.buffer).setUint16(0, dutyValue, true);
        
        const data = new Uint8Array([
            pinNumber,
            ...dutyBytes  // Duty cycle as 16-bit little endian
        ]);
        
        await this.sendCommand(this.CMD.PWM_WRITE, data);
    }
    
    /**
     * Configure ADC on a pin
     */
    async configureADC(pinId, resolution = 12) {
        const pinNumber = this.parsePinId(pinId);
        
        const data = new Uint8Array([
            pinNumber,  // Pin number
            resolution  // ADC resolution (bits)
        ]);
        
        await this.sendCommand(this.CMD.ADC_CONFIG, data);
    }
    
    /**
     * Read analog value (0.0 to 1.0)
     */
    async readAnalog(pinId) {
        const pinNumber = this.parsePinId(pinId);
        
        // Ensure ADC is configured
        await this.configureADC(pinId);
        
        const data = new Uint8Array([pinNumber]);
        await this.sendCommand(this.CMD.ADC_READ, data);
        
        const response = await this.readResponse(8);
        
        // ADC value is returned as 16-bit little endian
        const adcValue = new DataView(response.buffer).getUint16(1, true);
        
        // Convert to 0.0-1.0 range (assuming 12-bit ADC)
        return adcValue / 4095.0;
    }
    
    /**
     * Configure I2C interface
     */
    async configureI2C(scl_pin, sda_pin, frequency = 100000) {
        const sclNumber = this.parsePinId(scl_pin);
        const sdaNumber = this.parsePinId(sda_pin);
        
        const freqBytes = new Uint8Array(4);
        new DataView(freqBytes.buffer).setUint32(0, frequency, true);
        
        const data = new Uint8Array([
            sclNumber,    // SCL pin
            sdaNumber,    // SDA pin
            ...freqBytes  // Frequency
        ]);
        
        await this.sendCommand(this.CMD.I2C_CONFIG, data);
    }
    
    /**
     * Write to I2C device
     */
    async writeI2C(address, data) {
        const writeData = new Uint8Array([
            address,      // I2C address
            data.length,  // Data length
            ...data       // Data bytes
        ]);
        
        await this.sendCommand(this.CMD.I2C_WRITE, writeData);
    }
    
    /**
     * Read from I2C device
     */
    async readI2C(address, length) {
        const data = new Uint8Array([
            address,  // I2C address
            length    // Number of bytes to read
        ]);
        
        await this.sendCommand(this.CMD.I2C_READ, data);
        
        const response = await this.readResponse(length + 2);
        return response.slice(2, 2 + length); // Skip status bytes
    }
    
    /**
     * Control NeoPixels
     */
    async setNeoPixel(pinId, pixelData) {
        const pinNumber = this.parsePinId(pinId);
        const numPixels = pixelData.length / 3; // Assuming RGB format
        
        const data = new Uint8Array([
            pinNumber,
            numPixels,
            ...pixelData  // RGB data for each pixel
        ]);
        
        await this.sendCommand(this.CMD.NEOPIXEL_WRITE, data);
    }
    
    /**
     * Get board information
     */
    async getBoardInfo() {
        await this.sendCommand(this.CMD.BOARD_INFO);
        
        const response = await this.readResponse(32);
        const decoder = new TextDecoder();
        
        // Parse the response (format may vary by implementation)
        return {
            firmware: 'U2IF',
            version: `${response[0]}.${response[1]}.${response[2]}`,
            board: decoder.decode(response.slice(4, 20)).replace(/\0/g, ''),
            pins: response[3]  // Number of available pins
        };
    }
    
    /**
     * Parse pin identifier to pin number
     */
    parsePinId(pinId) {
        // Handle different pin naming conventions
        if (typeof pinId === 'number') {
            return pinId;
        }
        
        if (typeof pinId === 'string') {
            // Handle GPIO pin names like 'GP0', 'GPIO0', 'D0', etc.
            const match = pinId.match(/(?:GP|GPIO|D|A)?(\d+)/i);
            if (match) {
                return parseInt(match[1]);
            }
            
            // Handle special pins
            const specialPins = {
                'LED': 25,        // Common LED pin for Pico
                'BUTTON': 23,     // Common button pin
                'NEOPIXEL': 16    // Common NeoPixel pin
            };
            
            if (specialPins[pinId.toUpperCase()]) {
                return specialPins[pinId.toUpperCase()];
            }
        }
        
        throw new Error(`Invalid pin identifier: ${pinId}`);
    }
    
    /**
     * List available pins (based on board type)
     */
    async listPins() {
        try {
            const boardInfo = await this.getBoardInfo();
            const numPins = boardInfo.pins || 30; // Default assumption
            
            // Generate pin list based on common naming
            const pins = [];
            for (let i = 0; i < numPins; i++) {
                pins.push(`GP${i}`);
            }
            
            // Add special pins
            pins.push('LED', 'BUTTON', 'NEOPIXEL');
            
            return pins;
        } catch (error) {
            // Return default pin list
            const defaultPins = [];
            for (let i = 0; i < 30; i++) {
                defaultPins.push(`GP${i}`);
            }
            return defaultPins;
        }
    }
    
    /**
     * Disconnect from the board
     */
    async disconnect() {
        this.isConnected = false;
        
        // Reset all pins to input mode
        try {
            for (const [pinNumber] of this.pinModes) {
                await this.configurePin(pinNumber, 'input', 'none');
            }
        } catch (error) {
            console.warn('Error resetting pins during disconnect:', error);
        }
        
        // Release USB interface and close device
        try {
            await this.device.releaseInterface(this.interfaceNumber);
            await this.device.close();
        } catch (error) {
            console.warn('Error closing USB device:', error);
        }
        
        console.log('U2IF board disconnected');
    }
}

export default U2IFBoard;