import { configureStore } from "@reduxjs/toolkit";
import { themeReducer } from "./themeSlice";
import { detectionReducer } from "./detectionSlice";
import { curvesReducer } from "./curvesSlice";

/** The app store: theme, cooler detection, and fan curve state. */
export const store = configureStore({
  reducer: {
    theme: themeReducer,
    detection: detectionReducer,
    curves: curvesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
