import { makeStyles, Subtitle2, tokens } from '@fluentui/react-components';
import type { ReactElement, ReactNode } from 'react';

const useStyles = makeStyles({
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px 16px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
  },
});

export interface SectionProps {
  /** Section heading, e.g. "Appearance". */
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * One card-styled settings group.
 *
 * @returns The section card.
 */
export function Section({ title, children }: SectionProps): ReactElement {
  const styles = useStyles();
  return (
    <section className={styles.section}>
      <Subtitle2>{title}</Subtitle2>
      {children}
    </section>
  );
}
