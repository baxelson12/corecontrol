import { useState } from "react";
import type { ReactElement } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppLayout } from "./layout/AppLayout";
import { MOCK_SERIES, MOCK_STATS, movePoint } from "./mock";

const appWindow = getCurrentWindow();

/**
 * Root view: the app layout running on mock data so the design can be
 * previewed. Real device state and IPC replace this container later.
 *
 * @returns The themed app.
 */
function App(): ReactElement {
  const [isDark, setIsDark] = useState(true);
  const [series, setSeries] = useState(MOCK_SERIES);
  const [applied, setApplied] = useState(MOCK_SERIES);
  const dirty = JSON.stringify(series) !== JSON.stringify(applied);

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <AppLayout
        title="AIO Cooler Control"
        deviceLabel="Liquid cooler"
        deviceName="MEG Core Liquid S280"
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
