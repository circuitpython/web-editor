// CircuitPython syntax highlighting overlay for CodeMirror 6.
//
// CodeMirror 6 dropped the simple `extra_keywords` mechanism that CM5 had,
// so instead of forking @codemirror/lang-python we layer extra decorations
// on top of the existing Python syntax tree. We walk the tree inside the
// viewport, find identifier nodes whose text matches a CircuitPython name,
// and tag them with a CSS class that the theme can style.

import { ViewPlugin, Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Prec } from "@codemirror/state";

// Core/built-in CircuitPython modules. These are the identifiers that show
// up in `import foo` / `from foo import ...` inside CircuitPython code.
//
// Sourced from the upstream `shared-bindings/` directory in
// adafruit/circuitpython, plus port-specific bindings that are widely used
// (espidf/espnow/espulp on ESP, picodvi/rp2pio on RP2). Standard-Python
// modules that CircuitPython also exposes (math, os, time, random, struct,
// hashlib, ipaddress, locale, __future__) are intentionally omitted — they
// aren't CircuitPython-specific and highlighting them as such would be
// noisy in regular Python code shown in the editor.
//
// Underscore-prefixed internal bindings (_bleio, _eve, _pew, _pixelmap,
// _stage) are also omitted; users access those via the corresponding
// `adafruit_*` libraries which are matched by the prefix wildcard below.
//
// Third-party Adafruit libraries are matched by the `adafruit_` prefix
// instead of being listed individually, and community-bundle libraries by
// the `circuitpython_` prefix, so this set only needs updating when a new
// shared binding lands upstream.
const CIRCUITPYTHON_CORE_MODULES = new Set([
    "aesio",
    "alarm",
    "analogbufio",
    "analogio",
    "atexit",
    "audiobusio",
    "audiocore",
    "audiodelays",
    "audiofilters",
    "audiofreeverb",
    "audioio",
    "audiomixer",
    "audiomp3",
    "audiopwmio",
    "audiospeed",
    "aurora_epaper",
    "bitbangio",
    "bitmapfilter",
    "bitmaptools",
    "bitops",
    "board",
    "busdisplay",
    "busio",
    "camera",
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
    "fourwire",
    "framebufferio",
    "frequencyio",
    "getpass",
    "gifio",
    "gnss",
    "i2cdisplaybus",
    "i2cioexpander",
    "i2ctarget",
    "imagecapture",
    "is31fl3741",
    "jpegio",
    "keypad",
    "keypad_demux",
    "lvfontio",
    "max3421e",
    "mcp4822",
    "mdns",
    "memorymap",
    "memorymonitor",
    "microcontroller",
    "mipidsi",
    "msgpack",
    "neopixel_write",
    "nvm",
    "onewireio",
    "paralleldisplaybus",
    "picodvi",
    "ps2io",
    "pulseio",
    "pwmio",
    "qrio",
    "qspibus",
    "rainbowio",
    "rclcpy",
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

    // Early Adafruit-maintained libraries that predate the `adafruit_`
    // naming convention and shipped without a prefix. Listed explicitly
    // because the prefix wildcard below can't catch them.
    "neopixel",
    "simpleio",
]);

// Returns true when `name` is a CircuitPython module worth highlighting.
// Wildcard-matches anything starting with `adafruit_` (Adafruit-maintained
// libraries) or `circuitpython_` (community bundle libraries) so new
// libraries light up automatically without touching this file. Both
// prefixes are distinctive enough that false positives against ordinary
// Python code are essentially nil.
function isCircuitPythonModule(name) {
    if (CIRCUITPYTHON_CORE_MODULES.has(name)) return true;
    if (name.startsWith("adafruit_") && name.length > "adafruit_".length) {
        return true;
    }
    if (
        name.startsWith("circuitpython_") &&
        name.length > "circuitpython_".length
    ) {
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
const circuitpythonHighlightPlugin = ViewPlugin.fromClass(
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

// Wrap the plugin with Prec.highest so its decoration nests inside the
// classHighlighter span. CodeMirror renders overlapping mark decorations
// as nested spans where higher-precedence decorations end up closer to
// the text. The inner span’s `color` is what the user sees, so making
// `tok-cp-module` the inner class is what lets our pink override the
// underlying `tok-variableName` blue without resorting to !important.
export const circuitpythonHighlight = Prec.highest(circuitpythonHighlightPlugin);
