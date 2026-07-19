import {
  Caption1,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SwatchPicker,
  tokens,
} from '@fluentui/react-components';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { HsvColor } from './colorConversion';
import { cssColorToHsv, hsvToHex } from './colorConversion';

/** Preset swatches: the design hues at the design lightness and chroma, so
 * every preset stays readable in both themes. Includes the three defaults. */
const PRESETS = [
  { name: 'Red', color: 'oklch(0.68 0.14 25)' },
  { name: 'Orange', color: 'oklch(0.68 0.14 70)' },
  { name: 'Lime', color: 'oklch(0.68 0.14 110)' },
  { name: 'Green', color: 'oklch(0.68 0.14 155)' },
  { name: 'Teal', color: 'oklch(0.68 0.14 195)' },
  { name: 'Blue', color: 'oklch(0.68 0.14 235)' },
  { name: 'Violet', color: 'oklch(0.68 0.14 290)' },
  { name: 'Pink', color: 'oklch(0.68 0.14 330)' },
] as const;

/** Picker state while the current color cannot be parsed. */
const FALLBACK_HSV: HsvColor = { h: 235, s: 0.6, v: 0.75 };

const useStyles = makeStyles({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  swatchButton: {
    width: '28px',
    height: '28px',
    padding: '0',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
  },
  surface: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface ColorSettingRowProps {
  /** Channel name, e.g. "Radiator fans". */
  readonly label: string;
  /** Current CSS color of the channel. */
  readonly value: string;
  readonly onChange: (color: string) => void;
}

/**
 * One channel-color setting: the channel name on the left, a swatch button
 * on the right that opens preset swatches plus a free color picker. Preset
 * choices report their oklch string, custom choices a hex string; both land
 * live via `onChange`.
 *
 * @returns The color setting row.
 */
export function ColorSettingRow({ label, value, onChange }: ColorSettingRowProps): ReactElement {
  const styles = useStyles();
  const [hsv, setHsv] = useState<HsvColor>(() => cssColorToHsv(value) ?? FALLBACK_HSV);

  function handlePresetSelect(selectedValue: string): void {
    onChange(selectedValue);
    setHsv(cssColorToHsv(selectedValue) ?? FALLBACK_HSV);
  }

  function handleCustomChange(color: HsvColor): void {
    setHsv(color);
    onChange(hsvToHex(color));
  }

  return (
    <div className={styles.row}>
      <span>{label}</span>
      <Popover trapFocus positioning={{ position: 'below', align: 'end', offset: 6 }}>
        <PopoverTrigger disableButtonEnhancement>
          <button
            type="button"
            className={styles.swatchButton}
            style={{ backgroundColor: value }}
            aria-label={`${label} color`}
            title={`${label} color`}
          />
        </PopoverTrigger>
        <PopoverSurface className={styles.surface}>
          <SwatchPicker
            selectedValue={value}
            onSelectionChange={(_event, data) => handlePresetSelect(data.selectedValue)}
            aria-label={`${label} preset colors`}
          >
            {PRESETS.map((preset) => (
              <ColorSwatch
                key={preset.name}
                color={preset.color}
                value={preset.color}
                aria-label={preset.name}
              />
            ))}
          </SwatchPicker>
          <Caption1 className={styles.muted}>Custom</Caption1>
          <ColorPicker color={hsv} onColorChange={(_event, data) => handleCustomChange(data.color)}>
            <ColorArea aria-label={`${label} custom color`} />
            <ColorSlider aria-label={`${label} hue`} />
          </ColorPicker>
        </PopoverSurface>
      </Popover>
    </div>
  );
}
