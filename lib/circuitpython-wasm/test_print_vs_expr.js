#!/usr/bin/env node

import circuitpython from './build-standard/circuitpython.mjs';

async function testPrintVsExpr() {
    console.log('=== Print vs Expression Test ===');
    
    let outputCapture = '';
    
    const Module = await circuitpython({
        stdout: function(charCode) {
            const char = String.fromCharCode(charCode);
            outputCapture += char;
            process.stdout.write(char);
        },
        stderr: function(charCode) {
            const char = String.fromCharCode(charCode);
            outputCapture += `[ERR:${char}]`;
            process.stderr.write(char);
        }
    });
    
    Module._mp_js_init_with_heap(1024 * 1024);
    Module._proxy_c_init();
    Module._mp_js_repl_init();
    
    outputCapture = ''; // Clear banner
    
    // Test 1: Try a print statement with a simple string
    console.log('\n=== Test: print("DEBUG") ===');
    const printCmd = 'print("DEBUG")';
    for (let char of printCmd) {
        Module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    const printResult = Module._mp_js_repl_process_char(10);
    
    console.log(`Print command result: ${printResult}`);
    console.log(`Full output captured: "${outputCapture}"`);
    
    // Wait for any async processing
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`Output after delay: "${outputCapture}"`);
    
    // Clear for next test
    outputCapture = '';
    
    // Test 2: Try the most basic possible expression  
    console.log('\n=== Test: 5 ===');
    const simpleExpr = '5';
    for (let char of simpleExpr) {
        Module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    const exprResult = Module._mp_js_repl_process_char(10);
    
    console.log(`Simple expression result: ${exprResult}`);
    console.log(`Full output captured: "${outputCapture}"`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`Output after delay: "${outputCapture}"`);
    
    // Check what output we got
    if (outputCapture.includes('DEBUG') || outputCapture.includes('5')) {
        console.log('\n✅ SUCCESS: Got expected output!');
    } else if (outputCapture.length > 0) {
        console.log('\n⚠️  Got some output but not expected content');
        console.log('Output details:', outputCapture.split('').map(c => `${c}(${c.charCodeAt(0)})`));
    } else {
        console.log('\n❌ NO OUTPUT: Commands processed but no execution output');
    }
}

testPrintVsExpr().catch(console.error);