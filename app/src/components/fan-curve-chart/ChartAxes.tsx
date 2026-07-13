import { makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";
import { AXIS_DIVISIONS, DUTY_MAX, PLOT_LEFT, PLOT_RIGHT, PLOT_TOP, PLOT_BOTTOM, tempToX, dutyToY } from "./geometry";

const useStyles = makeStyles({
  tickLabel: {
    fontSize: "10px",
    fill: tokens.colorNeutralForeground4,
  },
});

/**
 * The two axis lines with temperature and duty tick labels at each quarter.
 *
 * @returns The axes layer.
 */
export function ChartAxes({ tempMax }: { readonly tempMax: number }): ReactElement {
  const styles = useStyles();
  const tempTicks = Array.from({ length: AXIS_DIVISIONS + 1 }, (_, i) =>
    Math.round((tempMax * i) / AXIS_DIVISIONS),
  );
  const dutyTicks = Array.from({ length: AXIS_DIVISIONS + 1 }, (_, i) => (DUTY_MAX * i) / AXIS_DIVISIONS);
  return (
    <g>
      <line x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} stroke={tokens.colorNeutralStroke2} />
      <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} stroke={tokens.colorNeutralStroke2} />
      {tempTicks.map((t) => (
        <text key={t} className={styles.tickLabel} x={tempToX(t, tempMax)} y={PLOT_BOTTOM + 18} textAnchor="middle">
          {t}°C
        </text>
      ))}
      {dutyTicks.map((d) => (
        <text key={d} className={styles.tickLabel} x={PLOT_LEFT - 8} y={dutyToY(d) + 3} textAnchor="end">
          {d}%
        </text>
      ))}
    </g>
  );
}
