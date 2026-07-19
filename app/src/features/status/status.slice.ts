import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ChannelColors } from '../curves/curves.types';
import type { StatCardProps } from './StatCard';
import type { FanReadings } from './status.ipc';
import { readFanStatus } from './status.ipc';

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
export const fanStatusPolled = createAsyncThunk('status/poll', readFanStatus);

const initialState: StatusState = { readings: null };

const statusSlice = createSlice({
  name: 'status',
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

/** The slices the stat-card selector reads. */
interface FanStatsInput {
  readonly status: StatusState;
  readonly settings: { readonly preferences: { readonly channelColors: ChannelColors } };
}

/**
 * Maps the current readings to the three stat cards, in design order, dots
 * colored per the user's channel colors. Cards carry `null` values until
 * the first report arrives.
 *
 * @returns One card per cooling channel.
 */
export function selectFanStats(state: FanStatsInput): readonly StatCardProps[] {
  const readings = state.status.readings;
  const colors = state.settings.preferences.channelColors;
  return [
    {
      label: 'Radiator fans',
      color: colors.radiatorFans,
      rpm: readings === null ? null : readings.radiatorRpm,
      dutyPct: readings === null ? null : readings.radiatorDuty,
    },
    {
      label: 'Unit fan',
      color: colors.unitFan,
      rpm: readings === null ? null : readings.waterblockRpm,
      dutyPct: readings === null ? null : readings.waterblockDuty,
    },
    {
      label: 'Pump',
      color: colors.pump,
      rpm: readings === null ? null : readings.pumpRpm,
      dutyPct: readings === null ? null : readings.pumpDuty,
    },
  ];
}

export const statusReducer = statusSlice.reducer;
