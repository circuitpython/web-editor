/*
 * This file is part of the MicroPython project, http://micropython.org/
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2023-2024 Damien P. George
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// Options:
// - pystack: size in words of the CircuitPython Python stack.
// - heapsize: size in bytes of the CircuitPython GC heap.
// - url: location to load `circuitpython.mjs`.
// - stdin: function to return input characters.
// - stdout: function that takes one argument, and is passed lines of stdout
//   output as they are produced.  By default this is handled by Emscripten
//   and in a browser goes to console, in node goes to process.stdout.write.
// - stderr: same behaviour as stdout but for error output.
// - linebuffer: whether to buffer line-by-line to stdout/stderr.
// - boardConfiguration: JavaScript object defining board configuration and pin definitions.
export async function loadCircuitPython(options) {
    const { pystack, heapsize, url, stdin, stdout, stderr, linebuffer, boardConfiguration } =
        Object.assign(
            { pystack: 2 * 1024, heapsize: 1024 * 1024, linebuffer: true },
            options,
        );
    let Module = {};
    Module.locateFile = (path, scriptDirectory) =>
        url || scriptDirectory + path;
    Module._textDecoder = new TextDecoder();
    if (stdin !== undefined) {
        Module.stdin = stdin;
    }
    if (stdout !== undefined) {
        if (linebuffer) {
            Module._stdoutBuffer = [];
            Module.stdout = (c) => {
                if (c === 10) {
                    stdout(
                        Module._textDecoder.decode(
                            new Uint8Array(Module._stdoutBuffer),
                        ),
                    );
                    Module._stdoutBuffer = [];
                } else {
                    Module._stdoutBuffer.push(c);
                }
            };
        } else {
            Module.stdout = (c) => stdout(new Uint8Array([c]));
        }
    }
    if (stderr !== undefined) {
        if (linebuffer) {
            Module._stderrBuffer = [];
            Module.stderr = (c) => {
                if (c === 10) {
                    stderr(
                        Module._textDecoder.decode(
                            new Uint8Array(Module._stderrBuffer),
                        ),
                    );
                    Module._stderrBuffer = [];
                } else {
                    Module._stderrBuffer.push(c);
                }
            };
        } else {
            Module.stderr = (c) => stderr(new Uint8Array([c]));
        }
    }
    Module = await _createCircuitPythonModule(Module);
    globalThis.Module = Module;
    proxy_js_init();
    const pyimport = (name) => {
        const value = Module._malloc(3 * 4);
        Module.ccall(
            "mp_js_do_import",
            "null",
            ["string", "pointer"],
            [name, value],
        );
        return proxy_convert_mp_to_js_obj_jsside_with_free(value);
    };
    Module.ccall(
        "mp_js_init",
        "null",
        ["number", "number"],
        [pystack, heapsize],
    );
    Module.ccall("proxy_c_init", "null", [], []);
    
    // Set up JavaScript semihosting if board configuration is provided
    const jsAPI = {
        _module: Module,
        PyProxy: PyProxy,
        FS: Module.FS,
        globals: {
            get __dict__() {
                // Lazy initialization to avoid accessing __main__ before it's ready
                return pyimport("__main__").__dict__;
            },
            get(key) {
                return this.__dict__[key];
            },
            set(key, value) {
                this.__dict__[key] = value;
            },
            delete(key) {
                delete this.__dict__[key];
            },
        },
        registerJsModule(name, module) {
            const value = Module._malloc(3 * 4);
            proxy_convert_js_to_mp_obj_jsside(module, value);
            Module.ccall(
                "mp_js_register_js_module",
                "null",
                ["string", "pointer"],
                [name, value],
            );
            Module._free(value);
        },
        pyimport: pyimport,
        configureBoardPins(pinDefinitions) {
            // Store pin objects globally so they can be accessed by C code
            if (!globalThis._js_pins) {
                globalThis._js_pins = new Map();
            }
            
            // Convert JavaScript pin definitions to WebAssembly
            const pinArray = this._convertPinDefinitions(pinDefinitions);
            const value = Module._malloc(pinArray.length * 4 * 4);
            // Copy pin data to WebAssembly memory
            Module.HEAPU32.set(pinArray, value >> 2);
            
            Module.ccall(
                "mp_js_register_board_pins",
                "null",
                ["pointer", "number"],
                [value, pinDefinitions.length]
            );
            Module._free(value);
        },
        setBoardConfiguration(config) {
            const value = Module._malloc(3 * 4);
            proxy_convert_js_to_mp_obj_jsside(config, value);
            Module.ccall(
                "mp_js_register_board_config", 
                "null",
                ["pointer"],
                [value]
            );
            Module._free(value);
        },
        _convertPinDefinitions(pinDefinitions) {
            // Convert pin definitions to format expected by C code
            const pinArray = new Uint32Array(pinDefinitions.length * 4);
            
            for (let i = 0; i < pinDefinitions.length; i++) {
                const pinDef = pinDefinitions[i];
                const baseIndex = i * 4;
                
                // Create a JavaScript pin object with the required interface
                const jsPin = this._createJavaScriptPin(pinDef);
                
                // Store the pin globally so C code can access it
                const pinId = `pin_${pinDef.name}_${pinDef.number}`;
                globalThis._js_pins.set(pinId, jsPin);
                
                // Convert pin name to qstr (simplified - would need proper qstr handling)
                const nameBytes = Module.lengthBytesUTF8(pinDef.name);
                const namePtr = Module._malloc(nameBytes + 1);
                Module.stringToUTF8(pinDef.name, namePtr, nameBytes + 1);
                pinArray[baseIndex] = namePtr; // Will be converted to qstr in C
                
                // Store JavaScript object reference  
                const jsRef = proxy_js_add_obj(jsPin);
                pinArray[baseIndex + 1] = jsRef;
                
                // Store pin number and capabilities
                pinArray[baseIndex + 2] = pinDef.number || 0;
                pinArray[baseIndex + 3] = this._convertCapabilities(pinDef.capabilities || ['digital_io']);
            }
            
            return pinArray;
        },
        
        _createJavaScriptPin(pinDef) {
            // Create a JavaScript pin object with the interface expected by the C code
            return {
                name: pinDef.name,
                number: pinDef.number,
                capabilities: this._convertCapabilities(pinDef.capabilities || ['digital_io']),
                
                // DigitalInOut interface
                createDigitalInOut() {
                    console.log(`Creating DigitalInOut for pin ${this.name}`);
                    
                    return {
                        pin: this,
                        direction: 0, // INPUT
                        value: false,
                        pull: 0, // NONE
                        driveMode: 0, // PUSH_PULL
                        
                        deinit() {
                            console.log(`DigitalInOut.deinit() for pin ${this.pin.name}`);
                        },
                        
                        switchToInput(pull) {
                            this.direction = 0;
                            this.pull = pull;
                            console.log(`Pin ${this.pin.name}: switch to input, pull=${pull}`);
                        },
                        
                        switchToOutput(value, driveMode) {
                            this.direction = 1;
                            this.value = value;
                            this.driveMode = driveMode;
                            console.log(`Pin ${this.pin.name}: switch to output, value=${value}, driveMode=${driveMode}`);
                        },
                        
                        setValue(value) {
                            this.value = value;
                            console.log(`Pin ${this.pin.name}: set value to ${value}`);
                        },
                        
                        setPull(pull) {
                            this.pull = pull;
                            console.log(`Pin ${this.pin.name}: set pull to ${pull}`);
                        },
                        
                        setDriveMode(driveMode) {
                            this.driveMode = driveMode;
                            console.log(`Pin ${this.pin.name}: set drive mode to ${driveMode}`);
                        }
                    };
                },
                
                // AnalogIn interface  
                createAnalogIn() {
                    console.log(`Creating AnalogIn for pin ${this.name}`);
                    
                    return {
                        pin: this,
                        reference_voltage: 3.3,
                        
                        deinit() {
                            console.log(`AnalogIn.deinit() for pin ${this.pin.name}`);
                        },
                        
                        get value() {
                            // Simulate ADC reading (0-65535 range)
                            const simulated = Math.floor(Math.random() * 65536);
                            console.log(`Pin ${this.pin.name}: ADC reading = ${simulated}`);
                            return simulated;
                        }
                    };
                },
                
                // AnalogOut interface
                createAnalogOut() {
                    console.log(`Creating AnalogOut for pin ${this.name}`);
                    
                    return {
                        pin: this,
                        value: 0,
                        
                        deinit() {
                            console.log(`AnalogOut.deinit() for pin ${this.pin.name}`);
                        },
                        
                        setValue(value) {
                            this.value = value;
                            const voltage = (value / 65535) * 3.3;
                            console.log(`Pin ${this.pin.name}: DAC output = ${value} (${voltage.toFixed(2)}V)`);
                        }
                    };
                }
            };
        },
        _convertCapabilities(capabilityStrings) {
            // Convert capability strings to bitmask
            let capabilities = 0;
            const capMap = {
                'digital_io': 1 << 0,  // JS_PIN_CAP_DIGITAL_IO
                'analog_in': 1 << 1,   // JS_PIN_CAP_ANALOG_IN  
                'analog_out': 1 << 2,  // JS_PIN_CAP_ANALOG_OUT
                'pwm': 1 << 3,         // JS_PIN_CAP_PWM
                'spi': 1 << 4,         // JS_PIN_CAP_SPI
                'i2c': 1 << 5,         // JS_PIN_CAP_I2C
                'uart': 1 << 6         // JS_PIN_CAP_UART
            };
            
            capabilityStrings.forEach(cap => {
                if (capMap[cap]) {
                    capabilities |= capMap[cap];
                }
            });
            
            return capabilities;
        },
        runPython(code) {
            const len = Module.lengthBytesUTF8(code);
            const buf = Module._malloc(len + 1);
            Module.stringToUTF8(code, buf, len + 1);
            const value = Module._malloc(3 * 4);
            Module.ccall(
                "mp_js_do_exec",
                "number",
                ["pointer", "number", "pointer"],
                [buf, len, value],
            );
            Module._free(buf);
            return proxy_convert_mp_to_js_obj_jsside_with_free(value);
        },
        runPythonAsync(code) {
            const len = Module.lengthBytesUTF8(code);
            const buf = Module._malloc(len + 1);
            Module.stringToUTF8(code, buf, len + 1);
            const value = Module._malloc(3 * 4);
            Module.ccall(
                "mp_js_do_exec_async",
                "number",
                ["pointer", "number", "pointer"],
                [buf, len, value],
            );
            Module._free(buf);
            const ret = proxy_convert_mp_to_js_obj_jsside_with_free(value);
            if (ret instanceof PyProxyThenable) {
                return Promise.resolve(ret);
            }
            return ret;
        },
        
        // Global I2C creation function (called by C code)
        createI2C(scl_pin_num, sda_pin_num, frequency) {
            console.log(`Creating I2C: SCL=${scl_pin_num}, SDA=${sda_pin_num}, freq=${frequency}Hz`);
            
            const i2cId = `i2c_${scl_pin_num}_${sda_pin_num}`;
            const i2cObj = {
                scl: scl_pin_num,
                sda: sda_pin_num,
                frequency: frequency,
                locked: false,
                devices: new Map(), // Simulated I2C device memory
                
                deinit() {
                    console.log(`I2C deinit (SCL=${this.scl}, SDA=${this.sda})`);
                },
                
                tryLock() {
                    if (!this.locked) {
                        this.locked = true;
                        console.log(`I2C locked (SCL=${this.scl}, SDA=${this.sda})`);
                        return true;
                    }
                    return false;
                },
                
                get hasLock() {
                    return this.locked;
                },
                
                unlock() {
                    this.locked = false;
                    console.log(`I2C unlocked (SCL=${this.scl}, SDA=${this.sda})`);
                },
                
                scan(address) {
                    // Simulate device detection - return 0 for success, 1 for no device
                    const hasDevice = this.devices.has(address) || Math.random() > 0.7;
                    console.log(`I2C scan address 0x${address.toString(16).padStart(2, '0')}: ${hasDevice ? 'found' : 'not found'}`);
                    return hasDevice ? 0 : 1;
                },
                
                writeto(address, data, stop = true) {
                    console.log(`I2C write to 0x${address.toString(16).padStart(2, '0')}: ${data.length} bytes, stop=${stop}`);
                    // Simulate storing data in device memory
                    if (!this.devices.has(address)) {
                        this.devices.set(address, new Uint8Array(256));
                    }
                    // Store first few bytes for simulation
                    const deviceMem = this.devices.get(address);
                    for (let i = 0; i < Math.min(data.length, deviceMem.length); i++) {
                        deviceMem[i] = data[i];
                    }
                    return 0; // Success
                },
                
                readfrom(address, length) {
                    console.log(`I2C read from 0x${address.toString(16).padStart(2, '0')}: ${length} bytes`);
                    // Return simulated data
                    if (!this.devices.has(address)) {
                        this.devices.set(address, new Uint8Array(256).map((_, i) => i & 0xFF));
                    }
                    const deviceMem = this.devices.get(address);
                    return deviceMem.slice(0, length);
                },
                
                writeto_then_readfrom(address, writeData, readLength) {
                    console.log(`I2C write-then-read to 0x${address.toString(16).padStart(2, '0')}: write ${writeData.length} bytes, read ${readLength} bytes`);
                    // Simulate register read: write data contains register address
                    this.writeto(address, writeData, false); // No stop bit
                    return this.readfrom(address, readLength);
                }
            };
            
            // Store globally and return reference ID
            if (!globalThis._js_i2c_devices) {
                globalThis._js_i2c_devices = new Map();
            }
            const refId = Math.floor(Math.random() * 1000000);
            globalThis._js_i2c_devices.set(refId, i2cObj);
            return refId;
        },
        
        // Global SPI creation function (called by C code)
        createSPI(clock_pin_num, mosi_pin_num, miso_pin_num) {
            console.log(`Creating SPI: SCLK=${clock_pin_num}, MOSI=${mosi_pin_num || 'none'}, MISO=${miso_pin_num || 'none'}`);
            
            const spiObj = {
                clock: clock_pin_num,
                mosi: mosi_pin_num,
                miso: miso_pin_num,
                baudrate: 100000,
                polarity: 0,
                phase: 0,
                bits: 8,
                locked: false,
                
                deinit() {
                    console.log(`SPI deinit (SCLK=${this.clock})`);
                },
                
                configure(baudrate, polarity, phase, bits) {
                    this.baudrate = baudrate;
                    this.polarity = polarity;
                    this.phase = phase;
                    this.bits = bits;
                    console.log(`SPI configure: ${baudrate}Hz, pol=${polarity}, pha=${phase}, ${bits}bits`);
                },
                
                tryLock() {
                    if (!this.locked) {
                        this.locked = true;
                        console.log(`SPI locked`);
                        return true;
                    }
                    return false;
                },
                
                get hasLock() {
                    return this.locked;
                },
                
                unlock() {
                    this.locked = false;
                    console.log(`SPI unlocked`);
                },
                
                write(data) {
                    console.log(`SPI write: ${data.length} bytes [${Array.from(data.slice(0, 8)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}${data.length > 8 ? '...' : ''}]`);
                },
                
                readinto(length, writeValue = 0) {
                    console.log(`SPI read: ${length} bytes (write 0x${writeValue.toString(16).padStart(2, '0')})`);
                    // Return simulated data
                    return new Uint8Array(length).map(() => Math.floor(Math.random() * 256));
                },
                
                write_readinto(writeData) {
                    console.log(`SPI transfer: ${writeData.length} bytes`);
                    // Return simulated response data
                    return new Uint8Array(writeData.length).map(() => Math.floor(Math.random() * 256));
                }
            };
            
            // Store globally and return reference ID
            if (!globalThis._js_spi_devices) {
                globalThis._js_spi_devices = new Map();
            }
            const refId = Math.floor(Math.random() * 1000000);
            globalThis._js_spi_devices.set(refId, spiObj);
            return refId;
        },
        // Stdin input functions for REPL
        writeStdinChar(char) {
            const charCode = typeof char === 'string' ? char.charCodeAt(0) : char;
            Module.ccall("mp_js_stdin_write_char", "null", ["number"], [charCode]);
        },
        writeStdinString(str) {
            const len = Module.lengthBytesUTF8(str);
            const buf = Module._malloc(len + 1);
            Module.stringToUTF8(str, buf, len + 1);
            Module.ccall("mp_js_stdin_write_str", "null", ["pointer", "number"], [buf, len]);
            Module._free(buf);
        },
        isStdinRawMode() {
            return Module.ccall("mp_hal_is_stdin_raw_mode", "boolean", []);
        },
        replInit() {
            Module.ccall("mp_js_repl_init", "null", ["null"]);
        },
        replProcessChar(chr) {
            return Module.ccall(
                "mp_js_repl_process_char",
                "number",
                ["number"],
                [chr],
            );
        },
        // Needed if the GC/asyncify is enabled.
        async replProcessCharWithAsyncify(chr) {
            return Module.ccall(
                "mp_js_repl_process_char",
                "number",
                ["number"],
                [chr],
                { async: true },
            );
        },
    };
    
    // Apply board configuration if provided
    if (boardConfiguration) {
        if (boardConfiguration.pins && Array.isArray(boardConfiguration.pins)) {
            jsAPI.configureBoardPins(boardConfiguration.pins);
        }
        
        // Set board configuration object
        jsAPI.setBoardConfiguration(boardConfiguration);
    }
    
    return jsAPI;
}

globalThis.loadCircutPython = loadCircuitPython;

async function runCLI() {
    const fs = await import("fs");
    let heap_size = 128 * 1024;
    let contents = "";
    let repl = true;

    for (let i = 2; i < process.argv.length; i++) {
        if (process.argv[i] === "-X" && i < process.argv.length - 1) {
            if (process.argv[i + 1].includes("heapsize=")) {
                heap_size = parseInt(process.argv[i + 1].split("heapsize=")[1]);
                const suffix = process.argv[i + 1].substr(-1).toLowerCase();
                if (suffix === "k") {
                    heap_size *= 1024;
                } else if (suffix === "m") {
                    heap_size *= 1024 * 1024;
                }
                ++i;
            }
        } else {
            contents += fs.readFileSync(process.argv[i], "utf8");
            repl = false;
        }
    }

    if (process.stdin.isTTY === false) {
        contents = fs.readFileSync(0, "utf8");
        repl = false;
    }

    const cp = await loadCircuitPython({
        heapsize: heap_size,
        stdout: (data) => process.stdout.write(data),
        linebuffer: false,
    });

    if (repl) {
        cp.replInit();
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        process.stdin.on("data", (data) => {
            for (let i = 0; i < data.length; i++) {
                cp.replProcessCharWithAsyncify(data[i]).then((result) => {
                    if (result) {
                        process.exit();
                    }
                });
            }
        });
    } else {
        // If the script to run ends with a running of the asyncio main loop, then inject
        // a simple `asyncio.run` hook that starts the main task.  This is primarily to
        // support running the standard asyncio tests.
        if (contents.endsWith("asyncio.run(main())\n")) {
            const asyncio = cp.pyimport("asyncio");
            asyncio.run = async (task) => {
                await asyncio.create_task(task);
            };
        }

        try {
            cp.runPython(contents);
        } catch (error) {
            if (error.name === "PythonError") {
                if (error.type === "SystemExit") {
                    // SystemExit, this is a valid exception to successfully end a script.
                } else {
                    // An unhandled Python exception, print in out.
                    console.error(error.message);
                }
            } else {
                // A non-Python exception.  Re-raise it.
                throw error;
            }
        }
    }
}

// Check if Node is running (equivalent to ENVIRONMENT_IS_NODE).
if (
    typeof process === "object" &&
    typeof process.versions === "object" &&
    typeof process.versions.node === "string"
) {
    // Check if this module is run from the command line via `node circuitpython.mjs`.
    //
    // See https://stackoverflow.com/questions/6398196/detect-if-called-through-require-or-directly-by-command-line/66309132#66309132
    //
    // Note:
    // - `resolve()` is used to handle symlinks
    // - `includes()` is used to handle cases where the file extension was omitted when passed to node

    if (process.argv.length > 1) {
        const path = await import("path");
        const url = await import("url");

        const pathToThisFile = path.resolve(url.fileURLToPath(import.meta.url));
        const pathPassedToNode = path.resolve(process.argv[1]);
        const isThisFileBeingRunViaCLI =
            pathToThisFile.includes(pathPassedToNode);

        if (isThisFileBeingRunViaCLI) {
            runCLI();
        }
    }
}
