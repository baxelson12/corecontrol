//! Notification-area (system tray) integration.
//!
//! The tray icon lives for the whole app run. Its context menu offers
//! **Open**, which reveals the main window, **Settings**, which reveals it
//! on the settings page, and **Exit**, which quits the app; a left click on
//! the icon also reveals the window. Hovering the icon
//! refreshes its tooltip with live fan and pump readings, so the speeds are
//! a mouse-over away while the window sits hidden. The reveal helper is
//! shared with the single-instance hook in `lib.rs`, so launching the exe
//! again while the app sits in the tray surfaces the running instance.

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::{CoolerHandle, FanReadings};

/// Id of the tray icon, used to find it again for tooltip updates.
const TRAY_ID: &str = "main";
/// Tooltip shown before the first readings arrive or when a read fails.
const TOOLTIP_IDLE: &str = "CoreControl";
/// Menu id of the tray entry that reveals the main window.
const MENU_OPEN: &str = "open";
/// Menu id of the tray entry that reveals the window on the settings page.
const MENU_SETTINGS: &str = "settings";
/// Menu id of the tray entry that quits the app.
const MENU_EXIT: &str = "exit";
/// Event asking the frontend to show the settings page.
const OPEN_SETTINGS_EVENT: &str = "open-settings";

/// Shows, restores, and focuses the main window.
///
/// # Errors
/// Returns `Err` when the window is gone or a window call fails; both only
/// happen while the app is shutting down.
pub fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = app
        .get_webview_window("main")
        .ok_or(tauri::Error::WindowNotFound)?;
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;

    Ok(())
}

/// [`show_main_window`] for event-handler positions, where the failure can
/// only be logged.
pub fn reveal_main_window(app: &AppHandle) {
    if let Err(error) = show_main_window(app) {
        eprintln!("failed to reveal main window: {error}");
    }
}

/// Renders live readings into the tray tooltip text.
///
/// Windows truncates the tooltip at 63 characters for tray icons that never
/// opt in to the longer limit via `NIM_SETVERSION`, which the tray crate
/// does not do. The format below peaks at 62 characters when every reading
/// is at its maximum, so nothing is ever cut off.
fn format_tooltip(readings: FanReadings) -> String {
    let text = format!(
        "CoreControl\n\
         Radiator {} RPM\n\
         Block {} RPM\n\
         Pump {} RPM",
        readings.radiator_rpm, readings.waterblock_rpm, readings.pump_rpm,
    );
    debug_assert!(text.len() <= 63);

    text
}

/// Refreshes the tray tooltip with a fresh device reading, falling back to
/// the idle text when no cooler is open or the read fails.
///
/// The HID exchange runs on a blocking thread: hover events arrive on the
/// main thread, and the cooler mutex may be held by a slower operation.
/// Windows shows the tooltip only after a hover delay, so the refreshed
/// text is normally in place before the tooltip appears.
fn refresh_tooltip(app: &AppHandle) {
    let Some(state) = app.try_state::<CoolerHandle>() else {
        return;
    };
    let cooler = state.inner().clone();
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let tooltip = crate::read_fan_status(&cooler.0)
            .map_or_else(|_| TOOLTIP_IDLE.to_owned(), format_tooltip);
        let Some(tray) = app.tray_by_id(TRAY_ID) else {
            return;
        };
        if let Err(error) = tray.set_tooltip(Some(tooltip)) {
            eprintln!("failed to set tray tooltip: {error}");
        }
    });
}

/// Reveals the main window on the settings page: shows the window, then
/// asks the frontend to switch views. A failed emit is logged; the window
/// is still revealed.
fn reveal_settings(app: &AppHandle) {
    reveal_main_window(app);
    if let Err(error) = app.emit(OPEN_SETTINGS_EVENT, ()) {
        eprintln!("failed to emit the open-settings event: {error}");
    }
}

/// Builds the tray icon with its Open/Settings/Exit menu and installs the
/// click handlers. Called once from setup.
///
/// # Errors
/// Returns `Err` when the menu or the tray icon cannot be created.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, MENU_OPEN, "Open", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, MENU_SETTINGS, "Settings", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, MENU_EXIT, "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &settings, &exit])?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip(TOOLTIP_IDLE)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == MENU_OPEN {
                reveal_main_window(app);
            } else if event.id.as_ref() == MENU_SETTINGS {
                reveal_settings(app);
            } else if event.id.as_ref() == MENU_EXIT {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => reveal_main_window(tray.app_handle()),
            TrayIconEvent::Enter { .. } => refresh_tooltip(tray.app_handle()),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;

    Ok(())
}
