import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

import { OverlayView } from "./components/overlay/OverlayView";
import { ControlsView, WindowInfo } from "./components/ControlsView";

// New DI-based services

export function App() {

    // ============================================================================
    // WINDOW LABEL DETECTION: Determine which window this is
    // ============================================================================
    const [windowLabel, setWindowLabel] = useState<string>(() => {
        // Check URL query param first (for Tauri windows)
        const queryParams = new URLSearchParams(window.location.search);
        const forceLabel = queryParams.get("label");
        if (forceLabel) return forceLabel;

        // Fall back to Tauri window label
        try {
            return getCurrentWindow().label;
        } catch (e) {
            return "unknown";
        }
    });

    // Log which window type this is
    useEffect(() => {
        invoke("log_frontend_info", { msg: `[App] Window initialized as: ${windowLabel}` }).catch(() => { });
    }, []);

    // UI State
    const [windows, setWindows] = useState<WindowInfo[]>([]);
    const [selectedHwnd, setSelectedHwnd] = useState<number | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [cacheWipedMsg, setCacheWipedMsg] = useState(false);

    // ============================================================================
    // RENDER
    // ============================================================================
    return (
        <>
            {/* Control Window: Render ControlsView only */}
            {windowLabel === "controls" && (
                <ControlsView
                    windows={windows}
                    selectedHwnd={selectedHwnd}
                    setSelectedHwnd={setSelectedHwnd}
                    isTracking={isTracking}
                    cacheWipedMsg={cacheWipedMsg}
                    refreshWindows={async () => { }}
                    startTracking={async () => { }}
                    handleWipeCache={async () => { }}
                />
            )}

            {/* Overlay Window: Render OverlayView only */}
            {windowLabel === "main" && (
                <OverlayView
                    onTrackingChange={(isTracking, hwnd) => {
                        setIsTracking(isTracking);
                        setSelectedHwnd(hwnd);
                    }}
                />
            )}
        </>
    );
}