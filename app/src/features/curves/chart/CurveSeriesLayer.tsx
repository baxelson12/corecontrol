import type { ReactElement } from 'react';
import type { CurvePointMoveHandler, CurveSeries } from '../curves.types';
import { CurvePointHandle } from './CurvePointHandle';
import { linePath, PLOT_BOTTOM, PLOT_LEFT, PLOT_RIGHT } from './geometry';

export interface CurveSeriesLayerProps {
  readonly series: CurveSeries;
  readonly seriesIndex: number;
  readonly tempMax: number;
  readonly showFill: boolean;
  readonly onPointMove?: CurvePointMoveHandler | undefined;
}

/**
 * One curve: optional soft fill, the line itself, and a handle per point.
 * A series without points renders nothing.
 */
export function CurveSeriesLayer({
  series,
  seriesIndex,
  tempMax,
  showFill,
  onPointMove,
}: CurveSeriesLayerProps): ReactElement | null {
  if (series.points.length === 0) return null;
  const d = linePath(series.points, tempMax);
  return (
    <g>
      {showFill && (
        <path
          d={`${d} L${PLOT_RIGHT} ${PLOT_BOTTOM} L${PLOT_LEFT} ${PLOT_BOTTOM} Z`}
          fill={series.color}
          opacity={0.07}
        />
      )}
      <path d={d} fill="none" stroke={series.color} strokeWidth={2} strokeLinejoin="round" />
      {series.points.map((pt, pointIndex) => (
        <CurvePointHandle
          key={pointIndex}
          point={pt}
          color={series.color}
          tempMax={tempMax}
          onMove={onPointMove && ((p) => onPointMove(seriesIndex, pointIndex, p))}
        />
      ))}
    </g>
  );
}
