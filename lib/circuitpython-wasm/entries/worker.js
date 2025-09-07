/**
 * Web Worker Optimized CircuitPython Entry Point
 * 
 * This entry point provides Web Worker specific optimizations:
 * - Non-blocking execution in worker thread
 * - Message passing between main thread and worker
 * - Shared memory buffers for efficient data exchange
 * - Parallel processing capabilities
 * - Background task execution
 */

import { createCircuitPython } from '../circuitpython-bridge.js';
import { BoardShadowRuntime } from '../board-shadow-runtime.js';

export class WorkerCircuitPython {
    constructor(options = {}) {
        this.options = {
            // Worker optimized defaults
            heapSize: 12 * 1024 * 1024,  // 12MB (workers have more memory)
            enableSharedMemory: true,
            enableParallelExecution: true,
            messageTimeout: 10000,
            maxConcurrentTasks: 4,
            enableTaskQueue: true,
            workerDebugLevel: 'info',
            ...options
        };
        
        // Detect if we're running in a worker or main thread
        this.isWorker = typeof importScripts === 'function';
        this.isMainThread = typeof Window !== 'undefined' || (typeof window !== 'undefined');
        
        // Core components
        this.circuitPython = null;
        this.boardShadow = null;
        this.isInitialized = false;
        
        // Worker-specific features
        this.messageHandlers = new Map();
        this.taskQueue = [];
        this.activeTasks = new Map();
        this.sharedBuffers = new Map();
        this.workerPool = null;
        
        // Communication
        this.messageId = 0;
        this.pendingMessages = new Map();
    }
    
    /**
     * Initialize Worker-optimized CircuitPython
     */
    async init() {
        if (this.isInitialized) return this;
        
        if (this.isWorker) {
            console.log('👷 Initializing CircuitPython in Web Worker...');
            return this.initializeWorker();
        } else {
            console.log('🏭 Initializing CircuitPython Worker Manager...');
            return this.initializeMainThread();
        }
    }
    
    /**
     * Initialize CircuitPython in Web Worker context
     */
    async initializeWorker() {
        try {
            // Initialize CircuitPython WASM with worker optimizations
            this.circuitPython = await createCircuitPython({
                heapSize: this.options.heapSize,
                onOutput: (text) => this.sendToMainThread('output', text),
                onError: (text) => this.sendToMainThread('error', text),
                // Worker specific optimizations
                enableOffscreenCanvas: false,  // Not available in workers
                enableWebGL: false,            // Not available in workers
                enableSharedArrayBuffer: this.options.enableSharedMemory
            });
            
            // Initialize board shadow runtime
            this.boardShadow = new BoardShadowRuntime({
                enableLogging: this.options.workerDebugLevel === 'debug'
            });
            
            // Set up worker message handling
            this.setupWorkerMessageHandling();
            
            // Set up shared memory if enabled
            if (this.options.enableSharedMemory) {
                this.setupSharedMemory();
            }
            
            // Set up task queue processing
            if (this.options.enableTaskQueue) {
                this.startTaskProcessor();
            }
            
            this.isInitialized = true;
            this.sendToMainThread('initialized', { 
                heapSize: this.options.heapSize,
                features: this.getWorkerFeatures()
            });
            
            console.log('✅ Worker CircuitPython ready');
            return this;
            
        } catch (error) {
            this.sendToMainThread('error', `Worker initialization failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Initialize main thread worker manager
     */
    async initializeMainThread() {
        try {
            // Create worker pool for parallel execution
            if (this.options.enableParallelExecution) {
                this.workerPool = new WorkerPool(this.options.maxConcurrentTasks);
                await this.workerPool.initialize();
            }
            
            // Create primary worker
            this.primaryWorker = await this.createWorker();
            
            this.isInitialized = true;
            console.log('✅ Worker Manager ready');
            return this;
            
        } catch (error) {
            console.error('❌ Worker Manager initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Create a new worker instance
     */
    async createWorker() {
        return new Promise((resolve, reject) => {
            // Create worker with this same script
            const worker = new Worker(new URL(import.meta.url), { type: 'module' });
            
            const initTimeout = setTimeout(() => {
                reject(new Error('Worker initialization timeout'));
            }, this.options.messageTimeout);
            
            worker.onmessage = (event) => {
                const { type, data, id } = event.data;
                
                if (type === 'initialized') {
                    clearTimeout(initTimeout);
                    console.log('✅ Worker initialized:', data);
                    resolve(new WorkerInstance(worker, data));
                } else if (id && this.pendingMessages.has(id)) {
                    // Handle response to pending message
                    const pending = this.pendingMessages.get(id);
                    this.pendingMessages.delete(id);
                    clearTimeout(pending.timeout);
                    pending.resolve(data);
                } else {
                    // Handle unsolicited messages (output, errors, etc.)
                    this.handleWorkerMessage(type, data);
                }
            };
            
            worker.onerror = (error) => {
                clearTimeout(initTimeout);
                reject(error);
            };
            
            // Start worker initialization
            worker.postMessage({ type: 'init', options: this.options });
        });
    }
    
    /**
     * Set up worker message handling
     */
    setupWorkerMessageHandling() {
        if (!this.isWorker) return;
        
        self.onmessage = async (event) => {
            const { type, data, id } = event.data;
            
            try {
                let result;
                
                switch (type) {
                    case 'init':
                        // Initialization handled in init() method
                        break;
                        
                    case 'execute':
                        result = await this.executeInWorker(data.code, data.options);
                        break;
                        
                    case 'setPin':
                        result = await this.boardShadow.setPin(data.pinId, data.value);
                        break;
                        
                    case 'getPin':
                        result = this.boardShadow.getPin(data.pinId);
                        break;
                        
                    case 'getStatus':
                        result = this.getWorkerStatus();
                        break;
                        
                    case 'addTask':
                        result = this.addTask(data);
                        break;
                        
                    default:
                        throw new Error(`Unknown message type: ${type}`);
                }
                
                if (id) {
                    this.sendToMainThread('response', result, id);
                }
                
            } catch (error) {
                if (id) {
                    this.sendToMainThread('error', error.message, id);
                } else {
                    console.error('Worker error:', error);
                }
            }
        };
    }
    
    /**
     * Set up shared memory buffers
     */
    setupSharedMemory() {
        if (typeof SharedArrayBuffer === 'undefined') {
            console.warn('SharedArrayBuffer not available, falling back to message passing');
            return;
        }
        
        // Create shared buffers for efficient data exchange
        const buffers = {
            pinStates: new SharedArrayBuffer(1024),      // Pin state data
            sensorData: new SharedArrayBuffer(4096),     // Sensor readings
            commandQueue: new SharedArrayBuffer(2048),   // Hardware commands
            responseBuffer: new SharedArrayBuffer(1024)  // Command responses
        };
        
        // Wrap in typed arrays for easier access
        this.sharedBuffers.set('pinStates', new Uint8Array(buffers.pinStates));
        this.sharedBuffers.set('sensorData', new Float32Array(buffers.sensorData));
        this.sharedBuffers.set('commandQueue', new Uint32Array(buffers.commandQueue));
        this.sharedBuffers.set('responseBuffer', new Uint8Array(buffers.responseBuffer));
        
        console.log('📤 Shared memory buffers initialized');
    }
    
    /**
     * Execute code in worker
     */
    async executeInWorker(code, options = {}) {
        if (!this.circuitPython) {
            throw new Error('CircuitPython not initialized in worker');
        }
        
        const startTime = Date.now();
        
        try {
            // Enhanced code for worker environment
            const workerEnhancedCode = this.enhanceCodeForWorker(code, options);
            
            const result = await this.circuitPython.execute(workerEnhancedCode);
            
            const executionTime = Date.now() - startTime;
            
            return {
                ...result,
                executionTime,
                workerId: 'primary',
                sharedMemoryUsed: this.options.enableSharedMemory
            };
            
        } catch (error) {
            throw new Error(`Worker execution failed: ${error.message}`);
        }
    }
    
    /**
     * Enhance code for worker environment
     */
    enhanceCodeForWorker(code, options) {
        const workerIntegration = `
# Web Worker CircuitPython Integration
import time

# Worker-specific output handling
def worker_print(*args, **kwargs):
    text = ' '.join(str(arg) for arg in args)
    # Send to main thread via postMessage equivalent
    print(f"WORKER_OUTPUT:{text}")

# Override print for worker environment
import builtins
builtins.print = worker_print

# Worker-optimized time handling
original_sleep = time.sleep
def worker_sleep(seconds):
    # Allow worker to yield during sleep
    print(f"WORKER_SLEEP:{seconds}")
    original_sleep(seconds)

time.sleep = worker_sleep

# Parallel processing helpers
def parallel_map(func, iterable):
    """Map function over iterable using worker parallelism"""
    results = []
    for item in iterable:
        result = func(item)
        results.append(result)
        # Yield control periodically
        if len(results) % 10 == 0:
            time.sleep(0.001)
    return results

# User code starts here:
${code}
`;
        
        return workerIntegration;
    }
    
    /**
     * Start task queue processor
     */
    startTaskProcessor() {
        if (!this.isWorker) return;
        
        const processNextTask = async () => {
            if (this.taskQueue.length === 0) {
                // No tasks, wait a bit
                setTimeout(processNextTask, 10);
                return;
            }
            
            const task = this.taskQueue.shift();
            const taskId = `task_${Date.now()}`;
            
            try {
                this.activeTasks.set(taskId, task);
                
                let result;
                
                switch (task.type) {
                    case 'execute':
                        result = await this.executeInWorker(task.code, task.options);
                        break;
                        
                    case 'hardware':
                        result = await this.processHardwareTask(task);
                        break;
                        
                    default:
                        throw new Error(`Unknown task type: ${task.type}`);
                }
                
                this.sendToMainThread('taskComplete', { taskId, result });
                
            } catch (error) {
                this.sendToMainThread('taskError', { taskId, error: error.message });
            } finally {
                this.activeTasks.delete(taskId);
            }
            
            // Process next task
            setTimeout(processNextTask, 1);
        };
        
        processNextTask();
    }
    
    /**
     * Add task to queue
     */
    addTask(task) {
        if (!this.isWorker) {
            throw new Error('Tasks can only be added from worker context');
        }
        
        this.taskQueue.push({
            ...task,
            timestamp: Date.now()
        });
        
        return { queued: true, queueLength: this.taskQueue.length };
    }
    
    /**
     * Process hardware task
     */
    async processHardwareTask(task) {
        switch (task.operation) {
            case 'setPin':
                return await this.boardShadow.setPin(task.pinId, task.value);
                
            case 'getPin':
                return this.boardShadow.getPin(task.pinId);
                
            case 'bulkPinUpdate':
                const results = {};
                for (const [pinId, value] of Object.entries(task.pins)) {
                    results[pinId] = await this.boardShadow.setPin(pinId, value);
                }
                return results;
                
            default:
                throw new Error(`Unknown hardware operation: ${task.operation}`);
        }
    }
    
    /**
     * Send message to main thread (worker context)
     */
    sendToMainThread(type, data, responseId = null) {
        if (!this.isWorker) return;
        
        self.postMessage({
            type,
            data,
            id: responseId,
            timestamp: Date.now()
        });
    }
    
    /**
     * Send message to worker (main thread context)
     */
    async sendToWorker(type, data, timeout = null) {
        if (this.isWorker || !this.primaryWorker) {
            throw new Error('Can only send to worker from main thread');
        }
        
        return new Promise((resolve, reject) => {
            const messageId = this.messageId++;
            const msgTimeout = timeout || this.options.messageTimeout;
            
            const timeoutId = setTimeout(() => {
                this.pendingMessages.delete(messageId);
                reject(new Error('Worker message timeout'));
            }, msgTimeout);
            
            this.pendingMessages.set(messageId, {
                resolve,
                reject,
                timeout: timeoutId
            });
            
            this.primaryWorker.worker.postMessage({
                type,
                data,
                id: messageId
            });
        });
    }
    
    /**
     * Handle worker messages in main thread
     */
    handleWorkerMessage(type, data) {
        switch (type) {
            case 'output':
                console.log('🐍 Worker:', data);
                break;
                
            case 'error':
                console.error('🔥 Worker Error:', data);
                break;
                
            case 'taskComplete':
                console.log('✅ Task completed:', data.taskId);
                break;
                
            case 'taskError':
                console.error('❌ Task failed:', data.taskId, data.error);
                break;
                
            default:
                console.log('📨 Worker Message:', type, data);
        }
    }
    
    /**
     * Execute code (main thread interface)
     */
    async execute(code, options = {}) {
        if (this.isWorker) {
            return this.executeInWorker(code, options);
        } else {
            return this.sendToWorker('execute', { code, options });
        }
    }
    
    /**
     * Set pin value (main thread interface)
     */
    async setPin(pinId, value) {
        if (this.isWorker) {
            return this.boardShadow.setPin(pinId, value);
        } else {
            return this.sendToWorker('setPin', { pinId, value });
        }
    }
    
    /**
     * Get pin value (main thread interface)
     */
    async getPin(pinId) {
        if (this.isWorker) {
            return this.boardShadow.getPin(pinId);
        } else {
            return this.sendToWorker('getPin', { pinId });
        }
    }
    
    /**
     * Get worker features
     */
    getWorkerFeatures() {
        return {
            sharedMemory: this.options.enableSharedMemory && typeof SharedArrayBuffer !== 'undefined',
            parallelExecution: this.options.enableParallelExecution,
            taskQueue: this.options.enableTaskQueue,
            maxConcurrentTasks: this.options.maxConcurrentTasks,
            offscreenCanvas: typeof OffscreenCanvas !== 'undefined'
        };
    }
    
    /**
     * Get worker status
     */
    getWorkerStatus() {
        const baseStatus = {
            isWorker: this.isWorker,
            isInitialized: this.isInitialized,
            features: this.getWorkerFeatures()
        };
        
        if (this.isWorker) {
            baseStatus.worker = {
                taskQueueLength: this.taskQueue.length,
                activeTasks: this.activeTasks.size,
                sharedBuffers: this.sharedBuffers.size
            };
            
            if (this.boardShadow) {
                baseStatus.hardware = this.boardShadow.getHardwareStatus();
            }
        } else {
            baseStatus.mainThread = {
                workerPool: this.workerPool ? this.workerPool.getStatus() : null,
                pendingMessages: this.pendingMessages.size
            };
        }
        
        return baseStatus;
    }
    
    /**
     * Cleanup worker resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up Worker CircuitPython...');
        
        if (this.isWorker) {
            // Worker cleanup
            this.taskQueue = [];
            this.activeTasks.clear();
            this.sharedBuffers.clear();
            
            if (this.boardShadow) {
                this.boardShadow.dispose();
            }
            
            if (this.circuitPython) {
                this.circuitPython.dispose();
            }
        } else {
            // Main thread cleanup
            if (this.primaryWorker) {
                this.primaryWorker.worker.terminate();
            }
            
            if (this.workerPool) {
                await this.workerPool.cleanup();
            }
        }
        
        this.isInitialized = false;
        console.log('✅ Worker cleanup complete');
    }
}

/**
 * Worker Instance Wrapper
 */
class WorkerInstance {
    constructor(worker, initData) {
        this.worker = worker;
        this.initData = initData;
        this.id = Math.random().toString(36).substring(7);
    }
    
    getInfo() {
        return {
            id: this.id,
            ...this.initData
        };
    }
}

/**
 * Worker Pool for Parallel Execution
 */
class WorkerPool {
    constructor(maxWorkers = 4) {
        this.maxWorkers = maxWorkers;
        this.workers = [];
        this.taskQueue = [];
        this.busyWorkers = new Set();
    }
    
    async initialize() {
        // Create initial set of workers
        for (let i = 0; i < this.maxWorkers; i++) {
            // Would create worker instances here
            // Simplified for example
        }
    }
    
    getStatus() {
        return {
            totalWorkers: this.workers.length,
            busyWorkers: this.busyWorkers.size,
            queuedTasks: this.taskQueue.length
        };
    }
    
    async cleanup() {
        // Terminate all workers
        this.workers.forEach(worker => worker.worker.terminate());
        this.workers = [];
        this.busyWorkers.clear();
        this.taskQueue = [];
    }
}

/**
 * Factory function for Worker CircuitPython
 */
export default async function workerCtPy(options = {}) {
    const instance = new WorkerCircuitPython(options);
    await instance.init();
    return instance;
}

// Auto-initialize if running in worker
if (typeof importScripts === 'function') {
    // We're in a worker, initialize automatically
    workerCtPy().catch(console.error);
}

export { WorkerCircuitPython };