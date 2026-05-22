import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n/index";
import { BuildAssist } from "./services/buildAssist";
import { OverlayServiceProvider } from "./context";
import { App } from "./App";
import { getCurrentWindow } from "@tauri-apps/api/window";

const initAndRender = async () => {
    try {
        // Pre-initialize native disk cache before mounting React tree to avoid race conditions with OCR frames
        await BuildAssist.init();
    } catch (e) {
        console.error("Failed to pre-initialize BuildAssist cache:", e);
    }

    // Get window label from URL params (e.g., ?label=main or ?label=controls)
    const urlParams = new URLSearchParams(window.location.search);
    const windowLabel = urlParams.get("label") || "main";
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
};

initAndRender();
