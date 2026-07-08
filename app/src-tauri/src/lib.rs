//! Tauri backend for the CoreLiquid desktop app.
//!
//! At this stage the backend exposes a single example command, [`ping`], used
//! to prove the React frontend can round-trip data through Rust. The
//! `coreliquid` control library is intentionally not wired in yet.

use serde::Serialize;

/// Reply returned by [`ping`], echoing the caller's name back with a greeting.
#[derive(Debug, Serialize)]
pub struct Pong {
    /// Human-readable greeting for display in the UI.
    pub message: String,
    /// The name the frontend sent, echoed verbatim.
    pub echoed: String,
}

/// Example IPC command: greets `name` and echoes it back.
///
/// This exists purely to demonstrate the frontend↔backend bridge; it performs
/// no hardware access.
///
/// # Parameters
/// - `name`: caller-supplied name; must be non-empty after trimming.
///
/// # Returns
/// A [`Pong`] carrying a greeting and the echoed name.
///
/// # Errors
/// Returns `Err` with a message when `name` is empty or only whitespace.
#[tauri::command]
fn ping(name: String) -> Result<Pong, String> {
    let trimmed = name.trim();
    // Precondition: reject empty input at the IPC boundary.
    if trimmed.is_empty() {
        return Err("name must not be empty".to_owned());
    }

    let pong = Pong {
        message: format!("CoreLiquid backend received: {trimmed}"),
        echoed: trimmed.to_owned(),
    };

    // Postconditions: the reply carries the greeting and echo we built.
    debug_assert!(!pong.message.is_empty(), "message must be populated");
    debug_assert_eq!(pong.echoed, trimmed, "echo must match the input");
    Ok(pong)
}

/// Builds and runs the Tauri application, registering the IPC handlers.
///
/// # Panics
/// Panics if the Tauri runtime fails to initialize, which is unrecoverable.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
