import { makeStyles, tokens } from "@fluentui/react-components";
import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";
import type { CurvePoint } from "../types";
import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  DUTY_MAX,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
  PLOT_BOTTOM,
  clamp,
  tempToX,
  dutyToY,
} from "./geometry";

const useStyles = makeStyles({
  handle: {
    cursor: "grab",
  },
});

export interface CurvePointHandleProps {
  readonly point: CurvePoint;
  readonly color: string;
  readonly tempMax: number;
  readonly onMove?: ((point: CurvePoint) => void) | undefined;
}

/**
 * A draggable curve point. Captures the pointer on press and reports each
 * movement as a chart-domain point, clamped to the plot area.
 *
 * @returns The point handle circle.
 */
export function CurvePointHandle({ point, color, tempMax, onMove }: CurvePointHandleProps): ReactElement {
  const styles = useStyles();

  function handlePointerDown(event: ReactPointerEvent<SVGCircleElement>): void {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGCircleElement>): void {
    if (onMove === undefined || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (svg === null) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const viewX = (event.clientX - rect.left) * (VIEW_WIDTH / rect.width);
    const viewY = (event.clientY - rect.top) * (VIEW_HEIGHT / rect.height);
    const temp = ((viewX - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT)) * tempMax;
    const duty = ((PLOT_BOTTOM - viewY) / (PLOT_BOTTOM - PLOT_TOP)) * DUTY_MAX;
    onMove({ temp: clamp(temp, 0, tempMax), duty: clamp(duty, 0, DUTY_MAX) });
  }

  return (
    <circle
      className={styles.handle}
      cx={tempToX(clamp(point.temp, 0, tempMax), tempMax)}
      cy={dutyToY(clamp(point.duty, 0, DUTY_MAX))}
      r={6}
      fill={tokens.colorNeutralBackground1}
      stroke={color}
      strokeWidth={2}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    />
  );
}
