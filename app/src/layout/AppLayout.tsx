import { makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";
import { match } from "ts-pattern";
import { TitleBar } from "../components/TitleBar";
import { DeviceHeader } from "../components/DeviceHeader";
import { ThemeToggle } from "../components/ThemeToggle";
import { StatCard } from "../components/StatCard";
import type { StatCardProps } from "../components/StatCard";
import { FanCurveCard } from "../components/FanCurveCard";
import { UnsavedChangesPill } from "../components/UnsavedChangesPill";
import type { CurvePointMoveHandler, CurveSeries, CurveSource, ThemeName } from "../components/types";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  main: {
    flexGrow: 1,
    overflowY: "auto",
    width: "100%",
    maxWidth: "908px",
    margin: "0 auto",
    padding: "20px 24px 24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },
  pillRow: {
    position: "fixed",
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 10,
  },
});

export interface AppLayoutProps {
  /** Window title shown in the custom title bar. */
  readonly title: string;
  /** Category eyebrow, e.g. "Liquid cooler". */
  readonly deviceLabel: string;
  /** Product name, e.g. "MEG Core Liquid S280". */
  readonly deviceName: string;
  readonly theme: ThemeName;
  /** One readout card per cooling channel. */
  readonly stats: readonly StatCardProps[];
  readonly series: readonly CurveSeries[];
  /** Whether edited curves differ from the applied ones. */
  readonly dirty: boolean;
  /** Where the shown curves came from (device profile or defaults). */
  readonly curveSource: CurveSource;
  readonly tempMax?: number | undefined;
  readonly showGrid?: boolean | undefined;
  readonly showFill?: boolean | undefined;
  readonly onToggleTheme: () => void;
  readonly onPointMove?: CurvePointMoveHandler | undefined;
  readonly onRevert: () => void;
  readonly onApply: () => void;
  readonly onDragStart: () => void;
  readonly onMinimize: () => void;
  readonly onClose: () => void;
}

/**
 * The whole window: title bar, device header with theme toggle, channel
 * stat cards, and the fan curve card. Purely presentational; every piece of
 * state and behavior arrives through props.
 *
 * @returns The app layout.
 */
export function AppLayout(props: AppLayoutProps): ReactElement {
  const styles = useStyles();
  const pillMessage = match(props.curveSource)
    .with("defaults", () => "No saved profile yet")
    .with("saved", () => "Saved profile not applied")
    .with("device", () => "Unsaved changes")
    .exhaustive();
  return (
    <div className={styles.root}>
      <TitleBar
        title={props.title}
        onDragStart={props.onDragStart}
        onMinimize={props.onMinimize}
        onClose={props.onClose}
      />
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <DeviceHeader label={props.deviceLabel} name={props.deviceName} />
          <ThemeToggle theme={props.theme} onToggle={props.onToggleTheme} />
        </div>
        <div className={styles.statsGrid}>
          {props.stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
        <FanCurveCard
          series={props.series}
          tempMax={props.tempMax}
          showGrid={props.showGrid}
          showFill={props.showFill}
          onPointMove={props.onPointMove}
        />
        {props.dirty && (
          <div className={styles.pillRow}>
            <UnsavedChangesPill
              message={pillMessage}
              revertDisabled={props.curveSource === "defaults"}
              onRevert={props.onRevert}
              onApply={props.onApply}
            />
          </div>
        )}
      </main>
    </div>
  );
}
