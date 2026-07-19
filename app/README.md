# CoreControl (desktop app)

Tauri desktop app for MSI Coreliquid AIO coolers: React + Fluent UI frontend,
Rust backend in `src-tauri/` on top of the `coreliquid` library. Targets
Windows.

## Frontend layout

```
src/
├── app/         bootstrap, store wiring, window chrome, root view, toaster
├── core/        cross-cutting infrastructure: OS notifications, toast queue
├── entities/    domain state and IPC shared by several features
│   ├── channels/   channel colors and curve point/series types
│   ├── profile/    fan profile model, parsing, and device IPC
│   ├── settings/   persisted settings state and IPC
│   └── theme/      theme preference state
├── features/    one folder per screen concern
│   ├── curves/     fan curve chart and editing state
│   ├── detection/  cooler detection
│   ├── settings/   settings page components
│   ├── status/     live fan readings
│   └── updates/    startup update check
└── shared/      portable presentational components
```

Dependency direction: `shared` imports nothing, `core` only `shared`,
`entities` may use `core`, features use all of the above, and only `app`
composes features together. Features never import from each other.

## Backend layout

`src-tauri/src/` holds the IPC commands (`lib.rs`), persisted settings
(`settings.rs`), the tray icon (`tray.rs`), and the profile watchdog
(`watchdog.rs`).

## Checks

From the workspace root: `just check-ui` (tsc + Biome) for the frontend,
`just check-app` (clippy via cargo-xwin) for the backend. `just dev` runs the
app with hot reload.
