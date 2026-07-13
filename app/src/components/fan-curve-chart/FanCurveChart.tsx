import { makeStyles } from "@fluentui/react-components";
import type { ReactElement } from "react";
import type { CurvePointMoveHandler, CurveSeries } from "../types";
import { VIEW_WIDTH, VIEW_HEIGHT, DEFAULT_TEMP_MAX } from "./geometry";
import { ChartGrid } from "./ChartGrid";
import { ChartAxes } from "./ChartAxes";
import { CurveSeriesLayer } from "./CurveSeriesLayer";

const useStyles = makeStyles({
  svg: {
    display: "block",
    width: "100%",
    touchAction: "none",
    userSelect: "none",
  },
});

export interface FanCurveChartProps {
  /** Curves to draw, in paint order. */
  readonly series: readonly CurveSeries[];
  /** Upper end of the temperature axis in °C. Defaults to 120. */
  readonly tempMax?: number;
  /** Minor grid lines. Defaults to on. */
  readonly showGrid?: boolean;
  /** Soft fill under each curve. Defaults to off. */
  readonly showFill?: boolean;
  /**
   * Called repeatedly while a point is dragged, with the point clamped to the
   * chart domain. Snapping and ordering between neighbors are the caller's
   * concern; the chart renders whatever `series` it is given.
   */
  readonly onPointMove?: CurvePointMoveHandler;
}

/**
 * The fan curve plot: temperature on x, duty on y, one draggable line per
 * channel. Fully controlled; it holds no curve state of its own.
 *
 * @returns The chart SVG.
 */
export function FanCurveChart({
  series,
  tempMax = DEFAULT_TEMP_MAX,
  showGrid = true,
  showFill = false,
  onPointMove,
}: FanCurveChartProps): ReactElement {
  const styles = useStyles();
  const safeTempMax = tempMax > 0 ? tempMax : DEFAULT_TEMP_MAX;
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className={styles.svg} role="img" aria-label="Fan curves">
      {showGrid && <ChartGrid tempMax={safeTempMax} />}
      <ChartAxes tempMax={safeTempMax} />
      {series.map((s, i) => (
        <CurveSeriesLayer
          key={s.name}
          series={s}
          seriesIndex={i}
          tempMax={safeTempMax}
          showFill={showFill}
          onPointMove={onPointMove}
        />
      ))}
    </svg>
  );
}
