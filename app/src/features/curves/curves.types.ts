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
export type CurvePointMoveHandler = (
  seriesIndex: number,
  pointIndex: number,
  point: CurvePoint,
) => void;

/**
 * Where the curves on the chart came from: confirmed on the device, loaded
 * from the saved settings but not yet confirmed on the device, or the
 * design-fallback defaults shown while no profile has ever been saved.
 */
export type CurveSource = 'device' | 'saved' | 'defaults';

/** CSS color per cooling channel, shared by the chart and the stat cards. */
export interface ChannelColors {
  readonly radiatorFans: string;
  readonly unitFan: string;
  readonly pump: string;
}

/** Default channel colors from the design. */
export const SERIES_COLORS: ChannelColors = {
  radiatorFans: 'oklch(0.68 0.14 235)',
  unitFan: 'oklch(0.68 0.14 155)',
  pump: 'oklch(0.68 0.14 330)',
};

/** Default opacity of the other curves while one is focused. */
export const DEFAULT_DIMMED_OPACITY = 0.35;

/** Where a profile write currently stands, driving the apply toast. */
export type ApplyPhase =
  /** No write in flight. */
  | 'idle'
  /** Written; polling the device until it reports the new profile. */
  | 'verifying'
  /** The device never confirmed the write; a retry is on offer. */
  | 'unconfirmed';

export interface CurvesState {
  /** Curves as currently edited on the chart. */
  readonly edited: readonly CurveSeries[];
  /** Curves last confirmed on the device. */
  readonly applied: readonly CurveSeries[];
  /** Whether `applied` was read from (or written to) the device, or is the
   * design fallback shown while no custom profile is running. */
  readonly source: CurveSource;
  /** Where the in-flight profile write stands, if any. */
  readonly applyPhase: ApplyPhase;
}

/** Identifies one dragged point and its new chart-domain position. */
export interface PointMove {
  readonly seriesIndex: number;
  readonly pointIndex: number;
  readonly point: CurvePoint;
}
