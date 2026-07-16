import { configureStore } from "@reduxjs/toolkit";
import { themeReducer } from "./themeSlice";
import { detectionReducer } from "./detectionSlice";
import { curvesReducer } from "./curvesSlice";
import { statusReducer } from "./statusSlice";

/** The app store: theme, cooler detection, fan curves, and live status. */
export const store = configureStore({
  reducer: {
    theme: themeReducer,
    detection: detectionReducer,
    curves: curvesReducer,
    status: statusReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
