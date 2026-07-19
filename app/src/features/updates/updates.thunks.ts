import { createAsyncThunk } from '@reduxjs/toolkit';
import { getVersion } from '@tauri-apps/api/app';
import { notifyIfHidden } from '../notifications/notify';
import type { SettingsState } from '../settings/settings.slice';
import { updateAvailable } from '../toasts/toasts.slice';
import { fetchLatestVersion, isNewerVersion } from './updates.github';

/**
 * Startup update check: when the preference is on, compares the newest
 * GitHub release against the running version and announces a newer one with
 * a toast and, for a hidden window, an OS notification. A failed lookup
 * stays silent; the next launch tries again.
 */
export const updateCheckStarted = createAsyncThunk<
  void,
  void,
  { state: { settings: SettingsState } }
>('updates/checkStarted', async (_ignored, { dispatch, getState }) => {
  if (!getState().settings.preferences.updateCheck) {
    return;
  }
  const [current, latest] = await Promise.all([getVersion(), fetchLatestVersion()]);
  if (latest === null || !isNewerVersion(latest, current)) {
    return;
  }
  dispatch(updateAvailable(latest));
  await notifyIfHidden('Update available', `CoreControl ${latest} is out on GitHub.`);
});
