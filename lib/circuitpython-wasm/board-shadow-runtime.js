/**
 * Board Shadow Runtime - Hardware State Reflection System
 * 
 * Maintains synchronized state between:
 * - Physical hardware (via WebUSB/WebSerial)
 * - Virtual simulation
 * - CircuitPython WASM code execution
 */

export class BoardShadowRuntime {
    constructor(options = {}) {
        this.options = {
            boardType: 'generic',
            syncInterval: 100,      // ms between sync operations
            enableLogging: true,
            maxHistorySize: 1000,
            ...options
        };
        
        // Hardware connections
        this.physicalBoard = null;
        this.virtualBoard = null;
        
        // State management
        this.shadowState = new Map();    // Unified pin/peripheral state
        this.stateHistory = [];          // Change history for debugging
        this.watchedPins = new Set();    // Pins being monitored
        this.listeners = new Map();      // Event listeners
        
        // Sync control
        this.syncMode = 'virtual';       // 'physical', 'virtual', 'hybrid'
        this.syncInterval = null;
        this.lastSync = Date.now();
        
        // Initialize virtual board immediately
        this.initializeVirtualBoard();
    }
    
    /**
     * Initialize virtual board simulation
     */
    initializeVirtualBoard() {
        this.virtualBoard = new VirtualBoard(this.options.boardType);
        this.virtualBoard.onPinChange = (pinId, value, source) => {
            this.updateShadowState(pinId, value, 'virtual');
        };
        
        this.log('Virtual board initialized');
    }
    
    /**
     * Attempt to connect to physical hardware
     */
    async connectPhysicalBoard() {
        this.log('Attempting to connect to physical hardware...');
        
        // Try U2IF (USB-to-Interface) first
        try {
            this.physicalBoard = await U2IFBoard.connect();
            this.syncMode = 'hybrid';
            this.startSyncLoop();
            this.log('Connected via U2IF');
            return 'u2if';
        } catch (error) {
            this.log('U2IF connection failed:', error.message);
        }
        
        // Try WebSerial (CircuitPython REPL)
        try {
            this.physicalBoard = await WebSerialBoard.connect();
            this.syncMode = 'hybrid';
            this.startSyncLoop();
            this.log('Connected via WebSerial');
            return 'webserial';
        } catch (error) {
            this.log('WebSerial connection failed:', error.message);
        }
        
        // Try WebUSB (generic USB device)
        try {
            this.physicalBoard = await WebUSBBoard.connect();
            this.syncMode = 'hybrid';
            this.startSyncLoop();
            this.log('Connected via WebUSB');
            return 'webusb';
        } catch (error) {
            this.log('WebUSB connection failed:', error.message);
        }
        
        // No physical hardware available
        this.syncMode = 'virtual';
        this.log('No physical hardware found, using virtual mode');
        return 'virtual';
    }
    
    /**
     * Update shadow state and propagate changes
     */
    updateShadowState(pinId, value, source = 'code') {
        const oldState = this.shadowState.get(pinId);
        const newState = {
            value,
            source,
            timestamp: Date.now(),
            previous: oldState?.value
        };
        
        this.shadowState.set(pinId, newState);
        
        // Record in history
        this.stateHistory.push({
            pin: pinId,
            ...newState
        });
        
        // Trim history if too large
        if (this.stateHistory.length > this.options.maxHistorySize) {
            this.stateHistory.splice(0, 100); // Remove oldest 100 entries
        }
        
        // Propagate to other systems
        this.propagateChange(pinId, value, source);
        
        // Notify listeners
        this.notifyListeners(pinId, value, source);
        
        this.log(`Pin ${pinId} changed to ${value} (source: ${source})`);
    }
    
    /**
     * Propagate pin changes to other systems
     */
    async propagateChange(pinId, value, source) {
        // Don't create loops - if change came from physical, don't send back
        if (source !== 'physical' && this.physicalBoard && this.syncMode === 'hybrid') {
            try {
                await this.physicalBoard.setPin(pinId, value);
            } catch (error) {
                this.log(`Failed to sync pin ${pinId} to physical board:`, error.message);
            }
        }
        
        // Always update virtual representation
        if (this.virtualBoard && source !== 'virtual') {
            this.virtualBoard.setPin(pinId, value);
        }
    }
    
    /**
     * Read pin value from shadow state
     */
    getPin(pinId) {
        const state = this.shadowState.get(pinId);
        return state ? state.value : 0;
    }
    
    /**
     * Set pin value (from CircuitPython code)
     */
    async setPin(pinId, value) {
        this.updateShadowState(pinId, value, 'code');
    }
    
    /**
     * Start synchronization loop for physical hardware
     */
    startSyncLoop() {
        if (this.syncInterval) return; // Already running
        
        this.syncInterval = setInterval(() => {
            this.syncFromPhysical();
        }, this.options.syncInterval);
    }
    
    /**
     * Stop synchronization loop
     */
    stopSyncLoop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    /**
     * Sync state from physical hardware
     */
    async syncFromPhysical() {
        if (!this.physicalBoard) return;
        
        try {
            // Read watched pins from physical hardware
            for (const pinId of this.watchedPins) {
                const physicalValue = await this.physicalBoard.readPin(pinId);
                const shadowValue = this.getPin(pinId);
                
                // Update if different
                if (physicalValue !== shadowValue) {
                    this.updateShadowState(pinId, physicalValue, 'physical');
                }
            }
            
            this.lastSync = Date.now();
        } catch (error) {
            this.log('Sync error:', error.message);
            // Consider disconnecting if too many errors
        }
    }
    
    /**
     * Watch a pin for changes
     */
    watchPin(pinId) {
        this.watchedPins.add(pinId);
        this.log(`Now watching pin ${pinId}`);
    }
    
    /**
     * Stop watching a pin
     */
    unwatchPin(pinId) {
        this.watchedPins.delete(pinId);
        this.log(`Stopped watching pin ${pinId}`);
    }
    
    /**
     * Add event listener for pin changes
     */
    addPinListener(pinId, callback) {
        if (!this.listeners.has(pinId)) {
            this.listeners.set(pinId, []);
        }
        this.listeners.get(pinId).push(callback);
    }
    
    /**
     * Remove event listener
     */
    removePinListener(pinId, callback) {
        const listeners = this.listeners.get(pinId);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }
    
    /**
     * Notify all listeners of pin change
     */
    notifyListeners(pinId, value, source) {
        const listeners = this.listeners.get(pinId);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(value, source);
                } catch (error) {
                    this.log('Listener error:', error.message);
                }
            });
        }
    }
    
    /**
     * Get pin change history
     */
    getPinHistory(pinId, timeRange = 5000) {
        const cutoff = Date.now() - timeRange;
        return this.stateHistory
            .filter(entry => entry.pin === pinId && entry.timestamp > cutoff)
            .sort((a, b) => b.timestamp - a.timestamp);
    }
    
    /**
     * Get current hardware status
     */
    getHardwareStatus() {
        return {
            syncMode: this.syncMode,
            physicalBoard: this.physicalBoard ? this.physicalBoard.constructor.name : null,
            virtualBoard: this.virtualBoard ? 'Available' : 'Not initialized',
            watchedPins: Array.from(this.watchedPins),
            totalPins: this.shadowState.size,
            lastSync: this.lastSync,
            syncInterval: this.options.syncInterval
        };
    }
    
    /**
     * Export current state for debugging
     */
    exportState() {
        const pinStates = {};
        for (const [pinId, state] of this.shadowState.entries()) {
            pinStates[pinId] = {
                value: state.value,
                source: state.source,
                timestamp: state.timestamp
            };
        }
        
        return {
            hardware: this.getHardwareStatus(),
            pins: pinStates,
            history: this.stateHistory.slice(-50), // Last 50 changes
            options: this.options
        };
    }
    
    /**
     * Disconnect from physical hardware
     */
    async disconnect() {
        this.stopSyncLoop();
        
        if (this.physicalBoard) {
            try {
                await this.physicalBoard.disconnect();
            } catch (error) {
                this.log('Disconnect error:', error.message);
            }
            this.physicalBoard = null;
        }
        
        this.syncMode = 'virtual';
        this.log('Disconnected from physical hardware');
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this.disconnect();
        
        if (this.virtualBoard) {
            this.virtualBoard.dispose();
            this.virtualBoard = null;
        }
        
        this.shadowState.clear();
        this.stateHistory = [];
        this.watchedPins.clear();
        this.listeners.clear();
        
        this.log('Board Shadow Runtime disposed');
    }
    
    /**
     * Logging utility
     */
    log(...args) {
        if (this.options.enableLogging) {
            console.log('[BoardShadowRuntime]', ...args);
        }
    }
}

/**
 * Virtual Board Simulation
 */
class VirtualBoard {
    constructor(boardType) {
        this.boardType = boardType;
        this.pins = new Map();
        this.onPinChange = null;
        
        // Initialize board-specific pins
        this.initializePins(boardType);
    }
    
    initializePins(boardType) {
        const boardConfigs = {
            'pico': [
                'GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7',
                'GP8', 'GP9', 'GP10', 'GP11', 'GP12', 'GP13', 'GP14', 'GP15',
                'GP16', 'GP17', 'GP18', 'GP19', 'GP20', 'GP21', 'GP22',
                'GP26', 'GP27', 'GP28', 'LED'
            ],
            'feather': [
                'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
                'SCK', 'MOSI', 'MISO', 'RX', 'TX',
                'D4', 'D5', 'D6', 'D9', 'D10', 'D11', 'D12', 'D13',
                'LED', 'NEOPIXEL'
            ],
            'generic': ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'LED']
        };
        
        const pinList = boardConfigs[boardType] || boardConfigs.generic;
        
        pinList.forEach(pinId => {
            this.pins.set(pinId, {
                value: 0,
                direction: 'input',  // input, output
                pull: null,          // up, down, null
                type: 'digital'      // digital, analog, pwm
            });
        });
    }
    
    setPin(pinId, value) {
        if (!this.pins.has(pinId)) {
            this.pins.set(pinId, {
                value: 0,
                direction: 'output',
                pull: null,
                type: 'digital'
            });
        }
        
        const pin = this.pins.get(pinId);
        const oldValue = pin.value;
        pin.value = value;
        
        if (value !== oldValue && this.onPinChange) {
            this.onPinChange(pinId, value, 'virtual');
        }
    }
    
    getPin(pinId) {
        const pin = this.pins.get(pinId);
        return pin ? pin.value : 0;
    }
    
    dispose() {
        this.pins.clear();
        this.onPinChange = null;
    }
}

// Import hardware bridge classes
import('./u2if-board.js').then(module => {
    window.U2IFBoard = module.U2IFBoard;
}).catch(() => {}); // Ignore if not available

import('./webserial-board.js').then(module => {
    window.WebSerialBoard = module.WebSerialBoard;
}).catch(() => {}); // Ignore if not available

import('./webusb-board.js').then(module => {
    window.WebUSBBoard = module.WebUSBBoard;
}).catch(() => {}); // Ignore if not available

export { BoardShadowRuntime, VirtualBoard };