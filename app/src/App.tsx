import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { match } from 'ts-pattern';
import { selectApplyPhase, selectCurvesDirty } from './features/curves/curves.selectors';
import { curvePointMoved, curvesReverted } from './features/curves/curves.slice';
import { curvesApplied, savedProfilePushStarted } from './features/curves/curves.thunks';
import { deviceName } from './features/detection/detection.ipc';
import { coolerScanStarted } from './features/detection/detection.slice';
import { settingsLoadStarted } from './features/settings/settings.thunks';
import { fanStatusPolled, selectFanStats } from './features/status/status.slice';
import { themeToggled } from './features/theme/theme.slice';
import { AppToaster } from './features/toasts/AppToaster';
import { savedProfileRestored } from './features/toasts/toasts.slice';
import { AppLayout } from './layout/AppLayout';
import { useAppDispatch, useAppSelector } from './store/hooks';

const appWindow = getCurrentWindow();

/** How often the live fan status is polled, in milliseconds. */
const STATUS_POLL_MS = 1000;

/** Backend event fired when the watchdog pushed the saved profile back. */
const PROFILE_RESTORED_EVENT = 'saved-profile-restored';

/**
 * Root view: loads the persisted settings, then kicks off cooler detection;
 * once a cooler is open it pushes the saved fan profile to the device and
 * polls it for live status, binding the store to the presentational layout.
 */
function App(): ReactElement {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.name);
  const detection = useAppSelector((state) => state.detection);
  const series = useAppSelector((state) => state.curves.edited);
  const curveSource = useAppSelector((state) => state.curves.source);
  const dirty = useAppSelector(selectCurvesDirty);
  const applyPhase = useAppSelector(selectApplyPhase);
  const stats = useAppSelector(selectFanStats);
  const coolerFound = detection.state === 'found';

  useEffect(() => {
    void (async () => {
      await dispatch(settingsLoadStarted());
      await dispatch(coolerScanStarted());
    })();
  }, [dispatch]);

  useEffect(() => {
    const unlisten = listen(PROFILE_RESTORED_EVENT, () => {
      dispatch(savedProfileRestored());
    });
    return () => {
      void unlisten.then((stop) => stop()).catch(console.error);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!coolerFound) {
      return undefined;
    }
    void dispatch(savedProfilePushStarted());
    void dispatch(fanStatusPolled());
    const timer = setInterval(() => void dispatch(fanStatusPolled()), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, coolerFound]);

  const fluentTheme = match(theme)
    .with('dark', () => webDarkTheme)
    .with('light', () => webLightTheme)
    .exhaustive();

  return (
    <FluentProvider theme={fluentTheme}>
      <AppLayout
        title="CoreControl"
        deviceLabel="Liquid cooler"
        deviceName={deviceName(detection)}
        theme={theme}
        stats={stats}
        series={series}
        dirty={dirty && coolerFound && applyPhase !== 'verifying'}
        curveSource={curveSource}
        onToggleTheme={() => void dispatch(themeToggled())}
        onPointMove={(seriesIndex, pointIndex, point) =>
          dispatch(curvePointMoved({ seriesIndex, pointIndex, point }))
        }
        onRevert={() => dispatch(curvesReverted())}
        onApply={() => void dispatch(curvesApplied(series))}
        onDragStart={() => appWindow.startDragging().catch(console.error)}
        onMinimize={() => appWindow.hide().catch(console.error)}
        onClose={() => appWindow.close().catch(console.error)}
      />
      <AppToaster />
    </FluentProvider>
  );
}

export default App;
