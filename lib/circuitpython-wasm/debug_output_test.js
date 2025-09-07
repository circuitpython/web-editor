#!/usr/bin/env node

import circuitpython from './build-standard/circuitpython.mjs';

async function debugTest() {
    console.log('=== Debug Output Test ===');
    
    let outputCapture = [];
    let errorCapture = [];
    
    const Module = await circuitpython({
        stdout: function(charCode) {
            const char = String.fromCharCode(charCode);
            outputCapture.push({code: charCode, char: char});
            process.stdout.write(char);
        },
        stderr: function(charCode) {
            const char = String.fromCharCode(charCode);
            errorCapture.push({code: charCode, char: char});
            process.stderr.write(char);
        },
        print: function(text) {
            console.log(`[MODULE PRINT]: ${text}`);
        }
    });
    
    console.log('\nModule initialized');
    
    // Initialize CircuitPython
    Module._mp_js_init_with_heap(1024 * 1024);
    Module._proxy_c_init();
    Module._mp_js_repl_init();
    
    console.log(`\nCaptured ${outputCapture.length} chars during init`);
    console.log('Output chars:', outputCapture.slice(-20));
    
    // Clear captures for our test
    outputCapture = [];
    errorCapture = [];
    
    console.log('\n=== Testing print statement ===');
    
    // Send a simple print command character by character
    const testCommand = 'print("test")';
    console.log(`Sending command: ${testCommand}`);
    
    for (let i = 0; i < testCommand.length; i++) {
        const result = Module._mp_js_repl_process_char(testCommand.charCodeAt(i));
        console.log(`Char ${i}: '${testCommand[i]}' (${testCommand.charCodeAt(i)}) -> result: ${result}`);
    }
    
    // Send newline to execute
    const nlResult = Module._mp_js_repl_process_char(10); // '\n'
    console.log(`Newline -> result: ${nlResult}`);
    
    console.log(`\nAfter command, captured ${outputCapture.length} chars`);
    console.log('All output:', outputCapture);
    
    // Try waiting a bit for async output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`\nAfter delay, total captured: ${outputCapture.length} chars`);
    
    if (outputCapture.length > 0) {
        const outputString = outputCapture.map(x => x.char).join('');
        console.log(`Output string: "${outputString}"`);
    }
}

debugTest().catch(console.error);