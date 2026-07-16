//! Tauri backend for the CoreLiquid desktop app.
//!
//! The backend is a thin IPC layer over the `coreliquid` control library.
//! [`detect_cooler`] runs the startup detection scan and opens the first
//! recognized cooler; [`fan_status`] reads its live speeds and duties. The
//! open device lives in Tauri-managed state shared by the commands.

use std::sync::{Arc, Mutex};

use coreliquid::{Cooler, FanStatus};
use serde::Serialize;

/// The open cooler shared between IPC commands. `None` until detection has
/// found and opened a device. The mutex also serializes HID access.
#[derive(Clone)]
struct CoolerHandle(Arc<Mutex<Option<Cooler>>>);

/// One recognized cooler found attached to the machine, shaped for the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedCooler {
    /// Human-readable model name, e.g. "MEG Core Liquid S280".
    pub name: String,
    /// Number of physical radiator fans the model carries.
    pub radiator_fans: usize,
}

/// Live speed and duty readings for the three cooling channels, shaped for
/// the UI.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FanReadings {
    /// Speed of the first radiator fan in RPM.
    pub radiator_rpm: u16,
    /// Duty of the radiator fan channel, in percent (0–100).
    pub radiator_duty: u8,
    /// Waterblock (60 mm) fan speed in RPM.
    pub waterblock_rpm: u16,
    /// Duty of the waterblock fan channel, in percent (0–100).
    pub waterblock_duty: u8,
    /// Pump speed in RPM.
    pub pump_rpm: u16,
    /// Duty of the pump channel, in percent (0–100).
    pub pump_duty: u8,
}

impl From<FanStatus> for FanReadings {
    fn from(status: FanStatus) -> Self {
        FanReadings {
            radiator_rpm: status.radiator_rpm,
            radiator_duty: status.radiator_duty,
            waterblock_rpm: status.waterblock_rpm,
            waterblock_duty: status.waterblock_duty,
            pump_rpm: status.pump_rpm,
            pump_duty: status.pump_duty,
        }
    }
}

/// Scans for a supported cooler and, when one is found, opens it, runs the
/// connect handshake, and stores it in `handle` for the status command.
///
/// # Returns
/// The first recognized cooler, or `None` when no supported cooler is
/// attached.
///
/// # Errors
/// Returns `Err` with a message when the scan, open, or handshake fails, or
/// when the state mutex is poisoned.
fn open_first_cooler(handle: &Mutex<Option<Cooler>>) -> Result<Option<DetectedCooler>, String> {
    let attached = Cooler::scan().map_err(|error| error.to_string())?;
    let Some(spec) = attached.first().copied() else {
        return Ok(None);
    };
    let cooler = Cooler::open(spec).map_err(|error| error.to_string())?;
    cooler.initialize().map_err(|error| error.to_string())?;
    let mut slot = handle
        .lock()
        .map_err(|_| "cooler state mutex poisoned".to_owned())?;
    *slot = Some(cooler);

    Ok(Some(DetectedCooler {
        name: spec.name.to_owned(),
        radiator_fans: spec.radiator_fans,
    }))
}

/// Reads one status report from the cooler stored in `handle`.
///
/// # Errors
/// Returns `Err` with a message when no cooler is open, the state mutex is
/// poisoned, or the device read fails.
fn read_fan_status(handle: &Mutex<Option<Cooler>>) -> Result<FanReadings, String> {
    let slot = handle
        .lock()
        .map_err(|_| "cooler state mutex poisoned".to_owned())?;
    let cooler = slot.as_ref().ok_or_else(|| "no cooler is open".to_owned())?;
    let status = cooler.status().map_err(|error| error.to_string())?;

    Ok(FanReadings::from(status))
}

/// IPC command: scans the HID bus for supported coolers and opens the first
/// match, keeping it for [`fan_status`].
///
/// Runs the enumeration on a blocking thread so the IPC runtime is never
/// stalled by the HID layer.
///
/// # Returns
/// The first recognized cooler, or `None` when no supported cooler is
/// attached.
///
/// # Errors
/// Returns `Err` with a message when the HID subsystem cannot be queried or
/// the device cannot be opened.
#[tauri::command]
async fn detect_cooler(
    state: tauri::State<'_, CoolerHandle>,
) -> Result<Option<DetectedCooler>, String> {
    let handle = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || open_first_cooler(&handle.0))
        .await
        .map_err(|error| error.to_string())?
}

/// IPC command: reads the current speed and duty of every cooling channel
/// from the cooler opened by [`detect_cooler`].
///
/// Runs the HID exchange on a blocking thread so the IPC runtime is never
/// stalled by the device.
///
/// # Errors
/// Returns `Err` with a message when no cooler is open or the read fails.
#[tauri::command]
async fn fan_status(state: tauri::State<'_, CoolerHandle>) -> Result<FanReadings, String> {
    let handle = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || read_fan_status(&handle.0))
        .await
        .map_err(|error| error.to_string())?
}

/// Builds and runs the Tauri application, registering the IPC handlers.
///
/// # Panics
/// Panics if the Tauri runtime fails to initialize, which is unrecoverable.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CoolerHandle(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![detect_cooler, fan_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
