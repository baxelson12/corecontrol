import { createAsyncThunk } from '@reduxjs/toolkit';
import { match } from 'ts-pattern';
import type { ToastRequest } from '../../core/toasts/toasts.slice';
import { toastPushed } from '../../core/toasts/toasts.slice';
import type { CurveSeries } from '../../entities/channels/channels.types';
import { sameProfile, seriesToProfile } from '../../entities/profile/profile';
import { applyFanProfile, readFanProfile } from '../../entities/profile/profile.ipc';
import { saveFanProfile } from '../../entities/settings/settings.ipc';
import type { CurvesState } from './curves.types';

/** How often the device is asked whether it runs the applied profile. */
const VERIFY_INTERVAL_MS = 500;
/** Read-back attempts before an apply counts as unconfirmed (~15 s). */
const VERIFY_MAX_ATTEMPTS = 30;

/** How one profile write ended. */
export type ApplyOutcome =
  /** The device reported the new profile back. */
  | { readonly result: 'confirmed' }
  /** The device accepted the write but never reported it back. */
  | { readonly result: 'unconfirmed' }
  /** The write itself failed. */
  | { readonly result: 'rejected'; readonly message: string };

/** How the startup push of the saved profile ended. */
export type SavedPushOutcome =
  /** The device accepted the saved profile. */
  | { readonly result: 'applied' }
  /** Nothing to push: the shown curves did not come from saved settings. */
  | { readonly result: 'skipped' }
  /** The device refused the saved profile. */
  | { readonly result: 'failed'; readonly message: string };

/**
 * Pushes the saved profile to the cooler once one is open, so the app, not
 * the device, decides what runs. A no-op unless the shown curves came from
 * the saved settings. Fulfills with how the push ended; a failure also
 * queues an error toast.
 */
export const savedProfilePushStarted = createAsyncThunk<
  SavedPushOutcome,
  void,
  { state: { curves: CurvesState } }
>('curves/pushSaved', async (_ignored, { dispatch, getState }) => {
  const { applied, source } = getState().curves;
  if (source !== 'saved') {
    return { result: 'skipped' };
  }
  const profile = seriesToProfile(applied);
  if (profile === null) {
    return { result: 'skipped' };
  }
  const written = await applyFanProfile(profile);
  if (written.accepted) {
    return { result: 'applied' };
  }
  dispatch(
    toastPushed({ kind: 'error', title: 'Saved profile not applied', body: written.message }),
  );
  return { result: 'failed', message: written.message };
});

/** Resolves after `ms` milliseconds. */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Writes the given curves to the device, then polls the device's read-back
 * until it reports the new profile, confirming the write took effect. On
 * confirmation the profile is persisted as the saved profile for the next
 * launch. Gives up after `VERIFY_MAX_ATTEMPTS` polls (~15 s).
 */
async function applyAndVerify(series: readonly CurveSeries[]): Promise<ApplyOutcome> {
  const profile = seriesToProfile(series);
  if (profile === null) {
    return { result: 'rejected', message: 'the chart is missing a curve' };
  }
  const written = await applyFanProfile(profile);
  if (!written.accepted) {
    return { result: 'rejected', message: written.message };
  }
  for (let attempt = 0; attempt < VERIFY_MAX_ATTEMPTS; attempt += 1) {
    await sleep(VERIFY_INTERVAL_MS);
    const running = await readFanProfile();
    if (running !== null && sameProfile(running, profile)) {
      await saveFanProfile(profile);
      return { result: 'confirmed' };
    }
  }
  return { result: 'unconfirmed' };
}

/** The toast announcing how an apply ended; the unconfirmed outcome stays
 * quiet because the apply-progress toast takes over. */
function applyToast(outcome: ApplyOutcome): ToastRequest | null {
  return match<ApplyOutcome, ToastRequest | null>(outcome)
    .with({ result: 'confirmed' }, () => ({
      kind: 'success',
      title: 'Fan profile applied',
      body: 'The cooler confirmed the new profile.',
    }))
    .with({ result: 'rejected' }, ({ message }) => ({
      kind: 'error',
      title: 'Profile apply failed',
      body: message,
    }))
    .with({ result: 'unconfirmed' }, () => null)
    .exhaustive();
}

/**
 * Applies the edited curves and verifies them against the device read-back,
 * queueing the outcome toast. Unexpected failures fold into the rejected
 * outcome, so this thunk always fulfills and the reducer only commits the
 * curves as applied on confirmation.
 */
export const curvesApplied = createAsyncThunk(
  'curves/apply',
  async (series: readonly CurveSeries[], { dispatch }): Promise<ApplyOutcome> => {
    let outcome: ApplyOutcome;
    try {
      outcome = await applyAndVerify(series);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = { result: 'rejected', message };
    }
    const toast = applyToast(outcome);
    if (toast !== null) {
      dispatch(toastPushed(toast));
    }
    return outcome;
  },
);
