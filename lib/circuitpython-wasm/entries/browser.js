/**
 * Browser Optimized CircuitPython Entry Point
 * 
 * This entry point provides browser-specific optimizations:
 * - WebSerial/WebUSB device access
 * - DOM integration and visualization
 * - Service Worker support for offline use
 * - Local storage for state persistence
 * - Performance optimizations for main thread
 */

import { createCircuitPython } from '../circuitpython-bridge.js';
import { BoardShadowRuntime } from '../board-shadow-runtime.js';

export class BrowserCircuitPython {
    constructor(options = {}) {
        this.options = {
            // Browser optimized defaults
            heapSize: 8 * 1024 * 1024,   // 8MB (browser memory constraints)
            enableVisualization: true,
            enableLocalStorage: true,
            enableServiceWorker: false,  // Optional offline support
            visualizationTarget: null,   // DOM element for visualization
            autoRequestDeviceAccess: false,
            enableTouchInterface: true,
            enableKeyboardShortcuts: true,
            theme: 'auto',               // 'light', 'dark', 'auto'
            ...options
        };
        
        this.circuitPython = null;
        this.boardShadow = null;
        this.visualizer = null;
        this.isInitialized = false;
        
        // Browser specific features
        this.storage = null;
        this.devicePermissions = new Map();
        this.touchHandler = null;
        this.keyboardHandler = null;
    }
    
    /**
     * Initialize browser-optimized CircuitPython
     */
    async init() {
        if (this.isInitialized) return this;
        
        console.log('🌐 Initializing Browser CircuitPython with visualization...');
        
        try {
            // Check browser compatibility
            this.checkBrowserSupport();
            
            // Initialize CircuitPython WASM with browser optimizations
            this.circuitPython = await createCircuitPython({
                heapSize: this.options.heapSize,
                onOutput: (text) => this.handleOutput(text),
                onError: (text) => this.handleError(text),
                // Browser specific options
                enableWebGL: false,      // Avoid WebGL conflicts
                enableOffscreenCanvas: true
            });
            
            // Initialize board shadow runtime
            this.boardShadow = new BoardShadowRuntime({
                enableLogging: false, // Reduce console noise in browser
                boardType: 'generic'
            });
            
            // Set up browser-specific features
            if (this.options.enableLocalStorage) {
                this.initializeLocalStorage();
            }
            
            if (this.options.enableVisualization) {
                await this.initializeVisualization();
            }
            
            if (this.options.enableTouchInterface) {
                this.initializeTouchInterface();
            }
            
            if (this.options.enableKeyboardShortcuts) {
                this.initializeKeyboardShortcuts();
            }
            
            // Set up device connection handlers
            this.setupDeviceHandlers();
            
            // Auto-request device access if enabled
            if (this.options.autoRequestDeviceAccess) {
                this.requestDeviceAccess();
            }
            
            this.isInitialized = true;
            console.log('✅ Browser CircuitPython ready');
            
            return this;
            
        } catch (error) {
            console.error('❌ Browser CircuitPython initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Check browser support for required APIs
     */
    checkBrowserSupport() {
        const support = {
            webAssembly: typeof WebAssembly !== 'undefined',
            webSerial: 'serial' in navigator,
            webUSB: 'usb' in navigator,
            localStorage: typeof Storage !== 'undefined',
            serviceWorker: 'serviceWorker' in navigator,
            webWorkers: typeof Worker !== 'undefined',
            es6Modules: typeof Symbol !== 'undefined'
        };
        
        if (!support.webAssembly) {
            throw new Error('WebAssembly not supported in this browser');
        }
        
        if (!support.es6Modules) {
            throw new Error('ES6 modules not supported in this browser');
        }
        
        console.log('🔍 Browser support:', support);
        return support;
    }
    
    /**
     * Initialize local storage for state persistence
     */
    initializeLocalStorage() {
        this.storage = {
            save: (key, data) => {
                try {
                    localStorage.setItem(`circuitpy_${key}`, JSON.stringify(data));
                } catch (error) {
                    console.warn('Failed to save to localStorage:', error);
                }
            },
            
            load: (key) => {
                try {
                    const data = localStorage.getItem(`circuitpy_${key}`);
                    return data ? JSON.parse(data) : null;
                } catch (error) {
                    console.warn('Failed to load from localStorage:', error);
                    return null;
                }
            },
            
            clear: (key) => {
                try {
                    localStorage.removeItem(`circuitpy_${key}`);
                } catch (error) {
                    console.warn('Failed to clear localStorage:', error);
                }
            }
        };
        
        // Load previous state if available
        const savedState = this.storage.load('board_state');
        if (savedState) {
            console.log('📦 Restored board state from localStorage');
        }
    }
    
    /**
     * Initialize visualization components
     */
    async initializeVisualization() {
        const target = this.options.visualizationTarget || this.createDefaultVisualization();
        
        this.visualizer = new BrowserVisualizer(target, {
            theme: this.options.theme,
            enableInteraction: true,
            enableAnimation: true
        });
        
        // Connect visualizer to board shadow
        this.boardShadow.addPinListener('*', (pinId, value, source) => {
            this.visualizer.updatePin(pinId, value, source);
            
            // Save state to localStorage
            if (this.storage) {
                this.storage.save('board_state', this.boardShadow.exportState());
            }
        });
        
        await this.visualizer.initialize();
    }
    
    /**
     * Create default visualization DOM structure
     */
    createDefaultVisualization() {
        const container = document.createElement('div');
        container.className = 'circuitpy-visualization';
        container.innerHTML = `
            <div class="circuitpy-header">
                <h3>🐍 CircuitPython Hardware</h3>
                <div class="circuitpy-status"></div>
            </div>
            <div class="circuitpy-board"></div>
            <div class="circuitpy-controls"></div>
            <div class="circuitpy-console"></div>
        `;
        
        // Add to page if no target specified
        if (!this.options.visualizationTarget) {
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    /**
     * Initialize touch interface for mobile
     */
    initializeTouchInterface() {
        this.touchHandler = new TouchInterface(this.visualizer);
        
        // Enable touch controls for pin manipulation
        this.touchHandler.onPinTouch = (pinId, action) => {
            if (action === 'toggle') {
                const currentValue = this.boardShadow.getPin(pinId);
                this.boardShadow.setPin(pinId, currentValue ? 0 : 1);
            }
        };
    }
    
    /**
     * Initialize keyboard shortcuts
     */
    initializeKeyboardShortcuts() {
        this.keyboardHandler = (event) => {
            // Ctrl/Cmd + Enter: Run code
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                this.runCurrentCode();
            }
            
            // Escape: Stop execution
            if (event.key === 'Escape') {
                this.stopExecution();
            }
            
            // Ctrl/Cmd + D: Connect device
            if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
                event.preventDefault();
                this.requestDeviceAccess();
            }
        };
        
        document.addEventListener('keydown', this.keyboardHandler);
    }
    
    /**
     * Set up device connection handlers
     */
    setupDeviceHandlers() {
        // WebSerial connection handler
        if ('serial' in navigator) {
            this.connectWebSerial = async () => {
                try {
                    const WebSerialBoard = (await import('../webserial-board.js')).default;
                    const board = await WebSerialBoard.connect();
                    
                    this.integratePhysicalBoard(board, 'webserial');
                    this.updateStatus('Connected via WebSerial', 'success');
                    
                } catch (error) {
                    this.updateStatus(`WebSerial failed: ${error.message}`, 'error');
                    throw error;
                }
            };
        }
        
        // WebUSB connection handler
        if ('usb' in navigator) {
            this.connectWebUSB = async () => {
                try {
                    const U2IFBoard = (await import('../u2if-board.js')).default;
                    const board = await U2IFBoard.connect();
                    
                    this.integratePhysicalBoard(board, 'webusb');
                    this.updateStatus('Connected via WebUSB', 'success');
                    
                } catch (error) {
                    this.updateStatus(`WebUSB failed: ${error.message}`, 'error');
                    throw error;
                }
            };
        }
    }
    
    /**
     * Request device access from user
     */
    async requestDeviceAccess() {
        if (!('serial' in navigator) && !('usb' in navigator)) {
            this.updateStatus('Device access not supported in this browser', 'warning');
            return;
        }
        
        try {
            this.updateStatus('Requesting device access...', 'info');
            
            // Try WebSerial first
            if ('serial' in navigator && !this.devicePermissions.has('webserial')) {
                try {
                    await this.connectWebSerial();
                    this.devicePermissions.set('webserial', true);
                    return 'webserial';
                } catch (error) {
                    console.warn('WebSerial connection failed:', error.message);
                }
            }
            
            // Try WebUSB second
            if ('usb' in navigator && !this.devicePermissions.has('webusb')) {
                try {
                    await this.connectWebUSB();
                    this.devicePermissions.set('webusb', true);
                    return 'webusb';
                } catch (error) {
                    console.warn('WebUSB connection failed:', error.message);
                }
            }
            
            // No physical device available
            this.updateStatus('No physical device connected - using simulation', 'info');
            return 'virtual';
            
        } catch (error) {
            this.updateStatus('Device access failed', 'error');
            throw error;
        }
    }
    
    /**
     * Integrate physical board with browser interface
     */
    integratePhysicalBoard(board, type) {
        // Forward board shadow operations to physical board
        const originalSetPin = this.boardShadow.setPin.bind(this.boardShadow);
        const originalGetPin = this.boardShadow.getPin.bind(this.boardShadow);
        
        this.boardShadow.setPin = async (pinId, value) => {
            await board.setPin(pinId, value);
            return originalSetPin(pinId, value);
        };
        
        this.boardShadow.getPin = async (pinId) => {
            const physicalValue = await board.readPin(pinId);
            originalSetPin(pinId, physicalValue); // Update shadow state
            return physicalValue;
        };
        
        // Set up periodic sync
        setInterval(async () => {
            // Sync physical sensor readings
            try {
                const analogPins = ['A0', 'A1', 'A2'];
                for (const pin of analogPins) {
                    if (board.readPinAnalog) {
                        const value = await board.readPinAnalog(pin);
                        this.boardShadow.updateShadowState(pin, value, 'physical');
                    }
                }
            } catch (error) {
                // Ignore sync errors
            }
        }, 500);
        
        console.log(`🔗 Physical board integrated via ${type}`);
    }
    
    /**
     * Execute code with browser optimizations
     */
    async execute(code, options = {}) {
        try {
            // Browser-specific code enhancements
            const enhancedCode = this.enhanceCodeForBrowser(code);
            
            this.updateStatus('Running code...', 'info');
            
            const result = await this.circuitPython.execute(enhancedCode);
            
            if (result.success) {
                this.updateStatus('Code completed successfully', 'success');
            } else {
                this.updateStatus('Code execution failed', 'error');
            }
            
            return result;
            
        } catch (error) {
            this.updateStatus(`Execution error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Enhance code for browser environment
     */
    enhanceCodeForBrowser(code) {
        // Add browser-specific integrations
        const browserIntegration = `
# Browser CircuitPython Integration
import time

# Browser-optimized output
def browser_print(*args, **kwargs):
    # Send to visualization
    text = ' '.join(str(arg) for arg in args)
    print(f"BROWSER_OUTPUT:{text}")

# Override print for better browser integration
import builtins
builtins.print = browser_print

# Browser-optimized time delays
original_sleep = time.sleep
def browser_sleep(seconds):
    # Allow browser to update during sleep
    print(f"BROWSER_SLEEP:{seconds}")
    original_sleep(seconds)

time.sleep = browser_sleep

# User code starts here:
${code}
`;
        
        return browserIntegration;
    }
    
    /**
     * Handle output with browser enhancements
     */
    handleOutput(text) {
        if (text.startsWith('BROWSER_OUTPUT:')) {
            const output = text.substring(15);
            this.displayOutput(output, 'output');
            return;
        }
        
        if (text.startsWith('BROWSER_SLEEP:')) {
            const duration = parseFloat(text.substring(14));
            this.visualizer?.showSleepIndicator(duration);
            return;
        }
        
        // Regular output
        this.displayOutput(text, 'info');
    }
    
    /**
     * Handle errors with browser context
     */
    handleError(text) {
        this.displayOutput(text, 'error');
        this.updateStatus('Error occurred', 'error');
    }
    
    /**
     * Display output in browser console
     */
    displayOutput(text, type = 'info') {
        if (this.visualizer && this.visualizer.console) {
            this.visualizer.console.addLine(text, type);
        } else {
            console.log(`[${type.toUpperCase()}]`, text);
        }
    }
    
    /**
     * Update status display
     */
    updateStatus(message, type = 'info') {
        if (this.visualizer) {
            this.visualizer.updateStatus(message, type);
        }
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
    
    /**
     * Get browser-specific status
     */
    getStatus() {
        const baseStatus = {
            initialized: this.isInitialized,
            environment: 'browser',
            features: {
                webSerial: 'serial' in navigator,
                webUSB: 'usb' in navigator,
                localStorage: typeof Storage !== 'undefined',
                visualization: !!this.visualizer,
                touchInterface: !!this.touchHandler
            },
            permissions: Object.fromEntries(this.devicePermissions)
        };
        
        if (this.boardShadow) {
            baseStatus.hardware = this.boardShadow.getHardwareStatus();
        }
        
        if (this.storage) {
            baseStatus.storage = {
                available: true,
                usage: this.estimateStorageUsage()
            };
        }
        
        return baseStatus;
    }
    
    /**
     * Estimate localStorage usage
     */
    estimateStorageUsage() {
        try {
            let total = 0;
            for (let key in localStorage) {
                if (key.startsWith('circuitpy_')) {
                    total += localStorage[key].length;
                }
            }
            return { bytes: total, readable: `${Math.round(total / 1024)}KB` };
        } catch (error) {
            return { bytes: 0, readable: '0KB' };
        }
    }
    
    /**
     * Cleanup browser resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up Browser CircuitPython...');
        
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
        
        if (this.touchHandler) {
            this.touchHandler.cleanup();
        }
        
        if (this.visualizer) {
            this.visualizer.cleanup();
        }
        
        if (this.boardShadow) {
            this.boardShadow.dispose();
        }
        
        if (this.circuitPython) {
            this.circuitPython.dispose();
        }
        
        this.isInitialized = false;
        console.log('✅ Browser cleanup complete');
    }
}

/**
 * Browser Visualizer Class
 */
class BrowserVisualizer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.boardElement = null;
        this.console = null;
        this.statusElement = null;
    }
    
    async initialize() {
        // Create board visualization
        this.boardElement = this.container.querySelector('.circuitpy-board');
        this.createBoardLayout();
        
        // Create console
        this.console = new BrowserConsole(this.container.querySelector('.circuitpy-console'));
        
        // Create status display
        this.statusElement = this.container.querySelector('.circuitpy-status');
        
        // Apply theme
        this.applyTheme();
    }
    
    createBoardLayout() {
        // Create virtual board pins
        const pins = ['GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'LED', 'BUTTON'];
        
        pins.forEach(pinId => {
            const pinElement = document.createElement('div');
            pinElement.className = 'pin';
            pinElement.dataset.pin = pinId;
            pinElement.innerHTML = `
                <div class="pin-indicator"></div>
                <div class="pin-label">${pinId}</div>
            `;
            
            this.boardElement.appendChild(pinElement);
        });
    }
    
    updatePin(pinId, value, source) {
        const pinElement = this.boardElement.querySelector(`[data-pin="${pinId}"]`);
        if (pinElement) {
            const indicator = pinElement.querySelector('.pin-indicator');
            indicator.className = `pin-indicator ${value ? 'high' : 'low'} ${source}`;
        }
    }
    
    updateStatus(message, type) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
            this.statusElement.className = `circuitpy-status ${type}`;
        }
    }
    
    applyTheme() {
        const theme = this.options.theme === 'auto' ? 
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') :
            this.options.theme;
        
        this.container.dataset.theme = theme;
    }
    
    cleanup() {
        // Cleanup visualization resources
    }
}

/**
 * Browser Console Class
 */
class BrowserConsole {
    constructor(container) {
        this.container = container;
        this.lines = [];
        this.maxLines = 100;
        this.initialize();
    }
    
    initialize() {
        this.container.innerHTML = `
            <div class="console-header">Console Output</div>
            <div class="console-content"></div>
        `;
        this.content = this.container.querySelector('.console-content');
    }
    
    addLine(text, type = 'info') {
        const line = {
            text,
            type,
            timestamp: new Date().toLocaleTimeString()
        };
        
        this.lines.push(line);
        
        // Limit console history
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
        
        this.render();
    }
    
    render() {
        this.content.innerHTML = this.lines
            .map(line => `
                <div class="console-line ${line.type}">
                    <span class="timestamp">${line.timestamp}</span>
                    <span class="content">${line.text}</span>
                </div>
            `)
            .join('');
        
        // Auto-scroll to bottom
        this.content.scrollTop = this.content.scrollHeight;
    }
}

/**
 * Touch Interface Class
 */
class TouchInterface {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.onPinTouch = null;
        this.setupTouchHandlers();
    }
    
    setupTouchHandlers() {
        if (this.visualizer.boardElement) {
            this.visualizer.boardElement.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const pin = e.target.closest('[data-pin]');
                if (pin && this.onPinTouch) {
                    this.onPinTouch(pin.dataset.pin, 'toggle');
                }
            });
        }
    }
    
    cleanup() {
        // Remove touch handlers
    }
}

/**
 * Factory function for Browser CircuitPython
 */
export default async function browserCtPy(options = {}) {
    const instance = new BrowserCircuitPython(options);
    await instance.init();
    return instance;
}

export { BrowserCircuitPython };