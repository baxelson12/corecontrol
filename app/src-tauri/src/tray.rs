//! Notification-area (system tray) integration.
//!
//! The tray icon lives for the whole app run. Its context menu offers
//! **Open**, which reveals the main window, and **Exit**, which quits the
//! app; a left click on the icon also reveals the window. The reveal helper
//! is shared with the single-instance hook in `lib.rs`, so launching the exe
//! again while the app sits in the tray surfaces the running instance.

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

/// Menu id of the tray entry that reveals the main window.
const MENU_OPEN: &str = "open";
/// Menu id of the tray entry that quits the app.
const MENU_EXIT: &str = "exit";

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

/// Builds the tray icon with its Open/Exit menu and installs the click
/// handlers. Called once from setup.
///
/// # Errors
/// Returns `Err` when the menu or the tray icon cannot be created.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, MENU_OPEN, "Open", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, MENU_EXIT, "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &exit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("CoreControl")
        .on_menu_event(|app, event| {
            if event.id.as_ref() == MENU_OPEN {
                reveal_main_window(app);
            } else if event.id.as_ref() == MENU_EXIT {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            let left_click_up = matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            );
            if left_click_up {
                reveal_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;

    Ok(())
}
