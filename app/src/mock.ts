import { SERIES_COLORS } from "./components";
import type { CurveSeries } from "./components";
import type { StatCardProps } from "./components";

/** Static channel readouts, matching the design mock. */
export const MOCK_STATS: readonly StatCardProps[] = [
  { label: "Radiator fans", color: SERIES_COLORS.radiatorFans, rpm: 1240, dutyPct: 62 },
  { label: "Unit fan", color: SERIES_COLORS.unitFan, rpm: 1850, dutyPct: 48 },
  { label: "Pump", color: SERIES_COLORS.pump, rpm: 2760, dutyPct: 75 },
];

/** Builds a series from [temp, duty] pairs. */
function curve(name: string, color: string, pairs: readonly (readonly [number, number])[]): CurveSeries {
  return { name, color, points: pairs.map(([temp, duty]) => ({ temp, duty })) };
}

/** Default fan curves from the design mock. */
export const MOCK_SERIES: readonly CurveSeries[] = [
  curve("Radiator fans", SERIES_COLORS.radiatorFans, [[30, 20], [60, 40], [85, 65], [105, 90]]),
  curve("Unit fan", SERIES_COLORS.unitFan, [[30, 25], [60, 40], [85, 55], [105, 80]]),
  curve("Pump", SERIES_COLORS.pump, [[25, 50], [55, 70], [80, 85], [100, 100]]),
];
