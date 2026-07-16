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
import { MOCK_STATS } from "./mock";

const appWindow = getCurrentWindow();

/**
 * Root view: kicks off cooler detection on startup and binds the store to
 * the presentational layout. Stats still run on mock data; live device
 * state replaces them later.
 *
 * @returns The themed app.
 */
function App(): ReactElement {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.name);
  const detection = useAppSelector((state) => state.detection);
  const series = useAppSelector((state) => state.curves.edited);
  const dirty = useAppSelector(selectCurvesDirty);

  useEffect(() => {
    void dispatch(coolerScanStarted());
  }, [dispatch]);

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
        stats={MOCK_STATS}
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
