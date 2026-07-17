import { createAsyncThunk } from '@reduxjs/toolkit';
import { saveFanProfile } from '../settings/settings.ipc';
import type { CurveSeries, CurvesState } from './curves.types';
import { sameProfile, seriesToProfile } from './profile';
import { applyFanProfile, readFanProfile } from './profile.ipc';

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
 * the saved settings. Fulfills with how the push ended.
 */
export const savedProfilePushStarted = createAsyncThunk<
  SavedPushOutcome,
  void,
  { state: { curves: CurvesState } }
>('curves/pushSaved', async (_ignored, { getState }) => {
  const { applied, source } = getState().curves;
  if (source !== 'saved') {
    return { result: 'skipped' };
  }
  const profile = seriesToProfile(applied);
  if (profile === null) {
    return { result: 'skipped' };
  }
  const written = await applyFanProfile(profile);
  return written.accepted ? { result: 'applied' } : { result: 'failed', message: written.message };
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
 * launch. Gives up after `VERIFY_MAX_ATTEMPTS` polls (~15 s); the reducer only
 * commits the curves as applied on confirmation.
 */
export const curvesApplied = createAsyncThunk(
  'curves/apply',
  async (series: readonly CurveSeries[]): Promise<ApplyOutcome> => {
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
  },
);
