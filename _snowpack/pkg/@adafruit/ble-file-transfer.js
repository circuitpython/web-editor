const bleFileCharVersionUUID = 'adaf0100-4669-6c65-5472-616e73666572';
const bleFileCharTransferUUID = 'adaf0200-4669-6c65-5472-616e73666572';

const ANY_COMMAND = 0;
const THIS_COMMAND = 1;
const READ_COMMAND = 0x10;
const READ_DATA = 0x11;
const READ_PACING = 0x12;
const WRITE_COMMAND = 0x20;
const WRITE_PACING = 0x21;
const WRITE_DATA = 0x22;

const STATUS_OK = 0x01;

const BYTES_PER_WRITE = 500;

class FileTransferClient {
    constructor(bleDevice) {
        this._resolve = null;
        this._reject = null;
        this._command = ANY_COMMAND;
        this._offset = 0;
        // We have a ton of memory so just buffer everything :-)
        this._buffer = new Uint8Array(4096);
        this._transfer = null;
        this._device = bleDevice;
        bleDevice.addEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
    }

    async onDisconnected() {
        console.log("ftc disconnected");
        this._transfer = null;
        if (this._reject != null) {
            this._reject("disconnected");
            this._reject = null;
            this._resolve = null;
        }
        this._command = ANY_COMMAND;
        this._offset = 0;
    }

    async checkConnection() {
        if (this._reject != null) {
            throw "Command in progress";
        }
        if (this._transfer != null) {
            console.log("connection ok");
            return;
        }
        console.log("check connection");
        let service = await this._device.gatt.getPrimaryService(0xfebb);
        const versionChar = await service.getCharacteristic(bleFileCharVersionUUID);
        let version = (await versionChar.readValue()).getUint32(0, true);
        if (version != 1) {
            console.log(version);
            return Promise.reject("Unsupported version");
        }
        console.log("version ok");
        this._transfer = await service.getCharacteristic(bleFileCharTransferUUID);
        console.log(this._transfer);
        this._transfer.addEventListener('characteristicvaluechanged', this.onTransferNotifty.bind(this));
        console.log("event listener added");
        await this._transfer.startNotifications();
        console.log("check connection done");
    }

    async _write(value) {
        try {
            this._transfer.writeValue(value);
        } catch (e) {
            console.log("caught write error");
            onDisconnected();
        }
    }

    async bond() {
        await this.checkConnection();
        console.log("bonded internally");
    }

    async onTransferNotifty(event) {
      console.log(this._offset, event.target.value.buffer);
      this._buffer.set(new Uint8Array(event.target.value.buffer), this._offset);
      this._command = this._buffer[0];
      this._offset += event.target.value.byteLength;
      console.log("notify", this._command.toString(16), this._buffer.slice(0, this._offset));
      if (this._command == READ_DATA) {
          this._command = await this.processReadData(new DataView(this._buffer.buffer, 0, this._offset));
      } else if (this._command == WRITE_PACING) {
          this._command = await this.processWritePacing(new DataView(this._buffer.buffer, 0, this._offset));
      }
      if (this._command != THIS_COMMAND) {
        console.log("reset buffer");
        this._offset = 0;
      } else {
          console.log("wait for more");
      }
    }

    async readFile(filename) {
        await this.checkConnection();
        this._incomingFile = null;
        this._incomingOffset = 0;

        console.log("load", filename);
        var header = new ArrayBuffer(12);
        var view = new DataView(header);
        let encoded = new TextEncoder().encode(filename);
        view.setUint8(0, READ_COMMAND);
        // Offset 1 is reserved
        view.setUint16(2, encoded.byteLength, true);
        view.setUint32(4, 0, true);
        view.setUint32(8, this._buffer.byteLength - 16, true);
        await this._write(header);
        await this._write(encoded);
        console.log("wrote read");
        let p = new Promise((resolve, reject) => {
            console.log("start read");
            this._resolve = resolve;
            this._reject = reject;
        });
        console.log("read return");
        return p;
    }

    async writeFile(filename, offset, contents) {
        await this.checkConnection();
        var header = new ArrayBuffer(12);
        var view = new DataView(header);
        let encoded = new TextEncoder().encode(filename);
        view.setUint8(0, WRITE_COMMAND);
        // Offset 1 is reserved
        view.setUint16(2, encoded.byteLength, true);
        view.setUint32(4, offset, true);
        view.setUint32(8, offset + contents.byteLength, true);
        console.log("write", offset, offset + contents.byteLength);
        console.log("write header", header, encoded);
        await this._write(header);
        await this._write(encoded);
        this._outgoingContents = contents;
        this._outgoingOffset = offset;
        console.log("wrote write");
        let p = new Promise((resolve, reject) => {
            console.log("start write");
            this._resolve = resolve;
            this._reject = reject;
        });
        console.log("write return");
        return p;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    async processWritePacing(payload) {
        console.log("processWritePacing", payload);
        let status = payload.getUint8(1);
        // Two bytes of padding.
        let chunk_offset = payload.getUint32(4, true);
        let free_space = payload.getUint32(8, true);
        console.log(status, chunk_offset, free_space);
        if (status != STATUS_OK) {
            console.log("write failed", status);
            this._reject(status);
            this._reject = null;
            this._resolve = null;
            return ANY_COMMAND;
        }
        if (free_space == 0) {
          this._resolve();
          this._reject = null;
          this._resolve = null;
          return ANY_COMMAND;
        }
        var header = new ArrayBuffer(12);
        var view = new DataView(header);
        view.setUint8(0, WRITE_DATA);
        view.setUint8(1, STATUS_OK);
        // Offsets 2 and 3 are reserved
        view.setUint32(4, chunk_offset, true);
        let remaining = Math.min(this._outgoingOffset + this._outgoingContents.byteLength - chunk_offset, free_space);
        view.setUint32(8, remaining, true);
        console.log("write header", chunk_offset, remaining);
        await this._write(header);
        var offset = 0;
        let base_offset = chunk_offset - this._outgoingOffset;
        while (offset < remaining) {
            let len = Math.min(remaining - offset, BYTES_PER_WRITE);
            let chunk_contents = this._outgoingContents.subarray(base_offset + offset, base_offset + offset + len);
            console.log("write subarray", base_offset, offset, chunk_contents);
            // Delay to ensure the last value was written to the device.
            if (offset > 0) {
                await this.sleep(100);
            }
            await this._write(chunk_contents);
            console.log(this._transfer.value);
            offset += len;
        }
        return WRITE_PACING;
    }

    async processReadData(payload) {
        console.log("processReadData", payload);
        const headerSize = 16;
        let status = payload.getUint8(1);
        let chunk_offset = payload.getUint32(4, true);
        let total_length = payload.getUint32(8, true);
        let chunk_length = payload.getUint32(12, true);
        console.log("read data", status, chunk_offset, total_length, chunk_length);
        if (payload.byteLength < headerSize + chunk_length) {
            console.log("need more");
          return THIS_COMMAND;
        }
        console.log("full payload");
        if (this._incomingFile == null) {
          this._incomingFile = new Uint8Array(total_length);
        }
        this._incomingFile.set(new Uint8Array(payload.buffer.slice(headerSize, payload.byteLength)), chunk_offset);
        this._incomingOffset += chunk_length;

        let remaining = this._incomingFile.byteLength - this._incomingOffset;
        if (remaining == 0) {
            console.log(this._incomingFile);
            this._resolve(new TextDecoder().decode(this._incomingFile));
            this._resolve = null;
            this._reject = null;
            this._incomingFile = null;
            this._incomingOffset = 0;
            return ANY_COMMAND;
        }
        var header = new ArrayBuffer(12);
        var view = new DataView(header);
        view.setUint8(0, READ_PACING);
        view.setUint8(1, STATUS_OK);
        // Offsets 2 and 3 are reserved
        view.setUint32(4, this._incomingOffset, true);
        view.setUint32(8, Math.min(this._buffer.byteLength - 12, remaining), true);
        await this._write(header);
        console.log(this._incomingFile, );
        return READ_DATA;
        }
}

export { FileTransferClient };
