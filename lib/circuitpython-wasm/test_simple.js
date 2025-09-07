#!/usr/bin/env node

// Simple test for CircuitPython functionality
import circuitpython from './build-standard/circuitpython.mjs';

async function testCircuitPython() {
    console.log('Testing CircuitPython functionality...\n');
    
    try {
        const Module = await circuitpython({
            // Capture stdout from WebAssembly module
            print: function(text) {
                process.stdout.write(text);
            },
            printErr: function(text) {
                process.stderr.write(text);
            }
        });
        
        // Initialize CircuitPython
        Module._mp_js_init_with_heap(1024 * 1024);
        Module._proxy_c_init();
        
        console.log('CircuitPython initialized. Testing functionality:\n');
        
        // Test basic Python execution
        // Allocate output buffer in WASM memory
        const outputPtr = Module._malloc(12); // 3 * 4 bytes for uint32_t[3]
        const outputView = new Uint32Array(Module.HEAPU8.buffer, outputPtr, 3);
        
        console.log('1. Testing basic arithmetic...');
        const code1 = "1+1";
        try {
            Module._mp_js_do_exec(code1, code1.length, outputPtr);
            console.log('   Output array after 1+1:', Array.from(outputView));
        } catch (e) {
            console.log('   Error executing 1+1:', e);
        }
        
        console.log('2. Testing variable assignment...');
        const code1b = "x = 42";
        Module._mp_js_do_exec(code1b, code1b.length, output1);
        console.log('   Output array after x=42:', Array.from(output1));
        
        console.log('3. Testing print...');
        const code1c = "print('Hello from CircuitPython!')";
        Module._mp_js_do_exec(code1c, code1c.length, output1);
        console.log('   Output array after print:', Array.from(output1));
        
        // Try manual flush if available
        if (Module._fflush) {
            Module._fflush(0);
        }
        
        console.log('\n2. Testing imports...');
        const code2 = "import board, digitalio, analogio, busio; print('✓ Hardware modules imported')";
        Module._mp_js_do_exec(code2, code2.length, output1);
        if (Module._fflush) Module._fflush(0);
        
        console.log('\n3. Testing jsffi...');
        const code3 = "import jsffi; print('✓ jsffi imported')";
        Module._mp_js_do_exec(code3, code3.length, output1);
        if (Module._fflush) Module._fflush(0);
        
        console.log('\n4. Testing hardware simulation...');
        const code4 = `
led = digitalio.DigitalInOut(board.GP25)
led.direction = digitalio.Direction.OUTPUT  
led.value = True
print('✓ Digital I/O simulation working')
`;
        Module._mp_js_do_exec(code4, code4.length, output1);
        if (Module._fflush) Module._fflush(0);
        
        console.log('\nTest completed!');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testCircuitPython();