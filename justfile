build:
    cargo build

win:
    cargo xwin build --release --target x86_64-pc-windows-msvc

check:
    cargo fmt --check
    cargo clippy -- -D warnings
    cargo test
