import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { match } from "ts-pattern";
import type { CurvePoint, CurveSeries, CurveSource } from "../components/types";
import { DEFAULT_SERIES } from "../defaults";
import {
  applyFanProfile,
  profileToSeries,
  readFanProfile,
  sameProfile,
  seriesToProfile,
} from "../utils/profile";
import { saveFanProfile } from "../utils/settings";
import { settingsLoadStarted } from "./settingsThunks";

const SNAP = 5;
const TEMP_MAX = 120;
const DUTY_MAX = 100;

/** How often the device is asked whether it runs the applied profile. */
const VERIFY_INTERVAL_MS = 500;
/** Read-back attempts before an apply counts as unconfirmed (~15 s). */
const VERIFY_MAX_ATTEMPTS = 30;

/** Where a profile write currently stands, driving the apply toast. */
export type ApplyPhase =
  /** No write in flight. */
  | "idle"
  /** Written; polling the device until it reports the new profile. */
  | "verifying"
  /** The device never confirmed the write; a retry is on offer. */
  | "unconfirmed";

/** How one profile write ended. */
export type ApplyOutcome =
  /** The device reported the new profile back. */
  | { readonly result: "confirmed" }
  /** The device accepted the write but never reported it back. */
  | { readonly result: "unconfirmed" }
  /** The write itself failed. */
  | { readonly result: "rejected"; readonly message: string };

/** How the startup push of the saved profile ended. */
export type SavedPushOutcome =
  /** The device accepted the saved profile. */
  | { readonly result: "applied" }
  /** Nothing to push: the shown curves did not come from saved settings. */
  | { readonly result: "skipped" }
  /** The device refused the saved profile. */
  | { readonly result: "failed"; readonly message: string };

interface CurvesState {
  /** Curves as currently edited on the chart. */
  readonly edited: readonly CurveSeries[];
  /** Curves last confirmed on the device. */
  readonly applied: readonly CurveSeries[];
  /** Whether `applied` was read from (or written to) the device, or is the
   * design fallback shown while no custom profile is running. */
  readonly source: CurveSource;
  /** Where the in-flight profile write stands, if any. */
  readonly applyPhase: ApplyPhase;
}

/** Identifies one dragged point and its new chart-domain position. */
export interface PointMove {
  readonly seriesIndex: number;
  readonly pointIndex: number;
  readonly point: CurvePoint;
}

/**
 * Pushes the saved profile to the cooler once one is open, so the app, not
 * the device, decides what runs. A no-op unless the shown curves came from
 * the saved settings. Fulfills with how the push ended.
 */
export const savedProfilePushStarted = createAsyncThunk<
  SavedPushOutcome,
  void,
  { state: { curves: CurvesState } }
>("curves/pushSaved", async (_ignored, { getState }) => {
  const { applied, source } = getState().curves;
  if (source !== "saved") {
    return { result: "skipped" };
  }
  const profile = seriesToProfile(applied);
  if (profile === null) {
    return { result: "skipped" };
  }
  const written = await applyFanProfile(profile);
  return written.accepted
    ? { result: "applied" }
    : { result: "failed", message: written.message };
});

/** Resolves after `ms` milliseconds. */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Writes the given curves to the device, then polls the device's read-back
 * until it reports the new profile, confirming the write took effect. On
 * confirmation the profile is persisted as the saved profile for the next
 * launch. Gives up after `VERIFY_MAX_ATTEMPTS` polls (~15 s); the reducer only
 * commits the curves as applied on confirmation.
 */
export const curvesApplied = createAsyncThunk(
  "curves/apply",
  async (series: readonly CurveSeries[]): Promise<ApplyOutcome> => {
    const profile = seriesToProfile(series);
    if (profile === null) {
      return { result: "rejected", message: "the chart is missing a curve" };
    }
    const written = await applyFanProfile(profile);
    if (!written.accepted) {
      return { result: "rejected", message: written.message };
    }
    for (let attempt = 0; attempt < VERIFY_MAX_ATTEMPTS; attempt += 1) {
      await sleep(VERIFY_INTERVAL_MS);
      const running = await readFanProfile();
      if (running !== null && sameProfile(running, profile)) {
        await saveFanProfile(profile);
        return { result: "confirmed" };
      }
    }
    return { result: "unconfirmed" };
  },
);

const initialState: CurvesState = {
  edited: DEFAULT_SERIES,
  applied: DEFAULT_SERIES,
  source: "defaults",
  applyPhase: "idle",
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
    /** The user dismissed the unconfirmed-apply toast without retrying. */
    applyDismissed(state) {
      state.applyPhase = "idle";
    },
  },
  extraReducers: (builder) => {
    builder.addCase(settingsLoadStarted.fulfilled, (state, action): CurvesState => {
      const profile = action.payload.fanProfile;
      if (profile === null) return state;
      const series = profileToSeries(profile);
      return { ...state, edited: series, applied: series, source: "saved" };
    });
    builder.addCase(savedProfilePushStarted.fulfilled, (state, action): CurvesState =>
      action.payload.result === "applied" ? { ...state, source: "device" } : state,
    );
    builder.addCase(curvesApplied.pending, (state) => {
      state.applyPhase = "verifying";
    });
    builder.addCase(curvesApplied.fulfilled, (state, action): CurvesState =>
      match(action.payload)
        .with({ result: "confirmed" }, (): CurvesState => ({
          ...state,
          applied: action.meta.arg,
          source: "device",
          applyPhase: "idle",
        }))
        .with({ result: "unconfirmed" }, (): CurvesState => ({ ...state, applyPhase: "unconfirmed" }))
        .with({ result: "rejected" }, (): CurvesState => ({ ...state, applyPhase: "idle" }))
        .exhaustive(),
    );
    builder.addCase(curvesApplied.rejected, (state) => {
      state.applyPhase = "idle";
    });
  },
});

/**
 * Whether the chart shows state the device is not running: edits differing
 * from the applied curves, or curves (saved or fallback defaults) the device
 * has not yet confirmed.
 */
export function selectCurvesDirty(state: { readonly curves: CurvesState }): boolean {
  const { edited, applied, source } = state.curves;
  if (source !== "device") return true;
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

export const {
  pointMoved: curvePointMoved,
  reverted: curvesReverted,
  applyDismissed: applyRetryDismissed,
} = curvesSlice.actions;
export const curvesReducer = curvesSlice.reducer;
