/**
 * Hero Metadata Service Context
 * Provides IHeroMetadataService to the component tree
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { StaticHeroService } from '../infrastructure/services';
import { IHeroMetadataService } from '../domain/services';

const HeroServiceContext = createContext<IHeroMetadataService | null>(null);

export const HeroServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState<IHeroMetadataService>(() => new StaticHeroService());

    useEffect(() => {
        service.init().catch(console.error);
    }, [service]);

    return (
        <HeroServiceContext.Provider value={service}>
            {children}
        </HeroServiceContext.Provider>
    );
};

export const useHeroService = (): IHeroMetadataService => {
    const service = useContext(HeroServiceContext);
    if (!service) {
        throw new Error('useHeroService must be used within HeroServiceProvider');
    }
    return service;
};
