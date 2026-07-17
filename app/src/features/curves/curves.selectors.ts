import type { ApplyPhase, CurveSeries, CurvesState } from './curves.types';

/** Whether two series match in name, color, and every point. */
function sameSeries(a: CurveSeries, b: CurveSeries): boolean {
  if (a.name !== b.name || a.color !== b.color || a.points.length !== b.points.length) return false;
  return a.points.every((p, i) => {
    const q = b.points[i];
    return q !== undefined && p.temp === q.temp && p.duty === q.duty;
  });
}

/**
 * Whether the chart shows state the device is not running: edits differing
 * from the applied curves, or curves (saved or fallback defaults) the device
 * has not yet confirmed.
 *
 * @returns `true` when the shown curves are not confirmed on the device.
 */
export function selectCurvesDirty(state: { readonly curves: CurvesState }): boolean {
  const { edited, applied, source } = state.curves;
  if (source !== 'device') return true;
  if (edited.length !== applied.length) return true;
  return !edited.every((s, i) => {
    const t = applied[i];
    return t !== undefined && sameSeries(s, t);
  });
}

/** Where the in-flight profile write stands, for the apply toast. */
export function selectApplyPhase(state: { readonly curves: CurvesState }): ApplyPhase {
  return state.curves.applyPhase;
}
