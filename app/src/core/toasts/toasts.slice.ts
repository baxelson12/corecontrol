import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

/** How a queued toast should read: a failure or a confirmation. */
export type ToastKind = 'error' | 'success';

/** The text and intent of a toast to queue. */
export interface ToastRequest {
  /** Failure or confirmation, driving the toast's color and timeout. */
  readonly kind: ToastKind;
  /** Short headline, e.g. "Profile apply failed". */
  readonly title: string;
  /** The message under the headline. */
  readonly body: string;
}

/** One notification waiting to be shown as a toast. */
export interface ToastEntry extends ToastRequest {
  /** Monotonic key so React and the toaster can tell entries apart. */
  readonly key: number;
}

interface ToastsState {
  /** Notifications queued for display, oldest first. */
  readonly queue: readonly ToastEntry[];
  /** Next key to hand out. */
  readonly nextKey: number;
}

const initialState: ToastsState = { queue: [], nextKey: 0 };

/**
 * A plain notification queue. Features and thunks push entries; entries stay
 * until the toaster component reports them delivered. The queue knows
 * nothing about what the notifications announce.
 */
const toastsSlice = createSlice({
  name: 'toasts',
  initialState,
  reducers: {
    /** Queue one notification under a fresh key. */
    pushed(state, action: PayloadAction<ToastRequest>): ToastsState {
      return {
        queue: [...state.queue, { ...action.payload, key: state.nextKey }],
        nextKey: state.nextKey + 1,
      };
    },
    /** The toaster showed this entry; drop it from the queue. */
    delivered(state, action: PayloadAction<number>): ToastsState {
      return { ...state, queue: state.queue.filter((entry) => entry.key !== action.payload) };
    },
  },
});

export const { pushed: toastPushed, delivered: toastDelivered } = toastsSlice.actions;
export const toastsReducer = toastsSlice.reducer;
