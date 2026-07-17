import { makeStyles, tokens } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import {
  DUTY_MAX,
  dutyToY,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
  tempToX,
} from './geometry';

/** Spacing of labeled ticks on both axes: every other 5-unit grid line. */
const TICK_STEP = 10;

const useStyles = makeStyles({
  tickLabel: {
    fontSize: '10px',
    fill: tokens.colorNeutralForeground4,
  },
});

/** Tick values from 0 to `max` inclusive, every `TICK_STEP`. */
function ticks(max: number): readonly number[] {
  return Array.from({ length: Math.floor(max / TICK_STEP) + 1 }, (_, i) => i * TICK_STEP);
}

/** A tick's text: the bare value, with the unit only on the last tick. */
function tickText(value: number, max: number, unit: string): string {
  return value === Math.floor(max / TICK_STEP) * TICK_STEP ? `${value}${unit}` : `${value}`;
}

/**
 * The two axis lines, with a temperature label under every other vertical
 * grid line and a duty label beside every other horizontal one, so any
 * curve point can be read precisely off the edges of the plot.
 *
 * @returns The axes layer.
 */
export function ChartAxes({ tempMax }: { readonly tempMax: number }): ReactElement {
  const styles = useStyles();
  return (
    <g>
      <line
        x1={PLOT_LEFT}
        y1={PLOT_BOTTOM}
        x2={PLOT_RIGHT}
        y2={PLOT_BOTTOM}
        stroke={tokens.colorNeutralStroke2}
      />
      <line
        x1={PLOT_LEFT}
        y1={PLOT_TOP}
        x2={PLOT_LEFT}
        y2={PLOT_BOTTOM}
        stroke={tokens.colorNeutralStroke2}
      />
      {ticks(tempMax).map((t) => (
        <text
          key={t}
          className={styles.tickLabel}
          x={tempToX(t, tempMax)}
          y={PLOT_BOTTOM + 18}
          textAnchor="middle"
        >
          {tickText(t, tempMax, '°C')}
        </text>
      ))}
      {ticks(DUTY_MAX).map((d) => (
        <text
          key={d}
          className={styles.tickLabel}
          x={PLOT_LEFT - 8}
          y={dutyToY(d) + 3}
          textAnchor="end"
        >
          {tickText(d, DUTY_MAX, '%')}
        </text>
      ))}
    </g>
  );
}
