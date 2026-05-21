/**
 * Build Profile Service Context
 * Provides IBuildProfileService to the component tree
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserBuildProfileService } from '../infrastructure/services';
import { IBuildProfileService } from '../domain/services';

const BuildProfileServiceContext = createContext<IBuildProfileService | null>(null);

export const BuildProfileServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState<IBuildProfileService>(() => new UserBuildProfileService());

    useEffect(() => {
        service.init().catch(console.error);
    }, [service]);

    return (
        <BuildProfileServiceContext.Provider value={service}>
            {children}
        </BuildProfileServiceContext.Provider>
    );
};

export const useBuildProfileService = (): IBuildProfileService => {
    const service = useContext(BuildProfileServiceContext);
    if (!service) {
        throw new Error('useBuildProfileService must be used within BuildProfileServiceProvider');
    }
    return service;
};
