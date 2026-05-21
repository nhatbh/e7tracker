/**
 * Metagame Service Context
 * Provides IMetagameService to the component tree
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { IMetagameService } from '../domain/services';
import { MetagameService } from '../infrastructure/services';

const MetagameServiceContext = createContext<IMetagameService | null>(null);

export const MetagameServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState<IMetagameService>(() => new MetagameService());

    useEffect(() => {
        service.init().catch(console.error);
    }, [service]);

    return (
        <MetagameServiceContext.Provider value={service}>
            {children}
        </MetagameServiceContext.Provider>
    );
};

export const useMetagameService = (): IMetagameService => {
    const service = useContext(MetagameServiceContext);
    if (!service) {
        throw new Error('useMetagameService must be used within MetagameServiceProvider');
    }
    return service;
};
