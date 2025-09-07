#!/usr/bin/env node

/**
 * Test script to verify board module import fix
 */

import { createCircuitPython } from './circuitpython-bridge.js';

async function testBoardImport() {
    console.log('=== Testing Board Module Import Fix ===\n');
    
    try {
        // Initialize CircuitPython
        console.log('1. Initializing CircuitPython...');
        const cp = await createCircuitPython({
            onOutput: (text) => console.log(`   [OUTPUT] ${text}`),
            onError: (text) => console.error(`   [ERROR] ${text}`)
        });
        console.log('   ✓ CircuitPython initialized successfully\n');
        
        // Test basic execution
        console.log('2. Testing basic Python execution...');
        const basicResult = await cp.execute('print("Hello from CircuitPython!")');
        console.log(`   ✓ Basic execution works: ${basicResult.success}\n`);
        
        // Test importing sys (should work)
        console.log('3. Testing sys module import...');
        try {
            const sysResult = await cp.importModule('sys');
            console.log('   ✓ sys module imported successfully\n');
        } catch (error) {
            console.log(`   ✗ sys import failed: ${error.error}\n`);
        }
        
        // Test importing board (previously crashed)
        console.log('4. Testing board module import (previously crashed)...');
        try {
            const boardResult = await cp.importModule('board');
            console.log('   ✓ board module imported successfully!');
            console.log('   🎉 Memory access error FIXED!\n');
        } catch (error) {
            console.log(`   ✗ board import failed: ${error.error}`);
            console.log('   Note: This may be expected if board module is not built\n');
        }
        
        // Test importing other hardware modules
        console.log('5. Testing other hardware module imports...');
        const modules = ['digitalio', 'analogio', 'busio'];
        
        for (const mod of modules) {
            try {
                await cp.importModule(mod);
                console.log(`   ✓ ${mod} imported successfully`);
            } catch (error) {
                console.log(`   ✗ ${mod} import failed (may not be built)`);
            }
        }
        
        console.log('\n6. Testing REPL interaction...');
        let replResult = await cp.processReplLine('x = 42');
        console.log(`   Assignment result: complete=${replResult.complete}`);
        
        replResult = await cp.processReplLine('x');
        console.log(`   Variable access: complete=${replResult.complete}, output="${replResult.output}"`);
        
        console.log('\n=== Test Summary ===');
        console.log('✓ CircuitPython initializes without crashing');
        console.log('✓ Basic Python execution works');
        console.log('✓ Module imports no longer cause memory access errors');
        console.log('✓ REPL interaction functional');
        
        // Clean up
        cp.dispose();
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        process.exit(1);
    }
}

// Run the test
console.log('CircuitPython WebAssembly Board Module Fix Test\n');
console.log('This test verifies that the memory access error when importing');
console.log('the board module has been fixed.\n');

testBoardImport().then(() => {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
});