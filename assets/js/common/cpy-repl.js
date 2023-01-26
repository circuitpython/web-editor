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
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _timeout(callback, ms) {
        return Promise.race([callback(), sleep(ms).then(() => {throw Error("Timed Out");})]);
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
        await this.serialTransmit(CHAR_CTRL_C);

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

    async onSerialReceive(e) {
        // Prepend a partial token if it exists
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

        // Send only full tokens to the parent function
        for (let token of tokens) {
            await this._processToken(token);
        }
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

        let codeline = '';
        if (this._pythonCodeRunning) {
            //console.log("received: " + token);
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

    async serialTransmit(msg) {
        // TODO Maybe try and have a default transmit function if possible
        throw new Error("REPL serialTransmit must be connected to an external transmit function");
    }

    async runCode(code, codeTimeoutMs=15000) {
        // Allows for supplied python code to be run on the device via the REPL
        //
        // TODO: Improve reliability. Right now, the timing is a bit tight and occasionally fails to run

        // Wait for the prompt to appear
        if (!this.waitForPrompt()) {
            return null;
        }

        // Slice the code up into block and lines and run it
        this._pythonCodeRunning = true;
        this._codeOutput = '';
        const codeBlocks = code.split(/(?:\r?\n)+(?!\s)/);

        let indentCount = 0;
        for (const block of codeBlocks) {
            for (const line of block.split(/\r?\n/)) {
                const indents = Math.floor(line.match(/^\s*/)[0].length / 4);
                await this.serialTransmit(line.slice(indents * 4) + CHAR_CRLF);
                if (indents < indentCount) {
                    await this.serialTransmit(CHAR_BKSP.repeat(indentCount - indents) + CHAR_CRLF);
                }
                indentCount = indents;
            }
        }

        // Wait for the code to finish running, so we can capture the output
        if (codeTimeoutMs) {
            try {
                await this._timeout(
                    async () => {
                        while (this._pythonCodeRunning) {
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