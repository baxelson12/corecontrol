//! Persistent app settings: the theme choice, the saved fan profile, and
//! the preferences from the settings page.
//!
//! Settings live as JSON in `settings.json` under the per-user app config
//! directory (`%APPDATA%\com.coreliquid.app` on Windows). The file is read
//! once at startup into managed state; each save updates that state and
//! writes the whole file back atomically (temp file, then rename).

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use crate::{config_from_profile, FanProfile};

/// UI theme choice persisted across launches.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeName {
    /// The Fluent light theme.
    Light,
    /// The Fluent dark theme.
    Dark,
}

/// What the close button does with the window.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseBehavior {
    /// Close exits the app.
    Exit,
    /// Close hides the window; the app stays in the notification area.
    Tray,
}

/// Everything the app persists between launches. An absent field means
/// "never set": the UI then falls back to the system theme preference, the
/// design-default curves, and the default preferences (close exits, watchdog
/// on, restore notifications on, update check on).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    /// Explicit theme choice, or `None` to follow the system preference.
    pub theme: Option<ThemeName>,
    /// Fan profile last applied to the cooler, or `None` when none has been
    /// applied yet.
    pub fan_profile: Option<FanProfile>,
    /// What the close button does, or `None` for the default (exit).
    pub close_behavior: Option<CloseBehavior>,
    /// Whether the profile watchdog runs, or `None` for the default (on).
    pub watchdog_enabled: Option<bool>,
    /// Whether a watchdog restore notifies the user, or `None` for the
    /// default (on).
    pub restore_notify: Option<bool>,
    /// Whether startup checks GitHub for a newer release, or `None` for the
    /// default (on).
    pub update_check: Option<bool>,
}

/// The preferences the settings page saves in one piece: everything in
/// [`AppSettings`] except the theme and the fan profile, which have their
/// own save commands.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    /// What the close button does with the window.
    pub close_behavior: CloseBehavior,
    /// Whether the profile watchdog runs.
    pub watchdog_enabled: bool,
    /// Whether a watchdog restore notifies the user.
    pub restore_notify: bool,
    /// Whether startup checks GitHub for a newer release.
    pub update_check: bool,
}

/// The settings file path and its in-memory copy, shared between IPC
/// commands. The mutex serializes read-modify-write cycles so concurrent
/// saves cannot interleave.
struct SettingsStore {
    path: PathBuf,
    settings: Mutex<AppSettings>,
}

/// Cloneable handle to the shared [`SettingsStore`], for Tauri-managed state.
#[derive(Clone)]
pub struct SettingsHandle(Arc<SettingsStore>);

impl SettingsHandle {
    /// Reads the settings file at `path` (falling back to defaults when it
    /// is missing or invalid) and wraps it for sharing between commands.
    pub fn load(path: PathBuf) -> Self {
        let settings = read_settings(&path);
        SettingsHandle(Arc::new(SettingsStore {
            path,
            settings: Mutex::new(settings),
        }))
    }

    /// Returns a copy of the current settings.
    ///
    /// # Errors
    /// Returns `Err` with a message when the settings mutex is poisoned.
    fn snapshot(&self) -> Result<AppSettings, String> {
        let guard = self
            .0
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_owned())?;

        Ok(guard.clone())
    }

    /// Returns the saved fan profile, or `None` when none has been applied
    /// yet. Read by the profile watchdog on every check.
    ///
    /// # Errors
    /// Returns `Err` with a message when the settings mutex is poisoned.
    pub fn fan_profile(&self) -> Result<Option<FanProfile>, String> {
        Ok(self.snapshot()?.fan_profile)
    }

    /// Returns whether the profile watchdog should run; an unset preference
    /// means yes. Read by the watchdog on every check.
    ///
    /// # Errors
    /// Returns `Err` with a message when the settings mutex is poisoned.
    pub fn watchdog_enabled(&self) -> Result<bool, String> {
        Ok(self.snapshot()?.watchdog_enabled.unwrap_or(true))
    }

    /// Applies `update` to the settings and writes them to disk.
    ///
    /// # Errors
    /// Returns `Err` with a message when the settings mutex is poisoned or
    /// the file write fails.
    fn update(&self, update: impl FnOnce(&mut AppSettings)) -> Result<(), String> {
        let mut guard = self
            .0
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_owned())?;
        update(&mut guard);

        write_settings(&self.0.path, &guard)
    }
}

/// Reads and validates the settings file. A missing or unreadable file, or
/// one that does not parse, yields the defaults; a file that parses but
/// carries a profile that is not a legal curve set keeps the theme and drops
/// the profile.
fn read_settings(path: &Path) -> AppSettings {
    let Ok(raw) = fs::read_to_string(path) else {
        return AppSettings::default();
    };
    let Ok(mut settings) = serde_json::from_str::<AppSettings>(&raw) else {
        return AppSettings::default();
    };
    let valid = settings
        .fan_profile
        .as_ref()
        .is_none_or(|profile| config_from_profile(profile).is_ok());
    if !valid {
        settings.fan_profile = None;
    }

    settings
}

/// Serializes `settings` and writes them to `path` atomically: the JSON goes
/// to a sibling temp file first, then replaces the real file by rename.
///
/// # Errors
/// Returns `Err` with a message when the directory cannot be created or the
/// serialization, write, or rename fails.
fn write_settings(path: &Path, settings: &AppSettings) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "settings path has no parent directory".to_owned())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let json = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, json).map_err(|error| error.to_string())?;

    fs::rename(&temp, path).map_err(|error| error.to_string())
}

/// IPC command: returns the persisted settings loaded at startup.
///
/// # Errors
/// Returns `Err` with a message when the settings mutex is poisoned.
#[tauri::command]
pub fn load_settings(state: tauri::State<'_, SettingsHandle>) -> Result<AppSettings, String> {
    state.snapshot()
}

/// IPC command: persists the user's theme choice; `None` clears it so later
/// launches follow the system preference again.
///
/// Runs the file write on a blocking thread so the IPC runtime is never
/// stalled by the disk.
///
/// # Errors
/// Returns `Err` with a message when the settings mutex is poisoned or the
/// file write fails.
#[tauri::command]
pub async fn save_theme(
    state: tauri::State<'_, SettingsHandle>,
    theme: Option<ThemeName>,
) -> Result<(), String> {
    let handle = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || handle.update(|settings| settings.theme = theme))
        .await
        .map_err(|error| error.to_string())?
}

/// IPC command: persists the preferences from the settings page in one
/// write.
///
/// Runs the file write on a blocking thread so the IPC runtime is never
/// stalled by the disk.
///
/// # Errors
/// Returns `Err` with a message when the settings mutex is poisoned or the
/// file write fails.
#[tauri::command]
pub async fn save_preferences(
    state: tauri::State<'_, SettingsHandle>,
    preferences: Preferences,
) -> Result<(), String> {
    let handle = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        handle.update(|settings| {
            settings.close_behavior = Some(preferences.close_behavior);
            settings.watchdog_enabled = Some(preferences.watchdog_enabled);
            settings.restore_notify = Some(preferences.restore_notify);
            settings.update_check = Some(preferences.update_check);
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

/// IPC command: validates and persists the fan profile last applied to the
/// cooler, so the next launch can push it back to the device.
///
/// Runs the file write on a blocking thread so the IPC runtime is never
/// stalled by the disk.
///
/// # Errors
/// Returns `Err` with a message when the profile is not a legal curve set,
/// the settings mutex is poisoned, or the file write fails.
#[tauri::command]
pub async fn save_fan_profile(
    state: tauri::State<'_, SettingsHandle>,
    profile: FanProfile,
) -> Result<(), String> {
    config_from_profile(&profile)?;
    let handle = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        handle.update(|settings| settings.fan_profile = Some(profile))
    })
    .await
    .map_err(|error| error.to_string())?
}
