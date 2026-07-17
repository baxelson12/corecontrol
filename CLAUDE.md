# CoreLiquid

Rust workspace: `lib/` is the control library (USB HID), `app/` is the Tauri
desktop app (React + Fluent UI frontend, Rust backend in `app/src-tauri`).
The app targets Windows; the app crate does not build with native cargo on
this Linux box (GTK), use the xwin recipes.

## Library surface

Consumers of the library (the app backend, the bins) use only what
`lib/src/lib.rs` re-exports: the `Cooler` facade plus its data types. Never
reach into internal modules or widen the exports to work around the facade;
if a capability is missing, add it to `Cooler`. Details in `lib/CLAUDE.md`.

## Docs follow the surface

Any change to the library's public surface updates, in the same change:
rustdoc on the touched items, the crate docs in `lib/src/lib.rs` if the
consumer flow changed, `lib/README.md`, and `README.md` if it mentions the
affected piece.

## Verify every change

Run the matching check before calling a change done. Do not run full or
release builds; the user handles those.

- Library (`lib/`): `just check` (fmt + clippy `-D warnings` + tests)
- App backend (`app/src-tauri/`): `just check-app`
- Frontend (`app/src/`): `just check-ui` (tsc + Biome lint/format check).
  Biome config lives in `app/biome.json`. Fix findings; only when a rule
  genuinely doesn't apply, use a `biome-ignore` comment stating why.
