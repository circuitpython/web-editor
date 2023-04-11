# CircuitPython Code Editor

The CircuitPython Code Editor is a browser app for editing and debugging CircuitPython devices over WiFi, Bluetooth, and USB. Each connectivity option has certain requirements on CircuitPython version and device (microcontroller).

A live copy of the tool is hosted here: https://code.circuitpython.org

## Environment Setup

1. Make sure NPM Version 16 is installed
2. Copy Files from the Repo to your Web Server Root.
3. Run npm install
4. Run npx snowpack dev to continuously update on file changes (or npx snowpack build for one time)

## Running locally as with SSL

There are 2 ways to do this.

### Using devcert (No installation required)

This is a quick way to get up and running.

1. Generate the certificates by running: npx devcert-cli generate localhost
2. In snowpack.config.mjs, uncomment any lines with the words "cert" and "key"

### Using mkcert (Installation required)

This way requires installing mkcert, but it's much easier to switch back and forth between https and http.

1. Install [mkcert](https://github.com/FiloSottile/mkcert) on your system
2. Generate the certificates by running: mkcert -install && mkcert -key-file snowpack.key -cert-file snowpack.crt localhost
3. Start snowpack in secure mode by --secure to the command: npx snowpack dev --secure

## License

This project is made available under the MIT License. For more details, see the LICENSE file in the repository.
