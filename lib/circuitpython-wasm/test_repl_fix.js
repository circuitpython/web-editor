#!/usr/bin/env node

// Test script to verify REPL output fix
import circuitpython from './build-standard/circuitpython.mjs';

async function testREPLOutput() {
    console.log('Testing REPL output fix...');
    
    try {
        const Module = await circuitpython({
            stdout: function(charCode) {
                process.stdout.write(String.fromCharCode(charCode));
            },
            stderr: function(charCode) {
                process.stderr.write(String.fromCharCode(charCode));
            }
        });
        
        // Initialize CircuitPython with 1MB heap
        Module._mp_js_init_with_heap(1024 * 1024);
        
        // Initialize proxy system
        Module._proxy_c_init();
        
        // Initialize REPL
        Module._mp_js_repl_init();
        
        console.log('Initialized. Testing various expressions...\n');
        
        // Test cases to verify REPL output
        const testCases = [
            '1+1',           // Simple expression
            '"hello"',       // String literal
            'print("test")', // Print function call
            '[1,2,3]',       // List literal
        ];
        
        for (const testCase of testCases) {
            console.log(`\n>>> ${testCase}`);
            
            // Process each character through the REPL
            for (let i = 0; i < testCase.length; i++) {
                Module._mp_js_repl_process_char(testCase.charCodeAt(i));
            }
            // Send newline
            const result = Module._mp_js_repl_process_char(10); // '\n'
            
            // Brief pause to allow output to flush
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\nTest completed.');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testREPLOutput();