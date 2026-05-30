import React, { useEffect, useState } from 'react';
import { useScreenDetection } from '../../context';
import { ScreenType } from '../../domain/models/DetectionSchema';
import { HeroStatsOverlays } from './hero-stats/HeroStatsOverlays';
import { invoke } from '@tauri-apps/api/core';
import { useWindowService } from '../../context/WindowServiceContext';
import { InteractiveOverlay } from './interactive/InteractiveOverlay';
import { overlayManager } from '../../overlay/services/OverlayManagerService';
import { InteractivePageType } from '../../domain/models/InteractiveOverlay';
import { DashboardView } from './dashboard/DashboardView';
import { HeroDetailsView } from '../HeroDetailsView';
import { useKeybind } from '../../context/KeybindContext';
import { Keybind } from '../../domain/models/KeybindSchema';
import { useOverlayManager } from '../../context/OverlayManagerContext';
import './OverlayView.css';

interface WindowInfo {
    hwnd: number;
    title: string;
}

interface OverlayViewProps {
    onTrackingChange?: (isTracking: boolean, hwnd: number | null) => void;
}

export const OverlayView: React.FC<OverlayViewProps> = ({ onTrackingChange }) => {
    const screenDetection = useScreenDetection();
    const windowService = useWindowService();
    const overlayManager = useOverlayManager();
    const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.Unknown);
    const [currentHeroName, setCurrentHeroName] = useState<string | null>(null);
    const [showDashboardTooltip, setShowDashboardTooltip] = useState(true);

    useEffect(() => {
        // Register Overlays
        overlayManager.registerOverlay({
            id: InteractivePageType.Dashboard,
            keybind: { alt: true, key: 'd' },
            component: DashboardView
        });
        overlayManager.registerOverlay({
            id: InteractivePageType.HeroDetails,
            keybind: { alt: true, key: 'r' },
            component: HeroDetailsView
        });

        return () => {
            overlayManager.unregisterOverlay(InteractivePageType.Dashboard);
            overlayManager.unregisterOverlay(InteractivePageType.HeroDetails);
        };
    }, []);

    useKeybind(Keybind.AltD, () => {
        overlayManager.toggleOverlay(InteractivePageType.Dashboard);
        setShowDashboardTooltip(false);
    });

    // Listen for Alt+R keybind (handled locally, state via service)
    useKeybind(Keybind.AltR, () => {
        overlayManager.toggleOverlay(InteractivePageType.HeroDetails, currentHeroName);
    });

    useEffect(() => {
        const unsubscribe = screenDetection.onScreenChanged((screen) => {
            setCurrentScreen(screen);
            invoke("log_frontend_info", { msg: `[OverlayView] Screen changed to: ${screen}` }).catch(() => { });
        });
        return unsubscribe;
    }, [screenDetection]);



    useEffect(() => {
        const setupWindowTracking = async () => {
            try {
                const unsubscribe = await windowService.onTrackedWindowChanged((isTracking, hwnd) => {
                    onTrackingChange?.(isTracking, hwnd);
                });
                return unsubscribe;
            } catch (error) {
                invoke("log_frontend_info", { msg: `[OverlayView] Failed to setup window tracking: ${error}` }).catch(() => { });
            }
        };

        const cleanup = setupWindowTracking();
        return () => {
            cleanup.then(fn => fn?.());
        };
    }, [onTrackingChange]);

    return (
        <main className="overlay-view overlay-view-wrapper">
            <InteractiveOverlay 
                onClose={() => overlayManager.closeOverlay()} 
            />
            {currentScreen === ScreenType.HeroStats ? (
                <HeroStatsOverlays onHeroChange={setCurrentHeroName} />
            ) : (
                <div className="overlay-watermark-container">
                    {showDashboardTooltip && (
                        <div className="dashboard-keybind-tooltip">
                            <kbd>Alt + D</kbd>
                            <span>Dashboard</span>
                        </div>
                    )}
                    <div className="overlay-watermark">
                        <img src="/app-icon.png" alt="e7Tracker" className="watermark-icon" />
                        <span className="watermark-text">e7Tracker</span>
                    </div>
                </div>
            )}
        </main>
    );
};
