/**
 * Combat Analytics Service Context
 * Provides ICombatAnalyticsService to the component tree
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CombatAnalyticsService } from '../infrastructure/services';
import { ICombatAnalyticsService } from '../domain/services';

const CombatAnalyticsServiceContext = createContext<ICombatAnalyticsService | null>(null);

export const CombatAnalyticsServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState<ICombatAnalyticsService>(() => new CombatAnalyticsService());

    useEffect(() => {
        service.init().catch(console.error);
    }, [service]);

    return (
        <CombatAnalyticsServiceContext.Provider value={service}>
            {children}
        </CombatAnalyticsServiceContext.Provider>
    );
};

export const useCombatAnalyticsService = (): ICombatAnalyticsService => {
    const service = useContext(CombatAnalyticsServiceContext);
    if (!service) {
        throw new Error('useCombatAnalyticsService must be used within CombatAnalyticsServiceProvider');
    }
    return service;
};
