//! Binary entry point: hands off to the library crate's `run`.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    corecontrol_app_lib::run();
}
