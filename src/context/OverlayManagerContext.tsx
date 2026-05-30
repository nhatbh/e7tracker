/**
 * Overlay Manager Context
 * Provides OverlayManagerService to the component tree
 */

import React, { createContext, useContext, useState } from 'react';
import { OverlayManagerService } from '../overlay/services/OverlayManagerService';

const OverlayManagerContext = createContext<OverlayManagerService | null>(null);

export const OverlayManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState<OverlayManagerService>(() => OverlayManagerService.getInstance());

    return (
        <OverlayManagerContext.Provider value={service}>
            {children}
        </OverlayManagerContext.Provider>
    );
};

export const useOverlayManager = (): OverlayManagerService => {
    const service = useContext(OverlayManagerContext);
    if (!service) {
        throw new Error('useOverlayManager must be used within OverlayManagerProvider');
    }
    return service;
};
