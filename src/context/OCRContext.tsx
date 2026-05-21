/**
 * OCR Service Context
 * Provides OCR scanning functionality to the component tree
 */

import React, { createContext, useContext, useState } from 'react';
import { IOCRService } from '../domain/services/IOCRService';
import { OCRService } from '../infrastructure/services/OCRService';
import { useScreenDetection } from './ScreenDetectionContext';
import { useHeroService } from './HeroServiceContext';

const OCRContext = createContext<IOCRService | null>(null);

export const OCRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const screenDetection = useScreenDetection();
    const heroService = useHeroService();

    const [service] = useState<IOCRService>(() => 
        new OCRService(screenDetection, heroService)
    );

    return (
        <OCRContext.Provider value={service}>
            {children}
        </OCRContext.Provider>
    );
};

export const useOCRService = (): IOCRService => {
    const service = useContext(OCRContext);
    if (!service) {
        throw new Error('useOCRService must be used within OCRProvider');
    }
    return service;
};
