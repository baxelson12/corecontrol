import { invoke } from "@tauri-apps/api/core";
import { match, P } from "ts-pattern";
import { SERIES_COLORS } from "../components/types";
import type { CurvePoint, CurveSeries } from "../components/types";

/** A fan profile as exchanged with the backend: one curve per channel. */
export interface FanProfile {
  /** Curve applied uniformly to the radiator fan channels. */
  readonly radiators: readonly CurvePoint[];
  /** Curve for the waterblock (60 mm) fan channel. */
  readonly waterblock: readonly CurvePoint[];
  /** Curve for the pump channel. */
  readonly pump: readonly CurvePoint[];
}

/** Outcome of reading the profile the device is currently running. */
export type ProfileRead =
  | { readonly state: "running"; readonly profile: FanProfile }
  | { readonly state: "none" }
  | { readonly state: "failed" };

/** Fewest points a curve may carry; the firmware rejects fewer. */
const MIN_POINTS = 4;
/** Most points a curve may carry; the wire format holds no more. */
const MAX_POINTS = 7;

/** Shape one raw curve point must have. */
const pointPattern = P.shape({
  temp: P.number.int().between(1, 120),
  duty: P.number.int().between(0, 100),
});

/** Shape a raw IPC reply must have to count as a `FanProfile`. */
const profilePattern = P.shape({
  radiators: P.array(pointPattern),
  waterblock: P.array(pointPattern),
  pump: P.array(pointPattern),
});

/** Whether a curve carries a point count the firmware accepts. */
function legalLength(points: readonly CurvePoint[]): boolean {
  return points.length >= MIN_POINTS && points.length <= MAX_POINTS;
}

/**
 * Reads the profile the cooler is currently running. Folds failures (no
 * cooler open, device error, malformed reply) into the `failed` state so the
 * caller can fall back to defaults. Never throws.
 *
 * @returns The read outcome: a running profile, `none` when the device is
 * not running a custom curve, or `failed`.
 */
export async function readFanProfile(): Promise<ProfileRead> {
  try {
    const reply: unknown = await invoke("read_fan_profile");
    return match<unknown, ProfileRead>(reply)
      .with(null, () => ({ state: "none" }))
      .with(profilePattern, (profile) =>
        [profile.radiators, profile.waterblock, profile.pump].every(legalLength)
          ? { state: "running", profile }
          : { state: "failed" },
      )
      .otherwise(() => ({ state: "failed" }));
  } catch (error) {
    console.error("profile read failed:", error);
    return { state: "failed" };
  }
}

/**
 * Applies a profile to the cooler. Folds failures into `false` so the caller
 * keeps the unsaved state. Never throws.
 *
 * @returns Whether the device accepted the profile.
 */
export async function applyFanProfile(profile: FanProfile): Promise<boolean> {
  try {
    await invoke("apply_fan_profile", { profile });
    return true;
  } catch (error) {
    console.error("profile apply failed:", error);
    return false;
  }
}

/** The three profile channels in display order, with their chart styling. */
const CHANNELS = [
  { key: "radiators", name: "Radiator fans", color: SERIES_COLORS.radiatorFans },
  { key: "waterblock", name: "Unit fan", color: SERIES_COLORS.unitFan },
  { key: "pump", name: "Pump", color: SERIES_COLORS.pump },
] as const;

/**
 * Maps a backend profile to the three chart series, in display order.
 *
 * @returns One series per channel.
 */
export function profileToSeries(profile: FanProfile): readonly CurveSeries[] {
  return CHANNELS.map(({ key, name, color }) => ({ name, color, points: profile[key] }));
}

/**
 * Maps the chart series back to a backend profile. The series must be in the
 * order `profileToSeries` produces.
 *
 * @returns The profile, or `null` when a series is missing.
 */
export function seriesToProfile(series: readonly CurveSeries[]): FanProfile | null {
  const [radiators, waterblock, pump] = series;
  if (radiators === undefined || waterblock === undefined || pump === undefined) {
    return null;
  }
  return { radiators: radiators.points, waterblock: waterblock.points, pump: pump.points };
}
