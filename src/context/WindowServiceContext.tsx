import React, { createContext, useContext } from 'react';
import { IWindowService } from '../domain/services/IWindowService';
import { WindowService } from '../infrastructure/services/WindowService';

const WindowServiceContext = createContext<IWindowService | null>(null);

export const WindowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <WindowServiceContext.Provider value={WindowService}>
            {children}
        </WindowServiceContext.Provider>
    );
};

export const useWindowService = (): IWindowService => {
    const service = useContext(WindowServiceContext);
    if (!service) {
        throw new Error('useWindowService must be used within WindowProvider');
    }
    return service;
};
