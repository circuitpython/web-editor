# CircuitPython WebAssembly Web Editor Integration

This fork of the CircuitPython Web Editor now includes a custom CircuitPython WebAssembly implementation with multiple entry points and virtual hardware simulation.

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   ```
   http://localhost:3000
   ```

## ✨ New Features Added

### Virtual Hardware Panel
- **Real-time visualization** of virtual CircuitPython hardware
- **Interactive pins** - click Toggle buttons to simulate input
- **Multiple pin types**: Digital I/O, Analog inputs, LED, Button
- **Live updates** as your CircuitPython code runs

### Integrated CircuitPython WebAssembly
- **Minimal entry point** optimized for web editor use
- **Virtual hardware simulation** - no physical device needed
- **Real-time execution** with immediate visual feedback
- **Compatible with standard CircuitPython code**

## 🎯 Demo Examples

### Basic LED Control
```python
import board
import digitalio

# Set up virtual LED
led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

# Turn LED on
led.value = True
```

### Analog Reading
```python
import board
import analogio

# Set up analog sensor
sensor = analogio.AnalogIn(board.A0)

# Read analog value
value = sensor.value
voltage = (value / 65535) * 3.3
print(f"Sensor: {value} ({voltage:.2f}V)")
```

### GPIO Pattern Demo
```python
import board
import digitalio
import time

# Set up multiple pins
pins = []
for i in range(4):
    pin = digitalio.DigitalInOut(getattr(board, f'GP{i}'))
    pin.direction = digitalio.Direction.OUTPUT
    pins.append(pin)

# Create light pattern
pattern = [True, False, True, False]
for i, state in enumerate(pattern):
    pins[i].value = state
    time.sleep(0.5)
```

## 📁 Project Structure

### New Files Added
- `lib/circuitpython-wasm/` - Our CircuitPython WebAssembly implementation
- `js/circuitpython-integration.js` - Web editor integration layer
- `sass/circuitpython-virtual-hardware.scss` - Virtual hardware panel styles
- `examples/circuitpython-demo.py` - Complete demo script

### Integration Points
- **HTML**: Added script and style imports
- **Vite Config**: Configured for localhost:3000
- **Package.json**: Ready for CircuitPython dependencies

## 🔧 Architecture

### CircuitPython Entry Points Available
1. **Minimal** (default for web editor) - Fast, lightweight, virtual-only
2. **Browser** - Full browser features with WebSerial/WebUSB
3. **Worker** - Web Worker for parallel processing
4. **Node.js** - Native serial port access
5. **Universal** - Auto-detecting environment

### Virtual Hardware System
- **Pin Management**: Tracks all virtual pins and their states
- **Visual Feedback**: Real-time updates in hardware panel
- **Interactive Controls**: Manual pin toggling for testing
- **Hardware Simulation**: Realistic pin behavior simulation

## 🎮 Usage Instructions

### 1. Load the Demo
- Open the web editor at `http://localhost:3000`
- The virtual hardware panel appears on the right side
- CircuitPython initializes automatically

### 2. Run Example Code
- Copy code from `examples/circuitpython-demo.py`
- Paste into the editor
- Click "Save + Run" to execute
- Watch the virtual hardware panel update in real-time!

### 3. Interactive Testing
- Run code that creates virtual pins
- Click "Toggle" buttons in the hardware panel
- Observe pin state changes
- Use "Reset Hardware" to clear all pins

### 4. Write Your Own Code
- Use standard CircuitPython syntax
- All `board.*` pins work virtually
- `digitalio` and `analogio` modules fully supported
- `time.sleep()` works for animations

## 🏗️ Development

### Building CircuitPython WASM
If you need to rebuild the CircuitPython WebAssembly module:

```bash
cd /path/to/circuitpython/ports/webassembly
make VARIANT=minimal-interpreter
cp build-minimal/*.wasm /path/to/web-editor/public/
cp build-minimal/*.mjs /path/to/web-editor/public/
```

### Extending the Integration
The integration is modular and extensible:

- **Add new pin types**: Extend `CircuitPythonWebEditor.addVirtualPin()`
- **Custom hardware display**: Modify `sass/circuitpython-virtual-hardware.scss`
- **Additional CircuitPython features**: Update `lib/circuitpython-wasm/`

## 🌐 Browser Support

- **Chrome/Edge**: Full support with WebSerial/WebUSB
- **Firefox**: Virtual hardware only (no WebSerial)
- **Safari**: Virtual hardware only
- **Mobile**: Responsive virtual hardware panel

## 🚀 Production Deployment

For production builds:

```bash
npm run build
```

Deploy the `dist/` folder to any static web server.

## 🎯 Educational Use Cases

### Perfect for Learning:
- **Python syntax** without hardware setup
- **CircuitPython concepts** with visual feedback
- **Hardware interaction** through simulation
- **Rapid prototyping** of embedded code
- **Classroom demonstrations** without physical devices

### Teacher Resources:
- **Live coding demos** with immediate visual results
- **Student exercises** with virtual hardware
- **Assignment creation** with built-in examples
- **Progress tracking** through hardware panel interaction

## 🔗 Links

- **Original Web Editor**: https://github.com/circuitpython/web-editor
- **CircuitPython**: https://circuitpython.org
- **Our WASM Port**: https://github.com/johnnohj/circuitpython/tree/wasm

---

**Ready to explore CircuitPython in your browser with virtual hardware!** 🎉