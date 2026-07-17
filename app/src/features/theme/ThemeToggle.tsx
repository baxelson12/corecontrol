import { Button } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import { useId } from 'react';
import { match } from 'ts-pattern';
import type { ThemeName } from './theme.types';

/** Sun glyph, shown in dark mode to offer switching to light. */
function SunIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="3.4" />
      <line x1="8" y1="0.7" x2="8" y2="2.4" />
      <line x1="8" y1="13.6" x2="8" y2="15.3" />
      <line x1="0.7" y1="8" x2="2.4" y2="8" />
      <line x1="13.6" y1="8" x2="15.3" y2="8" />
      <line x1="2.8" y1="2.8" x2="4" y2="4" />
      <line x1="12" y1="12" x2="13.2" y2="13.2" />
      <line x1="2.8" y1="13.2" x2="4" y2="12" />
      <line x1="12" y1="4" x2="13.2" y2="2.8" />
    </svg>
  );
}

/** Crescent moon glyph, shown in light mode to offer switching to dark. */
function MoonIcon(): ReactElement {
  const maskId = useId();
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <mask id={maskId}>
        <rect width="16" height="16" fill="#fff" />
        <circle cx="11.5" cy="4.5" r="5.6" fill="#000" />
      </mask>
      <circle cx="8" cy="8" r="6" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export interface ThemeToggleProps {
  readonly theme: ThemeName;
  readonly onToggle: () => void;
}

/**
 * Icon button that switches between light and dark theme. Shows the theme
 * you would switch to: a sun while dark, a moon while light.
 */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps): ReactElement {
  const icon = match(theme)
    .with('dark', () => <SunIcon />)
    .with('light', () => <MoonIcon />)
    .exhaustive();
  return (
    <Button
      appearance="subtle"
      icon={icon}
      onClick={onToggle}
      aria-label="Switch theme"
      title="Switch theme"
    />
  );
}
