/** A single control point on a fan curve. */
export interface CurvePoint {
  /** Coolant temperature in degrees Celsius. */
  readonly temp: number;
  /** Fan or pump duty in percent, 0-100. */
  readonly duty: number;
}

/** One named curve on the fan chart, e.g. the pump or the radiator fans. */
export interface CurveSeries {
  readonly name: string;
  /** CSS color shared by the curve, its drag points, and its stat card. */
  readonly color: string;
  readonly points: readonly CurvePoint[];
}

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
