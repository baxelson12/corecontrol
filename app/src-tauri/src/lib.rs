//! Tauri backend for the CoreLiquid desktop app.
//!
//! The backend is a thin IPC layer over the `coreliquid` control library.
//! [`detect_cooler`] runs the startup detection scan; commands for opening
//! the device and driving profiles come later.

use coreliquid::detect_attached;
use serde::Serialize;

/// One recognized cooler found attached to the machine, shaped for the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedCooler {
    /// Human-readable model name, e.g. "MEG Core Liquid S280".
    pub name: String,
    /// Number of physical radiator fans the model carries.
    pub radiator_fans: usize,
}

/// IPC command: scans the HID bus for supported coolers.
///
/// Runs the enumeration on a blocking thread so the IPC runtime is never
/// stalled by the HID layer.
///
/// # Returns
/// The first recognized cooler, or `None` when no supported cooler is
/// attached.
///
/// # Errors
/// Returns `Err` with a message when the HID subsystem cannot be queried.
#[tauri::command]
async fn detect_cooler() -> Result<Option<DetectedCooler>, String> {
    let attached = tauri::async_runtime::spawn_blocking(detect_attached)
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?;

    Ok(attached.first().map(|spec| DetectedCooler {
        name: spec.name.to_owned(),
        radiator_fans: spec.radiator_fans,
    }))
}

/// Builds and runs the Tauri application, registering the IPC handlers.
///
/// # Panics
/// Panics if the Tauri runtime fails to initialize, which is unrecoverable.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![detect_cooler])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
