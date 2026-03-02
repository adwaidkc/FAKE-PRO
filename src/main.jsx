import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./auth.css";

// Wake up backend on load (prevents Render free tier cold start)
fetch(`${import.meta.env.VITE_API_BASE_URL}/health`).catch(() => {});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
