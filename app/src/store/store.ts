import { configureStore } from "@reduxjs/toolkit";
import { themeReducer } from "./themeSlice";
import { detectionReducer } from "./detectionSlice";
import { curvesReducer } from "./curvesSlice";
import { statusReducer } from "./statusSlice";
import { toastsReducer } from "./toastsSlice";

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
