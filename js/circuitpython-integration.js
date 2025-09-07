/**
 * CircuitPython WebAssembly Integration for Web Editor
 * Integrates our minimal CircuitPython entry point into the existing web editor
 */

import { createWebEditorInstance, minimalCtPy } from '../lib/circuitpython-wasm-minimal/index.js';

export class CircuitPythonWebEditor {
    constructor() {
        this.circuitPython = null;
        this.isInitialized = false;
        this.outputCallback = null;
        this.virtualHardware = new Map();
        
        // Initialize virtual hardware display
        this.setupVirtualHardwareDisplay();
    }
    
    /**
     * Initialize CircuitPython with web editor integration
     */
    async initialize(outputCallback = console.log) {
        if (this.isInitialized) return this.circuitPython;
        
        this.outputCallback = outputCallback;
        
        try {
            console.log('🔄 Initializing CircuitPython Web Editor Integration...');
            
            // Create CircuitPython instance optimized for web editor
            this.circuitPython = await createWebEditorInstance((text) => {
                this.handleCircuitPythonOutput(text);
            });
            
            this.isInitialized = true;
            
            // Update UI
            this.updateConnectionStatus('Connected (Virtual)');
            // Don't show fake welcome - let the real WASM output its banner
            
            console.log('✅ CircuitPython Web Editor ready!');
            return this.circuitPython;
            
        } catch (error) {
            console.error('❌ CircuitPython initialization failed:', error);
            this.updateConnectionStatus('Failed to Initialize');
            throw error;
        }
    }
    
    /**
     * Handle output from CircuitPython interpreter
     */
    handleCircuitPythonOutput(text) {
        // Parse virtual hardware commands
        if (text.startsWith('MINIMAL_PIN_')) {
            this.handleVirtualHardwareOutput(text);
            return;
        }
        
        // Regular output to terminal
        if (this.outputCallback) {
            this.outputCallback(text);
        }
        
        // Update terminal in serial area (use existing web editor terminal)
        const terminal = document.getElementById('terminal');
        if (terminal) {
            // Create new terminal line element
            const line = document.createElement('div');
            line.className = 'terminal-line virtual-output';
            line.textContent = text;
            terminal.appendChild(line);
            terminal.scrollTop = terminal.scrollHeight;
            
            // Limit terminal lines to prevent memory issues
            const lines = terminal.querySelectorAll('.terminal-line');
            if (lines.length > 1000) {
                lines[0].remove();
            }
        }
    }
    
    /**
     * Handle virtual hardware output and update display
     */
    handleVirtualHardwareOutput(command) {
        const [, operation, pin, value] = command.split(':');
        
        switch (operation) {
            case 'INIT':
                this.addVirtualPin(pin);
                break;
                
            case 'DIRECTION':
                this.updatePinDirection(pin, value);
                break;
                
            case 'WRITE':
                this.updatePinValue(pin, parseInt(value));
                break;
                
            case 'READ':
                // Pin read operations
                break;
                
            case 'ANALOG_READ':
                this.updateAnalogValue(pin, parseInt(value));
                break;
        }
    }
    
    /**
     * Execute Python code
     */
    async executeCode(code) {
        if (!this.isInitialized) {
            throw new Error('CircuitPython not initialized');
        }
        
        try {
            const result = await this.circuitPython.execute(code);
            console.log('Code executed:', result);
            return result;
        } catch (error) {
            console.error('Execution error:', error);
            if (this.outputCallback) {
                this.outputCallback(`Error: ${error.message}`);
            }
            throw error;
        }
    }
    
    /**
     * Setup virtual hardware display panel (initially hidden)
     */
    setupVirtualHardwareDisplay() {
        // Create virtual hardware panel if it doesn't exist
        let panel = document.getElementById('virtual-hardware-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'virtual-hardware-panel';
            panel.className = 'virtual-hardware-panel hidden';
            panel.innerHTML = `
                <h3>Virtual Hardware</h3>
                <div class="hardware-grid" id="hardware-grid">
                    <div class="hardware-info">
                        <p>Run code to see virtual pins appear here!</p>
                        <p>Try: <code>import board; import digitalio; led = digitalio.DigitalInOut(board.LED)</code></p>
                    </div>
                </div>
                <div class="hardware-controls">
                    <button onclick="window.circuitPythonEditor?.reset()" class="btn-reset">Reset Hardware</button>
                </div>
            `;
            
            // Add to serial page area
            const serialPage = document.getElementById('serial-page');
            if (serialPage) {
                serialPage.appendChild(panel);
            } else {
                // Fallback to body
                document.body.appendChild(panel);
            }
        }
        
        // Set up hardware toggle button
        this.setupHardwareToggle();
    }
    
    /**
     * Set up hardware panel toggle functionality
     */
    setupHardwareToggle() {
        const hardwareBtn = document.getElementById('btn-hardware');
        if (hardwareBtn) {
            hardwareBtn.addEventListener('click', () => {
                this.toggleHardwarePanel();
            });
        }
    }
    
    /**
     * Toggle hardware panel visibility
     */
    toggleHardwarePanel() {
        const panel = document.getElementById('virtual-hardware-panel');
        if (panel) {
            panel.classList.toggle('hidden');
            
            // Update button state
            const btn = document.getElementById('btn-hardware');
            if (btn) {
                if (panel.classList.contains('hidden')) {
                    btn.classList.remove('active');
                } else {
                    btn.classList.add('active');
                }
            }
        }
    }
    
    /**
     * Add virtual pin to display
     */
    addVirtualPin(pinId) {
        const grid = document.getElementById('hardware-grid');
        if (!grid) return;
        
        // Remove info message if present
        const info = grid.querySelector('.hardware-info');
        if (info) info.remove();
        
        // Don't add duplicate pins
        if (document.getElementById(`pin-${pinId}`)) return;
        
        const pinElement = document.createElement('div');
        pinElement.id = `pin-${pinId}`;
        pinElement.className = 'virtual-pin';
        pinElement.innerHTML = `
            <div class="pin-header">
                <span class="pin-name">${pinId}</span>
                <span class="pin-direction">input</span>
            </div>
            <div class="pin-value" data-value="0">0</div>
            <div class="pin-controls">
                <button onclick="window.circuitPythonEditor?.togglePin('${pinId}')" class="btn-toggle">Toggle</button>
            </div>
        `;
        
        grid.appendChild(pinElement);
        this.virtualHardware.set(pinId, { value: 0, direction: 'input', type: 'digital' });
    }
    
    /**
     * Update pin direction display
     */
    updatePinDirection(pin, direction) {
        const pinElement = document.getElementById(`pin-${pin}`);
        if (pinElement) {
            const dirElement = pinElement.querySelector('.pin-direction');
            if (dirElement) {
                dirElement.textContent = direction;
                pinElement.className = `virtual-pin pin-${direction}`;
            }
        }
        
        const hardwarePin = this.virtualHardware.get(pin);
        if (hardwarePin) {
            hardwarePin.direction = direction;
        }
    }
    
    /**
     * Update pin value display
     */
    updatePinValue(pin, value) {
        const pinElement = document.getElementById(`pin-${pin}`);
        if (pinElement) {
            const valueElement = pinElement.querySelector('.pin-value');
            if (valueElement) {
                valueElement.textContent = value;
                valueElement.setAttribute('data-value', value);
                valueElement.className = `pin-value ${value ? 'pin-high' : 'pin-low'}`;
            }
        }
        
        const hardwarePin = this.virtualHardware.get(pin);
        if (hardwarePin) {
            hardwarePin.value = value;
        }
    }
    
    /**
     * Update analog value display
     */
    updateAnalogValue(pin, value) {
        const pinElement = document.getElementById(`pin-${pin}`);
        if (pinElement) {
            const valueElement = pinElement.querySelector('.pin-value');
            if (valueElement) {
                valueElement.textContent = `${value} (${(value/65535*3.3).toFixed(2)}V)`;
                valueElement.className = 'pin-value pin-analog';
            }
        }
    }
    
    /**
     * Toggle pin value (for interactive testing)
     */
    async togglePin(pinId) {
        if (!this.circuitPython) return;
        
        const pin = this.virtualHardware.get(pinId);
        if (pin && pin.direction === 'input') {
            // Simulate button press or input change
            const newValue = pin.value ? 0 : 1;
            await this.circuitPython.setPin(pinId, newValue);
        }
    }
    
    /**
     * Reset virtual hardware
     */
    async reset() {
        if (this.circuitPython && this.circuitPython.reset) {
            await this.circuitPython.reset();
        }
        
        // Clear display
        const grid = document.getElementById('hardware-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="hardware-info">
                    <p>Virtual hardware reset!</p>
                    <p>Run code to see virtual pins appear here!</p>
                </div>
            `;
        }
        
        this.virtualHardware.clear();
        console.log('🔄 Virtual hardware reset');
    }
    
    /**
     * Update connection status in UI
     */
    updateConnectionStatus(status) {
        const statusElement = document.querySelector('.connection-status') || 
                             document.querySelector('.btn-connect');
        
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = statusElement.className.replace(/status-\w+/, '') + 
                                     ` status-${status.toLowerCase().replace(/[^a-z]/g, '')}`;
        }
    }
    
    // Removed fake banner methods - real WASM outputs its own banner
    
    /**
     * Get CircuitPython status
     */
    getStatus() {
        if (!this.circuitPython) return { initialized: false };
        
        return {
            initialized: this.isInitialized,
            circuitPython: this.circuitPython.getStatus(),
            virtualHardware: Object.fromEntries(this.virtualHardware)
        };
    }
}

// Create global instance for the web editor
window.circuitPythonEditor = new CircuitPythonWebEditor();

// Auto-initialize the CircuitPython integration when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // The virtual workflow will handle connection through the standard web editor flow
    console.log('CircuitPython Virtual Hardware integration loaded');
});