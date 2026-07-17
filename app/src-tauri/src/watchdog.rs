//! Background guard that keeps the cooler on the saved fan profile.
//!
//! Firmware resets, another tool (MSI Center), or a device hiccup can swap
//! the running profile behind the app's back. A detached thread wakes every
//! [`CHECK_INTERVAL`], reads the profile the cooler is running, and pushes
//! the saved profile back when they differ, whether or not the window is
//! visible. After a restore it emits [`RESTORED_EVENT`] so an open UI can
//! show a toast.
//!
//! The check pauses for [`APPLY_HOLD_OFF`] after every user apply: the
//! frontend saves a profile only once the device confirms it, so during that
//! verification window the saved copy is stale and a check would fight the
//! apply.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use coreliquid::Cooler;
use tauri::{AppHandle, Emitter};

use crate::settings::SettingsHandle;
use crate::{config_from_profile, CoolerHandle, FanProfile};

/// Time between checks of the running profile.
const CHECK_INTERVAL: Duration = Duration::from_secs(300);
/// How long after a user apply the check stays quiet.
const APPLY_HOLD_OFF: Duration = Duration::from_secs(60);
/// Event emitted to the frontend after the saved profile was pushed back.
const RESTORED_EVENT: &str = "saved-profile-restored";

/// When the last user-initiated profile write happened, shared between the
/// apply command and the watchdog so a fresh apply postpones the next check.
#[derive(Clone, Default)]
pub struct ApplyStamp(Arc<Mutex<Option<Instant>>>);

impl ApplyStamp {
    /// Marks now as the moment of the latest user apply.
    pub fn record(&self) {
        if let Ok(mut stamp) = self.0.lock() {
            *stamp = Some(Instant::now());
        }
    }

    /// Whether a user apply happened within the hold-off window.
    fn is_recent(&self) -> bool {
        match self.0.lock() {
            Ok(stamp) => stamp.is_some_and(|at| at.elapsed() < APPLY_HOLD_OFF),
            Err(_) => false,
        }
    }
}

/// Starts the watchdog thread. Called once from setup; the detached thread
/// lives until the process exits.
pub fn spawn(app: AppHandle, cooler: CoolerHandle, settings: SettingsHandle, stamp: ApplyStamp) {
    let spawned = std::thread::Builder::new()
        .name("profile-watchdog".to_owned())
        .spawn(move || run(&app, &cooler, &settings, &stamp));
    if let Err(error) = spawned {
        eprintln!("failed to start the profile watchdog: {error}");
    }
}

/// The watchdog loop: one check per interval, for the life of the process.
/// A failed check is logged and retried at the next interval.
fn run(app: &AppHandle, cooler: &CoolerHandle, settings: &SettingsHandle, stamp: &ApplyStamp) {
    loop {
        std::thread::sleep(CHECK_INTERVAL);
        if stamp.is_recent() {
            continue;
        }
        match check_and_restore(&cooler.0, settings) {
            Ok(false) => {}
            Ok(true) => {
                if let Err(error) = app.emit(RESTORED_EVENT, ()) {
                    eprintln!("profile watchdog: restore event failed: {error}");
                }
            }
            Err(message) => eprintln!("profile watchdog: {message}"),
        }
    }
}

/// Compares the profile the cooler is running against the saved one and
/// re-applies the saved profile when they differ. The cooler lock is held
/// across the read and the write so an IPC apply can never interleave.
///
/// # Returns
/// `true` when the saved profile had to be pushed back, `false` when there
/// was nothing to do (no saved profile, no open cooler, or a match).
///
/// # Errors
/// Returns `Err` with a message when a mutex is poisoned, the saved profile
/// is not a legal curve set, or a device read or write fails.
fn check_and_restore(
    cooler: &Mutex<Option<Cooler>>,
    settings: &SettingsHandle,
) -> Result<bool, String> {
    let Some(saved) = settings.fan_profile()? else {
        return Ok(false);
    };
    let config = config_from_profile(&saved)?;
    let mut slot = cooler
        .lock()
        .map_err(|_| "cooler state mutex poisoned".to_owned())?;
    let Some(device) = slot.as_mut() else {
        return Ok(false);
    };
    let running = device.read_profile().map_err(|error| error.to_string())?;
    let matches = running
        .as_ref()
        .is_some_and(|current| FanProfile::from(current) == saved);
    if matches {
        return Ok(false);
    }
    device
        .apply_config(&config)
        .map_err(|error| error.to_string())?;

    Ok(true)
}
