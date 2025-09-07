#!/usr/bin/env node

// CircuitPython REPL startup script for WebAssembly port
import circuitpython from './build-standard/circuitpython.mjs';
import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

async function startCircuitPython() {
    console.log('Loading CircuitPython WebAssembly port...');
    
    try {
        const Module = await circuitpython({
            // Capture stdout/stderr from WebAssembly module
            // Use stdout/stderr for WASI compatibility - these receive single characters (ASCII codes)
            stdout: function(charCode) {
                // Convert ASCII code to character and write to stdout
                process.stdout.write(String.fromCharCode(charCode));
            },
            stderr: function(charCode) {
                // Convert ASCII code to character and write to stderr
                process.stderr.write(String.fromCharCode(charCode));
            }
        });
        
        // Initialize CircuitPython with 4MB heap (increased for module loading)
        Module._mp_js_init_with_heap(4 * 1024 * 1024);
        
        // Initialize proxy system
        Module._proxy_c_init();
        
        // Initialize REPL
        Module._mp_js_repl_init();
        
        console.log('Type "help()" for more information, Ctrl+C to exit\n');
        
        // Display initial prompt
        process.stdout.write('>>> ');
        
        // Use raw terminal mode to let CircuitPython handle all echoing
        process.stdin.setRawMode(true);
        process.stdin.resume();
        
        // Handle each keypress directly
        process.stdin.on('data', (key) => {
            const keyCode = key[0];
            
            // Handle Ctrl+C (3) to exit gracefully
            if (keyCode === 3) {
                console.log('\nGoodbye!');
                process.exit(0);
            }
            
            // Send the character to CircuitPython REPL
            Module._mp_js_repl_process_char(keyCode);
        });
        
    } catch (error) {
        console.error('Failed to start CircuitPython:', error);
        process.exit(1);
    }
}

startCircuitPython();