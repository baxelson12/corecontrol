import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { CurvePoint, CurveSeries } from "../components/types";
import { MOCK_SERIES } from "../mock";

const SNAP = 5;
const TEMP_MAX = 120;
const DUTY_MAX = 100;

interface CurvesState {
  /** Curves as currently edited on the chart. */
  readonly edited: readonly CurveSeries[];
  /** Curves last applied to the device. */
  readonly applied: readonly CurveSeries[];
}

/** Identifies one dragged point and its new chart-domain position. */
export interface PointMove {
  readonly seriesIndex: number;
  readonly pointIndex: number;
  readonly point: CurvePoint;
}

const initialState: CurvesState = { edited: MOCK_SERIES, applied: MOCK_SERIES };

/**
 * Returns a copy of `series` with one point moved: snapped to 5° / 5% steps
 * and kept at least one step away from its neighbors.
 */
function movePoint(series: readonly CurveSeries[], move: PointMove): readonly CurveSeries[] {
  const { seriesIndex, pointIndex, point } = move;
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

/** Whether two series match in name, color, and every point. */
function sameSeries(a: CurveSeries, b: CurveSeries): boolean {
  if (a.name !== b.name || a.color !== b.color || a.points.length !== b.points.length) return false;
  return a.points.every((p, i) => {
    const q = b.points[i];
    return q !== undefined && p.temp === q.temp && p.duty === q.duty;
  });
}

const curvesSlice = createSlice({
  name: "curves",
  initialState,
  reducers: {
    /** A chart point was dragged to a new position. */
    pointMoved(state, action: PayloadAction<PointMove>): CurvesState {
      return { ...state, edited: movePoint(state.edited, action.payload) };
    },
    /** Discards edits, restoring the applied curves. */
    reverted(state) {
      state.edited = state.applied;
    },
    /** Marks the edited curves as applied to the device. */
    applied(state) {
      state.applied = state.edited;
    },
  },
});

/** Whether the edited curves differ from the applied ones. */
export function selectCurvesDirty(state: { readonly curves: CurvesState }): boolean {
  const { edited, applied } = state.curves;
  if (edited.length !== applied.length) return true;
  return !edited.every((s, i) => {
    const t = applied[i];
    return t !== undefined && sameSeries(s, t);
  });
}

export const {
  pointMoved: curvePointMoved,
  reverted: curvesReverted,
  applied: curvesApplied,
} = curvesSlice.actions;
export const curvesReducer = curvesSlice.reducer;
