import { SERIES_COLORS } from "./components";
import type { CurvePoint, CurveSeries } from "./components";
import type { StatCardProps } from "./components";

const SNAP = 5;
const TEMP_MAX = 120;
const DUTY_MAX = 100;

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

/**
 * Returns a copy of `series` with one point moved: snapped to 5° / 5% steps
 * and kept at least one step away from its neighbors, mirroring the design
 * mock's drag rules.
 */
export function movePoint(
  series: readonly CurveSeries[],
  seriesIndex: number,
  pointIndex: number,
  point: CurvePoint,
): readonly CurveSeries[] {
  const target = series[seriesIndex];
  if (target === undefined) return series;
  const prev = target.points[pointIndex - 1];
  const next = target.points[pointIndex + 1];
  const lo = prev === undefined ? 0 : prev.temp + SNAP;
  const hi = next === undefined ? TEMP_MAX : next.temp - SNAP;
  const moved: CurvePoint = {
    temp: Math.min(hi, Math.max(lo, Math.round(point.temp / SNAP) * SNAP)),
    duty: Math.min(DUTY_MAX, Math.max(0, Math.round(point.duty / SNAP) * SNAP)),
  };
  return series.map((s, i) =>
    i === seriesIndex ? { ...s, points: s.points.map((p, j) => (j === pointIndex ? moved : p)) } : s,
  );
}
