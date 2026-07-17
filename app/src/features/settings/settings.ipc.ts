import { invoke } from "@tauri-apps/api/core";
import { match, P } from "ts-pattern";
import type { ThemeName } from "../theme/theme.types";
import { parseProfile } from "../curves/profile";
import type { FanProfile } from "../curves/profile";

/** Settings persisted across launches, as exchanged with the backend. */
export interface AppSettings {
  /** Explicit theme choice, or `null` to follow the system preference. */
  readonly theme: ThemeName | null;
  /** Fan profile last applied to the cooler, or `null` when none has been
   * applied yet. */
  readonly fanProfile: FanProfile | null;
}

/** What a fresh install reports: nothing chosen, nothing saved. */
const EMPTY_SETTINGS: AppSettings = { theme: null, fanProfile: null };

/**
 * Loads the persisted settings. Folds failures (IPC error, malformed reply,
 * illegal saved profile) into the empty settings so the caller falls back to
 * the system theme and the default curves. Never throws.
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const reply: unknown = await invoke("load_settings");
    return match<unknown, AppSettings>(reply)
      .with(
        { theme: P.union("light", "dark", P.nullish), fanProfile: P._ },
        ({ theme, fanProfile }) => ({
          theme: theme ?? null,
          fanProfile: parseProfile(fanProfile),
        }),
      )
      .otherwise(() => EMPTY_SETTINGS);
  } catch (error) {
    console.error("settings load failed:", error);
    return EMPTY_SETTINGS;
  }
}

/**
 * Persists the user's explicit theme choice. Folds failures into a console
 * error; the in-app theme has already switched and stays switched. Never
 * throws.
 */
export async function saveTheme(theme: ThemeName): Promise<void> {
  try {
    await invoke("save_theme", { theme });
  } catch (error) {
    console.error("theme save failed:", error);
  }
}

/**
 * Persists the profile just applied to the cooler, so the next launch pushes
 * it back to the device. Folds failures into a console error; the device
 * already runs the profile, only the saved copy is stale. Never throws.
 */
export async function saveFanProfile(profile: FanProfile): Promise<void> {
  try {
    await invoke("save_fan_profile", { profile });
  } catch (error) {
    console.error("profile save failed:", error);
  }
}
