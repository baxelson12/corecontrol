import { invoke } from '@tauri-apps/api/core';
import { match, P } from 'ts-pattern';
import type { ChannelColors } from '../curves/curves.types';
import type { FanProfile } from '../curves/profile';
import { parseProfile } from '../curves/profile';
import type { ThemeName } from '../theme/theme.types';

/** What the close button does: exit the app, or hide to the tray. */
export type CloseBehavior = 'exit' | 'tray';

/** The preferences edited on the settings page, saved as one piece. */
export interface Preferences {
  /** What the close button does with the window. */
  readonly closeBehavior: CloseBehavior;
  /** Whether the backend watchdog keeps the saved profile applied. */
  readonly watchdogEnabled: boolean;
  /** Whether a watchdog restore notifies the user. */
  readonly restoreNotify: boolean;
  /** Whether startup checks GitHub for a newer release. */
  readonly updateCheck: boolean;
  /** CSS color per cooling channel, for the chart and the stat cards. */
  readonly channelColors: ChannelColors;
  /** Opacity of the other curves while one is focused, 0–1. */
  readonly dimmedOpacity: number;
}

/** Settings persisted across launches, as exchanged with the backend.
 * `null` fields were never set; the UI falls back to its defaults. */
export interface AppSettings {
  /** Explicit theme choice, or `null` to follow the system preference. */
  readonly theme: ThemeName | null;
  /** Fan profile last applied to the cooler, or `null` when none has been
   * applied yet. */
  readonly fanProfile: FanProfile | null;
  /** Close button behavior, or `null` for the default (exit). */
  readonly closeBehavior: CloseBehavior | null;
  /** Watchdog switch, or `null` for the default (on). */
  readonly watchdogEnabled: boolean | null;
  /** Restore notification switch, or `null` for the default (on). */
  readonly restoreNotify: boolean | null;
  /** Update check switch, or `null` for the default (on). */
  readonly updateCheck: boolean | null;
  /** Channel colors, or `null` for the design defaults. */
  readonly channelColors: ChannelColors | null;
  /** Focus-dimming opacity, or `null` for the default (0.35). */
  readonly dimmedOpacity: number | null;
}

/** What a fresh install reports: nothing chosen, nothing saved. */
const EMPTY_SETTINGS: AppSettings = {
  theme: null,
  fanProfile: null,
  closeBehavior: null,
  watchdogEnabled: null,
  restoreNotify: null,
  updateCheck: null,
  channelColors: null,
  dimmedOpacity: null,
};

/** Shape a raw IPC reply must have to count as settings. */
const settingsPattern = P.shape({
  theme: P.union('light', 'dark', P.nullish),
  fanProfile: P._,
  closeBehavior: P.union('exit', 'tray', P.nullish),
  watchdogEnabled: P.union(P.boolean, P.nullish),
  restoreNotify: P.union(P.boolean, P.nullish),
  updateCheck: P.union(P.boolean, P.nullish),
  channelColors: P._,
  dimmedOpacity: P.union(P.number, P.nullish),
});

/** Longest string accepted as a saved channel color. */
const MAX_COLOR_LENGTH = 64;

/** Whether a saved value is a CSS color the renderer can actually paint. */
function isCssColor(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_COLOR_LENGTH) {
    return false;
  }
  return CSS.supports('color', value);
}

/**
 * Validates a saved channel-color set. All three channels must carry a
 * paintable CSS color; anything else falls back to the design defaults.
 *
 * @returns The colors, or `null` when the value is not a usable set.
 */
function parseChannelColors(value: unknown): ChannelColors | null {
  return match<unknown, ChannelColors | null>(value)
    .with(
      {
        radiatorFans: P.when(isCssColor),
        unitFan: P.when(isCssColor),
        pump: P.when(isCssColor),
      },
      ({ radiatorFans, unitFan, pump }) => ({ radiatorFans, unitFan, pump }),
    )
    .otherwise(() => null);
}

/**
 * Validates a saved focus-dimming opacity.
 *
 * @returns The opacity, or `null` when it is not a finite 0–1 value.
 */
function parseDimmedOpacity(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 1 ? value : null;
}

/**
 * Loads the persisted settings. Folds failures (IPC error, malformed reply,
 * illegal saved profile) into the empty settings so the caller falls back to
 * the system theme, the default curves, and the default preferences. Never
 * throws.
 *
 * @returns The persisted settings, with unusable fields nulled out.
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const reply: unknown = await invoke('load_settings');
    return match<unknown, AppSettings>(reply)
      .with(settingsPattern, (settings) => ({
        theme: settings.theme ?? null,
        fanProfile: parseProfile(settings.fanProfile),
        closeBehavior: settings.closeBehavior ?? null,
        watchdogEnabled: settings.watchdogEnabled ?? null,
        restoreNotify: settings.restoreNotify ?? null,
        updateCheck: settings.updateCheck ?? null,
        channelColors: parseChannelColors(settings.channelColors),
        dimmedOpacity: parseDimmedOpacity(settings.dimmedOpacity),
      }))
      .otherwise(() => EMPTY_SETTINGS);
  } catch (error) {
    console.error('settings load failed:', error);
    return EMPTY_SETTINGS;
  }
}

/**
 * Persists the user's theme choice; `null` clears it so later launches
 * follow the system preference. Folds failures into a console error; the
 * in-app theme has already switched and stays switched. Never throws.
 */
export async function saveTheme(theme: ThemeName | null): Promise<void> {
  try {
    await invoke('save_theme', { theme });
  } catch (error) {
    console.error('theme save failed:', error);
  }
}

/**
 * Persists the settings-page preferences in one write. Folds failures into
 * a console error; the in-app state has already changed and stays changed.
 * Never throws.
 */
export async function savePreferences(preferences: Preferences): Promise<void> {
  try {
    await invoke('save_preferences', { preferences });
  } catch (error) {
    console.error('preferences save failed:', error);
  }
}

/** Quiet period before a preference change is written to disk. */
const SAVE_DEBOUNCE_MS = 250;

/** Pending debounced write, if any. Module-level so bursts share one timer. */
let pendingSave: ReturnType<typeof setTimeout> | null = null;

/**
 * Persists the preferences after a short quiet period, collapsing bursts of
 * changes (a slider or color-area drag fires one per pointer move) into a
 * single disk write carrying the latest value.
 */
export function savePreferencesDebounced(preferences: Preferences): void {
  if (pendingSave !== null) clearTimeout(pendingSave);
  pendingSave = setTimeout(() => {
    pendingSave = null;
    void savePreferences(preferences);
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Persists the profile just applied to the cooler, so the next launch pushes
 * it back to the device. Folds failures into a console error; the device
 * already runs the profile, only the saved copy is stale. Never throws.
 */
export async function saveFanProfile(profile: FanProfile): Promise<void> {
  try {
    await invoke('save_fan_profile', { profile });
  } catch (error) {
    console.error('profile save failed:', error);
  }
}
