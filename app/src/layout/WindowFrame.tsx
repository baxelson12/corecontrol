import { makeStyles, tokens } from '@fluentui/react-components';
import type { ReactElement, ReactNode } from 'react';
import { TitleBar } from '../components/TitleBar';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  main: {
    flexGrow: 1,
    overflowY: 'auto',
    width: '100%',
    maxWidth: '908px',
    margin: '0 auto',
    padding: '20px 24px 24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
});

export interface WindowFrameProps {
  /** Window title shown in the custom title bar. */
  readonly title: string;
  /** Called on a primary-button press outside the caption buttons. */
  readonly onDragStart: () => void;
  readonly onMinimize: () => void;
  readonly onClose: () => void;
  /** The page shown under the title bar. */
  readonly children: ReactNode;
}

/**
 * Window chrome shared by every page: the custom title bar over a scrolling
 * centered content column.
 *
 * @returns The framed page.
 */
export function WindowFrame(props: WindowFrameProps): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <TitleBar
        title={props.title}
        onDragStart={props.onDragStart}
        onMinimize={props.onMinimize}
        onClose={props.onClose}
      />
      <main className={styles.main}>{props.children}</main>
    </div>
  );
}
