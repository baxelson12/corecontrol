import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { toastPushed } from '../../core/toasts/toasts.slice';
import type { Detection } from './detection.ipc';
import { detectCooler } from './detection.ipc';

/**
 * Runs the backend detection scan, queueing an error toast when it fails.
 * `detectCooler` folds its own failures into the `Detection` union, so this
 * thunk always fulfills.
 */
export const coolerScanStarted = createAsyncThunk<Detection, void>(
  'detection/scan',
  async (_ignored, { dispatch }) => {
    const detection = await detectCooler();
    if (detection.state === 'failed') {
      dispatch(
        toastPushed({ kind: 'error', title: 'Cooler detection failed', body: detection.message }),
      );
    }
    return detection;
  },
);

const initialState: Detection = { state: 'detecting' };

const detectionSlice = createSlice({
  name: 'detection',
  // Lazy so the state keeps the whole `Detection` union instead of the
  // narrowed literal the initializer would infer.
  initialState: (): Detection => initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(coolerScanStarted.fulfilled, (_state, action) => action.payload);
    builder.addCase(coolerScanStarted.rejected, (_state, action) => ({
      state: 'failed',
      message: action.error.message ?? 'detection scan did not complete',
    }));
  },
});

export const detectionReducer = detectionSlice.reducer;
