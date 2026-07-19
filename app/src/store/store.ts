import { configureStore } from '@reduxjs/toolkit';
import { curvesReducer } from '../features/curves/curves.slice';
import { detectionReducer } from '../features/detection/detection.slice';
import { settingsReducer } from '../features/settings/settings.slice';
import { statusReducer } from '../features/status/status.slice';
import { themeReducer } from '../features/theme/theme.slice';
import { toastsReducer } from '../features/toasts/toasts.slice';

/** The app store: theme, settings-page state, cooler detection, fan curves,
 * live status, and queued error toasts. */
export const store = configureStore({
  reducer: {
    theme: themeReducer,
    settings: settingsReducer,
    detection: detectionReducer,
    curves: curvesReducer,
    status: statusReducer,
    toasts: toastsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
