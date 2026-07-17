import { Caption1, makeStyles, tokens } from "@fluentui/react-components";
import type { MouseEvent, ReactElement } from "react";

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
  readonly title: string;
  /** Called on a primary-button press outside the caption buttons. */
  readonly onDragStart: () => void;
  readonly onMinimize: () => void;
  readonly onClose: () => void;
}

/**
 * Custom window title bar: accent app mark, title, and Windows-style
 * minimize and close buttons. The actual window commands are wired up by
 * the caller.
 */
export function TitleBar({ title, onDragStart, onMinimize, onClose }: TitleBarProps): ReactElement {
  const styles = useStyles();

  function handleMouseDown(event: MouseEvent<HTMLElement>): void {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    onDragStart();
  }

  return (
    <header className={styles.root} onMouseDown={handleMouseDown}>
      <span className={styles.appMark} />
      <Caption1 className={styles.title}>{title}</Caption1>
      <div className={styles.buttons}>
        <button type="button" className={styles.captionButton} aria-label="Minimize" onClick={onMinimize}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" />
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
