# CoreLiquid

A Rust workspace for controlling MSI MEG/MPG Coreliquid AIO coolers, with
CoreControl, a Tauri desktop app, on top.

<p align="center">
  <img src="docs/screenshot.png" width="600" alt="CoreControl main window">
</p>

## Layout

```
Cargo.toml        workspace root
lib/              the control library (USB HID protocol) — see lib/README.md
app/              CoreControl, the Tauri desktop app
  src/            React + Fluent UI frontend
  src-tauri/      Rust backend (Tauri commands)
justfile          workspace tasks
```

The app consumes the library through the `Cooler` facade. Startup device
detection (`detect_cooler`), live status polling (`fan_status`, speeds and
duties for the stat cards), and the fan curve profile (`apply_fan_profile`,
confirmed by reading the running profile back with `read_fan_profile`)
are wired end to end. The app owns the profile: the applied curves and the
theme choice persist in `settings.json` under the per-user app config
directory, and the saved profile is pushed back to the cooler on startup.
A background watchdog re-checks the running profile every five minutes and
pushes the saved profile back if the device has drifted (a firmware reset,
another tool), even while the app sits in the tray; a restore shows a toast
when the window is open. Errors (detection failure, a rejected or
unconfirmed profile write) surface as toasts, with a retry offered when the
cooler never confirms a write.

The app lives in the notification area: a tray icon with an Open/Exit menu
is always present, and launching the exe with `--minimized` (what the
run-at-startup entry does) starts it hidden in the tray. Run-at-startup is
registered on first launch; Task Manager's Startup apps page turns it off.
Launching the exe a second time reveals the running instance instead of
starting another one. The title bar minimize button hides the window to the
tray (no taskbar entry); the close button exits the app, tray icon included.

## Prerequisites

- Rust (stable) and [`just`](https://github.com/casey/just)
- [pnpm](https://pnpm.io) and Node for the frontend
- The [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS
- For Windows: the MSVC toolchain (native) or `cargo-xwin` (cross from Linux)

## Common tasks

```
just check          # fmt + clippy + test the library
just check-ui       # type-check + lint the frontend (tsc + Biome)
just dev            # run the app with hot reload
just win            # build the Windows exe + installers (run on Windows)
just win-exe        # cross-compile just the Windows exe from Linux
just win-installer  # cross-build the NSIS installer from Linux (needs nsis)
```

## CI and releases

GitHub Actions (`.github/workflows/`) runs the library and frontend checks
on every push to `main` and on pull requests. Pushing a `v*` tag builds the
Windows installers and drafts a GitHub release with them attached; publish
the draft to make it public.

See [`lib/README.md`](lib/README.md) for the library API and supported models.
