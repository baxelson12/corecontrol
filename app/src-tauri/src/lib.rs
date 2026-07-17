//! Tauri backend for the CoreControl desktop app.
//!
//! The backend is a thin IPC layer over the `coreliquid` control library.
//! [`detect_cooler`] runs the startup detection scan and opens the first
//! recognized cooler; [`fan_status`] reads its live speeds and duties;
//! [`apply_fan_profile`] writes the fan curve profile; [`read_fan_profile`]
//! reads back the profile the device is running, so the UI can confirm a
//! write took effect. The [`settings`] module persists the theme choice and
//! the last applied profile across launches. The open device and the settings live in Tauri-managed state
//! shared by the commands. The [`watchdog`] module keeps a background thread
//! that periodically re-checks the running profile against the saved one and
//! pushes the saved profile back when they differ.
//!
//! The app lives in the notification area: the [`tray`] module owns the tray
//! icon, its Open/Exit menu, and the hover tooltip with live fan readings. The autostart entry (managed by the
//! autostart plugin, enabled on first run) launches the exe with
//! `--minimized`, which keeps the window hidden so a boot start lands in the
//! tray only. A second launch of the exe reveals the running instance
//! instead of starting another one.

mod settings;
mod tray;
mod watchdog;

use std::sync::{Arc, Mutex};

use coreliquid::{ChannelCurve, Cooler, FanConfig, FanStatus};
use serde::{Deserialize, Serialize};
use tauri::Manager;

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

/// One control point of a fan curve, as exchanged with the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CurvePointDto {
    /// Coolant temperature in degrees Celsius (1–120).
    pub temp: u8,
    /// Fan or pump duty in percent (0–100).
    pub duty: u8,
}

/// A full fan profile shaped for the UI: one curve of 4–7 points per display
/// channel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FanProfile {
    /// Curve applied uniformly to the radiator fan channels.
    pub radiators: Vec<CurvePointDto>,
    /// Curve for the waterblock (60 mm) fan channel.
    pub waterblock: Vec<CurvePointDto>,
    /// Curve for the pump channel.
    pub pump: Vec<CurvePointDto>,
}

/// Extracts one channel's populated points for the UI.
fn curve_points(curve: &ChannelCurve) -> Vec<CurvePointDto> {
    curve
        .points()
        .iter()
        .take(curve.point_count())
        .map(|&(temp, duty)| CurvePointDto { temp, duty })
        .collect()
}

impl From<&FanConfig> for FanProfile {
    fn from(config: &FanConfig) -> Self {
        FanProfile {
            radiators: curve_points(&config.radiators()),
            waterblock: curve_points(&config.waterblock()),
            pump: curve_points(&config.pump()),
        }
    }
}

/// Validates one channel's points from the UI into a `ChannelCurve`.
///
/// # Errors
/// Returns `Err` with a message when the points do not form a legal curve.
fn parse_curve(points: &[CurvePointDto]) -> Result<ChannelCurve, String> {
    let pairs: Vec<(u8, u8)> = points
        .iter()
        .map(|point| (point.temp, point.duty))
        .collect();

    ChannelCurve::try_from_points(&pairs).map_err(|error| error.to_string())
}

/// Validates a UI profile into the configuration the device accepts.
///
/// # Errors
/// Returns `Err` with a message naming the first channel whose points do not
/// form a legal curve.
fn config_from_profile(profile: &FanProfile) -> Result<FanConfig, String> {
    let mut config = FanConfig::new();
    config.set_radiators(parse_curve(&profile.radiators).map_err(|e| format!("radiators: {e}"))?);
    config
        .set_waterblock(parse_curve(&profile.waterblock).map_err(|e| format!("waterblock: {e}"))?);
    config.set_pump(parse_curve(&profile.pump).map_err(|e| format!("pump: {e}"))?);

    Ok(config)
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
    let cooler = slot
        .as_ref()
        .ok_or_else(|| "no cooler is open".to_owned())?;
    let status = cooler.status().map_err(|error| error.to_string())?;

    Ok(FanReadings::from(status))
}

/// Validates `profile` and writes it to the cooler stored in `handle`.
///
/// # Errors
/// Returns `Err` with a message when the profile is not a legal curve set,
/// no cooler is open, the state mutex is poisoned, or the write fails.
fn write_profile(handle: &Mutex<Option<Cooler>>, profile: &FanProfile) -> Result<(), String> {
    let config = config_from_profile(profile)?;
    let mut slot = handle
        .lock()
        .map_err(|_| "cooler state mutex poisoned".to_owned())?;
    let cooler = slot
        .as_mut()
        .ok_or_else(|| "no cooler is open".to_owned())?;

    cooler
        .apply_config(&config)
        .map_err(|error| error.to_string())
}

/// Reads back the profile the cooler stored in `handle` is running.
///
/// # Returns
/// The running configuration, or `None` when the device is not running a
/// custom-curve profile on every channel.
///
/// # Errors
/// Returns `Err` with a message when no cooler is open, the state mutex is
/// poisoned, or the device read fails.
fn read_device_profile(handle: &Mutex<Option<Cooler>>) -> Result<Option<FanProfile>, String> {
    let mut slot = handle
        .lock()
        .map_err(|_| "cooler state mutex poisoned".to_owned())?;
    let cooler = slot
        .as_mut()
        .ok_or_else(|| "no cooler is open".to_owned())?;
    let config = cooler.read_profile().map_err(|error| error.to_string())?;

    Ok(config.as_ref().map(FanProfile::from))
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

/// IPC command: validates a fan curve profile from the UI and applies it to
/// the cooler. A successful write also stamps the apply time, which holds
/// off the profile watchdog while the UI verifies and saves the profile.
///
/// Runs the HID exchange on a blocking thread so the IPC runtime is never
/// stalled by the device.
///
/// # Errors
/// Returns `Err` with a message when the profile is invalid, no cooler is
/// open, or the write fails.
#[tauri::command]
async fn apply_fan_profile(
    state: tauri::State<'_, CoolerHandle>,
    stamp: tauri::State<'_, watchdog::ApplyStamp>,
    profile: FanProfile,
) -> Result<(), String> {
    let handle = state.inner().clone();
    let stamp = stamp.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        write_profile(&handle.0, &profile)?;
        stamp.record();
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// IPC command: reads back the fan curve profile the cooler is currently
/// running, so the UI can confirm an applied profile took effect.
///
/// Runs the HID exchange on a blocking thread so the IPC runtime is never
/// stalled by the device.
///
/// # Returns
/// The running profile, or `None` when the device is not running a
/// custom-curve profile on every channel.
///
/// # Errors
/// Returns `Err` with a message when no cooler is open or the read fails.
#[tauri::command]
async fn read_fan_profile(
    state: tauri::State<'_, CoolerHandle>,
) -> Result<Option<FanProfile>, String> {
    let handle = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || read_device_profile(&handle.0))
        .await
        .map_err(|error| error.to_string())?
}

/// Whether this launch came from the autostart entry, which passes
/// `--minimized` so a boot start stays hidden in the notification area.
fn launched_minimized() -> bool {
    std::env::args().any(|arg| arg == "--minimized")
}

/// Registers autostart on the very first launch (no settings file yet), so
/// the app runs at boot right after installation. Task Manager's Startup
/// apps page can disable it; later launches never re-enable it. Skipped in
/// dev builds to keep debug binaries out of the startup entries.
fn enable_autostart_on_first_run(app: &tauri::AppHandle, first_run: bool) {
    use tauri_plugin_autostart::ManagerExt;

    if !first_run || cfg!(debug_assertions) {
        return;
    }
    if let Err(error) = app.autolaunch().enable() {
        eprintln!("failed to enable autostart: {error}");
    }
}

/// Builds and runs the Tauri application, registering the IPC handlers.
///
/// # Panics
/// Panics if the Tauri runtime fails to initialize, which is unrecoverable.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::reveal_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(CoolerHandle(Arc::new(Mutex::new(None))))
        .manage(watchdog::ApplyStamp::default())
        .setup(|app| {
            let path = app.path().app_config_dir()?.join("settings.json");
            let first_run = !path.exists();
            app.manage(settings::SettingsHandle::load(path));
            enable_autostart_on_first_run(app.handle(), first_run);
            watchdog::spawn(
                app.handle().clone(),
                app.state::<CoolerHandle>().inner().clone(),
                app.state::<settings::SettingsHandle>().inner().clone(),
                app.state::<watchdog::ApplyStamp>().inner().clone(),
            );
            tray::create(app.handle())?;
            if !launched_minimized() {
                tray::show_main_window(app.handle())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_cooler,
            fan_status,
            apply_fan_profile,
            read_fan_profile,
            settings::load_settings,
            settings::save_theme,
            settings::save_fan_profile
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
