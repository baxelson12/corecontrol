import { makeStyles, tokens } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import type { CurvePoint } from '../curves.types';
import { clamp, DUTY_MAX, dutyToY, tempToX } from './geometry';

const useStyles = makeStyles({
  handle: {
    cursor: 'grab',
  },
});

export interface CurvePointHandleProps {
  readonly point: CurvePoint;
  readonly color: string;
  readonly tempMax: number;
}

/**
 * One curve point, drawn as a ring in the series color. Dragging is handled
 * by the chart itself, which hit-tests pointer presses against every point.
 *
 * @returns The point handle circle.
 */
export function CurvePointHandle({ point, color, tempMax }: CurvePointHandleProps): ReactElement {
  const styles = useStyles();
  return (
    <circle
      className={styles.handle}
      cx={tempToX(clamp(point.temp, 0, tempMax), tempMax)}
      cy={dutyToY(clamp(point.duty, 0, DUTY_MAX))}
      r={6}
      fill={tokens.colorNeutralBackground1}
      stroke={color}
      strokeWidth={2}
    />
  );
}
