import { Body1Strong, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import type { CurveSeries } from '../../entities/channels/channels.types';
import { FanCurveChart } from './chart/FanCurveChart';
import type { CurvePointMoveHandler } from './curves.types';

const useStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    padding: '16px 16px 8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 4px 6px',
  },
  hint: {
    color: tokens.colorNeutralForeground4,
  },
});

export interface FanCurveCardProps {
  readonly series: readonly CurveSeries[];
  readonly tempMax?: number | undefined;
  readonly showGrid?: boolean | undefined;
  readonly showFill?: boolean | undefined;
  /** Opacity of unfocused curves while one is focused, 0-1. */
  readonly dimmedOpacity?: number | undefined;
  readonly onPointMove?: CurvePointMoveHandler | undefined;
}

/**
 * The fan curve card: title, drag hint, and the chart. Curve state (unsaved
 * edits, no saved profile) is reported by the pill in the layout, below the
 * card.
 *
 * @returns The chart card.
 */
export function FanCurveCard({
  series,
  tempMax,
  showGrid,
  showFill,
  dimmedOpacity,
  onPointMove,
}: FanCurveCardProps): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Body1Strong>Fan curve</Body1Strong>
        <Caption1 className={styles.hint}>
          Drag points to adjust; click a curve to focus it
        </Caption1>
      </div>
      <FanCurveChart
        series={series}
        tempMax={tempMax}
        showGrid={showGrid}
        showFill={showFill}
        dimmedOpacity={dimmedOpacity}
        onPointMove={onPointMove}
      />
    </div>
  );
}
