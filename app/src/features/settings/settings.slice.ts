import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { Preferences } from './settings.ipc';
import { savePreferences } from './settings.ipc';
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
      };
    });
  },
});

/**
 * Applies a partial preference change and persists the merged result. The
 * change lands before the disk write; a failed write only logs, the UI
 * keeps the new preferences.
 */
export const preferencesChanged = createAsyncThunk<
  void,
  Partial<Preferences>,
  { state: { settings: SettingsState } }
>('settings/changeRequested', async (change, { dispatch, getState }) => {
  const merged = { ...getState().settings.preferences, ...change };
  dispatch(settingsSlice.actions.preferencesSet(merged));
  await savePreferences(merged);
});

export const { opened: settingsOpened, closed: settingsClosed } = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
