import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_DIMMED_OPACITY, SERIES_COLORS } from '../curves/curves.types';
import type { Preferences } from './settings.ipc';
import { savePreferencesDebounced } from './settings.ipc';
import { settingsLoadStarted } from './settings.thunks';

export interface SettingsState {
  /** Whether the settings page is shown instead of the main view. */
  readonly open: boolean;
  /** The current preferences, defaults applied. */
  readonly preferences: Preferences;
}

/** What every preference falls back to before the user changes it. */
const DEFAULT_PREFERENCES: Preferences = {
  closeBehavior: 'exit',
  watchdogEnabled: true,
  restoreNotify: true,
  updateCheck: true,
  channelColors: SERIES_COLORS,
  dimmedOpacity: DEFAULT_DIMMED_OPACITY,
};

const initialState: SettingsState = { open: false, preferences: DEFAULT_PREFERENCES };

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    /** Show the settings page. */
    opened(state) {
      state.open = true;
    },
    /** Return to the main view. */
    closed(state) {
      state.open = false;
    },
    /** Replace the preferences with an already-merged set. */
    preferencesSet(state, action: PayloadAction<Preferences>) {
      state.preferences = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(settingsLoadStarted.fulfilled, (state, action) => {
      state.preferences = {
        closeBehavior: action.payload.closeBehavior ?? DEFAULT_PREFERENCES.closeBehavior,
        watchdogEnabled: action.payload.watchdogEnabled ?? DEFAULT_PREFERENCES.watchdogEnabled,
        restoreNotify: action.payload.restoreNotify ?? DEFAULT_PREFERENCES.restoreNotify,
        updateCheck: action.payload.updateCheck ?? DEFAULT_PREFERENCES.updateCheck,
        channelColors: action.payload.channelColors ?? DEFAULT_PREFERENCES.channelColors,
        dimmedOpacity: action.payload.dimmedOpacity ?? DEFAULT_PREFERENCES.dimmedOpacity,
      };
    });
  },
});

/**
 * Applies a partial preference change and persists the merged result. The
 * change lands immediately; the disk write is debounced so a slider or
 * color drag costs one write, and a failed write only logs, the UI keeps
 * the new preferences.
 */
export const preferencesChanged = createAsyncThunk<
  void,
  Partial<Preferences>,
  { state: { settings: SettingsState } }
>('settings/changeRequested', (change, { dispatch, getState }) => {
  const merged = { ...getState().settings.preferences, ...change };
  dispatch(settingsSlice.actions.preferencesSet(merged));
  savePreferencesDebounced(merged);
});

export const { opened: settingsOpened, closed: settingsClosed } = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
