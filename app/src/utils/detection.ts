import { invoke } from "@tauri-apps/api/core";
import { match, P } from "ts-pattern";

/** One recognized cooler reported by the backend detection scan. */
export interface DetectedCooler {
  /** Product name, e.g. "MEG Core Liquid S280". */
  readonly name: string;
  /** Number of physical radiator fans the model carries. */
  readonly radiatorFans: number;
}

/** Where startup detection currently stands. */
export type Detection =
  | { readonly state: "detecting" }
  | { readonly state: "found"; readonly cooler: DetectedCooler }
  | { readonly state: "none" }
  | { readonly state: "failed"; readonly message: string };

/** Shape a raw IPC reply must have to count as a `DetectedCooler`. */
const coolerPattern = P.shape({
  name: P.string.minLength(1),
  radiatorFans: P.number.int().positive(),
});

/**
 * Runs the backend detection scan and folds every outcome, including
 * failure, into a `Detection` value. Never throws.
 *
 * @returns The resulting detection state.
 */
export async function detectCooler(): Promise<Detection> {
  try {
    const reply: unknown = await invoke("detect_cooler");
    return match<unknown, Detection>(reply)
      .with(null, () => ({ state: "none" }))
      .with(coolerPattern, (cooler) => ({ state: "found", cooler }))
      .otherwise(() => ({ state: "failed", message: "backend reply had an unexpected shape" }));
  } catch (error) {
    console.error("cooler detection failed:", error);
    return { state: "failed", message: String(error) };
  }
}

/**
 * Maps a detection state to the product-name line of the device header.
 *
 * @returns The text to display.
 */
export function deviceName(detection: Detection): string {
  return match(detection)
    .with({ state: "detecting" }, () => "Detecting cooler…")
    .with({ state: "found" }, ({ cooler }) => cooler.name)
    .with({ state: "none" }, () => "No cooler detected")
    .with({ state: "failed" }, () => "Detection failed")
    .exhaustive();
}
