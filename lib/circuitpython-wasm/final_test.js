#!/usr/bin/env node

import circuitpython from './build-standard/circuitpython.mjs';

async function finalTest() {
    console.log('=== Final Definitive Test ===');
    
    const Module = await circuitpython({
        stdout: function(charCode) {
            const char = String.fromCharCode(charCode);
            process.stdout.write(`[${charCode}:${char}]`);
        },
        stderr: function(charCode) {
            const char = String.fromCharCode(charCode);
            process.stderr.write(`[ERR:${charCode}:${char}]`);
        }
    });
    
    Module._mp_js_init_with_heap(1024 * 1024);
    Module._proxy_c_init();
    Module._mp_js_repl_init();
    
    console.log('\n\nNow testing print("hello"):');
    
    const cmd = 'print("hello")';
    for (let char of cmd) {
        Module._mp_js_repl_process_char(char.charCodeAt(0));
    }
    const result = Module._mp_js_repl_process_char(10);
    
    console.log(`\n\nREPL result code: ${result}`);
    console.log('\nExpected to see: [104:h][101:e][108:l][108:l][111:o] in addition to the input echo');
    console.log('If you only see input echo characters and no extra [104:h][101:e]... sequence, then execution is not producing output.');
    
    await new Promise(resolve => setTimeout(resolve, 200));
}

finalTest().catch(console.error);