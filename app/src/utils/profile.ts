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
 * Validates a value from outside the typed world (an IPC reply, a settings
 * field) as a fan profile with firmware-legal curve lengths.
 *
 * @returns The profile, or `null` when the value is not one.
 */
export function parseProfile(value: unknown): FanProfile | null {
  return match<unknown, FanProfile | null>(value)
    .with(profilePattern, (profile) =>
      [profile.radiators, profile.waterblock, profile.pump].every(legalLength) ? profile : null,
    )
    .otherwise(() => null);
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
