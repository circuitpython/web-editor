# CircuitPython Code Editor

This is an online Code Editor that leverages Web Bluetooth to allow editing and debugging on nrf52-based devices.

A live copy of the tool is hosted here: https://code.circuitpython.com

## Environment Setup

1. Make sure NPM Version 16 is installed
2. Copy Files from the Repo to your Web Server Root.
3. Run npm login --registry=https://npm.pkg.github.com
4. Make sure to setup a GitHub Personal Access Token with repo and read:packages permissions (Settings->Dev Settings->Personal Access Tokens)
5. Run npm install
6. Run npx snowpack dev to continuously update on file changes (or npx snowpack build for one time)
