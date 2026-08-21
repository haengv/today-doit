import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Global error catcher - renders errors on screen for AIT debugging
window.onerror = function(msg, source, lineno, colno, error) {
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<div style="padding:20px;font-size:14px;color:red;word-break:break-all;">
      <h2>⚠️ JS Error</h2>
      <p><b>Message:</b> ${msg}</p>
      <p><b>Source:</b> ${source}</p>
      <p><b>Line:</b> ${lineno}:${colno}</p>
      <p><b>Stack:</b> ${error?.stack || 'N/A'}</p>
    </div>`;
  }
};

window.addEventListener("unhandledrejection", (event) => {
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<div style="padding:20px;font-size:14px;color:red;word-break:break-all;">
      <h2>⚠️ Unhandled Promise</h2>
      <p>${event.reason?.message || event.reason || 'Unknown'}</p>
      <p>${event.reason?.stack || ''}</p>
    </div>`;
  }
});

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e: any) {
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<div style="padding:20px;font-size:14px;color:red;word-break:break-all;">
      <h2>⚠️ Render Error</h2>
      <p>${e?.message || e}</p>
      <p>${e?.stack || ''}</p>
    </div>`;
  }
}
