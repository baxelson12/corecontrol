import { configureStore } from '@reduxjs/toolkit';
import { toastsReducer } from '../core/toasts/toasts.slice';
import { settingsReducer } from '../entities/settings/settings.slice';
import { themeReducer } from '../entities/theme/theme.slice';
import { curvesReducer } from '../features/curves/curves.slice';
import { detectionReducer } from '../features/detection/detection.slice';
import { statusReducer } from '../features/status/status.slice';

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
