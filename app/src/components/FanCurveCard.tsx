import { Badge, Body1Strong, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";
import { FanCurveChart } from "./fan-curve-chart/FanCurveChart";
import type { CurvePointMoveHandler, CurveSeries, CurveSource } from "./types";

const useStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    padding: "16px 16px 8px",
  },
  header: {
    display: "flex",
    alignItems: "center",
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
});

export interface FanCurveCardProps {
  readonly series: readonly CurveSeries[];
  /** Where the shown curves came from; defaults get a "not applied" badge. */
  readonly source: CurveSource;
  readonly tempMax?: number | undefined;
  readonly showGrid?: boolean | undefined;
  readonly showFill?: boolean | undefined;
  readonly onPointMove?: CurvePointMoveHandler | undefined;
}

/**
 * The fan curve card: title, drag hint, and the chart. While the curves are
 * the fallback defaults rather than a profile read from the device, a badge
 * says so. The unsaved-changes pill lives in the layout, below the card.
 *
 * @returns The chart card.
 */
export function FanCurveCard({
  series,
  source,
  tempMax,
  showGrid,
  showFill,
  onPointMove,
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
    </div>
  );
}
