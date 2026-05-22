import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ClientProfile, WindowInfo } from '../domain/models';
import { ClientProfileService } from '../infrastructure/services/ClientProfileService';
import { useWindowService } from './WindowServiceContext';

interface ClientProfileContextValue {
  profiles: ClientProfile[];
  activeProfile: ClientProfile;
  isAutoDetected: boolean;
  changeProfile: (profileId: string) => void;
  detectClient: (windows: WindowInfo[]) => void;
  calculateTotalOffsets: (windowWidth: number, windowHeight: number) => { x: number; y: number };
}

const ClientProfileContext = createContext<ClientProfileContextValue | null>(null);

export const useClientProfile = (): ClientProfileContextValue => {
  const context = useContext(ClientProfileContext);
  if (!context) {
    throw new Error('useClientProfile must be used within a ClientProfileProvider');
  }
  return context;
};

interface ClientProfileProviderProps {
  children: React.ReactNode;
}

export const ClientProfileProvider: React.FC<ClientProfileProviderProps> = ({ children }) => {
  const windowService = useWindowService();
  const [activeProfile, setActiveProfile] = useState<ClientProfile>(
    ClientProfileService.getActiveProfile()
  );
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(
    ClientProfileService.getIsAutoDetected()
  );

  const profiles = ClientProfileService.getProfiles();

  const changeProfile = useCallback((profileId: string) => {
    ClientProfileService.setActiveProfile(profileId);
    setActiveProfile(ClientProfileService.getActiveProfile());
    setIsAutoDetected(false);
  }, []);

  const detectClient = useCallback((windows: WindowInfo[]) => {
    const detected = ClientProfileService.detectClient(windows);
    if (detected) {
      setActiveProfile(detected);
      setIsAutoDetected(true);
    }
  }, []);

  const calculateTotalOffsets = useCallback((windowWidth: number, windowHeight: number): { x: number; y: number } => {
    return ClientProfileService.calculateTotalOffsets(windowWidth, windowHeight);
  }, []);

  // Auto-detect on mount
  useEffect(() => {
    const fetchWindows = async () => {
      try {
        const windows = await windowService.getWindows();
        detectClient(windows);
      } catch (error) {
        console.error('[ClientProfile] Failed to detect client:', error);
      }
    };

    fetchWindows();
  }, [detectClient, windowService]);

  // Sync profile with backend when activeProfile changes
  useEffect(() => {
    const syncWithBackend = async () => {
      try {
        await windowService.setActiveClientProfile(activeProfile);
      } catch (error) {
        console.error('[ClientProfile] Failed to sync profile with backend:', error);
      }
    };
    syncWithBackend();
  }, [activeProfile, windowService]);

  const value: ClientProfileContextValue = {
    profiles,
    activeProfile,
    isAutoDetected,
    changeProfile,
    detectClient,
    calculateTotalOffsets,
  };

  return (
    <ClientProfileContext.Provider value={value}>
      {children}
    </ClientProfileContext.Provider>
  );
};
