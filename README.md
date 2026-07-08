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

The app scaffold does **not** yet consume the library — it ships a single
example `ping` command to prove the frontend↔backend bridge works.

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
