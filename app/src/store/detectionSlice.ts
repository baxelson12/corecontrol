import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { detectCooler } from "../utils/detection";
import type { Detection } from "../utils/detection";

/**
 * Runs the backend detection scan. `detectCooler` folds its own failures
 * into the `Detection` union, so this thunk always fulfills.
 */
export const coolerScanStarted = createAsyncThunk("detection/scan", detectCooler);

const initialState: Detection = { state: "detecting" };

const detectionSlice = createSlice({
  name: "detection",
  initialState: initialState as Detection,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(coolerScanStarted.fulfilled, (_state, action) => action.payload);
    builder.addCase(coolerScanStarted.rejected, (_state, action) => ({
      state: "failed",
      message: action.error.message ?? "detection scan did not complete",
    }));
  },
});

export const detectionReducer = detectionSlice.reducer;
