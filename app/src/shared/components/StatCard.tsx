import { Caption1, makeStyles, Title3, tokens } from '@fluentui/react-components';
import type { ReactElement } from 'react';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '14px 16px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: tokens.borderRadiusCircular,
  },
  value: {
    lineHeight: '1',
  },
  unit: {
    color: tokens.colorNeutralForeground4,
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface StatCardProps {
  /** Channel name, e.g. "Radiator fans". */
  readonly label: string;
  /** Channel color, matching its curve on the chart. */
  readonly color: string;
  /** Current speed in RPM, or `null` before the first reading. */
  readonly rpm: number | null;
  /** Current duty in percent, or `null` before the first reading. */
  readonly dutyPct: number | null;
}

/**
 * Live readout card for one cooling channel: colored dot, name, RPM, and
 * duty percentage. Values still awaiting a reading render as a dash.
 *
 * @returns The stat card.
 */
export function StatCard({ label, color, rpm, dutyPct }: StatCardProps): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.labelRow}>
        <span className={styles.dot} style={{ backgroundColor: color }} />
        <Caption1 className={styles.muted}>{label}</Caption1>
      </div>
      <Title3 className={styles.value}>
        {rpm === null ? '-' : Math.round(rpm).toLocaleString()}
        <Caption1 className={styles.unit}> RPM</Caption1>
      </Title3>
      <Caption1 className={styles.muted}>
        {dutyPct === null ? '-' : `${Math.round(dutyPct)}%`} duty
      </Caption1>
    </div>
  );
}
