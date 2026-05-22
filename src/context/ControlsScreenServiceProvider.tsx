/**
 * Controls Screen Service Provider
 * Wraps the controls screen with necessary service providers
 */

import React from 'react';
import { WindowProvider } from './WindowServiceContext';
import { ClientProfileProvider } from './ClientProfileContext';

export interface ControlsScreenServiceProviderProps {
    children: React.ReactNode;
}

/**
 * ControlsScreenServiceProvider wraps the controls screen with service contexts
 * Usage: Wrap your ControlsView component with <ControlsScreenServiceProvider>
 */
export const ControlsScreenServiceProvider: React.FC<ControlsScreenServiceProviderProps> = ({ children }) => {
    return (
        <WindowProvider>
            <ClientProfileProvider>
                {children}
            </ClientProfileProvider>
        </WindowProvider>
    );
};
