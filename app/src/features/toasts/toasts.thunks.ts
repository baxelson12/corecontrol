import { createAsyncThunk } from '@reduxjs/toolkit';
import { notifyIfHidden } from '../notifications/notify';
import type { SettingsState } from '../settings/settings.slice';
import { savedProfileRestored } from './toasts.slice';

/**
 * Handles the backend's profile-restored event: when restore notifications
 * are on, queues the in-app toast and, for a hidden window, sends an OS
 * notification instead. Silent when the preference is off.
 */
export const profileRestoreNotified = createAsyncThunk<
  void,
  void,
  { state: { settings: SettingsState } }
>('toasts/restoreNotified', async (_ignored, { dispatch, getState }) => {
  if (!getState().settings.preferences.restoreNotify) {
    return;
  }
  dispatch(savedProfileRestored());
  await notifyIfHidden(
    'Fan profile restored',
    'The cooler had drifted from the saved profile; CoreControl pushed it back.',
  );
});
