import { createSelector } from '@reduxjs/toolkit';
import type { ApplyPhase, ChannelColors, CurveSeries, CurvesState } from './curves.types';

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

/** The slices the colored-series selector reads. */
interface ColoredSeriesInput {
  readonly curves: CurvesState;
  readonly settings: { readonly preferences: { readonly channelColors: ChannelColors } };
}

/**
 * The edited curves with the user's channel colors applied, for display.
 * Purely cosmetic: dirty checks and profile writes use the raw edited
 * series, whose baked-in colors never change. Memoized so the chart only
 * re-renders when a curve or a color actually changes.
 */
export const selectColoredSeries = createSelector(
  [
    (state: ColoredSeriesInput) => state.curves.edited,
    (state: ColoredSeriesInput) => state.settings.preferences.channelColors,
  ],
  (edited, colors): readonly CurveSeries[] => {
    const order = [colors.radiatorFans, colors.unitFan, colors.pump];
    return edited.map((series, index) => ({ ...series, color: order[index] ?? series.color }));
  },
);
