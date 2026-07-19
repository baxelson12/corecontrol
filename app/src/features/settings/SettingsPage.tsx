import {
  Button,
  Caption1,
  makeStyles,
  Radio,
  RadioGroup,
  Switch,
  Title3,
  tokens,
} from '@fluentui/react-components';
import type { ReactElement } from 'react';
import { match } from 'ts-pattern';
import type { ThemePreference } from '../theme/theme.types';
import { ChartSection } from './ChartSection';
import { Section } from './Section';
import type { Preferences } from './settings.ipc';

const useStyles = makeStyles({
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  toggleText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
});

/** Back-arrow glyph for the header button. */
function BackIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="13.5" y1="8" x2="2.5" y2="8" />
      <polyline points="7,3.5 2.5,8 7,12.5" />
    </svg>
  );
}

interface ToggleRowProps {
  /** Setting name, e.g. "Profile guard". */
  readonly label: string;
  /** One-line explanation under the name. */
  readonly description: string;
  readonly checked: boolean;
  readonly disabled?: boolean | undefined;
  readonly onChange: (checked: boolean) => void;
}

/** One switch setting: name and description on the left, switch on the
 * right. */
function ToggleRow(props: ToggleRowProps): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleText}>
        <span>{props.label}</span>
        <Caption1 className={styles.muted}>{props.description}</Caption1>
      </div>
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        onChange={(_event, data) => props.onChange(data.checked)}
        aria-label={props.label}
      />
    </div>
  );
}

export interface SettingsPageProps {
  /** The user's theme choice: light, dark, or follow the OS. */
  readonly themePreference: ThemePreference;
  /** The current preferences, defaults applied. */
  readonly preferences: Preferences;
  readonly onBack: () => void;
  readonly onThemeChange: (preference: ThemePreference) => void;
  readonly onPreferencesChange: (change: Partial<Preferences>) => void;
}

/**
 * The settings page: theme choice, chart colors and focus dimming,
 * close-button behavior, profile guard, notifications, and the update
 * check. Purely presentational; every piece of state and behavior arrives
 * through props.
 *
 * @returns The settings page content.
 */
export function SettingsPage(props: SettingsPageProps): ReactElement {
  const styles = useStyles();
  return (
    <>
      <div className={styles.headerRow}>
        <Button
          appearance="subtle"
          icon={<BackIcon />}
          onClick={props.onBack}
          aria-label="Back"
          title="Back"
        />
        <Title3>Settings</Title3>
      </div>
      <Section title="Appearance">
        <RadioGroup
          layout="horizontal"
          value={props.themePreference}
          onChange={(_event, data) =>
            match(data.value)
              .with('light', 'dark', 'system', props.onThemeChange)
              .otherwise(() => undefined)
          }
          aria-label="Theme"
        >
          <Radio value="light" label="Light" />
          <Radio value="dark" label="Dark" />
          <Radio value="system" label="System" />
        </RadioGroup>
      </Section>
      <ChartSection
        preferences={props.preferences}
        onPreferencesChange={props.onPreferencesChange}
      />
      <Section title="Window">
        <Caption1 className={styles.muted}>When the close button is pressed</Caption1>
        <RadioGroup
          value={props.preferences.closeBehavior}
          onChange={(_event, data) =>
            match(data.value)
              .with('exit', 'tray', (closeBehavior) => props.onPreferencesChange({ closeBehavior }))
              .otherwise(() => undefined)
          }
          aria-label="Close button behavior"
        >
          <Radio value="exit" label="Exit CoreControl" />
          <Radio value="tray" label="Keep running in the notification area" />
        </RadioGroup>
      </Section>
      <Section title="Cooler">
        <ToggleRow
          label="Profile guard"
          description="Re-apply the saved fan profile if something else changes it"
          checked={props.preferences.watchdogEnabled}
          onChange={(watchdogEnabled) => props.onPreferencesChange({ watchdogEnabled })}
        />
        <ToggleRow
          label="Notify on restore"
          description="Announce it when the guard pushes the saved profile back"
          checked={props.preferences.restoreNotify}
          disabled={!props.preferences.watchdogEnabled}
          onChange={(restoreNotify) => props.onPreferencesChange({ restoreNotify })}
        />
      </Section>
      <Section title="Updates">
        <ToggleRow
          label="Check for updates"
          description="Look for a newer release on GitHub when the app starts"
          checked={props.preferences.updateCheck}
          onChange={(updateCheck) => props.onPreferencesChange({ updateCheck })}
        />
      </Section>
    </>
  );
}
