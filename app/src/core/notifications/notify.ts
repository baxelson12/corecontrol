import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

/**
 * Sends an OS notification, but only while the window is hidden; a visible
 * window shows the same news as an in-app toast instead. Folds every
 * failure (window gone, permission denied, plugin error) into a console
 * error. Never throws.
 */
export async function notifyIfHidden(title: string, body: string): Promise<void> {
  try {
    const visible = await getCurrentWindow().isVisible();
    if (visible) {
      return;
    }
    const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
    if (granted) {
      sendNotification({ title, body });
    }
  } catch (error) {
    console.error('notification failed:', error);
  }
}
