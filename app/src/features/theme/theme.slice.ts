import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { match } from "ts-pattern";
import type { ThemeName } from "./theme.types";
import { saveTheme } from "../settings/settings.ipc";
import { settingsLoadStarted } from "../settings/settings.thunks";

interface ThemeState {
  readonly name: ThemeName;
}

/** The theme the OS prefers right now. */
function systemTheme(): ThemeName {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const initialState: ThemeState = { name: systemTheme() };

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    /** Flips between light and dark. */
    toggled(state) {
      state.name = match<ThemeName, ThemeName>(state.name)
        .with("dark", () => "light")
        .with("light", () => "dark")
        .exhaustive();
    },
  },
  extraReducers: (builder) => {
    builder.addCase(settingsLoadStarted.fulfilled, (state, action) => {
      if (action.payload.theme !== null) {
        state.name = action.payload.theme;
      }
    });
  },
});

/**
 * Flips between light and dark and persists the choice, so later launches
 * use it instead of the system preference. The flip lands before the disk
 * write; a failed write only logs, the UI keeps the new theme.
 */
export const themeToggled = createAsyncThunk<void, void, { state: { theme: ThemeState } }>(
  "theme/toggleRequested",
  async (_ignored, { dispatch, getState }) => {
    dispatch(themeSlice.actions.toggled());
    await saveTheme(getState().theme.name);
  },
);

export const themeReducer = themeSlice.reducer;
