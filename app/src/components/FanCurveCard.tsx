import { Badge, Body1Strong, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";
import { FanCurveChart } from "./fan-curve-chart/FanCurveChart";
import { UnsavedChangesPill } from "./UnsavedChangesPill";
import type { CurvePointMoveHandler, CurveSeries, CurveSource } from "./types";

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
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
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
  /** Where the shown curves came from; defaults get a "not applied" badge. */
  readonly source: CurveSource;
  readonly tempMax?: number | undefined;
  readonly showGrid?: boolean | undefined;
  readonly showFill?: boolean | undefined;
  readonly onPointMove?: CurvePointMoveHandler | undefined;
  readonly onRevert: () => void;
  readonly onApply: () => void;
}

/**
 * The fan curve card: title, drag hint, the chart, and the floating
 * unsaved-changes pill while `dirty`. While the curves are the fallback
 * defaults rather than a profile read from the device, a badge says so.
 *
 * @returns The chart card.
 */
export function FanCurveCard({
  series,
  dirty,
  source,
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
        <div className={styles.titleGroup}>
          <Body1Strong>Fan curve</Body1Strong>
          {source === "defaults" && (
            <Badge appearance="tint" color="warning" size="small">
              Defaults, not applied yet
            </Badge>
          )}
        </div>
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
