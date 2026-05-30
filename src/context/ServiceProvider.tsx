/**
 * Root Service Provider
 * Wraps all service contexts for the entire application
 */

import React from 'react';
import { WindowProvider } from './WindowServiceContext';
import { HeroServiceProvider } from './HeroServiceContext';
import { ArtifactServiceProvider } from './ArtifactServiceContext';
import { BuildProfileServiceProvider } from './BuildProfileServiceContext';
import { CombatAnalyticsServiceProvider } from './CombatAnalyticsServiceContext';
import { MetagameServiceProvider } from './MetagameServiceContext';
import { ScreenDetectionProvider } from './ScreenDetectionContext';
import { OCRProvider } from './OCRContext';
import { TickerProvider } from './TickerContext';
import { KeybindServiceProvider } from './KeybindContext';
import { ClientProfileProvider } from './ClientProfileContext';
import { DamageCalculatorProvider } from './DamageCalculatorContext';
import { OverlayManagerProvider } from './OverlayManagerContext';
import { TierListServiceProvider } from './TierListServiceContext';

export interface ServiceProviderProps {
    children: React.ReactNode;
    windowLabel?: string;
}

/**
 * ServiceProvider wraps the entire application with all service contexts
 * Usage: Wrap your root App component with <ServiceProvider>
 */
export const OverlayServiceProvider: React.FC<ServiceProviderProps> = ({ children, windowLabel }) => {
    return (
        <WindowProvider>
            <ClientProfileProvider>
                <HeroServiceProvider>
                    <ArtifactServiceProvider>
                        <BuildProfileServiceProvider>
                            <CombatAnalyticsServiceProvider>
                                <MetagameServiceProvider>
                                    <ScreenDetectionProvider windowLabel={windowLabel}>
                                        <TickerProvider>
                                            <OCRProvider>
                                                <KeybindServiceProvider>
                                                    <OverlayManagerProvider>
                                                        <TierListServiceProvider>
                                                            <DamageCalculatorProvider>
                                                                {children}
                                                            </DamageCalculatorProvider>
                                                        </TierListServiceProvider>
                                                    </OverlayManagerProvider>
                                                </KeybindServiceProvider>
                                            </OCRProvider>
                                        </TickerProvider>
                                    </ScreenDetectionProvider>
                                </MetagameServiceProvider>
                            </CombatAnalyticsServiceProvider>
                        </BuildProfileServiceProvider>
                    </ArtifactServiceProvider>
                </HeroServiceProvider>
            </ClientProfileProvider>
        </WindowProvider>
    );
};
