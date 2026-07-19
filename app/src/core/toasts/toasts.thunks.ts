import { createAsyncThunk } from '@reduxjs/toolkit';
import { notifyIfHidden } from '../notifications/notify';
import { toastPushed } from './toasts.slice';

/** The one preference this thunk reads, kept structural so the queue stays
 * independent of the settings entity. */
interface RestoreNotifyState {
  readonly settings: { readonly preferences: { readonly restoreNotify: boolean } };
}

/**
 * Handles the backend's profile-restored event: when restore notifications
 * are on, queues the in-app toast and, for a hidden window, sends an OS
 * notification instead. Silent when the preference is off.
 */
export const profileRestoreNotified = createAsyncThunk<void, void, { state: RestoreNotifyState }>(
  'toasts/restoreNotified',
  async (_ignored, { dispatch, getState }) => {
    if (!getState().settings.preferences.restoreNotify) {
      return;
    }
    dispatch(
      toastPushed({
        kind: 'success',
        title: 'Fan profile restored',
        body: 'The cooler had drifted from the saved profile; it was pushed back.',
      }),
    );
    await notifyIfHidden(
      'Fan profile restored',
      'The cooler had drifted from the saved profile; CoreControl pushed it back.',
    );
  },
);
