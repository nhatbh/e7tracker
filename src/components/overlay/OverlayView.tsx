import React, { useEffect, useState } from 'react';
import { useScreenDetection } from '../../context';
import { ScreenType } from '../../domain/models/DetectionSchema';
import { HeroStatsOverlays } from './hero-stats/HeroStatsOverlays';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
    const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.Unknown);

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
                const unlistenAutoTrack = await listen<WindowInfo>("auto-tracked-window", (event) => {
                    onTrackingChange?.(true, event.payload.hwnd);
                });

                const unlistenLostTrack = await listen("tracked-window-lost", () => {
                    onTrackingChange?.(false, null);
                });

                return () => {
                    unlistenAutoTrack();
                    unlistenLostTrack();
                };
            } catch (error) {
                invoke("log_frontend_info", { msg: `[OverlayView] Failed to setup window tracking: ${error}` }).catch(() => { });
            }
        };

        const cleanup = setupWindowTracking();
        return () => {
            cleanup.then(fn => fn?.());
        };
    }, [onTrackingChange]);

    useEffect(() => {
        const manageCursorEvents = async () => {
            try {
                const shouldIgnoreCursor = true;
                await getCurrentWindow().setIgnoreCursorEvents(shouldIgnoreCursor);
            } catch (error) {
                // Silently fail if not in Tauri context
            }
        };
        manageCursorEvents();
    }, []);

    return (
        <main className="overlay-view overlay-view-wrapper">
            {currentScreen === ScreenType.HeroStats ? (
                <HeroStatsOverlays />
            ) : (
                <div className="overlay-watermark">
                    <img src="/app-icon.png" alt="e7Tracker" className="watermark-icon" />
                    <span className="watermark-text">e7Tracker</span>
                </div>
            )}
        </main>
    );
};
