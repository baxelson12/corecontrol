import { SERIES_COLORS } from "./components";
import type { CurveSeries } from "./components";

/** Builds a series from [temp, duty] pairs. */
function curve(name: string, color: string, pairs: readonly (readonly [number, number])[]): CurveSeries {
  return { name, color, points: pairs.map(([temp, duty]) => ({ temp, duty })) };
}

/**
 * Fallback fan curves, shown as the editing starting point when the device
 * is not running a custom profile (or the read failed). Series order matches
 * `profileToSeries`.
 */
export const DEFAULT_SERIES: readonly CurveSeries[] = [
  curve("Radiator fans", SERIES_COLORS.radiatorFans, [[30, 20], [60, 40], [85, 65], [105, 90]]),
  curve("Unit fan", SERIES_COLORS.unitFan, [[30, 25], [60, 40], [85, 55], [105, 80]]),
  curve("Pump", SERIES_COLORS.pump, [[25, 50], [55, 70], [80, 85], [100, 100]]),
];
