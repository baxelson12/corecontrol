import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";

/** `useDispatch` typed to this app's store, so thunks dispatch cleanly. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/** `useSelector` typed to this app's root state. */
export const useAppSelector = useSelector.withTypes<RootState>();
