# CircuitPython Code Editor

The CircuitPython Code Editor is a browser app for editing and debugging CircuitPython devices over WiFi, Bluetooth, and USB. Each connectivity option has certain requirements on CircuitPython version and device (microcontroller).

A live copy of the tool is hosted here: https://code.circuitpython.org

## Environment Setup

1. Copy files from the repo to your web server root.
2. Run `npm install`
3. Run `npm run dev` or `npx vite` to continuously update on file changes
   1. Debug with `npx vite -d`

## Production Build

1. Run `npm run build` or `npx vite build` to generate a static website.
2. Copy and deploy all files and folders in `./dist/` to your webserver.

## License

This project is made available under the MIT License. For more details, see the LICENSE file in the repository.
