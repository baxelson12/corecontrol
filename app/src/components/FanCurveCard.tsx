import { Body1Strong, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";
import { FanCurveChart } from "./fan-curve-chart/FanCurveChart";
import { UnsavedChangesPill } from "./UnsavedChangesPill";
import type { CurvePointMoveHandler, CurveSeries } from "./types";

const useStyles = makeStyles({
  root: {
    position: "relative",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    padding: "16px 16px 8px",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "0 4px 6px",
  },
  hint: {
    color: tokens.colorNeutralForeground4,
  },
  pill: {
    position: "absolute",
    left: "50%",
    bottom: "20px",
    transform: "translateX(-50%)",
  },
});

export interface FanCurveCardProps {
  readonly series: readonly CurveSeries[];
  /** Whether edited curves differ from the applied ones; shows the pill. */
  readonly dirty: boolean;
  readonly tempMax?: number | undefined;
  readonly showGrid?: boolean | undefined;
  readonly showFill?: boolean | undefined;
  readonly onPointMove?: CurvePointMoveHandler | undefined;
  readonly onRevert: () => void;
  readonly onApply: () => void;
}

/**
 * The fan curve card: title, drag hint, the chart, and the floating
 * unsaved-changes pill while `dirty`.
 *
 * @returns The chart card.
 */
export function FanCurveCard({
  series,
  dirty,
  tempMax,
  showGrid,
  showFill,
  onPointMove,
  onRevert,
  onApply,
}: FanCurveCardProps): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Body1Strong>Fan curve</Body1Strong>
        <Caption1 className={styles.hint}>Drag points to adjust</Caption1>
      </div>
      <FanCurveChart
        series={series}
        tempMax={tempMax}
        showGrid={showGrid}
        showFill={showFill}
        onPointMove={onPointMove}
      />
      {dirty && (
        <div className={styles.pill}>
          <UnsavedChangesPill onRevert={onRevert} onApply={onApply} />
        </div>
      )}
    </div>
  );
}
