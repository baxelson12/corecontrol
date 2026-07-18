import { makeStyles, tokens } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import type { CurveSeries } from '../curves.types';
import { clamp, DUTY_MAX, dutyToY, PLOT_BOTTOM, PLOT_LEFT } from './geometry';

/** Vertical space one label row needs, in viewBox units. */
const LABEL_GAP = 16;
/** Horizontal inset of the labels from the plot's left edge. */
const LABEL_X = PLOT_LEFT + 10;
/** How far a label sits from its curve's left end, above or below. */
const LABEL_LIFT = 12;
/** Length of the colored swatch dash preceding the label text. */
const SWATCH_LENGTH = 12;
/** Lowest allowed label center, keeping clear of the x-axis line. */
const LABEL_FLOOR = PLOT_BOTTOM - 8;
/** Highest allowed label center, keeping the text inside the viewBox. */
const LABEL_CEILING = 8;

const useStyles = makeStyles({
  label: {
    fontSize: '11px',
    fontWeight: 600,
    fill: tokens.colorNeutralForeground2,
    stroke: tokens.colorNeutralBackground1,
    strokeWidth: '3px',
    paintOrder: 'stroke',
  },
  row: {
    transitionProperty: 'opacity',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
  },
});

/** One label with its resolved vertical position. */
interface PlacedLabel {
  readonly name: string;
  readonly color: string;
  readonly y: number;
}

/**
 * Computes non-overlapping label positions. Each label prefers to sit just
 * above its curve's left end and flips below the line when above would clip
 * the top of the chart or land within `LABEL_GAP` of the previous label.
 * Labels are placed top-down; whatever still collides after flipping is
 * pushed down. A bottom-up pass then lifts only the labels that overflow the
 * axis floor, so labels already placed clear of the top stay put.
 */
function placeLabels(series: readonly CurveSeries[]): readonly PlacedLabel[] {
  const desired = series
    .filter((s) => s.points.length > 0)
    .map((s) => ({
      name: s.name,
      color: s.color,
      lineY: dutyToY(clamp(s.points[0]?.duty ?? 0, 0, DUTY_MAX)),
    }))
    .sort((a, b) => a.lineY - b.lineY);
  const placed: PlacedLabel[] = [];
  for (const label of desired) {
    const prev = placed[placed.length - 1];
    const minY = Math.max(LABEL_CEILING, prev === undefined ? LABEL_CEILING : prev.y + LABEL_GAP);
    const above = label.lineY - LABEL_LIFT;
    const below = label.lineY + LABEL_LIFT;
    const y = above >= minY ? above : Math.max(below, minY);
    placed.push({ name: label.name, color: label.color, y });
  }
  for (let i = placed.length - 1; i >= 0; i -= 1) {
    const current = placed[i];
    const next = placed[i + 1];
    const maxY = next === undefined ? LABEL_FLOOR : next.y - LABEL_GAP;
    if (current !== undefined && current.y > maxY) {
      placed[i] = { ...current, y: Math.max(LABEL_CEILING, maxY) };
    }
  }
  return placed;
}

export interface CurveLabelsProps {
  readonly series: readonly CurveSeries[];
  /** Name of the selected series; the other labels fade. Null fades none. */
  readonly activeName: string | null;
}

/**
 * Direct series labels at the left end of each curve, where the lines are
 * furthest apart: a short dash in the series color plus the channel name in
 * neutral ink. Inert to the pointer so it never blocks a drag handle.
 *
 * @returns The labels layer.
 */
export function CurveLabels({ series, activeName }: CurveLabelsProps): ReactElement {
  const styles = useStyles();
  return (
    <g pointerEvents="none">
      {placeLabels(series).map((label) => (
        <g
          key={label.name}
          className={styles.row}
          opacity={activeName !== null && label.name !== activeName ? 0.35 : 1}
        >
          <line
            x1={LABEL_X}
            x2={LABEL_X + SWATCH_LENGTH}
            y1={label.y}
            y2={label.y}
            stroke={label.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <text
            className={styles.label}
            x={LABEL_X + SWATCH_LENGTH + 6}
            y={label.y}
            dominantBaseline="central"
          >
            {label.name}
          </text>
        </g>
      ))}
    </g>
  );
}
