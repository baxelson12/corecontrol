import { Button } from '@fluentui/react-components';
import type { ReactElement } from 'react';

/** Angles of the gear's teeth around its hub, in degrees. */
const TOOTH_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/**
 * Gear glyph: a hub and a toothed ring, drawn in the same stroke style as
 * the app's other icons.
 *
 * @returns The gear icon.
 */
function GearIcon(): ReactElement {
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
    >
      <circle cx="8" cy="8" r="2" />
      <circle cx="8" cy="8" r="4.6" />
      {TOOTH_ANGLES.map((angle) => (
        <line key={angle} x1="8" y1="1.6" x2="8" y2="3.4" transform={`rotate(${angle} 8 8)`} />
      ))}
    </svg>
  );
}

export interface SettingsButtonProps {
  readonly onOpen: () => void;
}

/**
 * Icon button that opens the settings page.
 *
 * @returns The gear button.
 */
export function SettingsButton({ onOpen }: SettingsButtonProps): ReactElement {
  return (
    <Button
      appearance="subtle"
      icon={<GearIcon />}
      onClick={onOpen}
      aria-label="Settings"
      title="Settings"
    />
  );
}
