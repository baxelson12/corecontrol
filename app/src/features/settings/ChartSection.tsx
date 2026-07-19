import { Caption1, makeStyles, Slider, tokens } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import type { ChannelColors } from '../../entities/channels/channels.types';
import type { Preferences } from '../../entities/settings/settings.ipc';
import { ColorSettingRow } from './ColorSettingRow';
import { Section } from './Section';

/** The color-configurable channels, in display order. */
const CHANNELS = [
  { key: 'radiatorFans', label: 'Radiator fans' },
  { key: 'unitFan', label: 'Unit fan' },
  { key: 'pump', label: 'Pump' },
] as const;

const useStyles = makeStyles({
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  sliderText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  sliderControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sliderValue: {
    minWidth: '36px',
    textAlign: 'right',
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface ChartSectionProps {
  /** The chart-related preferences: channel colors and focus dimming. */
  readonly preferences: Pick<Preferences, 'channelColors' | 'dimmedOpacity'>;
  readonly onPreferencesChange: (change: Partial<Preferences>) => void;
}

/** The focus-dimming setting: explanation on the left, slider with the
 * current percentage on the right. */
function DimmingRow(props: {
  readonly percent: number;
  readonly onChange: (opacity: number) => void;
}): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderText}>
        <span>Focus dimming</span>
        <Caption1 className={styles.muted}>
          How visible the other curves stay while one is focused
        </Caption1>
      </div>
      <div className={styles.sliderControl}>
        <Slider
          min={0}
          max={100}
          step={5}
          value={props.percent}
          onChange={(_event, data) => props.onChange(data.value / 100)}
          aria-label="Unfocused curve opacity"
        />
        <Caption1 className={styles.sliderValue}>{props.percent}%</Caption1>
      </div>
    </div>
  );
}

/**
 * The Chart settings section: one color row per channel and the
 * focus-dimming slider. Changes land live as partial preference updates.
 *
 * @returns The chart section card.
 */
export function ChartSection(props: ChartSectionProps): ReactElement {
  const { channelColors, dimmedOpacity } = props.preferences;
  const dimmedPercent = Math.round(Math.min(1, Math.max(0, dimmedOpacity)) * 100);

  function handleColorChange(key: keyof ChannelColors, color: string): void {
    props.onPreferencesChange({ channelColors: { ...channelColors, [key]: color } });
  }

  return (
    <Section title="Chart">
      {CHANNELS.map((channel) => (
        <ColorSettingRow
          key={channel.key}
          label={channel.label}
          value={channelColors[channel.key]}
          onChange={(color) => handleColorChange(channel.key, color)}
        />
      ))}
      <DimmingRow
        percent={dimmedPercent}
        onChange={(newOpacity) => props.onPreferencesChange({ dimmedOpacity: newOpacity })}
      />
    </Section>
  );
}
