import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

import { OverlayView } from "./components/overlay/OverlayView";
import { ControlsView } from "./components/ControlsView";
import { OverlayServiceProvider, ControlsScreenServiceProvider, CacheManagerProvider } from "./context";
import { CombatData, MetagameData } from "./services/combatData";
import { OverlayManagerService } from "./overlay/services/OverlayManagerService";
import { Keybind } from "./domain/models/KeybindSchema";
import { InteractivePageType } from "./domain/models/InteractiveOverlay";


export function App() {
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

    // Default behavior: main window ignores cursor events (passes through to game)
    const manageCursorEvents = async () => {
        try {
            if (windowLabel === "main") {
                await getCurrentWindow().setIgnoreCursorEvents(true);
            }
        } catch (error) {
            // Silently fail if not in Tauri context
        }
    };
    manageCursorEvents();

    // Initialize Combat and Metagame data services when overlay launches
    useEffect(() => {
        if (windowLabel === "main") {
            CombatData.init();
            MetagameData.init();

            // Register keybind listeners with overlay manager
            const overlayManager = OverlayManagerService.getInstance();
        }
    }, [windowLabel]);

    return (
        <>
            {/* Control Window: Render ControlsView only */}
            {windowLabel === "controls" && (
                <CacheManagerProvider>
                    <ControlsScreenServiceProvider>
                        <ControlsView />
                    </ControlsScreenServiceProvider>
                </CacheManagerProvider>
            )}

            {/* Overlay Window: Render OverlayView only */}
            {windowLabel === "main" && (
                <OverlayServiceProvider windowLabel={windowLabel}>
                    <OverlayView />
                </OverlayServiceProvider>
            )}
        </>
    );
}