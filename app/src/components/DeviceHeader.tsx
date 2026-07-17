import { Caption1, Subtitle1, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactElement } from "react";

const useStyles = makeStyles({
  eyebrow: {
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: tokens.colorNeutralForeground4,
  },
  name: {
    display: "block",
    marginTop: "2px",
  },
});

export interface DeviceHeaderProps {
  /** Small uppercase category line above the name, e.g. "Liquid cooler". */
  readonly label: string;
  /** Product name, e.g. "MEG Core Liquid S280". */
  readonly name: string;
}

/** Device identity block: category eyebrow over the product name. */
export function DeviceHeader({ label, name }: DeviceHeaderProps): ReactElement {
  const styles = useStyles();
  return (
    <div>
      <Caption1 className={styles.eyebrow}>{label}</Caption1>
      <Subtitle1 className={styles.name}>{name}</Subtitle1>
    </div>
  );
}
