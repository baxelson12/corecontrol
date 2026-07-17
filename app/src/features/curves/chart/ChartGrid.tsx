import { tokens } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import {
  DUTY_MAX,
  dutyToY,
  GRID_STEP,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
  tempToX,
} from './geometry';

/**
 * Minor grid lines every 5 °C and 5 % duty, plus the top border.
 *
 * @returns The grid layer.
 */
export function ChartGrid({ tempMax }: { readonly tempMax: number }): ReactElement {
  const vCount = Math.max(0, Math.ceil(tempMax / GRID_STEP) - 1);
  const hCount = DUTY_MAX / GRID_STEP - 1;
  const xs = Array.from({ length: vCount }, (_, i) => tempToX((i + 1) * GRID_STEP, tempMax));
  const ys = Array.from({ length: hCount }, (_, i) => dutyToY((i + 1) * GRID_STEP));
  return (
    <g stroke={tokens.colorNeutralStroke3}>
      {xs.map((x) => (
        <line key={x} x1={x} y1={PLOT_TOP} x2={x} y2={PLOT_BOTTOM} />
      ))}
      {ys.map((y) => (
        <line key={y} x1={PLOT_LEFT} y1={y} x2={PLOT_RIGHT} y2={y} />
      ))}
      <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_RIGHT} y2={PLOT_TOP} />
    </g>
  );
}
