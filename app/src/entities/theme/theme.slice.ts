import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { saveTheme } from '../settings/settings.ipc';
import { settingsLoadStarted } from '../settings/settings.thunks';
import type { ThemeName, ThemePreference } from './theme.types';

interface ThemeState {
  /** The user's choice: an explicit theme, or follow the OS. */
  readonly preference: ThemePreference;
  /** The theme the OS prefers, kept fresh by a media-query listener. */
  readonly system: ThemeName;
}

/** The theme the OS prefers right now. */
function systemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const initialState: ThemeState = { preference: 'system', system: systemTheme() };

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    /** The user picked a preference on the settings page. */
    chosen(state, action: PayloadAction<ThemePreference>) {
      state.preference = action.payload;
    },
    /** The OS theme preference changed. */
    systemChanged(state, action: PayloadAction<ThemeName>) {
      state.system = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(settingsLoadStarted.fulfilled, (state, action) => {
      state.preference = action.payload.theme ?? 'system';
    });
  },
});

/** The theme the UI should render: the explicit choice, or the OS one. */
export function selectEffectiveTheme(state: { theme: ThemeState }): ThemeName {
  return state.theme.preference === 'system' ? state.theme.system : state.theme.preference;
}

/**
 * Applies a theme preference and persists it; `system` is stored as "not
 * set" so the backend keeps following the OS. The switch lands before the
 * disk write; a failed write only logs, the UI keeps the new theme.
 */
export const themeChosen = createAsyncThunk<void, ThemePreference>(
  'theme/chooseRequested',
  async (preference, { dispatch }) => {
    dispatch(themeSlice.actions.chosen(preference));
    await saveTheme(preference === 'system' ? null : preference);
  },
);

export const { systemChanged: systemThemeChanged } = themeSlice.actions;
export const themeReducer = themeSlice.reducer;
