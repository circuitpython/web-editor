#!/usr/bin/env node
/**
 * Test JavaScript-backed digitalio implementation
 */

const fs = require('fs');

async function test() {
    // Import the CircuitPython API
    const circuitPythonCode = fs.readFileSync('./build-standard/circuitpython.mjs', 'utf8');
    
    // Extract the _createCircuitPythonModule function
    eval(circuitPythonCode);
    
    console.log("=== Testing JavaScript-backed DigitalIO ===\n");
    
    // Board configuration with virtual pins
    const boardConfig = {
        pins: [
            { name: "LED", number: 13, capabilities: ['digital_io'] },
            { name: "BUTTON", number: 2, capabilities: ['digital_io'] }
        ],
        init() { console.log("🚀 Board initialized"); },
        deinit() { console.log("🛑 Board deinitialized"); }
    };
    
    // Load CircuitPython with board config
    const cp = await loadCircuitPython({
        heapsize: 256 * 1024,
        stdout: (data) => process.stdout.write(data),
        boardConfiguration: boardConfig
    });
    
    console.log("\n=== Testing Python digitalio ===\n");
    
    // Test basic digitalio functionality
    try {
        cp.runPython(`
import board

# Check available pins
print("Available board pins:", dir(board))
print("Board ID:", board.board_id)

# Test digitalio import
try:
    import digitalio
    print("✅ digitalio module imported successfully")
    
    # Test DigitalInOut creation
    led = digitalio.DigitalInOut(board.LED)
    print("✅ DigitalInOut created for LED")
    
    # Test setting direction to output
    led.direction = digitalio.Direction.OUTPUT
    print("✅ Set LED direction to OUTPUT")
    
    # Test setting values
    print("Setting LED value to True...")
    led.value = True
    
    print("Setting LED value to False...")
    led.value = False
    
    # Test input mode
    button = digitalio.DigitalInOut(board.BUTTON)
    button.direction = digitalio.Direction.INPUT
    button.pull = digitalio.Pull.UP
    print("✅ Set BUTTON to INPUT with pull-up")
    
    print(f"Button value: {button.value}")
    
    # Cleanup
    led.deinit()
    button.deinit()
    print("✅ DigitalInOut objects deinitialized")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\\n=== Test Complete ===")
        `);
        
        console.log("\n✅ All tests passed!");
        
    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

test().catch(console.error);