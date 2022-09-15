/*
 * This class will encapsulate all of the workflow functions specific to USB.
 *
 * Note: This class isn't currently functional and only serves as a placeholder
 * for USB-related code.
 */

class USBWorkflow extends Workflow {
    constructor() {
        this.serialDevice = null;
        super();
    }

    async init(params) {
        await super.init(params);
    }

    async connectButtonHandler(e) {
        // Empty for now. Eventually this will handle Web Serial connection
    }

    async switchToSerial(device) {
        if (serialDevice) {
            await serialDevice.close();
        }
        this.serialDevice = device;
        device.addEventListener("connect", this.onSerialConnected);
        device.addEventListener("disconnect", this.onSerialDisconnected);
        console.log("switch to", device);
        await device.open({baudRate: 115200});
        console.log("opened");
        let reader;
        while (device.readable) {
            reader = device.readable.getReader();
            try {
                while (true) {
                    const {value, done} = await reader.read();
                    if (done) {
                        // |reader| has been canceled.
                        break;
                    }
                    terminal.io.print(decoder.decode(value));
                }
            } catch (error) {
                // Handle |error|...
                console.log("error", error);
            } finally {
                reader.releaseLock();
            }
        }
    }

    async serialTransmit(msg) {
        if (serialDevice && serialDevice.writable) {
            const encoder = new TextEncoder();
            const writer = serialDevice.writable.getWriter();
            await writer.write(encoder.encode(s));
            writer.releaseLock();
        }
    }

    async onSerialConnected(e) {
        console.log(e, "connected!");
    }

    async onSerialDisconnected(e) {
        console.log(e, "disconnected");
    }
}