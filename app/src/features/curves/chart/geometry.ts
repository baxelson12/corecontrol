import type { CurvePoint } from '../curves.types';

export const VIEW_WIDTH = 620;
export const VIEW_HEIGHT = 300;
export const PLOT_LEFT = 46;
export const PLOT_RIGHT = 606;
export const PLOT_TOP = 14;
export const PLOT_BOTTOM = 262;
export const GRID_STEP = 5;
export const DUTY_MAX = 100;
export const DEFAULT_TEMP_MAX = 120;

/** Clamps a value into [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Maps a temperature to a viewBox x coordinate. */
export function tempToX(temp: number, tempMax: number): number {
  return PLOT_LEFT + (temp / tempMax) * (PLOT_RIGHT - PLOT_LEFT);
}

/** Maps a duty percentage to a viewBox y coordinate. */
export function dutyToY(duty: number): number {
  return PLOT_BOTTOM - (duty / DUTY_MAX) * (PLOT_BOTTOM - PLOT_TOP);
}

/**
 * Builds the SVG path for a point list, extended horizontally to both plot
 * edges so the curve covers the full temperature range. An empty list yields
 * an empty path.
 */
export function linePath(points: readonly CurvePoint[], tempMax: number): string {
  const px = points.map((p) => ({
    x: tempToX(clamp(p.temp, 0, tempMax), tempMax),
    y: dutyToY(clamp(p.duty, 0, DUTY_MAX)),
  }));
  const first = px[0];
  const last = px[px.length - 1];
  if (first === undefined || last === undefined) return '';
  const segments = px.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L');
  return `M${PLOT_LEFT} ${first.y.toFixed(1)} L${segments} L${PLOT_RIGHT} ${last.y.toFixed(1)}`;
}
