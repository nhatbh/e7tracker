import React, { useEffect, useState } from 'react';
import { useScreenDetection } from '../../context';
import { ScreenType } from '../../domain/models/DetectionSchema';
import { HeroStatsOverlays } from './hero-stats/HeroStatsOverlays';
import { invoke } from '@tauri-apps/api/core';
import { useWindowService } from '../../context/WindowServiceContext';
import { listen } from '@tauri-apps/api/event';
import { InteractiveOverlay } from './interactive/InteractiveOverlay';
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
    const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.Unknown);
    const [isInteractive, setIsInteractive] = useState(false);

    useEffect(() => {
        const unsubscribe = screenDetection.onScreenChanged((screen) => {
            setCurrentScreen(screen);
            invoke("log_frontend_info", { msg: `[OverlayView] Screen changed to: ${screen}` }).catch(() => { });
        });
        return unsubscribe;
    }, [screenDetection]);

    // Handle Alt+R shortcut event
    useEffect(() => {
        const unlisten = listen('toggle-hero-details', () => {
            setIsInteractive(prev => !prev);
        });
        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

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
                isActive={isInteractive} 
                onClose={() => setIsInteractive(false)} 
            />
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
