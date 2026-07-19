import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ReactElement } from 'react';
import { useCallback, useEffect } from 'react';
import { match } from 'ts-pattern';
import { profileRestoreNotified } from '../core/toasts/toasts.thunks';
import {
  preferencesChanged,
  settingsClosed,
  settingsOpened,
} from '../entities/settings/settings.slice';
import { settingsLoadStarted } from '../entities/settings/settings.thunks';
import {
  selectEffectiveTheme,
  systemThemeChanged,
  themeChosen,
} from '../entities/theme/theme.slice';
import {
  selectApplyPhase,
  selectColoredSeries,
  selectCurvesDirty,
} from '../features/curves/curves.selectors';
import { curvePointMoved, curvesReverted } from '../features/curves/curves.slice';
import { curvesApplied, savedProfilePushStarted } from '../features/curves/curves.thunks';
import { deviceName } from '../features/detection/detection.ipc';
import { coolerScanStarted } from '../features/detection/detection.slice';
import { SettingsPage } from '../features/settings/SettingsPage';
import { fanStatusPolled, selectFanStats } from '../features/status/status.slice';
import { updateCheckStarted } from '../features/updates/updates.thunks';
import { AppLayout } from './AppLayout';
import { AppToaster } from './AppToaster';
import { useAppDispatch, useAppSelector } from './hooks';
import type { AppDispatch } from './store';
import { WindowFrame } from './WindowFrame';

const appWindow = getCurrentWindow();

/** How often the live fan status is polled, in milliseconds. */
const STATUS_POLL_MS = 1000;

/** Backend event fired when the watchdog pushed the saved profile back. */
const PROFILE_RESTORED_EVENT = 'saved-profile-restored';

/** Backend event fired when the tray menu asks for the settings page. */
const OPEN_SETTINGS_EVENT = 'open-settings';

/** Loads settings, then starts the update check and cooler detection. */
function useStartup(dispatch: AppDispatch): void {
  useEffect(() => {
    void (async () => {
      await dispatch(settingsLoadStarted());
      void dispatch(updateCheckStarted());
      await dispatch(coolerScanStarted());
    })();
  }, [dispatch]);
}

/** Subscribes `handler` to a backend event for the component's lifetime. */
function useBackendEvent(event: string, handler: () => void): void {
  useEffect(() => {
    const unlisten = listen(event, handler);
    return () => {
      void unlisten.then((stop) => stop()).catch(console.error);
    };
  }, [event, handler]);
}

/** Keeps the store's copy of the OS theme preference fresh. */
function useSystemThemeWatch(dispatch: AppDispatch): void {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent): void => {
      dispatch(systemThemeChanged(event.matches ? 'dark' : 'light'));
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [dispatch]);
}

/** Polls the live fan status while a cooler is open, pushing the saved
 * profile once when the cooler appears. */
function useStatusPolling(dispatch: AppDispatch, coolerFound: boolean): void {
  useEffect(() => {
    if (!coolerFound) {
      return undefined;
    }
    void dispatch(savedProfilePushStarted());
    void dispatch(fanStatusPolled());
    const timer = setInterval(() => void dispatch(fanStatusPolled()), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, coolerFound]);
}

/**
 * Root view: loads the persisted settings, then kicks off the update check
 * and cooler detection; once a cooler is open it pushes the saved fan
 * profile to the device and polls it for live status. Renders the main
 * layout or the settings page, bound to the store.
 *
 * @returns The themed app.
 */
function App(): ReactElement {
  const dispatch = useAppDispatch();
  const theme = useAppSelector(selectEffectiveTheme);
  const themePreference = useAppSelector((state) => state.theme.preference);
  const settingsOpen = useAppSelector((state) => state.settings.open);
  const preferences = useAppSelector((state) => state.settings.preferences);
  const detection = useAppSelector((state) => state.detection);
  const series = useAppSelector((state) => state.curves.edited);
  const coloredSeries = useAppSelector(selectColoredSeries);
  const curveSource = useAppSelector((state) => state.curves.source);
  const dirty = useAppSelector(selectCurvesDirty);
  const applyPhase = useAppSelector(selectApplyPhase);
  const stats = useAppSelector(selectFanStats);
  const coolerFound = detection.state === 'found';

  useStartup(dispatch);
  useSystemThemeWatch(dispatch);
  useStatusPolling(dispatch, coolerFound);
  useBackendEvent(
    PROFILE_RESTORED_EVENT,
    useCallback(() => void dispatch(profileRestoreNotified()), [dispatch]),
  );
  useBackendEvent(
    OPEN_SETTINGS_EVENT,
    useCallback(() => {
      dispatch(settingsOpened());
    }, [dispatch]),
  );

  const fluentTheme = match(theme)
    .with('dark', () => webDarkTheme)
    .with('light', () => webLightTheme)
    .exhaustive();

  const windowProps = {
    title: 'CoreControl',
    onDragStart: () => appWindow.startDragging().catch(console.error),
    onMinimize: () => appWindow.hide().catch(console.error),
    onClose: () =>
      match(preferences.closeBehavior)
        .with('tray', () => appWindow.hide())
        .with('exit', () => appWindow.close())
        .exhaustive()
        .catch(console.error),
  };

  return (
    <FluentProvider theme={fluentTheme}>
      {settingsOpen ? (
        <WindowFrame {...windowProps}>
          <SettingsPage
            themePreference={themePreference}
            preferences={preferences}
            onBack={() => dispatch(settingsClosed())}
            onThemeChange={(preference) => void dispatch(themeChosen(preference))}
            onPreferencesChange={(change) => void dispatch(preferencesChanged(change))}
          />
        </WindowFrame>
      ) : (
        <AppLayout
          {...windowProps}
          deviceLabel="Liquid cooler"
          deviceName={deviceName(detection)}
          stats={stats}
          series={coloredSeries}
          dimmedOpacity={preferences.dimmedOpacity}
          dirty={dirty && coolerFound && applyPhase !== 'verifying'}
          curveSource={curveSource}
          onOpenSettings={() => dispatch(settingsOpened())}
          onPointMove={(seriesIndex, pointIndex, point) =>
            dispatch(curvePointMoved({ seriesIndex, pointIndex, point }))
          }
          onRevert={() => dispatch(curvesReverted())}
          onApply={() => void dispatch(curvesApplied(series))}
        />
      )}
      <AppToaster />
    </FluentProvider>
  );
}

export default App;
