/**
 * Artifact Metadata Service Context
 * Provides IArtifactMetadataService to the component tree
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { StaticArtifactService } from '../infrastructure/services';
import { IArtifactMetadataService } from '../domain/services';

const ArtifactServiceContext = createContext<IArtifactMetadataService | null>(null);

export const ArtifactServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState<IArtifactMetadataService>(() => new StaticArtifactService());

    useEffect(() => {
        service.init().catch(console.error);
    }, [service]);

    return (
        <ArtifactServiceContext.Provider value={service}>
            {children}
        </ArtifactServiceContext.Provider>
    );
};

export const useArtifactService = (): IArtifactMetadataService => {
    const service = useContext(ArtifactServiceContext);
    if (!service) {
        throw new Error('useArtifactService must be used within ArtifactServiceProvider');
    }
    return service;
};
