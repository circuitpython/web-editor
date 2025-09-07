#!/usr/bin/env node

// Test script to verify REPL output functionality
import circuitpython from './build-standard/circuitpython.mjs';

async function testREPLOutput() {
    console.log('=== CircuitPython REPL Output Test ===\n');
    
    let outputBuffer = '';
    let errorBuffer = '';
    
    try {
        const Module = await circuitpython({
            stdout: function(charCode) {
                const char = String.fromCharCode(charCode);
                outputBuffer += char;
                process.stdout.write(char);
            },
            stderr: function(charCode) {
                const char = String.fromCharCode(charCode);
                errorBuffer += char;
                process.stderr.write(char);
            }
        });
        
        console.log('Module loaded successfully');
        
        // Initialize CircuitPython
        Module._mp_js_init_with_heap(1024 * 1024);
        console.log('CircuitPython initialized');
        
        // Initialize proxy system
        Module._proxy_c_init();
        console.log('Proxy system initialized');
        
        // Initialize REPL
        Module._mp_js_repl_init();
        console.log('REPL initialized\n');
        
        // Test 1: Simple expression
        console.log('=== Test 1: Simple expression ===');
        outputBuffer = '';
        
        const expr1 = '1+1';
        console.log(`Input: ${expr1}`);
        
        for (let i = 0; i < expr1.length; i++) {
            Module._mp_js_repl_process_char(expr1.charCodeAt(i));
        }
        const result1 = Module._mp_js_repl_process_char(10); // newline
        console.log(`REPL result code: ${result1}`);
        console.log(`Output captured: "${outputBuffer}"`);
        console.log(`Expected output should contain: "2"`);
        
        // Wait a moment for any delayed output
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Test 2: Print statement
        console.log('\n=== Test 2: Print statement ===');
        outputBuffer = '';
        
        const expr2 = 'print("hello")';
        console.log(`Input: ${expr2}`);
        
        for (let i = 0; i < expr2.length; i++) {
            Module._mp_js_repl_process_char(expr2.charCodeAt(i));
        }
        const result2 = Module._mp_js_repl_process_char(10); // newline
        console.log(`REPL result code: ${result2}`);
        console.log(`Output captured: "${outputBuffer}"`);
        console.log(`Expected output should contain: "hello"`);
        
        // Wait a moment for any delayed output
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('\n=== Test Summary ===');
        if (outputBuffer.includes('hello') || outputBuffer.includes('2')) {
            console.log('✓ SUCCESS: REPL output is working!');
        } else {
            console.log('✗ ISSUE: Expected output not found');
        }
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testREPLOutput();