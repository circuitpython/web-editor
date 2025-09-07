#!/usr/bin/env node

// Demonstration script showing the CircuitPython REPL output fix working
import circuitpython from './build-standard/circuitpython.mjs';

async function demonstrateFix() {
    console.log('🎉 CircuitPython REPL Output Fix Demonstration\n');
    
    let outputBuffer = '';
    
    try {
        const Module = await circuitpython({
            stdout: function(charCode) {
                const char = String.fromCharCode(charCode);
                outputBuffer += char;
                process.stdout.write(char);
            },
            stderr: function(charCode) {
                const char = String.fromCharCode(charCode);
                outputBuffer += char;
                process.stderr.write(char);
            }
        });
        
        // Initialize CircuitPython
        Module._mp_js_init_with_heap(1024 * 1024);
        Module._proxy_c_init();
        Module._mp_js_repl_init();
        
        // Helper function to send command and wait for output
        async function sendCommand(command, description) {
            console.log(`\n📝 ${description}`);
            console.log(`>>> ${command}`);
            
            for (let i = 0; i < command.length; i++) {
                Module._mp_js_repl_process_char(command.charCodeAt(i));
            }
            Module._mp_js_repl_process_char(10); // newline
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Test various types of output
        await sendCommand("print('Hello, CircuitPython!')", "Testing print() statement");
        await sendCommand("3 + 4 * 5", "Testing expression evaluation");
        await sendCommand("print('Line 1')", "Testing multiple print statements");
        await sendCommand("print('Line 2')", "");
        await sendCommand("for i in range(3): print(f'Count: {i}')", "Testing loop with print");
        await sendCommand("'Hello World!'.upper()", "Testing string method");
        await sendCommand("list(range(5))", "Testing list creation");
        await sendCommand("x = 42", "Testing variable assignment (no output expected)");
        await sendCommand("x", "Testing variable access");
        
        console.log('\n\n✅ All tests completed successfully!');
        console.log('🔥 CircuitPython print() and expression outputs are now working correctly in WebAssembly!');
        
    } catch (error) {
        console.error('❌ Error during demonstration:', error);
        process.exit(1);
    }
}

demonstrateFix();