import React, { createContext, useContext, useEffect, useState } from 'react';
import { ITierListService } from '../domain/services/ITierListService';
import { TierListService } from '../infrastructure/services/TierListService';
import { useCombatAnalyticsService } from './CombatAnalyticsServiceContext';
import { useMetagameService } from './MetagameServiceContext';

const TierListServiceContext = createContext<ITierListService | null>(null);

export const TierListServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const combatService = useCombatAnalyticsService();
    const metagameService = useMetagameService();
    const [service] = useState<ITierListService>(() => new TierListService(combatService, metagameService));

    useEffect(() => {
        // Trigger initial recalculation if data is available
        service.recalculateTierList().catch(console.error);
    }, [service]);

    return (
        <TierListServiceContext.Provider value={service}>
            {children}
        </TierListServiceContext.Provider>
    );
};

export const useTierListService = (): ITierListService => {
    const service = useContext(TierListServiceContext);
    if (!service) {
        throw new Error('useTierListService must be used within TierListServiceProvider');
    }
    return service;
};
