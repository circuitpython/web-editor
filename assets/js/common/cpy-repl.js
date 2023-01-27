const CHAR_CTRL_C = '\x03';
const CHAR_CTRL_D = '\x04';
const CHAR_CRLF = '\x0a\x0d';
const CHAR_BKSP = '\x08';
const CHAR_TITLE_START = "\x1b]0;";
const CHAR_TITLE_END = "\x1b\\";

const LINE_ENDING = "\r\n";

// Default timeouts in milliseconds (can be overridden with properties)
const PROMPT_TIMEOUT = 10000;
const PROMPT_CHECK_INTERVAL = 50;

export class REPL {
    constructor() {
        this._pythonCodeRunning = false;
        this._codeOutput = '';
        this._currentSerialReceiveLine = '';
        this._checkingPrompt = false;
        this._titleMode = false;
        this.promptTimeout = PROMPT_TIMEOUT;
        this.promptCheckInterval = PROMPT_CHECK_INTERVAL;
        this.withholdTitle = false;
        this.serialTransmit = null;
        this._tokenQueue = [];
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _timeout(callback, ms) {
        return Promise.race([callback(), this._sleep(ms).then(() => {throw Error("Timed Out");})]);
    }

    _currentLineIsPrompt() {
        return this._currentSerialReceiveLine.match(/>>> $/);
    }

    _regexEscape(regexString) {
        return regexString.replace(/\\/, "\\\\");
    }

    // This should help detect lines like ">>> ", but not ">>> 1+1"
    async checkPrompt() {
        // Only allow one instance of this function to run at a time (unless this could cause it to miss a prompt)
        if (!this._currentLineIsPrompt()) {
            return;
        }

        // Check again after a short delay to see if it's still a prompt
        await this._sleep(this.promptCheckInterval);

        if (!this._currentLineIsPrompt()) {
            return;
        }

        this._pythonCodeRunning = false;
    }

    async waitForPrompt() {
        this._pythonCodeRunning = true;
        await this.getToPrompt();

        // Wait for a prompt
        try {
            await this._timeout(
                async () => {
                    while (this._pythonCodeRunning) {
                        await this._sleep(100);
                    }
                }, this.promptTimeout
            );
        } catch (error) {
            console.log("Awaiting prompt timed out.");
            return false;
        }
        return true;
    }

    async softRestart() {
        await this.serialTransmit(CHAR_CTRL_D);
    }

    async getToPrompt() {
        await this.serialTransmit(CHAR_CTRL_C);
    }

    async onSerialReceive(e) {
        // Prepend a partial token if it exists
        //console.log("serial data received: " + e.data);

        if (this._partialToken) {
            e.data = this._partialToken + e.data;
            this._partialToken = null;
        }

        // Tokenize the larger string and send to the parent
        let tokens = this._tokenize(e.data);

        // Remove any partial tokens and store for the next serial data receive
        if (tokens.length && this._hasPartialToken(tokens.slice(-1))) {
            this._partialToken = tokens.pop();
        }

        // Send only full tokens to the token queue
        for (let token of tokens) {
            this._tokenQueue.push(token);
        }
        await this._processQueuedTokens();
    }

    async _processQueuedTokens() {
        if (this._processing) {
            return;
        }
        this._processing = true;
        console.log("Begin processing tokens");
        while (this._tokenQueue.length) {
            await this._processToken(this._tokenQueue.shift());
        }
        console.log("Done processing tokens");
        this._processing = false;
    }

    async _processToken(token) {
        if (token == CHAR_TITLE_START) {
            this._titleMode = true;
            this.setTitle("");
        } else if (token == CHAR_TITLE_END) {
            this._titleMode = false;
        } else if (this._titleMode) {
            this.setTitle(token, true);
        }

        console.log("token received: " + token);

        let codeline = '';
        if (this._pythonCodeRunning) {
            this._currentSerialReceiveLine += token;

            // Run asynchronously to avoid blocking the serial receive
            this.checkPrompt();

            if (this._currentSerialReceiveLine.includes(LINE_ENDING)) {
                [codeline, this._currentSerialReceiveLine] = this._currentSerialReceiveLine.split(LINE_ENDING, 2);
            }
        }

        // Is it still running? Then we add to code output
        if (this._pythonCodeRunning && codeline.length > 0) {
            if (!codeline.match(/^\... /) && !codeline.match(/^>>> /)) {
                this._codeOutput += codeline + LINE_ENDING;
            }
        }
    }

    // Placeholder Function
    setTitle(title, append=false) {
        if (append) {
            title = this.title + title;
        }

        this.title = title;
    }

    async _serialTransmit(msg) {
        if (!this.serialTransmit) {
            console.log("Default serial transmit function called. Message: " + msg);
            throw new Error("REPL serialTransmit must be connected to an external transmit function");
        } else {
            return await this.serialTransmit(msg);
        }
    }

    async runCode(code, codeTimeoutMs=15000) {
        // Allows for supplied python code to be run on the device via the REPL

        // Wait for the prompt to appear
        if (!(await this.waitForPrompt())) {
            return null;
        }

        // Slice the code up into block and lines and run it
        this._pythonCodeRunning = true;
        this._codeOutput = '';
        const codeBlocks = code.split(/(?:\r?\n)+(?!\s)/);

        console.log(codeBlocks);
        let indentLevel = 0;
        for (const block of codeBlocks) {
            for (const line of block.split(/\r?\n/)) {
                const codeIndent = Math.floor(line.match(/^\s*/)[0].length / 4);
                console.log(line, codeIndent, indentLevel);
                console.log("Sending", line.slice(codeIndent * 4) + CHAR_CRLF);
                // Send code line with indents removed
                //await this.waitForPrompt();
                await this._serialTransmit(line.slice(codeIndent * 4) + CHAR_CRLF);
                console.log("Sent");
                if (codeIndent < indentLevel) {
                    // Remove indents to match the code
                    await this._serialTransmit(CHAR_BKSP.repeat(indentLevel - codeIndent) + CHAR_CRLF);
                }
                indentLevel = codeIndent;
            }
        }

        // Wait for the code to finish running, so we can capture the output
        if (codeTimeoutMs) {
            try {
                await this._timeout(
                    async () => {
                        while (this._pythonCodeRunning) {
                            console.log("Waiting for code to finish");
                            await this._sleep(100);
                        }
                    }, codeTimeoutMs
                );
            } catch (error) {
                console.log("Code timed out.");
            }
        } else {
            // Run without timeout
            while (this._pythonCodeRunning) {
                console.log("Waiting for code to finish");
                await this._sleep(100);
            }
        }

        return this._codeOutput;
    }

    // Split a string up by full title start and end character sequences
    _tokenize(string) {
        const tokenRegex = new RegExp("(" + this._regexEscape(CHAR_TITLE_START) + "|" + this._regexEscape(CHAR_TITLE_END) + ")", "gi");
        return string.split(tokenRegex);
    }

    // Check if a chunk of data has a partial title start/end character sequence at the end
    _hasPartialToken(chunk) {
        const partialToken = /\\x1b(?:\](?:0"?)?)?$/gi;
        return partialToken.test(chunk);
    }
}