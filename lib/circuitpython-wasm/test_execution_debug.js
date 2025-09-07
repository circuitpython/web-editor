#!/usr/bin/env node

import circuitpython from './build-standard/circuitpython.mjs';

async function testExecution() {
    console.log('=== Execution Debug Test ===');
    
    let allOutput = [];
    
    const Module = await circuitpython({
        stdout: function(charCode) {
            const char = String.fromCharCode(charCode);
            allOutput.push(`STDOUT[${charCode}:'${char}']`);
            process.stdout.write(char);
        },
        stderr: function(charCode) {
            const char = String.fromCharCode(charCode);
            allOutput.push(`STDERR[${charCode}:'${char}']`);
            process.stderr.write(char);
        }
    });
    
    Module._mp_js_init_with_heap(1024 * 1024);
    Module._proxy_c_init();
    Module._mp_js_repl_init();
    
    console.log('\nClearing output buffer after init...');
    allOutput = [];
    
    // Test 1: Assignment (should work silently)
    console.log('\n=== Test 1: Variable assignment ===');
    const assignment = 'x = 42';
    for (let char of assignment) {
        Module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    let result1 = Module._mp_js_repl_process_char(10);
    console.log(`Assignment result: ${result1}`);
    console.log(`Output during assignment:`, allOutput);
    
    allOutput = [];
    
    // Test 2: Variable access (should show result)
    console.log('\n=== Test 2: Variable access ===');
    const access = 'x';
    for (let char of access) {
        Module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    let result2 = Module._mp_js_repl_process_char(10);
    console.log(`Variable access result: ${result2}`);
    console.log(`Output during access:`, allOutput);
    
    allOutput = [];
    
    // Test 3: Simple expression
    console.log('\n=== Test 3: Direct expression ===');
    const expr = '2+2';
    for (let char of expr) {
        Module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    let result3 = Module._mp_js_repl_process_char(10);
    console.log(`Expression result: ${result3}`);
    console.log(`Output during expression:`, allOutput);
    
    allOutput = [];
    
    // Test 4: Force an error to see if exceptions work
    console.log('\n=== Test 4: Intentional error ===');
    const error = 'undefined_variable';
    for (let char of error) {
        Module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    let result4 = Module._mp_js_repl_process_char(10);
    console.log(`Error test result: ${result4}`);
    console.log(`Output during error:`, allOutput);
    
    console.log('\nSummary of all outputs:', allOutput);
}

testExecution().catch(console.error);