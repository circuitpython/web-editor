import { Q as DefaultBufferLength, U as NodeSet, X as NodeType, Y as stringInput, Z as Tree, _ as TreeBuffer, N as NodeProp, $ as LezerLanguage, a0 as indentNodeProp, a1 as continuedIndent, a2 as foldNodeProp, a3 as foldInside, a4 as styleTags, a5 as tags, a6 as LanguageSupport } from '../common/index-3bdc3557.js';

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
    /// A the parse that this stack is part of @internal
    p, 
    /// Holds state, pos, value stack pos (15 bits array index, 15 bits
    /// buffer index) triplets for all but the top state
    /// @internal
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
        return new Stack(p, [], state, pos, pos, 0, [], 0, cx ? new StackContext(cx, cx.start) : null, null);
    }
    /// The stack's current [context](#lezer.ContextTracker) value, if
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
            // Zero-depth reductions are a special case—they add stuff to
            // the stack without popping anything off.
            if (type < parser.minRepeatTerm)
                this.storeNode(type, this.reducePos, this.reducePos, 4, true);
            this.pushState(parser.getGoto(this.state, type, true), this.reducePos);
            this.reduceContext(type);
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
        this.reduceContext(type);
    }
    // Shift a value into the buffer
    /// @internal
    storeNode(term, start, end, size = 4, isReduce = false) {
        if (term == 0 /* Err */) { // Try to omit/merge adjacent error nodes
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
        if (action & 131072 /* GotoFlag */) {
            this.pushState(action & 65535 /* ValueMask */, this.pos);
        }
        else if ((action & 262144 /* StayFlag */) == 0) { // Regular shift
            let start = this.pos, nextState = action, { parser } = this.p;
            if (nextEnd > this.pos || next <= parser.maxNode) {
                this.pos = nextEnd;
                if (!parser.stateFlag(nextState, 1 /* Skipped */))
                    this.reducePos = nextEnd;
            }
            this.pushState(nextState, start);
            if (next <= parser.maxNode)
                this.buffer.push(next, start, nextEnd, 4);
            this.shiftContext(next);
        }
        else { // Shift-and-stay, which means this is a skipped token
            if (next <= this.p.parser.maxNode)
                this.buffer.push(next, this.pos, nextEnd, 4);
            this.pos = nextEnd;
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
    // Add a prebuilt node into the buffer. This may be a reused node or
    // the result of running a nested parser.
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
        this.buffer.push(index, start, this.reducePos, -1 /* size < 0 means this is a reused value */);
        if (this.curContext)
            this.updateContext(this.curContext.tracker.reuse(this.curContext.context, value, this.p.input, this));
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
        return new Stack(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, buffer, base, this.curContext, parent);
    }
    // Try to recover from an error by 'deleting' (ignoring) one token.
    /// @internal
    recoverByDelete(next, nextEnd) {
        let isNode = next <= this.p.parser.maxNode;
        if (isNode)
            this.storeNode(next, this.pos, nextEnd);
        this.storeNode(0 /* Err */, this.pos, nextEnd, isNode ? 8 : 4);
        this.pos = this.reducePos = nextEnd;
        this.score -= 200 /* Token */;
    }
    /// Check if the given term would be able to be shifted (optionally
    /// after some reductions) on this stack. This can be useful for
    /// external tokenizers that want to make sure they only provide a
    /// given token when it applies.
    canShift(term) {
        for (let sim = new SimulatedStack(this);;) {
            let action = this.p.parser.stateSlot(sim.top, 4 /* DefaultReduce */) || this.p.parser.hasAction(sim.top, term);
            if ((action & 65536 /* ReduceFlag */) == 0)
                return true;
            if (action == 0)
                return false;
            sim.reduce(action);
        }
    }
    /// Find the start position of the rule that is currently being parsed.
    get ruleStart() {
        for (let state = this.state, base = this.stack.length;;) {
            let force = this.p.parser.stateSlot(state, 5 /* ForcedReduce */);
            if (!(force & 65536 /* ReduceFlag */))
                return 0;
            base -= 3 * (force >> 19 /* ReduceDepthShift */);
            if ((force & 65535 /* ValueMask */) < this.p.parser.minRepeatTerm)
                return this.stack[base + 1];
            state = this.stack[base];
        }
    }
    /// Find the start position of an instance of any of the given term
    /// types, or return `null` when none of them are found.
    ///
    /// **Note:** this is only reliable when there is at least some
    /// state that unambiguously matches the given rule on the stack.
    /// I.e. if you have a grammar like this, where the difference
    /// between `a` and `b` is only apparent at the third token:
    ///
    ///     a { b | c }
    ///     b { "x" "y" "x" }
    ///     c { "x" "y" "z" }
    ///
    /// Then a parse state after `"x"` will not reliably tell you that
    /// `b` is on the stack. You _can_ pass `[b, c]` to reliably check
    /// for either of those two rules (assuming that `a` isn't part of
    /// some rule that includes other things starting with `"x"`).
    ///
    /// When `before` is given, this keeps scanning up the stack until
    /// it finds a match that starts before that position.
    ///
    /// Note that you have to be careful when using this in tokenizers,
    /// since it's relatively easy to introduce data dependencies that
    /// break incremental parsing by using this method.
    startOf(types, before) {
        let state = this.state, frame = this.stack.length, { parser } = this.p;
        for (;;) {
            let force = parser.stateSlot(state, 5 /* ForcedReduce */);
            let depth = force >> 19 /* ReduceDepthShift */, term = force & 65535 /* ValueMask */;
            if (types.indexOf(term) > -1) {
                let base = frame - (3 * (force >> 19 /* ReduceDepthShift */)), pos = this.stack[base + 1];
                if (before == null || before > pos)
                    return pos;
            }
            if (frame == 0)
                return null;
            if (depth == 0) {
                frame -= 3;
                state = this.stack[frame];
            }
            else {
                frame -= 3 * (depth - 1);
                state = parser.getGoto(this.stack[frame - 3], term, true);
            }
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
            stack.storeNode(0 /* Err */, stack.pos, stack.pos, 4, true);
            stack.pushState(s, this.pos);
            stack.shiftContext(nextStates[i]);
            stack.score -= 200 /* Token */;
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
        if (!this.p.parser.validAction(this.state, reduce)) {
            this.storeNode(0 /* Err */, this.reducePos, this.reducePos, 4, true);
            this.score -= 100 /* Reduce */;
        }
        this.reduce(reduce);
        return true;
    }
    /// @internal
    forceAll() {
        while (!this.p.parser.stateFlag(this.state, 2 /* Accepting */) && this.forceReduce()) { }
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
    shiftContext(term) {
        if (this.curContext)
            this.updateContext(this.curContext.tracker.shift(this.curContext.context, term, this.p.input, this));
    }
    reduceContext(term) {
        if (this.curContext)
            this.updateContext(this.curContext.tracker.reduce(this.curContext.context, term, this.p.input, this));
    }
    /// @internal
    emitContext() {
        let cx = this.curContext;
        if (!cx.tracker.strict)
            return;
        let last = this.buffer.length - 1;
        if (last < 0 || this.buffer[last] != -2)
            this.buffer.push(cx.hash, this.reducePos, this.reducePos, -2);
    }
    updateContext(context) {
        if (context != this.curContext.context) {
            let newCx = new StackContext(this.curContext.tracker, context);
            if (newCx.hash != this.curContext.hash)
                this.emitContext();
            this.curContext = newCx;
        }
    }
}
class StackContext {
    constructor(tracker, context) {
        this.tracker = tracker;
        this.context = context;
        this.hash = tracker.hash(context);
    }
}
var Recover;
(function (Recover) {
    Recover[Recover["Token"] = 200] = "Token";
    Recover[Recover["Reduce"] = 100] = "Reduce";
    Recover[Recover["MaxNext"] = 4] = "MaxNext";
    Recover[Recover["MaxInsertStackDepth"] = 300] = "MaxInsertStackDepth";
    Recover[Recover["DampenInsertStackDepth"] = 120] = "DampenInsertStackDepth";
})(Recover || (Recover = {}));
// Used to cheaply run some reductions to scan ahead without mutating
// an entire stack
class SimulatedStack {
    constructor(stack) {
        this.stack = stack;
        this.top = stack.state;
        this.rest = stack.stack;
        this.offset = this.rest.length;
    }
    reduce(action) {
        let term = action & 65535 /* ValueMask */, depth = action >> 19 /* ReduceDepthShift */;
        if (depth == 0) {
            if (this.rest == this.stack.stack)
                this.rest = this.rest.slice();
            this.rest.push(this.top, 0, 0);
            this.offset += 3;
        }
        else {
            this.offset -= (depth - 1) * 3;
        }
        let goto = this.stack.p.parser.getGoto(this.rest[this.offset - 3], term, true);
        this.top = goto;
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
    static create(stack) {
        return new StackBufferCursor(stack, stack.bufferBase + stack.buffer.length, stack.buffer.length);
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

/// Tokenizers write the tokens they read into instances of this class.
class Token {
    constructor() {
        /// The start of the token. This is set by the parser, and should not
        /// be mutated by the tokenizer.
        this.start = -1;
        /// This starts at -1, and should be updated to a term id when a
        /// matching token is found.
        this.value = -1;
        /// When setting `.value`, you should also set `.end` to the end
        /// position of the token. (You'll usually want to use the `accept`
        /// method.)
        this.end = -1;
    }
    /// Accept a token, setting `value` and `end` to the given values.
    accept(value, end) {
        this.value = value;
        this.end = end;
    }
}
/// @internal
class TokenGroup {
    constructor(data, id) {
        this.data = data;
        this.id = id;
    }
    token(input, token, stack) { readToken(this.data, input, token, stack, this.id); }
}
TokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
/// Exports that are used for `@external tokens` in the grammar should
/// export an instance of this class.
class ExternalTokenizer {
    /// Create a tokenizer. The first argument is the function that,
    /// given an input stream and a token object,
    /// [fills](#lezer.Token.accept) the token object if it recognizes a
    /// token. `token.start` should be used as the start position to
    /// scan from.
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
// and updating `token` when it matches a token.
function readToken(data, input, token, stack, group) {
    let state = 0, groupMask = 1 << group, dialect = stack.p.parser.dialect;
    scan: for (let pos = token.start;;) {
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
                    (token.value == -1 || token.value == term || stack.p.parser.overrides(term, token.value))) {
                    token.accept(term, pos);
                    break;
                }
            }
        let next = input.get(pos++);
        // Do a binary search on the state's edges
        for (let low = 0, high = data[state + 2]; low < high;) {
            let mid = (low + high) >> 1;
            let index = accEnd + mid + (mid << 1);
            let from = data[index], to = data[index + 1];
            if (next < from)
                high = mid;
            else if (next >= to)
                low = mid + 1;
            else {
                state = data[index + 2];
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

// FIXME find some way to reduce recovery work done when the input
// doesn't match the grammar at all.
// Environment variable used to control console output
const verbose = typeof process != "undefined" && /\bparse\b/.test(process.env.LOG);
let stackIDs = null;
function cutAt(tree, pos, side) {
    let cursor = tree.cursor(pos);
    for (;;) {
        if (!(side < 0 ? cursor.childBefore(pos) : cursor.childAfter(pos)))
            for (;;) {
                if ((side < 0 ? cursor.to < pos : cursor.from > pos) && !cursor.type.isError)
                    return side < 0 ? Math.max(0, Math.min(cursor.to - 1, pos - 5)) : Math.min(tree.length, Math.max(cursor.from + 1, pos + 5));
                if (side < 0 ? cursor.prevSibling() : cursor.nextSibling())
                    break;
                if (!cursor.parent())
                    return side < 0 ? 0 : tree.length;
            }
    }
}
class FragmentCursor {
    constructor(fragments) {
        this.fragments = fragments;
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
            else if (start == pos && start + next.length <= this.safeTo) {
                return start == pos && start >= this.safeFrom ? next : null;
            }
            if (next instanceof TreeBuffer) {
                this.index[last]++;
                this.nextStart = start + next.length;
            }
            else {
                this.index[last]++;
                if (start + next.length >= pos) { // Enter this node
                    this.trees.push(next);
                    this.start.push(start);
                    this.index.push(0);
                }
            }
        }
    }
}
class CachedToken extends Token {
    constructor() {
        super(...arguments);
        this.extended = -1;
        this.mask = 0;
        this.context = 0;
    }
    clear(start) {
        this.start = start;
        this.value = this.extended = -1;
    }
}
const dummyToken = new Token;
class TokenCache {
    constructor(parser) {
        this.tokens = [];
        this.mainToken = dummyToken;
        this.actions = [];
        this.tokens = parser.tokenizers.map(_ => new CachedToken);
    }
    getActions(stack, input) {
        let actionIndex = 0;
        let main = null;
        let { parser } = stack.p, { tokenizers } = parser;
        let mask = parser.stateSlot(stack.state, 3 /* TokenizerMask */);
        let context = stack.curContext ? stack.curContext.hash : 0;
        for (let i = 0; i < tokenizers.length; i++) {
            if (((1 << i) & mask) == 0)
                continue;
            let tokenizer = tokenizers[i], token = this.tokens[i];
            if (main && !tokenizer.fallback)
                continue;
            if (tokenizer.contextual || token.start != stack.pos || token.mask != mask || token.context != context) {
                this.updateCachedToken(token, tokenizer, stack, input);
                token.mask = mask;
                token.context = context;
            }
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
        if (!main) {
            main = dummyToken;
            main.start = stack.pos;
            if (stack.pos == input.length)
                main.accept(stack.p.parser.eofTerm, stack.pos);
            else
                main.accept(0 /* Err */, stack.pos + 1);
        }
        this.mainToken = main;
        return this.actions;
    }
    updateCachedToken(token, tokenizer, stack, input) {
        token.clear(stack.pos);
        tokenizer.token(input, token, stack);
        if (token.value > -1) {
            let { parser } = stack.p;
            for (let i = 0; i < parser.specialized.length; i++)
                if (parser.specialized[i] == token.value) {
                    let result = parser.specializers[i](input.read(token.start, token.end), stack);
                    if (result >= 0 && stack.p.parser.dialect.allows(result >> 1)) {
                        if ((result & 1) == 0 /* Specialize */)
                            token.value = result >> 1;
                        else
                            token.extended = result >> 1;
                        break;
                    }
                }
        }
        else if (stack.pos == input.length) {
            token.accept(stack.p.parser.eofTerm, stack.pos);
        }
        else {
            token.accept(0 /* Err */, stack.pos + 1);
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
                            index = this.putAction(pair(data, i + 1), token, end, index);
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
    Rec[Rec["MinBufferLengthPrune"] = 200] = "MinBufferLengthPrune";
    Rec[Rec["ForceReduceLimit"] = 10] = "ForceReduceLimit";
})(Rec || (Rec = {}));
/// A parse context can be used for step-by-step parsing. After
/// creating it, you repeatedly call `.advance()` until it returns a
/// tree to indicate it has reached the end of the parse.
class Parse {
    constructor(parser, input, startPos, context) {
        this.parser = parser;
        this.input = input;
        this.startPos = startPos;
        this.context = context;
        // The position to which the parse has advanced.
        this.pos = 0;
        this.recovering = 0;
        this.nextStackID = 0x2654;
        this.nested = null;
        this.nestEnd = 0;
        this.nestWrap = null;
        this.reused = [];
        this.tokens = new TokenCache(parser);
        this.topTerm = parser.top[1];
        this.stacks = [Stack.start(this, parser.top[0], this.startPos)];
        let fragments = context === null || context === void 0 ? void 0 : context.fragments;
        this.fragments = fragments && fragments.length ? new FragmentCursor(fragments) : null;
    }
    // Move the parser forward. This will process all parse stacks at
    // `this.pos` and try to advance them to a further position. If no
    // stack for such a position is found, it'll start error-recovery.
    //
    // When the parse is finished, this will return a syntax tree. When
    // not, it returns `null`.
    advance() {
        if (this.nested) {
            let result = this.nested.advance();
            this.pos = this.nested.pos;
            if (result) {
                this.finishNested(this.stacks[0], result);
                this.nested = null;
            }
            return null;
        }
        let stacks = this.stacks, pos = this.pos;
        // This will hold stacks beyond `pos`.
        let newStacks = this.stacks = [];
        let stopped, stoppedTokens;
        let maybeNest;
        // Keep advancing any stacks at `pos` until they either move
        // forward or can't be advanced. Gather stacks that can't be
        // advanced further in `stopped`.
        for (let i = 0; i < stacks.length; i++) {
            let stack = stacks[i], nest;
            for (;;) {
                if (stack.pos > pos) {
                    newStacks.push(stack);
                }
                else if (nest = this.checkNest(stack)) {
                    if (!maybeNest || maybeNest.stack.score < stack.score)
                        maybeNest = nest;
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
                    let tok = this.tokens.mainToken;
                    stoppedTokens.push(tok.value, tok.end);
                }
                break;
            }
        }
        if (maybeNest) {
            this.startNested(maybeNest);
            return null;
        }
        if (!newStacks.length) {
            let finished = stopped && findFinished(stopped);
            if (finished)
                return this.stackToTree(finished);
            if (this.parser.strict) {
                if (verbose && stopped)
                    console.log("Stuck with token " + this.parser.getName(this.tokens.mainToken.value));
                throw new SyntaxError("No parse at " + pos);
            }
            if (!this.recovering)
                this.recovering = 5 /* Distance */;
        }
        if (this.recovering && stopped) {
            let finished = this.runRecovery(stopped, stoppedTokens, newStacks);
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
                        stack.buffer.length > 200 /* MinBufferLengthPrune */ && other.buffer.length > 200 /* MinBufferLengthPrune */) {
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
        this.pos = newStacks[0].pos;
        for (let i = 1; i < newStacks.length; i++)
            if (newStacks[i].pos < this.pos)
                this.pos = newStacks[i].pos;
        return null;
    }
    // Returns an updated version of the given stack, or null if the
    // stack can't advance normally. When `split` and `stacks` are
    // given, stacks split off by ambiguous operations will be pushed to
    // `split`, or added to `stacks` if they move `pos` forward.
    advanceStack(stack, stacks, split) {
        let start = stack.pos, { input, parser } = this;
        let base = verbose ? this.stackID(stack) + " -> " : "";
        if (this.fragments) {
            let strictCx = stack.curContext && stack.curContext.tracker.strict, cxHash = strictCx ? stack.curContext.hash : 0;
            for (let cached = this.fragments.nodeAt(start); cached;) {
                let match = this.parser.nodeSet.types[cached.type.id] == cached.type ? parser.getGoto(stack.state, cached.type.id) : -1;
                if (match > -1 && cached.length && (!strictCx || (cached.contextHash || 0) == cxHash)) {
                    stack.useNode(cached, match);
                    if (verbose)
                        console.log(base + this.stackID(stack) + ` (via reuse of ${parser.getName(cached.type.id)})`);
                    return true;
                }
                if (!(cached instanceof Tree) || cached.children.length == 0 || cached.positions[0] > 0)
                    break;
                let inner = cached.children[0];
                if (inner instanceof Tree)
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
        let actions = this.tokens.getActions(stack, input);
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
            let nest = this.checkNest(stack);
            if (nest)
                return nest;
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
        let maybeNest;
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
                if (done) {
                    if (done !== true)
                        maybeNest = done;
                    continue;
                }
            }
            let force = stack.split(), forceBase = base;
            for (let j = 0; force.forceReduce() && j < 10 /* ForceReduceLimit */; j++) {
                if (verbose)
                    console.log(forceBase + this.stackID(force) + " (via force-reduce)");
                let done = this.advanceFully(force, newStacks);
                if (done) {
                    if (done !== true)
                        maybeNest = done;
                    break;
                }
                if (verbose)
                    forceBase = this.stackID(force) + " -> ";
            }
            for (let insert of stack.recoverByInsert(token)) {
                if (verbose)
                    console.log(base + this.stackID(insert) + " (via recover-insert)");
                this.advanceFully(insert, newStacks);
            }
            if (this.input.length > stack.pos) {
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
        if (finished)
            return finished;
        if (maybeNest)
            for (let s of this.stacks)
                if (s.score > maybeNest.stack.score) {
                    maybeNest = undefined;
                    break;
                }
        if (maybeNest)
            this.startNested(maybeNest);
        return null;
    }
    forceFinish() {
        let stack = this.stacks[0].split();
        if (this.nested)
            this.finishNested(stack, this.nested.forceFinish());
        return this.stackToTree(stack.forceAll());
    }
    // Convert the stack's buffer to a syntax tree.
    stackToTree(stack, pos = stack.pos) {
        if (this.parser.context)
            stack.emitContext();
        return Tree.build({ buffer: StackBufferCursor.create(stack),
            nodeSet: this.parser.nodeSet,
            topID: this.topTerm,
            maxBufferLength: this.parser.bufferLength,
            reused: this.reused,
            start: this.startPos,
            length: pos - this.startPos,
            minRepeatType: this.parser.minRepeatTerm });
    }
    checkNest(stack) {
        let info = this.parser.findNested(stack.state);
        if (!info)
            return null;
        let spec = info.value;
        if (typeof spec == "function")
            spec = spec(this.input, stack);
        return spec ? { stack, info, spec } : null;
    }
    startNested(nest) {
        let { stack, info, spec } = nest;
        this.stacks = [stack];
        this.nestEnd = this.scanForNestEnd(stack, info.end, spec.filterEnd);
        this.nestWrap = typeof spec.wrapType == "number" ? this.parser.nodeSet.types[spec.wrapType] : spec.wrapType || null;
        if (spec.startParse) {
            this.nested = spec.startParse(this.input.clip(this.nestEnd), stack.pos, this.context);
        }
        else {
            this.finishNested(stack);
        }
    }
    scanForNestEnd(stack, endToken, filter) {
        for (let pos = stack.pos; pos < this.input.length; pos++) {
            dummyToken.start = pos;
            dummyToken.value = -1;
            endToken.token(this.input, dummyToken, stack);
            if (dummyToken.value > -1 && (!filter || filter(this.input.read(pos, dummyToken.end))))
                return pos;
        }
        return this.input.length;
    }
    finishNested(stack, tree) {
        if (this.nestWrap)
            tree = new Tree(this.nestWrap, tree ? [tree] : [], tree ? [0] : [], this.nestEnd - stack.pos);
        else if (!tree)
            tree = new Tree(NodeType.none, [], [], this.nestEnd - stack.pos);
        let info = this.parser.findNested(stack.state);
        stack.useNode(tree, this.parser.getGoto(stack.state, info.placeholder, true));
        if (verbose)
            console.log(this.stackID(stack) + ` (via unnest)`);
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
class ContextTracker {
    /// The export used in a `@context` declaration should be of this
    /// type.
    constructor(spec) {
        this.start = spec.start;
        this.shift = spec.shift || id;
        this.reduce = spec.reduce || id;
        this.reuse = spec.reuse || id;
        this.hash = spec.hash;
        this.strict = spec.strict !== false;
    }
}
/// A parser holds the parse tables for a given grammar, as generated
/// by `lezer-generator`.
class Parser {
    /// @internal
    constructor(spec) {
        /// @internal
        this.bufferLength = DefaultBufferLength;
        /// @internal
        this.strict = false;
        this.cachedDialect = null;
        if (spec.version != 13 /* Version */)
            throw new RangeError(`Parser version (${spec.version}) doesn't match runtime version (${13 /* Version */})`);
        let tokenArray = decodeArray(spec.tokenData);
        let nodeNames = spec.nodeNames.split(" ");
        this.minRepeatTerm = nodeNames.length;
        this.context = spec.context;
        for (let i = 0; i < spec.repeatNodeCount; i++)
            nodeNames.push("");
        let nodeProps = [];
        for (let i = 0; i < nodeNames.length; i++)
            nodeProps.push([]);
        function setProp(nodeID, prop, value) {
            nodeProps[nodeID].push([prop, prop.deserialize(String(value))]);
        }
        if (spec.nodeProps)
            for (let propSpec of spec.nodeProps) {
                let prop = propSpec[0];
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
        this.specialized = new Uint16Array(spec.specialized ? spec.specialized.length : 0);
        this.specializers = [];
        if (spec.specialized)
            for (let i = 0; i < spec.specialized.length; i++) {
                this.specialized[i] = spec.specialized[i].term;
                this.specializers[i] = spec.specialized[i].get;
            }
        this.states = decodeArray(spec.states, Uint32Array);
        this.data = decodeArray(spec.stateData);
        this.goto = decodeArray(spec.goto);
        let topTerms = Object.keys(spec.topRules).map(r => spec.topRules[r][1]);
        this.nodeSet = new NodeSet(nodeNames.map((name, i) => NodeType.define({
            name: i >= this.minRepeatTerm ? undefined : name,
            id: i,
            props: nodeProps[i],
            top: topTerms.indexOf(i) > -1,
            error: i == 0,
            skipped: spec.skippedNodes && spec.skippedNodes.indexOf(i) > -1
        })));
        this.maxTerm = spec.maxTerm;
        this.tokenizers = spec.tokenizers.map(value => typeof value == "number" ? new TokenGroup(tokenArray, value) : value);
        this.topRules = spec.topRules;
        this.nested = (spec.nested || []).map(([name, value, endToken, placeholder]) => {
            return { name, value, end: new TokenGroup(decodeArray(endToken), 0), placeholder };
        });
        this.dialects = spec.dialects || {};
        this.dynamicPrecedences = spec.dynamicPrecedences || null;
        this.tokenPrecTable = spec.tokenPrec;
        this.termNames = spec.termNames || null;
        this.maxNode = this.nodeSet.types.length - 1;
        this.dialect = this.parseDialect();
        this.top = this.topRules[Object.keys(this.topRules)[0]];
    }
    /// Parse a given string or stream.
    parse(input, startPos = 0, context = {}) {
        if (typeof input == "string")
            input = stringInput(input);
        let cx = new Parse(this, input, startPos, context);
        for (;;) {
            let done = cx.advance();
            if (done)
                return done;
        }
    }
    /// Start an incremental parse.
    startParse(input, startPos = 0, context = {}) {
        if (typeof input == "string")
            input = stringInput(input);
        return new Parse(this, input, startPos, context);
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
    findNested(state) {
        let flags = this.stateSlot(state, 0 /* Flags */);
        return flags & 4 /* StartNest */ ? this.nested[flags >> 10 /* NestShift */] : null;
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
        let copy = Object.assign(Object.create(Parser.prototype), this);
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
        if (config.dialect)
            copy.dialect = this.parseDialect(config.dialect);
        if (config.nested)
            copy.nested = this.nested.map(obj => {
                if (!Object.prototype.hasOwnProperty.call(config.nested, obj.name))
                    return obj;
                return { name: obj.name, value: config.nested[obj.name], end: obj.end, placeholder: obj.placeholder };
            });
        if (config.strict != null)
            copy.strict = config.strict;
        if (config.bufferLength != null)
            copy.bufferLength = config.bufferLength;
        return copy;
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
    /// Tells you whether this grammar has any nested grammars.
    get hasNested() { return this.nested.length > 0; }
    /// The type of top node produced by the parser.
    get topNode() { return this.nodeSet.types[this.top[1]]; }
    /// @internal
    dynamicPrecedence(term) {
        let prec = this.dynamicPrecedences;
        return prec == null ? 0 : prec[term] || 0;
    }
    /// @internal
    parseDialect(dialect) {
        if (this.cachedDialect && this.cachedDialect.source == dialect)
            return this.cachedDialect;
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
        return this.cachedDialect = new Dialect(dialect, flags, disabled);
    }
    /// (used by the output of the parser generator) @internal
    static deserialize(spec) {
        return new Parser(spec);
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
        if (stack.pos == stack.p.input.length &&
            stack.p.parser.stateFlag(stack.state, 2 /* Accepting */) &&
            (!best || best.score < stack.score))
            best = stack;
    }
    return best;
}

// This file was generated by lezer-generator. You probably shouldn't edit it.
const printKeyword = 1,
  indent = 162,
  dedent = 163,
  newline = 164,
  newlineBracketed = 165,
  newlineEmpty = 166,
  eof = 167,
  ParenthesizedExpression = 21,
  TupleExpression = 47,
  ComprehensionExpression = 48,
  ArrayExpression = 52,
  ArrayComprehensionExpression = 55,
  DictionaryExpression = 56,
  DictionaryComprehensionExpression = 59,
  SetExpression = 60,
  SetComprehensionExpression = 61;

const newline$1 = 10, carriageReturn = 13, space = 32, tab = 9, hash = 35, parenOpen = 40, dot = 46;

const bracketed = [
  ParenthesizedExpression, TupleExpression, ComprehensionExpression, ArrayExpression, ArrayComprehensionExpression,
  DictionaryExpression, DictionaryComprehensionExpression, SetExpression, SetComprehensionExpression
];

let cachedIndent = 0, cachedInput = null, cachedPos = 0;
function getIndent(input, pos) {
  if (pos == cachedPos && input == cachedInput) return cachedIndent
  cachedInput = input; cachedPos = pos;
  return cachedIndent = getIndentInner(input, pos)
}

function getIndentInner(input, pos) {
  for (let indent = 0;; pos++) {
    let ch = input.get(pos);
    if (ch == space) indent++;
    else if (ch == tab) indent += 8 - (indent % 8);
    else if (ch == newline$1 || ch == carriageReturn || ch == hash) return -1
    else return indent
  }
}

const newlines = new ExternalTokenizer((input, token, stack) => {
  let next = input.get(token.start);
  if (next < 0) {
    token.accept(eof, token.start);
  } else if (next != newline$1 && next != carriageReturn) ; else if (stack.startOf(bracketed) != null) {
    token.accept(newlineBracketed, token.start + 1);
  } else if (getIndent(input, token.start + 1) < 0) {
    token.accept(newlineEmpty, token.start + 1);
  } else {
    token.accept(newline, token.start + 1);
  }
}, {contextual: true, fallback: true});

const indentation = new ExternalTokenizer((input, token, stack) => {
  let prev = input.get(token.start - 1), depth;
  if ((prev == newline$1 || prev == carriageReturn) &&
      (depth = getIndent(input, token.start)) >= 0 &&
      depth != stack.context.depth &&
      stack.startOf(bracketed) == null)
    token.accept(depth < stack.context.depth ? dedent : indent, token.start);
});

function IndentLevel(parent, depth) {
  this.parent = parent;
  this.depth = depth;
  this.hash = (parent ? parent.hash + parent.hash << 8 : 0) + depth + (depth << 4);
}

const topIndent = new IndentLevel(null, 0);

const trackIndent = new ContextTracker({
  start: topIndent,
  shift(context, term, input, stack) {
    return term == indent ? new IndentLevel(context, getIndent(input, stack.pos)) :
      term == dedent ? context.parent : context
  },
  hash(context) { return context.hash }
});

const legacyPrint = new ExternalTokenizer((input, token) => {
  let pos = token.start;
  for (let print = "print", i = 0; i < print.length; i++, pos++)
    if (input.get(pos) != print.charCodeAt(i)) return
  let end = pos;
  if (/\w/.test(String.fromCharCode(input.get(pos)))) return
  for (;; pos++) {
    let next = input.get(pos);
    if (next == space || next == tab) continue
    if (next != parenOpen && next != dot && next != newline$1 && next != carriageReturn && next != hash)
      token.accept(printKeyword, end);
    return
  }
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const spec_identifier = {__proto__:null,await:40, or:48, and:50, in:54, not:56, is:58, if:64, else:66, lambda:70, yield:88, from:90, async:98, for:100, None:152, True:154, False:154, del:168, pass:172, break:176, continue:180, return:184, raise:192, import:196, as:198, global:202, nonlocal:204, assert:208, elif:218, while:222, try:228, except:230, finally:232, with:236, def:240, class:250};
const parser = Parser.deserialize({
  version: 13,
  states: "!?|O`Q$IXOOO%cQ$I[O'#GaOOQ$IS'#Cm'#CmOOQ$IS'#Cn'#CnO'RQ$IWO'#ClO(tQ$I[O'#G`OOQ$IS'#Ga'#GaOOQ$IS'#DR'#DROOQ$IS'#G`'#G`O)bQ$IWO'#CqO)rQ$IWO'#DbO*SQ$IWO'#DfOOQ$IS'#Ds'#DsO*gO`O'#DsO*oOpO'#DsO*wO!bO'#DtO+SO#tO'#DtO+_O&jO'#DtO+jO,UO'#DtO-lQ$I[O'#GQOOQ$IS'#GQ'#GQO'RQ$IWO'#GPO/OQ$I[O'#GPOOQ$IS'#E]'#E]O/gQ$IWO'#E^OOQ$IS'#GO'#GOO/qQ$IWO'#F}OOQ$IV'#F}'#F}O/|Q$IWO'#FPOOQ$IS'#Fr'#FrO0RQ$IWO'#FOOOQ$IV'#HZ'#HZOOQ$IV'#F|'#F|OOQ$IT'#FR'#FRQ`Q$IXOOO'RQ$IWO'#CoO0aQ$IWO'#CzO0hQ$IWO'#DOO0vQ$IWO'#GeO1WQ$I[O'#EQO'RQ$IWO'#EROOQ$IS'#ET'#ETOOQ$IS'#EV'#EVOOQ$IS'#EX'#EXO1lQ$IWO'#EZO2SQ$IWO'#E_O/|Q$IWO'#EaO2gQ$I[O'#EaO/|Q$IWO'#EdO/gQ$IWO'#EgO/gQ$IWO'#EkO/gQ$IWO'#EnO2rQ$IWO'#EpO2yQ$IWO'#EuO3UQ$IWO'#EqO/gQ$IWO'#EuO/|Q$IWO'#EwO/|Q$IWO'#E|OOQ$IS'#Cc'#CcOOQ$IS'#Cd'#CdOOQ$IS'#Ce'#CeOOQ$IS'#Cf'#CfOOQ$IS'#Cg'#CgOOQ$IS'#Ch'#ChOOQ$IS'#Cj'#CjO'RQ$IWO,58|O'RQ$IWO,58|O'RQ$IWO,58|O'RQ$IWO,58|O'RQ$IWO,58|O'RQ$IWO,58|O3ZQ$IWO'#DmOOQ$IS,5:W,5:WO3nQ$IWO,5:ZO3{Q%1`O,5:ZO4QQ$I[O,59WO0aQ$IWO,59_O0aQ$IWO,59_O0aQ$IWO,59_O6pQ$IWO,59_O6uQ$IWO,59_O6|Q$IWO,59gO7TQ$IWO'#G`O8ZQ$IWO'#G_OOQ$IS'#G_'#G_OOQ$IS'#DX'#DXO8rQ$IWO,59]O'RQ$IWO,59]O9QQ$IWO,59]O9VQ$IWO,5:PO'RQ$IWO,5:POOQ$IS,59|,59|O9eQ$IWO,59|O9jQ$IWO,5:VO'RQ$IWO,5:VO'RQ$IWO,5:TOOQ$IS,5:Q,5:QO9{Q$IWO,5:QO:QQ$IWO,5:UOOOO'#FZ'#FZO:VO`O,5:_OOQ$IS,5:_,5:_OOOO'#F['#F[O:_OpO,5:_O:gQ$IWO'#DuOOOO'#F]'#F]O:wO!bO,5:`OOQ$IS,5:`,5:`OOOO'#F`'#F`O;SO#tO,5:`OOOO'#Fa'#FaO;_O&jO,5:`OOOO'#Fb'#FbO;jO,UO,5:`OOQ$IS'#Fc'#FcO;uQ$I[O,5:dO>gQ$I[O,5<kO?QQ%GlO,5<kO?qQ$I[O,5<kOOQ$IS,5:x,5:xO@YQ$IXO'#FkOAiQ$IWO,5;TOOQ$IV,5<i,5<iOAtQ$I[O'#HWOB]Q$IWO,5;kOOQ$IS-E9p-E9pOOQ$IV,5;j,5;jO3PQ$IWO'#EwOOQ$IT-E9P-E9POBeQ$I[O,59ZODlQ$I[O,59fOEVQ$IWO'#GbOEbQ$IWO'#GbO/|Q$IWO'#GbOEmQ$IWO'#DQOEuQ$IWO,59jOEzQ$IWO'#GfO'RQ$IWO'#GfO/gQ$IWO,5=POOQ$IS,5=P,5=PO/gQ$IWO'#D|OOQ$IS'#D}'#D}OFiQ$IWO'#FeOFyQ$IWO,58zOGXQ$IWO,58zO)eQ$IWO,5:jOG^Q$I[O'#GhOOQ$IS,5:m,5:mOOQ$IS,5:u,5:uOGqQ$IWO,5:yOHSQ$IWO,5:{OOQ$IS'#Fh'#FhOHbQ$I[O,5:{OHpQ$IWO,5:{OHuQ$IWO'#HYOOQ$IS,5;O,5;OOITQ$IWO'#HVOOQ$IS,5;R,5;RO3UQ$IWO,5;VO3UQ$IWO,5;YOIfQ$I[O'#H[O'RQ$IWO'#H[OIpQ$IWO,5;[O2rQ$IWO,5;[O/gQ$IWO,5;aO/|Q$IWO,5;cOIuQ$IXO'#ElOKOQ$IZO,5;]ONaQ$IWO'#H]O3UQ$IWO,5;aONlQ$IWO,5;cONqQ$IWO,5;hO!#fQ$I[O1G.hO!#mQ$I[O1G.hO!&^Q$I[O1G.hO!&hQ$I[O1G.hO!)RQ$I[O1G.hO!)fQ$I[O1G.hO!)yQ$IWO'#GnO!*XQ$I[O'#GQO/gQ$IWO'#GnO!*cQ$IWO'#GmOOQ$IS,5:X,5:XO!*kQ$IWO,5:XO!*pQ$IWO'#GoO!*{Q$IWO'#GoO!+`Q$IWO1G/uOOQ$IS'#Dq'#DqOOQ$IS1G/u1G/uOOQ$IS1G.y1G.yO!,`Q$I[O1G.yO!,gQ$I[O1G.yO0aQ$IWO1G.yO!-SQ$IWO1G/ROOQ$IS'#DW'#DWO/gQ$IWO,59qOOQ$IS1G.w1G.wO!-ZQ$IWO1G/cO!-kQ$IWO1G/cO!-sQ$IWO1G/dO'RQ$IWO'#GgO!-xQ$IWO'#GgO!-}Q$I[O1G.wO!._Q$IWO,59fO!/eQ$IWO,5=VO!/uQ$IWO,5=VO!/}Q$IWO1G/kO!0SQ$I[O1G/kOOQ$IS1G/h1G/hO!0dQ$IWO,5=QO!1ZQ$IWO,5=QO/gQ$IWO1G/oO!1xQ$IWO1G/qO!1}Q$I[O1G/qO!2_Q$I[O1G/oOOQ$IS1G/l1G/lOOQ$IS1G/p1G/pOOOO-E9X-E9XOOQ$IS1G/y1G/yOOOO-E9Y-E9YO!2oQ$IWO'#GzO/gQ$IWO'#GzO!2}Q$IWO,5:aOOOO-E9Z-E9ZOOQ$IS1G/z1G/zOOOO-E9^-E9^OOOO-E9_-E9_OOOO-E9`-E9`OOQ$IS-E9a-E9aO!3YQ%GlO1G2VO!3yQ$I[O1G2VO'RQ$IWO,5<OOOQ$IS,5<O,5<OOOQ$IS-E9b-E9bOOQ$IS,5<V,5<VOOQ$IS-E9i-E9iOOQ$IV1G0o1G0oO/|Q$IWO'#FgO!4bQ$I[O,5=rOOQ$IS1G1V1G1VO!4yQ$IWO1G1VOOQ$IS'#DS'#DSO/gQ$IWO,5<|OOQ$IS,5<|,5<|O!5OQ$IWO'#FSO!5ZQ$IWO,59lO!5cQ$IWO1G/UO!5mQ$I[O,5=QOOQ$IS1G2k1G2kOOQ$IS,5:h,5:hO!6^Q$IWO'#GPOOQ$IS,5<P,5<POOQ$IS-E9c-E9cO!6oQ$IWO1G.fOOQ$IS1G0U1G0UO!6}Q$IWO,5=SO!7_Q$IWO,5=SO/gQ$IWO1G0eO/gQ$IWO1G0eO/|Q$IWO1G0gOOQ$IS-E9f-E9fO!7pQ$IWO1G0gO!7{Q$IWO1G0gO!8QQ$IWO,5=tO!8`Q$IWO,5=tO!8nQ$IWO,5=qO!9UQ$IWO,5=qO!9gQ$IZO1G0qO!<uQ$IZO1G0tO!@QQ$IWO,5=vO!@[Q$IWO,5=vO!@dQ$I[O,5=vO/gQ$IWO1G0vO!@nQ$IWO1G0vO3UQ$IWO1G0{ONlQ$IWO1G0}OOQ$IV,5;W,5;WO!@sQ$IYO,5;WO!@xQ$IZO1G0wO!DZQ$IWO'#FoO3UQ$IWO1G0wO3UQ$IWO1G0wO!DhQ$IWO,5=wO!DuQ$IWO,5=wO/|Q$IWO,5=wOOQ$IV1G0{1G0{O!D}Q$IWO'#EyO!E`Q%1`O1G0}OOQ$IV1G1S1G1SO3UQ$IWO1G1SOOQ$IS,5=Y,5=YOOQ$IS'#Dn'#DnO/gQ$IWO,5=YO!EhQ$IWO,5=XO!E{Q$IWO,5=XOOQ$IS1G/s1G/sO!FTQ$IWO,5=ZO!FeQ$IWO,5=ZO!FmQ$IWO,5=ZO!GQQ$IWO,5=ZO!GbQ$IWO,5=ZOOQ$IS7+%a7+%aOOQ$IS7+$e7+$eO!5cQ$IWO7+$mO!ITQ$IWO1G.yO!I[Q$IWO1G.yOOQ$IS1G/]1G/]OOQ$IS,5;p,5;pO'RQ$IWO,5;pOOQ$IS7+$}7+$}O!IcQ$IWO7+$}OOQ$IS-E9S-E9SOOQ$IS7+%O7+%OO!IsQ$IWO,5=RO'RQ$IWO,5=ROOQ$IS7+$c7+$cO!IxQ$IWO7+$}O!JQQ$IWO7+%OO!JVQ$IWO1G2qOOQ$IS7+%V7+%VO!JgQ$IWO1G2qO!JoQ$IWO7+%VOOQ$IS,5;o,5;oO'RQ$IWO,5;oO!JtQ$IWO1G2lOOQ$IS-E9R-E9RO!KkQ$IWO7+%ZOOQ$IS7+%]7+%]O!KyQ$IWO1G2lO!LhQ$IWO7+%]O!LmQ$IWO1G2rO!L}Q$IWO1G2rO!MVQ$IWO7+%ZO!M[Q$IWO,5=fO!MrQ$IWO,5=fO!MrQ$IWO,5=fO!NQO!LQO'#DwO!N]OSO'#G{OOOO1G/{1G/{O!NbQ$IWO1G/{O!NjQ%GlO7+'qO# ZQ$I[O1G1jP# tQ$IWO'#FdOOQ$IS,5<R,5<ROOQ$IS-E9e-E9eOOQ$IS7+&q7+&qOOQ$IS1G2h1G2hOOQ$IS,5;n,5;nOOQ$IS-E9Q-E9QOOQ$IS7+$p7+$pO#!RQ$IWO,5<kO#!lQ$IWO,5<kO#!}Q$I[O,5;qO##bQ$IWO1G2nOOQ$IS-E9T-E9TOOQ$IS7+&P7+&PO##rQ$IWO7+&POOQ$IS7+&R7+&RO#$QQ$IWO'#HXO/|Q$IWO7+&RO#$fQ$IWO7+&ROOQ$IS,5<U,5<UO#$qQ$IWO1G3`OOQ$IS-E9h-E9hOOQ$IS,5<Q,5<QO#%PQ$IWO1G3]OOQ$IS-E9d-E9dO#%gQ$IZO7+&]O!DZQ$IWO'#FmO3UQ$IWO7+&]O3UQ$IWO7+&`O#(uQ$I[O,5<YO'RQ$IWO,5<YO#)PQ$IWO1G3bOOQ$IS-E9l-E9lO#)ZQ$IWO1G3bO3UQ$IWO7+&bO/gQ$IWO7+&bOOQ$IV7+&g7+&gO!E`Q%1`O7+&iO#)cQ$IXO1G0rOOQ$IV-E9m-E9mO3UQ$IWO7+&cO3UQ$IWO7+&cOOQ$IV,5<Z,5<ZO#+UQ$IWO,5<ZOOQ$IV7+&c7+&cO#+aQ$IZO7+&cO#.lQ$IWO,5<[O#.wQ$IWO1G3cOOQ$IS-E9n-E9nO#/UQ$IWO1G3cO#/^Q$IWO'#H_O#/lQ$IWO'#H_O/|Q$IWO'#H_OOQ$IS'#H_'#H_O#/wQ$IWO'#H^OOQ$IS,5;e,5;eO#0PQ$IWO,5;eO/gQ$IWO'#E{OOQ$IV7+&i7+&iO3UQ$IWO7+&iOOQ$IV7+&n7+&nOOQ$IS1G2t1G2tOOQ$IS,5;s,5;sO#0UQ$IWO1G2sOOQ$IS-E9V-E9VO#0iQ$IWO,5;tO#0tQ$IWO,5;tO#1XQ$IWO1G2uOOQ$IS-E9W-E9WO#1iQ$IWO1G2uO#1qQ$IWO1G2uO#2RQ$IWO1G2uO#1iQ$IWO1G2uOOQ$IS<<HX<<HXO#2^Q$I[O1G1[OOQ$IS<<Hi<<HiP#2kQ$IWO'#FUO6|Q$IWO1G2mO#2xQ$IWO1G2mO#2}Q$IWO<<HiOOQ$IS<<Hj<<HjO#3_Q$IWO7+(]OOQ$IS<<Hq<<HqO#3oQ$I[O1G1ZP#4`Q$IWO'#FTO#4mQ$IWO7+(^O#4}Q$IWO7+(^O#5VQ$IWO<<HuO#5[Q$IWO7+(WOOQ$IS<<Hw<<HwO#6RQ$IWO,5;rO'RQ$IWO,5;rOOQ$IS-E9U-E9UOOQ$IS<<Hu<<HuOOQ$IS,5;x,5;xO/gQ$IWO,5;xO#6WQ$IWO1G3QOOQ$IS-E9[-E9[O#6nQ$IWO1G3QOOOO'#F_'#F_O#6|O!LQO,5:cOOOO,5=g,5=gOOOO7+%g7+%gO#7XQ$IWO1G2VO#7rQ$IWO1G2VP'RQ$IWO'#FVO/gQ$IWO<<IkO#8TQ$IWO,5=sO#8fQ$IWO,5=sO/|Q$IWO,5=sO#8wQ$IWO<<ImOOQ$IS<<Im<<ImO/|Q$IWO<<ImP/|Q$IWO'#FjP/gQ$IWO'#FfOOQ$IV-E9k-E9kO3UQ$IWO<<IwOOQ$IV,5<X,5<XO3UQ$IWO,5<XOOQ$IV<<Iw<<IwOOQ$IV<<Iz<<IzO#8|Q$I[O1G1tP#9WQ$IWO'#FnO#9_Q$IWO7+(|O#9iQ$IZO<<I|O3UQ$IWO<<I|OOQ$IV<<JT<<JTO3UQ$IWO<<JTOOQ$IV'#Fl'#FlO#<tQ$IZO7+&^OOQ$IV<<I}<<I}O#>mQ$IZO<<I}OOQ$IV1G1u1G1uO/|Q$IWO1G1uO3UQ$IWO<<I}O/|Q$IWO1G1vP/gQ$IWO'#FpO#AxQ$IWO7+(}O#BVQ$IWO7+(}OOQ$IS'#Ez'#EzO/gQ$IWO,5=yO#B_Q$IWO,5=yOOQ$IS,5=y,5=yO#BjQ$IWO,5=xO#B{Q$IWO,5=xOOQ$IS1G1P1G1POOQ$IS,5;g,5;gP#CTQ$IWO'#FXO#CeQ$IWO1G1`O#CxQ$IWO1G1`O#DYQ$IWO1G1`P#DeQ$IWO'#FYO#DrQ$IWO7+(aO#ESQ$IWO7+(aO#ESQ$IWO7+(aO#E[Q$IWO7+(aO#ElQ$IWO7+(XO6|Q$IWO7+(XOOQ$ISAN>TAN>TO#FVQ$IWO<<KxOOQ$ISAN>aAN>aO/gQ$IWO1G1^O#FgQ$I[O1G1^P#FqQ$IWO'#FWOOQ$IS1G1d1G1dP#GOQ$IWO'#F^O#G]Q$IWO7+(lOOOO-E9]-E9]O#GsQ$IWO7+'qOOQ$ISAN?VAN?VO#H^Q$IWO,5<TO#HrQ$IWO1G3_OOQ$IS-E9g-E9gO#ITQ$IWO1G3_OOQ$ISAN?XAN?XO#IfQ$IWOAN?XOOQ$IVAN?cAN?cOOQ$IV1G1s1G1sO3UQ$IWOAN?hO#IkQ$IZOAN?hOOQ$IVAN?oAN?oOOQ$IV-E9j-E9jOOQ$IV<<Ix<<IxO3UQ$IWOAN?iO3UQ$IWO7+'aOOQ$IVAN?iAN?iOOQ$IS7+'b7+'bO#LvQ$IWO<<LiOOQ$IS1G3e1G3eO/gQ$IWO1G3eOOQ$IS,5<],5<]O#MTQ$IWO1G3dOOQ$IS-E9o-E9oO#MfQ$IWO7+&zO#MvQ$IWO7+&zOOQ$IS7+&z7+&zO#NRQ$IWO<<K{O#NcQ$IWO<<K{O#NcQ$IWO<<K{O#NkQ$IWO'#GiOOQ$IS<<Ks<<KsO#NuQ$IWO<<KsOOQ$IS7+&x7+&xO/|Q$IWO1G1oP/|Q$IWO'#FiO$ `Q$IWO7+(yO$ qQ$IWO7+(yOOQ$ISG24sG24sOOQ$IVG25SG25SO3UQ$IWOG25SOOQ$IVG25TG25TOOQ$IV<<J{<<J{OOQ$IS7+)P7+)PP$!SQ$IWO'#FqOOQ$IS<<Jf<<JfO$!bQ$IWO<<JfO$!rQ$IWOANAgO$#SQ$IWOANAgO$#[Q$IWO'#GjOOQ$IS'#Gj'#GjO0hQ$IWO'#DaO$#uQ$IWO,5=TOOQ$ISANA_ANA_OOQ$IS7+'Z7+'ZO$$^Q$IWO<<LeOOQ$IVLD*nLD*nOOQ$ISAN@QAN@QO$$oQ$IWOG27RO$%PQ$IWO,59{OOQ$IS1G2o1G2oO#NkQ$IWO1G/gOOQ$IS7+%R7+%RO6|Q$IWO'#CzO6|Q$IWO,59_O6|Q$IWO,59_O6|Q$IWO,59_O$%UQ$I[O,5<kO6|Q$IWO1G.yO/gQ$IWO1G/UO/gQ$IWO7+$mP$%iQ$IWO'#FdO'RQ$IWO'#GPO$%vQ$IWO,59_O$%{Q$IWO,59_O$&SQ$IWO,59jO$&XQ$IWO1G/RO0hQ$IWO'#DOO6|Q$IWO,59g",
  stateData: "$&o~O$oOS$lOS$kOSQOS~OPhOTeOdsOfXOltOp!SOsuO|vO}!PO!R!VO!S!UO!VYO!ZZO!fdO!mdO!ndO!odO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#c!TO#f!WO#j!XO#l!YO#q!ZO#tlO$jqO$zQO${QO%PRO%QVO%e[O%f]O%i^O%l_O%r`O%uaO%wbO~OT!aO]!aO_!bOf!iO!V!kO!d!lO$u![O$v!]O$w!^O$x!_O$y!_O$z!`O${!`O$|!aO$}!aO%O!aO~Oh%TXi%TXj%TXk%TXl%TXm%TXp%TXw%TXx%TX!s%TX#^%TX$j%TX$m%TX%V%TX!O%TX!R%TX!S%TX%W%TX!W%TX![%TX}%TX#V%TXq%TX!j%TX~P$_OdsOfXO!VYO!ZZO!fdO!mdO!ndO!odO$zQO${QO%PRO%QVO%e[O%f]O%i^O%l_O%r`O%uaO%wbO~Ow%SXx%SX#^%SX$j%SX$m%SX%V%SX~Oh!oOi!pOj!nOk!nOl!qOm!rOp!sO!s%SX~P(`OT!yOl-fOs-tO|vO~P'ROT!|Ol-fOs-tO!W!}O~P'ROT#QO_#ROl-fOs-tO![#SO~P'RO%g#VO%h#XO~O%j#YO%k#XO~O!Z#[O%m#]O%q#_O~O!Z#[O%s#`O%t#_O~O!Z#[O%h#_O%v#bO~O!Z#[O%k#_O%x#dO~OT$tX]$tX_$tXf$tXh$tXi$tXj$tXk$tXl$tXm$tXp$tXw$tX!V$tX!d$tX$u$tX$v$tX$w$tX$x$tX$y$tX$z$tX${$tX$|$tX$}$tX%O$tX!O$tX!R$tX!S$tX~O%e[O%f]O%i^O%l_O%r`O%uaO%wbOx$tX!s$tX#^$tX$j$tX$m$tX%V$tX%W$tX!W$tX![$tX}$tX#V$tXq$tX!j$tX~P+uOw#iOx$sX!s$sX#^$sX$j$sX$m$sX%V$sX~Ol-fOs-tO~P'RO#^#lO$j#nO$m#nO~O%QVO~O!R#sO#l!YO#q!ZO#tlO~OltO~P'ROT#xO_#yO%QVOxtP~OT#}Ol-fOs-tO}$OO~P'ROx$QO!s$VO%V$RO#^!tX$j!tX$m!tX~OT#}Ol-fOs-tO#^!}X$j!}X$m!}X~P'ROl-fOs-tO#^#RX$j#RX$m#RX~P'RO!d$]O!m$]O%QVO~OT$gO~P'RO!S$iO#j$jO#l$kO~Ox$lO~OT$zO_$zOl-fOs-tO!O$|O~P'ROl-fOs-tOx%PO~P'RO%d%RO~O_!bOf!iO!V!kO!d!lOT`a]`ah`ai`aj`ak`al`am`ap`aw`ax`a!s`a#^`a$j`a$m`a$u`a$v`a$w`a$x`a$y`a$z`a${`a$|`a$}`a%O`a%V`a!O`a!R`a!S`a%W`a!W`a![`a}`a#V`aq`a!j`a~Ok%WO~Ol%WO~P'ROl-fO~P'ROh-hOi-iOj-gOk-gOl-pOm-qOp-uO!O%SX!R%SX!S%SX%W%SX!W%SX![%SX}%SX#V%SX!j%SX~P(`O%W%YOw%RX!O%RX!R%RX!S%RX!W%RXx%RX~Ow%]O!O%[O!R%aO!S%`O~O!O%[O~Ow%dO!R%aO!S%`O!W%_X~O!W%hO~Ow%iOx%kO!R%aO!S%`O![%YX~O![%oO~O![%pO~O%g#VO%h%rO~O%j#YO%k%rO~OT%uOl-fOs-tO|vO~P'RO!Z#[O%m#]O%q%xO~O!Z#[O%s#`O%t%xO~O!Z#[O%h%xO%v#bO~O!Z#[O%k%xO%x#dO~OT!la]!la_!laf!lah!lai!laj!lak!lal!lam!lap!law!lax!la!V!la!d!la!s!la#^!la$j!la$m!la$u!la$v!la$w!la$x!la$y!la$z!la${!la$|!la$}!la%O!la%V!la!O!la!R!la!S!la%W!la!W!la![!la}!la#V!laq!la!j!la~P#vOw%}Ox$sa!s$sa#^$sa$j$sa$m$sa%V$sa~P$_OT&POltOsuOx$sa!s$sa#^$sa$j$sa$m$sa%V$sa~P'ROw%}Ox$sa!s$sa#^$sa$j$sa$m$sa%V$sa~OPhOTeOltOsuO|vO}!PO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#^$_X$j$_X$m$_X~P'RO#^#lO$j&UO$m&UO~O!d&VOf%zX$j%zX#V%zX#^%zX$m%zX#U%zX~Of!iO$j&XO~Ohcaicajcakcalcamcapcawcaxca!sca#^ca$jca$mca%Vca!Oca!Rca!Sca%Wca!Wca![ca}ca#Vcaqca!jca~P$_Opnawnaxna#^na$jna$mna%Vna~Oh!oOi!pOj!nOk!nOl!qOm!rO!sna~PDTO%V&ZOw%UXx%UX~O%QVOw%UXx%UX~Ow&^OxtX~Ox&`O~Ow%iO#^%YX$j%YX$m%YX!O%YXx%YX![%YX!j%YX%V%YX~OT-oOl-fOs-tO|vO~P'RO%V$RO#^Sa$jSa$mSa~O%V$RO~Ow&iO#^%[X$j%[X$m%[Xk%[X~P$_Ow&lO}&kO#^#Ra$j#Ra$m#Ra~O#V&mO#^#Ta$j#Ta$m#Ta~O!d$]O!m$]O#U&oO%QVO~O#U&oO~Ow&qO#^%|X$j%|X$m%|X~Ow&sO#^%yX$j%yX$m%yXx%yX~Ow&wOk&OX~P$_Ok&zO~OPhOTeOltOsuO|vO}!PO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO$j'PO~P'ROq'TO#g'RO#h'SOP#eaT#ead#eaf#eal#eap#eas#ea|#ea}#ea!R#ea!S#ea!V#ea!Z#ea!f#ea!m#ea!n#ea!o#ea!v#ea!x#ea!z#ea!|#ea#O#ea#S#ea#U#ea#X#ea#Y#ea#[#ea#c#ea#f#ea#j#ea#l#ea#q#ea#t#ea$g#ea$j#ea$z#ea${#ea%P#ea%Q#ea%e#ea%f#ea%i#ea%l#ea%r#ea%u#ea%w#ea$i#ea$m#ea~Ow'UO#V'WOx&PX~Of'YO~Of!iOx$lO~OT!aO]!aO_!bOf!iO!V!kO!d!lO$w!^O$x!_O$y!_O$z!`O${!`O$|!aO$}!aO%O!aOhUiiUijUikUilUimUipUiwUixUi!sUi#^Ui$jUi$mUi$uUi%VUi!OUi!RUi!SUi%WUi!WUi![Ui}Ui#VUiqUi!jUi~O$v!]O~PNyO$vUi~PNyOT!aO]!aO_!bOf!iO!V!kO!d!lO$z!`O${!`O$|!aO$}!aO%O!aOhUiiUijUikUilUimUipUiwUixUi!sUi#^Ui$jUi$mUi$uUi$vUi$wUi%VUi!OUi!RUi!SUi%WUi!WUi![Ui}Ui#VUiqUi!jUi~O$x!_O$y!_O~P!#tO$xUi$yUi~P!#tO_!bOf!iO!V!kO!d!lOhUiiUijUikUilUimUipUiwUixUi!sUi#^Ui$jUi$mUi$uUi$vUi$wUi$xUi$yUi$zUi${Ui%VUi!OUi!RUi!SUi%WUi!WUi![Ui}Ui#VUiqUi!jUi~OT!aO]!aO$|!aO$}!aO%O!aO~P!&rOTUi]Ui$|Ui$}Ui%OUi~P!&rO!R%aO!S%`Ow%bX!O%bX~O%V'_O%W'_O~P+uOw'aO!O%aX~O!O'cO~Ow'dOx'fO!W%cX~Ol-fOs-tOw'dOx'gO!W%cX~P'RO!W'iO~Oj!nOk!nOl!qOm!rOhgipgiwgixgi!sgi#^gi$jgi$mgi%Vgi~Oi!pO~P!+eOigi~P!+eOh-hOi-iOj-gOk-gOl-pOm-qO~Oq'kO~P!,nOT'pOl-fOs-tO!O'qO~P'ROw'rO!O'qO~O!O'tO~O!S'vO~Ow'rO!O'wO!R%aO!S%`O~P$_Oh-hOi-iOj-gOk-gOl-pOm-qO!Ona!Rna!Sna%Wna!Wna![na}na#Vnaqna!jna~PDTOT'pOl-fOs-tO!W%_a~P'ROw'zO!W%_a~O!W'{O~Ow'zO!R%aO!S%`O!W%_a~P$_OT(POl-fOs-tO![%Ya#^%Ya$j%Ya$m%Ya!O%Yax%Ya!j%Ya%V%Ya~P'ROw(QO![%Ya#^%Ya$j%Ya$m%Ya!O%Yax%Ya!j%Ya%V%Ya~O![(TO~Ow(QO!R%aO!S%`O![%Ya~P$_Ow(WO!R%aO!S%`O![%`a~P$_Ow(ZOx%nX![%nX!j%nX~Ox(^O![(`O!j(aO~OT&POltOsuOx$si!s$si#^$si$j$si$m$si%V$si~P'ROw(bOx$si!s$si#^$si$j$si$m$si%V$si~O!d&VOf%za$j%za#V%za#^%za$m%za#U%za~O$j(gO~OT#xO_#yO%QVO~Ow&^Oxta~OltOsuO~P'ROw(QO#^%Ya$j%Ya$m%Ya!O%Yax%Ya![%Ya!j%Ya%V%Ya~P$_Ow(lO#^$sX$j$sX$m$sX%V$sX~O%V$RO#^Si$jSi$mSi~O#^%[a$j%[a$m%[ak%[a~P'ROw(oO#^%[a$j%[a$m%[ak%[a~OT(sOf(uO%QVO~O#U(vO~O%QVO#^%|a$j%|a$m%|a~Ow(xO#^%|a$j%|a$m%|a~Ol-fOs-tO#^%ya$j%ya$m%yax%ya~P'ROw({O#^%ya$j%ya$m%yax%ya~Oq)PO#a)OOP#_iT#_id#_if#_il#_ip#_is#_i|#_i}#_i!R#_i!S#_i!V#_i!Z#_i!f#_i!m#_i!n#_i!o#_i!v#_i!x#_i!z#_i!|#_i#O#_i#S#_i#U#_i#X#_i#Y#_i#[#_i#c#_i#f#_i#j#_i#l#_i#q#_i#t#_i$g#_i$j#_i$z#_i${#_i%P#_i%Q#_i%e#_i%f#_i%i#_i%l#_i%r#_i%u#_i%w#_i$i#_i$m#_i~Oq)QOP#biT#bid#bif#bil#bip#bis#bi|#bi}#bi!R#bi!S#bi!V#bi!Z#bi!f#bi!m#bi!n#bi!o#bi!v#bi!x#bi!z#bi!|#bi#O#bi#S#bi#U#bi#X#bi#Y#bi#[#bi#c#bi#f#bi#j#bi#l#bi#q#bi#t#bi$g#bi$j#bi$z#bi${#bi%P#bi%Q#bi%e#bi%f#bi%i#bi%l#bi%r#bi%u#bi%w#bi$i#bi$m#bi~OT)SOk&Oa~P'ROw)TOk&Oa~Ow)TOk&Oa~P$_Ok)XO~O$h)[O~Oq)_O#g'RO#h)^OP#eiT#eid#eif#eil#eip#eis#ei|#ei}#ei!R#ei!S#ei!V#ei!Z#ei!f#ei!m#ei!n#ei!o#ei!v#ei!x#ei!z#ei!|#ei#O#ei#S#ei#U#ei#X#ei#Y#ei#[#ei#c#ei#f#ei#j#ei#l#ei#q#ei#t#ei$g#ei$j#ei$z#ei${#ei%P#ei%Q#ei%e#ei%f#ei%i#ei%l#ei%r#ei%u#ei%w#ei$i#ei$m#ei~Ol-fOs-tOx$lO~P'ROl-fOs-tOx&Pa~P'ROw)eOx&Pa~OT)iO_)jO!O)mO$|)kO%QVO~Ox$lO&S)oO~OT$zO_$zOl-fOs-tO!O%aa~P'ROw)uO!O%aa~Ol-fOs-tOx)xO!W%ca~P'ROw)yO!W%ca~Ol-fOs-tOw)yOx)|O!W%ca~P'ROl-fOs-tOw)yO!W%ca~P'ROw)yOx)|O!W%ca~Oj-gOk-gOl-pOm-qOhgipgiwgi!Ogi!Rgi!Sgi%Wgi!Wgixgi![gi#^gi$jgi$mgi}gi#Vgiqgi!jgi%Vgi~Oi-iO~P!GmOigi~P!GmOT'pOl-fOs-tO!O*RO~P'ROk*TO~Ow*VO!O*RO~O!O*WO~OT'pOl-fOs-tO!W%_i~P'ROw*XO!W%_i~O!W*YO~OT(POl-fOs-tO![%Yi#^%Yi$j%Yi$m%Yi!O%Yix%Yi!j%Yi%V%Yi~P'ROw*]O!R%aO!S%`O![%`i~Ow*`O![%Yi#^%Yi$j%Yi$m%Yi!O%Yix%Yi!j%Yi%V%Yi~O![*aO~O_*cOl-fOs-tO![%`i~P'ROw*]O![%`i~O![*eO~OT*gOl-fOs-tOx%na![%na!j%na~P'ROw*hOx%na![%na!j%na~O!Z#[O%p*kO![!kX~O![*mO~Ox(^O![*nO~OT&POltOsuOx$sq!s$sq#^$sq$j$sq$m$sq%V$sq~P'ROw$Wix$Wi!s$Wi#^$Wi$j$Wi$m$Wi%V$Wi~P$_OT&POltOsuO~P'ROT&POl-fOs-tO#^$sa$j$sa$m$sa%V$sa~P'ROw*oO#^$sa$j$sa$m$sa%V$sa~Ow#ya#^#ya$j#ya$m#yak#ya~P$_O#^%[i$j%[i$m%[ik%[i~P'ROw*rO#^#Rq$j#Rq$m#Rq~Ow*sO#V*uO#^%{X$j%{X$m%{X!O%{X~OT*wOf*xO%QVO~O%QVO#^%|i$j%|i$m%|i~Ol-fOs-tO#^%yi$j%yi$m%yix%yi~P'ROq*|O#a)OOP#_qT#_qd#_qf#_ql#_qp#_qs#_q|#_q}#_q!R#_q!S#_q!V#_q!Z#_q!f#_q!m#_q!n#_q!o#_q!v#_q!x#_q!z#_q!|#_q#O#_q#S#_q#U#_q#X#_q#Y#_q#[#_q#c#_q#f#_q#j#_q#l#_q#q#_q#t#_q$g#_q$j#_q$z#_q${#_q%P#_q%Q#_q%e#_q%f#_q%i#_q%l#_q%r#_q%u#_q%w#_q$i#_q$m#_q~Ok$baw$ba~P$_OT)SOk&Oi~P'ROw+TOk&Oi~OPhOTeOltOp!SOsuO|vO}!PO!R!VO!S!UO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#c!TO#f!WO#j!XO#l!YO#q!ZO#tlO~P'ROw+_Ox$lO#V+_O~O#h+`OP#eqT#eqd#eqf#eql#eqp#eqs#eq|#eq}#eq!R#eq!S#eq!V#eq!Z#eq!f#eq!m#eq!n#eq!o#eq!v#eq!x#eq!z#eq!|#eq#O#eq#S#eq#U#eq#X#eq#Y#eq#[#eq#c#eq#f#eq#j#eq#l#eq#q#eq#t#eq$g#eq$j#eq$z#eq${#eq%P#eq%Q#eq%e#eq%f#eq%i#eq%l#eq%r#eq%u#eq%w#eq$i#eq$m#eq~O#V+aOw$dax$da~Ol-fOs-tOx&Pi~P'ROw+cOx&Pi~Ox$QO%V+eOw&RX!O&RX~O%QVOw&RX!O&RX~Ow+iO!O&QX~O!O+kO~OT$zO_$zOl-fOs-tO!O%ai~P'ROx+nOw#|a!W#|a~Ol-fOs-tOx+oOw#|a!W#|a~P'ROl-fOs-tOx)xO!W%ci~P'ROw+rO!W%ci~Ol-fOs-tOw+rO!W%ci~P'ROw+rOx+uO!W%ci~Ow#xi!O#xi!W#xi~P$_OT'pOl-fOs-tO~P'ROk+wO~OT'pOl-fOs-tO!O+xO~P'ROT'pOl-fOs-tO!W%_q~P'ROw#wi![#wi#^#wi$j#wi$m#wi!O#wix#wi!j#wi%V#wi~P$_OT(POl-fOs-tO~P'RO_*cOl-fOs-tO![%`q~P'ROw+yO![%`q~O![+zO~OT(POl-fOs-tO![%Yq#^%Yq$j%Yq$m%Yq!O%Yqx%Yq!j%Yq%V%Yq~P'ROx+{O~OT*gOl-fOs-tOx%ni![%ni!j%ni~P'ROw,QOx%ni![%ni!j%ni~O!Z#[O%p*kO![!ka~OT&POl-fOs-tO#^$si$j$si$m$si%V$si~P'ROw,SO#^$si$j$si$m$si%V$si~O%QVO#^%{a$j%{a$m%{a!O%{a~Ow,VO#^%{a$j%{a$m%{a!O%{a~O!O,YO~Ok$biw$bi~P$_OT)SO~P'ROT)SOk&Oq~P'ROq,^OP#dyT#dyd#dyf#dyl#dyp#dys#dy|#dy}#dy!R#dy!S#dy!V#dy!Z#dy!f#dy!m#dy!n#dy!o#dy!v#dy!x#dy!z#dy!|#dy#O#dy#S#dy#U#dy#X#dy#Y#dy#[#dy#c#dy#f#dy#j#dy#l#dy#q#dy#t#dy$g#dy$j#dy$z#dy${#dy%P#dy%Q#dy%e#dy%f#dy%i#dy%l#dy%r#dy%u#dy%w#dy$i#dy$m#dy~OPhOTeOltOp!SOsuO|vO}!PO!R!VO!S!UO!vxO!xyO!zzO!|{O#O|O#S}O#U!OO#X!QO#Y!QO#[!RO#c!TO#f!WO#j!XO#l!YO#q!ZO#tlO$i,bO$m,bO~P'RO#h,cOP#eyT#eyd#eyf#eyl#eyp#eys#ey|#ey}#ey!R#ey!S#ey!V#ey!Z#ey!f#ey!m#ey!n#ey!o#ey!v#ey!x#ey!z#ey!|#ey#O#ey#S#ey#U#ey#X#ey#Y#ey#[#ey#c#ey#f#ey#j#ey#l#ey#q#ey#t#ey$g#ey$j#ey$z#ey${#ey%P#ey%Q#ey%e#ey%f#ey%i#ey%l#ey%r#ey%u#ey%w#ey$i#ey$m#ey~Ol-fOs-tOx&Pq~P'ROw,gOx&Pq~O%V+eOw&Ra!O&Ra~OT)iO_)jO$|)kO%QVO!O&Qa~Ow,kO!O&Qa~OT$zO_$zOl-fOs-tO~P'ROl-fOs-tOx,mOw#|i!W#|i~P'ROl-fOs-tOw#|i!W#|i~P'ROx,mOw#|i!W#|i~Ol-fOs-tOx)xO~P'ROl-fOs-tOx)xO!W%cq~P'ROw,pO!W%cq~Ol-fOs-tOw,pO!W%cq~P'ROp,sO!R%aO!S%`O!O%Zq!W%Zq![%Zqw%Zq~P!,nO_*cOl-fOs-tO![%`y~P'ROw#zi![#zi~P$_O_*cOl-fOs-tO~P'ROT*gOl-fOs-tO~P'ROT*gOl-fOs-tOx%nq![%nq!j%nq~P'ROT&POl-fOs-tO#^$sq$j$sq$m$sq%V$sq~P'RO#V,wOw$]a#^$]a$j$]a$m$]a!O$]a~O%QVO#^%{i$j%{i$m%{i!O%{i~Ow,yO#^%{i$j%{i$m%{i!O%{i~O!O,{O~Oq,}OP#d!RT#d!Rd#d!Rf#d!Rl#d!Rp#d!Rs#d!R|#d!R}#d!R!R#d!R!S#d!R!V#d!R!Z#d!R!f#d!R!m#d!R!n#d!R!o#d!R!v#d!R!x#d!R!z#d!R!|#d!R#O#d!R#S#d!R#U#d!R#X#d!R#Y#d!R#[#d!R#c#d!R#f#d!R#j#d!R#l#d!R#q#d!R#t#d!R$g#d!R$j#d!R$z#d!R${#d!R%P#d!R%Q#d!R%e#d!R%f#d!R%i#d!R%l#d!R%r#d!R%u#d!R%w#d!R$i#d!R$m#d!R~Ol-fOs-tOx&Py~P'ROT)iO_)jO$|)kO%QVO!O&Qi~Ol-fOs-tOw#|q!W#|q~P'ROx-TOw#|q!W#|q~Ol-fOs-tOx)xO!W%cy~P'ROw-UO!W%cy~Ol-fOs-YO~P'ROp,sO!R%aO!S%`O!O%Zy!W%Zy![%Zyw%Zy~P!,nO%QVO#^%{q$j%{q$m%{q!O%{q~Ow-^O#^%{q$j%{q$m%{q!O%{q~OT)iO_)jO$|)kO%QVO~Ol-fOs-tOw#|y!W#|y~P'ROl-fOs-tOx)xO!W%c!R~P'ROw-aO!W%c!R~Op%^X!O%^X!R%^X!S%^X!W%^X![%^Xw%^X~P!,nOp,sO!R%aO!S%`O!O%]a!W%]a![%]aw%]a~O%QVO#^%{y$j%{y$m%{y!O%{y~Ol-fOs-tOx)xO!W%c!Z~P'ROx-dO~Ow*oO#^$sa$j$sa$m$sa%V$sa~P$_OT&POl-fOs-tO~P'ROk-kO~Ol-kO~P'ROx-lO~Oq-mO~P!,nO%f%i%u%w%e!Z%m%s%v%x%l%r%l%Q~",
  goto: "!,u&SPPPP&TP&])n*T*k+S+l,VP,qP&]-_-_&]P&]P0pPPPPPP0p3`PP3`P5l5u:yPP:|;[;_PPP&]&]PP;k&]PP&]&]PP&]&]&]&];o<c&]P<fP<i<i@OP@d&]PPP@h@n&TP&T&TP&TP&TP&TP&TP&T&T&TP&TPP&TPP&TP@tP@{ARP@{P@{@{PPP@{PBzPCTCZCaBzP@{CgPCnCtCzDWDjDpDzEQEnEtEzFQF[FbFhFnFtFzG^GhGnGtGzHUH[HbHhHnHxIOIYI`PPPPPPPPPIiIqIzJUJaPPPPPPPPPPPPNv! `!%n!(zPP!)S!)b!)k!*a!*W!*j!*p!*s!*v!*y!+RPPPPPPPPPP!+U!+XPPPPPPPPP!+_!+k!+w!,T!,W!,^!,d!,j!,m]iOr#l$l)[+Z'odOSXYZehrstvx|}!R!S!T!U!X!c!d!e!f!g!h!i!k!n!o!p!r!s!y!|#Q#R#[#i#l#}$O$Q$S$V$g$i$j$l$z%P%W%Z%]%`%d%i%k%u%}&P&[&`&i&k&l&s&w&z'R'U'`'a'd'f'g'k'p'r'v'z(P(Q(W(Z(b(d(l(o({)O)S)T)X)[)e)o)u)x)y)|*S*T*V*X*[*]*`*c*g*h*o*q*r*z+S+T+Z+b+c+f+m+n+o+q+r+u+w+y+{+},P,Q,S,g,i,m,p,s-T-U-a-d-f-g-h-i-k-l-m-n-o-q-uw!cP#h#u$W$f%b%g%m%n&a&y(c(n)R*Q*Z+R+|-jy!dP#h#u$W$f$r%b%g%m%n&a&y(c(n)R*Q*Z+R+|-j{!eP#h#u$W$f$r$s%b%g%m%n&a&y(c(n)R*Q*Z+R+|-j}!fP#h#u$W$f$r$s$t%b%g%m%n&a&y(c(n)R*Q*Z+R+|-j!P!gP#h#u$W$f$r$s$t$u%b%g%m%n&a&y(c(n)R*Q*Z+R+|-j!R!hP#h#u$W$f$r$s$t$u$v%b%g%m%n&a&y(c(n)R*Q*Z+R+|-j!V!hP!m#h#u$W$f$r$s$t$u$v$w%b%g%m%n&a&y(c(n)R*Q*Z+R+|-j'oSOSXYZehrstvx|}!R!S!T!U!X!c!d!e!f!g!h!i!k!n!o!p!r!s!y!|#Q#R#[#i#l#}$O$Q$S$V$g$i$j$l$z%P%W%Z%]%`%d%i%k%u%}&P&[&`&i&k&l&s&w&z'R'U'`'a'd'f'g'k'p'r'v'z(P(Q(W(Z(b(d(l(o({)O)S)T)X)[)e)o)u)x)y)|*S*T*V*X*[*]*`*c*g*h*o*q*r*z+S+T+Z+b+c+f+m+n+o+q+r+u+w+y+{+},P,Q,S,g,i,m,p,s-T-U-a-d-f-g-h-i-k-l-m-n-o-q-u&ZUOXYZhrtv|}!R!S!T!X!i!k!n!o!p!r!s#[#i#l$O$Q$S$V$j$l$z%P%W%Z%]%d%i%k%u%}&[&`&k&l&s&z'R'U'`'a'd'f'g'k'r'z(Q(W(Z(b(d(l({)O)X)[)e)o)u)x)y)|*S*T*V*X*[*]*`*g*h*o*r*z+Z+b+c+f+m+n+o+q+r+u+w+y+{+},P,Q,S,g,i,m,p,s-T-U-a-d-f-g-h-i-k-l-m-n-q-u%eWOXYZhrv|}!R!S!T!X!i!k#[#i#l$O$Q$S$V$j$l$z%P%Z%]%d%i%k%u%}&[&`&k&l&s&z'R'U'`'a'd'f'g'k'r'z(Q(W(Z(b(d(l({)O)X)[)e)o)u)x)y)|*S*V*X*[*]*`*g*h*o*r*z+Z+b+c+f+m+n+o+q+r+u+y+{+},P,Q,S,g,i,m,p-T-U-a-l-m-nQ#{uQ-b-YR-r-t'fdOSXYZehrstvx|}!R!S!T!U!X!c!d!e!f!g!h!k!n!o!p!r!s!y!|#Q#R#[#i#l#}$O$Q$S$V$g$i$j$l$z%P%W%Z%]%`%d%i%k%u%}&P&[&`&i&k&l&s&w&z'R'U'`'d'f'g'k'p'r'v'z(P(Q(W(Z(b(d(l(o({)O)S)T)X)[)e)o)x)y)|*S*T*V*X*[*]*`*c*g*h*o*q*r*z+S+T+Z+b+c+f+n+o+q+r+u+w+y+{+},P,Q,S,g,i,m,p,s-T-U-a-d-f-g-h-i-k-l-m-n-o-q-uW#ol!O!P$^W#wu&^-Y-tQ$`!QQ$p!YQ$q!ZW$y!i'a)u+mS&]#x#yQ&}$kQ(e&VQ(s&mW(t&o(u(v*xU(w&q(x*yQ)g'WW)h'Y+i,k-RS+h)i)jY,U*s,V,x,y-^Q,X*uQ,d+_Q,f+aR-],wR&[#wi!vXY!S!T%]%d'r'z)O*S*V*XR%Z!uQ!zXQ%v#[Q&e$SR&h$VT-X,s-d!U!jP!m#h#u$W$f$r$s$t$u$v$w%b%g%m%n&a&y(c(n)R*Q*Z+R+|-jQ&Y#pR']$qR'`$yR%S!l'ncOSXYZehrstvx|}!R!S!T!U!X!c!d!e!f!g!h!i!k!n!o!p!r!s!y!|#Q#R#[#i#l#}$O$Q$S$V$g$i$j$l$z%P%W%Z%]%`%d%i%k%u%}&P&[&`&i&k&l&s&w&z'R'U'`'a'd'f'g'k'p'r'v'z(P(Q(W(Z(b(d(l(o({)O)S)T)X)[)e)o)u)x)y)|*S*T*V*X*[*]*`*c*g*h*o*q*r*z+S+T+Z+b+c+f+m+n+o+q+r+u+w+y+{+},P,Q,S,g,i,m,p,s-T-U-a-d-f-g-h-i-k-l-m-n-o-q-uT#fc#gS#]_#^S#``#aS#ba#cS#db#eT*k(^*lT(_%v(aQ$UwR+g)hX$Sw$T$U&gZkOr$l)[+ZXoOr)[+ZQ$m!WQ&u$dQ&v$eQ'X$oQ'[$qQ)Y&|Q)`'RQ)b'SQ)c'TQ)p'ZQ)r']Q*})OQ+P)PQ+Q)QQ+U)WS+W)Z)qQ+[)^Q+])_Q+^)aQ,[*|Q,]+OQ,_+VQ,`+XQ,e+`Q,|,^Q-O,cQ-P,dR-_,}WoOr)[+ZR#rnQ'Z$pR)Z&}Q+f)hR,i+gQ)q'ZR+X)ZZmOnr)[+ZQrOR#trQ&_#zR(j&_S%j#P#|S(R%j(UT(U%m&aQ%^!xQ%e!{W's%^%e'x'|Q'x%bR'|%gQ&j$WR(p&jQ(X%nQ*^(ST*d(X*^Q'b${R)v'bS'e%O%PY)z'e){+s,q-VU){'f'g'hU+s)|)}*OS,q+t+uR-V,rQ#W]R%q#WQ#Z^R%s#ZQ#^_R%w#^Q([%tS*i([*jR*j(]Q*l(^R,R*lQ#a`R%y#aQ#caR%z#cQ#ebR%{#eQ#gcR%|#gQ#jfQ&O#hW&R#j&O(m*pQ(m&dR*p-jQ$TwS&f$T&gR&g$UQ&t$bR(|&tQ&W#oR(f&WQ$^!PR&n$^Q*t(tS,W*t,zR,z,XQ&r$`R(y&rQ#mjR&T#mQ+Z)[R,a+ZQ(}&uR*{(}Q&x$fS)U&x)VR)V&yQ'Q$mR)]'QQ'V$nS)f'V+dR+d)gQ+j)lR,l+jWnOr)[+ZR#qnSqOrT+Y)[+ZWpOr)[+ZR'O$lYjOr$l)[+ZR&S#l[wOr#l$l)[+ZR&e$S&YPOXYZhrtv|}!R!S!T!X!i!k!n!o!p!r!s#[#i#l$O$Q$S$V$j$l$z%P%W%Z%]%d%i%k%u%}&[&`&k&l&s&z'R'U'`'a'd'f'g'k'r'z(Q(W(Z(b(d(l({)O)X)[)e)o)u)x)y)|*S*T*V*X*[*]*`*g*h*o*r*z+Z+b+c+f+m+n+o+q+r+u+w+y+{+},P,Q,S,g,i,m,p,s-T-U-a-d-f-g-h-i-k-l-m-n-q-uQ!mSQ#heQ#usU$Wx%`'vS$f!U$iQ$r!cQ$s!dQ$t!eQ$u!fQ$v!gQ$w!hQ%b!yQ%g!|Q%m#QQ%n#RQ&a#}Q&y$gQ(c&PU(n&i(o*qW)R&w)T+S+TQ*Q'pQ*Z(PQ+R)SQ+|*cR-j-oQ!xXQ!{YQ$d!SQ$e!T^'o%]%d'r'z*S*V*XR+O)O[fOr#l$l)[+Zh!uXY!S!T%]%d'r'z)O*S*V*XQ#PZQ#khS#|v|Q$Z}W$b!R$V&z)XS$n!X$jW$x!i'a)u+mQ%O!kQ%t#[`&Q#i%}(b(d(l*o,S-nQ&b$OQ&c$QQ&d$SQ'^$zQ'h%PQ'n%ZW(O%i(Q*[*`Q(S%kQ(]%uQ(h&[S(k&`-lQ(q&kQ(r&lU(z&s({*zQ)a'RY)d'U)e+b+c,gQ)s'`^)w'd)y+q+r,p-U-aQ)}'fQ*O'gS*P'k-mW*b(W*]+y+}W*f(Z*h,P,QQ+l)oQ+p)xQ+t)|Q,O*gQ,T*rQ,h+fQ,n+nQ,o+oQ,r+uQ,v+{Q-Q,iQ-S,mR-`-ThTOr#i#l$l%}&`'k(b(d)[+Z$z!tXYZhv|}!R!S!T!X!i!k#[$O$Q$S$V$j$z%P%Z%]%d%i%k%u&[&k&l&s&z'R'U'`'a'd'f'g'r'z(Q(W(Z(l({)O)X)e)o)u)x)y)|*S*V*X*[*]*`*g*h*o*r*z+b+c+f+m+n+o+q+r+u+y+{+},P,Q,S,g,i,m,p-T-U-a-l-m-nQ#vtW%T!n!r-g-qQ%U!oQ%V!pQ%X!sQ%c-fS'j%W-kQ'l-hQ'm-iQ+v*TQ,u+wS-W,s-dR-s-uU#zu-Y-tR(i&^[gOr#l$l)[+ZX!wX#[$S$VQ#UZQ$PvR$Y|Q%_!xQ%f!{Q%l#PQ'^$xQ'y%bQ'}%gQ(V%mQ(Y%nQ*_(SQ,t+vQ-[,uR-c-ZQ$XxQ'u%`R*U'vQ-Z,sR-e-dR#OYR#TZR$}!iQ${!iV)t'a)u+mR%Q!kR%v#[Q(`%vR*n(aQ$c!RQ&h$VQ)W&zR+V)XQ#plQ$[!OQ$_!PR&p$^Q(s&oQ*v(uQ*w(vR,Z*xR$a!QXpOr)[+ZQ$h!UR&{$iQ$o!XR&|$jR)n'YQ)l'YV,j+i,k-R",
  nodeNames: "⚠ print Comment Script AssignStatement * BinaryExpression BitOp BitOp BitOp BitOp ArithOp ArithOp @ ArithOp ** UnaryExpression ArithOp BitOp AwaitExpression await ParenthesizedExpression ( BinaryExpression or and CompareOp in not is UnaryExpression ConditionalExpression if else LambdaExpression lambda ParamList VariableName AssignOp , : NamedExpression AssignOp YieldExpression yield from ) TupleExpression ComprehensionExpression async for LambdaExpression ArrayExpression [ ] ArrayComprehensionExpression DictionaryExpression { } DictionaryComprehensionExpression SetExpression SetComprehensionExpression CallExpression ArgList AssignOp MemberExpression . PropertyName Number String FormatString FormatReplacement FormatConversion FormatSpec ContinuedString Ellipsis None Boolean TypeDef AssignOp UpdateStatement UpdateOp ExpressionStatement DeleteStatement del PassStatement pass BreakStatement break ContinueStatement continue ReturnStatement return YieldStatement PrintStatement RaiseStatement raise ImportStatement import as ScopeStatement global nonlocal AssertStatement assert StatementGroup ; IfStatement Body elif WhileStatement while ForStatement TryStatement try except finally WithStatement with FunctionDefinition def ParamList AssignOp TypeDef ClassDefinition class DecoratedStatement Decorator At",
  maxTerm: 234,
  context: trackIndent,
  nodeProps: [
    [NodeProp.group, -14,4,80,82,83,85,87,89,91,93,94,95,97,100,103,"Statement Statement",-22,6,16,19,21,37,47,48,52,55,56,59,60,61,62,65,68,69,70,74,75,76,77,"Expression",-9,105,107,110,112,113,117,119,124,126,"Statement"]
  ],
  skippedNodes: [0,2],
  repeatNodeCount: 32,
  tokenData: "(#RMgR!^OX$}XY!5[Y[$}[]!5[]p$}pq!5[qr!7frs!;]st#+otu$}uv%3Tvw%5gwx%6sxy&)oyz&*uz{&+{{|&.k|}&/w}!O&0}!O!P&3d!P!Q&>j!Q!R&AY!R![&GW![!]'$S!]!^'&f!^!_''l!_!`'*[!`!a'+h!a!b$}!b!c'.T!c!d'/c!d!e'1T!e!h'/c!h!i'=R!i!t'/c!t!u'Fg!u!w'/c!w!x';a!x!}'/c!}#O'Hq#O#P'Iw#P#Q'Ji#Q#R'Ko#R#S'/c#S#T$}#T#U'/c#U#V'1T#V#Y'/c#Y#Z'=R#Z#f'/c#f#g'Fg#g#i'/c#i#j';a#j#o'/c#o#p'L{#p#q'Mq#q#r'N}#r#s( {#s$g$}$g~'/c<r%`Z%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}9[&^Z%p7[%gS%m`%v!bOr'PrsLQsw'Pwx(Px#O'P#O#PNp#P#o'P#o#pKQ#p#q'P#q#rGW#r~'P9['^Z%p7[%gS%jW%m`%v!bOr'Prs&Rsw'Pwx(Px#O'P#O#PFr#P#o'P#o#pKQ#p#q'P#q#rGW#r~'P8z(WZ%p7[%jWOr(yrs)wsw(ywxAjx#O(y#O#PF^#P#o(y#o#p>v#p#q(y#q#r5T#r~(y8z)UZ%p7[%gS%jW%v!bOr(yrs)wsw(ywx(Px#O(y#O#PAU#P#o(y#o#p?p#p#q(y#q#r5T#r~(y8z*QZ%p7[%gS%v!bOr(yrs*ssw(ywx(Px#O(y#O#P@p#P#o(y#o#p?p#p#q(y#q#r5T#r~(y8z*|Z%p7[%gS%v!bOr(yrs+osw(ywx(Px#O(y#O#P4o#P#o(y#o#p?p#p#q(y#q#r5T#r~(y8r+xX%p7[%gS%v!bOw+owx,ex#O+o#O#P4Z#P#o+o#o#p3Z#p#q+o#q#r.k#r~+o8r,jX%p7[Ow+owx-Vx#O+o#O#P3u#P#o+o#o#p2i#p#q+o#q#r.k#r~+o8r-[X%p7[Ow+owx-wx#O+o#O#P.V#P#o+o#o#p0^#p#q+o#q#r.k#r~+o7[-|R%p7[O#o-w#p#q-w#r~-w8r.[T%p7[O#o+o#o#p.k#p#q+o#q#r.k#r~+o!f.rV%gS%v!bOw.kwx/Xx#O.k#O#P3T#P#o.k#o#p3Z#p~.k!f/[VOw.kwx/qx#O.k#O#P2c#P#o.k#o#p2i#p~.k!f/tUOw.kx#O.k#O#P0W#P#o.k#o#p0^#p~.k!f0ZPO~.k!f0cV%gSOw0xwx1^x#O0x#O#P2]#P#o0x#o#p.k#p~0xS0}T%gSOw0xwx1^x#O0x#O#P2]#P~0xS1aTOw0xwx1px#O0x#O#P2V#P~0xS1sSOw0xx#O0x#O#P2P#P~0xS2SPO~0xS2YPO~0xS2`PO~0x!f2fPO~.k!f2nV%gSOw0xwx1^x#O0x#O#P2]#P#o0x#o#p.k#p~0x!f3WPO~.k!f3`V%gSOw0xwx1^x#O0x#O#P2]#P#o0x#o#p.k#p~0x8r3zT%p7[O#o+o#o#p.k#p#q+o#q#r.k#r~+o8r4`T%p7[O#o+o#o#p.k#p#q+o#q#r.k#r~+o8z4tT%p7[O#o(y#o#p5T#p#q(y#q#r5T#r~(y!n5^X%gS%jW%v!bOr5Trs5ysw5Twx7ax#O5T#O#P@j#P#o5T#o#p?p#p~5T!n6QX%gS%v!bOr5Trs6msw5Twx7ax#O5T#O#P@d#P#o5T#o#p?p#p~5T!n6tX%gS%v!bOr5Trs.ksw5Twx7ax#O5T#O#P?j#P#o5T#o#p?p#p~5T!n7fX%jWOr5Trs5ysw5Twx8Rx#O5T#O#P>p#P#o5T#o#p>v#p~5T!n8WX%jWOr5Trs5ysw5Twx8sx#O5T#O#P:^#P#o5T#o#p:d#p~5TW8xT%jWOr8srs9Xs#O8s#O#P:W#P~8sW9[TOr8srs9ks#O8s#O#P:Q#P~8sW9nSOr8ss#O8s#O#P9z#P~8sW9}PO~8sW:TPO~8sW:ZPO~8s!n:aPO~5T!n:kX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p5T#p~;W[;_V%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P~;W[;yV%gSOr;Wrs<`sw;Wwx<zx#O;W#O#P>d#P~;W[<eV%gSOr;Wrs0xsw;Wwx<zx#O;W#O#P>^#P~;W[=PV%jWOr;Wrs;tsw;Wwx=fx#O;W#O#P>W#P~;W[=kV%jWOr;Wrs;tsw;Wwx8sx#O;W#O#P>Q#P~;W[>TPO~;W[>ZPO~;W[>aPO~;W[>gPO~;W[>mPO~;W!n>sPO~5T!n>}X%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p5T#p~;W!n?mPO~5T!n?wX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p5T#p~;W!n@gPO~5T!n@mPO~5T8z@uT%p7[O#o(y#o#p5T#p#q(y#q#r5T#r~(y8zAZT%p7[O#o(y#o#p5T#p#q(y#q#r5T#r~(y8zAqZ%p7[%jWOr(yrs)wsw(ywxBdx#O(y#O#PEx#P#o(y#o#p:d#p#q(y#q#r5T#r~(y7dBkX%p7[%jWOrBdrsCWs#OBd#O#PEd#P#oBd#o#p8s#p#qBd#q#r8s#r~Bd7dC]X%p7[OrBdrsCxs#OBd#O#PEO#P#oBd#o#p8s#p#qBd#q#r8s#r~Bd7dC}X%p7[OrBdrs-ws#OBd#O#PDj#P#oBd#o#p8s#p#qBd#q#r8s#r~Bd7dDoT%p7[O#oBd#o#p8s#p#qBd#q#r8s#r~Bd7dETT%p7[O#oBd#o#p8s#p#qBd#q#r8s#r~Bd7dEiT%p7[O#oBd#o#p8s#p#qBd#q#r8s#r~Bd8zE}T%p7[O#o(y#o#p5T#p#q(y#q#r5T#r~(y8zFcT%p7[O#o(y#o#p5T#p#q(y#q#r5T#r~(y9[FwT%p7[O#o'P#o#pGW#p#q'P#q#rGW#r~'P#OGcX%gS%jW%m`%v!bOrGWrsHOswGWwx7ax#OGW#O#PKz#P#oGW#o#pKQ#p~GW#OHXX%gS%m`%v!bOrGWrsHtswGWwx7ax#OGW#O#PKt#P#oGW#o#pKQ#p~GW#OH}X%gS%m`%v!bOrGWrsIjswGWwx7ax#OGW#O#PJz#P#oGW#o#pKQ#p~GW!vIsV%gS%m`%v!bOwIjwx/Xx#OIj#O#PJY#P#oIj#o#pJ`#p~Ij!vJ]PO~Ij!vJeV%gSOw0xwx1^x#O0x#O#P2]#P#o0x#o#pIj#p~0x#OJ}PO~GW#OKXX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#pGW#p~;W#OKwPO~GW#OK}PO~GW9[L]Z%p7[%gS%m`%v!bOr'PrsMOsw'Pwx(Px#O'P#O#PN[#P#o'P#o#pKQ#p#q'P#q#rGW#r~'P9SMZX%p7[%gS%m`%v!bOwMOwx,ex#OMO#O#PMv#P#oMO#o#pJ`#p#qMO#q#rIj#r~MO9SM{T%p7[O#oMO#o#pIj#p#qMO#q#rIj#r~MO9[NaT%p7[O#o'P#o#pGW#p#q'P#q#rGW#r~'P9[NuT%p7[O#o'P#o#pGW#p#q'P#q#rGW#r~'P<b! aZ%p7[%jW%sp%x#tOr!!Srs)wsw!!Swx!-Qx#O!!S#O#P!2l#P#o!!S#o#p!+d#p#q!!S#q#r!#j#r~!!S<b!!cZ%p7[%gS%jW%sp%v!b%x#tOr!!Srs)wsw!!Swx! Ux#O!!S#O#P!#U#P#o!!S#o#p!,^#p#q!!S#q#r!#j#r~!!S<b!#ZT%p7[O#o!!S#o#p!#j#p#q!!S#q#r!#j#r~!!S&U!#wX%gS%jW%sp%v!b%x#tOr!#jrs5ysw!#jwx!$dx#O!#j#O#P!,W#P#o!#j#o#p!,^#p~!#j&U!$mX%jW%sp%x#tOr!#jrs5ysw!#jwx!%Yx#O!#j#O#P!+^#P#o!#j#o#p!+d#p~!#j&U!%cX%jW%sp%x#tOr!#jrs5ysw!#jwx!&Ox#O!#j#O#P!*d#P#o!#j#o#p!*j#p~!#j$n!&XX%jW%sp%x#tOr!&trs9Xsw!&twx!&Ox#O!&t#O#P!)r#P#o!&t#o#p!)x#p~!&t$n!&}X%jW%sp%x#tOr!&trs9Xsw!&twx!'jx#O!&t#O#P!)Q#P#o!&t#o#p!)W#p~!&t$n!'sX%jW%sp%x#tOr!&trs9Xsw!&twx!&Ox#O!&t#O#P!(`#P#o!&t#o#p!(f#p~!&t$n!(cPO~!&t$n!(kV%jWOr8srs9Xs#O8s#O#P:W#P#o8s#o#p!&t#p~8s$n!)TPO~!&t$n!)]V%jWOr8srs9Xs#O8s#O#P:W#P#o8s#o#p!&t#p~8s$n!)uPO~!&t$n!)}V%jWOr8srs9Xs#O8s#O#P:W#P#o8s#o#p!&t#p~8s&U!*gPO~!#j&U!*qX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p!#j#p~;W&U!+aPO~!#j&U!+kX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p!#j#p~;W&U!,ZPO~!#j&U!,eX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p!#j#p~;W<b!-]Z%p7[%jW%sp%x#tOr!!Srs)wsw!!Swx!.Ox#O!!S#O#P!2W#P#o!!S#o#p!*j#p#q!!S#q#r!#j#r~!!S:z!.ZZ%p7[%jW%sp%x#tOr!.|rsCWsw!.|wx!.Ox#O!.|#O#P!1r#P#o!.|#o#p!)x#p#q!.|#q#r!&t#r~!.|:z!/XZ%p7[%jW%sp%x#tOr!.|rsCWsw!.|wx!/zx#O!.|#O#P!1^#P#o!.|#o#p!)W#p#q!.|#q#r!&t#r~!.|:z!0VZ%p7[%jW%sp%x#tOr!.|rsCWsw!.|wx!.Ox#O!.|#O#P!0x#P#o!.|#o#p!(f#p#q!.|#q#r!&t#r~!.|:z!0}T%p7[O#o!.|#o#p!&t#p#q!.|#q#r!&t#r~!.|:z!1cT%p7[O#o!.|#o#p!&t#p#q!.|#q#r!&t#r~!.|:z!1wT%p7[O#o!.|#o#p!&t#p#q!.|#q#r!&t#r~!.|<b!2]T%p7[O#o!!S#o#p!#j#p#q!!S#q#r!#j#r~!!S<b!2qT%p7[O#o!!S#o#p!#j#p#q!!S#q#r!#j#r~!!S<r!3VT%p7[O#o$}#o#p!3f#p#q$}#q#r!3f#r~$}&f!3uX%gS%jW%m`%sp%v!b%x#tOr!3frsHOsw!3fwx!$dx#O!3f#O#P!4b#P#o!3f#o#p!4h#p~!3f&f!4ePO~!3f&f!4oX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p!3f#p~;WMg!5oa%p7[%gS%jW$o1s%m`%sp%v!b%x#tOX$}XY!5[Y[$}[]!5[]p$}pq!5[qr$}rs&Rsw$}wx! Ux#O$}#O#P!6t#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Mg!6yX%p7[OY$}YZ!5[Z]$}]^!5[^#o$}#o#p!3f#p#q$}#q#r!3f#r~$}<u!7wb%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`!9P!`#O$}#O#P!3Q#P#T$}#T#U!:V#U#f$}#f#g!:V#g#h!:V#h#o$}#o#p!4h#p#q$}#q#r!3f#r~$}<u!9dZjR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}<u!:jZ!jR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{!;l_%tp%p7[%gS%e,X%m`%v!bOY!<kYZ'PZ]!<k]^'P^r!<krs#(ysw!<kwx!>yx#O!<k#O#P#+Z#P#o!<k#o#p#'w#p#q!<k#q#r#%s#r~!<kDe!<z_%p7[%gS%jW%e,X%m`%v!bOY!<kYZ'PZ]!<k]^'P^r!<krs!=ysw!<kwx!>yx#O!<k#O#P#%_#P#o!<k#o#p#'w#p#q!<k#q#r#%s#r~!<kDe!>WZ%p7[%gS%e,X%m`%v!bOr'PrsLQsw'Pwx(Px#O'P#O#PNp#P#o'P#o#pKQ#p#q'P#q#rGW#r~'PDT!?S_%p7[%jW%e,XOY!@RYZ(yZ]!@R]^(y^r!@Rrs!A_sw!@Rwx# Rx#O!@R#O#P#$y#P#o!@R#o#p!Lw#p#q!@R#q#r!Bq#r~!@RDT!@`_%p7[%gS%jW%e,X%v!bOY!@RYZ(yZ]!@R]^(y^r!@Rrs!A_sw!@Rwx!>yx#O!@R#O#P!B]#P#o!@R#o#p!NP#p#q!@R#q#r!Bq#r~!@RDT!AjZ%p7[%gS%e,X%v!bOr(yrs*ssw(ywx(Px#O(y#O#P@p#P#o(y#o#p?p#p#q(y#q#r5T#r~(yDT!BbT%p7[O#o!@R#o#p!Bq#p#q!@R#q#r!Bq#r~!@R-w!B|]%gS%jW%e,X%v!bOY!BqYZ5TZ]!Bq]^5T^r!Bqrs!Cusw!Bqwx!Dkx#O!Bq#O#P!My#P#o!Bq#o#p!NP#p~!Bq-w!DOX%gS%e,X%v!bOr5Trs6msw5Twx7ax#O5T#O#P@d#P#o5T#o#p?p#p~5T-w!Dr]%jW%e,XOY!BqYZ5TZ]!Bq]^5T^r!Bqrs!Cusw!Bqwx!Ekx#O!Bq#O#P!Lq#P#o!Bq#o#p!Lw#p~!Bq-w!Er]%jW%e,XOY!BqYZ5TZ]!Bq]^5T^r!Bqrs!Cusw!Bqwx!Fkx#O!Bq#O#P!Gy#P#o!Bq#o#p!HP#p~!Bq,a!FrX%jW%e,XOY!FkYZ8sZ]!Fk]^8s^r!Fkrs!G_s#O!Fk#O#P!Gs#P~!Fk,a!GdT%e,XOr8srs9ks#O8s#O#P:Q#P~8s,a!GvPO~!Fk-w!G|PO~!Bq-w!HY]%gS%jW%e,XOY!IRYZ;WZ]!IR]^;W^r!IRrs!I}sw!IRwx!Jkx#O!IR#O#P!Lk#P#o!IR#o#p!Bq#p~!IR,e!I[Z%gS%jW%e,XOY!IRYZ;WZ]!IR]^;W^r!IRrs!I}sw!IRwx!Jkx#O!IR#O#P!Lk#P~!IR,e!JUV%gS%e,XOr;Wrs<`sw;Wwx<zx#O;W#O#P>d#P~;W,e!JrZ%jW%e,XOY!IRYZ;WZ]!IR]^;W^r!IRrs!I}sw!IRwx!Kex#O!IR#O#P!Le#P~!IR,e!KlZ%jW%e,XOY!IRYZ;WZ]!IR]^;W^r!IRrs!I}sw!IRwx!Fkx#O!IR#O#P!L_#P~!IR,e!LbPO~!IR,e!LhPO~!IR,e!LnPO~!IR-w!LtPO~!Bq-w!MQ]%gS%jW%e,XOY!IRYZ;WZ]!IR]^;W^r!IRrs!I}sw!IRwx!Jkx#O!IR#O#P!Lk#P#o!IR#o#p!Bq#p~!IR-w!M|PO~!Bq-w!NY]%gS%jW%e,XOY!IRYZ;WZ]!IR]^;W^r!IRrs!I}sw!IRwx!Jkx#O!IR#O#P!Lk#P#o!IR#o#p!Bq#p~!IRDT# [_%p7[%jW%e,XOY!@RYZ(yZ]!@R]^(y^r!@Rrs!A_sw!@Rwx#!Zx#O!@R#O#P#$e#P#o!@R#o#p!HP#p#q!@R#q#r!Bq#r~!@RBm#!d]%p7[%jW%e,XOY#!ZYZBdZ]#!Z]^Bd^r#!Zrs##]s#O#!Z#O#P#$P#P#o#!Z#o#p!Fk#p#q#!Z#q#r!Fk#r~#!ZBm##dX%p7[%e,XOrBdrsCxs#OBd#O#PEO#P#oBd#o#p8s#p#qBd#q#r8s#r~BdBm#$UT%p7[O#o#!Z#o#p!Fk#p#q#!Z#q#r!Fk#r~#!ZDT#$jT%p7[O#o!@R#o#p!Bq#p#q!@R#q#r!Bq#r~!@RDT#%OT%p7[O#o!@R#o#p!Bq#p#q!@R#q#r!Bq#r~!@RDe#%dT%p7[O#o!<k#o#p#%s#p#q!<k#q#r#%s#r~!<k.X#&Q]%gS%jW%e,X%m`%v!bOY#%sYZGWZ]#%s]^GW^r#%srs#&ysw#%swx!Dkx#O#%s#O#P#'q#P#o#%s#o#p#'w#p~#%s.X#'UX%gS%e,X%m`%v!bOrGWrsHtswGWwx7ax#OGW#O#PKt#P#oGW#o#pKQ#p~GW.X#'tPO~#%s.X#(Q]%gS%jW%e,XOY!IRYZ;WZ]!IR]^;W^r!IRrs!I}sw!IRwx!Jkx#O!IR#O#P!Lk#P#o!IR#o#p#%s#p~!IRGZ#)WZ%p7[%gS%e,X%m`%v!bOr'Prs#)ysw'Pwx(Px#O'P#O#P#*u#P#o'P#o#pKQ#p#q'P#q#rGW#r~'PGZ#*YX%k#|%p7[%gS%i,X%m`%v!bOwMOwx,ex#OMO#O#PMv#P#oMO#o#pJ`#p#qMO#q#rIj#r~MO9[#*zT%p7[O#o'P#o#pGW#p#q'P#q#rGW#r~'PDe#+`T%p7[O#o!<k#o#p#%s#p#q!<k#q#r#%s#r~!<kMg#,S_Q1s%p7[%gS%jW%m`%sp%v!b%x#tOY#+oYZ$}Z]#+o]^$}^r#+ors#-Rsw#+owx$Bmx#O#+o#O#P%/o#P#o#+o#o#p%2R#p#q#+o#q#r%0c#r~#+oJP#-`_Q1s%p7[%gS%m`%v!bOY#._YZ'PZ]#._]^'P^r#._rs$>Psw#._wx#/mx#O#._#O#P$Ay#P#o#._#o#p$<T#p#q#._#q#r$6T#r~#._JP#.n_Q1s%p7[%gS%jW%m`%v!bOY#._YZ'PZ]#._]^'P^r#._rs#-Rsw#._wx#/mx#O#._#O#P$5a#P#o#._#o#p$<T#p#q#._#q#r$6T#r~#._Io#/v_Q1s%p7[%jWOY#0uYZ(yZ]#0u]^(y^r#0urs#2Rsw#0uwx$-ex#O#0u#O#P$4m#P#o#0u#o#p$(k#p#q#0u#q#r#Eg#r~#0uIo#1S_Q1s%p7[%gS%jW%v!bOY#0uYZ(yZ]#0u]^(y^r#0urs#2Rsw#0uwx#/mx#O#0u#O#P$,q#P#o#0u#o#p$*R#p#q#0u#q#r#Eg#r~#0uIo#2^_Q1s%p7[%gS%v!bOY#0uYZ(yZ]#0u]^(y^r#0urs#3]sw#0uwx#/mx#O#0u#O#P$+}#P#o#0u#o#p$*R#p#q#0u#q#r#Eg#r~#0uIo#3h_Q1s%p7[%gS%v!bOY#0uYZ(yZ]#0u]^(y^r#0urs#4gsw#0uwx#/mx#O#0u#O#P#Ds#P#o#0u#o#p$*R#p#q#0u#q#r#Eg#r~#0uIg#4r]Q1s%p7[%gS%v!bOY#4gYZ+oZ]#4g]^+o^w#4gwx#5kx#O#4g#O#P#DP#P#o#4g#o#p#Bc#p#q#4g#q#r#9a#r~#4gIg#5r]Q1s%p7[OY#4gYZ+oZ]#4g]^+o^w#4gwx#6kx#O#4g#O#P#C]#P#o#4g#o#p#AT#p#q#4g#q#r#9a#r~#4gIg#6r]Q1s%p7[OY#4gYZ+oZ]#4g]^+o^w#4gwx#7kx#O#4g#O#P#8m#P#o#4g#o#p#<a#p#q#4g#q#r#9a#r~#4gHP#7rXQ1s%p7[OY#7kYZ-wZ]#7k]^-w^#o#7k#o#p#8_#p#q#7k#q#r#8_#r~#7k1s#8dRQ1sOY#8_Z]#8_^~#8_Ig#8tXQ1s%p7[OY#4gYZ+oZ]#4g]^+o^#o#4g#o#p#9a#p#q#4g#q#r#9a#r~#4g3Z#9jZQ1s%gS%v!bOY#9aYZ.kZ]#9a]^.k^w#9awx#:]x#O#9a#O#P#A}#P#o#9a#o#p#Bc#p~#9a3Z#:bZQ1sOY#9aYZ.kZ]#9a]^.k^w#9awx#;Tx#O#9a#O#P#@o#P#o#9a#o#p#AT#p~#9a3Z#;YZQ1sOY#9aYZ.kZ]#9a]^.k^w#9awx#8_x#O#9a#O#P#;{#P#o#9a#o#p#<a#p~#9a3Z#<QTQ1sOY#9aYZ.kZ]#9a]^.k^~#9a3Z#<hZQ1s%gSOY#=ZYZ0xZ]#=Z]^0x^w#=Zwx#=}x#O#=Z#O#P#@Z#P#o#=Z#o#p#9a#p~#=Z1w#=bXQ1s%gSOY#=ZYZ0xZ]#=Z]^0x^w#=Zwx#=}x#O#=Z#O#P#@Z#P~#=Z1w#>SXQ1sOY#=ZYZ0xZ]#=Z]^0x^w#=Zwx#>ox#O#=Z#O#P#?u#P~#=Z1w#>tXQ1sOY#=ZYZ0xZ]#=Z]^0x^w#=Zwx#8_x#O#=Z#O#P#?a#P~#=Z1w#?fTQ1sOY#=ZYZ0xZ]#=Z]^0x^~#=Z1w#?zTQ1sOY#=ZYZ0xZ]#=Z]^0x^~#=Z1w#@`TQ1sOY#=ZYZ0xZ]#=Z]^0x^~#=Z3Z#@tTQ1sOY#9aYZ.kZ]#9a]^.k^~#9a3Z#A[ZQ1s%gSOY#=ZYZ0xZ]#=Z]^0x^w#=Zwx#=}x#O#=Z#O#P#@Z#P#o#=Z#o#p#9a#p~#=Z3Z#BSTQ1sOY#9aYZ.kZ]#9a]^.k^~#9a3Z#BjZQ1s%gSOY#=ZYZ0xZ]#=Z]^0x^w#=Zwx#=}x#O#=Z#O#P#@Z#P#o#=Z#o#p#9a#p~#=ZIg#CdXQ1s%p7[OY#4gYZ+oZ]#4g]^+o^#o#4g#o#p#9a#p#q#4g#q#r#9a#r~#4gIg#DWXQ1s%p7[OY#4gYZ+oZ]#4g]^+o^#o#4g#o#p#9a#p#q#4g#q#r#9a#r~#4gIo#DzXQ1s%p7[OY#0uYZ(yZ]#0u]^(y^#o#0u#o#p#Eg#p#q#0u#q#r#Eg#r~#0u3c#Er]Q1s%gS%jW%v!bOY#EgYZ5TZ]#Eg]^5T^r#Egrs#Fksw#Egwx#Hox#O#Eg#O#P$+i#P#o#Eg#o#p$*R#p~#Eg3c#Ft]Q1s%gS%v!bOY#EgYZ5TZ]#Eg]^5T^r#Egrs#Gmsw#Egwx#Hox#O#Eg#O#P$+T#P#o#Eg#o#p$*R#p~#Eg3c#Gv]Q1s%gS%v!bOY#EgYZ5TZ]#Eg]^5T^r#Egrs#9asw#Egwx#Hox#O#Eg#O#P$)m#P#o#Eg#o#p$*R#p~#Eg3c#Hv]Q1s%jWOY#EgYZ5TZ]#Eg]^5T^r#Egrs#Fksw#Egwx#Iox#O#Eg#O#P$(V#P#o#Eg#o#p$(k#p~#Eg3c#Iv]Q1s%jWOY#EgYZ5TZ]#Eg]^5T^r#Egrs#Fksw#Egwx#Jox#O#Eg#O#P#NT#P#o#Eg#o#p#Ni#p~#Eg1{#JvXQ1s%jWOY#JoYZ8sZ]#Jo]^8s^r#Jors#Kcs#O#Jo#O#P#Mo#P~#Jo1{#KhXQ1sOY#JoYZ8sZ]#Jo]^8s^r#Jors#LTs#O#Jo#O#P#MZ#P~#Jo1{#LYXQ1sOY#JoYZ8sZ]#Jo]^8s^r#Jors#8_s#O#Jo#O#P#Lu#P~#Jo1{#LzTQ1sOY#JoYZ8sZ]#Jo]^8s^~#Jo1{#M`TQ1sOY#JoYZ8sZ]#Jo]^8s^~#Jo1{#MtTQ1sOY#JoYZ8sZ]#Jo]^8s^~#Jo3c#NYTQ1sOY#EgYZ5TZ]#Eg]^5T^~#Eg3c#Nr]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p#Eg#p~$ k2P$ tZQ1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P~$ k2P$!nZQ1s%gSOY$ kYZ;WZ]$ k]^;W^r$ krs$#asw$ kwx$$Zx#O$ k#O#P$']#P~$ k2P$#hZQ1s%gSOY$ kYZ;WZ]$ k]^;W^r$ krs#=Zsw$ kwx$$Zx#O$ k#O#P$&w#P~$ k2P$$bZQ1s%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$%Tx#O$ k#O#P$&c#P~$ k2P$%[ZQ1s%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx#Jox#O$ k#O#P$%}#P~$ k2P$&STQ1sOY$ kYZ;WZ]$ k]^;W^~$ k2P$&hTQ1sOY$ kYZ;WZ]$ k]^;W^~$ k2P$&|TQ1sOY$ kYZ;WZ]$ k]^;W^~$ k2P$'bTQ1sOY$ kYZ;WZ]$ k]^;W^~$ k2P$'vTQ1sOY$ kYZ;WZ]$ k]^;W^~$ k3c$([TQ1sOY#EgYZ5TZ]#Eg]^5T^~#Eg3c$(t]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p#Eg#p~$ k3c$)rTQ1sOY#EgYZ5TZ]#Eg]^5T^~#Eg3c$*[]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p#Eg#p~$ k3c$+YTQ1sOY#EgYZ5TZ]#Eg]^5T^~#Eg3c$+nTQ1sOY#EgYZ5TZ]#Eg]^5T^~#EgIo$,UXQ1s%p7[OY#0uYZ(yZ]#0u]^(y^#o#0u#o#p#Eg#p#q#0u#q#r#Eg#r~#0uIo$,xXQ1s%p7[OY#0uYZ(yZ]#0u]^(y^#o#0u#o#p#Eg#p#q#0u#q#r#Eg#r~#0uIo$-n_Q1s%p7[%jWOY#0uYZ(yZ]#0u]^(y^r#0urs#2Rsw#0uwx$.mx#O#0u#O#P$3y#P#o#0u#o#p#Ni#p#q#0u#q#r#Eg#r~#0uHX$.v]Q1s%p7[%jWOY$.mYZBdZ]$.m]^Bd^r$.mrs$/os#O$.m#O#P$3V#P#o$.m#o#p#Jo#p#q$.m#q#r#Jo#r~$.mHX$/v]Q1s%p7[OY$.mYZBdZ]$.m]^Bd^r$.mrs$0os#O$.m#O#P$2c#P#o$.m#o#p#Jo#p#q$.m#q#r#Jo#r~$.mHX$0v]Q1s%p7[OY$.mYZBdZ]$.m]^Bd^r$.mrs#7ks#O$.m#O#P$1o#P#o$.m#o#p#Jo#p#q$.m#q#r#Jo#r~$.mHX$1vXQ1s%p7[OY$.mYZBdZ]$.m]^Bd^#o$.m#o#p#Jo#p#q$.m#q#r#Jo#r~$.mHX$2jXQ1s%p7[OY$.mYZBdZ]$.m]^Bd^#o$.m#o#p#Jo#p#q$.m#q#r#Jo#r~$.mHX$3^XQ1s%p7[OY$.mYZBdZ]$.m]^Bd^#o$.m#o#p#Jo#p#q$.m#q#r#Jo#r~$.mIo$4QXQ1s%p7[OY#0uYZ(yZ]#0u]^(y^#o#0u#o#p#Eg#p#q#0u#q#r#Eg#r~#0uIo$4tXQ1s%p7[OY#0uYZ(yZ]#0u]^(y^#o#0u#o#p#Eg#p#q#0u#q#r#Eg#r~#0uJP$5hXQ1s%p7[OY#._YZ'PZ]#._]^'P^#o#._#o#p$6T#p#q#._#q#r$6T#r~#._3s$6b]Q1s%gS%jW%m`%v!bOY$6TYZGWZ]$6T]^GW^r$6Trs$7Zsw$6Twx#Hox#O$6T#O#P$=k#P#o$6T#o#p$<T#p~$6T3s$7f]Q1s%gS%m`%v!bOY$6TYZGWZ]$6T]^GW^r$6Trs$8_sw$6Twx#Hox#O$6T#O#P$=V#P#o$6T#o#p$<T#p~$6T3s$8j]Q1s%gS%m`%v!bOY$6TYZGWZ]$6T]^GW^r$6Trs$9csw$6Twx#Hox#O$6T#O#P$;o#P#o$6T#o#p$<T#p~$6T3k$9nZQ1s%gS%m`%v!bOY$9cYZIjZ]$9c]^Ij^w$9cwx#:]x#O$9c#O#P$:a#P#o$9c#o#p$:u#p~$9c3k$:fTQ1sOY$9cYZIjZ]$9c]^Ij^~$9c3k$:|ZQ1s%gSOY#=ZYZ0xZ]#=Z]^0x^w#=Zwx#=}x#O#=Z#O#P#@Z#P#o#=Z#o#p$9c#p~#=Z3s$;tTQ1sOY$6TYZGWZ]$6T]^GW^~$6T3s$<^]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p$6T#p~$ k3s$=[TQ1sOY$6TYZGWZ]$6T]^GW^~$6T3s$=pTQ1sOY$6TYZGWZ]$6T]^GW^~$6TJP$>^_Q1s%p7[%gS%m`%v!bOY#._YZ'PZ]#._]^'P^r#._rs$?]sw#._wx#/mx#O#._#O#P$AV#P#o#._#o#p$<T#p#q#._#q#r$6T#r~#._Iw$?j]Q1s%p7[%gS%m`%v!bOY$?]YZMOZ]$?]]^MO^w$?]wx#5kx#O$?]#O#P$@c#P#o$?]#o#p$:u#p#q$?]#q#r$9c#r~$?]Iw$@jXQ1s%p7[OY$?]YZMOZ]$?]]^MO^#o$?]#o#p$9c#p#q$?]#q#r$9c#r~$?]JP$A^XQ1s%p7[OY#._YZ'PZ]#._]^'P^#o#._#o#p$6T#p#q#._#q#r$6T#r~#._JP$BQXQ1s%p7[OY#._YZ'PZ]#._]^'P^#o#._#o#p$6T#p#q#._#q#r$6T#r~#._MV$Bz_Q1s%p7[%jW%sp%x#tOY$CyYZ!!SZ]$Cy]^!!S^r$Cyrs#2Rsw$Cywx%&{x#O$Cy#O#P%.{#P#o$Cy#o#p%$c#p#q$Cy#q#r$E}#r~$CyMV$D[_Q1s%p7[%gS%jW%sp%v!b%x#tOY$CyYZ!!SZ]$Cy]^!!S^r$Cyrs#2Rsw$Cywx$Bmx#O$Cy#O#P$EZ#P#o$Cy#o#p%%y#p#q$Cy#q#r$E}#r~$CyMV$EbXQ1s%p7[OY$CyYZ!!SZ]$Cy]^!!S^#o$Cy#o#p$E}#p#q$Cy#q#r$E}#r~$Cy6y$F^]Q1s%gS%jW%sp%v!b%x#tOY$E}YZ!#jZ]$E}]^!#j^r$E}rs#Fksw$E}wx$GVx#O$E}#O#P%%e#P#o$E}#o#p%%y#p~$E}6y$Gb]Q1s%jW%sp%x#tOY$E}YZ!#jZ]$E}]^!#j^r$E}rs#Fksw$E}wx$HZx#O$E}#O#P%#}#P#o$E}#o#p%$c#p~$E}6y$Hf]Q1s%jW%sp%x#tOY$E}YZ!#jZ]$E}]^!#j^r$E}rs#Fksw$E}wx$I_x#O$E}#O#P%!g#P#o$E}#o#p%!{#p~$E}5c$Ij]Q1s%jW%sp%x#tOY$JcYZ!&tZ]$Jc]^!&t^r$Jcrs#Kcsw$Jcwx$I_x#O$Jc#O#P% X#P#o$Jc#o#p% m#p~$Jc5c$Jn]Q1s%jW%sp%x#tOY$JcYZ!&tZ]$Jc]^!&t^r$Jcrs#Kcsw$Jcwx$Kgx#O$Jc#O#P$My#P#o$Jc#o#p$N_#p~$Jc5c$Kr]Q1s%jW%sp%x#tOY$JcYZ!&tZ]$Jc]^!&t^r$Jcrs#Kcsw$Jcwx$I_x#O$Jc#O#P$Lk#P#o$Jc#o#p$MP#p~$Jc5c$LpTQ1sOY$JcYZ!&tZ]$Jc]^!&t^~$Jc5c$MWZQ1s%jWOY#JoYZ8sZ]#Jo]^8s^r#Jors#Kcs#O#Jo#O#P#Mo#P#o#Jo#o#p$Jc#p~#Jo5c$NOTQ1sOY$JcYZ!&tZ]$Jc]^!&t^~$Jc5c$NfZQ1s%jWOY#JoYZ8sZ]#Jo]^8s^r#Jors#Kcs#O#Jo#O#P#Mo#P#o#Jo#o#p$Jc#p~#Jo5c% ^TQ1sOY$JcYZ!&tZ]$Jc]^!&t^~$Jc5c% tZQ1s%jWOY#JoYZ8sZ]#Jo]^8s^r#Jors#Kcs#O#Jo#O#P#Mo#P#o#Jo#o#p$Jc#p~#Jo6y%!lTQ1sOY$E}YZ!#jZ]$E}]^!#j^~$E}6y%#U]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p$E}#p~$ k6y%$STQ1sOY$E}YZ!#jZ]$E}]^!#j^~$E}6y%$l]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p$E}#p~$ k6y%%jTQ1sOY$E}YZ!#jZ]$E}]^!#j^~$E}6y%&S]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p$E}#p~$ kMV%'Y_Q1s%p7[%jW%sp%x#tOY$CyYZ!!SZ]$Cy]^!!S^r$Cyrs#2Rsw$Cywx%(Xx#O$Cy#O#P%.X#P#o$Cy#o#p%!{#p#q$Cy#q#r$E}#r~$CyKo%(f_Q1s%p7[%jW%sp%x#tOY%)eYZ!.|Z]%)e]^!.|^r%)ers$/osw%)ewx%(Xx#O%)e#O#P%-e#P#o%)e#o#p% m#p#q%)e#q#r$Jc#r~%)eKo%)r_Q1s%p7[%jW%sp%x#tOY%)eYZ!.|Z]%)e]^!.|^r%)ers$/osw%)ewx%*qx#O%)e#O#P%,q#P#o%)e#o#p$N_#p#q%)e#q#r$Jc#r~%)eKo%+O_Q1s%p7[%jW%sp%x#tOY%)eYZ!.|Z]%)e]^!.|^r%)ers$/osw%)ewx%(Xx#O%)e#O#P%+}#P#o%)e#o#p$MP#p#q%)e#q#r$Jc#r~%)eKo%,UXQ1s%p7[OY%)eYZ!.|Z]%)e]^!.|^#o%)e#o#p$Jc#p#q%)e#q#r$Jc#r~%)eKo%,xXQ1s%p7[OY%)eYZ!.|Z]%)e]^!.|^#o%)e#o#p$Jc#p#q%)e#q#r$Jc#r~%)eKo%-lXQ1s%p7[OY%)eYZ!.|Z]%)e]^!.|^#o%)e#o#p$Jc#p#q%)e#q#r$Jc#r~%)eMV%.`XQ1s%p7[OY$CyYZ!!SZ]$Cy]^!!S^#o$Cy#o#p$E}#p#q$Cy#q#r$E}#r~$CyMV%/SXQ1s%p7[OY$CyYZ!!SZ]$Cy]^!!S^#o$Cy#o#p$E}#p#q$Cy#q#r$E}#r~$CyMg%/vXQ1s%p7[OY#+oYZ$}Z]#+o]^$}^#o#+o#o#p%0c#p#q#+o#q#r%0c#r~#+o7Z%0t]Q1s%gS%jW%m`%sp%v!b%x#tOY%0cYZ!3fZ]%0c]^!3f^r%0crs$7Zsw%0cwx$GVx#O%0c#O#P%1m#P#o%0c#o#p%2R#p~%0c7Z%1rTQ1sOY%0cYZ!3fZ]%0c]^!3f^~%0c7Z%2[]Q1s%gS%jWOY$ kYZ;WZ]$ k]^;W^r$ krs$!gsw$ kwx$$Zx#O$ k#O#P$'q#P#o$ k#o#p%0c#p~$ kGz%3h]$}Q%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gz%4tZ!s,W%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gz%5z]$wQ%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{%7S_%q`%p7[%jW%e,X%sp%x#tOY%8RYZ!!SZ]%8R]^!!S^r%8Rrs%9csw%8Rwx&$}x#O%8R#O#P&(X#P#o%8R#o#p&(m#p#q%8R#q#r& u#r~%8RGk%8d_%p7[%gS%jW%e,X%sp%v!b%x#tOY%8RYZ!!SZ]%8R]^!!S^r%8Rrs%9csw%8Rwx%Nax#O%8R#O#P& a#P#o%8R#o#p&#{#p#q%8R#q#r& u#r~%8RDT%9n_%p7[%gS%e,X%v!bOY%:mYZ(yZ]%:m]^(y^r%:mrs%JPsw%:mwx%;yx#O%:m#O#P%M{#P#o%:m#o#p%ER#p#q%:m#q#r%=Z#r~%:mDT%:z_%p7[%gS%jW%e,X%v!bOY%:mYZ(yZ]%:m]^(y^r%:mrs%9csw%:mwx%;yx#O%:m#O#P%<u#P#o%:m#o#p%ER#p#q%:m#q#r%=Z#r~%:mDT%<SZ%p7[%jW%e,XOr(yrs)wsw(ywxAjx#O(y#O#PF^#P#o(y#o#p>v#p#q(y#q#r5T#r~(yDT%<zT%p7[O#o%:m#o#p%=Z#p#q%:m#q#r%=Z#r~%:m-w%=f]%gS%jW%e,X%v!bOY%=ZYZ5TZ]%=Z]^5T^r%=Zrs%>_sw%=Zwx%DXx#O%=Z#O#P%Iy#P#o%=Z#o#p%ER#p~%=Z-w%>h]%gS%e,X%v!bOY%=ZYZ5TZ]%=Z]^5T^r%=Zrs%?asw%=Zwx%DXx#O%=Z#O#P%Is#P#o%=Z#o#p%ER#p~%=Z-w%?j]%gS%e,X%v!bOY%=ZYZ5TZ]%=Z]^5T^r%=Zrs%@csw%=Zwx%DXx#O%=Z#O#P%D{#P#o%=Z#o#p%ER#p~%=Z-o%@lZ%gS%e,X%v!bOY%@cYZ.kZ]%@c]^.k^w%@cwx%A_x#O%@c#O#P%Ay#P#o%@c#o#p%BP#p~%@c-o%AdV%e,XOw.kwx/qx#O.k#O#P2c#P#o.k#o#p2i#p~.k-o%A|PO~%@c-o%BWZ%gS%e,XOY%ByYZ0xZ]%By]^0x^w%Bywx%Cmx#O%By#O#P%DR#P#o%By#o#p%@c#p~%By,]%CQX%gS%e,XOY%ByYZ0xZ]%By]^0x^w%Bywx%Cmx#O%By#O#P%DR#P~%By,]%CrT%e,XOw0xwx1px#O0x#O#P2V#P~0x,]%DUPO~%By-w%D`X%jW%e,XOr5Trs5ysw5Twx8Rx#O5T#O#P>p#P#o5T#o#p>v#p~5T-w%EOPO~%=Z-w%E[]%gS%jW%e,XOY%FTYZ;WZ]%FT]^;W^r%FTrs%GPsw%FTwx%Hsx#O%FT#O#P%Im#P#o%FT#o#p%=Z#p~%FT,e%F^Z%gS%jW%e,XOY%FTYZ;WZ]%FT]^;W^r%FTrs%GPsw%FTwx%Hsx#O%FT#O#P%Im#P~%FT,e%GWZ%gS%e,XOY%FTYZ;WZ]%FT]^;W^r%FTrs%Gysw%FTwx%Hsx#O%FT#O#P%Ig#P~%FT,e%HQZ%gS%e,XOY%FTYZ;WZ]%FT]^;W^r%FTrs%Bysw%FTwx%Hsx#O%FT#O#P%Ia#P~%FT,e%HzV%jW%e,XOr;Wrs;tsw;Wwx=fx#O;W#O#P>W#P~;W,e%IdPO~%FT,e%IjPO~%FT,e%IpPO~%FT-w%IvPO~%=Z-w%I|PO~%=ZDT%J[_%p7[%gS%e,X%v!bOY%:mYZ(yZ]%:m]^(y^r%:mrs%KZsw%:mwx%;yx#O%:m#O#P%Mg#P#o%:m#o#p%ER#p#q%:m#q#r%=Z#r~%:mC{%Kf]%p7[%gS%e,X%v!bOY%KZYZ+oZ]%KZ]^+o^w%KZwx%L_x#O%KZ#O#P%MR#P#o%KZ#o#p%BP#p#q%KZ#q#r%@c#r~%KZC{%LfX%p7[%e,XOw+owx-Vx#O+o#O#P3u#P#o+o#o#p2i#p#q+o#q#r.k#r~+oC{%MWT%p7[O#o%KZ#o#p%@c#p#q%KZ#q#r%@c#r~%KZDT%MlT%p7[O#o%:m#o#p%=Z#p#q%:m#q#r%=Z#r~%:mDT%NQT%p7[O#o%:m#o#p%=Z#p#q%:m#q#r%=Z#r~%:mGk%NnZ%p7[%jW%e,X%sp%x#tOr!!Srs)wsw!!Swx!-Qx#O!!S#O#P!2l#P#o!!S#o#p!+d#p#q!!S#q#r!#j#r~!!SGk& fT%p7[O#o%8R#o#p& u#p#q%8R#q#r& u#r~%8R1_&!U]%gS%jW%e,X%sp%v!b%x#tOY& uYZ!#jZ]& u]^!#j^r& urs%>_sw& uwx&!}x#O& u#O#P&#u#P#o& u#o#p&#{#p~& u1_&#YX%jW%e,X%sp%x#tOr!#jrs5ysw!#jwx!%Yx#O!#j#O#P!+^#P#o!#j#o#p!+d#p~!#j1_&#xPO~& u1_&$U]%gS%jW%e,XOY%FTYZ;WZ]%FT]^;W^r%FTrs%GPsw%FTwx%Hsx#O%FT#O#P%Im#P#o%FT#o#p& u#p~%FTGk&%[Z%p7[%jW%e,X%sp%x#tOr!!Srs)wsw!!Swx&%}x#O!!S#O#P&'P#P#o!!S#o#p&'e#p#q!!S#q#r!#j#r~!!SGk&&^Z%h!f%p7[%jW%f,X%sp%x#tOr!.|rsCWsw!.|wx!.Ox#O!.|#O#P!1r#P#o!.|#o#p!)x#p#q!.|#q#r!&t#r~!.|<b&'UT%p7[O#o!!S#o#p!#j#p#q!!S#q#r!#j#r~!!S&U&'lX%gS%jWOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p!#j#p~;WGk&(^T%p7[O#o%8R#o#p& u#p#q%8R#q#r& u#r~%8R1_&(v]%gS%jW%e,XOY%FTYZ;WZ]%FT]^;W^r%FTrs%GPsw%FTwx%Hsx#O%FT#O#P%Im#P#o%FT#o#p& u#p~%FTG{&*SZf,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}<u&+YZ!OR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{&,`_T,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Uxz$}z{&-_{!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{&-r]_R%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{&/O]$z,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}<u&0[ZwR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Mg&1b^${,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`!a&2^!a#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}B^&2qZ&S&j%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{&3w_!dQ%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!O$}!O!P&4v!P!Q$}!Q![&7W![#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{&5X]%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!O$}!O!P&6Q!P#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{&6eZ!m,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&7kg!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q![&7W![!g$}!g!h&9S!h!l$}!l!m&=d!m#O$}#O#P!3Q#P#R$}#R#S&7W#S#X$}#X#Y&9S#Y#^$}#^#_&=d#_#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&9ea%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux{$}{|&:j|}$}}!O&:j!O!Q$}!Q![&;t![#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&:{]%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q![&;t![#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&<Xc!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q![&;t![!l$}!l!m&=d!m#O$}#O#P!3Q#P#R$}#R#S&;t#S#^$}#^#_&=d#_#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&=wZ!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{&>}_$|R%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!P$}!P!Q&?|!Q!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gz&@a]%OQ%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&Amu!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!O$}!O!P&DQ!P!Q$}!Q![&GW![!d$}!d!e&IY!e!g$}!g!h&9S!h!l$}!l!m&=d!m!q$}!q!r&LS!r!z$}!z!{&Nv!{#O$}#O#P!3Q#P#R$}#R#S&GW#S#U$}#U#V&IY#V#X$}#X#Y&9S#Y#^$}#^#_&=d#_#c$}#c#d&LS#d#l$}#l#m&Nv#m#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&Dc]%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q![&E[![#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&Eog!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q![&E[![!g$}!g!h&9S!h!l$}!l!m&=d!m#O$}#O#P!3Q#P#R$}#R#S&E[#S#X$}#X#Y&9S#Y#^$}#^#_&=d#_#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&Gki!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!O$}!O!P&DQ!P!Q$}!Q![&GW![!g$}!g!h&9S!h!l$}!l!m&=d!m#O$}#O#P!3Q#P#R$}#R#S&GW#S#X$}#X#Y&9S#Y#^$}#^#_&=d#_#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&Ik`%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q!R&Jm!R!S&Jm!S#O$}#O#P!3Q#P#R$}#R#S&Jm#S#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&KQ`!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q!R&Jm!R!S&Jm!S#O$}#O#P!3Q#P#R$}#R#S&Jm#S#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&Le_%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q!Y&Md!Y#O$}#O#P!3Q#P#R$}#R#S&Md#S#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy&Mw_!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q!Y&Md!Y#O$}#O#P!3Q#P#R$}#R#S&Md#S#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy' Xc%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q!['!d![!c$}!c!i'!d!i#O$}#O#P!3Q#P#R$}#R#S'!d#S#T$}#T#Z'!d#Z#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy'!wc!f,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!Q$}!Q!['!d![!c$}!c!i'!d!i#O$}#O#P!3Q#P#R$}#R#S'!d#S#T$}#T#Z'!d#Z#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Mg'$g]x1s%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`'%`!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}<u'%sZ%WR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{'&yZ#^,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{'(P_jR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!^$}!^!_')O!_!`!9P!`!a!9P!a#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gz')c]$xQ%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{'*o]%V,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`!9P!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{'+{^jR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`!9P!`!a',w!a#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gz'-[]$yQ%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}G{'.j]]Q#tP%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Mg'/xc%p7[%gS%jW%d&j%m`%sp%v!b%x#t%Q,XOr$}rs&Rsw$}wx! Ux!Q$}!Q!['/c![!c$}!c!}'/c!}#O$}#O#P!3Q#P#R$}#R#S'/c#S#T$}#T#o'/c#o#p!4h#p#q$}#q#r!3f#r$g$}$g~'/cMg'1jg%p7[%gS%jW%d&j%m`%sp%v!b%x#t%Q,XOr$}rs'3Rsw$}wx'6mx!Q$}!Q!['/c![!c$}!c!t'/c!t!u';a!u!}'/c!}#O$}#O#P!3Q#P#R$}#R#S'/c#S#T$}#T#f'/c#f#g';a#g#o'/c#o#p!4h#p#q$}#q#r!3f#r$g$}$g~'/cDe'3`_%p7[%gS%e,X%m`%v!bOY!<kYZ'PZ]!<k]^'P^r!<krs'4_sw!<kwx!>yx#O!<k#O#P'6X#P#o!<k#o#p#'w#p#q!<k#q#r#%s#r~!<kDe'4lZ%p7[%gS%e,X%m`%v!bOr'Prs'5_sw'Pwx(Px#O'P#O#PN[#P#o'P#o#pKQ#p#q'P#q#rGW#r~'PD]'5lX%p7[%gS%i,X%m`%v!bOwMOwx,ex#OMO#O#PMv#P#oMO#o#pJ`#p#qMO#q#rIj#r~MODe'6^T%p7[O#o!<k#o#p#%s#p#q!<k#q#r#%s#r~!<kGk'6z_%p7[%jW%e,X%sp%x#tOY%8RYZ!!SZ]%8R]^!!S^r%8Rrs%9csw%8Rwx'7yx#O%8R#O#P'9y#P#o%8R#o#p':_#p#q%8R#q#r& u#r~%8RGk'8WZ%p7[%jW%e,X%sp%x#tOr!!Srs)wsw!!Swx'8yx#O!!S#O#P!2W#P#o!!S#o#p!*j#p#q!!S#q#r!#j#r~!!SFT'9WZ%p7[%jW%f,X%sp%x#tOr!.|rsCWsw!.|wx!.Ox#O!.|#O#P!1r#P#o!.|#o#p!)x#p#q!.|#q#r!&t#r~!.|Gk':OT%p7[O#o%8R#o#p& u#p#q%8R#q#r& u#r~%8R1_':h]%gS%jW%e,XOY%FTYZ;WZ]%FT]^;W^r%FTrs%GPsw%FTwx%Hsx#O%FT#O#P%Im#P#o%FT#o#p& u#p~%FTMg';vc%p7[%gS%jW%d&j%m`%sp%v!b%x#t%Q,XOr$}rs'3Rsw$}wx'6mx!Q$}!Q!['/c![!c$}!c!}'/c!}#O$}#O#P!3Q#P#R$}#R#S'/c#S#T$}#T#o'/c#o#p!4h#p#q$}#q#r!3f#r$g$}$g~'/cMg'=hg%p7[%gS%jW%d&j%m`%sp%v!b%x#t%Q,XOr$}rs'?Psw$}wx'Awx!Q$}!Q!['/c![!c$}!c!t'/c!t!u'Du!u!}'/c!}#O$}#O#P!3Q#P#R$}#R#S'/c#S#T$}#T#f'/c#f#g'Du#g#o'/c#o#p!4h#p#q$}#q#r!3f#r$g$}$g~'/cDe'?^Z%p7[%gS%m`%v!b%r,XOr'Prs'@Psw'Pwx(Px#O'P#O#PNp#P#o'P#o#pKQ#p#q'P#q#rGW#r~'PDe'@[Z%p7[%gS%m`%v!bOr'Prs'@}sw'Pwx(Px#O'P#O#PN[#P#o'P#o#pKQ#p#q'P#q#rGW#r~'PD]'A[X%p7[%gS%w,X%m`%v!bOwMOwx,ex#OMO#O#PMv#P#oMO#o#pJ`#p#qMO#q#rIj#r~MOGk'BUZ%p7[%jW%sp%x#t%l,XOr!!Srs)wsw!!Swx'Bwx#O!!S#O#P!2l#P#o!!S#o#p!+d#p#q!!S#q#r!#j#r~!!SGk'CSZ%p7[%jW%sp%x#tOr!!Srs)wsw!!Swx'Cux#O!!S#O#P!2W#P#o!!S#o#p!*j#p#q!!S#q#r!#j#r~!!SFT'DSZ%p7[%jW%u,X%sp%x#tOr!.|rsCWsw!.|wx!.Ox#O!.|#O#P!1r#P#o!.|#o#p!)x#p#q!.|#q#r!&t#r~!.|Mg'E[c%p7[%gS%jW%d&j%m`%sp%v!b%x#t%Q,XOr$}rs'?Psw$}wx'Awx!Q$}!Q!['/c![!c$}!c!}'/c!}#O$}#O#P!3Q#P#R$}#R#S'/c#S#T$}#T#o'/c#o#p!4h#p#q$}#q#r!3f#r$g$}$g~'/cMg'F|k%p7[%gS%jW%d&j%m`%sp%v!b%x#t%Q,XOr$}rs'3Rsw$}wx'6mx!Q$}!Q!['/c![!c$}!c!h'/c!h!i'Du!i!t'/c!t!u';a!u!}'/c!}#O$}#O#P!3Q#P#R$}#R#S'/c#S#T$}#T#U'/c#U#V';a#V#Y'/c#Y#Z'Du#Z#o'/c#o#p!4h#p#q$}#q#r!3f#r$g$}$g~'/cG{'IUZ!V,X%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Mg'I|X%p7[OY$}YZ!5[Z]$}]^!5[^#o$}#o#p!3f#p#q$}#q#r!3f#r~$}<u'J|Z!WR%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gz'LS]$vQ%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}Gy'MUX%gS%jW!ZGmOr;Wrs;tsw;Wwx<zx#O;W#O#P>j#P#o;W#o#p!3f#p~;WGz'NU]$uQ%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux!_$}!_!`%4a!`#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}<u( `X![7_%gS%jW%m`%sp%v!b%x#tOr!3frsHOsw!3fwx!$dx#O!3f#O#P!4b#P#o!3f#o#p!4h#p~!3fGy(!`Z%P,V%p7[%gS%jW%m`%sp%v!b%x#tOr$}rs&Rsw$}wx! Ux#O$}#O#P!3Q#P#o$}#o#p!4h#p#q$}#q#r!3f#r~$}",
  tokenizers: [legacyPrint, indentation, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, newlines],
  topRules: {"Script":[0,3]},
  specialized: [{term: 186, get: value => spec_identifier[value] || -1}],
  tokenPrec: 6594
});

/// A language provider based on the [Lezer Python
/// parser](https://github.com/lezer-parser/python), extended with
/// highlighting and indentation information.
const pythonLanguage = LezerLanguage.define({
    parser: parser.configure({
        props: [
            indentNodeProp.add({
                Body: continuedIndent()
            }),
            foldNodeProp.add({
                "Body ArrayExpression DictionaryExpression": foldInside
            }),
            styleTags({
                "async '*' '**' FormatConversion": tags.modifier,
                "for while if elif else try except finally return raise break continue with pass assert await yield": tags.controlKeyword,
                "in not and or is del": tags.operatorKeyword,
                "import from def class global nonlocal lambda": tags.definitionKeyword,
                "with as print": tags.keyword,
                self: tags.self,
                Boolean: tags.bool,
                None: tags.null,
                VariableName: tags.variableName,
                "CallExpression/VariableName": tags.function(tags.variableName),
                "FunctionDefinition/VariableName": tags.function(tags.definition(tags.variableName)),
                "ClassDefinition/VariableName": tags.definition(tags.className),
                PropertyName: tags.propertyName,
                "CallExpression/MemberExpression/ProperyName": tags.function(tags.propertyName),
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
            })
        ],
    }),
    languageData: {
        closeBrackets: { brackets: ["(", "[", "{", "'", '"', "'''", '"""'] },
        commentTokens: { line: "#" },
        indentOnInput: /^\s*[\}\]\)]$/
    }
});
/// Python language support.
function python() {
    return new LanguageSupport(pythonLanguage);
}

export { python };
