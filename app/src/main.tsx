import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import App from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("root container element is missing");

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <FluentProvider theme={webDarkTheme} style={{ minHeight: "100vh" }}>
      <App />
    </FluentProvider>
  </React.StrictMode>,
);
