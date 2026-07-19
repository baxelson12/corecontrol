import { makeStyles } from '@fluentui/react-components';
import type { ReactElement, PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState } from 'react';
import type { CurveSeries } from '../../../entities/channels/channels.types';
import type { CurvePointMoveHandler } from '../curves.types';
import { ChartAxes } from './ChartAxes';
import { ChartGrid } from './ChartGrid';
import { CurveLabels } from './CurveLabels';
import { CurveSeriesLayer } from './CurveSeriesLayer';
import type { HandleHit } from './geometry';
import {
  DEFAULT_TEMP_MAX,
  hitTestHandles,
  hitTestLines,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  viewToPoint,
} from './geometry';

const useStyles = makeStyles({
  svg: {
    display: 'block',
    width: '100%',
    touchAction: 'none',
    userSelect: 'none',
  },
});

/**
 * Converts a pointer event's client position to viewBox coordinates, or null
 * when the SVG has no measurable size.
 */
function eventToView(event: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } | null {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: (event.clientX - rect.left) * (VIEW_WIDTH / rect.width),
    y: (event.clientY - rect.top) * (VIEW_HEIGHT / rect.height),
  };
}

export interface FanCurveChartProps {
  /** Curves to draw, in paint order; a selected curve paints above the rest. */
  readonly series: readonly CurveSeries[];
  /** Upper end of the temperature axis in °C. Defaults to 120. */
  readonly tempMax?: number | undefined;
  /** Minor grid lines. Defaults to on. */
  readonly showGrid?: boolean | undefined;
  /** Soft fill under each curve. Defaults to off. */
  readonly showFill?: boolean | undefined;
  /** Opacity of unfocused curves while one is focused, 0–1. */
  readonly dimmedOpacity?: number | undefined;
  /**
   * Called repeatedly while a point is dragged, with the point clamped to the
   * chart domain. Snapping and ordering between neighbors are the caller's
   * concern; the chart renders whatever `series` it is given.
   */
  readonly onPointMove?: CurvePointMoveHandler | undefined;
}

/**
 * The fan curve plot: temperature on x, duty on y, one draggable line per
 * channel. Clicking a curve selects it: it paints on top, wins overlapping
 * point grabs, and the other curves fade. Clicking empty plot clears the
 * selection. Curve data is fully controlled; the only local state is the
 * transient selection.
 *
 * @returns The chart SVG.
 */
export function FanCurveChart({
  series,
  tempMax = DEFAULT_TEMP_MAX,
  showGrid = true,
  showFill = false,
  dimmedOpacity,
  onPointMove,
}: FanCurveChartProps): ReactElement {
  const styles = useStyles();
  const [selected, setSelected] = useState<number | null>(null);
  const dragRef = useRef<HandleHit | null>(null);
  const safeTempMax = tempMax > 0 ? tempMax : DEFAULT_TEMP_MAX;
  const active = selected !== null && selected < series.length ? selected : null;

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    event.preventDefault();
    const view = eventToView(event);
    if (view === null) return;
    const handle = hitTestHandles(series, active, view.x, view.y, safeTempMax);
    if (handle !== null) {
      dragRef.current = handle;
      setSelected(handle.seriesIndex);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setSelected(hitTestLines(series, view.x, view.y, safeTempMax));
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const drag = dragRef.current;
    if (drag === null || onPointMove === undefined) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const view = eventToView(event);
    if (view === null) return;
    onPointMove(drag.seriesIndex, drag.pointIndex, viewToPoint(view.x, view.y, safeTempMax));
  }

  function handleLostPointerCapture(): void {
    dragRef.current = null;
  }

  const indexed = series.map((s, index) => ({ s, index }));
  const paintOrder =
    active === null
      ? indexed
      : [
          ...indexed.filter((e) => e.index !== active),
          ...indexed.filter((e) => e.index === active),
        ];
  const activeName = active === null ? null : (series[active]?.name ?? null);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className={styles.svg}
      role="img"
      aria-label="Fan curves"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={handleLostPointerCapture}
    >
      {showGrid && <ChartGrid tempMax={safeTempMax} />}
      <ChartAxes tempMax={safeTempMax} />
      {paintOrder.map(({ s, index }) => (
        <CurveSeriesLayer
          key={s.name}
          series={s}
          tempMax={safeTempMax}
          showFill={showFill}
          dimmed={active !== null && index !== active}
          dimmedOpacity={dimmedOpacity}
        />
      ))}
      <CurveLabels series={series} activeName={activeName} />
    </svg>
  );
}
