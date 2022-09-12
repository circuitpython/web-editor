import { P as Parser, N as NodeProp, a as NodeSet, b as NodeType, D as DefaultBufferLength, T as Tree, I as IterMode, s as styleTags, t as tags } from '../common/index-172daf4b.js';
import { L as LanguageSupport, a as LRLanguage, i as indentNodeProp, d as delimitedIndent, f as foldNodeProp, b as foldInside } from '../common/index-590af98f.js';
import '../common/index-4fe7f4a0.js';

/* SNOWPACK PROCESS POLYFILL (based on https://github.com/calvinmetcalf/node-process-es6) */
function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
var globalContext;
if (typeof window !== 'undefined') {
    globalContext = window;
} else if (typeof self !== 'undefined') {
    globalContext = self;
} else {
    globalContext = {};
}
if (typeof globalContext.setTimeout === 'function') {
    cachedSetTimeout = setTimeout;
}
if (typeof globalContext.clearTimeout === 'function') {
    cachedClearTimeout = clearTimeout;
}

function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}
function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
}
// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
var title = 'browser';
var platform = 'browser';
var browser = true;
var argv = [];
var version = ''; // empty string to avoid regexp issues
var versions = {};
var release = {};
var config = {};

function noop() {}

var on = noop;
var addListener = noop;
var once = noop;
var off = noop;
var removeListener = noop;
var removeAllListeners = noop;
var emit = noop;

function binding(name) {
    throw new Error('process.binding is not supported');
}

function cwd () { return '/' }
function chdir (dir) {
    throw new Error('process.chdir is not supported');
}function umask() { return 0; }

// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
var performance = globalContext.performance || {};
var performanceNow =
  performance.now        ||
  performance.mozNow     ||
  performance.msNow      ||
  performance.oNow       ||
  performance.webkitNow  ||
  function(){ return (new Date()).getTime() };

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp){
  var clocktime = performanceNow.call(performance)*1e-3;
  var seconds = Math.floor(clocktime);
  var nanoseconds = Math.floor((clocktime%1)*1e9);
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds<0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds,nanoseconds]
}

var startTime = new Date();
function uptime() {
  var currentTime = new Date();
  var dif = currentTime - startTime;
  return dif / 1000;
}

var process = {
  nextTick: nextTick,
  title: title,
  browser: browser,
  env: {"NODE_ENV":"production"},
  argv: argv,
  version: version,
  versions: versions,
  on: on,
  addListener: addListener,
  once: once,
  off: off,
  removeListener: removeListener,
  removeAllListeners: removeAllListeners,
  emit: emit,
  binding: binding,
  cwd: cwd,
  chdir: chdir,
  umask: umask,
  hrtime: hrtime,
  platform: platform,
  release: release,
  config: config,
  uptime: uptime
};

/// A parse stack. These are used internally by the parser to track
/// parsing progress. They also provide some properties and methods
/// that external code such as a tokenizer can use to get information
/// about the parse state.
class Stack {
    /// @internal
    constructor(
    /// The parse that this stack is part of @internal
    p, 
    /// Holds state, input pos, buffer index triplets for all but the
    /// top state @internal
    stack, 
    /// The current parse state @internal
    state, 
    // The position at which the next reduce should take place. This
    // can be less than `this.pos` when skipped expressions have been
    // added to the stack (which should be moved outside of the next
    // reduction)
    /// @internal
    reducePos, 
    /// The input position up to which this stack has parsed.
    pos, 
    /// The dynamic score of the stack, including dynamic precedence
    /// and error-recovery penalties
    /// @internal
    score, 
    // The output buffer. Holds (type, start, end, size) quads
    // representing nodes created by the parser, where `size` is
    // amount of buffer array entries covered by this node.
    /// @internal
    buffer, 
    // The base offset of the buffer. When stacks are split, the split
    // instance shared the buffer history with its parent up to
    // `bufferBase`, which is the absolute offset (including the
    // offset of previous splits) into the buffer at which this stack
    // starts writing.
    /// @internal
    bufferBase, 
    /// @internal
    curContext, 
    /// @internal
    lookAhead = 0, 
    // A parent stack from which this was split off, if any. This is
    // set up so that it always points to a stack that has some
    // additional buffer content, never to a stack with an equal
    // `bufferBase`.
    /// @internal
    parent) {
        this.p = p;
        this.stack = stack;
        this.state = state;
        this.reducePos = reducePos;
        this.pos = pos;
        this.score = score;
        this.buffer = buffer;
        this.bufferBase = bufferBase;
        this.curContext = curContext;
        this.lookAhead = lookAhead;
        this.parent = parent;
    }
    /// @internal
    toString() {
        return `[${this.stack.filter((_, i) => i % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
    }
    // Start an empty stack
    /// @internal
    static start(p, state, pos = 0) {
        let cx = p.parser.context;
        return new Stack(p, [], state, pos, pos, 0, [], 0, cx ? new StackContext(cx, cx.start) : null, 0, null);
    }
    /// The stack's current [context](#lr.ContextTracker) value, if
    /// any. Its type will depend on the context tracker's type
    /// parameter, or it will be `null` if there is no context
    /// tracker.
    get context() { return this.curContext ? this.curContext.context : null; }
    // Push a state onto the stack, tracking its start position as well
    // as the buffer base at that point.
    /// @internal
    pushState(state, start) {
        this.stack.push(this.state, start, this.bufferBase + this.buffer.length);
        this.state = state;
    }
    // Apply a reduce action
    /// @internal
    reduce(action) {
        let depth = action >> 19 /* ReduceDepthShift */, type = action & 65535 /* ValueMask */;
        let { parser } = this.p;
        let dPrec = parser.dynamicPrecedence(type);
        if (dPrec)
            this.score += dPrec;
        if (depth == 0) {
            this.pushState(parser.getGoto(this.state, type, true), this.reducePos);
            // Zero-depth reductions are a special case—they add stuff to
            // the stack without popping anything off.
            if (type < parser.minRepeatTerm)
                this.storeNode(type, this.reducePos, this.reducePos, 4, true);
            this.reduceContext(type, this.reducePos);
            return;
        }
        // Find the base index into `this.stack`, content after which will
        // be dropped. Note that with `StayFlag` reductions we need to
        // consume two extra frames (the dummy parent node for the skipped
        // expression and the state that we'll be staying in, which should
        // be moved to `this.state`).
        let base = this.stack.length - ((depth - 1) * 3) - (action & 262144 /* StayFlag */ ? 6 : 0);
        let start = this.stack[base - 2];
        let bufferBase = this.stack[base - 1], count = this.bufferBase + this.buffer.length - bufferBase;
        // Store normal terms or `R -> R R` repeat reductions
        if (type < parser.minRepeatTerm || (action & 131072 /* RepeatFlag */)) {
            let pos = parser.stateFlag(this.state, 1 /* Skipped */) ? this.pos : this.reducePos;
            this.storeNode(type, start, pos, count + 4, true);
        }
        if (action & 262144 /* StayFlag */) {
            this.state = this.stack[base];
        }
        else {
            let baseStateID = this.stack[base - 3];
            this.state = parser.getGoto(baseStateID, type, true);
        }
        while (this.stack.length > base)
            this.stack.pop();
        this.reduceContext(type, start);
    }
    // Shift a value into the buffer
    /// @internal
    storeNode(term, start, end, size = 4, isReduce = false) {
        if (term == 0 /* Err */ &&
            (!this.stack.length || this.stack[this.stack.length - 1] < this.buffer.length + this.bufferBase)) {
            // Try to omit/merge adjacent error nodes
            let cur = this, top = this.buffer.length;
            if (top == 0 && cur.parent) {
                top = cur.bufferBase - cur.parent.bufferBase;
                cur = cur.parent;
            }
            if (top > 0 && cur.buffer[top - 4] == 0 /* Err */ && cur.buffer[top - 1] > -1) {
                if (start == end)
                    return;
                if (cur.buffer[top - 2] >= start) {
                    cur.buffer[top - 2] = end;
                    return;
                }
            }
        }
        if (!isReduce || this.pos == end) { // Simple case, just append
            this.buffer.push(term, start, end, size);
        }
        else { // There may be skipped nodes that have to be moved forward
            let index = this.buffer.length;
            if (index > 0 && this.buffer[index - 4] != 0 /* Err */)
                while (index > 0 && this.buffer[index - 2] > end) {
                    // Move this record forward
                    this.buffer[index] = this.buffer[index - 4];
                    this.buffer[index + 1] = this.buffer[index - 3];
                    this.buffer[index + 2] = this.buffer[index - 2];
                    this.buffer[index + 3] = this.buffer[index - 1];
                    index -= 4;
                    if (size > 4)
                        size -= 4;
                }
            this.buffer[index] = term;
            this.buffer[index + 1] = start;
            this.buffer[index + 2] = end;
            this.buffer[index + 3] = size;
        }
    }
    // Apply a shift action
    /// @internal
    shift(action, next, nextEnd) {
        let start = this.pos;
        if (action & 131072 /* GotoFlag */) {
            this.pushState(action & 65535 /* ValueMask */, this.pos);
        }
        else if ((action & 262144 /* StayFlag */) == 0) { // Regular shift
            let nextState = action, { parser } = this.p;
            if (nextEnd > this.pos || next <= parser.maxNode) {
                this.pos = nextEnd;
                if (!parser.stateFlag(nextState, 1 /* Skipped */))
                    this.reducePos = nextEnd;
            }
            this.pushState(nextState, start);
            this.shiftContext(next, start);
            if (next <= parser.maxNode)
                this.buffer.push(next, start, nextEnd, 4);
        }
        else { // Shift-and-stay, which means this is a skipped token
            this.pos = nextEnd;
            this.shiftContext(next, start);
            if (next <= this.p.parser.maxNode)
                this.buffer.push(next, start, nextEnd, 4);
        }
    }
    // Apply an action
    /// @internal
    apply(action, next, nextEnd) {
        if (action & 65536 /* ReduceFlag */)
            this.reduce(action);
        else
            this.shift(action, next, nextEnd);
    }
    // Add a prebuilt (reused) node into the buffer.
    /// @internal
    useNode(value, next) {
        let index = this.p.reused.length - 1;
        if (index < 0 || this.p.reused[index] != value) {
            this.p.reused.push(value);
            index++;
        }
        let start = this.pos;
        this.reducePos = this.pos = start + value.length;
        this.pushState(next, start);
        this.buffer.push(index, start, this.reducePos, -1 /* size == -1 means this is a reused value */);
        if (this.curContext)
            this.updateContext(this.curContext.tracker.reuse(this.curContext.context, value, this, this.p.stream.reset(this.pos - value.length)));
    }
    // Split the stack. Due to the buffer sharing and the fact
    // that `this.stack` tends to stay quite shallow, this isn't very
    // expensive.
    /// @internal
    split() {
        let parent = this;
        let off = parent.buffer.length;
        // Because the top of the buffer (after this.pos) may be mutated
        // to reorder reductions and skipped tokens, and shared buffers
        // should be immutable, this copies any outstanding skipped tokens
        // to the new buffer, and puts the base pointer before them.
        while (off > 0 && parent.buffer[off - 2] > parent.reducePos)
            off -= 4;
        let buffer = parent.buffer.slice(off), base = parent.bufferBase + off;
        // Make sure parent points to an actual parent with content, if there is such a parent.
        while (parent && base == parent.bufferBase)
            parent = parent.parent;
        return new Stack(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, buffer, base, this.curContext, this.lookAhead, parent);
    }
    // Try to recover from an error by 'deleting' (ignoring) one token.
    /// @internal
    recoverByDelete(next, nextEnd) {
        let isNode = next <= this.p.parser.maxNode;
        if (isNode)
            this.storeNode(next, this.pos, nextEnd, 4);
        this.storeNode(0 /* Err */, this.pos, nextEnd, isNode ? 8 : 4);
        this.pos = this.reducePos = nextEnd;
        this.score -= 190 /* Delete */;
    }
    /// Check if the given term would be able to be shifted (optionally
    /// after some reductions) on this stack. This can be useful for
    /// external tokenizers that want to make sure they only provide a
    /// given token when it applies.
    canShift(term) {
        for (let sim = new SimulatedStack(this);;) {
            let action = this.p.parser.stateSlot(sim.state, 4 /* DefaultReduce */) || this.p.parser.hasAction(sim.state, term);
            if ((action & 65536 /* ReduceFlag */) == 0)
                return true;
            if (action == 0)
                return false;
            sim.reduce(action);
        }
    }
    // Apply up to Recover.MaxNext recovery actions that conceptually
    // inserts some missing token or rule.
    /// @internal
    recoverByInsert(next) {
        if (this.stack.length >= 300 /* MaxInsertStackDepth */)
            return [];
        let nextStates = this.p.parser.nextStates(this.state);
        if (nextStates.length > 4 /* MaxNext */ << 1 || this.stack.length >= 120 /* DampenInsertStackDepth */) {
            let best = [];
            for (let i = 0, s; i < nextStates.length; i += 2) {
                if ((s = nextStates[i + 1]) != this.state && this.p.parser.hasAction(s, next))
                    best.push(nextStates[i], s);
            }
            if (this.stack.length < 120 /* DampenInsertStackDepth */)
                for (let i = 0; best.length < 4 /* MaxNext */ << 1 && i < nextStates.length; i += 2) {
                    let s = nextStates[i + 1];
                    if (!best.some((v, i) => (i & 1) && v == s))
                        best.push(nextStates[i], s);
                }
            nextStates = best;
        }
        let result = [];
        for (let i = 0; i < nextStates.length && result.length < 4 /* MaxNext */; i += 2) {
            let s = nextStates[i + 1];
            if (s == this.state)
                continue;
            let stack = this.split();
            stack.pushState(s, this.pos);
            stack.storeNode(0 /* Err */, stack.pos, stack.pos, 4, true);
            stack.shiftContext(nextStates[i], this.pos);
            stack.score -= 200 /* Insert */;
            result.push(stack);
        }
        return result;
    }
    // Force a reduce, if possible. Return false if that can't
    // be done.
    /// @internal
    forceReduce() {
        let reduce = this.p.parser.stateSlot(this.state, 5 /* ForcedReduce */);
        if ((reduce & 65536 /* ReduceFlag */) == 0)
            return false;
        let { parser } = this.p;
        if (!parser.validAction(this.state, reduce)) {
            let depth = reduce >> 19 /* ReduceDepthShift */, term = reduce & 65535 /* ValueMask */;
            let target = this.stack.length - depth * 3;
            if (target < 0 || parser.getGoto(this.stack[target], term, false) < 0)
                return false;
            this.storeNode(0 /* Err */, this.reducePos, this.reducePos, 4, true);
            this.score -= 100 /* Reduce */;
        }
        this.reducePos = this.pos;
        this.reduce(reduce);
        return true;
    }
    /// @internal
    forceAll() {
        while (!this.p.parser.stateFlag(this.state, 2 /* Accepting */)) {
            if (!this.forceReduce()) {
                this.storeNode(0 /* Err */, this.pos, this.pos, 4, true);
                break;
            }
        }
        return this;
    }
    /// Check whether this state has no further actions (assumed to be a direct descendant of the
    /// top state, since any other states must be able to continue
    /// somehow). @internal
    get deadEnd() {
        if (this.stack.length != 3)
            return false;
        let { parser } = this.p;
        return parser.data[parser.stateSlot(this.state, 1 /* Actions */)] == 65535 /* End */ &&
            !parser.stateSlot(this.state, 4 /* DefaultReduce */);
    }
    /// Restart the stack (put it back in its start state). Only safe
    /// when this.stack.length == 3 (state is directly below the top
    /// state). @internal
    restart() {
        this.state = this.stack[0];
        this.stack.length = 0;
    }
    /// @internal
    sameState(other) {
        if (this.state != other.state || this.stack.length != other.stack.length)
            return false;
        for (let i = 0; i < this.stack.length; i += 3)
            if (this.stack[i] != other.stack[i])
                return false;
        return true;
    }
    /// Get the parser used by this stack.
    get parser() { return this.p.parser; }
    /// Test whether a given dialect (by numeric ID, as exported from
    /// the terms file) is enabled.
    dialectEnabled(dialectID) { return this.p.parser.dialect.flags[dialectID]; }
    shiftContext(term, start) {
        if (this.curContext)
            this.updateContext(this.curContext.tracker.shift(this.curContext.context, term, this, this.p.stream.reset(start)));
    }
    reduceContext(term, start) {
        if (this.curContext)
            this.updateContext(this.curContext.tracker.reduce(this.curContext.context, term, this, this.p.stream.reset(start)));
    }
    /// @internal
    emitContext() {
        let last = this.buffer.length - 1;
        if (last < 0 || this.buffer[last] != -3)
            this.buffer.push(this.curContext.hash, this.reducePos, this.reducePos, -3);
    }
    /// @internal
    emitLookAhead() {
        let last = this.buffer.length - 1;
        if (last < 0 || this.buffer[last] != -4)
            this.buffer.push(this.lookAhead, this.reducePos, this.reducePos, -4);
    }
    updateContext(context) {
        if (context != this.curContext.context) {
            let newCx = new StackContext(this.curContext.tracker, context);
            if (newCx.hash != this.curContext.hash)
                this.emitContext();
            this.curContext = newCx;
        }
    }
    /// @internal
    setLookAhead(lookAhead) {
        if (lookAhead > this.lookAhead) {
            this.emitLookAhead();
            this.lookAhead = lookAhead;
        }
    }
    /// @internal
    close() {
        if (this.curContext && this.curContext.tracker.strict)
            this.emitContext();
        if (this.lookAhead > 0)
            this.emitLookAhead();
    }
}
class StackContext {
    constructor(tracker, context) {
        this.tracker = tracker;
        this.context = context;
        this.hash = tracker.strict ? tracker.hash(context) : 0;
    }
}
var Recover;
(function (Recover) {
    Recover[Recover["Insert"] = 200] = "Insert";
    Recover[Recover["Delete"] = 190] = "Delete";
    Recover[Recover["Reduce"] = 100] = "Reduce";
    Recover[Recover["MaxNext"] = 4] = "MaxNext";
    Recover[Recover["MaxInsertStackDepth"] = 300] = "MaxInsertStackDepth";
    Recover[Recover["DampenInsertStackDepth"] = 120] = "DampenInsertStackDepth";
})(Recover || (Recover = {}));
// Used to cheaply run some reductions to scan ahead without mutating
// an entire stack
class SimulatedStack {
    constructor(start) {
        this.start = start;
        this.state = start.state;
        this.stack = start.stack;
        this.base = this.stack.length;
    }
    reduce(action) {
        let term = action & 65535 /* ValueMask */, depth = action >> 19 /* ReduceDepthShift */;
        if (depth == 0) {
            if (this.stack == this.start.stack)
                this.stack = this.stack.slice();
            this.stack.push(this.state, 0, 0);
            this.base += 3;
        }
        else {
            this.base -= (depth - 1) * 3;
        }
        let goto = this.start.p.parser.getGoto(this.stack[this.base - 3], term, true);
        this.state = goto;
    }
}
// This is given to `Tree.build` to build a buffer, and encapsulates
// the parent-stack-walking necessary to read the nodes.
class StackBufferCursor {
    constructor(stack, pos, index) {
        this.stack = stack;
        this.pos = pos;
        this.index = index;
        this.buffer = stack.buffer;
        if (this.index == 0)
            this.maybeNext();
    }
    static create(stack, pos = stack.bufferBase + stack.buffer.length) {
        return new StackBufferCursor(stack, pos, pos - stack.bufferBase);
    }
    maybeNext() {
        let next = this.stack.parent;
        if (next != null) {
            this.index = this.stack.bufferBase - next.bufferBase;
            this.stack = next;
            this.buffer = next.buffer;
        }
    }
    get id() { return this.buffer[this.index - 4]; }
    get start() { return this.buffer[this.index - 3]; }
    get end() { return this.buffer[this.index - 2]; }
    get size() { return this.buffer[this.index - 1]; }
    next() {
        this.index -= 4;
        this.pos -= 4;
        if (this.index == 0)
            this.maybeNext();
    }
    fork() {
        return new StackBufferCursor(this.stack, this.pos, this.index);
    }
}

class CachedToken {
    constructor() {
        this.start = -1;
        this.value = -1;
        this.end = -1;
        this.extended = -1;
        this.lookAhead = 0;
        this.mask = 0;
        this.context = 0;
    }
}
const nullToken = new CachedToken;
/// [Tokenizers](#lr.ExternalTokenizer) interact with the input
/// through this interface. It presents the input as a stream of
/// characters, tracking lookahead and hiding the complexity of
/// [ranges](#common.Parser.parse^ranges) from tokenizer code.
class InputStream {
    /// @internal
    constructor(
    /// @internal
    input, 
    /// @internal
    ranges) {
        this.input = input;
        this.ranges = ranges;
        /// @internal
        this.chunk = "";
        /// @internal
        this.chunkOff = 0;
        /// Backup chunk
        this.chunk2 = "";
        this.chunk2Pos = 0;
        /// The character code of the next code unit in the input, or -1
        /// when the stream is at the end of the input.
        this.next = -1;
        /// @internal
        this.token = nullToken;
        this.rangeIndex = 0;
        this.pos = this.chunkPos = ranges[0].from;
        this.range = ranges[0];
        this.end = ranges[ranges.length - 1].to;
        this.readNext();
    }
    /// @internal
    resolveOffset(offset, assoc) {
        let range = this.range, index = this.rangeIndex;
        let pos = this.pos + offset;
        while (pos < range.from) {
            if (!index)
                return null;
            let next = this.ranges[--index];
            pos -= range.from - next.to;
            range = next;
        }
        while (assoc < 0 ? pos > range.to : pos >= range.to) {
            if (index == this.ranges.length - 1)
                return null;
            let next = this.ranges[++index];
            pos += next.from - range.to;
            range = next;
        }
        return pos;
    }
    /// @internal
    clipPos(pos) {
        if (pos >= this.range.from && pos < this.range.to)
            return pos;
        for (let range of this.ranges)
            if (range.to > pos)
                return Math.max(pos, range.from);
        return this.end;
    }
    /// Look at a code unit near the stream position. `.peek(0)` equals
    /// `.next`, `.peek(-1)` gives you the previous character, and so
    /// on.
    ///
    /// Note that looking around during tokenizing creates dependencies
    /// on potentially far-away content, which may reduce the
    /// effectiveness incremental parsing—when looking forward—or even
    /// cause invalid reparses when looking backward more than 25 code
    /// units, since the library does not track lookbehind.
    peek(offset) {
        let idx = this.chunkOff + offset, pos, result;
        if (idx >= 0 && idx < this.chunk.length) {
            pos = this.pos + offset;
            result = this.chunk.charCodeAt(idx);
        }
        else {
            let resolved = this.resolveOffset(offset, 1);
            if (resolved == null)
                return -1;
            pos = resolved;
            if (pos >= this.chunk2Pos && pos < this.chunk2Pos + this.chunk2.length) {
                result = this.chunk2.charCodeAt(pos - this.chunk2Pos);
            }
            else {
                let i = this.rangeIndex, range = this.range;
                while (range.to <= pos)
                    range = this.ranges[++i];
                this.chunk2 = this.input.chunk(this.chunk2Pos = pos);
                if (pos + this.chunk2.length > range.to)
                    this.chunk2 = this.chunk2.slice(0, range.to - pos);
                result = this.chunk2.charCodeAt(0);
            }
        }
        if (pos >= this.token.lookAhead)
            this.token.lookAhead = pos + 1;
        return result;
    }
    /// Accept a token. By default, the end of the token is set to the
    /// current stream position, but you can pass an offset (relative to
    /// the stream position) to change that.
    acceptToken(token, endOffset = 0) {
        let end = endOffset ? this.resolveOffset(endOffset, -1) : this.pos;
        if (end == null || end < this.token.start)
            throw new RangeError("Token end out of bounds");
        this.token.value = token;
        this.token.end = end;
    }
    getChunk() {
        if (this.pos >= this.chunk2Pos && this.pos < this.chunk2Pos + this.chunk2.length) {
            let { chunk, chunkPos } = this;
            this.chunk = this.chunk2;
            this.chunkPos = this.chunk2Pos;
            this.chunk2 = chunk;
            this.chunk2Pos = chunkPos;
            this.chunkOff = this.pos - this.chunkPos;
        }
        else {
            this.chunk2 = this.chunk;
            this.chunk2Pos = this.chunkPos;
            let nextChunk = this.input.chunk(this.pos);
            let end = this.pos + nextChunk.length;
            this.chunk = end > this.range.to ? nextChunk.slice(0, this.range.to - this.pos) : nextChunk;
            this.chunkPos = this.pos;
            this.chunkOff = 0;
        }
    }
    readNext() {
        if (this.chunkOff >= this.chunk.length) {
            this.getChunk();
            if (this.chunkOff == this.chunk.length)
                return this.next = -1;
        }
        return this.next = this.chunk.charCodeAt(this.chunkOff);
    }
    /// Move the stream forward N (defaults to 1) code units. Returns
    /// the new value of [`next`](#lr.InputStream.next).
    advance(n = 1) {
        this.chunkOff += n;
        while (this.pos + n >= this.range.to) {
            if (this.rangeIndex == this.ranges.length - 1)
                return this.setDone();
            n -= this.range.to - this.pos;
            this.range = this.ranges[++this.rangeIndex];
            this.pos = this.range.from;
        }
        this.pos += n;
        if (this.pos >= this.token.lookAhead)
            this.token.lookAhead = this.pos + 1;
        return this.readNext();
    }
    setDone() {
        this.pos = this.chunkPos = this.end;
        this.range = this.ranges[this.rangeIndex = this.ranges.length - 1];
        this.chunk = "";
        return this.next = -1;
    }
    /// @internal
    reset(pos, token) {
        if (token) {
            this.token = token;
            token.start = pos;
            token.lookAhead = pos + 1;
            token.value = token.extended = -1;
        }
        else {
            this.token = nullToken;
        }
        if (this.pos != pos) {
            this.pos = pos;
            if (pos == this.end) {
                this.setDone();
                return this;
            }
            while (pos < this.range.from)
                this.range = this.ranges[--this.rangeIndex];
            while (pos >= this.range.to)
                this.range = this.ranges[++this.rangeIndex];
            if (pos >= this.chunkPos && pos < this.chunkPos + this.chunk.length) {
                this.chunkOff = pos - this.chunkPos;
            }
            else {
                this.chunk = "";
                this.chunkOff = 0;
            }
            this.readNext();
        }
        return this;
    }
    /// @internal
    read(from, to) {
        if (from >= this.chunkPos && to <= this.chunkPos + this.chunk.length)
            return this.chunk.slice(from - this.chunkPos, to - this.chunkPos);
        if (from >= this.chunk2Pos && to <= this.chunk2Pos + this.chunk2.length)
            return this.chunk2.slice(from - this.chunk2Pos, to - this.chunk2Pos);
        if (from >= this.range.from && to <= this.range.to)
            return this.input.read(from, to);
        let result = "";
        for (let r of this.ranges) {
            if (r.from >= to)
                break;
            if (r.to > from)
                result += this.input.read(Math.max(r.from, from), Math.min(r.to, to));
        }
        return result;
    }
}
/// @internal
class TokenGroup {
    constructor(data, id) {
        this.data = data;
        this.id = id;
    }
    token(input, stack) { readToken(this.data, input, stack, this.id); }
}
TokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
/// `@external tokens` declarations in the grammar should resolve to
/// an instance of this class.
class ExternalTokenizer {
    /// Create a tokenizer. The first argument is the function that,
    /// given an input stream, scans for the types of tokens it
    /// recognizes at the stream's position, and calls
    /// [`acceptToken`](#lr.InputStream.acceptToken) when it finds
    /// one.
    constructor(
    /// @internal
    token, options = {}) {
        this.token = token;
        this.contextual = !!options.contextual;
        this.fallback = !!options.fallback;
        this.extend = !!options.extend;
    }
}
// Tokenizer data is stored a big uint16 array containing, for each
// state:
//
//  - A group bitmask, indicating what token groups are reachable from
//    this state, so that paths that can only lead to tokens not in
//    any of the current groups can be cut off early.
//
//  - The position of the end of the state's sequence of accepting
//    tokens
//
//  - The number of outgoing edges for the state
//
//  - The accepting tokens, as (token id, group mask) pairs
//
//  - The outgoing edges, as (start character, end character, state
//    index) triples, with end character being exclusive
//
// This function interprets that data, running through a stream as
// long as new states with the a matching group mask can be reached,
// and updating `input.token` when it matches a token.
function readToken(data, input, stack, group) {
    let state = 0, groupMask = 1 << group, { parser } = stack.p, { dialect } = parser;
    scan: for (;;) {
        if ((groupMask & data[state]) == 0)
            break;
        let accEnd = data[state + 1];
        // Check whether this state can lead to a token in the current group
        // Accept tokens in this state, possibly overwriting
        // lower-precedence / shorter tokens
        for (let i = state + 3; i < accEnd; i += 2)
            if ((data[i + 1] & groupMask) > 0) {
                let term = data[i];
                if (dialect.allows(term) &&
                    (input.token.value == -1 || input.token.value == term || parser.overrides(term, input.token.value))) {
                    input.acceptToken(term);
                    break;
                }
            }
        let next = input.next, low = 0, high = data[state + 2];
        // Special case for EOF
        if (input.next < 0 && high > low && data[accEnd + high * 3 - 3] == 65535 /* End */) {
            state = data[accEnd + high * 3 - 1];
            continue scan;
        }
        // Do a binary search on the state's edges
        for (; low < high;) {
            let mid = (low + high) >> 1;
            let index = accEnd + mid + (mid << 1);
            let from = data[index], to = data[index + 1];
            if (next < from)
                high = mid;
            else if (next >= to)
                low = mid + 1;
            else {
                state = data[index + 2];
                input.advance();
                continue scan;
            }
        }
        break;
    }
}

// See lezer-generator/src/encode.ts for comments about the encoding
// used here
function decodeArray(input, Type = Uint16Array) {
    if (typeof input != "string")
        return input;
    let array = null;
    for (let pos = 0, out = 0; pos < input.length;) {
        let value = 0;
        for (;;) {
            let next = input.charCodeAt(pos++), stop = false;
            if (next == 126 /* BigValCode */) {
                value = 65535 /* BigVal */;
                break;
            }
            if (next >= 92 /* Gap2 */)
                next--;
            if (next >= 34 /* Gap1 */)
                next--;
            let digit = next - 32 /* Start */;
            if (digit >= 46 /* Base */) {
                digit -= 46 /* Base */;
                stop = true;
            }
            value += digit;
            if (stop)
                break;
            value *= 46 /* Base */;
        }
        if (array)
            array[out++] = value;
        else
            array = new Type(value);
    }
    return array;
}

// Environment variable used to control console output
const verbose = typeof process != "undefined" && process.env && /\bparse\b/.test(process.env.LOG);
let stackIDs = null;
var Safety;
(function (Safety) {
    Safety[Safety["Margin"] = 25] = "Margin";
})(Safety || (Safety = {}));
function cutAt(tree, pos, side) {
    let cursor = tree.cursor(IterMode.IncludeAnonymous);
    cursor.moveTo(pos);
    for (;;) {
        if (!(side < 0 ? cursor.childBefore(pos) : cursor.childAfter(pos)))
            for (;;) {
                if ((side < 0 ? cursor.to < pos : cursor.from > pos) && !cursor.type.isError)
                    return side < 0 ? Math.max(0, Math.min(cursor.to - 1, pos - 25 /* Margin */))
                        : Math.min(tree.length, Math.max(cursor.from + 1, pos + 25 /* Margin */));
                if (side < 0 ? cursor.prevSibling() : cursor.nextSibling())
                    break;
                if (!cursor.parent())
                    return side < 0 ? 0 : tree.length;
            }
    }
}
class FragmentCursor {
    constructor(fragments, nodeSet) {
        this.fragments = fragments;
        this.nodeSet = nodeSet;
        this.i = 0;
        this.fragment = null;
        this.safeFrom = -1;
        this.safeTo = -1;
        this.trees = [];
        this.start = [];
        this.index = [];
        this.nextFragment();
    }
    nextFragment() {
        let fr = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
        if (fr) {
            this.safeFrom = fr.openStart ? cutAt(fr.tree, fr.from + fr.offset, 1) - fr.offset : fr.from;
            this.safeTo = fr.openEnd ? cutAt(fr.tree, fr.to + fr.offset, -1) - fr.offset : fr.to;
            while (this.trees.length) {
                this.trees.pop();
                this.start.pop();
                this.index.pop();
            }
            this.trees.push(fr.tree);
            this.start.push(-fr.offset);
            this.index.push(0);
            this.nextStart = this.safeFrom;
        }
        else {
            this.nextStart = 1e9;
        }
    }
    // `pos` must be >= any previously given `pos` for this cursor
    nodeAt(pos) {
        if (pos < this.nextStart)
            return null;
        while (this.fragment && this.safeTo <= pos)
            this.nextFragment();
        if (!this.fragment)
            return null;
        for (;;) {
            let last = this.trees.length - 1;
            if (last < 0) { // End of tree
                this.nextFragment();
                return null;
            }
            let top = this.trees[last], index = this.index[last];
            if (index == top.children.length) {
                this.trees.pop();
                this.start.pop();
                this.index.pop();
                continue;
            }
            let next = top.children[index];
            let start = this.start[last] + top.positions[index];
            if (start > pos) {
                this.nextStart = start;
                return null;
            }
            if (next instanceof Tree) {
                if (start == pos) {
                    if (start < this.safeFrom)
                        return null;
                    let end = start + next.length;
                    if (end <= this.safeTo) {
                        let lookAhead = next.prop(NodeProp.lookAhead);
                        if (!lookAhead || end + lookAhead < this.fragment.to)
                            return next;
                    }
                }
                this.index[last]++;
                if (start + next.length >= Math.max(this.safeFrom, pos)) { // Enter this node
                    this.trees.push(next);
                    this.start.push(start);
                    this.index.push(0);
                }
            }
            else {
                this.index[last]++;
                this.nextStart = start + next.length;
            }
        }
    }
}
class TokenCache {
    constructor(parser, stream) {
        this.stream = stream;
        this.tokens = [];
        this.mainToken = null;
        this.actions = [];
        this.tokens = parser.tokenizers.map(_ => new CachedToken);
    }
    getActions(stack) {
        let actionIndex = 0;
        let main = null;
        let { parser } = stack.p, { tokenizers } = parser;
        let mask = parser.stateSlot(stack.state, 3 /* TokenizerMask */);
        let context = stack.curContext ? stack.curContext.hash : 0;
        let lookAhead = 0;
        for (let i = 0; i < tokenizers.length; i++) {
            if (((1 << i) & mask) == 0)
                continue;
            let tokenizer = tokenizers[i], token = this.tokens[i];
            if (main && !tokenizer.fallback)
                continue;
            if (tokenizer.contextual || token.start != stack.pos || token.mask != mask || token.context != context) {
                this.updateCachedToken(token, tokenizer, stack);
                token.mask = mask;
                token.context = context;
            }
            if (token.lookAhead > token.end + 25 /* Margin */)
                lookAhead = Math.max(token.lookAhead, lookAhead);
            if (token.value != 0 /* Err */) {
                let startIndex = actionIndex;
                if (token.extended > -1)
                    actionIndex = this.addActions(stack, token.extended, token.end, actionIndex);
                actionIndex = this.addActions(stack, token.value, token.end, actionIndex);
                if (!tokenizer.extend) {
                    main = token;
                    if (actionIndex > startIndex)
                        break;
                }
            }
        }
        while (this.actions.length > actionIndex)
            this.actions.pop();
        if (lookAhead)
            stack.setLookAhead(lookAhead);
        if (!main && stack.pos == this.stream.end) {
            main = new CachedToken;
            main.value = stack.p.parser.eofTerm;
            main.start = main.end = stack.pos;
            actionIndex = this.addActions(stack, main.value, main.end, actionIndex);
        }
        this.mainToken = main;
        return this.actions;
    }
    getMainToken(stack) {
        if (this.mainToken)
            return this.mainToken;
        let main = new CachedToken, { pos, p } = stack;
        main.start = pos;
        main.end = Math.min(pos + 1, p.stream.end);
        main.value = pos == p.stream.end ? p.parser.eofTerm : 0 /* Err */;
        return main;
    }
    updateCachedToken(token, tokenizer, stack) {
        let start = this.stream.clipPos(stack.pos);
        tokenizer.token(this.stream.reset(start, token), stack);
        if (token.value > -1) {
            let { parser } = stack.p;
            for (let i = 0; i < parser.specialized.length; i++)
                if (parser.specialized[i] == token.value) {
                    let result = parser.specializers[i](this.stream.read(token.start, token.end), stack);
                    if (result >= 0 && stack.p.parser.dialect.allows(result >> 1)) {
                        if ((result & 1) == 0 /* Specialize */)
                            token.value = result >> 1;
                        else
                            token.extended = result >> 1;
                        break;
                    }
                }
        }
        else {
            token.value = 0 /* Err */;
            token.end = this.stream.clipPos(start + 1);
        }
    }
    putAction(action, token, end, index) {
        // Don't add duplicate actions
        for (let i = 0; i < index; i += 3)
            if (this.actions[i] == action)
                return index;
        this.actions[index++] = action;
        this.actions[index++] = token;
        this.actions[index++] = end;
        return index;
    }
    addActions(stack, token, end, index) {
        let { state } = stack, { parser } = stack.p, { data } = parser;
        for (let set = 0; set < 2; set++) {
            for (let i = parser.stateSlot(state, set ? 2 /* Skip */ : 1 /* Actions */);; i += 3) {
                if (data[i] == 65535 /* End */) {
                    if (data[i + 1] == 1 /* Next */) {
                        i = pair(data, i + 2);
                    }
                    else {
                        if (index == 0 && data[i + 1] == 2 /* Other */)
                            index = this.putAction(pair(data, i + 2), token, end, index);
                        break;
                    }
                }
                if (data[i] == token)
                    index = this.putAction(pair(data, i + 1), token, end, index);
            }
        }
        return index;
    }
}
var Rec;
(function (Rec) {
    Rec[Rec["Distance"] = 5] = "Distance";
    Rec[Rec["MaxRemainingPerStep"] = 3] = "MaxRemainingPerStep";
    // When two stacks have been running independently long enough to
    // add this many elements to their buffers, prune one.
    Rec[Rec["MinBufferLengthPrune"] = 500] = "MinBufferLengthPrune";
    Rec[Rec["ForceReduceLimit"] = 10] = "ForceReduceLimit";
    // Once a stack reaches this depth (in .stack.length) force-reduce
    // it back to CutTo to avoid creating trees that overflow the stack
    // on recursive traversal.
    Rec[Rec["CutDepth"] = 15000] = "CutDepth";
    Rec[Rec["CutTo"] = 9000] = "CutTo";
})(Rec || (Rec = {}));
class Parse {
    constructor(parser, input, fragments, ranges) {
        this.parser = parser;
        this.input = input;
        this.ranges = ranges;
        this.recovering = 0;
        this.nextStackID = 0x2654; // ♔, ♕, ♖, ♗, ♘, ♙, ♠, ♡, ♢, ♣, ♤, ♥, ♦, ♧
        this.minStackPos = 0;
        this.reused = [];
        this.stoppedAt = null;
        this.stream = new InputStream(input, ranges);
        this.tokens = new TokenCache(parser, this.stream);
        this.topTerm = parser.top[1];
        let { from } = ranges[0];
        this.stacks = [Stack.start(this, parser.top[0], from)];
        this.fragments = fragments.length && this.stream.end - from > parser.bufferLength * 4
            ? new FragmentCursor(fragments, parser.nodeSet) : null;
    }
    get parsedPos() {
        return this.minStackPos;
    }
    // Move the parser forward. This will process all parse stacks at
    // `this.pos` and try to advance them to a further position. If no
    // stack for such a position is found, it'll start error-recovery.
    //
    // When the parse is finished, this will return a syntax tree. When
    // not, it returns `null`.
    advance() {
        let stacks = this.stacks, pos = this.minStackPos;
        // This will hold stacks beyond `pos`.
        let newStacks = this.stacks = [];
        let stopped, stoppedTokens;
        // Keep advancing any stacks at `pos` until they either move
        // forward or can't be advanced. Gather stacks that can't be
        // advanced further in `stopped`.
        for (let i = 0; i < stacks.length; i++) {
            let stack = stacks[i];
            for (;;) {
                this.tokens.mainToken = null;
                if (stack.pos > pos) {
                    newStacks.push(stack);
                }
                else if (this.advanceStack(stack, newStacks, stacks)) {
                    continue;
                }
                else {
                    if (!stopped) {
                        stopped = [];
                        stoppedTokens = [];
                    }
                    stopped.push(stack);
                    let tok = this.tokens.getMainToken(stack);
                    stoppedTokens.push(tok.value, tok.end);
                }
                break;
            }
        }
        if (!newStacks.length) {
            let finished = stopped && findFinished(stopped);
            if (finished)
                return this.stackToTree(finished);
            if (this.parser.strict) {
                if (verbose && stopped)
                    console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none"));
                throw new SyntaxError("No parse at " + pos);
            }
            if (!this.recovering)
                this.recovering = 5 /* Distance */;
        }
        if (this.recovering && stopped) {
            let finished = this.stoppedAt != null && stopped[0].pos > this.stoppedAt ? stopped[0]
                : this.runRecovery(stopped, stoppedTokens, newStacks);
            if (finished)
                return this.stackToTree(finished.forceAll());
        }
        if (this.recovering) {
            let maxRemaining = this.recovering == 1 ? 1 : this.recovering * 3 /* MaxRemainingPerStep */;
            if (newStacks.length > maxRemaining) {
                newStacks.sort((a, b) => b.score - a.score);
                while (newStacks.length > maxRemaining)
                    newStacks.pop();
            }
            if (newStacks.some(s => s.reducePos > pos))
                this.recovering--;
        }
        else if (newStacks.length > 1) {
            // Prune stacks that are in the same state, or that have been
            // running without splitting for a while, to avoid getting stuck
            // with multiple successful stacks running endlessly on.
            outer: for (let i = 0; i < newStacks.length - 1; i++) {
                let stack = newStacks[i];
                for (let j = i + 1; j < newStacks.length; j++) {
                    let other = newStacks[j];
                    if (stack.sameState(other) ||
                        stack.buffer.length > 500 /* MinBufferLengthPrune */ && other.buffer.length > 500 /* MinBufferLengthPrune */) {
                        if (((stack.score - other.score) || (stack.buffer.length - other.buffer.length)) > 0) {
                            newStacks.splice(j--, 1);
                        }
                        else {
                            newStacks.splice(i--, 1);
                            continue outer;
                        }
                    }
                }
            }
        }
        this.minStackPos = newStacks[0].pos;
        for (let i = 1; i < newStacks.length; i++)
            if (newStacks[i].pos < this.minStackPos)
                this.minStackPos = newStacks[i].pos;
        return null;
    }
    stopAt(pos) {
        if (this.stoppedAt != null && this.stoppedAt < pos)
            throw new RangeError("Can't move stoppedAt forward");
        this.stoppedAt = pos;
    }
    // Returns an updated version of the given stack, or null if the
    // stack can't advance normally. When `split` and `stacks` are
    // given, stacks split off by ambiguous operations will be pushed to
    // `split`, or added to `stacks` if they move `pos` forward.
    advanceStack(stack, stacks, split) {
        let start = stack.pos, { parser } = this;
        let base = verbose ? this.stackID(stack) + " -> " : "";
        if (this.stoppedAt != null && start > this.stoppedAt)
            return stack.forceReduce() ? stack : null;
        if (this.fragments) {
            let strictCx = stack.curContext && stack.curContext.tracker.strict, cxHash = strictCx ? stack.curContext.hash : 0;
            for (let cached = this.fragments.nodeAt(start); cached;) {
                let match = this.parser.nodeSet.types[cached.type.id] == cached.type ? parser.getGoto(stack.state, cached.type.id) : -1;
                if (match > -1 && cached.length && (!strictCx || (cached.prop(NodeProp.contextHash) || 0) == cxHash)) {
                    stack.useNode(cached, match);
                    if (verbose)
                        console.log(base + this.stackID(stack) + ` (via reuse of ${parser.getName(cached.type.id)})`);
                    return true;
                }
                if (!(cached instanceof Tree) || cached.children.length == 0 || cached.positions[0] > 0)
                    break;
                let inner = cached.children[0];
                if (inner instanceof Tree && cached.positions[0] == 0)
                    cached = inner;
                else
                    break;
            }
        }
        let defaultReduce = parser.stateSlot(stack.state, 4 /* DefaultReduce */);
        if (defaultReduce > 0) {
            stack.reduce(defaultReduce);
            if (verbose)
                console.log(base + this.stackID(stack) + ` (via always-reduce ${parser.getName(defaultReduce & 65535 /* ValueMask */)})`);
            return true;
        }
        if (stack.stack.length >= 15000 /* CutDepth */) {
            while (stack.stack.length > 9000 /* CutTo */ && stack.forceReduce()) { }
        }
        let actions = this.tokens.getActions(stack);
        for (let i = 0; i < actions.length;) {
            let action = actions[i++], term = actions[i++], end = actions[i++];
            let last = i == actions.length || !split;
            let localStack = last ? stack : stack.split();
            localStack.apply(action, term, end);
            if (verbose)
                console.log(base + this.stackID(localStack) + ` (via ${(action & 65536 /* ReduceFlag */) == 0 ? "shift"
                    : `reduce of ${parser.getName(action & 65535 /* ValueMask */)}`} for ${parser.getName(term)} @ ${start}${localStack == stack ? "" : ", split"})`);
            if (last)
                return true;
            else if (localStack.pos > start)
                stacks.push(localStack);
            else
                split.push(localStack);
        }
        return false;
    }
    // Advance a given stack forward as far as it will go. Returns the
    // (possibly updated) stack if it got stuck, or null if it moved
    // forward and was given to `pushStackDedup`.
    advanceFully(stack, newStacks) {
        let pos = stack.pos;
        for (;;) {
            if (!this.advanceStack(stack, null, null))
                return false;
            if (stack.pos > pos) {
                pushStackDedup(stack, newStacks);
                return true;
            }
        }
    }
    runRecovery(stacks, tokens, newStacks) {
        let finished = null, restarted = false;
        for (let i = 0; i < stacks.length; i++) {
            let stack = stacks[i], token = tokens[i << 1], tokenEnd = tokens[(i << 1) + 1];
            let base = verbose ? this.stackID(stack) + " -> " : "";
            if (stack.deadEnd) {
                if (restarted)
                    continue;
                restarted = true;
                stack.restart();
                if (verbose)
                    console.log(base + this.stackID(stack) + " (restarted)");
                let done = this.advanceFully(stack, newStacks);
                if (done)
                    continue;
            }
            let force = stack.split(), forceBase = base;
            for (let j = 0; force.forceReduce() && j < 10 /* ForceReduceLimit */; j++) {
                if (verbose)
                    console.log(forceBase + this.stackID(force) + " (via force-reduce)");
                let done = this.advanceFully(force, newStacks);
                if (done)
                    break;
                if (verbose)
                    forceBase = this.stackID(force) + " -> ";
            }
            for (let insert of stack.recoverByInsert(token)) {
                if (verbose)
                    console.log(base + this.stackID(insert) + " (via recover-insert)");
                this.advanceFully(insert, newStacks);
            }
            if (this.stream.end > stack.pos) {
                if (tokenEnd == stack.pos) {
                    tokenEnd++;
                    token = 0 /* Err */;
                }
                stack.recoverByDelete(token, tokenEnd);
                if (verbose)
                    console.log(base + this.stackID(stack) + ` (via recover-delete ${this.parser.getName(token)})`);
                pushStackDedup(stack, newStacks);
            }
            else if (!finished || finished.score < stack.score) {
                finished = stack;
            }
        }
        return finished;
    }
    // Convert the stack's buffer to a syntax tree.
    stackToTree(stack) {
        stack.close();
        return Tree.build({ buffer: StackBufferCursor.create(stack),
            nodeSet: this.parser.nodeSet,
            topID: this.topTerm,
            maxBufferLength: this.parser.bufferLength,
            reused: this.reused,
            start: this.ranges[0].from,
            length: stack.pos - this.ranges[0].from,
            minRepeatType: this.parser.minRepeatTerm });
    }
    stackID(stack) {
        let id = (stackIDs || (stackIDs = new WeakMap)).get(stack);
        if (!id)
            stackIDs.set(stack, id = String.fromCodePoint(this.nextStackID++));
        return id + stack;
    }
}
function pushStackDedup(stack, newStacks) {
    for (let i = 0; i < newStacks.length; i++) {
        let other = newStacks[i];
        if (other.pos == stack.pos && other.sameState(stack)) {
            if (newStacks[i].score < stack.score)
                newStacks[i] = stack;
            return;
        }
    }
    newStacks.push(stack);
}
class Dialect {
    constructor(source, flags, disabled) {
        this.source = source;
        this.flags = flags;
        this.disabled = disabled;
    }
    allows(term) { return !this.disabled || this.disabled[term] == 0; }
}
const id = x => x;
/// Context trackers are used to track stateful context (such as
/// indentation in the Python grammar, or parent elements in the XML
/// grammar) needed by external tokenizers. You declare them in a
/// grammar file as `@context exportName from "module"`.
///
/// Context values should be immutable, and can be updated (replaced)
/// on shift or reduce actions.
///
/// The export used in a `@context` declaration should be of this
/// type.
class ContextTracker {
    /// Define a context tracker.
    constructor(spec) {
        this.start = spec.start;
        this.shift = spec.shift || id;
        this.reduce = spec.reduce || id;
        this.reuse = spec.reuse || id;
        this.hash = spec.hash || (() => 0);
        this.strict = spec.strict !== false;
    }
}
/// Holds the parse tables for a given grammar, as generated by
/// `lezer-generator`, and provides [methods](#common.Parser) to parse
/// content with.
class LRParser extends Parser {
    /// @internal
    constructor(spec) {
        super();
        /// @internal
        this.wrappers = [];
        if (spec.version != 14 /* Version */)
            throw new RangeError(`Parser version (${spec.version}) doesn't match runtime version (${14 /* Version */})`);
        let nodeNames = spec.nodeNames.split(" ");
        this.minRepeatTerm = nodeNames.length;
        for (let i = 0; i < spec.repeatNodeCount; i++)
            nodeNames.push("");
        let topTerms = Object.keys(spec.topRules).map(r => spec.topRules[r][1]);
        let nodeProps = [];
        for (let i = 0; i < nodeNames.length; i++)
            nodeProps.push([]);
        function setProp(nodeID, prop, value) {
            nodeProps[nodeID].push([prop, prop.deserialize(String(value))]);
        }
        if (spec.nodeProps)
            for (let propSpec of spec.nodeProps) {
                let prop = propSpec[0];
                if (typeof prop == "string")
                    prop = NodeProp[prop];
                for (let i = 1; i < propSpec.length;) {
                    let next = propSpec[i++];
                    if (next >= 0) {
                        setProp(next, prop, propSpec[i++]);
                    }
                    else {
                        let value = propSpec[i + -next];
                        for (let j = -next; j > 0; j--)
                            setProp(propSpec[i++], prop, value);
                        i++;
                    }
                }
            }
        this.nodeSet = new NodeSet(nodeNames.map((name, i) => NodeType.define({
            name: i >= this.minRepeatTerm ? undefined : name,
            id: i,
            props: nodeProps[i],
            top: topTerms.indexOf(i) > -1,
            error: i == 0,
            skipped: spec.skippedNodes && spec.skippedNodes.indexOf(i) > -1
        })));
        if (spec.propSources)
            this.nodeSet = this.nodeSet.extend(...spec.propSources);
        this.strict = false;
        this.bufferLength = DefaultBufferLength;
        let tokenArray = decodeArray(spec.tokenData);
        this.context = spec.context;
        this.specializerSpecs = spec.specialized || [];
        this.specialized = new Uint16Array(this.specializerSpecs.length);
        for (let i = 0; i < this.specializerSpecs.length; i++)
            this.specialized[i] = this.specializerSpecs[i].term;
        this.specializers = this.specializerSpecs.map(getSpecializer);
        this.states = decodeArray(spec.states, Uint32Array);
        this.data = decodeArray(spec.stateData);
        this.goto = decodeArray(spec.goto);
        this.maxTerm = spec.maxTerm;
        this.tokenizers = spec.tokenizers.map(value => typeof value == "number" ? new TokenGroup(tokenArray, value) : value);
        this.topRules = spec.topRules;
        this.dialects = spec.dialects || {};
        this.dynamicPrecedences = spec.dynamicPrecedences || null;
        this.tokenPrecTable = spec.tokenPrec;
        this.termNames = spec.termNames || null;
        this.maxNode = this.nodeSet.types.length - 1;
        this.dialect = this.parseDialect();
        this.top = this.topRules[Object.keys(this.topRules)[0]];
    }
    createParse(input, fragments, ranges) {
        let parse = new Parse(this, input, fragments, ranges);
        for (let w of this.wrappers)
            parse = w(parse, input, fragments, ranges);
        return parse;
    }
    /// Get a goto table entry @internal
    getGoto(state, term, loose = false) {
        let table = this.goto;
        if (term >= table[0])
            return -1;
        for (let pos = table[term + 1];;) {
            let groupTag = table[pos++], last = groupTag & 1;
            let target = table[pos++];
            if (last && loose)
                return target;
            for (let end = pos + (groupTag >> 1); pos < end; pos++)
                if (table[pos] == state)
                    return target;
            if (last)
                return -1;
        }
    }
    /// Check if this state has an action for a given terminal @internal
    hasAction(state, terminal) {
        let data = this.data;
        for (let set = 0; set < 2; set++) {
            for (let i = this.stateSlot(state, set ? 2 /* Skip */ : 1 /* Actions */), next;; i += 3) {
                if ((next = data[i]) == 65535 /* End */) {
                    if (data[i + 1] == 1 /* Next */)
                        next = data[i = pair(data, i + 2)];
                    else if (data[i + 1] == 2 /* Other */)
                        return pair(data, i + 2);
                    else
                        break;
                }
                if (next == terminal || next == 0 /* Err */)
                    return pair(data, i + 1);
            }
        }
        return 0;
    }
    /// @internal
    stateSlot(state, slot) {
        return this.states[(state * 6 /* Size */) + slot];
    }
    /// @internal
    stateFlag(state, flag) {
        return (this.stateSlot(state, 0 /* Flags */) & flag) > 0;
    }
    /// @internal
    validAction(state, action) {
        if (action == this.stateSlot(state, 4 /* DefaultReduce */))
            return true;
        for (let i = this.stateSlot(state, 1 /* Actions */);; i += 3) {
            if (this.data[i] == 65535 /* End */) {
                if (this.data[i + 1] == 1 /* Next */)
                    i = pair(this.data, i + 2);
                else
                    return false;
            }
            if (action == pair(this.data, i + 1))
                return true;
        }
    }
    /// Get the states that can follow this one through shift actions or
    /// goto jumps. @internal
    nextStates(state) {
        let result = [];
        for (let i = this.stateSlot(state, 1 /* Actions */);; i += 3) {
            if (this.data[i] == 65535 /* End */) {
                if (this.data[i + 1] == 1 /* Next */)
                    i = pair(this.data, i + 2);
                else
                    break;
            }
            if ((this.data[i + 2] & (65536 /* ReduceFlag */ >> 16)) == 0) {
                let value = this.data[i + 1];
                if (!result.some((v, i) => (i & 1) && v == value))
                    result.push(this.data[i], value);
            }
        }
        return result;
    }
    /// @internal
    overrides(token, prev) {
        let iPrev = findOffset(this.data, this.tokenPrecTable, prev);
        return iPrev < 0 || findOffset(this.data, this.tokenPrecTable, token) < iPrev;
    }
    /// Configure the parser. Returns a new parser instance that has the
    /// given settings modified. Settings not provided in `config` are
    /// kept from the original parser.
    configure(config) {
        // Hideous reflection-based kludge to make it easy to create a
        // slightly modified copy of a parser.
        let copy = Object.assign(Object.create(LRParser.prototype), this);
        if (config.props)
            copy.nodeSet = this.nodeSet.extend(...config.props);
        if (config.top) {
            let info = this.topRules[config.top];
            if (!info)
                throw new RangeError(`Invalid top rule name ${config.top}`);
            copy.top = info;
        }
        if (config.tokenizers)
            copy.tokenizers = this.tokenizers.map(t => {
                let found = config.tokenizers.find(r => r.from == t);
                return found ? found.to : t;
            });
        if (config.specializers) {
            copy.specializers = this.specializers.slice();
            copy.specializerSpecs = this.specializerSpecs.map((s, i) => {
                let found = config.specializers.find(r => r.from == s.external);
                if (!found)
                    return s;
                let spec = Object.assign(Object.assign({}, s), { external: found.to });
                copy.specializers[i] = getSpecializer(spec);
                return spec;
            });
        }
        if (config.contextTracker)
            copy.context = config.contextTracker;
        if (config.dialect)
            copy.dialect = this.parseDialect(config.dialect);
        if (config.strict != null)
            copy.strict = config.strict;
        if (config.wrap)
            copy.wrappers = copy.wrappers.concat(config.wrap);
        if (config.bufferLength != null)
            copy.bufferLength = config.bufferLength;
        return copy;
    }
    /// Tells you whether any [parse wrappers](#lr.ParserConfig.wrap)
    /// are registered for this parser.
    hasWrappers() {
        return this.wrappers.length > 0;
    }
    /// Returns the name associated with a given term. This will only
    /// work for all terms when the parser was generated with the
    /// `--names` option. By default, only the names of tagged terms are
    /// stored.
    getName(term) {
        return this.termNames ? this.termNames[term] : String(term <= this.maxNode && this.nodeSet.types[term].name || term);
    }
    /// The eof term id is always allocated directly after the node
    /// types. @internal
    get eofTerm() { return this.maxNode + 1; }
    /// The type of top node produced by the parser.
    get topNode() { return this.nodeSet.types[this.top[1]]; }
    /// @internal
    dynamicPrecedence(term) {
        let prec = this.dynamicPrecedences;
        return prec == null ? 0 : prec[term] || 0;
    }
    /// @internal
    parseDialect(dialect) {
        let values = Object.keys(this.dialects), flags = values.map(() => false);
        if (dialect)
            for (let part of dialect.split(" ")) {
                let id = values.indexOf(part);
                if (id >= 0)
                    flags[id] = true;
            }
        let disabled = null;
        for (let i = 0; i < values.length; i++)
            if (!flags[i]) {
                for (let j = this.dialects[values[i]], id; (id = this.data[j++]) != 65535 /* End */;)
                    (disabled || (disabled = new Uint8Array(this.maxTerm + 1)))[id] = 1;
            }
        return new Dialect(dialect, flags, disabled);
    }
    /// Used by the output of the parser generator. Not available to
    /// user code.
    static deserialize(spec) {
        return new LRParser(spec);
    }
}
function pair(data, off) { return data[off] | (data[off + 1] << 16); }
function findOffset(data, start, term) {
    for (let i = start, next; (next = data[i]) != 65535 /* End */; i++)
        if (next == term)
            return i - start;
    return -1;
}
function findFinished(stacks) {
    let best = null;
    for (let stack of stacks) {
        let stopped = stack.p.stoppedAt;
        if ((stack.pos == stack.p.stream.end || stopped != null && stack.pos > stopped) &&
            stack.p.parser.stateFlag(stack.state, 2 /* Accepting */) &&
            (!best || best.score < stack.score))
            best = stack;
    }
    return best;
}
function getSpecializer(spec) {
    if (spec.external) {
        let mask = spec.extend ? 1 /* Extend */ : 0 /* Specialize */;
        return (value, stack) => (spec.external(value, stack) << 1) | mask;
    }
    return spec.get;
}

// This file was generated by lezer-generator. You probably shouldn't edit it.
const printKeyword = 1,
  indent = 189,
  dedent = 190,
  newline$1 = 191,
  newlineBracketed = 192,
  newlineEmpty = 193,
  eof = 194,
  ParenL = 22,
  ParenthesizedExpression = 23,
  TupleExpression = 47,
  ComprehensionExpression = 48,
  BracketL = 53,
  ArrayExpression = 54,
  ArrayComprehensionExpression = 55,
  BraceL = 57,
  DictionaryExpression = 58,
  DictionaryComprehensionExpression = 59,
  SetExpression = 60,
  SetComprehensionExpression = 61,
  ArgList = 63,
  subscript = 230,
  FormatReplacement = 71,
  importList = 255,
  ParamList = 121,
  SequencePattern = 142,
  MappingPattern = 143,
  PatternArgList = 146;

const newline = 10, carriageReturn = 13, space = 32, tab = 9, hash = 35, parenOpen = 40, dot = 46;

const bracketed = new Set([
  ParenthesizedExpression, TupleExpression, ComprehensionExpression, importList, ArgList, ParamList,
  ArrayExpression, ArrayComprehensionExpression, subscript,
  SetExpression, SetComprehensionExpression,
  DictionaryExpression, DictionaryComprehensionExpression, FormatReplacement,
  SequencePattern, MappingPattern, PatternArgList
]);

const newlines = new ExternalTokenizer((input, stack) => {
  if (input.next < 0) {
    input.acceptToken(eof);
  } else if (input.next != newline && input.next != carriageReturn) ; else if (stack.context.depth < 0) {
    input.acceptToken(newlineBracketed, 1);
  } else {
    input.advance();
    let spaces = 0;
    while (input.next == space || input.next == tab) { input.advance(); spaces++; }
    let empty = input.next == newline || input.next == carriageReturn || input.next == hash;
    input.acceptToken(empty ? newlineEmpty : newline$1, -spaces);
  }
}, {contextual: true, fallback: true});

const indentation = new ExternalTokenizer((input, stack) => {
  let cDepth = stack.context.depth;
  if (cDepth < 0) return
  let prev = input.peek(-1);
  if ((prev == newline || prev == carriageReturn) && stack.context.depth >= 0) {
    let depth = 0, chars = 0;
    for (;;) {
      if (input.next == space) depth++;
      else if (input.next == tab) depth += 8 - (depth % 8);
      else break
      input.advance();
      chars++;
    }
    if (depth != cDepth &&
        input.next != newline && input.next != carriageReturn && input.next != hash) {
      if (depth < cDepth) input.acceptToken(dedent, -chars);
      else input.acceptToken(indent);
    }
  }
});

function IndentLevel(parent, depth) {
  this.parent = parent;
  // -1 means this is not an actual indent level but a set of brackets
  this.depth = depth;
  this.hash = (parent ? parent.hash + parent.hash << 8 : 0) + depth + (depth << 4);
}

const topIndent = new IndentLevel(null, 0);

function countIndent(space) {
  let depth = 0;
  for (let i = 0; i < space.length; i++)
    depth += space.charCodeAt(i) == tab ? 8 - (depth % 8) : 1;
  return depth
}

const trackIndent = new ContextTracker({
  start: topIndent,
  reduce(context, term) {
    return context.depth < 0 && bracketed.has(term) ? context.parent : context
  },
  shift(context, term, stack, input) {
    if (term == indent) return new IndentLevel(context, countIndent(input.read(input.pos, stack.pos)))
    if (term == dedent) return context.parent
    if (term == ParenL || term == BracketL || term == BraceL) return new IndentLevel(context, -1)
    return context
  },
  hash(context) { return context.hash }
});

const legacyPrint = new ExternalTokenizer(input => {
  for (let i = 0; i < 5; i++) {
    if (input.next != "print".charCodeAt(i)) return
    input.advance();
  }
  if (/\w/.test(String.fromCharCode(input.next))) return
  for (let off = 0;; off++) {
    let next = input.peek(off);
    if (next == space || next == tab) continue
    if (next != parenOpen && next != dot && next != newline && next != carriageReturn && next != hash)
      input.acceptToken(printKeyword);
    return
  }
});

const pythonHighlighting = styleTags({
  "async \"*\" \"**\" FormatConversion FormatSpec": tags.modifier,
  "for while if elif else try except finally return raise break continue with pass assert await yield": tags.controlKeyword,
  "in not and or is del": tags.operatorKeyword,
  "from def class global nonlocal lambda": tags.definitionKeyword,
  import: tags.moduleKeyword,
  "with as print": tags.keyword,
  Boolean: tags.bool,
  None: tags.null,
  VariableName: tags.variableName,
  "CallExpression/VariableName": tags.function(tags.variableName),
  "FunctionDefinition/VariableName": tags.function(tags.definition(tags.variableName)),
  "ClassDefinition/VariableName": tags.definition(tags.className),
  PropertyName: tags.propertyName,
  "CallExpression/MemberExpression/PropertyName": tags.function(tags.propertyName),
  Comment: tags.lineComment,
  Number: tags.number,
  String: tags.string,
  FormatString: tags.special(tags.string),
  UpdateOp: tags.updateOperator,
  ArithOp: tags.arithmeticOperator,
  BitOp: tags.bitwiseOperator,
  CompareOp: tags.compareOperator,
  AssignOp: tags.definitionOperator,
  Ellipsis: tags.punctuation,
  At: tags.meta,
  "( )": tags.paren,
  "[ ]": tags.squareBracket,
  "{ }": tags.brace,
  ".": tags.derefOperator,
  ", ;": tags.separator
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const spec_identifier = {__proto__:null,await:40, or:50, and:52, in:56, not:58, is:60, if:66, else:68, lambda:72, yield:90, from:92, async:98, for:100, None:152, True:154, False:154, del:168, pass:172, break:176, continue:180, return:184, raise:192, import:196, as:198, global:202, nonlocal:204, assert:208, elif:218, while:222, try:228, except:230, finally:232, with:236, def:240, class:250, match:261, case:267};
const parser = LRParser.deserialize({
  version: 14,
  states: "!L`O`Q$IXOOO%fQ$I[O'#G|OOQ$IS'#Cm'#CmOOQ$IS'#Cn'#CnO'UQ$IWO'#ClO(wQ$I[O'#G{OOQ$IS'#G|'#G|OOQ$IS'#DS'#DSOOQ$IS'#G{'#G{O)eQ$IWO'#CsO)uQ$IWO'#DdO*VQ$IWO'#DhOOQ$IS'#Ds'#DsO*jO`O'#DsO*rOpO'#DsO*zO!bO'#DtO+VO#tO'#DtO+bO&jO'#DtO+mO,UO'#DtO-oQ$I[O'#GmOOQ$IS'#Gm'#GmO'UQ$IWO'#GlO/RQ$I[O'#GlOOQ$IS'#E]'#E]O/jQ$IWO'#E^OOQ$IS'#Gk'#GkO/tQ$IWO'#GjOOQ$IV'#Gj'#GjO0PQ$IWO'#FPOOQ$IS'#GX'#GXO0UQ$IWO'#FOOOQ$IV'#Hx'#HxOOQ$IV'#Gi'#GiOOQ$IT'#Fh'#FhQ`Q$IXOOO'UQ$IWO'#CoO0dQ$IWO'#C{O0kQ$IWO'#DPO0yQ$IWO'#HQO1ZQ$I[O'#EQO'UQ$IWO'#EROOQ$IS'#ET'#ETOOQ$IS'#EV'#EVOOQ$IS'#EX'#EXO1oQ$IWO'#EZO2VQ$IWO'#E_O0PQ$IWO'#EaO2jQ$I[O'#EaO0PQ$IWO'#EdO/jQ$IWO'#EgO/jQ$IWO'#EkO/jQ$IWO'#EnO2uQ$IWO'#EpO2|Q$IWO'#EuO3XQ$IWO'#EqO/jQ$IWO'#EuO0PQ$IWO'#EwO0PQ$IWO'#E|O3^Q$IWO'#FROOQ$IS'#Cc'#CcOOQ$IS'#Cd'#CdOOQ$IS'#Ce'#CeOOQ$IS'#Cf'#CfOOQ$IS'#Cg'#CgOOQ$IS'#Ch'#ChOOQ$IS'#Cj'#CjO'UQ$IWO,58|O'UQ$IWO,58|O'UQ$IWO,58|O'UQ$IWO,58|O'UQ$IWO,58|O'UQ$IWO,58|O3eQ$IWO'#DmOOQ$IS,5:W,5:WO3xQ$IWO'#H[OOQ$IS,5:Z,5:ZO4VQ%1`O,5:ZO4[Q$I[O,59WO0dQ$IWO,59`O0dQ$IWO,59`O0dQ$IWO,59`O6zQ$IWO,59`O7PQ$IWO,59`O7WQ$IWO,59hO7_Q$IWO'#G{O8eQ$IWO'#GzOOQ$IS'#Gz'#GzOOQ$IS'#DY'#DYO8|Q$IWO,59_O'UQ$IWO,59_O9[Q$IWO,59_O9aQ$IWO,5:PO'UQ$IWO,5:POOQ$IS,5:O,5:OO9oQ$IWO,5:OO9tQ$IWO,5:VO'UQ$IWO,5:VO'UQ$IWO,5:TOOQ$IS,5:S,5:SO:VQ$IWO,5:SO:[Q$IWO,5:UOOOO'#Fp'#FpO:aO`O,5:_OOQ$IS,5:_,5:_OOOO'#Fq'#FqO:iOpO,5:_O:qQ$IWO'#DuOOOO'#Fr'#FrO;RO!bO,5:`OOQ$IS,5:`,5:`OOOO'#Fu'#FuO;^O#tO,5:`OOOO'#Fv'#FvO;iO&jO,5:`OOOO'#Fw'#FwO;tO,UO,5:`OOQ$IS'#Fx'#FxO<PQ$I[O,5:dO>qQ$I[O,5=WO?[Q%GlO,5=WO?{Q$I[O,5=WOOQ$IS,5:x,5:xO@dQ$IXO'#GQOAsQ$IWO,5;TOOQ$IV,5=U,5=UOBOQ$I[O'#HtOBgQ$IWO,5;kOOQ$IS-E:V-E:VOOQ$IV,5;j,5;jO3SQ$IWO'#EwOOQ$IT-E9f-E9fOBoQ$I[O,59ZODvQ$I[O,59gOEaQ$IWO'#G}OElQ$IWO'#G}O0PQ$IWO'#G}OEwQ$IWO'#DROFPQ$IWO,59kOFUQ$IWO'#HRO'UQ$IWO'#HRO/jQ$IWO,5=lOOQ$IS,5=l,5=lO/jQ$IWO'#D|OOQ$IS'#D}'#D}OFsQ$IWO'#FzOGTQ$IWO,58zOGTQ$IWO,58zO)hQ$IWO,5:jOGcQ$I[O'#HTOOQ$IS,5:m,5:mOOQ$IS,5:u,5:uOGvQ$IWO,5:yOHXQ$IWO,5:{OOQ$IS'#F}'#F}OHgQ$I[O,5:{OHuQ$IWO,5:{OHzQ$IWO'#HwOOQ$IS,5;O,5;OOIYQ$IWO'#HsOOQ$IS,5;R,5;RO3XQ$IWO,5;VO3XQ$IWO,5;YOIkQ$I[O'#HyO'UQ$IWO'#HyOIuQ$IWO,5;[O2uQ$IWO,5;[O/jQ$IWO,5;aO0PQ$IWO,5;cOIzQ$IXO'#ElOKTQ$IZO,5;]ONiQ$IWO'#HzO3XQ$IWO,5;aONtQ$IWO,5;cONyQ$IWO,5;hO! RQ$I[O,5;mO'UQ$IWO,5;mO!#uQ$I[O1G.hO!#|Q$I[O1G.hO!&mQ$I[O1G.hO!&wQ$I[O1G.hO!)bQ$I[O1G.hO!)uQ$I[O1G.hO!*YQ$IWO'#HZO!*hQ$I[O'#GmO/jQ$IWO'#HZO!*rQ$IWO'#HYOOQ$IS,5:X,5:XO!*zQ$IWO,5:XO!+PQ$IWO'#H]O!+[Q$IWO'#H]O!+oQ$IWO,5=vOOQ$IS'#Dq'#DqOOQ$IS1G/u1G/uOOQ$IS1G.z1G.zO!,oQ$I[O1G.zO!,vQ$I[O1G.zO0dQ$IWO1G.zO!-cQ$IWO1G/SOOQ$IS'#DX'#DXO/jQ$IWO,59rOOQ$IS1G.y1G.yO!-jQ$IWO1G/cO!-zQ$IWO1G/cO!.SQ$IWO1G/dO'UQ$IWO'#HSO!.XQ$IWO'#HSO!.^Q$I[O1G.yO!.nQ$IWO,59gO!/tQ$IWO,5=rO!0UQ$IWO,5=rO!0^Q$IWO1G/kO!0cQ$I[O1G/kOOQ$IS1G/j1G/jO!0sQ$IWO,5=mO!1jQ$IWO,5=mO/jQ$IWO1G/oO!2XQ$IWO1G/qO!2^Q$I[O1G/qO!2nQ$I[O1G/oOOQ$IS1G/n1G/nOOQ$IS1G/p1G/pOOOO-E9n-E9nOOQ$IS1G/y1G/yOOOO-E9o-E9oO!3OQ$IWO'#HhO/jQ$IWO'#HhO!3^Q$IWO,5:aOOOO-E9p-E9pOOQ$IS1G/z1G/zOOOO-E9s-E9sOOOO-E9t-E9tOOOO-E9u-E9uOOQ$IS-E9v-E9vO!3iQ%GlO1G2rO!4YQ$I[O1G2rO'UQ$IWO,5<eOOQ$IS,5<e,5<eOOQ$IS-E9w-E9wOOQ$IS,5<l,5<lOOQ$IS-E:O-E:OOOQ$IV1G0o1G0oO0PQ$IWO'#F|O!4qQ$I[O,5>`OOQ$IS1G1V1G1VO!5YQ$IWO1G1VOOQ$IS'#DT'#DTO/jQ$IWO,5=iOOQ$IS,5=i,5=iO!5_Q$IWO'#FiO!5jQ$IWO,59mO!5rQ$IWO1G/VO!5|Q$I[O,5=mOOQ$IS1G3W1G3WOOQ$IS,5:h,5:hO!6mQ$IWO'#GlOOQ$IS,5<f,5<fOOQ$IS-E9x-E9xO!7OQ$IWO1G.fOOQ$IS1G0U1G0UO!7^Q$IWO,5=oO!7nQ$IWO,5=oO/jQ$IWO1G0eO/jQ$IWO1G0eO0PQ$IWO1G0gOOQ$IS-E9{-E9{O!8PQ$IWO1G0gO!8[Q$IWO1G0gO!8aQ$IWO,5>cO!8oQ$IWO,5>cO!8}Q$IWO,5>_O!9eQ$IWO,5>_O!9vQ$IZO1G0qO!=XQ$IZO1G0tO!@gQ$IWO,5>eO!@qQ$IWO,5>eO!@yQ$I[O,5>eO/jQ$IWO1G0vO!ATQ$IWO1G0vO3XQ$IWO1G0{ONtQ$IWO1G0}OOQ$IV,5;W,5;WO!AYQ$IYO,5;WO!A_Q$IZO1G0wO!DsQ$IWO'#GUO3XQ$IWO1G0wO3XQ$IWO1G0wO!EQQ$IWO,5>fO!E_Q$IWO,5>fO0PQ$IWO,5>fOOQ$IV1G0{1G0{O!EgQ$IWO'#EyO!ExQ%1`O1G0}OOQ$IV1G1S1G1SO3XQ$IWO1G1SO!FQQ$IWO'#FTOOQ$IV1G1X1G1XO! RQ$I[O1G1XOOQ$IS,5=u,5=uOOQ$IS'#Dn'#DnO/jQ$IWO,5=uO!FVQ$IWO,5=tO!FjQ$IWO,5=tOOQ$IS1G/s1G/sO!FrQ$IWO,5=wO!GSQ$IWO,5=wO!G[Q$IWO,5=wO!GoQ$IWO,5=wO!HPQ$IWO,5=wOOQ$IS1G3b1G3bOOQ$IS7+$f7+$fO!5rQ$IWO7+$nO!IrQ$IWO1G.zO!IyQ$IWO1G.zOOQ$IS1G/^1G/^OOQ$IS,5<V,5<VO'UQ$IWO,5<VOOQ$IS7+$}7+$}O!JQQ$IWO7+$}OOQ$IS-E9i-E9iOOQ$IS7+%O7+%OO!JbQ$IWO,5=nO'UQ$IWO,5=nOOQ$IS7+$e7+$eO!JgQ$IWO7+$}O!JoQ$IWO7+%OO!JtQ$IWO1G3^OOQ$IS7+%V7+%VO!KUQ$IWO1G3^O!K^Q$IWO7+%VOOQ$IS,5<U,5<UO'UQ$IWO,5<UO!KcQ$IWO1G3XOOQ$IS-E9h-E9hO!LYQ$IWO7+%ZOOQ$IS7+%]7+%]O!LhQ$IWO1G3XO!MVQ$IWO7+%]O!M[Q$IWO1G3_O!MlQ$IWO1G3_O!MtQ$IWO7+%ZO!MyQ$IWO,5>SO!NaQ$IWO,5>SO!NaQ$IWO,5>SO!NoO!LQO'#DwO!NzOSO'#HiOOOO1G/{1G/{O# PQ$IWO1G/{O# XQ%GlO7+(^O# xQ$I[O1G2PP#!cQ$IWO'#FyOOQ$IS,5<h,5<hOOQ$IS-E9z-E9zOOQ$IS7+&q7+&qOOQ$IS1G3T1G3TOOQ$IS,5<T,5<TOOQ$IS-E9g-E9gOOQ$IS7+$q7+$qO#!pQ$IWO,5=WO##ZQ$IWO,5=WO##lQ$I[O,5<WO#$PQ$IWO1G3ZOOQ$IS-E9j-E9jOOQ$IS7+&P7+&PO#$aQ$IWO7+&POOQ$IS7+&R7+&RO#$oQ$IWO'#HvO0PQ$IWO'#HuO#%TQ$IWO7+&ROOQ$IS,5<k,5<kO#%`Q$IWO1G3}OOQ$IS-E9}-E9}OOQ$IS,5<g,5<gO#%nQ$IWO1G3yOOQ$IS-E9y-E9yO#&UQ$IZO7+&]O!DsQ$IWO'#GSO3XQ$IWO7+&]O3XQ$IWO7+&`O#)gQ$I[O,5<oO'UQ$IWO,5<oO#)qQ$IWO1G4POOQ$IS-E:R-E:RO#){Q$IWO1G4PO3XQ$IWO7+&bO/jQ$IWO7+&bOOQ$IV7+&g7+&gO!ExQ%1`O7+&iO#*TQ$IXO1G0rOOQ$IV-E:S-E:SO3XQ$IWO7+&cO3XQ$IWO7+&cOOQ$IV,5<p,5<pO#+yQ$IWO,5<pOOQ$IV7+&c7+&cO#,UQ$IZO7+&cO#/dQ$IWO,5<qO#/oQ$IWO1G4QOOQ$IS-E:T-E:TO#/|Q$IWO1G4QO#0UQ$IWO'#H|O#0dQ$IWO'#H|O0PQ$IWO'#H|OOQ$IS'#H|'#H|O#0oQ$IWO'#H{OOQ$IS,5;e,5;eO#0wQ$IWO,5;eO/jQ$IWO'#E{OOQ$IV7+&i7+&iO3XQ$IWO7+&iOOQ$IV7+&n7+&nO#0|Q$IYO,5;oOOQ$IV7+&s7+&sOOQ$IS1G3a1G3aOOQ$IS,5<Y,5<YO#1RQ$IWO1G3`OOQ$IS-E9l-E9lO#1fQ$IWO,5<ZO#1qQ$IWO,5<ZO#2UQ$IWO1G3cOOQ$IS-E9m-E9mO#2fQ$IWO1G3cO#2nQ$IWO1G3cO#3OQ$IWO1G3cO#2fQ$IWO1G3cOOQ$IS<<HY<<HYO#3ZQ$I[O1G1qOOQ$IS<<Hi<<HiP#3hQ$IWO'#FkO7WQ$IWO1G3YO#3uQ$IWO1G3YO#3zQ$IWO<<HiOOQ$IS<<Hj<<HjO#4[Q$IWO7+(xOOQ$IS<<Hq<<HqO#4lQ$I[O1G1pP#5]Q$IWO'#FjO#5jQ$IWO7+(yO#5zQ$IWO7+(yO#6SQ$IWO<<HuO#6XQ$IWO7+(sOOQ$IS<<Hw<<HwO#7OQ$IWO,5<XO'UQ$IWO,5<XOOQ$IS-E9k-E9kOOQ$IS<<Hu<<HuOOQ$IS,5<_,5<_O/jQ$IWO,5<_O#7TQ$IWO1G3nOOQ$IS-E9q-E9qO#7kQ$IWO1G3nOOOO'#Ft'#FtO#7yO!LQO,5:cOOOO,5>T,5>TOOOO7+%g7+%gO#8UQ$IWO1G2rO#8oQ$IWO1G2rP'UQ$IWO'#FlO/jQ$IWO<<IkO#9QQ$IWO,5>bO#9cQ$IWO,5>bO0PQ$IWO,5>bO#9tQ$IWO,5>aOOQ$IS<<Im<<ImP0PQ$IWO'#GPP/jQ$IWO'#F{OOQ$IV-E:Q-E:QO3XQ$IWO<<IwOOQ$IV,5<n,5<nO3XQ$IWO,5<nOOQ$IV<<Iw<<IwOOQ$IV<<Iz<<IzO#9yQ$I[O1G2ZP#:TQ$IWO'#GTO#:[Q$IWO7+)kO#:fQ$IZO<<I|O3XQ$IWO<<I|OOQ$IV<<JT<<JTO3XQ$IWO<<JTOOQ$IV'#GR'#GRO#=tQ$IZO7+&^OOQ$IV<<I}<<I}O#?pQ$IZO<<I}OOQ$IV1G2[1G2[O0PQ$IWO1G2[O3XQ$IWO<<I}O0PQ$IWO1G2]P/jQ$IWO'#GVO#COQ$IWO7+)lO#C]Q$IWO7+)lOOQ$IS'#Ez'#EzO/jQ$IWO,5>hO#CeQ$IWO,5>hOOQ$IS,5>h,5>hO#CpQ$IWO,5>gO#DRQ$IWO,5>gOOQ$IS1G1P1G1POOQ$IS,5;g,5;gO#DZQ$IWO1G1ZP#D`Q$IWO'#FnO#DpQ$IWO1G1uO#ETQ$IWO1G1uO#EeQ$IWO1G1uP#EpQ$IWO'#FoO#E}Q$IWO7+(}O#F_Q$IWO7+(}O#F_Q$IWO7+(}O#FgQ$IWO7+(}O#FwQ$IWO7+(tO7WQ$IWO7+(tOOQ$ISAN>TAN>TO#GbQ$IWO<<LeOOQ$ISAN>aAN>aO/jQ$IWO1G1sO#GrQ$I[O1G1sP#G|Q$IWO'#FmOOQ$IS1G1y1G1yP#HZQ$IWO'#FsO#HhQ$IWO7+)YOOOO-E9r-E9rO#IOQ$IWO7+(^OOQ$ISAN?VAN?VO#IiQ$IWO,5<jO#I}Q$IWO1G3|OOQ$IS-E9|-E9|O#J`Q$IWO1G3|OOQ$IS1G3{1G3{OOQ$IVAN?cAN?cOOQ$IV1G2Y1G2YO3XQ$IWOAN?hO#JqQ$IZOAN?hOOQ$IVAN?oAN?oOOQ$IV-E:P-E:POOQ$IV<<Ix<<IxO3XQ$IWOAN?iO3XQ$IWO7+'vOOQ$IVAN?iAN?iOOQ$IS7+'w7+'wO#NPQ$IWO<<MWOOQ$IS1G4S1G4SO/jQ$IWO1G4SOOQ$IS,5<r,5<rO#N^Q$IWO1G4ROOQ$IS-E:U-E:UOOQ$IU'#GY'#GYO#NoQ$IYO7+&uO#NzQ$IWO'#FUO$ rQ$IWO7+'aO$!SQ$IWO7+'aOOQ$IS7+'a7+'aO$!_Q$IWO<<LiO$!oQ$IWO<<LiO$!oQ$IWO<<LiO$!wQ$IWO'#HUOOQ$IS<<L`<<L`O$#RQ$IWO<<L`OOQ$IS7+'_7+'_O0PQ$IWO1G2UP0PQ$IWO'#GOO$#lQ$IWO7+)hO$#}Q$IWO7+)hOOQ$IVG25SG25SO3XQ$IWOG25SOOQ$IVG25TG25TOOQ$IV<<Kb<<KbOOQ$IS7+)n7+)nP$$`Q$IWO'#GWOOQ$IU-E:W-E:WOOQ$IV<<Ja<<JaO$%SQ$I[O'#FWOOQ$IS'#FY'#FYO$%dQ$IWO'#FXO$&UQ$IWO'#FXOOQ$IS'#FX'#FXO$&ZQ$IWO'#IOO#NzQ$IWO'#F`O#NzQ$IWO'#F`O$&rQ$IWO'#FaO#NzQ$IWO'#FbO$&yQ$IWO'#IPOOQ$IS'#IP'#IPO$'hQ$IWO,5;pOOQ$IS<<J{<<J{O$'pQ$IWO<<J{O$(QQ$IWOANBTO$(bQ$IWOANBTO$(jQ$IWO'#HVOOQ$IS'#HV'#HVO0kQ$IWO'#DaO$)TQ$IWO,5=pOOQ$ISANAzANAzOOQ$IS7+'p7+'pO$)lQ$IWO<<MSOOQ$IVLD*nLD*nO4VQ%1`O'#G[O$)}Q$I[O,5;yO#NzQ$IWO'#FdOOQ$IS,5;},5;}OOQ$IS'#FZ'#FZO$*oQ$IWO,5;sO$*tQ$IWO,5;sOOQ$IS'#F^'#F^O#NzQ$IWO'#GZO$+fQ$IWO,5;wO$,QQ$IWO,5>jO$,bQ$IWO,5>jO0PQ$IWO,5;vO$,sQ$IWO,5;zO$,xQ$IWO,5;zO#NzQ$IWO'#IQO$,}Q$IWO'#IQO$-SQ$IWO,5;{OOQ$IS,5;|,5;|O'UQ$IWO'#FgOOQ$IU1G1[1G1[O3XQ$IWO1G1[OOQ$ISAN@gAN@gO$-XQ$IWOG27oO$-iQ$IWO,59{OOQ$IS1G3[1G3[OOQ$IS,5<v,5<vOOQ$IS-E:Y-E:YO$-nQ$I[O'#FWO$-uQ$IWO'#IRO$.TQ$IWO'#IRO$.]Q$IWO,5<OOOQ$IS1G1_1G1_O$.bQ$IWO1G1_O$.gQ$IWO,5<uOOQ$IS-E:X-E:XO$/RQ$IWO,5<yO$/jQ$IWO1G4UOOQ$IS-E:]-E:]OOQ$IS1G1b1G1bOOQ$IS1G1f1G1fO$/zQ$IWO,5>lO#NzQ$IWO,5>lOOQ$IS1G1g1G1gO$0YQ$I[O,5<ROOQ$IU7+&v7+&vO$!wQ$IWO1G/gO#NzQ$IWO,5<PO$0aQ$IWO,5>mO$0hQ$IWO,5>mOOQ$IS1G1j1G1jOOQ$IS7+&y7+&yP#NzQ$IWO'#G_O$0pQ$IWO1G4WO$0zQ$IWO1G4WO$1SQ$IWO1G4WOOQ$IS7+%R7+%RO$1bQ$IWO1G1kO$1pQ$I[O'#FWO$1wQ$IWO,5<xOOQ$IS,5<x,5<xO$2VQ$IWO1G4XOOQ$IS-E:[-E:[O#NzQ$IWO,5<wO$2^Q$IWO,5<wO$2cQ$IWO7+)rOOQ$IS-E:Z-E:ZO$2mQ$IWO7+)rO#NzQ$IWO,5<QP#NzQ$IWO'#G^O$2uQ$IWO1G2cO#NzQ$IWO1G2cP$3TQ$IWO'#G]O$3[Q$IWO<<M^O$3fQ$IWO1G1lO$3tQ$IWO7+'}O7WQ$IWO'#C{O7WQ$IWO,59`O7WQ$IWO,59`O7WQ$IWO,59`O$4SQ$I[O,5=WO7WQ$IWO1G.zO/jQ$IWO1G/VO/jQ$IWO7+$nP$4gQ$IWO'#FyO'UQ$IWO'#GlO$4tQ$IWO,59`O$4yQ$IWO,59`O$5QQ$IWO,59kO$5VQ$IWO1G/SO0kQ$IWO'#DPO7WQ$IWO,59h",
  stateData: "$5m~O%[OS%XOS%WOSQOS~OPhOTeOdsOfXOmtOq!SOtuO}vO!O!PO!R!VO!S!UO!VYO!ZZO!fdO!mdO!ndO!odO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#c!TO#f!WO#j!XO#l!YO#q!ZO#tlO#v![O%VqO%gQO%hQO%lRO%mVO&R[O&S]O&V^O&Y_O&``O&caO&ebO~OT!bO]!bO_!cOf!jO!V!lO!d!nO%b!]O%c!^O%d!_O%e!`O%f!`O%g!aO%h!aO%i!bO%j!bO%k!bO~Oi%pXj%pXk%pXl%pXm%pXn%pXq%pXx%pXy%pX!s%pX#^%pX%V%pX%Y%pX%r%pXe%pX!R%pX!S%pX%s%pX!U%pX!Y%pX!O%pX#V%pXr%pX!j%pX~P$bOdsOfXO!VYO!ZZO!fdO!mdO!ndO!odO%gQO%hQO%lRO%mVO&R[O&S]O&V^O&Y_O&``O&caO&ebO~Ox%oXy%oX#^%oX%V%oX%Y%oX%r%oX~Oi!qOj!rOk!pOl!pOm!sOn!tOq!uO!s%oX~P(cOT!{Om/iOt/wO}vO~P'UOT#OOm/iOt/wO!U#PO~P'UOT#SO_#TOm/iOt/wO!Y#UO~P'UO&T#XO&U#ZO~O&W#[O&X#ZO~O!Z#^O&Z#_O&_#aO~O!Z#^O&a#bO&b#aO~O!Z#^O&U#aO&d#dO~O!Z#^O&X#aO&f#fO~OT%aX]%aX_%aXf%aXi%aXj%aXk%aXl%aXm%aXn%aXq%aXx%aX!V%aX!d%aX%b%aX%c%aX%d%aX%e%aX%f%aX%g%aX%h%aX%i%aX%j%aX%k%aXe%aX!R%aX!S%aX~O&R[O&S]O&V^O&Y_O&``O&caO&ebOy%aX!s%aX#^%aX%V%aX%Y%aX%r%aX%s%aX!U%aX!Y%aX!O%aX#V%aXr%aX!j%aX~P+xOx#kOy%`X!s%`X#^%`X%V%`X%Y%`X%r%`X~Om/iOt/wO~P'UO#^#nO%V#pO%Y#pO~O%mVO~O!R#uO#l!YO#q!ZO#tlO~OmtO~P'UOT#zO_#{O%mVOyuP~OT$POm/iOt/wO!O$QO~P'UOy$SO!s$XO%r$TO#^!tX%V!tX%Y!tX~OT$POm/iOt/wO#^!}X%V!}X%Y!}X~P'UOm/iOt/wO#^#RX%V#RX%Y#RX~P'UO!d$_O!m$_O%mVO~OT$iO~P'UO!S$kO#j$lO#l$mO~Oy$nO~OT$uO~P'UOT%OO_%OOe%QOm/iOt/wO~P'UOm/iOt/wOy%TO~P'UO&Q%VO~O_!cOf!jO!V!lO!d!nOT`a]`ai`aj`ak`al`am`an`aq`ax`ay`a!s`a#^`a%V`a%Y`a%b`a%c`a%d`a%e`a%f`a%g`a%h`a%i`a%j`a%k`a%r`ae`a!R`a!S`a%s`a!U`a!Y`a!O`a#V`ar`a!j`a~Ol%[O~Om%[O~P'UOm/iO~P'UOi/kOj/lOk/jOl/jOm/sOn/tOq/xOe%oX!R%oX!S%oX%s%oX!U%oX!Y%oX!O%oX#V%oX!j%oX~P(cO%s%^Oe%nXx%nX!R%nX!S%nX!U%nXy%nX~Oe%`Ox%aO!R%eO!S%dO~Oe%`O~Ox%hO!R%eO!S%dO!U%zX~O!U%lO~Ox%mOy%oO!R%eO!S%dO!Y%uX~O!Y%sO~O!Y%tO~O&T#XO&U%vO~O&W#[O&X%vO~OT%yOm/iOt/wO}vO~P'UO!Z#^O&Z#_O&_%|O~O!Z#^O&a#bO&b%|O~O!Z#^O&U%|O&d#dO~O!Z#^O&X%|O&f#fO~OT!la]!la_!laf!lai!laj!lak!lal!lam!lan!laq!lax!lay!la!V!la!d!la!s!la#^!la%V!la%Y!la%b!la%c!la%d!la%e!la%f!la%g!la%h!la%i!la%j!la%k!la%r!lae!la!R!la!S!la%s!la!U!la!Y!la!O!la#V!lar!la!j!la~P#yOx&ROy%`a!s%`a#^%`a%V%`a%Y%`a%r%`a~P$bOT&TOmtOtuOy%`a!s%`a#^%`a%V%`a%Y%`a%r%`a~P'UOx&ROy%`a!s%`a#^%`a%V%`a%Y%`a%r%`a~OPhOTeOmtOtuO}vO!O!PO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#^$tX%V$tX%Y$tX~P'UO#^#nO%V&YO%Y&YO~O!d&ZOf&hX%V&hX#V&hX#^&hX%Y&hX#U&hX~Of!jO%V&]O~Oicajcakcalcamcancaqcaxcayca!sca#^ca%Vca%Yca%rcaeca!Rca!Sca%sca!Uca!Yca!Oca#Vcarca!jca~P$bOqoaxoayoa#^oa%Voa%Yoa%roa~Oi!qOj!rOk!pOl!pOm!sOn!tO!soa~PD_O%r&_Ox%qXy%qX~O%mVOx%qXy%qX~Ox&bOyuX~Oy&dO~Ox%mO#^%uX%V%uX%Y%uXe%uXy%uX!Y%uX!j%uX%r%uX~OT/rOm/iOt/wO}vO~P'UO%r$TO#^Sa%VSa%YSa~Ox&mO#^%wX%V%wX%Y%wXl%wX~P$bOx&pO!O&oO#^#Ra%V#Ra%Y#Ra~O#V&qO#^#Ta%V#Ta%Y#Ta~O!d$_O!m$_O#U&sO%mVO~O#U&sO~Ox&uO#^&kX%V&kX%Y&kX~Ox&wO#^&gX%V&gX%Y&gXy&gX~Ox&{Ol&mX~P$bOl'OO~OPhOTeOmtOtuO}vO!O!PO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO%V'TO~P'UOr'XO#g'VO#h'WOP#eaT#ead#eaf#eam#eaq#eat#ea}#ea!O#ea!R#ea!S#ea!V#ea!Z#ea!f#ea!m#ea!n#ea!o#ea!v#ea!x#ea!z#ea!|#ea#O#ea#S#ea#U#ea#X#ea#Y#ea#[#ea#c#ea#f#ea#j#ea#l#ea#q#ea#t#ea#v#ea%S#ea%V#ea%g#ea%h#ea%l#ea%m#ea&R#ea&S#ea&V#ea&Y#ea&`#ea&c#ea&e#ea%U#ea%Y#ea~Ox'YO#V'[Oy&nX~Of'^O~Of!jOy$nO~Oy'bO~P$bOT!bO]!bO_!cOf!jO!V!lO!d!nO%d!_O%e!`O%f!`O%g!aO%h!aO%i!bO%j!bO%k!bOiUijUikUilUimUinUiqUixUiyUi!sUi#^Ui%VUi%YUi%bUi%rUieUi!RUi!SUi%sUi!UUi!YUi!OUi#VUirUi!jUi~O%c!^O~P! YO%cUi~P! YOT!bO]!bO_!cOf!jO!V!lO!d!nO%g!aO%h!aO%i!bO%j!bO%k!bOiUijUikUilUimUinUiqUixUiyUi!sUi#^Ui%VUi%YUi%bUi%cUi%dUi%rUieUi!RUi!SUi%sUi!UUi!YUi!OUi#VUirUi!jUi~O%e!`O%f!`O~P!$TO%eUi%fUi~P!$TO_!cOf!jO!V!lO!d!nOiUijUikUilUimUinUiqUixUiyUi!sUi#^Ui%VUi%YUi%bUi%cUi%dUi%eUi%fUi%gUi%hUi%rUieUi!RUi!SUi%sUi!UUi!YUi!OUi#VUirUi!jUi~OT!bO]!bO%i!bO%j!bO%k!bO~P!'ROTUi]Ui%iUi%jUi%kUi~P!'RO!R%eO!S%dOe%}Xx%}X~O%r'fO%s'fO~P+xOx'hOe%|X~Oe'jO~Ox'kOy'mO!U&PX~Om/iOt/wOx'kOy'nO!U&PX~P'UO!U'pO~Ok!pOl!pOm!sOn!tOihiqhixhiyhi!shi#^hi%Vhi%Yhi%rhi~Oj!rO~P!+tOjhi~P!+tOi/kOj/lOk/jOl/jOm/sOn/tO~Or'rO~P!,}OT'wOe'xOm/iOt/wO~P'UOe'xOx'yO~Oe'{O~O!S'}O~Oe(OOx'yO!R%eO!S%dO~P$bOi/kOj/lOk/jOl/jOm/sOn/tOeoa!Roa!Soa%soa!Uoa!Yoa!Ooa#Voaroa!joa~PD_OT'wOm/iOt/wO!U%za~P'UOx(RO!U%za~O!U(SO~Ox(RO!R%eO!S%dO!U%za~P$bOT(WOm/iOt/wO!Y%ua#^%ua%V%ua%Y%uae%uay%ua!j%ua%r%ua~P'UOx(XO!Y%ua#^%ua%V%ua%Y%uae%uay%ua!j%ua%r%ua~O!Y([O~Ox(XO!R%eO!S%dO!Y%ua~P$bOx(_O!R%eO!S%dO!Y%{a~P$bOx(bOy&[X!Y&[X!j&[X~Oy(eO!Y(gO!j(hO~OT&TOmtOtuOy%`i!s%`i#^%`i%V%`i%Y%`i%r%`i~P'UOx(iOy%`i!s%`i#^%`i%V%`i%Y%`i%r%`i~O!d&ZOf&ha%V&ha#V&ha#^&ha%Y&ha#U&ha~O%V(nO~OT#zO_#{O%mVO~Ox&bOyua~OmtOtuO~P'UOx(XO#^%ua%V%ua%Y%uae%uay%ua!Y%ua!j%ua%r%ua~P$bOx(sO#^%`X%V%`X%Y%`X%r%`X~O%r$TO#^Si%VSi%YSi~O#^%wa%V%wa%Y%wal%wa~P'UOx(vO#^%wa%V%wa%Y%wal%wa~OT(zOf(|O%mVO~O#U(}O~O%mVO#^&ka%V&ka%Y&ka~Ox)PO#^&ka%V&ka%Y&ka~Om/iOt/wO#^&ga%V&ga%Y&gay&ga~P'UOx)SO#^&ga%V&ga%Y&gay&ga~Or)WO#a)VOP#_iT#_id#_if#_im#_iq#_it#_i}#_i!O#_i!R#_i!S#_i!V#_i!Z#_i!f#_i!m#_i!n#_i!o#_i!v#_i!x#_i!z#_i!|#_i#O#_i#S#_i#U#_i#X#_i#Y#_i#[#_i#c#_i#f#_i#j#_i#l#_i#q#_i#t#_i#v#_i%S#_i%V#_i%g#_i%h#_i%l#_i%m#_i&R#_i&S#_i&V#_i&Y#_i&`#_i&c#_i&e#_i%U#_i%Y#_i~Or)XOP#biT#bid#bif#bim#biq#bit#bi}#bi!O#bi!R#bi!S#bi!V#bi!Z#bi!f#bi!m#bi!n#bi!o#bi!v#bi!x#bi!z#bi!|#bi#O#bi#S#bi#U#bi#X#bi#Y#bi#[#bi#c#bi#f#bi#j#bi#l#bi#q#bi#t#bi#v#bi%S#bi%V#bi%g#bi%h#bi%l#bi%m#bi&R#bi&S#bi&V#bi&Y#bi&`#bi&c#bi&e#bi%U#bi%Y#bi~OT)ZOl&ma~P'UOx)[Ol&ma~Ox)[Ol&ma~P$bOl)`O~O%T)cO~Or)fO#g'VO#h)eOP#eiT#eid#eif#eim#eiq#eit#ei}#ei!O#ei!R#ei!S#ei!V#ei!Z#ei!f#ei!m#ei!n#ei!o#ei!v#ei!x#ei!z#ei!|#ei#O#ei#S#ei#U#ei#X#ei#Y#ei#[#ei#c#ei#f#ei#j#ei#l#ei#q#ei#t#ei#v#ei%S#ei%V#ei%g#ei%h#ei%l#ei%m#ei&R#ei&S#ei&V#ei&Y#ei&`#ei&c#ei&e#ei%U#ei%Y#ei~Om/iOt/wOy$nO~P'UOm/iOt/wOy&na~P'UOx)lOy&na~OT)pO_)qOe)tO%i)rO%mVO~Oy$nO&q)vO~O%V)zO~OT%OO_%OOm/iOt/wOe%|a~P'UOx*OOe%|a~Om/iOt/wOy*RO!U&Pa~P'UOx*SO!U&Pa~Om/iOt/wOx*SOy*VO!U&Pa~P'UOm/iOt/wOx*SO!U&Pa~P'UOx*SOy*VO!U&Pa~Ok/jOl/jOm/sOn/tOehiihiqhixhi!Rhi!Shi%shi!Uhiyhi!Yhi#^hi%Vhi%Yhi!Ohi#Vhirhi!jhi%rhi~Oj/lO~P!H[Ojhi~P!H[OT'wOe*[Om/iOt/wO~P'UOl*^O~Oe*[Ox*`O~Oe*aO~OT'wOm/iOt/wO!U%zi~P'UOx*bO!U%zi~O!U*cO~OT(WOm/iOt/wO!Y%ui#^%ui%V%ui%Y%uie%uiy%ui!j%ui%r%ui~P'UOx*fO!R%eO!S%dO!Y%{i~Ox*iO!Y%ui#^%ui%V%ui%Y%uie%uiy%ui!j%ui%r%ui~O!Y*jO~O_*lOm/iOt/wO!Y%{i~P'UOx*fO!Y%{i~O!Y*nO~OT*pOm/iOt/wOy&[a!Y&[a!j&[a~P'UOx*qOy&[a!Y&[a!j&[a~O!Z#^O&^*tO!Y!kX~O!Y*vO~Oy(eO!Y*wO~OT&TOmtOtuOy%`q!s%`q#^%`q%V%`q%Y%`q%r%`q~P'UOx$miy$mi!s$mi#^$mi%V$mi%Y$mi%r$mi~P$bOT&TOmtOtuO~P'UOT&TOm/iOt/wO#^%`a%V%`a%Y%`a%r%`a~P'UOx*xO#^%`a%V%`a%Y%`a%r%`a~Ox$`a#^$`a%V$`a%Y$`al$`a~P$bO#^%wi%V%wi%Y%wil%wi~P'UOx*{O#^#Rq%V#Rq%Y#Rq~Ox*|O#V+OO#^&jX%V&jX%Y&jXe&jX~OT+QOf(|O%mVO~O%mVO#^&ki%V&ki%Y&ki~Om/iOt/wO#^&gi%V&gi%Y&giy&gi~P'UOr+UO#a)VOP#_qT#_qd#_qf#_qm#_qq#_qt#_q}#_q!O#_q!R#_q!S#_q!V#_q!Z#_q!f#_q!m#_q!n#_q!o#_q!v#_q!x#_q!z#_q!|#_q#O#_q#S#_q#U#_q#X#_q#Y#_q#[#_q#c#_q#f#_q#j#_q#l#_q#q#_q#t#_q#v#_q%S#_q%V#_q%g#_q%h#_q%l#_q%m#_q&R#_q&S#_q&V#_q&Y#_q&`#_q&c#_q&e#_q%U#_q%Y#_q~Ol$wax$wa~P$bOT)ZOl&mi~P'UOx+]Ol&mi~OPhOTeOmtOq!SOtuO}vO!O!PO!R!VO!S!UO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#c!TO#f!WO#j!XO#l!YO#q!ZO#tlO#v![O~P'UOx+gOy$nO#V+gO~O#h+hOP#eqT#eqd#eqf#eqm#eqq#eqt#eq}#eq!O#eq!R#eq!S#eq!V#eq!Z#eq!f#eq!m#eq!n#eq!o#eq!v#eq!x#eq!z#eq!|#eq#O#eq#S#eq#U#eq#X#eq#Y#eq#[#eq#c#eq#f#eq#j#eq#l#eq#q#eq#t#eq#v#eq%S#eq%V#eq%g#eq%h#eq%l#eq%m#eq&R#eq&S#eq&V#eq&Y#eq&`#eq&c#eq&e#eq%U#eq%Y#eq~O#V+iOx$yay$ya~Om/iOt/wOy&ni~P'UOx+kOy&ni~Oy$SO%r+mOe&pXx&pX~O%mVOe&pXx&pX~Ox+qOe&oX~Oe+sO~O%T+uO~OT%OO_%OOm/iOt/wOe%|i~P'UOy+wOx$ca!U$ca~Om/iOt/wOy+xOx$ca!U$ca~P'UOm/iOt/wOy*RO!U&Pi~P'UOx+{O!U&Pi~Om/iOt/wOx+{O!U&Pi~P'UOx+{Oy,OO!U&Pi~Oe$_ix$_i!U$_i~P$bOT'wOm/iOt/wO~P'UOl,QO~OT'wOe,ROm/iOt/wO~P'UOT'wOm/iOt/wO!U%zq~P'UOx$^i!Y$^i#^$^i%V$^i%Y$^ie$^iy$^i!j$^i%r$^i~P$bOT(WOm/iOt/wO~P'UO_*lOm/iOt/wO!Y%{q~P'UOx,SO!Y%{q~O!Y,TO~OT(WOm/iOt/wO!Y%uq#^%uq%V%uq%Y%uqe%uqy%uq!j%uq%r%uq~P'UOy,UO~OT*pOm/iOt/wOy&[i!Y&[i!j&[i~P'UOx,ZOy&[i!Y&[i!j&[i~O!Z#^O&^*tO!Y!ka~OT&TOm/iOt/wO#^%`i%V%`i%Y%`i%r%`i~P'UOx,]O#^%`i%V%`i%Y%`i%r%`i~O%mVO#^&ja%V&ja%Y&jae&ja~Ox,`O#^&ja%V&ja%Y&jae&ja~Oe,cO~Ol$wix$wi~P$bOT)ZO~P'UOT)ZOl&mq~P'UOr,fOP#dyT#dyd#dyf#dym#dyq#dyt#dy}#dy!O#dy!R#dy!S#dy!V#dy!Z#dy!f#dy!m#dy!n#dy!o#dy!v#dy!x#dy!z#dy!|#dy#O#dy#S#dy#U#dy#X#dy#Y#dy#[#dy#c#dy#f#dy#j#dy#l#dy#q#dy#t#dy#v#dy%S#dy%V#dy%g#dy%h#dy%l#dy%m#dy&R#dy&S#dy&V#dy&Y#dy&`#dy&c#dy&e#dy%U#dy%Y#dy~OPhOTeOmtOq!SOtuO}vO!O!PO!R!VO!S!UO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#c!TO#f!WO#j!XO#l!YO#q!ZO#tlO#v![O%U,jO%Y,jO~P'UO#h,kOP#eyT#eyd#eyf#eym#eyq#eyt#ey}#ey!O#ey!R#ey!S#ey!V#ey!Z#ey!f#ey!m#ey!n#ey!o#ey!v#ey!x#ey!z#ey!|#ey#O#ey#S#ey#U#ey#X#ey#Y#ey#[#ey#c#ey#f#ey#j#ey#l#ey#q#ey#t#ey#v#ey%S#ey%V#ey%g#ey%h#ey%l#ey%m#ey&R#ey&S#ey&V#ey&Y#ey&`#ey&c#ey&e#ey%U#ey%Y#ey~Om/iOt/wOy&nq~P'UOx,oOy&nq~O%r+mOe&pax&pa~OT)pO_)qO%i)rO%mVOe&oa~Ox,sOe&oa~O#y,wO~OT%OO_%OOm/iOt/wO~P'UOm/iOt/wOy,xOx$ci!U$ci~P'UOm/iOt/wOx$ci!U$ci~P'UOy,xOx$ci!U$ci~Om/iOt/wOy*RO~P'UOm/iOt/wOy*RO!U&Pq~P'UOx,{O!U&Pq~Om/iOt/wOx,{O!U&Pq~P'UOq-OO!R%eO!S%dOe%vq!U%vq!Y%vqx%vq~P!,}O_*lOm/iOt/wO!Y%{y~P'UOx$ai!Y$ai~P$bO_*lOm/iOt/wO~P'UOT*pOm/iOt/wO~P'UOT*pOm/iOt/wOy&[q!Y&[q!j&[q~P'UOT&TOm/iOt/wO#^%`q%V%`q%Y%`q%r%`q~P'UO#V-SOx$ra#^$ra%V$ra%Y$rae$ra~O%mVO#^&ji%V&ji%Y&jie&ji~Ox-UO#^&ji%V&ji%Y&jie&ji~Or-XOP#d!RT#d!Rd#d!Rf#d!Rm#d!Rq#d!Rt#d!R}#d!R!O#d!R!R#d!R!S#d!R!V#d!R!Z#d!R!f#d!R!m#d!R!n#d!R!o#d!R!v#d!R!x#d!R!z#d!R!|#d!R#O#d!R#S#d!R#U#d!R#X#d!R#Y#d!R#[#d!R#c#d!R#f#d!R#j#d!R#l#d!R#q#d!R#t#d!R#v#d!R%S#d!R%V#d!R%g#d!R%h#d!R%l#d!R%m#d!R&R#d!R&S#d!R&V#d!R&Y#d!R&`#d!R&c#d!R&e#d!R%U#d!R%Y#d!R~Om/iOt/wOy&ny~P'UOT)pO_)qO%i)rO%mVOe&oi~O#y,wO%U-_O%Y-_O~OT-iOf-gO!V-fO!Z-hO!f-bO!n-dO!o-dO%h-aO%mVO&R[O&S]O&V^O~Om/iOt/wOx$cq!U$cq~P'UOy-nOx$cq!U$cq~Om/iOt/wOy*RO!U&Py~P'UOx-oO!U&Py~Om/iOt-sO~P'UOq-OO!R%eO!S%dOe%vy!U%vy!Y%vyx%vy~P!,}O%mVO#^&jq%V&jq%Y&jqe&jq~Ox-wO#^&jq%V&jq%Y&jqe&jq~OT)pO_)qO%i)rO%mVO~Of-{O!d-yOx#zX#V#zX%b#zXe#zX~Oq#zXy#zX!U#zX!Y#zX~P$$nO%g-}O%h-}Oq#{Xx#{Xy#{X#V#{X%b#{X!U#{Xe#{X!Y#{X~O!f.PO~Ox.TO#V.VO%b.QOq&rXy&rX!U&rXe&rX~O_.YO~P$ WOf-{Oq&sXx&sXy&sX#V&sX%b&sX!U&sXe&sX!Y&sX~Oq.^Oy$nO~Om/iOt/wOx$cy!U$cy~P'UOm/iOt/wOy*RO!U&P!R~P'UOx.bO!U&P!R~Oe%yXq%yX!R%yX!S%yX!U%yX!Y%yXx%yX~P!,}Oq-OO!R%eO!S%dOe%xa!U%xa!Y%xax%xa~O%mVO#^&jy%V&jy%Y&jye&jy~O!d-yOf$Raq$Rax$Ray$Ra#V$Ra%b$Ra!U$Rae$Ra!Y$Ra~O!f.kO~O%g-}O%h-}Oq#{ax#{ay#{a#V#{a%b#{a!U#{ae#{a!Y#{a~O%b.QOq$Pax$Pay$Pa#V$Pa!U$Pae$Pa!Y$Pa~Oq&ray&ra!U&rae&ra~P#NzOx.pOq&ray&ra!U&rae&ra~O!U.sO~Oe.sO~Oy.uO~O!Y.vO~Om/iOt/wOy*RO!U&P!Z~P'UOy.yO~O%r.zO~P$$nOx.{O#V.VO%b.QOe&uX~Ox.{Oe&uX~Oe.}O~O!f/OO~O#V.VOq$}ax$}ay$}a%b$}a!U$}ae$}a!Y$}a~O#V.VO%b.QOq%Rax%Ray%Ra!U%Rae%Ra~Oq&riy&ri!U&rie&ri~P#NzOx/QO#V.VO%b.QO!Y&ta~Oy$Za~P$bOe&ua~P#NzOx/YOe&ua~O_/[O!Y&ti~P$ WOx/^O!Y&ti~Ox/^O#V.VO%b.QO!Y&ti~O#V.VO%b.QOe$Xix$Xi~O%r/aO~P$$nO#V.VO%b.QOe%Qax%Qa~Oe&ui~P#NzOy/dO~O_/[O!Y&tq~P$ WOx/fO!Y&tq~O#V.VO%b.QOx%Pi!Y%Pi~O_/[O~P$ WO_/[O!Y&ty~P$ WO#V.VO%b.QOe$Yix$Yi~O#V.VO%b.QOx%Pq!Y%Pq~Ox*xO#^%`a%V%`a%Y%`a%r%`a~P$bOT&TOm/iOt/wO~P'UOl/nO~Om/nO~P'UOy/oO~Or/pO~P!,}O&S&V&c&e&R!Z&Z&a&d&f&Y&`&Y%m~",
  goto: "!9p&vPPPP&wP'P*e*}+h,S,o-]P-zP'P.k.k'PPPP'P2PPPPPPP2P4oPP4oP6{7U=QPP=T=c=fPP'P'PPP=rPP'P'PPP'P'P'P'P'P=v>m'PP>pP>vByFcPFw'PPPPF{GR&wP&w&wP&wP&wP&wP&wP&w&w&wP&wPP&wPP&wPGXPG`GfPG`PG`G`PPPG`PIePInItIzIePG`JQPG`PJXJ_PJcJwKfLPJcJcLVLdJcJcJcJcLxMOMRMWMZMaMgMsNVN]NgNm! Z! a! g! m! w! }!!T!!Z!!a!!g!!y!#T!#Z!#a!#g!#q!#w!#}!$T!$Z!$e!$k!$u!${!%U!%[!%k!%s!%}!&UPPPPPPPPP!&[!&d!&m!&w!'SPPPPPPPPPPPP!+r!,[!0j!3vPP!4O!4^!4g!5]!5S!5f!5l!5o!5r!5u!5}!6nPPPPPPPPPP!6q!6tPPPPPPPPP!6z!7W!7d!7j!7s!7v!7|!8S!8Y!8]P!8e!8n!9j!9m]iOr#n$n)c+c'udOSXYZehrstvx|}!R!S!T!U!X![!d!e!f!g!h!i!j!l!p!q!r!t!u!{#O#S#T#^#k#n$P$Q$S$U$X$i$k$l$n$u%O%T%[%_%a%d%h%m%o%y&R&T&`&d&m&o&p&w&{'O'V'Y'g'h'k'm'n'r'w'y'}(R(W(X(_(b(i(k(s(v)S)V)Z)[)`)c)l)v*O*R*S*V*]*^*`*b*e*f*i*l*p*q*x*z*{+S+[+]+c+j+k+n+v+w+x+z+{,O,Q,S,U,W,Y,Z,],o,q,x,{-O-n-o.^.b.y/i/j/k/l/n/o/p/q/r/t/x}!dP#j#w$Y$h$t%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/m!P!eP#j#w$Y$h$t$v%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/m!R!fP#j#w$Y$h$t$v$w%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/m!T!gP#j#w$Y$h$t$v$w$x%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/m!V!hP#j#w$Y$h$t$v$w$x$y%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/m!X!iP#j#w$Y$h$t$v$w$x$y$z%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/m!]!iP!o#j#w$Y$h$t$v$w$x$y$z${%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/m'uSOSXYZehrstvx|}!R!S!T!U!X![!d!e!f!g!h!i!j!l!p!q!r!t!u!{#O#S#T#^#k#n$P$Q$S$U$X$i$k$l$n$u%O%T%[%_%a%d%h%m%o%y&R&T&`&d&m&o&p&w&{'O'V'Y'g'h'k'm'n'r'w'y'}(R(W(X(_(b(i(k(s(v)S)V)Z)[)`)c)l)v*O*R*S*V*]*^*`*b*e*f*i*l*p*q*x*z*{+S+[+]+c+j+k+n+v+w+x+z+{,O,Q,S,U,W,Y,Z,],o,q,x,{-O-n-o.^.b.y/i/j/k/l/n/o/p/q/r/t/x&ZUOXYZhrtv|}!R!S!T!X!j!l!p!q!r!t!u#^#k#n$Q$S$U$X$l$n%O%T%[%_%a%h%m%o%y&R&`&d&o&p&w'O'V'Y'g'h'k'm'n'r'y(R(X(_(b(i(k(s)S)V)`)c)l)v*O*R*S*V*]*^*`*b*e*f*i*p*q*x*{+S+c+j+k+n+v+w+x+z+{,O,Q,S,U,W,Y,Z,],o,q,x,{-O-n-o.b.y/i/j/k/l/n/o/p/q/t/x%eWOXYZhrv|}!R!S!T!X!j!l#^#k#n$Q$S$U$X$l$n%O%T%_%a%h%m%o%y&R&`&d&o&p&w'O'V'Y'g'h'k'm'n'r'y(R(X(_(b(i(k(s)S)V)`)c)l)v*O*R*S*V*]*`*b*e*f*i*p*q*x*{+S+c+j+k+n+v+w+x+z+{,O,S,U,W,Y,Z,],o,q,x,{-n-o.b/o/p/qQ#}uQ.c-sR/u/w'ldOSXYZehrstvx|}!R!S!T!U!X![!d!e!f!g!h!i!l!p!q!r!t!u!{#O#S#T#^#k#n$P$Q$S$U$X$i$k$l$n$u%O%T%[%_%a%d%h%m%o%y&R&T&`&d&m&o&p&w&{'O'V'Y'g'k'm'n'r'w'y'}(R(W(X(_(b(i(k(s(v)S)V)Z)[)`)c)l)v*R*S*V*]*^*`*b*e*f*i*l*p*q*x*z*{+S+[+]+c+j+k+n+w+x+z+{,O,Q,S,U,W,Y,Z,],o,q,x,{-O-n-o.^.b.y/i/j/k/l/n/o/p/q/r/t/xW#ql!O!P$`W#yu&b-s/wQ$b!QQ$r!YQ$s!ZW$}!j'h*O+vS&a#z#{Q'R$mQ(l&ZQ(z&qU({&s(|(}U)O&u)P+RQ)n'[W)o'^+q,s-]S+p)p)qY,_*|,`-T-U-wQ,b+OQ,l+gQ,n+il-`,w-f-g-i.R.T.Y.p.u.z/P/[/a/dQ-v-SQ.Z-hQ.g-{Q.r.VU/V.{/Y/bX/]/Q/^/e/fR&`#yi!xXY!S!T%a%h'y(R)V*]*`*bR%_!wQ!|XQ%z#^Q&i$UR&l$XT-r-O.y![!kP!o#j#w$Y$h$t$v$w$x$y$z${%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/mQ&^#rR'a$sR'g$}Q%W!nR.e-y'tcOSXYZehrstvx|}!R!S!T!U!X![!d!e!f!g!h!i!j!l!p!q!r!t!u!{#O#S#T#^#k#n$P$Q$S$U$X$i$k$l$n$u%O%T%[%_%a%d%h%m%o%y&R&T&`&d&m&o&p&w&{'O'V'Y'g'h'k'm'n'r'w'y'}(R(W(X(_(b(i(k(s(v)S)V)Z)[)`)c)l)v*O*R*S*V*]*^*`*b*e*f*i*l*p*q*x*z*{+S+[+]+c+j+k+n+v+w+x+z+{,O,Q,S,U,W,Y,Z,],o,q,x,{-O-n-o.^.b.y/i/j/k/l/n/o/p/q/r/t/xS#hc#i!P-d,w-f-g-h-i-{.R.T.Y.p.u.z.{/P/Q/Y/[/^/a/b/d/e/f'tcOSXYZehrstvx|}!R!S!T!U!X![!d!e!f!g!h!i!j!l!p!q!r!t!u!{#O#S#T#^#k#n$P$Q$S$U$X$i$k$l$n$u%O%T%[%_%a%d%h%m%o%y&R&T&`&d&m&o&p&w&{'O'V'Y'g'h'k'm'n'r'w'y'}(R(W(X(_(b(i(k(s(v)S)V)Z)[)`)c)l)v*O*R*S*V*]*^*`*b*e*f*i*l*p*q*x*z*{+S+[+]+c+j+k+n+v+w+x+z+{,O,Q,S,U,W,Y,Z,],o,q,x,{-O-n-o.^.b.y/i/j/k/l/n/o/p/q/r/t/xT#hc#iS#__#`S#b`#cS#da#eS#fb#gT*t(e*uT(f%z(hQ$WwR+o)oX$Uw$V$W&kZkOr$n)c+cXoOr)c+cQ$o!WQ&y$fQ&z$gQ']$qQ'`$sQ)a'QQ)g'VQ)i'WQ)j'XQ)w'_Q)y'aQ+V)VQ+X)WQ+Y)XQ+^)_S+`)b)xQ+d)eQ+e)fQ+f)hQ,d+UQ,e+WQ,g+_Q,h+aQ,m+hQ-W,fQ-Y,kQ-Z,lQ-x-XQ._-lR.x.`WoOr)c+cR#tnQ'_$rR)b'RQ+n)oR,q+oQ)x'_R+a)bZmOnr)c+cQ'c$tR){'dT,u+u,vu-k,w-f-g-i-{.R.T.Y.p.u.z.{/P/Y/[/a/b/dt-k,w-f-g-i-{.R.T.Y.p.u.z.{/P/Y/[/a/b/dQ.Z-hX/]/Q/^/e/f!P-c,w-f-g-h-i-{.R.T.Y.p.u.z.{/P/Q/Y/[/^/a/b/d/e/fQ.O-bR.l.Pg.R-e.S.h.o.t/S/U/W/c/g/hu-j,w-f-g-i-{.R.T.Y.p.u.z.{/P/Y/[/a/b/dX-|-`-j.g/VR.i-{V/X.{/Y/bR.`-lQrOR#vrQ&c#|R(q&cS%n#R$OS(Y%n(]T(]%q&eQ%b!zQ%i!}W'z%b%i(P(TQ(P%fR(T%kQ&n$YR(w&nQ(`%rQ*g(ZT*m(`*gQ'i%PR*P'iS'l%S%TY*T'l*U+|,|-pU*U'm'n'oU+|*V*W*XS,|+},OR-p,}Q#Y]R%u#YQ#]^R%w#]Q#`_R%{#`Q(c%xS*r(c*sR*s(dQ*u(eR,[*uQ#c`R%}#cQ#eaR&O#eQ#gbR&P#gQ#icR&Q#iQ#lfQ&S#jW&V#l&S(t*yQ(t&hR*y/mQ$VwS&j$V&kR&k$WQ&x$dR)T&xQ&[#qR(m&[Q$`!PR&r$`Q*}({S,a*}-VR-V,bQ&v$bR)Q&vQ#ojR&X#oQ+c)cR,i+cQ)U&yR+T)UQ&|$hS)]&|)^R)^&}Q'U$oR)d'UQ'Z$pS)m'Z+lR+l)nQ+r)sR,t+rWnOr)c+cR#snQ,v+uR-^,vd.S-e.h.o.t/S/U/W/c/g/hR.n.SU-z-`.g/VR.f-zQ/R.tS/_/R/`R/`/SS.|.h.iR/Z.|Q.U-eR.q.USqOrT+b)c+cWpOr)c+cR'S$nYjOr$n)c+cR&W#n[wOr#n$n)c+cR&i$U&YPOXYZhrtv|}!R!S!T!X!j!l!p!q!r!t!u#^#k#n$Q$S$U$X$l$n%O%T%[%_%a%h%m%o%y&R&`&d&o&p&w'O'V'Y'g'h'k'm'n'r'y(R(X(_(b(i(k(s)S)V)`)c)l)v*O*R*S*V*]*^*`*b*e*f*i*p*q*x*{+S+c+j+k+n+v+w+x+z+{,O,Q,S,U,W,Y,Z,],o,q,x,{-O-n-o.b.y/i/j/k/l/n/o/p/q/t/xQ!oSQ#jeQ#wsU$Yx%d'}S$h!U$kQ$t![Q$v!dQ$w!eQ$x!fQ$y!gQ$z!hQ${!iQ%f!{Q%k#OQ%q#SQ%r#TQ&e$PQ&}$iQ'd$uQ(j&TU(u&m(v*zW)Y&{)[+[+]Q*Z'wQ*d(WQ+Z)ZQ,V*lQ.w.^R/m/rQ!zXQ!}YQ$f!SQ$g!T^'v%a%h'y(R*]*`*bR+W)V[fOr#n$n)c+ch!wXY!S!T%a%h'y(R)V*]*`*bQ#RZQ#mhS$Ov|Q$]}W$d!R$X'O)`S$p!X$lW$|!j'h*O+vQ%S!lQ%x#^`&U#k&R(i(k(s*x,]/qQ&f$QQ&g$SQ&h$UQ'e%OQ'o%TQ'u%_W(V%m(X*e*iQ(Z%oQ(d%yQ(o&`S(r&d/oQ(x&oQ(y&pU)R&w)S+SQ)h'VY)k'Y)l+j+k,oQ)|'g^*Q'k*S+z+{,{-o.bQ*W'mQ*X'nS*Y'r/pW*k(_*f,S,WW*o(b*q,Y,ZQ+t)vQ+y*RQ+}*VQ,X*pQ,^*{Q,p+nQ,y+wQ,z+xQ,},OQ-R,UQ-[,qQ-m,xR.a-nhTOr#k#n$n&R&d'r(i(k)c+c$z!vXYZhv|}!R!S!T!X!j!l#^$Q$S$U$X$l%O%T%_%a%h%m%o%y&`&o&p&w'O'V'Y'g'h'k'm'n'y(R(X(_(b(s)S)V)`)l)v*O*R*S*V*]*`*b*e*f*i*p*q*x*{+S+j+k+n+v+w+x+z+{,O,S,U,W,Y,Z,],o,q,x,{-n-o.b/o/p/qQ#xtW%X!p!t/j/tQ%Y!qQ%Z!rQ%]!uQ%g/iS'q%[/nQ's/kQ't/lQ,P*^Q-Q,QS-q-O.yR/v/xU#|u-s/wR(p&b[gOr#n$n)c+cX!yX#^$U$XQ#WZQ$RvR$[|Q%c!zQ%j!}Q%p#RQ'e$|Q(Q%fQ(U%kQ(^%qQ(a%rQ*h(ZQ-P,PQ-u-QR.d-tQ$ZxQ'|%dR*_'}Q-t-OR/T.yR#QYR#VZR%R!jQ%P!jV)}'h*O+v!]!mP!o#j#w$Y$h$t$v$w$x$y$z${%f%k%q%r&e&}'d(j(u)Y*Z*d+Z,V.w/mR%U!lR%z#^Q(g%zR*w(hQ$e!RQ&l$XQ)_'OR+_)`Q#rlQ$^!OQ$a!PR&t$`Q(z&sR+Q(}Q(z&sQ+P(|R+Q(}R$c!QXpOr)c+cQ$j!UR'P$kQ$q!XR'Q$lR)u'^Q)s'^V,r+q,s-]Q-l,wQ.W-fR.X-gU-e,w-f-gQ.]-iQ.h-{Q.m.RU.o.T.p/PQ.t.YQ/S.uQ/U.zU/W.{/Y/bQ/c/[Q/g/aR/h/dR.[-hR.j-{",
  nodeNames: "⚠ print Comment Script AssignStatement * BinaryExpression BitOp BitOp BitOp BitOp ArithOp ArithOp @ ArithOp ** UnaryExpression ArithOp BitOp AwaitExpression await ) ( ParenthesizedExpression BinaryExpression or and CompareOp in not is UnaryExpression ConditionalExpression if else LambdaExpression lambda ParamList VariableName AssignOp , : NamedExpression AssignOp YieldExpression yield from TupleExpression ComprehensionExpression async for LambdaExpression ] [ ArrayExpression ArrayComprehensionExpression } { DictionaryExpression DictionaryComprehensionExpression SetExpression SetComprehensionExpression CallExpression ArgList AssignOp MemberExpression . PropertyName Number String FormatString FormatReplacement FormatConversion FormatSpec ContinuedString Ellipsis None Boolean TypeDef AssignOp UpdateStatement UpdateOp ExpressionStatement DeleteStatement del PassStatement pass BreakStatement break ContinueStatement continue ReturnStatement return YieldStatement PrintStatement RaiseStatement raise ImportStatement import as ScopeStatement global nonlocal AssertStatement assert StatementGroup ; IfStatement Body elif WhileStatement while ForStatement TryStatement try except finally WithStatement with FunctionDefinition def ParamList AssignOp TypeDef ClassDefinition class DecoratedStatement Decorator At MatchStatement match MatchBody MatchClause case CapturePattern LiteralPattern ArithOp ArithOp AsPattern OrPattern LogicOp AttributePattern SequencePattern MappingPattern StarPattern ClassPattern PatternArgList KeywordPattern KeywordPattern Guard",
  maxTerm: 267,
  context: trackIndent,
  nodeProps: [
    ["group", -14,4,80,82,83,85,87,89,91,93,94,95,97,100,103,"Statement Statement",-22,6,16,19,23,38,47,48,54,55,58,59,60,61,62,65,68,69,70,74,75,76,77,"Expression",-10,105,107,110,112,113,117,119,124,126,129,"Statement",-9,134,135,138,139,141,142,143,144,145,"Pattern"],
    ["openedBy", 21,"(",52,"[",56,"{"],
    ["closedBy", 22,")",53,"]",57,"}"]
  ],
  propSources: [pythonHighlighting],
  skippedNodes: [0,2],
  repeatNodeCount: 38,
  tokenData: "&JdMgR!^OX$}XY!&]Y[$}[]!&]]p$}pq!&]qr!(grs!,^st!IYtu$}uv$5[vw$7nwx$8zxy%'vyz%(|z{%*S{|%,r|}%.O}!O%/U!O!P%1k!P!Q%<q!Q!R%?a!R![%Cc![!]%N_!]!^&!q!^!_&#w!_!`&&g!`!a&'s!a!b$}!b!c&*`!c!d&+n!d!e&-`!e!h&+n!h!i&7[!i!t&+n!t!u&@j!u!w&+n!w!x&5j!x!}&+n!}#O&Bt#O#P!'u#P#Q&Cz#Q#R&EQ#R#S&+n#S#T$}#T#U&+n#U#V&-`#V#Y&+n#Y#Z&7[#Z#f&+n#f#g&@j#g#i&+n#i#j&5j#j#o&+n#o#p&F^#p#q&GS#q#r&H`#r#s&I^#s$g$}$g~&+n<r%`Z&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<Q&^Z&^7[&TS&Z`&d!bOr'PrsFisw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'P<Q'`Z&^7[&TS&WW&Z`&d!b&f#tOr'Prs&Rsw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'P;p([Z&^7[&WW&f#tOr(}rs)}sw(}wx={x#O(}#O#P2]#P#o(}#o#p:X#p#q(}#q#r2q#r~(};p)[Z&^7[&TS&WW&d!b&f#tOr(}rs)}sw(}wx(Rx#O(}#O#P2]#P#o(}#o#p:X#p#q(}#q#r2q#r~(};p*WZ&^7[&TS&d!bOr(}rs*ysw(}wx(Rx#O(}#O#P2]#P#o(}#o#p:X#p#q(}#q#r2q#r~(};p+SZ&^7[&TS&d!bOr(}rs+usw(}wx(Rx#O(}#O#P2]#P#o(}#o#p:X#p#q(}#q#r2q#r~(}8r,OX&^7[&TS&d!bOw+uwx,kx#O+u#O#P.]#P#o+u#o#p0d#p#q+u#q#r.q#r~+u8r,pX&^7[Ow+uwx-]x#O+u#O#P.]#P#o+u#o#p0d#p#q+u#q#r.q#r~+u8r-bX&^7[Ow+uwx-}x#O+u#O#P.]#P#o+u#o#p0d#p#q+u#q#r.q#r~+u7[.SR&^7[O#o-}#p#q-}#r~-}8r.bT&^7[O#o+u#o#p.q#p#q+u#q#r.q#r~+u!f.xV&TS&d!bOw.qwx/_x#O.q#O#P0^#P#o.q#o#p0d#p~.q!f/bVOw.qwx/wx#O.q#O#P0^#P#o.q#o#p0d#p~.q!f/zUOw.qx#O.q#O#P0^#P#o.q#o#p0d#p~.q!f0aPO~.q!f0iV&TSOw1Owx1dx#O1O#O#P2V#P#o1O#o#p.q#p~1OS1TT&TSOw1Owx1dx#O1O#O#P2V#P~1OS1gTOw1Owx1vx#O1O#O#P2V#P~1OS1ySOw1Ox#O1O#O#P2V#P~1OS2YPO~1O;p2bT&^7[O#o(}#o#p2q#p#q(}#q#r2q#r~(}%d2|X&TS&WW&d!b&f#tOr2qrs3isw2qwx5Px#O2q#O#P:R#P#o2q#o#p:X#p~2q%d3pX&TS&d!bOr2qrs4]sw2qwx5Px#O2q#O#P:R#P#o2q#o#p:X#p~2q%d4dX&TS&d!bOr2qrs.qsw2qwx5Px#O2q#O#P:R#P#o2q#o#p:X#p~2q%d5WX&WW&f#tOr2qrs3isw2qwx5sx#O2q#O#P:R#P#o2q#o#p:X#p~2q%d5zX&WW&f#tOr2qrs3isw2qwx6gx#O2q#O#P:R#P#o2q#o#p:X#p~2q#|6nV&WW&f#tOr6grs7Ts#O6g#O#P8S#P#o6g#o#p8Y#p~6g#|7WVOr6grs7ms#O6g#O#P8S#P#o6g#o#p8Y#p~6g#|7pUOr6gs#O6g#O#P8S#P#o6g#o#p8Y#p~6g#|8VPO~6g#|8_V&WWOr8trs9Ys#O8t#O#P9{#P#o8t#o#p6g#p~8tW8yT&WWOr8trs9Ys#O8t#O#P9{#P~8tW9]TOr8trs9ls#O8t#O#P9{#P~8tW9oSOr8ts#O8t#O#P9{#P~8tW:OPO~8t%d:UPO~2q%d:`X&TS&WWOr:{rs;isw:{wx<ox#O:{#O#P=u#P#o:{#o#p2q#p~:{[;SV&TS&WWOr:{rs;isw:{wx<ox#O:{#O#P=u#P~:{[;nV&TSOr:{rs<Tsw:{wx<ox#O:{#O#P=u#P~:{[<YV&TSOr:{rs1Osw:{wx<ox#O:{#O#P=u#P~:{[<tV&WWOr:{rs;isw:{wx=Zx#O:{#O#P=u#P~:{[=`V&WWOr:{rs;isw:{wx8tx#O:{#O#P=u#P~:{[=xPO~:{;p>UZ&^7[&WW&f#tOr(}rs)}sw(}wx>wx#O(}#O#P2]#P#o(}#o#p:X#p#q(}#q#r2q#r~(}:Y?QX&^7[&WW&f#tOr>wrs?ms#O>w#O#PAP#P#o>w#o#p8Y#p#q>w#q#r6g#r~>w:Y?rX&^7[Or>wrs@_s#O>w#O#PAP#P#o>w#o#p8Y#p#q>w#q#r6g#r~>w:Y@dX&^7[Or>wrs-}s#O>w#O#PAP#P#o>w#o#p8Y#p#q>w#q#r6g#r~>w:YAUT&^7[O#o>w#o#p6g#p#q>w#q#r6g#r~>w<QAjT&^7[O#o'P#o#pAy#p#q'P#q#rAy#r~'P%tBWX&TS&WW&Z`&d!b&f#tOrAyrsBsswAywx5Px#OAy#O#PEo#P#oAy#o#pEu#p~Ay%tB|X&TS&Z`&d!bOrAyrsCiswAywx5Px#OAy#O#PEo#P#oAy#o#pEu#p~Ay%tCrX&TS&Z`&d!bOrAyrsD_swAywx5Px#OAy#O#PEo#P#oAy#o#pEu#p~Ay!vDhV&TS&Z`&d!bOwD_wx/_x#OD_#O#PD}#P#oD_#o#pET#p~D_!vEQPO~D_!vEYV&TSOw1Owx1dx#O1O#O#P2V#P#o1O#o#pD_#p~1O%tErPO~Ay%tE|X&TS&WWOr:{rs;isw:{wx<ox#O:{#O#P=u#P#o:{#o#pAy#p~:{<QFtZ&^7[&TS&Z`&d!bOr'PrsGgsw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'P9SGrX&^7[&TS&Z`&d!bOwGgwx,kx#OGg#O#PH_#P#oGg#o#pET#p#qGg#q#rD_#r~Gg9SHdT&^7[O#oGg#o#pD_#p#qGg#q#rD_#r~Gg<bIOZ&^7[&WW&ap&f#tOrIqrs)}swIqwx! wx#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~Iq<bJQZ&^7[&TS&WW&ap&d!b&f#tOrIqrs)}swIqwxHsx#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~Iq<bJxT&^7[O#oIq#o#pKX#p#qIq#q#rKX#r~Iq&UKfX&TS&WW&ap&d!b&f#tOrKXrs3iswKXwxLRx#OKX#O#PN}#P#oKX#o#p! T#p~KX&UL[X&WW&ap&f#tOrKXrs3iswKXwxLwx#OKX#O#PN}#P#oKX#o#p! T#p~KX&UMQX&WW&ap&f#tOrKXrs3iswKXwxMmx#OKX#O#PN}#P#oKX#o#p! T#p~KX$nMvV&WW&ap&f#tOrMmrs7Ts#OMm#O#PN]#P#oMm#o#pNc#p~Mm$nN`PO~Mm$nNhV&WWOr8trs9Ys#O8t#O#P9{#P#o8t#o#pMm#p~8t&U! QPO~KX&U! [X&TS&WWOr:{rs;isw:{wx<ox#O:{#O#P=u#P#o:{#o#pKX#p~:{<b!!SZ&^7[&WW&ap&f#tOrIqrs)}swIqwx!!ux#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~Iq:z!#QX&^7[&WW&ap&f#tOr!!urs?ms#O!!u#O#P!#m#P#o!!u#o#pNc#p#q!!u#q#rMm#r~!!u:z!#rT&^7[O#o!!u#o#pMm#p#q!!u#q#rMm#r~!!u<r!$WT&^7[O#o$}#o#p!$g#p#q$}#q#r!$g#r~$}&f!$vX&TS&WW&Z`&ap&d!b&f#tOr!$grsBssw!$gwxLRx#O!$g#O#P!%c#P#o!$g#o#p!%i#p~!$g&f!%fPO~!$g&f!%pX&TS&WWOr:{rs;isw:{wx<ox#O:{#O#P=u#P#o:{#o#p!$g#p~:{Mg!&pa&^7[&TS&WW%[1s&Z`&ap&d!b&f#tOX$}XY!&]Y[$}[]!&]]p$}pq!&]qr$}rs&Rsw$}wxHsx#O$}#O#P!'u#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Mg!'zX&^7[OY$}YZ!&]Z]$}]^!&]^#o$}#o#p!$g#p#q$}#q#r!$g#r~$}<u!(xb&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`!*Q!`#O$}#O#P!$R#P#T$}#T#U!+W#U#f$}#f#g!+W#g#h!+W#h#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<u!*eZkR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<u!+kZ!jR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{!,m_&bp&^7[&TS&R,X&Z`&d!bOY!-lYZ'PZ]!-l]^'P^r!-lrs!G^sw!-lwx!/|x#O!-l#O#P!Cp#P#o!-l#o#p!F[#p#q!-l#q#r!DU#r~!-lGZ!-}_&^7[&TS&WW&R,X&Z`&d!b&f#tOY!-lYZ'PZ]!-l]^'P^r!-lrs!.|sw!-lwx!/|x#O!-l#O#P!Cp#P#o!-l#o#p!F[#p#q!-l#q#r!DU#r~!-lGZ!/ZZ&^7[&TS&R,X&Z`&d!bOr'PrsFisw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'PFy!0X_&^7[&WW&R,X&f#tOY!1WYZ(}Z]!1W]^(}^r!1Wrs!2fsw!1Wwx!@Yx#O!1W#O#P!3d#P#o!1W#o#p!;t#p#q!1W#q#r!3x#r~!1WFy!1g_&^7[&TS&WW&R,X&d!b&f#tOY!1WYZ(}Z]!1W]^(}^r!1Wrs!2fsw!1Wwx!/|x#O!1W#O#P!3d#P#o!1W#o#p!;t#p#q!1W#q#r!3x#r~!1WFy!2qZ&^7[&TS&R,X&d!bOr(}rs*ysw(}wx(Rx#O(}#O#P2]#P#o(}#o#p:X#p#q(}#q#r2q#r~(}Fy!3iT&^7[O#o!1W#o#p!3x#p#q!1W#q#r!3x#r~!1W0m!4V]&TS&WW&R,X&d!b&f#tOY!3xYZ2qZ]!3x]^2q^r!3xrs!5Osw!3xwx!5tx#O!3x#O#P!;n#P#o!3x#o#p!;t#p~!3x0m!5XX&TS&R,X&d!bOr2qrs4]sw2qwx5Px#O2q#O#P:R#P#o2q#o#p:X#p~2q0m!5}]&WW&R,X&f#tOY!3xYZ2qZ]!3x]^2q^r!3xrs!5Osw!3xwx!6vx#O!3x#O#P!;n#P#o!3x#o#p!;t#p~!3x0m!7P]&WW&R,X&f#tOY!3xYZ2qZ]!3x]^2q^r!3xrs!5Osw!3xwx!7xx#O!3x#O#P!;n#P#o!3x#o#p!;t#p~!3x/V!8RZ&WW&R,X&f#tOY!7xYZ6gZ]!7x]^6g^r!7xrs!8ts#O!7x#O#P!9`#P#o!7x#o#p!9f#p~!7x/V!8yV&R,XOr6grs7ms#O6g#O#P8S#P#o6g#o#p8Y#p~6g/V!9cPO~!7x/V!9mZ&WW&R,XOY!:`YZ8tZ]!:`]^8t^r!:`rs!;Ss#O!:`#O#P!;h#P#o!:`#o#p!7x#p~!:`,a!:gX&WW&R,XOY!:`YZ8tZ]!:`]^8t^r!:`rs!;Ss#O!:`#O#P!;h#P~!:`,a!;XT&R,XOr8trs9ls#O8t#O#P9{#P~8t,a!;kPO~!:`0m!;qPO~!3x0m!;}]&TS&WW&R,XOY!<vYZ:{Z]!<v]^:{^r!<vrs!=rsw!<vwx!>`x#O!<v#O#P!@S#P#o!<v#o#p!3x#p~!<v,e!=PZ&TS&WW&R,XOY!<vYZ:{Z]!<v]^:{^r!<vrs!=rsw!<vwx!>`x#O!<v#O#P!@S#P~!<v,e!=yV&TS&R,XOr:{rs<Tsw:{wx<ox#O:{#O#P=u#P~:{,e!>gZ&WW&R,XOY!<vYZ:{Z]!<v]^:{^r!<vrs!=rsw!<vwx!?Yx#O!<v#O#P!@S#P~!<v,e!?aZ&WW&R,XOY!<vYZ:{Z]!<v]^:{^r!<vrs!=rsw!<vwx!:`x#O!<v#O#P!@S#P~!<v,e!@VPO~!<vFy!@e_&^7[&WW&R,X&f#tOY!1WYZ(}Z]!1W]^(}^r!1Wrs!2fsw!1Wwx!Adx#O!1W#O#P!3d#P#o!1W#o#p!;t#p#q!1W#q#r!3x#r~!1WEc!Ao]&^7[&WW&R,X&f#tOY!AdYZ>wZ]!Ad]^>w^r!Adrs!Bhs#O!Ad#O#P!C[#P#o!Ad#o#p!9f#p#q!Ad#q#r!7x#r~!AdEc!BoX&^7[&R,XOr>wrs@_s#O>w#O#PAP#P#o>w#o#p8Y#p#q>w#q#r6g#r~>wEc!CaT&^7[O#o!Ad#o#p!7x#p#q!Ad#q#r!7x#r~!AdGZ!CuT&^7[O#o!-l#o#p!DU#p#q!-l#q#r!DU#r~!-l0}!De]&TS&WW&R,X&Z`&d!b&f#tOY!DUYZAyZ]!DU]^Ay^r!DUrs!E^sw!DUwx!5tx#O!DU#O#P!FU#P#o!DU#o#p!F[#p~!DU0}!EiX&TS&R,X&Z`&d!bOrAyrsCiswAywx5Px#OAy#O#PEo#P#oAy#o#pEu#p~Ay0}!FXPO~!DU0}!Fe]&TS&WW&R,XOY!<vYZ:{Z]!<v]^:{^r!<vrs!=rsw!<vwx!>`x#O!<v#O#P!@S#P#o!<v#o#p!DU#p~!<vGZ!GkZ&^7[&TS&R,X&Z`&d!bOr'Prs!H^sw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'PGZ!HmX&X#|&^7[&TS&V,X&Z`&d!bOwGgwx,kx#OGg#O#PH_#P#oGg#o#pET#p#qGg#q#rD_#r~GgMg!Im_Q1s&^7[&TS&WW&Z`&ap&d!b&f#tOY!IYYZ$}Z]!IY]^$}^r!IYrs!Jlsw!IYwx$$[x#O!IY#O#P$1v#P#o!IY#o#p$4Y#p#q!IY#q#r$2j#r~!IYLu!Jy_Q1s&^7[&TS&Z`&d!bOY!KxYZ'PZ]!Kx]^'P^r!Kxrs$ Usw!Kxwx!MYx#O!Kx#O#P#G^#P#o!Kx#o#p#NS#p#q!Kx#q#r#HQ#r~!KxLu!LZ_Q1s&^7[&TS&WW&Z`&d!b&f#tOY!KxYZ'PZ]!Kx]^'P^r!Kxrs!Jlsw!Kxwx!MYx#O!Kx#O#P#G^#P#o!Kx#o#p#NS#p#q!Kx#q#r#HQ#r~!KxLe!Me_Q1s&^7[&WW&f#tOY!NdYZ(}Z]!Nd]^(}^r!Ndrs# rsw!Ndwx#B[x#O!Nd#O#P#/f#P#o!Nd#o#p#<b#p#q!Nd#q#r#0Y#r~!NdLe!Ns_Q1s&^7[&TS&WW&d!b&f#tOY!NdYZ(}Z]!Nd]^(}^r!Ndrs# rsw!Ndwx!MYx#O!Nd#O#P#/f#P#o!Nd#o#p#<b#p#q!Nd#q#r#0Y#r~!NdLe# }_Q1s&^7[&TS&d!bOY!NdYZ(}Z]!Nd]^(}^r!Ndrs#!|sw!Ndwx!MYx#O!Nd#O#P#/f#P#o!Nd#o#p#<b#p#q!Nd#q#r#0Y#r~!NdLe##X_Q1s&^7[&TS&d!bOY!NdYZ(}Z]!Nd]^(}^r!Ndrs#$Wsw!Ndwx!MYx#O!Nd#O#P#/f#P#o!Nd#o#p#<b#p#q!Nd#q#r#0Y#r~!NdIg#$c]Q1s&^7[&TS&d!bOY#$WYZ+uZ]#$W]^+u^w#$Wwx#%[x#O#$W#O#P#(^#P#o#$W#o#p#,Q#p#q#$W#q#r#)Q#r~#$WIg#%c]Q1s&^7[OY#$WYZ+uZ]#$W]^+u^w#$Wwx#&[x#O#$W#O#P#(^#P#o#$W#o#p#,Q#p#q#$W#q#r#)Q#r~#$WIg#&c]Q1s&^7[OY#$WYZ+uZ]#$W]^+u^w#$Wwx#'[x#O#$W#O#P#(^#P#o#$W#o#p#,Q#p#q#$W#q#r#)Q#r~#$WHP#'cXQ1s&^7[OY#'[YZ-}Z]#'[]^-}^#o#'[#o#p#(O#p#q#'[#q#r#(O#r~#'[1s#(TRQ1sOY#(OZ]#(O^~#(OIg#(eXQ1s&^7[OY#$WYZ+uZ]#$W]^+u^#o#$W#o#p#)Q#p#q#$W#q#r#)Q#r~#$W3Z#)ZZQ1s&TS&d!bOY#)QYZ.qZ]#)Q]^.q^w#)Qwx#)|x#O#)Q#O#P#+l#P#o#)Q#o#p#,Q#p~#)Q3Z#*RZQ1sOY#)QYZ.qZ]#)Q]^.q^w#)Qwx#*tx#O#)Q#O#P#+l#P#o#)Q#o#p#,Q#p~#)Q3Z#*yZQ1sOY#)QYZ.qZ]#)Q]^.q^w#)Qwx#(Ox#O#)Q#O#P#+l#P#o#)Q#o#p#,Q#p~#)Q3Z#+qTQ1sOY#)QYZ.qZ]#)Q]^.q^~#)Q3Z#,XZQ1s&TSOY#,zYZ1OZ]#,z]^1O^w#,zwx#-nx#O#,z#O#P#/Q#P#o#,z#o#p#)Q#p~#,z1w#-RXQ1s&TSOY#,zYZ1OZ]#,z]^1O^w#,zwx#-nx#O#,z#O#P#/Q#P~#,z1w#-sXQ1sOY#,zYZ1OZ]#,z]^1O^w#,zwx#.`x#O#,z#O#P#/Q#P~#,z1w#.eXQ1sOY#,zYZ1OZ]#,z]^1O^w#,zwx#(Ox#O#,z#O#P#/Q#P~#,z1w#/VTQ1sOY#,zYZ1OZ]#,z]^1O^~#,zLe#/mXQ1s&^7[OY!NdYZ(}Z]!Nd]^(}^#o!Nd#o#p#0Y#p#q!Nd#q#r#0Y#r~!Nd6X#0g]Q1s&TS&WW&d!b&f#tOY#0YYZ2qZ]#0Y]^2q^r#0Yrs#1`sw#0Ywx#3dx#O#0Y#O#P#;|#P#o#0Y#o#p#<b#p~#0Y6X#1i]Q1s&TS&d!bOY#0YYZ2qZ]#0Y]^2q^r#0Yrs#2bsw#0Ywx#3dx#O#0Y#O#P#;|#P#o#0Y#o#p#<b#p~#0Y6X#2k]Q1s&TS&d!bOY#0YYZ2qZ]#0Y]^2q^r#0Yrs#)Qsw#0Ywx#3dx#O#0Y#O#P#;|#P#o#0Y#o#p#<b#p~#0Y6X#3m]Q1s&WW&f#tOY#0YYZ2qZ]#0Y]^2q^r#0Yrs#1`sw#0Ywx#4fx#O#0Y#O#P#;|#P#o#0Y#o#p#<b#p~#0Y6X#4o]Q1s&WW&f#tOY#0YYZ2qZ]#0Y]^2q^r#0Yrs#1`sw#0Ywx#5hx#O#0Y#O#P#;|#P#o#0Y#o#p#<b#p~#0Y4q#5qZQ1s&WW&f#tOY#5hYZ6gZ]#5h]^6g^r#5hrs#6ds#O#5h#O#P#8S#P#o#5h#o#p#8h#p~#5h4q#6iZQ1sOY#5hYZ6gZ]#5h]^6g^r#5hrs#7[s#O#5h#O#P#8S#P#o#5h#o#p#8h#p~#5h4q#7aZQ1sOY#5hYZ6gZ]#5h]^6g^r#5hrs#(Os#O#5h#O#P#8S#P#o#5h#o#p#8h#p~#5h4q#8XTQ1sOY#5hYZ6gZ]#5h]^6g^~#5h4q#8oZQ1s&WWOY#9bYZ8tZ]#9b]^8t^r#9brs#:Us#O#9b#O#P#;h#P#o#9b#o#p#5h#p~#9b1{#9iXQ1s&WWOY#9bYZ8tZ]#9b]^8t^r#9brs#:Us#O#9b#O#P#;h#P~#9b1{#:ZXQ1sOY#9bYZ8tZ]#9b]^8t^r#9brs#:vs#O#9b#O#P#;h#P~#9b1{#:{XQ1sOY#9bYZ8tZ]#9b]^8t^r#9brs#(Os#O#9b#O#P#;h#P~#9b1{#;mTQ1sOY#9bYZ8tZ]#9b]^8t^~#9b6X#<RTQ1sOY#0YYZ2qZ]#0Y]^2q^~#0Y6X#<k]Q1s&TS&WWOY#=dYZ:{Z]#=d]^:{^r#=drs#>`sw#=dwx#@Sx#O#=d#O#P#Av#P#o#=d#o#p#0Y#p~#=d2P#=mZQ1s&TS&WWOY#=dYZ:{Z]#=d]^:{^r#=drs#>`sw#=dwx#@Sx#O#=d#O#P#Av#P~#=d2P#>gZQ1s&TSOY#=dYZ:{Z]#=d]^:{^r#=drs#?Ysw#=dwx#@Sx#O#=d#O#P#Av#P~#=d2P#?aZQ1s&TSOY#=dYZ:{Z]#=d]^:{^r#=drs#,zsw#=dwx#@Sx#O#=d#O#P#Av#P~#=d2P#@ZZQ1s&WWOY#=dYZ:{Z]#=d]^:{^r#=drs#>`sw#=dwx#@|x#O#=d#O#P#Av#P~#=d2P#ATZQ1s&WWOY#=dYZ:{Z]#=d]^:{^r#=drs#>`sw#=dwx#9bx#O#=d#O#P#Av#P~#=d2P#A{TQ1sOY#=dYZ:{Z]#=d]^:{^~#=dLe#Bg_Q1s&^7[&WW&f#tOY!NdYZ(}Z]!Nd]^(}^r!Ndrs# rsw!Ndwx#Cfx#O!Nd#O#P#/f#P#o!Nd#o#p#<b#p#q!Nd#q#r#0Y#r~!NdJ}#Cq]Q1s&^7[&WW&f#tOY#CfYZ>wZ]#Cf]^>w^r#Cfrs#Djs#O#Cf#O#P#Fj#P#o#Cf#o#p#8h#p#q#Cf#q#r#5h#r~#CfJ}#Dq]Q1s&^7[OY#CfYZ>wZ]#Cf]^>w^r#Cfrs#Ejs#O#Cf#O#P#Fj#P#o#Cf#o#p#8h#p#q#Cf#q#r#5h#r~#CfJ}#Eq]Q1s&^7[OY#CfYZ>wZ]#Cf]^>w^r#Cfrs#'[s#O#Cf#O#P#Fj#P#o#Cf#o#p#8h#p#q#Cf#q#r#5h#r~#CfJ}#FqXQ1s&^7[OY#CfYZ>wZ]#Cf]^>w^#o#Cf#o#p#5h#p#q#Cf#q#r#5h#r~#CfLu#GeXQ1s&^7[OY!KxYZ'PZ]!Kx]^'P^#o!Kx#o#p#HQ#p#q!Kx#q#r#HQ#r~!Kx6i#Ha]Q1s&TS&WW&Z`&d!b&f#tOY#HQYZAyZ]#HQ]^Ay^r#HQrs#IYsw#HQwx#3dx#O#HQ#O#P#Mn#P#o#HQ#o#p#NS#p~#HQ6i#Ie]Q1s&TS&Z`&d!bOY#HQYZAyZ]#HQ]^Ay^r#HQrs#J^sw#HQwx#3dx#O#HQ#O#P#Mn#P#o#HQ#o#p#NS#p~#HQ6i#Ji]Q1s&TS&Z`&d!bOY#HQYZAyZ]#HQ]^Ay^r#HQrs#Kbsw#HQwx#3dx#O#HQ#O#P#Mn#P#o#HQ#o#p#NS#p~#HQ3k#KmZQ1s&TS&Z`&d!bOY#KbYZD_Z]#Kb]^D_^w#Kbwx#)|x#O#Kb#O#P#L`#P#o#Kb#o#p#Lt#p~#Kb3k#LeTQ1sOY#KbYZD_Z]#Kb]^D_^~#Kb3k#L{ZQ1s&TSOY#,zYZ1OZ]#,z]^1O^w#,zwx#-nx#O#,z#O#P#/Q#P#o#,z#o#p#Kb#p~#,z6i#MsTQ1sOY#HQYZAyZ]#HQ]^Ay^~#HQ6i#N]]Q1s&TS&WWOY#=dYZ:{Z]#=d]^:{^r#=drs#>`sw#=dwx#@Sx#O#=d#O#P#Av#P#o#=d#o#p#HQ#p~#=dLu$ c_Q1s&^7[&TS&Z`&d!bOY!KxYZ'PZ]!Kx]^'P^r!Kxrs$!bsw!Kxwx!MYx#O!Kx#O#P#G^#P#o!Kx#o#p#NS#p#q!Kx#q#r#HQ#r~!KxIw$!o]Q1s&^7[&TS&Z`&d!bOY$!bYZGgZ]$!b]^Gg^w$!bwx#%[x#O$!b#O#P$#h#P#o$!b#o#p#Lt#p#q$!b#q#r#Kb#r~$!bIw$#oXQ1s&^7[OY$!bYZGgZ]$!b]^Gg^#o$!b#o#p#Kb#p#q$!b#q#r#Kb#r~$!bMV$$i_Q1s&^7[&WW&ap&f#tOY$%hYZIqZ]$%h]^Iq^r$%hrs# rsw$%hwx$.px#O$%h#O#P$&x#P#o$%h#o#p$-n#p#q$%h#q#r$'l#r~$%hMV$%y_Q1s&^7[&TS&WW&ap&d!b&f#tOY$%hYZIqZ]$%h]^Iq^r$%hrs# rsw$%hwx$$[x#O$%h#O#P$&x#P#o$%h#o#p$-n#p#q$%h#q#r$'l#r~$%hMV$'PXQ1s&^7[OY$%hYZIqZ]$%h]^Iq^#o$%h#o#p$'l#p#q$%h#q#r$'l#r~$%h6y$'{]Q1s&TS&WW&ap&d!b&f#tOY$'lYZKXZ]$'l]^KX^r$'lrs#1`sw$'lwx$(tx#O$'l#O#P$-Y#P#o$'l#o#p$-n#p~$'l6y$)P]Q1s&WW&ap&f#tOY$'lYZKXZ]$'l]^KX^r$'lrs#1`sw$'lwx$)xx#O$'l#O#P$-Y#P#o$'l#o#p$-n#p~$'l6y$*T]Q1s&WW&ap&f#tOY$'lYZKXZ]$'l]^KX^r$'lrs#1`sw$'lwx$*|x#O$'l#O#P$-Y#P#o$'l#o#p$-n#p~$'l5c$+XZQ1s&WW&ap&f#tOY$*|YZMmZ]$*|]^Mm^r$*|rs#6ds#O$*|#O#P$+z#P#o$*|#o#p$,`#p~$*|5c$,PTQ1sOY$*|YZMmZ]$*|]^Mm^~$*|5c$,gZQ1s&WWOY#9bYZ8tZ]#9b]^8t^r#9brs#:Us#O#9b#O#P#;h#P#o#9b#o#p$*|#p~#9b6y$-_TQ1sOY$'lYZKXZ]$'l]^KX^~$'l6y$-w]Q1s&TS&WWOY#=dYZ:{Z]#=d]^:{^r#=drs#>`sw#=dwx#@Sx#O#=d#O#P#Av#P#o#=d#o#p$'l#p~#=dMV$.}_Q1s&^7[&WW&ap&f#tOY$%hYZIqZ]$%h]^Iq^r$%hrs# rsw$%hwx$/|x#O$%h#O#P$&x#P#o$%h#o#p$-n#p#q$%h#q#r$'l#r~$%hKo$0Z]Q1s&^7[&WW&ap&f#tOY$/|YZ!!uZ]$/|]^!!u^r$/|rs#Djs#O$/|#O#P$1S#P#o$/|#o#p$,`#p#q$/|#q#r$*|#r~$/|Ko$1ZXQ1s&^7[OY$/|YZ!!uZ]$/|]^!!u^#o$/|#o#p$*|#p#q$/|#q#r$*|#r~$/|Mg$1}XQ1s&^7[OY!IYYZ$}Z]!IY]^$}^#o!IY#o#p$2j#p#q!IY#q#r$2j#r~!IY7Z$2{]Q1s&TS&WW&Z`&ap&d!b&f#tOY$2jYZ!$gZ]$2j]^!$g^r$2jrs#IYsw$2jwx$(tx#O$2j#O#P$3t#P#o$2j#o#p$4Y#p~$2j7Z$3yTQ1sOY$2jYZ!$gZ]$2j]^!$g^~$2j7Z$4c]Q1s&TS&WWOY#=dYZ:{Z]#=d]^:{^r#=drs#>`sw#=dwx#@Sx#O#=d#O#P#Av#P#o#=d#o#p$2j#p~#=dGz$5o]%jQ&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gz$6{Z!s,W&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gz$8R]%dQ&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{$9Z_&_`&^7[&WW&R,X&ap&f#tOY$:YYZIqZ]$:Y]^Iq^r$:Yrs$;jsw$:Ywx%%zx#O$:Y#O#P%!^#P#o$:Y#o#p%$x#p#q$:Y#q#r%!r#r~$:YGk$:k_&^7[&TS&WW&R,X&ap&d!b&f#tOY$:YYZIqZ]$:Y]^Iq^r$:Yrs$;jsw$:Ywx% ^x#O$:Y#O#P%!^#P#o$:Y#o#p%$x#p#q$:Y#q#r%!r#r~$:YFy$;u_&^7[&TS&R,X&d!bOY$<tYZ(}Z]$<t]^(}^r$<trs$Kvsw$<twx$>Sx#O$<t#O#P$?Q#P#o$<t#o#p$Gb#p#q$<t#q#r$?f#r~$<tFy$=T_&^7[&TS&WW&R,X&d!b&f#tOY$<tYZ(}Z]$<t]^(}^r$<trs$;jsw$<twx$>Sx#O$<t#O#P$?Q#P#o$<t#o#p$Gb#p#q$<t#q#r$?f#r~$<tFy$>_Z&^7[&WW&R,X&f#tOr(}rs)}sw(}wx={x#O(}#O#P2]#P#o(}#o#p:X#p#q(}#q#r2q#r~(}Fy$?VT&^7[O#o$<t#o#p$?f#p#q$<t#q#r$?f#r~$<t0m$?s]&TS&WW&R,X&d!b&f#tOY$?fYZ2qZ]$?f]^2q^r$?frs$@lsw$?fwx$Ffx#O$?f#O#P$G[#P#o$?f#o#p$Gb#p~$?f0m$@u]&TS&R,X&d!bOY$?fYZ2qZ]$?f]^2q^r$?frs$Answ$?fwx$Ffx#O$?f#O#P$G[#P#o$?f#o#p$Gb#p~$?f0m$Aw]&TS&R,X&d!bOY$?fYZ2qZ]$?f]^2q^r$?frs$Bpsw$?fwx$Ffx#O$?f#O#P$G[#P#o$?f#o#p$Gb#p~$?f-o$ByZ&TS&R,X&d!bOY$BpYZ.qZ]$Bp]^.q^w$Bpwx$Clx#O$Bp#O#P$DW#P#o$Bp#o#p$D^#p~$Bp-o$CqV&R,XOw.qwx/wx#O.q#O#P0^#P#o.q#o#p0d#p~.q-o$DZPO~$Bp-o$DeZ&TS&R,XOY$EWYZ1OZ]$EW]^1O^w$EWwx$Ezx#O$EW#O#P$F`#P#o$EW#o#p$Bp#p~$EW,]$E_X&TS&R,XOY$EWYZ1OZ]$EW]^1O^w$EWwx$Ezx#O$EW#O#P$F`#P~$EW,]$FPT&R,XOw1Owx1vx#O1O#O#P2V#P~1O,]$FcPO~$EW0m$FoX&WW&R,X&f#tOr2qrs3isw2qwx5sx#O2q#O#P:R#P#o2q#o#p:X#p~2q0m$G_PO~$?f0m$Gk]&TS&WW&R,XOY$HdYZ:{Z]$Hd]^:{^r$Hdrs$I`sw$Hdwx$KSx#O$Hd#O#P$Kp#P#o$Hd#o#p$?f#p~$Hd,e$HmZ&TS&WW&R,XOY$HdYZ:{Z]$Hd]^:{^r$Hdrs$I`sw$Hdwx$KSx#O$Hd#O#P$Kp#P~$Hd,e$IgZ&TS&R,XOY$HdYZ:{Z]$Hd]^:{^r$Hdrs$JYsw$Hdwx$KSx#O$Hd#O#P$Kp#P~$Hd,e$JaZ&TS&R,XOY$HdYZ:{Z]$Hd]^:{^r$Hdrs$EWsw$Hdwx$KSx#O$Hd#O#P$Kp#P~$Hd,e$KZV&WW&R,XOr:{rs;isw:{wx=Zx#O:{#O#P=u#P~:{,e$KsPO~$HdFy$LR_&^7[&TS&R,X&d!bOY$<tYZ(}Z]$<t]^(}^r$<trs$MQsw$<twx$>Sx#O$<t#O#P$?Q#P#o$<t#o#p$Gb#p#q$<t#q#r$?f#r~$<tC{$M]]&^7[&TS&R,X&d!bOY$MQYZ+uZ]$MQ]^+u^w$MQwx$NUx#O$MQ#O#P$Nx#P#o$MQ#o#p$D^#p#q$MQ#q#r$Bp#r~$MQC{$N]X&^7[&R,XOw+uwx-]x#O+u#O#P.]#P#o+u#o#p0d#p#q+u#q#r.q#r~+uC{$N}T&^7[O#o$MQ#o#p$Bp#p#q$MQ#q#r$Bp#r~$MQGk% kZ&^7[&WW&R,X&ap&f#tOrIqrs)}swIqwx! wx#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~IqGk%!cT&^7[O#o$:Y#o#p%!r#p#q$:Y#q#r%!r#r~$:Y1_%#R]&TS&WW&R,X&ap&d!b&f#tOY%!rYZKXZ]%!r]^KX^r%!rrs$@lsw%!rwx%#zx#O%!r#O#P%$r#P#o%!r#o#p%$x#p~%!r1_%$VX&WW&R,X&ap&f#tOrKXrs3iswKXwxLwx#OKX#O#PN}#P#oKX#o#p! T#p~KX1_%$uPO~%!r1_%%R]&TS&WW&R,XOY$HdYZ:{Z]$Hd]^:{^r$Hdrs$I`sw$Hdwx$KSx#O$Hd#O#P$Kp#P#o$Hd#o#p%!r#p~$HdGk%&XZ&^7[&WW&R,X&ap&f#tOrIqrs)}swIqwx%&zx#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~IqGk%'ZX&U!f&^7[&WW&S,X&ap&f#tOr!!urs?ms#O!!u#O#P!#m#P#o!!u#o#pNc#p#q!!u#q#rMm#r~!!uG{%(ZZf,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<u%)aZeR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{%*g_T,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsxz$}z{%+f{!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{%+y]_R&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{%-V]%g,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<u%.cZxR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Mg%/i^%h,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`!a%0e!a#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}B^%0xZ&q&j&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{%2O_!dQ&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!O$}!O!P%2}!P!Q$}!Q![%5_![#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{%3`]&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!O$}!O!P%4X!P#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{%4lZ!m,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%5rg!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q![%5_![!g$}!g!h%7Z!h!l$}!l!m%;k!m#O$}#O#P!$R#P#R$}#R#S%5_#S#X$}#X#Y%7Z#Y#^$}#^#_%;k#_#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%7la&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx{$}{|%8q|}$}}!O%8q!O!Q$}!Q![%9{![#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%9S]&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q![%9{![#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%:`c!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q![%9{![!l$}!l!m%;k!m#O$}#O#P!$R#P#R$}#R#S%9{#S#^$}#^#_%;k#_#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%<OZ!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{%=U_%iR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!P$}!P!Q%>T!Q!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gz%>h]%kQ&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%?tu!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!O$}!O!P%BX!P!Q$}!Q![%Cc![!d$}!d!e%Ee!e!g$}!g!h%7Z!h!l$}!l!m%;k!m!q$}!q!r%H_!r!z$}!z!{%KR!{#O$}#O#P!$R#P#R$}#R#S%Cc#S#U$}#U#V%Ee#V#X$}#X#Y%7Z#Y#^$}#^#_%;k#_#c$}#c#d%H_#d#l$}#l#m%KR#m#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%Bj]&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q![%5_![#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%Cvi!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!O$}!O!P%BX!P!Q$}!Q![%Cc![!g$}!g!h%7Z!h!l$}!l!m%;k!m#O$}#O#P!$R#P#R$}#R#S%Cc#S#X$}#X#Y%7Z#Y#^$}#^#_%;k#_#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%Ev`&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q!R%Fx!R!S%Fx!S#O$}#O#P!$R#P#R$}#R#S%Fx#S#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%G]`!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q!R%Fx!R!S%Fx!S#O$}#O#P!$R#P#R$}#R#S%Fx#S#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%Hp_&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q!Y%Io!Y#O$}#O#P!$R#P#R$}#R#S%Io#S#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%JS_!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q!Y%Io!Y#O$}#O#P!$R#P#R$}#R#S%Io#S#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%Kdc&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q![%Lo![!c$}!c!i%Lo!i#O$}#O#P!$R#P#R$}#R#S%Lo#S#T$}#T#Z%Lo#Z#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy%MSc!f,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!Q$}!Q![%Lo![!c$}!c!i%Lo!i#O$}#O#P!$R#P#R$}#R#S%Lo#S#T$}#T#Z%Lo#Z#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Mg%Nr]y1s&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`& k!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<u&!OZ%sR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{&#UZ#^,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{&$[_kR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!^$}!^!_&%Z!_!`!*Q!`!a!*Q!a#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gz&%n]%eQ&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{&&z]%r,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`!*Q!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{&(W^kR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`!*Q!`!a&)S!a#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gz&)g]%fQ&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}G{&*u]]Q#tP&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Mg&,Tc&^7[&TS&WW&Q&j&Z`&ap&d!b&f#t%m,XOr$}rs&Rsw$}wxHsx!Q$}!Q![&+n![!c$}!c!}&+n!}#O$}#O#P!$R#P#R$}#R#S&+n#S#T$}#T#o&+n#o#p!%i#p#q$}#q#r!$g#r$g$}$g~&+nMg&-ug&^7[&TS&WW&Q&j&Z`&ap&d!b&f#t%m,XOr$}rs&/^sw$}wx&2dx!Q$}!Q![&+n![!c$}!c!t&+n!t!u&5j!u!}&+n!}#O$}#O#P!$R#P#R$}#R#S&+n#S#T$}#T#f&+n#f#g&5j#g#o&+n#o#p!%i#p#q$}#q#r!$g#r$g$}$g~&+nGZ&/k_&^7[&TS&R,X&Z`&d!bOY!-lYZ'PZ]!-l]^'P^r!-lrs&0jsw!-lwx!/|x#O!-l#O#P!Cp#P#o!-l#o#p!F[#p#q!-l#q#r!DU#r~!-lGZ&0wZ&^7[&TS&R,X&Z`&d!bOr'Prs&1jsw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'PD]&1wX&^7[&TS&V,X&Z`&d!bOwGgwx,kx#OGg#O#PH_#P#oGg#o#pET#p#qGg#q#rD_#r~GgGk&2q_&^7[&WW&R,X&ap&f#tOY$:YYZIqZ]$:Y]^Iq^r$:Yrs$;jsw$:Ywx&3px#O$:Y#O#P%!^#P#o$:Y#o#p%$x#p#q$:Y#q#r%!r#r~$:YGk&3}Z&^7[&WW&R,X&ap&f#tOrIqrs)}swIqwx&4px#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~IqFT&4}X&^7[&WW&S,X&ap&f#tOr!!urs?ms#O!!u#O#P!#m#P#o!!u#o#pNc#p#q!!u#q#rMm#r~!!uMg&6Pc&^7[&TS&WW&Q&j&Z`&ap&d!b&f#t%m,XOr$}rs&/^sw$}wx&2dx!Q$}!Q![&+n![!c$}!c!}&+n!}#O$}#O#P!$R#P#R$}#R#S&+n#S#T$}#T#o&+n#o#p!%i#p#q$}#q#r!$g#r$g$}$g~&+nMg&7qg&^7[&TS&WW&Q&j&Z`&ap&d!b&f#t%m,XOr$}rs&9Ysw$}wx&<Qx!Q$}!Q![&+n![!c$}!c!t&+n!t!u&>x!u!}&+n!}#O$}#O#P!$R#P#R$}#R#S&+n#S#T$}#T#f&+n#f#g&>x#g#o&+n#o#p!%i#p#q$}#q#r!$g#r$g$}$g~&+nGZ&9gZ&^7[&TS&Z`&d!b&`,XOr'Prs&:Ysw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'PGZ&:eZ&^7[&TS&Z`&d!bOr'Prs&;Wsw'Pwx(Rx#O'P#O#PAe#P#o'P#o#pEu#p#q'P#q#rAy#r~'PD]&;eX&^7[&TS&e,X&Z`&d!bOwGgwx,kx#OGg#O#PH_#P#oGg#o#pET#p#qGg#q#rD_#r~GgGk&<_Z&^7[&WW&ap&f#t&Y,XOrIqrs)}swIqwx&=Qx#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~IqGk&=]Z&^7[&WW&ap&f#tOrIqrs)}swIqwx&>Ox#OIq#O#PJs#P#oIq#o#p! T#p#qIq#q#rKX#r~IqFT&>]X&^7[&WW&c,X&ap&f#tOr!!urs?ms#O!!u#O#P!#m#P#o!!u#o#pNc#p#q!!u#q#rMm#r~!!uMg&?_c&^7[&TS&WW&Q&j&Z`&ap&d!b&f#t%m,XOr$}rs&9Ysw$}wx&<Qx!Q$}!Q![&+n![!c$}!c!}&+n!}#O$}#O#P!$R#P#R$}#R#S&+n#S#T$}#T#o&+n#o#p!%i#p#q$}#q#r!$g#r$g$}$g~&+nMg&APk&^7[&TS&WW&Q&j&Z`&ap&d!b&f#t%m,XOr$}rs&/^sw$}wx&2dx!Q$}!Q![&+n![!c$}!c!h&+n!h!i&>x!i!t&+n!t!u&5j!u!}&+n!}#O$}#O#P!$R#P#R$}#R#S&+n#S#T$}#T#U&+n#U#V&5j#V#Y&+n#Y#Z&>x#Z#o&+n#o#p!%i#p#q$}#q#r!$g#r$g$}$g~&+nG{&CXZ!V,X&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<u&D_Z!UR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gz&Ee]%cQ&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}Gy&FgX&TS&WW!ZGmOr:{rs;isw:{wx<ox#O:{#O#P=u#P#o:{#o#p!$g#p~:{G{&Gg]%bR&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx!_$}!_!`$6h!`#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}<u&HqX!Y7_&TS&WW&Z`&ap&d!b&f#tOr!$grsBssw!$gwxLRx#O!$g#O#P!%c#P#o!$g#o#p!%i#p~!$gGy&IqZ%l,V&^7[&TS&WW&Z`&ap&d!b&f#tOr$}rs&Rsw$}wxHsx#O$}#O#P!$R#P#o$}#o#p!%i#p#q$}#q#r!$g#r~$}",
  tokenizers: [legacyPrint, indentation, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, newlines],
  topRules: {"Script":[0,3]},
  specialized: [{term: 213, get: value => spec_identifier[value] || -1}],
  tokenPrec: 7282
});

function indentBody(context, node) {
    let base = context.lineIndent(node.from);
    let line = context.lineAt(context.pos, -1), to = line.from + line.text.length;
    // Don't consider blank, deindented lines at the end of the
    // block part of the block
    if (!/\S/.test(line.text) &&
        context.node.to < to + 100 &&
        !/\S/.test(context.state.sliceDoc(to, context.node.to)) &&
        context.lineIndent(context.pos, -1) <= base)
        return null;
    // A normally deindenting keyword that appears at a higher
    // indentation than the block should probably be handled by the next
    // level
    if (/^\s*(else:|elif |except |finally:)/.test(context.textAfter) && context.lineIndent(context.pos, -1) > base)
        return null;
    return base + context.unit;
}
/**
A language provider based on the [Lezer Python
parser](https://github.com/lezer-parser/python), extended with
highlighting and indentation information.
*/
const pythonLanguage = /*@__PURE__*/LRLanguage.define({
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/indentNodeProp.add({
                Body: context => { var _a; return (_a = indentBody(context, context.node)) !== null && _a !== void 0 ? _a : context.continue(); },
                IfStatement: cx => /^\s*(else:|elif )/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
                TryStatement: cx => /^\s*(except |finally:)/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
                "TupleExpression ComprehensionExpression ParamList ArgList ParenthesizedExpression": /*@__PURE__*/delimitedIndent({ closing: ")" }),
                "DictionaryExpression DictionaryComprehensionExpression SetExpression SetComprehensionExpression": /*@__PURE__*/delimitedIndent({ closing: "}" }),
                "ArrayExpression ArrayComprehensionExpression": /*@__PURE__*/delimitedIndent({ closing: "]" }),
                "String FormatString": () => null,
                Script: context => {
                    if (context.pos + /\s*/.exec(context.textAfter)[0].length >= context.node.to) {
                        let endBody = null;
                        for (let cur = context.node, to = cur.to;;) {
                            cur = cur.lastChild;
                            if (!cur || cur.to != to)
                                break;
                            if (cur.type.name == "Body")
                                endBody = cur;
                        }
                        if (endBody) {
                            let bodyIndent = indentBody(context, endBody);
                            if (bodyIndent != null)
                                return bodyIndent;
                        }
                    }
                    return context.continue();
                }
            }),
            /*@__PURE__*/foldNodeProp.add({
                "ArrayExpression DictionaryExpression SetExpression TupleExpression": foldInside,
                Body: (node, state) => ({ from: node.from + 1, to: node.to - (node.to == state.doc.length ? 0 : 1) })
            })
        ],
    }),
    languageData: {
        closeBrackets: { brackets: ["(", "[", "{", "'", '"', "'''", '"""'] },
        commentTokens: { line: "#" },
        indentOnInput: /^\s*([\}\]\)]|else:|elif |except |finally:)$/
    }
});
/**
Python language support.
*/
function python() {
    return new LanguageSupport(pythonLanguage);
}

export { python };
