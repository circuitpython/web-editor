// CircuitPython syntax highlighting overlay for CodeMirror 6.
//
// CodeMirror 6 dropped the simple `extra_keywords` mechanism that CM5 had,
// so instead of forking @codemirror/lang-python we layer extra decorations
// on top of the existing Python syntax tree. We walk the tree inside the
// viewport, find identifier nodes whose text matches a CircuitPython name,
// and tag them with a CSS class that the theme can style.

import { ViewPlugin, Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

// Core/built-in CircuitPython modules. These are the identifiers that show
// up in `import foo` / `from foo import ...` inside CircuitPython code.
//
// Anything in this set is highlighted whenever it appears as a bare
// identifier, so it should stay focused on names that ship with
// CircuitPython itself. Third-party Adafruit libraries are matched by
// the `adafruit_` prefix below instead of being listed individually,
// which avoids list maintenance every time a new library lands on PyPI.
const CIRCUITPYTHON_CORE_MODULES = new Set([
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

    // Bare-named community modules without the `adafruit_` prefix that are
    // common enough to be worth recognising explicitly.
    "neopixel",
    "simpleio",
]);

// Returns true when `name` is a CircuitPython module worth highlighting.
// Wildcard-matches anything starting with `adafruit_` so new libraries
// (e.g. `adafruit_foo_bar` shipped next month) light up automatically
// without touching this file.
function isCircuitPythonModule(name) {
    if (CIRCUITPYTHON_CORE_MODULES.has(name)) return true;
    if (name.startsWith("adafruit_") && name.length > "adafruit_".length) {
        return true;
    }
    return false;
}

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
                if (isCircuitPythonModule(text)) {
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
