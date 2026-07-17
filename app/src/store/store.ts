import { configureStore } from "@reduxjs/toolkit";
import { themeReducer } from "../features/theme/theme.slice";
import { detectionReducer } from "../features/detection/detection.slice";
import { curvesReducer } from "../features/curves/curves.slice";
import { statusReducer } from "../features/status/status.slice";
import { toastsReducer } from "../features/toasts/toasts.slice";

/** The app store: theme, cooler detection, fan curves, live status, and
 * queued error toasts. */
export const store = configureStore({
  reducer: {
    theme: themeReducer,
    detection: detectionReducer,
    curves: curvesReducer,
    status: statusReducer,
    toasts: toastsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
