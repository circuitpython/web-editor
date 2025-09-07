/**
 * CircuitPython WebAssembly - Main Entry Point
 * 
 * Provides multiple import paths for different usage scenarios:
 * 
 * import { nodeCtPy } from 'circuitpython-wasm'        // Node.js optimized
 * import { browserCtPy } from 'circuitpython-wasm'     // Browser optimized  
 * import { workerCtPy } from 'circuitpython-wasm'      // Web Worker optimized
 * import { universalCtPy } from 'circuitpython-wasm'   // Auto-detecting
 * import { minimalCtPy } from 'circuitpython-wasm'     // Minimal interpreter only
 */

// Re-export all the different variants
export { default as nodeCtPy } from './entries/node.js';
export { default as browserCtPy } from './entries/browser.js';
export { default as workerCtPy } from './entries/worker.js';
export { default as universalCtPy } from './entries/universal.js';
export { default as minimalCtPy } from './entries/minimal.js';

// Legacy/convenience exports
export { default as CircuitPython } from './entries/universal.js';
export { default } from './entries/universal.js';

// Utility exports
export { UniversalHardwareBridge } from './universal-hardware-bridge.js';
export { BoardShadowRuntime } from './board-shadow-runtime.js';
export { CircuitPythonBridge } from './circuitpython-bridge.js';

// Environment detection helpers
export const environment = {
    isNode: typeof window === 'undefined' && typeof process !== 'undefined',
    isBrowser: typeof window !== 'undefined' && typeof navigator !== 'undefined',
    hasWebSerial: typeof navigator !== 'undefined' && 'serial' in navigator,
    hasWebUSB: typeof navigator !== 'undefined' && 'usb' in navigator,
    hasWebWorkers: typeof Worker !== 'undefined'
};

// Quick start factory function
export async function createCircuitPython(options = {}) {
    const { universalCtPy } = await import('./entries/universal.js');
    return universalCtPy(options);
}