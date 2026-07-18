import { makeStyles } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import type { CurveSeries } from '../curves.types';
import { CurvePointHandle } from './CurvePointHandle';
import { linePath, PLOT_BOTTOM, PLOT_LEFT, PLOT_RIGHT } from './geometry';

const useStyles = makeStyles({
  layer: {
    transitionProperty: 'opacity',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
  },
  hitLine: {
    cursor: 'pointer',
  },
});

export interface CurveSeriesLayerProps {
  readonly series: CurveSeries;
  readonly tempMax: number;
  readonly showFill: boolean;
  /** Faded rendering while another series holds the selection. */
  readonly dimmed: boolean;
}

/**
 * One curve: optional soft fill, the line itself, an invisible wide stroke
 * that gives the line a pointer cursor, and a handle per point. Pointer
 * events are handled by the chart, not here.
 *
 * @returns The series layer, or null for a series without points.
 */
export function CurveSeriesLayer({
  series,
  tempMax,
  showFill,
  dimmed,
}: CurveSeriesLayerProps): ReactElement | null {
  const styles = useStyles();
  if (series.points.length === 0) return null;
  const d = linePath(series.points, tempMax);
  return (
    <g className={styles.layer} opacity={dimmed ? 0.35 : 1}>
      {showFill && (
        <path
          d={`${d} L${PLOT_RIGHT} ${PLOT_BOTTOM} L${PLOT_LEFT} ${PLOT_BOTTOM} Z`}
          fill={series.color}
          opacity={0.07}
        />
      )}
      <path d={d} fill="none" stroke={series.color} strokeWidth={2} strokeLinejoin="round" />
      <path className={styles.hitLine} d={d} fill="none" stroke="transparent" strokeWidth={12} />
      {series.points.map((pt, pointIndex) => (
        <CurvePointHandle
          // biome-ignore lint/suspicious/noArrayIndexKey: points are positional with a fixed count
          key={pointIndex}
          point={pt}
          color={series.color}
          tempMax={tempMax}
        />
      ))}
    </g>
  );
}
