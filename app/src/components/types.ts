/** A single control point on a fan curve. */
export interface CurvePoint {
  /** Coolant temperature in °C. */
  readonly temp: number;
  /** Fan or pump duty in percent, 0–100. */
  readonly duty: number;
}

/** One named curve on the fan chart, e.g. the pump or the radiator fans. */
export interface CurveSeries {
  readonly name: string;
  /** CSS color shared by the curve, its drag points, and its stat card. */
  readonly color: string;
  readonly points: readonly CurvePoint[];
}

/** Reports a chart point being dragged to a new chart-domain position. */
export type CurvePointMoveHandler = (seriesIndex: number, pointIndex: number, point: CurvePoint) => void;

/**
 * Where the curves on the chart came from: confirmed on the device, loaded
 * from the saved settings but not yet confirmed on the device, or the
 * design-fallback defaults shown while no profile has ever been saved.
 */
export type CurveSource = "device" | "saved" | "defaults";

/** The two UI color themes. */
export type ThemeName = "light" | "dark";

/** Channel colors from the design. */
export const SERIES_COLORS = {
  radiatorFans: "oklch(0.68 0.14 235)",
  unitFan: "oklch(0.68 0.14 155)",
  pump: "oklch(0.68 0.14 330)",
} as const;
