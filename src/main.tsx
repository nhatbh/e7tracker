import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n/index";
import { BuildAssist } from "./services/buildAssist";

const initAndRender = async () => {
  try {
    // Pre-initialize native disk cache before mounting React tree to avoid race conditions with OCR frames
    await BuildAssist.init();
  } catch (e) {
    console.error("Failed to pre-initialize BuildAssist cache:", e);
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

initAndRender();
