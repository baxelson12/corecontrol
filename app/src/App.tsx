import { useEffect } from "react";
import type { ReactElement } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { match } from "ts-pattern";
import { AppLayout } from "./layout/AppLayout";
import { AppToaster } from "./components/AppToaster";
import { deviceName } from "./utils/detection";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { themeToggled } from "./store/themeSlice";
import { coolerScanStarted } from "./store/detectionSlice";
import { settingsLoadStarted } from "./store/settingsThunks";
import {
  curvePointMoved,
  curvesApplied,
  curvesReverted,
  savedProfilePushStarted,
  selectApplyPhase,
  selectCurvesDirty,
} from "./store/curvesSlice";
import { fanStatusPolled, selectFanStats } from "./store/statusSlice";

const appWindow = getCurrentWindow();

/** How often the live fan status is polled, in milliseconds. */
const STATUS_POLL_MS = 1000;

/**
 * Root view: loads the persisted settings, then kicks off cooler detection;
 * once a cooler is open it pushes the saved fan profile to the device and
 * polls it for live status, binding the store to the presentational layout.
 *
 * @returns The themed app.
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
  const coolerFound = detection.state === "found";

  useEffect(() => {
    void (async () => {
      await dispatch(settingsLoadStarted());
      await dispatch(coolerScanStarted());
    })();
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
    .with("dark", () => webDarkTheme)
    .with("light", () => webLightTheme)
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
        dirty={dirty && coolerFound && applyPhase !== "verifying"}
        curveSource={curveSource}
        onToggleTheme={() => void dispatch(themeToggled())}
        onPointMove={(seriesIndex, pointIndex, point) =>
          dispatch(curvePointMoved({ seriesIndex, pointIndex, point }))
        }
        onRevert={() => dispatch(curvesReverted())}
        onApply={() => void dispatch(curvesApplied(series))}
        onDragStart={() => appWindow.startDragging().catch(console.error)}
        onMinimize={() => appWindow.minimize().catch(console.error)}
        onClose={() => appWindow.close().catch(console.error)}
      />
      <AppToaster />
    </FluentProvider>
  );
}

export default App;
