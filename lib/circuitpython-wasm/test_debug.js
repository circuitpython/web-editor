#!/usr/bin/env node

import circuitpython from './build-standard/circuitpython.mjs';

async function testCircuitPython() {
    console.log('Loading CircuitPython for debug test...');
    
    const Module = await circuitpython({
        stdout: function(charCode) {
            console.log('STDOUT CALLBACK:', charCode, String.fromCharCode(charCode));
            process.stdout.write(String.fromCharCode(charCode));
        },
        stderr: function(charCode) {
            console.log('STDERR CALLBACK:', charCode, String.fromCharCode(charCode));
            process.stderr.write(String.fromCharCode(charCode));
        }
    });
    
    // Initialize CircuitPython
    Module._mp_js_init_with_heap(1024 * 1024);
    Module._proxy_c_init();
    Module._mp_js_repl_init();
    
    console.log('\nDirect test of print...');
    
    // Test direct execution of print
    let code = '2 + 3';
    console.log('Testing math expression:', code);
    
    for (let i = 0; i < code.length; i++) {
        Module._mp_js_repl_process_char(code.charCodeAt(i));
    }
    Module._mp_js_repl_process_char(10); // newline
    
    console.log('Waiting a moment...');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    code = 'print("hello world")';
    console.log('Testing print statement:', code);
    
    for (let i = 0; i < code.length; i++) {
        Module._mp_js_repl_process_char(code.charCodeAt(i));
    }
    Module._mp_js_repl_process_char(10); // newline
    
    console.log('\nDone with test.');
}

testCircuitPython().catch(console.error);