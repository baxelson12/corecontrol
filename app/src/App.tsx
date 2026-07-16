import { useEffect } from "react";
import type { ReactElement } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { match } from "ts-pattern";
import { AppLayout } from "./layout/AppLayout";
import { deviceName } from "./utils/detection";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { themeToggled } from "./store/themeSlice";
import { coolerScanStarted } from "./store/detectionSlice";
import { curvePointMoved, curvesApplied, curvesReverted, selectCurvesDirty } from "./store/curvesSlice";
import { fanStatusPolled, selectFanStats } from "./store/statusSlice";

const appWindow = getCurrentWindow();

/** How often the live fan status is polled, in milliseconds. */
const STATUS_POLL_MS = 1000;

/**
 * Root view: kicks off cooler detection on startup, polls the cooler for
 * live status once detected, and binds the store to the presentational
 * layout.
 *
 * @returns The themed app.
 */
function App(): ReactElement {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.name);
  const detection = useAppSelector((state) => state.detection);
  const series = useAppSelector((state) => state.curves.edited);
  const dirty = useAppSelector(selectCurvesDirty);
  const stats = useAppSelector(selectFanStats);
  const coolerFound = detection.state === "found";

  useEffect(() => {
    void dispatch(coolerScanStarted());
  }, [dispatch]);

  useEffect(() => {
    if (!coolerFound) {
      return undefined;
    }
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
        title="AIO Cooler Control"
        deviceLabel="Liquid cooler"
        deviceName={deviceName(detection)}
        theme={theme}
        stats={stats}
        series={series}
        dirty={dirty}
        onToggleTheme={() => dispatch(themeToggled())}
        onPointMove={(seriesIndex, pointIndex, point) =>
          dispatch(curvePointMoved({ seriesIndex, pointIndex, point }))
        }
        onRevert={() => dispatch(curvesReverted())}
        onApply={() => dispatch(curvesApplied())}
        onDragStart={() => appWindow.startDragging().catch(console.error)}
        onMinimize={() => appWindow.minimize().catch(console.error)}
        onClose={() => appWindow.close().catch(console.error)}
      />
    </FluentProvider>
  );
}

export default App;
