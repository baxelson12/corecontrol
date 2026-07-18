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

# Type-check the app backend for the Windows target, no binary produced.
check-app:
    cargo xwin check -p corecontrol-app --features custom-protocol --target x86_64-pc-windows-msvc

# Install frontend dependencies.
install:
    cd app && pnpm install

# Type-check and lint the frontend (tsc + Biome).
check-ui:
    cd app && pnpm exec tsc --noEmit
    cd app && pnpm lint

# Run the app in development with hot reload.
dev: install
    cd app && pnpm tauri dev

# Frontend only, no Tauri backend: browse to http://<vm-ip>:1420 from another
# machine. Hot reload included.
#
# Serve the UI on the LAN for browser preview.
preview: install
    cd app && pnpm dev --host

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
    cargo xwin build --release -p corecontrol-app --features custom-protocol --target x86_64-pc-windows-msvc

# Needs `makensis` on the PATH (apt install nsis). MSI still needs Windows;
# use `win` for that. Artifacts land in
# `target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
#
# Cross-build the Windows NSIS installer from Linux.
win-installer: install
    cd app && pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis

# --- Release ----------------------------------------------------------------

# Bump the major version, commit, and tag. Push manually to release.
major: (_bump "major")

# Bump the minor version, commit, and tag. Push manually to release.
minor: (_bump "minor")

# Bump the patch version, commit, and tag. Push manually to release.
patch: (_bump "patch")

# Bumps the app version in tauri.conf.json, package.json and Cargo.toml (the
# release workflow derives the release tag from tauri.conf.json), syncs
# Cargo.lock, commits, and creates the matching v* tag. Never pushes.
_bump kind:
    #!/usr/bin/env bash
    set -euo pipefail
    conf="app/src-tauri/tauri.conf.json"
    pkg="app/package.json"
    manifest="app/src-tauri/Cargo.toml"
    die() { echo "error: $1" >&2; exit 1; }

    git diff --quiet && git diff --cached --quiet \
        || die "working tree has uncommitted changes, commit or stash first"

    cur=$(sed -n 's/^[[:space:]]*"version": "\([0-9.]*\)",\{0,1\}$/\1/p' "$conf")
    [[ "$cur" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
        || die "cannot read a x.y.z version from $conf (got '$cur')"
    grep -q "\"version\": \"$cur\"" "$pkg" \
        || die "$pkg is not at version $cur, files are out of sync"
    grep -q "^version = \"$cur\"$" "$manifest" \
        || die "$manifest is not at version $cur, files are out of sync"

    IFS=. read -r maj min pat <<<"$cur"
    case "{{kind}}" in
        major) new="$((maj + 1)).0.0" ;;
        minor) new="$maj.$((min + 1)).0" ;;
        patch) new="$maj.$min.$((pat + 1))" ;;
        *) die "unknown bump kind '{{kind}}'" ;;
    esac

    if git rev-parse -q --verify "refs/tags/v$new" >/dev/null; then
        die "tag v$new already exists"
    fi

    sed -i "s/\"version\": \"$cur\"/\"version\": \"$new\"/" "$conf" "$pkg"
    sed -i "s/^version = \"$cur\"$/version = \"$new\"/" "$manifest"
    for f in "$conf" "$pkg" "$manifest"; do
        grep -q "$new" "$f" || die "failed to update version in $f"
    done
    cargo update --workspace --quiet

    git commit -q -m "chore: Release v$new" -- "$conf" "$pkg" "$manifest" Cargo.lock
    git tag -a "v$new" -m "CoreControl v$new"
    echo "Bumped $cur -> $new and tagged v$new."
    echo "Release with: git push origin main v$new"
