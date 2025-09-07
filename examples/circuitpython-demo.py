# CircuitPython Virtual Hardware Demo
# This demo shows how to use CircuitPython in the web editor with virtual hardware

import board
import digitalio
import analogio
import time

print("🎉 Welcome to CircuitPython Virtual Hardware Demo!")
print("Watch the virtual hardware panel on the right!")
print()

# Set up virtual LED
print("Setting up virtual LED...")
led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

# Set up virtual button
print("Setting up virtual button...")
button = digitalio.DigitalInOut(board.BUTTON)
button.direction = digitalio.Direction.INPUT

# Set up analog input
print("Setting up analog sensor...")
sensor = analogio.AnalogIn(board.A0)

print()
print("=== Virtual Hardware Demo ===")

# LED blink demo
print("1. LED Blink Demo")
for i in range(5):
    print(f"   LED ON  - Blink {i+1}/5")
    led.value = True
    time.sleep(0.5)
    
    print(f"   LED OFF - Blink {i+1}/5")
    led.value = False
    time.sleep(0.5)

print()

# Button and sensor reading demo
print("2. Sensor Reading Demo")
for i in range(3):
    print(f"   Reading sensors... {i+1}/3")
    
    # Read button (will be random in virtual mode)
    button_state = button.value
    print(f"   Button: {'PRESSED' if button_state else 'NOT PRESSED'}")
    
    # Read analog sensor (will be random in virtual mode)
    sensor_value = sensor.value
    voltage = (sensor_value / 65535) * 3.3
    print(f"   Analog Sensor: {sensor_value} ({voltage:.2f}V)")
    
    time.sleep(1)

print()

# Interactive demo
print("3. Interactive Demo")
print("Try clicking the 'Toggle' buttons in the virtual hardware panel!")
print("You can interact with the virtual pins while code is running.")

# GPIO pin demo
print("Setting up additional GPIO pins...")
pins = []
for i in range(4):
    pin = digitalio.DigitalInOut(getattr(board, f'GP{i}'))
    pin.direction = digitalio.Direction.OUTPUT
    pins.append(pin)
    print(f"   GP{i} initialized")

# Pattern demo
print()
print("4. GPIO Pattern Demo")
patterns = [
    [True, False, False, False],
    [False, True, False, False], 
    [False, False, True, False],
    [False, False, False, True],
    [True, True, False, False],
    [False, False, True, True],
    [True, False, True, False],
    [False, True, False, True]
]

for pattern_idx, pattern in enumerate(patterns):
    print(f"   Pattern {pattern_idx + 1}: {pattern}")
    for i, state in enumerate(pattern):
        pins[i].value = state
    time.sleep(0.8)

# Reset all pins
print()
print("Resetting all pins...")
for pin in pins:
    pin.value = False
led.value = False

print()
print("✅ Demo complete!")
print("🔧 Try writing your own CircuitPython code!")
print("💡 Tip: All hardware operations will show up in the virtual hardware panel")