/*
 * CircuitPython Worker Proxy
 *
 * This runs on the main thread and provides the same API as loadCircuitPython()
 * but routes all calls through a Web Worker for non-blocking execution.
 */

export async function loadCircuitPythonWorker(options) {
    const workerURL = new URL('./circuitpython-worker.js', import.meta.url);
    const worker = new Worker(workerURL, { type: 'module' });

    let nextMessageId = 0;
    const pendingMessages = new Map();

    // Extract callbacks from options (can't be cloned to worker)
    let stdoutCallback = options.stdout || ((data) => console.log(data));
    let stderrCallback = options.stderr || ((data) => console.error(data));

    // GPIO update callbacks
    const gpioUpdateCallbacks = new Set();

    // Handle messages from worker
    worker.onmessage = function(e) {
        const { type, id, result, error, data } = e.data;

        switch (type) {
            case 'stdout':
                // Call the user-provided callback on main thread
                stdoutCallback(data);
                break;

            case 'stderr':
                // Call the user-provided callback on main thread
                stderrCallback(data);
                break;

            case 'gpio-update':
                // GPIO state changed - notify all registered callbacks
                const { pin, direction, value } = e.data;
                for (const callback of gpioUpdateCallbacks) {
                    try {
                        callback({ pin, direction, value });
                    } catch (err) {
                        console.error('[Main] GPIO update callback error:', err);
                    }
                }
                break;

            case 'worker-loaded':
                console.log('[Main] Worker loaded');
                break;

            case 'ready':
                console.log('[Main] CircuitPython ready in worker');
                break;

            case 'result':
                if (pendingMessages.has(id)) {
                    const { resolve } = pendingMessages.get(id);
                    pendingMessages.delete(id);
                    resolve(result);
                }
                break;

            case 'error':
                if (pendingMessages.has(id)) {
                    const { reject } = pendingMessages.get(id);
                    pendingMessages.delete(id);
                    const err = new Error(error.message);
                    err.stack = error.stack;
                    err.name = error.name;
                    reject(err);
                } else {
                    console.error('[Main] Unhandled worker error:', error);
                }
                break;

            default:
                console.warn('[Main] Unknown message type from worker:', type);
        }
    };

    worker.onerror = function(error) {
        console.error('[Main] Worker error:', error);
    };

    // Helper to send a message and wait for response
    function sendMessage(type, params = {}) {
        return new Promise((resolve, reject) => {
            const id = nextMessageId++;
            pendingMessages.set(id, { resolve, reject });
            worker.postMessage({ type, id, ...params });
        });
    }

    // Create options object without callbacks (can't be cloned)
    const workerOptions = {
        heapsize: options.heapsize,
        pystack: options.pystack,
        linebuffer: options.linebuffer,
        verbose: options.verbose,
        filesystem: options.filesystem,
        autoRun: options.autoRun,
        // Don't pass stdout/stderr - worker will post messages instead
    };

    // Initialize the worker
    await sendMessage('init', { options: workerOptions });

    // Return the same API shape as loadCircuitPython()
    return {
        _worker: worker,

        runPython(code) {
            return sendMessage('runPython', { code });
        },

        replInit() {
            return sendMessage('replInit');
        },

        replProcessChar(char) {
            return sendMessage('replProcessChar', { char });
        },

        async saveFile(path, content) {
            return sendMessage('writeFile', { path, content });
        },

        async readFile(path) {
            return sendMessage('readFile', { path });
        },

        runFile(path) {
            return sendMessage('runFile', { path });
        },

        fileExists(path) {
            return sendMessage('fileExists', { path });
        },

        listDir(path) {
            return sendMessage('listDir', { path });
        },

        makeDir(path) {
            return sendMessage('makeDir', { path });
        },

        deleteFile(path) {
            return sendMessage('delete', { path });
        },

        moveFile(oldPath, newPath) {
            return sendMessage('move', { oldPath, newPath });
        },

        getGpioStates() {
            return sendMessage('getGpioStates');
        },

        // Register callback for real-time GPIO updates
        onGpioUpdate(callback) {
            gpioUpdateCallbacks.add(callback);
            return () => gpioUpdateCallbacks.delete(callback); // Return unregister function
        },

        // Filesystem API (proxied to worker)
        FS: {
            async writeFile(path, content) {
                return sendMessage('writeFile', { path, content });
            },
            async readFile(path, options) {
                const content = await sendMessage('readFile', { path });
                return content;
            },
            async analyzePath(path) {
                const exists = await sendMessage('fileExists', { path });
                return { exists };
            }
        },

        // Note: Some advanced features like globals, pyimport, etc. would need
        // to be proxied through structured clone or SharedArrayBuffer
        // For now, provide the essential API needed by the web-editor

        // Clean shutdown
        terminate() {
            worker.terminate();
            pendingMessages.clear();
        }
    };
}
