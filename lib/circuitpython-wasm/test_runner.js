// Test runner for CircuitPython WebAssembly port functionality
import circuitpython from './build-standard/circuitpython.mjs';

async function runTests() {
    console.log("=== CircuitPython WebAssembly Port Functionality Tests ===");
    
    try {
        const cp = await circuitpython();
        console.log("✓ CircuitPython module loaded successfully");
        console.log("Available methods:", Object.getOwnPropertyNames(cp).filter(name => typeof cp[name] === 'function'));
        console.log("Module properties:", Object.keys(cp));
        
        // Since this is a REPL-based system, let's try to examine it more
        console.log("\nTesting basic functionality...");
        
        // The module might be more like an Emscripten module
        // Let's look for common Emscripten properties
        if (cp.FS) {
            console.log("✓ File system available");
        }
        
        if (cp.ccall) {
            console.log("✓ ccall function available");
        }
        
        if (cp.cwrap) {
            console.log("✓ cwrap function available");  
        }
        
        console.log("\n=== Module Analysis Complete ===");
        console.log("This appears to be an Emscripten WebAssembly module.");
        console.log("For interactive testing, use: node build-standard/circuitpython.mjs");
        
    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTests().catch(console.error);