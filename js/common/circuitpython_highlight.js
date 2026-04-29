// CircuitPython syntax highlighting overlay for CodeMirror 6.
//
// CodeMirror 6 dropped the simple `extra_keywords` mechanism that CM5 had,
// so instead of forking @codemirror/lang-python we layer extra decorations
// on top of the existing Python syntax tree. We walk the tree inside the
// viewport, find identifier nodes whose text matches a CircuitPython name,
// and tag them with a CSS class that the theme can style.

import { ViewPlugin, Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

// CircuitPython core/built-in modules. These are the names that appear in
// `import foo` / `from foo import ...` inside CircuitPython code and are
// the most consistent thing we can match without parsing semantics.
//
// Keep this list focused on modules that ship with CircuitPython (or are
// extremely common Adafruit libraries). Anything we add here will be
// highlighted whenever the identifier appears, so we want low false-positive
// risk against regular Python code.
const CIRCUITPYTHON_MODULES = new Set([
    // Core built-in CircuitPython modules
    "adafruit_bus_device",
    "aesio",
    "alarm",
    "analogbufio",
    "analogio",
    "atexit",
    "audiobusio",
    "audiocore",
    "audioio",
    "audiomixer",
    "audiomp3",
    "audiopwmio",
    "bitbangio",
    "bitmapfilter",
    "bitmaptools",
    "bitops",
    "board",
    "busdisplay",
    "busio",
    "canio",
    "codeop",
    "countio",
    "digitalio",
    "displayio",
    "dotclockframebuffer",
    "dualbank",
    "epaperdisplay",
    "espidf",
    "espnow",
    "espulp",
    "floppyio",
    "fontio",
    "framebufferio",
    "frequencyio",
    "getpass",
    "gifio",
    "i2cdisplaybus",
    "i2cperipheral",
    "i2ctarget",
    "imagecapture",
    "is31fl3741",
    "jpegio",
    "keypad",
    "keypad_demux",
    "lsm6ds",
    "max3421e",
    "mdns",
    "memorymap",
    "memorymonitor",
    "microcontroller",
    "msgpack",
    "neopixel_write",
    "nvm",
    "onewireio",
    "paralleldisplay",
    "paralleldisplaybus",
    "picodvi",
    "pulseio",
    "pwmio",
    "qrio",
    "rainbowio",
    "rgbmatrix",
    "rotaryio",
    "rp2pio",
    "rtc",
    "sdcardio",
    "sdioio",
    "sharpdisplay",
    "socketpool",
    "spitarget",
    "ssl",
    "storage",
    "supervisor",
    "synthio",
    "terminalio",
    "tilepalettemapper",
    "touchio",
    "traceback",
    "uheap",
    "ulab",
    "usb",
    "usb_cdc",
    "usb_hid",
    "usb_host",
    "usb_midi",
    "usb_video",
    "ustack",
    "vectorio",
    "warnings",
    "watchdog",
    "wifi",
    "zlib",

    // Very common Adafruit/CircuitPython community libraries that users see
    // imported all the time. Underscore-prefixed Adafruit names are already
    // distinctive enough that false positives are essentially nil.
    "adafruit_ble",
    "adafruit_connection_manager",
    "adafruit_datetime",
    "adafruit_display_shapes",
    "adafruit_display_text",
    "adafruit_displayio_layout",
    "adafruit_displayio_sh1106",
    "adafruit_displayio_ssd1306",
    "adafruit_dotstar",
    "adafruit_fakerequests",
    "adafruit_framebuf",
    "adafruit_hid",
    "adafruit_httpserver",
    "adafruit_imageload",
    "adafruit_io",
    "adafruit_logging",
    "adafruit_matrixportal",
    "adafruit_minimqtt",
    "adafruit_motor",
    "adafruit_ntp",
    "adafruit_pixelbuf",
    "adafruit_pixelmap",
    "adafruit_portalbase",
    "adafruit_register",
    "adafruit_requests",
    "adafruit_sdcard",
    "adafruit_seesaw",
    "adafruit_simplemath",
    "adafruit_ticks",
    "neopixel",
    "simpleio",
]);

const moduleMark = Decoration.mark({ class: "tok-cp-module" });

// Build the decoration set for the part of the document currently visible.
// Walking only visible ranges keeps this cheap on big files.
function buildDecorations(view) {
    const builder = [];
    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter(node) {
                // We care about identifier-like leaves only. Lezer Python emits
                // `VariableName` for bare identifiers (including module names
                // in `import foo` and `from foo import ...`). Module names
                // accessed as attributes (e.g. `adafruit_io.MQTT`) come in as
                // `VariableName` for the leftmost part, then `PropertyName`
                // children — we only mark the root reference.
                if (node.name !== "VariableName") return;
                const text = view.state.doc.sliceString(node.from, node.to);
                if (CIRCUITPYTHON_MODULES.has(text)) {
                    builder.push(moduleMark.range(node.from, node.to));
                }
            },
        });
    }
    // Decoration ranges must be sorted by `from`, which they already are
    // because we iterate the tree in document order.
    return Decoration.set(builder);
}

// ViewPlugin keeps decorations in sync with viewport / document changes.
export const circuitpythonHighlight = ViewPlugin.fromClass(
    class {
        constructor(view) {
            this.decorations = buildDecorations(view);
        }
        update(update) {
            if (
                update.docChanged ||
                update.viewportChanged ||
                syntaxTree(update.startState) !== syntaxTree(update.state)
            ) {
                this.decorations = buildDecorations(update.view);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    },
);
