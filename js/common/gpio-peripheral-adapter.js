/**
 * GPIO Peripheral Adapter
 *
 * Adapts the GPIOController interface to work with the HardwarePanel
 * Provides event-based updates and simplified pin state access
 */

export class GpioPeripheralAdapter {
    constructor(gpioController) {
        this.gpio = gpioController;
        this.listeners = new Map(); // event name -> Set of callbacks
        this.pinCallbacks = new Map(); // pin number -> unregister function

        // Set up pin change listeners
        this.setupPinListeners();
    }

    /**
     * Set up onChange listeners for all existing pins
     */
    setupPinListeners() {
        if (!this.gpio) return;

        const pins = this.gpio.getAllPins();
        for (const [pinNum, pin] of pins) {
            this.attachPinListener(pinNum, pin);
        }
    }

    /**
     * Attach a change listener to a specific pin
     */
    attachPinListener(pinNum, pin) {
        if (this.pinCallbacks.has(pinNum)) {
            return; // Already listening
        }

        const unregister = pin.onChange(() => {
            this.emitPinChange(pinNum);
        });

        this.pinCallbacks.set(pinNum, unregister);
    }

    /**
     * Emit a pin changed event
     */
    emitPinChange(pinNum) {
        const state = this.gpio.getVirtualState(pinNum);
        const pin = this.gpio.getPin(pinNum);

        const pinData = {
            pin: `GPIO${pinNum}`,
            direction: state.direction,
            value: state.value,
            mode: state.analogValue !== undefined && state.analogValue !== 0 ? 'analog' : 'digital'
        };

        this.emit('pinChanged', pinData);
    }

    /**
     * Get all pin states in a format the hardware panel expects
     * @returns {Object} Pin name -> state object
     */
    getPinStates() {
        if (!this.gpio) return {};

        const states = {};
        const pins = this.gpio.getAllPins();

        for (const [pinNum, pin] of pins) {
            const virtualState = this.gpio.getVirtualState(pinNum);
            const pinName = `GPIO${pinNum}`;

            states[pinName] = {
                direction: virtualState.direction,
                value: virtualState.value,
                mode: virtualState.analogValue !== undefined && virtualState.analogValue !== 0 ? 'analog' : 'digital'
            };

            // Ensure we're listening for changes on this pin
            this.attachPinListener(pinNum, pin);
        }

        return states;
    }

    /**
     * Set an input pin's value (for manual testing)
     * @param {string} pinName - Pin name (e.g., "GPIO0")
     * @param {boolean} value - New value
     */
    setInputValue(pinName, value) {
        // Extract pin number from name
        const match = pinName.match(/GPIO(\d+)/);
        if (!match) {
            console.warn(`Invalid pin name: ${pinName}`);
            return;
        }

        const pinNum = parseInt(match[1], 10);
        const state = this.gpio.getVirtualState(pinNum);

        // Only allow setting value for input pins
        if (state.direction !== 'input') {
            console.warn(`Cannot set value of output pin: ${pinName}`);
            return;
        }

        this.gpio.setPinValue(pinNum, value);
    }

    /**
     * Register an event listener
     * @param {string} event - Event name (e.g., 'pinChanged')
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event).add(callback);
    }

    /**
     * Unregister an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    /**
     * Emit an event to all listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            }
        }
    }

    /**
     * Clean up all listeners
     */
    destroy() {
        // Unregister all pin callbacks
        for (const unregister of this.pinCallbacks.values()) {
            unregister();
        }

        this.pinCallbacks.clear();
        this.listeners.clear();
    }
}
