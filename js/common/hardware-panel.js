/**
 * Virtual Hardware Panel Manager
 *
 * Displays and manages virtual hardware pins for CircuitPython WASM
 */

export class HardwarePanel {
    constructor() {
        this.panel = null;
        this.pinElements = new Map(); // pin name -> DOM element
        this.pinStates = new Map();   // pin name -> {direction, value, mode}
        this.isVisible = false;
        this.circuitPython = null;    // Reference to CircuitPython worker proxy
        this.unregisterGpioUpdates = null; // Function to unregister GPIO updates
    }

    /**
     * Initialize the hardware panel
     */
    init() {
        this.findPanel();
        this.attachButtonHandler();
    }

    /**
     * Find the hardware panel in the DOM
     */
    findPanel() {
        // Panel should already exist in the HTML (added by index.html)
        this.panel = document.getElementById('hardware-panel');

        if (!this.panel) {
            console.error('Hardware panel element not found in DOM');
        }
    }

    /**
     * Attach handler to the Hardware button
     */
    attachButtonHandler() {
        const hardwareBtn = document.getElementById('btn-hardware');
        if (hardwareBtn) {
            hardwareBtn.addEventListener('click', () => {
                this.toggle();
            });
        }
    }

    /**
     * Set the CircuitPython instance and register for real-time GPIO updates
     */
    setCircuitPython(circuitPython) {
        this.circuitPython = circuitPython;

        // Register for real-time GPIO updates from worker
        if (circuitPython && circuitPython.onGpioUpdate) {
            this.unregisterGpioUpdates = circuitPython.onGpioUpdate((update) => {
                if (!this.isVisible) return;

                const pinName = `GPIO${update.pin}`;
                console.log(`[HardwarePanel] GPIO update: ${pinName} direction=${update.direction} value=${update.value}`);
                this.updatePin(pinName, update.direction, update.value, 'digital');
            });
        }
    }

    /**
     * Unregister from GPIO updates
     */
    stopUpdates() {
        if (this.unregisterGpioUpdates) {
            this.unregisterGpioUpdates();
            this.unregisterGpioUpdates = null;
        }
    }

    /**
     * Update all pins from a states object
     */
    updatePinsFromStates(states) {
        if (!states || Object.keys(states).length === 0) {
            // No pins configured yet
            if (this.pinElements.size === 0) {
                this.showInfo('No pins configured yet. Run some code using digitalio or analogio!');
            }
            return;
        }

        // Update each pin
        for (const [pinName, state] of Object.entries(states)) {
            this.updatePin(pinName, state.direction, state.value, state.mode);
        }
    }

    /**
     * Toggle hardware panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Show the hardware panel
     */
    show() {
        if (!this.panel) return;

        // Hide plotter if visible (mutually exclusive)
        const plotter = document.getElementById('plotter');
        if (plotter && !plotter.classList.contains('hidden')) {
            plotter.classList.add('hidden');
        }

        this.panel.classList.remove('hidden');
        this.isVisible = true;

        // Mark button as active
        const hardwareBtn = document.getElementById('btn-hardware');
        if (hardwareBtn) {
            hardwareBtn.classList.add('active');
        }

        // Show initial message if no pins
        if (this.pinElements.size === 0) {
            this.showInfo('No pins configured yet. Run some code using digitalio or analogio!');
        }

        // Resize terminal to account for panel height
        this.resizeTerminal();
    }

    /**
     * Hide the hardware panel
     */
    hide() {
        if (!this.panel) return;

        this.panel.classList.add('hidden');
        this.isVisible = false;

        // Mark button as inactive
        const hardwareBtn = document.getElementById('btn-hardware');
        if (hardwareBtn) {
            hardwareBtn.classList.remove('active');
        }

        // Resize terminal to reclaim space
        this.resizeTerminal();
    }

    /**
     * Trigger terminal resize (imported from layout.js)
     */
    resizeTerminal() {
        // Import and call refitTerminal from layout.js
        import('../layout.js').then(module => {
            if (module.refitTerminal) {
                module.refitTerminal();
            }
        });
    }


    /**
     * Show an info message in the panel
     */
    showInfo(message) {
        const grid = this.panel?.querySelector('.hardware-grid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="hardware-info">
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Update or create a pin display
     */
    updatePin(pinName, direction, value, mode = 'digital') {
        // Store state
        this.pinStates.set(pinName, { direction, value, mode });

        // Get or create pin element
        let pinElement = this.pinElements.get(pinName);

        if (!pinElement) {
            pinElement = this.createPinElement(pinName);
            this.pinElements.set(pinName, pinElement);

            const grid = this.panel?.querySelector('.hardware-grid');
            if (grid) {
                // Clear info message if present
                const info = grid.querySelector('.hardware-info');
                if (info) {
                    grid.innerHTML = '';
                }
                grid.appendChild(pinElement);
            }
        }

        // Update pin display
        this.refreshPinElement(pinElement, pinName, direction, value, mode);
    }

    /**
     * Create a DOM element for a pin
     */
    createPinElement(pinName) {
        const pin = document.createElement('div');
        pin.className = 'virtual-pin';
        pin.dataset.pin = pinName;

        pin.innerHTML = `
            <div class="pin-header">
                <span class="pin-name">${pinName}</span>
                <span class="pin-direction">-</span>
            </div>
            <div class="pin-value">-</div>
            <div class="pin-controls"></div>
        `;

        return pin;
    }

    /**
     * Refresh a pin element's display
     */
    refreshPinElement(element, pinName, direction, value, mode) {
        // Update direction indicator
        const dirElement = element.querySelector('.pin-direction');
        if (dirElement) {
            dirElement.textContent = direction === 'output' ? 'OUT' : 'IN';
        }

        // Update border color
        element.classList.remove('pin-output', 'pin-input');
        element.classList.add(direction === 'output' ? 'pin-output' : 'pin-input');

        // Update value display
        const valueElement = element.querySelector('.pin-value');
        if (valueElement) {
            valueElement.classList.remove('pin-high', 'pin-low', 'pin-analog');

            if (mode === 'analog') {
                valueElement.textContent = `${value} (${((value / 65535) * 3.3).toFixed(2)}V)`;
                valueElement.classList.add('pin-analog');
            } else {
                valueElement.textContent = value ? 'HIGH' : 'LOW';
                valueElement.classList.add(value ? 'pin-high' : 'pin-low');
            }
        }

        // Update controls
        const controlsElement = element.querySelector('.pin-controls');
        if (controlsElement) {
            if (direction === 'input' && mode === 'digital') {
                // Show toggle button for digital inputs
                controlsElement.innerHTML = `
                    <button class="btn-toggle">Toggle</button>
                `;

                const toggleBtn = controlsElement.querySelector('.btn-toggle');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', () => {
                        this.toggleInputPin(pinName);
                    });
                }
            } else {
                controlsElement.innerHTML = '';
            }
        }
    }

    /**
     * Toggle an input pin value
     */
    async toggleInputPin(pinName) {
        // TODO: Add setInputValue support to worker
        // For now, just show a message
        console.warn('Manual pin toggle not yet implemented for worker-based GPIO');

        const state = this.pinStates.get(pinName);
        if (!state || state.direction !== 'input') {
            return;
        }

        // For now, just update the display optimistically
        const newValue = !state.value;
        this.updatePin(pinName, state.direction, newValue, state.mode);
    }

    /**
     * Clear all pins
     */
    clear() {
        const grid = this.panel?.querySelector('.hardware-grid');
        if (grid) {
            grid.innerHTML = '';
        }

        this.pinElements.clear();
        this.pinStates.clear();
        this.showInfo('No pins configured yet. Run some code!');
    }

    /**
     * Destroy the panel
     */
    destroy() {
        this.hide();
        this.clear();
        this.stopUpdates();

        // Don't remove the panel from DOM - it's part of the static HTML
        // Just clear state and references
        this.pinElements.clear();
        this.pinStates.clear();
        this.circuitPython = null;
    }
}
