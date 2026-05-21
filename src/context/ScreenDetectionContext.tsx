/**
 * Screen Detection Service Context
 * Provides screen detection functionality to the component tree
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { IScreenDetectionService } from '../domain/services/IScreenDetectionService';
import { ScreenDetectionService } from '../infrastructure/services/ScreenDetectionService';
import { FrameResult } from '../domain/models/DetectionSchema';
import { invoke } from '@tauri-apps/api/core';

const ScreenDetectionContext = createContext<IScreenDetectionService | null>(null);

export const ScreenDetectionProvider: React.FC<{ children: React.ReactNode; windowLabel?: string }> = ({ children, windowLabel }) => {
    const [service] = useState<IScreenDetectionService>(() => new ScreenDetectionService());

    useEffect(() => {
        // Only initialize listener in the main (overlay) window
        if (windowLabel !== "main") return;

        // Listen to detection-result events from backend
        const setupListener = async () => {
            const unlisten = await listen<FrameResult>("detection-result", (event) => {
                service.updateFrameResult(event.payload);
            });
            return unlisten;
        };

        const promise = setupListener();

        return () => {
            promise.then(unlisten => unlisten());
        };
    }, [service, windowLabel]);

    return (
        <ScreenDetectionContext.Provider value={service}>
            {children}
        </ScreenDetectionContext.Provider>
    );
};

export const useScreenDetection = (): IScreenDetectionService => {
    const service = useContext(ScreenDetectionContext);
    if (!service) {
        throw new Error('useScreenDetection must be used within ScreenDetectionProvider');
    }
    return service;
};
