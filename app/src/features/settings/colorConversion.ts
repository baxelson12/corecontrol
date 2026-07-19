/** An HSV color as the Fluent color picker exchanges it: hue 0–360,
 * saturation and value 0–1. */
export interface HsvColor {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

/** Clamps a channel fraction to 0–1. */
function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Formats a 0–1 channel fraction as a two-digit hex byte. */
function channelToHex(value: number): string {
  return Math.round(clampUnit(value) * 255)
    .toString(16)
    .padStart(2, '0');
}

/**
 * Converts an HSV color to a `#rrggbb` hex string, alpha ignored.
 *
 * @returns The hex color.
 */
export function hsvToHex(color: HsvColor): string {
  const h = ((color.h % 360) + 360) % 360;
  const s = clampUnit(color.s);
  const v = clampUnit(color.v);
  const channel = (n: number): number => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${channelToHex(channel(5))}${channelToHex(channel(3))}${channelToHex(channel(1))}`;
}

/** Converts 0–255 RGB channels to HSV. */
function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const rn = clampUnit(r / 255);
  const gn = clampUnit(g / 255);
  const bn = clampUnit(b / 255);
  const max = Math.max(rn, gn, bn);
  const delta = max - Math.min(rn, gn, bn);
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/**
 * Converts any CSS color string (hex, oklch, named, …) to HSV by painting
 * one pixel on a canvas and reading it back, so every notation the renderer
 * can paint is accepted.
 *
 * @returns The HSV color, or `null` when the canvas is unavailable or the
 * string is not a paintable color.
 */
export function cssColorToHsv(color: string): HsvColor | null {
  if (color.length === 0 || !CSS.supports('color', color)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return null;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 1, 1).data;
  return rgbToHsv(data[0] ?? 0, data[1] ?? 0, data[2] ?? 0);
}
