import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { match } from "ts-pattern";
import { coolerScanStarted } from "../detection/detection.slice";
import { curvesApplied, savedProfilePushStarted } from "../curves/curves.thunks";

/** How a queued toast should read: a failure or a confirmation. */
export type ToastKind = "error" | "success";

/** One notification waiting to be shown as a toast. */
export interface ToastEntry {
  /** Monotonic key so React and the toaster can tell entries apart. */
  readonly key: number;
  /** Failure or confirmation, driving the toast's color and timeout. */
  readonly kind: ToastKind;
  /** Short headline, e.g. "Profile apply failed". */
  readonly title: string;
  /** The message under the headline. */
  readonly body: string;
}

interface ToastsState {
  /** Notifications queued for display, oldest first. */
  readonly queue: readonly ToastEntry[];
  /** Next key to hand out. */
  readonly nextKey: number;
}

const initialState: ToastsState = { queue: [], nextKey: 0 };

/** Returns `state` with one more entry queued under a fresh key. */
function enqueue(state: ToastsState, kind: ToastKind, title: string, body: string): ToastsState {
  return {
    queue: [...state.queue, { key: state.nextKey, kind, title, body }],
    nextKey: state.nextKey + 1,
  };
}

/**
 * Notifications from the async thunks, queued for the toaster. Entries stay
 * until the toaster component reports them delivered.
 */
const toastsSlice = createSlice({
  name: "toasts",
  initialState,
  reducers: {
    /** The toaster showed this entry; drop it from the queue. */
    delivered(state, action: PayloadAction<number>): ToastsState {
      return { ...state, queue: state.queue.filter((entry) => entry.key !== action.payload) };
    },
    /** The backend watchdog found the cooler off the saved profile and
     * pushed the saved one back. */
    restored(state): ToastsState {
      return enqueue(
        state,
        "success",
        "Fan profile restored",
        "The cooler had drifted from the saved profile; it was pushed back.",
      );
    },
  },
  extraReducers: (builder) => {
    builder.addCase(coolerScanStarted.fulfilled, (state, action): ToastsState => {
      if (action.payload.state !== "failed") return state;
      return enqueue(state, "error", "Cooler detection failed", action.payload.message);
    });
    builder.addCase(savedProfilePushStarted.fulfilled, (state, action): ToastsState => {
      if (action.payload.result !== "failed") return state;
      return enqueue(state, "error", "Saved profile not applied", action.payload.message);
    });
    builder.addCase(curvesApplied.fulfilled, (state, action): ToastsState =>
      match(action.payload)
        .with({ result: "confirmed" }, () =>
          enqueue(state, "success", "Fan profile applied", "The cooler confirmed the new profile."),
        )
        .with({ result: "rejected" }, ({ message }) =>
          enqueue(state, "error", "Profile apply failed", message),
        )
        .with({ result: "unconfirmed" }, () => state)
        .exhaustive(),
    );
    builder.addCase(curvesApplied.rejected, (state, action): ToastsState =>
      enqueue(
        state,
        "error",
        "Profile apply failed",
        action.error.message ?? "the apply did not complete",
      ),
    );
  },
});

export const { delivered: toastDelivered, restored: savedProfileRestored } = toastsSlice.actions;
export const toastsReducer = toastsSlice.reducer;
