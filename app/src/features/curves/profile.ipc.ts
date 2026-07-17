import { invoke } from '@tauri-apps/api/core';
import type { FanProfile } from './profile';
import { parseProfile } from './profile';

/** Outcome of writing a profile to the cooler. */
export type ApplyResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly message: string };

/**
 * Applies a profile to the cooler. Folds failures into a rejection carrying
 * the backend's message so the caller can surface it. Never throws.
 *
 * @returns Whether the device accepted the profile.
 */
export async function applyFanProfile(profile: FanProfile): Promise<ApplyResult> {
  try {
    await invoke('apply_fan_profile', { profile });
    return { accepted: true };
  } catch (error) {
    console.error('profile apply failed:', error);
    return { accepted: false, message: String(error) };
  }
}

/**
 * Reads back the profile the cooler is currently running. Folds failures
 * (no cooler open, device read error, malformed reply) and the
 * no-custom-profile case into `null`, so a verification loop treats every
 * one as "not confirmed yet". Never throws.
 *
 * @returns The running profile, or `null` when none could be read.
 */
export async function readFanProfile(): Promise<FanProfile | null> {
  try {
    const reply: unknown = await invoke('read_fan_profile');
    return parseProfile(reply);
  } catch (error) {
    console.error('profile read-back failed:', error);
    return null;
  }
}
