#!/usr/bin/env node

// Direct test of the output chain
import circuitpython from './build-standard/circuitpython.mjs';

async function testOutputChain() {
    console.log('=== Direct Output Chain Test ===\n');
    
    let stdoutCollected = '';
    let stderrCollected = '';
    
    const Module = await circuitpython({
        stdout: function(charCode) {
            const char = String.fromCharCode(charCode);
            stdoutCollected += char;
            process.stdout.write(`[STDOUT:${charCode}='${char}']`);
        },
        stderr: function(charCode) {
            const char = String.fromCharCode(charCode);
            stderrCollected += char;
            process.stderr.write(`[STDERR:${charCode}='${char}']`);
        }
    });
    
    console.log('\nModule loaded, initializing...');
    
    // Initialize
    Module._mp_js_init_with_heap(1024 * 1024);
    Module._proxy_c_init();
    
    console.log('\nInitialized. Testing direct exec...\n');
    
    // Test direct execution instead of REPL
    const code = 'print("hello world")';
    console.log(`Executing: ${code}`);
    
    const result_ptr = Module._malloc(4);
    Module._mp_js_do_exec(code, code.length, result_ptr);
    
    console.log(`\nStdout collected: "${stdoutCollected}"`);
    console.log(`Stderr collected: "${stderrCollected}"`);
    
    // Also test a simple expression
    stdoutCollected = '';
    stderrCollected = '';
    
    const expr = '1+1';
    console.log(`\nExecuting: ${expr}`);
    Module._mp_js_do_exec(expr, expr.length, result_ptr);
    
    console.log(`Stdout collected: "${stdoutCollected}"`);
    console.log(`Stderr collected: "${stderrCollected}"`);
    
    Module._free(result_ptr);
    
    console.log('\nDirect execution test completed');
}

testOutputChain().catch(console.error);