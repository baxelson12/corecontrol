import { makeStyles } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import { match } from 'ts-pattern';
import type { CurveSeries } from '../entities/channels/channels.types';
import type { CurvePointMoveHandler, CurveSource } from '../features/curves/curves.types';
import { FanCurveCard } from '../features/curves/FanCurveCard';
import { SettingsButton } from '../features/settings/SettingsButton';
import type { ChannelStat } from '../features/status/status.slice';
import { DeviceHeader } from '../shared/components/DeviceHeader';
import { StatCard } from '../shared/components/StatCard';
import { UnsavedChangesPill } from '../shared/components/UnsavedChangesPill';
import { WindowFrame } from './WindowFrame';

const useStyles = makeStyles({
  headerRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '16px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  pillRow: {
    position: 'fixed',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
});

export interface AppLayoutProps {
  /** Window title shown in the custom title bar. */
  readonly title: string;
  /** Category eyebrow, e.g. "Liquid cooler". */
  readonly deviceLabel: string;
  /** Product name, e.g. "MEG Core Liquid S280". */
  readonly deviceName: string;
  /** One readout card per cooling channel. */
  readonly stats: readonly ChannelStat[];
  readonly series: readonly CurveSeries[];
  /** Whether edited curves differ from the applied ones. */
  readonly dirty: boolean;
  /** Where the shown curves came from (device profile or defaults). */
  readonly curveSource: CurveSource;
  readonly tempMax?: number | undefined;
  readonly showGrid?: boolean | undefined;
  readonly showFill?: boolean | undefined;
  /** Opacity of unfocused curves while one is focused, 0-1. */
  readonly dimmedOpacity?: number | undefined;
  readonly onOpenSettings: () => void;
  readonly onPointMove?: CurvePointMoveHandler | undefined;
  readonly onRevert: () => void;
  readonly onApply: () => void;
  readonly onDragStart: () => void;
  readonly onMinimize: () => void;
  readonly onClose: () => void;
}

/**
 * The main view: device header with the settings button, channel stat
 * cards, and the fan curve card, inside the shared window frame. Purely
 * presentational; every piece of state and behavior arrives through props.
 *
 * @returns The app layout.
 */
export function AppLayout(props: AppLayoutProps): ReactElement {
  const styles = useStyles();
  const pillMessage = match(props.curveSource)
    .with('defaults', () => 'No saved profile yet')
    .with('saved', () => 'Saved profile not applied')
    .with('device', () => 'Unsaved changes')
    .exhaustive();
  return (
    <WindowFrame
      title={props.title}
      onDragStart={props.onDragStart}
      onMinimize={props.onMinimize}
      onClose={props.onClose}
    >
      <div className={styles.headerRow}>
        <DeviceHeader label={props.deviceLabel} name={props.deviceName} />
        <SettingsButton onOpen={props.onOpenSettings} />
      </div>
      <div className={styles.statsGrid}>
        {props.stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
      <FanCurveCard
        series={props.series}
        tempMax={props.tempMax}
        showGrid={props.showGrid}
        showFill={props.showFill}
        dimmedOpacity={props.dimmedOpacity}
        onPointMove={props.onPointMove}
      />
      {props.dirty && (
        <div className={styles.pillRow}>
          <UnsavedChangesPill
            message={pillMessage}
            revertDisabled={props.curveSource === 'defaults'}
            onRevert={props.onRevert}
            onApply={props.onApply}
          />
        </div>
      )}
    </WindowFrame>
  );
}
