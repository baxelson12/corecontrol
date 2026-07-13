import { Caption1, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";

const useStyles = makeStyles({
  root: {
    height: "40px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    paddingLeft: "16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  appMark: {
    width: "14px",
    height: "14px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
  },
  title: {
    flexGrow: 1,
    color: tokens.colorNeutralForeground3,
  },
  buttons: {
    display: "flex",
    alignSelf: "stretch",
  },
  captionButton: {
    width: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    border: "none",
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground3,
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
  },
  closeButton: {
    ":hover": {
      backgroundColor: "#c42b1c",
      color: "#ffffff",
    },
  },
});

export interface TitleBarProps {
  /** Window title, e.g. "AIO Cooler Control". */
  readonly title: string;
  readonly onMinimize: () => void;
  readonly onMaximize: () => void;
  readonly onClose: () => void;
}

/**
 * Custom window title bar: accent app mark, title, and Windows-style
 * minimize, maximize, and close buttons. Window dragging and the actual
 * window commands are wired up by the caller.
 *
 * @returns The title bar.
 */
export function TitleBar({ title, onMinimize, onMaximize, onClose }: TitleBarProps): ReactElement {
  const styles = useStyles();
  return (
    <header className={styles.root}>
      <span className={styles.appMark} />
      <Caption1 className={styles.title}>{title}</Caption1>
      <div className={styles.buttons}>
        <button type="button" className={styles.captionButton} aria-label="Minimize" onClick={onMinimize}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" />
          </svg>
        </button>
        <button type="button" className={styles.captionButton} aria-label="Maximize" onClick={onMaximize}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.captionButton} ${styles.closeButton}`}
          aria-label="Close"
          onClick={onClose}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" />
          </svg>
        </button>
      </div>
    </header>
  );
}
