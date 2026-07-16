import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppLayout } from "./layout/AppLayout";
import { detectCooler, deviceName } from "./utils/detection";
import type { Detection } from "./utils/detection";
import { MOCK_SERIES, MOCK_STATS, movePoint } from "./mock";

const appWindow = getCurrentWindow();

/**
 * Root view: detects the attached cooler on startup and drives the header
 * from the result. Curves and stats still run on mock data; live device
 * state replaces them later.
 *
 * @returns The themed app.
 */
function App(): ReactElement {
  const [isDark, setIsDark] = useState(true);
  const [detection, setDetection] = useState<Detection>({ state: "detecting" });
  const [series, setSeries] = useState(MOCK_SERIES);
  const [applied, setApplied] = useState(MOCK_SERIES);
  const dirty = JSON.stringify(series) !== JSON.stringify(applied);

  useEffect(() => {
    let stale = false;
    void detectCooler().then((result) => {
      if (!stale) {
        setDetection(result);
      }
    });
    return () => {
      stale = true;
    };
  }, []);

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <AppLayout
        title="AIO Cooler Control"
        deviceLabel="Liquid cooler"
        deviceName={deviceName(detection)}
        isDark={isDark}
        stats={MOCK_STATS}
        series={series}
        dirty={dirty}
        onToggleTheme={() => setIsDark((d) => !d)}
        onPointMove={(si, pi, pt) => setSeries((s) => movePoint(s, si, pi, pt))}
        onRevert={() => setSeries(applied)}
        onApply={() => setApplied(series)}
        onDragStart={() => appWindow.startDragging().catch(console.error)}
        onMinimize={() => appWindow.minimize().catch(console.error)}
        onClose={() => appWindow.close().catch(console.error)}
      />
    </FluentProvider>
  );
}

export default App;
