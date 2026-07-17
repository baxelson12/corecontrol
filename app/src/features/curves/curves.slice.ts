import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { match } from 'ts-pattern';
import { settingsLoadStarted } from '../settings/settings.thunks';
import { DEFAULT_SERIES } from './curves.defaults';
import { curvesApplied, savedProfilePushStarted } from './curves.thunks';
import type { CurvePoint, CurveSeries, CurvesState, PointMove } from './curves.types';
import { profileToSeries } from './profile';

const SNAP = 5;
const TEMP_MAX = 120;
const DUTY_MAX = 100;

const initialState: CurvesState = {
  edited: DEFAULT_SERIES,
  applied: DEFAULT_SERIES,
  source: 'defaults',
  applyPhase: 'idle',
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
    i === seriesIndex
      ? { ...s, points: s.points.map((p, j) => (j === pointIndex ? moved : p)) }
      : s,
  );
}

const curvesSlice = createSlice({
  name: 'curves',
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
    /** The user dismissed the unconfirmed-apply toast without retrying. */
    applyDismissed(state) {
      state.applyPhase = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(settingsLoadStarted.fulfilled, (state, action): CurvesState => {
      const profile = action.payload.fanProfile;
      if (profile === null) return state;
      const series = profileToSeries(profile);
      return { ...state, edited: series, applied: series, source: 'saved' };
    });
    builder.addCase(
      savedProfilePushStarted.fulfilled,
      (state, action): CurvesState =>
        action.payload.result === 'applied' ? { ...state, source: 'device' } : state,
    );
    builder.addCase(curvesApplied.pending, (state) => {
      state.applyPhase = 'verifying';
    });
    builder.addCase(
      curvesApplied.fulfilled,
      (state, action): CurvesState =>
        match(action.payload)
          .with(
            { result: 'confirmed' },
            (): CurvesState => ({
              ...state,
              applied: action.meta.arg,
              source: 'device',
              applyPhase: 'idle',
            }),
          )
          .with(
            { result: 'unconfirmed' },
            (): CurvesState => ({ ...state, applyPhase: 'unconfirmed' }),
          )
          .with({ result: 'rejected' }, (): CurvesState => ({ ...state, applyPhase: 'idle' }))
          .exhaustive(),
    );
    builder.addCase(curvesApplied.rejected, (state) => {
      state.applyPhase = 'idle';
    });
  },
});

export const {
  pointMoved: curvePointMoved,
  reverted: curvesReverted,
  applyDismissed: applyRetryDismissed,
} = curvesSlice.actions;
export const curvesReducer = curvesSlice.reducer;
