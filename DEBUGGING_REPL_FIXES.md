# CircuitPython REPL Debugging - Fix Attempts Log

## Problem Statement
CircuitPython WebAssembly REPL in web-editor has broken interactive functionality. While `help("modules")` works correctly, basic operations like `import os` followed by `dir(os)` fail with syntax errors or produce no output.

## Summary of Attempted Fixes

### 1. **Modern CircuitPythonBridge Integration Attempt**
- **Goal**: Replace old broken integration with modern SharedArrayBuffer-based architecture
- **Changes Made**:
  - Copied modern bridge files (`circuitpython-bridge.js`, `browser.js`, `universal-hardware-bridge.js`) to web-editor
  - Created `circuitpython-wasm-worker-modern.js` using `CircuitPythonBridge` class
  - Updated `virtual.js` to use `ModernCircuitPythonWASM` instead of `CircuitPythonWASM`
  - Changed to async/await API calls
- **Result**: Failed with `allocateUTF8 was not exported` errors
- **Files Modified**: `virtual.js`, `circuitpython-wasm-worker-modern.js` (new)

### 2. **Import Path Fix**
- **Issue**: CircuitPythonBridge trying to import `./build-standard/circuitpython.mjs`
- **Fix**: Changed import to `./circuitpython.mjs` (correct location in web-editor)
- **Result**: Fixed import error but didn't resolve core functionality
- **Files Modified**: `lib/circuitpython-wasm/circuitpython-bridge.js`

### 3. **API Compatibility Fixes for CircuitPythonBridge**
- **Issue**: Modern bridge used functions not exported from our WASM build
- **Attempted Fixes**:
  - Replaced `allocateUTF8`/`_free` with simple `_mp_js_exec(code)` calls
  - Simplified `importModule` to use `execute()` method  
  - Removed complex memory allocation approach
- **Result**: Still had function availability issues (`_mp_js_exec function not available`)
- **Files Modified**: `lib/circuitpython-wasm/circuitpython-bridge.js`

### 4. **Function Name Correction in Bridge**
- **Issue**: `_mp_js_exec` function doesn't exist in our WASM build
- **Discovery**: Found correct function is `_mp_js_do_exec` via grep search of WASM port
- **Fix Attempted**: Updated CircuitPythonBridge to use `_mp_js_do_exec` with proper memory allocation
- **Result**: Didn't complete integration due to complexity
- **Files Modified**: `lib/circuitpython-wasm/circuitpython-bridge.js`

### 5. **Reversion to Old Working Approach**
- **Goal**: Go back to proven `CircuitPythonWASM` worker that worked for `help("modules")`
- **Changes**:
  - Reverted `virtual.js` imports back to `CircuitPythonWASM`
  - Removed modern async/await calls
  - Restored character-by-character processing via `processChar`
- **Result**: Back to original broken character-per-line REPL behavior
- **Symptoms**: Each character appeared on separate line, syntax errors on basic commands
- **Files Modified**: `virtual.js`

### 6. **REPL Input Buffering Implementation**
- **Goal**: Fix character-by-character issues by buffering input
- **Implementation**:
  - Added `replBuffer` property to `VirtualWorkflow`
  - Modified `serialTransmit` to buffer characters until newline
  - Used direct `executeCode()` calls instead of `processChar()`
  - Added backspace handling and character echoing
- **Result**: Fixed character display but commands executed without output
- **Files Modified**: `virtual.js`

### 7. **REPL Prompt Handling Fix**  
- **Issue**: Missing prompts and poor command flow
- **Fix**: Added proper `>>> ` prompt display after each command execution
- **Result**: Prompts appeared correctly but output still missing from most commands
- **Files Modified**: `virtual.js`

### 8. **WASM Worker Function Fix**
- **Issue**: `_mp_js_exec` doesn't exist in WASM build, causing fallback to broken REPL processing
- **Fix**: Updated worker to use `_mp_js_do_exec` with proper memory allocation:
  ```javascript
  if (this.module._mp_js_do_exec) {
      const outputPtr = this.module._malloc(4);
      this.module._mp_js_do_exec(code, outputPtr);
      this.module._free(outputPtr);
      return 0;
  }
  ```
- **Current Status**: Commands execute without syntax errors but produce no visible output
- **Files Modified**: `circuitpython-wasm-worker.js`

## Current State Analysis

### What Works ✅
- `help("modules")` displays full module list correctly
- Commands are accepted without syntax errors  
- REPL doesn't crash or show memory access errors
- Basic execution flow is functional
- Clean banner display: "Adafruit CircuitPython 10.0.0-beta.2-25 on WebAssembly"

### What's Broken ❌
- Interactive expressions like `dir(os)` produce no output
- Import statements execute but imported modules don't seem accessible for subsequent commands
- No visible output from most Python expressions/function calls
- Module imports may not persist between command executions

### Root Cause Hypothesis
The issue appears to be that `_mp_js_do_exec` executes code but doesn't properly handle output capture/display for the REPL context. The function works for some commands (`help("modules")`) but not others (`dir(os)`), suggesting:

1. Different commands use different output mechanisms
2. `_mp_js_do_exec` may need different parameters for proper output handling
3. Expression results vs statement execution may need different approaches
4. Output may need to be explicitly captured and displayed

## Key Technical Discoveries

### Available WASM Functions (via grep)
- `_mp_js_init_with_heap()` - Initialize with heap size
- `_mp_js_do_exec(code, output_ptr)` - Execute code with output pointer  
- `_mp_js_repl_init()` - Initialize REPL (but REPL processing is broken)
- `_mp_js_repl_process_char()` - Process single character (causes memory errors)
- `_mp_js_register_js_module()` - Register JS modules

### Missing/Non-existent Functions
- `_mp_js_exec()` - Simple execute function (doesn't exist)
- `allocateUTF8()` - String allocation (not exported)
- `_free()` - Memory deallocation (availability unclear)

## Files Modified During Debugging

### Core Files
- `/home/jef/dev/web-editor/js/workflows/virtual.js` - Main workflow logic
- `/home/jef/dev/web-editor/js/circuitpython-wasm-worker.js` - WASM worker interface

### Created Files  
- `/home/jef/dev/web-editor/js/circuitpython-wasm-worker-modern.js` - Modern worker attempt
- `/home/jef/dev/web-editor/lib/circuitpython-wasm/circuitpython-bridge.js` - Modern bridge

### Reference Files (not modified)
- `/home/jef/dev/wasm/circuitpython/ports/webassembly/test_output_direct.js` - Shows working `_mp_js_do_exec` usage
- `/home/jef/dev/wasm/circuitpython/ports/webassembly/repl.mjs` - Reference REPL implementation

## Next Steps for Debugging

### High Priority
1. **Investigate output handling difference**: Why does `help("modules")` work but `dir(os)` doesn't?
2. **Examine `_mp_js_do_exec` parameters**: Check reference implementations for proper usage
3. **Test expression vs statement handling**: May need different execution approaches
4. **Verify output capture mechanism**: Ensure output is being captured from WASM and displayed

### Medium Priority  
5. **Check namespace persistence**: Verify imports persist between command executions
6. **Review memory management**: Ensure proper malloc/free usage with `_mp_js_do_exec`
7. **Compare with working examples**: Study `test_output_direct.js` for correct patterns

### Reference Implementation Analysis Needed
- How does `test_output_direct.js` handle output from `_mp_js_do_exec`?
- What parameters does `_mp_js_do_exec` actually expect?
- How should output pointers be used for result capture?

## Current Code Status
- **Branch**: main
- **Last Working Commit**: Unknown (REPL has been broken throughout debugging)
- **Files Need Revert**: Potentially `circuitpython-wasm-worker.js` if current approach fails
- **Backup Approach**: May need to implement proper REPL using working character processing but with better input handling

---
*Generated: 2025-09-07*  
*Context: CircuitPython WebAssembly REPL debugging session*