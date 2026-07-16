import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { match } from "ts-pattern";
import type { CurvePoint, CurveSeries, CurveSource } from "../components/types";
import { DEFAULT_SERIES } from "../defaults";
import { applyFanProfile, profileToSeries, readFanProfile, seriesToProfile } from "../utils/profile";
import type { ProfileRead } from "../utils/profile";

const SNAP = 5;
const TEMP_MAX = 120;
const DUTY_MAX = 100;

interface CurvesState {
  /** Curves as currently edited on the chart. */
  readonly edited: readonly CurveSeries[];
  /** Curves last confirmed on the device. */
  readonly applied: readonly CurveSeries[];
  /** Whether `applied` was read from (or written to) the device, or is the
   * design fallback shown while no custom profile is running. */
  readonly source: CurveSource;
}

/** Identifies one dragged point and its new chart-domain position. */
export interface PointMove {
  readonly seriesIndex: number;
  readonly pointIndex: number;
  readonly point: CurvePoint;
}

/**
 * Loads the profile the device is currently running. `readFanProfile` folds
 * its own failures into the outcome union, so this thunk always fulfills.
 */
export const profileLoadStarted = createAsyncThunk("curves/load", readFanProfile);

/**
 * Writes the given curves to the device. Fulfills with whether the device
 * accepted them; the reducer only commits the curves as applied on success.
 */
export const curvesApplied = createAsyncThunk(
  "curves/apply",
  async (series: readonly CurveSeries[]): Promise<boolean> => {
    const profile = seriesToProfile(series);
    return profile === null ? false : applyFanProfile(profile);
  },
);

const initialState: CurvesState = {
  edited: DEFAULT_SERIES,
  applied: DEFAULT_SERIES,
  source: "defaults",
};

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
  },
  extraReducers: (builder) => {
    builder.addCase(profileLoadStarted.fulfilled, (_state, action): CurvesState =>
      match<ProfileRead, CurvesState>(action.payload)
        .with({ state: "running" }, ({ profile }) => {
          const series = profileToSeries(profile);
          return { edited: series, applied: series, source: "device" };
        })
        .otherwise(() => initialState),
    );
    builder.addCase(curvesApplied.fulfilled, (state, action): CurvesState => {
      if (!action.payload) return state;
      return { edited: state.edited, applied: action.meta.arg, source: "device" };
    });
  },
});

/**
 * Whether the chart shows state the device is not running: edits differing
 * from the applied curves, or fallback defaults never written to the device.
 */
export function selectCurvesDirty(state: { readonly curves: CurvesState }): boolean {
  const { edited, applied, source } = state.curves;
  if (source === "defaults") return true;
  if (edited.length !== applied.length) return true;
  return !edited.every((s, i) => {
    const t = applied[i];
    return t !== undefined && sameSeries(s, t);
  });
}

export const { pointMoved: curvePointMoved, reverted: curvesReverted } = curvesSlice.actions;
export const curvesReducer = curvesSlice.reducer;
