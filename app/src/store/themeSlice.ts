import { createSlice } from "@reduxjs/toolkit";
import { match } from "ts-pattern";
import type { ThemeName } from "../components/types";

interface ThemeState {
  readonly name: ThemeName;
}

const initialState: ThemeState = { name: "dark" };

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
});

export const { toggled: themeToggled } = themeSlice.actions;
export const themeReducer = themeSlice.reducer;
