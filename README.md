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

## Troubleshooting

### `OSError: [Errno 5] Input/output error` on Linux after Save+Run

On Linux, the CIRCUITPY drive is mounted asynchronously by default. After the editor writes `code.py` over USB Mass Storage (the FS Access API), the host kernel can hold the file's data sectors in its page cache for up to ~30 seconds before flushing them to the device. If CircuitPython tries to read `code.py` before that flush completes, it raises `OSError: [Errno 5] Input/output error`.

The editor mitigates this by waiting (with a Blinka spinner) for the device to confirm it can read the full file before sending a soft-reboot. This covers the **Run** and **Reboot** buttons and Ctrl-D pressed in the terminal panel.

If you want to eliminate the wait entirely (and the underlying race), pick one of the following workarounds on your Linux host:

**Option A — Mount CIRCUITPY synchronously (recommended; eliminates the wait).** With this rule the host commits writes inside `close()`, so the editor's flush-detector poll matches on its first attempt and the Run/Reboot/Ctrl-D actions feel instant. Add a udev rule:

```
# /etc/udev/rules.d/99-circuitpy.rules
ACTION=="add", KERNEL=="sd[a-z]*", ATTRS{idVendor}=="239a", ENV{ID_FS_LABEL}=="CIRCUITPY", ENV{UDISKS_MOUNT_OPTIONS}="sync,flush"
```

Then reload with `sudo udevadm control --reload-rules && sudo udevadm trigger`. The CIRCUITPY drive will be mounted with `sync,flush` on next reconnect, so writes commit immediately at a small write-speed cost.

**Option B — Disable CircuitPython's filesystem-change auto-reload.** Add the following to `boot.py` on the device:

```python
import supervisor
supervisor.runtime.autoreload = False
```

This suppresses the device's own auto-reload on filesystem change, so you fully control reboots from the editor. The editor's wait still applies to its own Run/Reboot actions.

**Option C — Reduce the kernel's dirty-page expire window** (host-wide; affects all writes, not just CIRCUITPY):

```
sudo sysctl -w vm.dirty_expire_centisecs=100
```

Note: ChromeOS users cannot apply Option A or C and should rely on the editor's built-in wait or use Option B on the device.

## License

This project is made available under the MIT License. For more details, see the LICENSE file in the repository.
