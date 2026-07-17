import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { StatCardProps } from "./StatCard";
import { SERIES_COLORS } from "../curves/curves.types";
import { readFanStatus } from "./status.ipc";
import type { FanReadings } from "./status.ipc";

/** Live cooler readings: the last good status report, if any. */
interface StatusState {
  /** Last readings received, kept across failed ticks. `null` before the
   * first successful read. */
  readonly readings: FanReadings | null;
}

/**
 * Polls the backend for one status report. `readFanStatus` folds its own
 * failures into `null`, so this thunk always fulfills.
 */
export const fanStatusPolled = createAsyncThunk("status/poll", readFanStatus);

const initialState: StatusState = { readings: null };

const statusSlice = createSlice({
  name: "status",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fanStatusPolled.fulfilled, (state, action) => {
      if (action.payload !== null) {
        state.readings = action.payload;
      }
    });
  },
});

/**
 * Maps the current readings to the three stat cards, in design order. Cards
 * carry `null` values until the first report arrives.
 */
export function selectFanStats(state: { readonly status: StatusState }): readonly StatCardProps[] {
  const readings = state.status.readings;
  return [
    {
      label: "Radiator fans",
      color: SERIES_COLORS.radiatorFans,
      rpm: readings === null ? null : readings.radiatorRpm,
      dutyPct: readings === null ? null : readings.radiatorDuty,
    },
    {
      label: "Unit fan",
      color: SERIES_COLORS.unitFan,
      rpm: readings === null ? null : readings.waterblockRpm,
      dutyPct: readings === null ? null : readings.waterblockDuty,
    },
    {
      label: "Pump",
      color: SERIES_COLORS.pump,
      rpm: readings === null ? null : readings.pumpRpm,
      dutyPct: readings === null ? null : readings.pumpDuty,
    },
  ];
}

export const statusReducer = statusSlice.reducer;
