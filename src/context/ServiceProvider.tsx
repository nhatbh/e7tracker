/**
 * Root Service Provider
 * Wraps all service contexts for the entire application
 */

import React from 'react';
import { HeroServiceProvider } from './HeroServiceContext';
import { ArtifactServiceProvider } from './ArtifactServiceContext';
import { BuildProfileServiceProvider } from './BuildProfileServiceContext';
import { CombatAnalyticsServiceProvider } from './CombatAnalyticsServiceContext';
import { MetagameServiceProvider } from './MetagameServiceContext';
import { ScreenDetectionProvider } from './ScreenDetectionContext';
import { OCRProvider } from './OCRContext';
import { TickerProvider } from './TickerContext';
import { KeybindServiceProvider } from './KeybindContext';

export interface ServiceProviderProps {
  children: React.ReactNode;
  windowLabel?: string;
}

/**
 * ServiceProvider wraps the entire application with all service contexts
 * Usage: Wrap your root App component with <ServiceProvider>
 */
export const ServiceProvider: React.FC<ServiceProviderProps> = ({ children, windowLabel }) => {
  return (
    <HeroServiceProvider>
      <ArtifactServiceProvider>
        <BuildProfileServiceProvider>
          <CombatAnalyticsServiceProvider>
            <MetagameServiceProvider>
              <ScreenDetectionProvider windowLabel={windowLabel}>
                <TickerProvider>
                  <OCRProvider>
                    <KeybindServiceProvider>
                      {children}
                    </KeybindServiceProvider>
                  </OCRProvider>
                </TickerProvider>
              </ScreenDetectionProvider>
            </MetagameServiceProvider>
          </CombatAnalyticsServiceProvider>
        </BuildProfileServiceProvider>
      </ArtifactServiceProvider>
    </HeroServiceProvider>
  );
};
