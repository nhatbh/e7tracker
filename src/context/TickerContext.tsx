/**
 * Ticker Service Context
 * Provides centralized task scheduling to the component tree
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { ITickerService } from '../domain/services/ITickerService';
import { TickerService } from '../infrastructure/services/TickerService';
import { useScreenDetection } from './ScreenDetectionContext';

const TickerContext = createContext<ITickerService | null>(null);

export const TickerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const screenDetection = useScreenDetection();

    const [service] = useState<ITickerService>(() => 
        new TickerService(screenDetection)
    );

    useEffect(() => {
        invoke("log_frontend_info", { msg: '[TickerProvider] Starting ticker service' }).catch(() => {});
        service.start(1000);

        return () => {
            invoke("log_frontend_info", { msg: '[TickerProvider] Stopping ticker service' }).catch(() => {});
            service.stop();
        };
    }, [service]);

    return (
        <TickerContext.Provider value={service}>
            {children}
        </TickerContext.Provider>
    );
};

export const useTickerService = (): ITickerService => {
    const service = useContext(TickerContext);
    if (!service) {
        throw new Error('useTickerService must be used within TickerProvider');
    }
    return service;
};
