import { createAsyncThunk } from "@reduxjs/toolkit";
import { loadSettings } from "../utils/settings";

/**
 * Loads the persisted settings on startup. `loadSettings` folds its own
 * failures into empty settings, so this thunk always fulfills; the theme and
 * curves slices each pick out their piece via extraReducers.
 */
export const settingsLoadStarted = createAsyncThunk("settings/load", loadSettings);
