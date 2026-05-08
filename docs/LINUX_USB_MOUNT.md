# Linux USB Mount Notes (CIRCUITPY)

If you use the CircuitPython Web Editor on Linux with the **USB workflow**
and you see

```
OSError: [Errno 5] Input/output error
```

in the serial terminal after pressing <kbd>Ctrl</kbd>+<kbd>D</kbd> following
a save, this page is for you. The cause is in the host operating system,
not the editor and not your CircuitPython device.

## What is happening

When the browser writes to `code.py` (or any other file on the CIRCUITPY
drive), it goes through the operating system's filesystem layer. On Linux,
the default behavior of the `vfat` filesystem on a USB Mass Storage Class
(MSC) device is to **buffer those writes in the kernel's page cache** and
only push them to the device some time later (the kernel default is up to
~30 seconds).

When you then press <kbd>Ctrl</kbd>+<kbd>D</kbd>, CircuitPython on the
device tries to import `code.py` immediately. If the host hasn't yet
flushed its writes, the device sees an inconsistent filesystem and
returns `OSError: [Errno 5] Input/output error`.

This only affects **Linux** with the **USB MSC workflow**. macOS and
Windows do not have this issue. Network and Bluetooth workflows are also
unaffected.

## Quick fix (current session)

Remount the CIRCUITPY drive with the `sync` mount option so writes are
sent to the device synchronously:

```sh
udisksctl unmount -b /dev/sdX1
udisksctl mount -b /dev/sdX1 -o sync
```

Replace `/dev/sdX1` with the actual block device. Find it with:

```sh
lsblk
# or
mount | grep CIRCUITPY
```

After this, return to the editor, **reconnect** (the previous filesystem
handle is invalidated by the remount), and resume editing.

## Permanent fix: udev rule

To make every CircuitPython device automount with `sync` going forward,
add a `udev` rule.

1. Find your board's USB Vendor ID (`idVendor`) and Product ID
   (`idProduct`) using `lsusb`. CircuitPython boards often share VID
   `239a` (Adafruit) but PIDs vary by board.

   ```sh
   lsusb
   ```

2. Create `/etc/udev/rules.d/99-circuitpython-sync.rules` with:

   ```
   # CircuitPython CIRCUITPY drive: mount synchronously to avoid
   # OSError: [Errno 5] Input/output error from web-editor saves.
   ENV{ID_FS_LABEL}=="CIRCUITPY", ENV{UDISKS_MOUNT_OPTIONS}+="sync"
   ```

   The label-based match catches any CircuitPython board, regardless of
   VID/PID. If you'd rather scope it tighter, you can add additional
   `ATTRS{idVendor}=="..."` clauses.

3. Reload udev rules:

   ```sh
   sudo udevadm control --reload-rules
   sudo udevadm trigger
   ```

4. Replug your CircuitPython board (or simply unmount/remount the
   CIRCUITPY drive). It should now appear with `sync` in its mount
   options. Verify with:

   ```sh
   mount | grep CIRCUITPY
   ```

   You should see something like:

   ```
   /dev/sda1 on /media/<user>/CIRCUITPY type vfat (rw,...,sync,...)
   ```

## Trade-offs

The `sync` mount option means every write to CIRCUITPY blocks until the
device has accepted the data. For interactive editing of small files
this is generally not noticeable. For copying large files (firmware
updates, large libraries) it will be slower than the default async
behavior, but the data is more reliably on the device when the copy
returns.

## See also

- [Issue #229](https://github.com/circuitpython/web-editor/issues/229)
  — original report and discussion
- `man 8 mount` — see the `sync` option under FILESYSTEM-INDEPENDENT
  MOUNT OPTIONS
