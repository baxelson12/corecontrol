# CoreLiquid

A Rust workspace for controlling MSI MEG/MPG Coreliquid AIO coolers, with a
Tauri desktop app on top.

## Layout

```
Cargo.toml        workspace root
lib/              the control library (USB HID protocol) — see lib/README.md
app/              the Tauri desktop app
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
Errors (detection failure, a rejected or unconfirmed profile write) surface
as toasts, with a retry offered when the cooler never confirms a write.

## Prerequisites

- Rust (stable) and [`just`](https://github.com/casey/just)
- [pnpm](https://pnpm.io) and Node for the frontend
- The [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS
- For Windows: the MSVC toolchain (native) or `cargo-xwin` (cross from Linux)

## Common tasks

```
just check      # fmt + clippy + test the library
just dev        # run the app with hot reload
just win        # build the Windows exe + installers (run on Windows)
just win-exe    # cross-compile just the Windows exe from Linux
```

See [`lib/README.md`](lib/README.md) for the library API and supported models.
