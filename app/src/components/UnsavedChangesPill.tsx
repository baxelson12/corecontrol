import { Button, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px 8px 16px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
  },
  message: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
  },
});

export interface UnsavedChangesPillProps {
  /** Status text. Defaults to "Unsaved changes". */
  readonly message?: string;
  /** Disables Revert while there is no saved profile to fall back to. */
  readonly revertDisabled?: boolean;
  readonly onRevert: () => void;
  readonly onApply: () => void;
}

/**
 * Floating pill shown while edited fan curves differ from the applied ones.
 * The layout keeps it below the chart, at the bottom of the window.
 *
 * @returns The pill with Revert and Apply actions.
 */
export function UnsavedChangesPill({
  message = "Unsaved changes",
  revertDisabled = false,
  onRevert,
  onApply,
}: UnsavedChangesPillProps): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Caption1 className={styles.message}>{message}</Caption1>
      <Button size="small" disabled={revertDisabled} onClick={onRevert}>
        Revert
      </Button>
      <Button size="small" appearance="primary" onClick={onApply}>
        Apply
      </Button>
    </div>
  );
}
