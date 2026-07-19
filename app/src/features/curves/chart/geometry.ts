import type { CurvePoint, CurveSeries } from '../../../entities/channels/channels.types';

export const VIEW_WIDTH = 620;
export const VIEW_HEIGHT = 300;
export const PLOT_LEFT = 46;
export const PLOT_RIGHT = 606;
export const PLOT_TOP = 14;
export const PLOT_BOTTOM = 262;
export const GRID_STEP = 5;
export const DUTY_MAX = 100;
export const DEFAULT_TEMP_MAX = 120;
/** How close a press must land to a point handle to grab it, in viewBox units. */
export const GRAB_RADIUS = 12;
/** How close a press must land to a curve line to select it, in viewBox units. */
export const LINE_HIT_RADIUS = 8;

/** Identifies one curve point found by hit-testing. */
export interface HandleHit {
  readonly seriesIndex: number;
  readonly pointIndex: number;
}

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

/** A position in viewBox coordinates. */
interface ViewPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Maps chart points to viewBox coordinates, extended flat to both plot edges
 * so the polyline covers the full temperature range. An empty list stays
 * empty.
 */
function extendedViewPoints(points: readonly CurvePoint[], tempMax: number): readonly ViewPoint[] {
  const px = points.map((p) => ({
    x: tempToX(clamp(p.temp, 0, tempMax), tempMax),
    y: dutyToY(clamp(p.duty, 0, DUTY_MAX)),
  }));
  const first = px[0];
  const last = px[px.length - 1];
  if (first === undefined || last === undefined) return [];
  return [{ x: PLOT_LEFT, y: first.y }, ...px, { x: PLOT_RIGHT, y: last.y }];
}

/**
 * Builds the SVG path for a point list, extended horizontally to both plot
 * edges so the curve covers the full temperature range. An empty list yields
 * an empty path.
 */
export function linePath(points: readonly CurvePoint[], tempMax: number): string {
  const px = extendedViewPoints(points, tempMax);
  const head = px[0];
  if (head === undefined) return '';
  const rest = px
    .slice(1)
    .map((p) => ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join('');
  return `M${head.x.toFixed(1)} ${head.y.toFixed(1)}${rest}`;
}

/**
 * Maps viewBox coordinates to a chart-domain point clamped to the plot area.
 * `tempMax` must be positive.
 */
export function viewToPoint(viewX: number, viewY: number, tempMax: number): CurvePoint {
  const temp = ((viewX - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT)) * tempMax;
  const duty = ((PLOT_BOTTOM - viewY) / (PLOT_BOTTOM - PLOT_TOP)) * DUTY_MAX;
  return { temp: clamp(temp, 0, tempMax), duty: clamp(duty, 0, DUTY_MAX) };
}

/** Distance from a point to the segment between `a` and `b`. */
function distanceToSegment(px: number, py: number, a: ViewPoint, b: ViewPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp(((px - a.x) * dx + (py - a.y) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/**
 * Finds the curve point nearest to a viewBox position, within `GRAB_RADIUS`.
 * Points of the active series beat closer points of other series, so a
 * selected curve stays grabbable where handles overlap. Returns null when no
 * point is in reach.
 */
export function hitTestHandles(
  series: readonly CurveSeries[],
  activeIndex: number | null,
  viewX: number,
  viewY: number,
  tempMax: number,
): HandleHit | null {
  let best: { readonly hit: HandleHit; readonly dist: number; readonly active: boolean } | null =
    null;
  for (const [seriesIndex, s] of series.entries()) {
    const active = seriesIndex === activeIndex;
    for (const [pointIndex, p] of s.points.entries()) {
      const dist = Math.hypot(
        tempToX(clamp(p.temp, 0, tempMax), tempMax) - viewX,
        dutyToY(clamp(p.duty, 0, DUTY_MAX)) - viewY,
      );
      if (dist > GRAB_RADIUS) continue;
      const wins =
        best === null || (active && !best.active) || (active === best.active && dist < best.dist);
      if (wins) best = { hit: { seriesIndex, pointIndex }, dist, active };
    }
  }
  return best === null ? null : best.hit;
}

/**
 * Finds the curve line nearest to a viewBox position, within
 * `LINE_HIT_RADIUS`, including the flat extensions to the plot edges. Returns
 * the series index, or null when no line is close enough.
 */
export function hitTestLines(
  series: readonly CurveSeries[],
  viewX: number,
  viewY: number,
  tempMax: number,
): number | null {
  let bestIndex: number | null = null;
  let bestDist = LINE_HIT_RADIUS;
  for (const [seriesIndex, s] of series.entries()) {
    const px = extendedViewPoints(s.points, tempMax);
    for (let i = 0; i + 1 < px.length; i += 1) {
      const a = px[i];
      const b = px[i + 1];
      if (a === undefined || b === undefined) continue;
      const dist = distanceToSegment(viewX, viewY, a, b);
      if (dist <= bestDist) {
        bestDist = dist;
        bestIndex = seriesIndex;
      }
    }
  }
  return bestIndex;
}
