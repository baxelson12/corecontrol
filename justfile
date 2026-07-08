# CoreLiquid workspace tasks.
#
# The library lives in `lib/`; the Tauri desktop app in `app/` (React + Fluent
# UI frontend, Rust backend in `app/src-tauri`). The app targets Windows.

# List available recipes.
default:
    @just --list

# --- Library (lib/) ---------------------------------------------------------

# Build the control library.
build:
    cargo build -p coreliquid

# Format-check, lint and test the library.
check:
    cargo fmt -p coreliquid -- --check
    cargo clippy -p coreliquid -- -D warnings
    cargo test -p coreliquid

# --- Desktop app (app/) -----------------------------------------------------

# Install frontend dependencies.
install:
    cd app && pnpm install

# Run the app in development with hot reload.
dev: install
    cd app && pnpm tauri dev

# Run ON WINDOWS: bundling the installers needs Windows tooling. Artifacts land
# in `target/release/` (exe) and `target/release/bundle/` (NSIS + MSI).
#
# Build the Windows app: .exe plus NSIS and MSI installers.
win: install
    cd app && pnpm tauri build

# Builds the frontend first so the backend can embed it. No installer produced.
#
# Cross-compile just the Windows .exe from Linux via cargo-xwin.
win-exe: install
    cd app && pnpm build
    cargo xwin build --release -p coreliquid-app --features custom-protocol --target x86_64-pc-windows-msvc
