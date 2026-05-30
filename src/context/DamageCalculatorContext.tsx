/**
 * Damage Calculator Service Context
 * Provides IDamageCalculatorService to the component tree
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { DamageCalculatorService } from '../infrastructure/services/DamageCalculatorService';
import { IDamageCalculatorService } from '../domain/services/IDamageCalculatorService';
import { useBuildProfileService } from './BuildProfileServiceContext';

const DamageCalculatorContext = createContext<IDamageCalculatorService | null>(null);

export const DamageCalculatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const buildProfileService = useBuildProfileService();
    const [service] = useState<IDamageCalculatorService>(() => new DamageCalculatorService(buildProfileService as any));

    return (
        <DamageCalculatorContext.Provider value={service}>
            {children}
        </DamageCalculatorContext.Provider>
    );
};

export const useDamageCalculatorService = (): IDamageCalculatorService => {
    const service = useContext(DamageCalculatorContext);
    if (!service) {
        throw new Error('useDamageCalculatorService must be used within DamageCalculatorProvider');
    }
    return service;
};
