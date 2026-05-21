/**
 * Keybind Service Context
 * Provides IKeybindService to the component tree
 */

import React, { createContext, useContext, useState } from 'react';
import { IKeybindService } from '../domain/services/IKeybindService';
import { KeybindService } from '../infrastructure/services/KeybindService';
import { useScreenDetection } from './ScreenDetectionContext';
import { Keybind } from '../domain/models/KeybindSchema';

const KeybindServiceContext = createContext<IKeybindService | null>(null);

export const KeybindServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const screenDetection = useScreenDetection();
    const [service] = useState<IKeybindService>(() => new KeybindService(screenDetection as any));

    return (
        <KeybindServiceContext.Provider value={service}>
            {children}
        </KeybindServiceContext.Provider>
    );
};

export const useKeybind = (keybind: Keybind, callback: (screen: string | null) => void) => {
    const service = useContext(KeybindServiceContext);
    if (!service) {
        throw new Error('useKeybind must be used within KeybindServiceProvider');
    }
    
    React.useEffect(() => {
        const unsubscribe = service.onKeybind(keybind, callback);
        return unsubscribe;
    }, [service, keybind, callback]);
};
