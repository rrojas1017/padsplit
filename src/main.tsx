import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// App entry point with error handling
try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  createRoot(rootElement).render(<App />);
} catch (error) {
  console.error('App failed to mount:', error);
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; background: #1a1a2e; color: white; min-height: 100vh;">
        <h1 style="color: #ff6b6b;">Application Error</h1>
        <pre style="color: #feca57; white-space: pre-wrap;">${error}</pre>
      </div>
    `;
  }
}
