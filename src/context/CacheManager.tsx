/**
 * Cache Manager Context
 * Tracks and manages cache data progress across all data types
 * Listens to Tauri fetch-progress events for real-time updates
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { CacheType } from '../domain/models/CacheType';


export interface FetchProgressEvent {
    type: CacheType;
    progress: number; // 0-100
    isFetching: boolean;
    message?: string;
    error?: string | null;
}

export interface CacheManagerState {
    progress: Record<CacheType, number>;
    refetch: (type: CacheType) => Promise<void>;
    purgeAllCache: () => Promise<void>;
}

const CacheManagerContext = createContext<CacheManagerState | null>(null);

export const CacheManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [progress, setProgress] = useState<Record<CacheType, number>>({
        [CacheType.Hero]: 0,
        [CacheType.Build]: 0,
        [CacheType.Artifact]: 0,
        [CacheType.CombatAnalytics]: 0,
        [CacheType.Metagame]: 0,
    });

    useEffect(() => {
        let unlistenFn: UnlistenFn | null = null;

        const setupListener = async () => {
            try {
                unlistenFn = await listen<FetchProgressEvent>('fetch-progress', (event) => {
                    const { type, progress: progressValue } = event.payload;
                    setProgress((prev) => ({
                        ...prev,
                        [type]: progressValue,
                    }));
                });
            } catch (error) {
                console.error('[CacheManager] Failed to listen to fetch-progress event:', error);
            }
        };

        setupListener();

        return () => {
            if (unlistenFn) {
                unlistenFn();
            }
        };
    }, []);

    const refetch = async (type: CacheType): Promise<void> => {
        try {
            // Map cache type to backend command
            const commandMap: Record<CacheType, string> = {
                [CacheType.Hero]: 'refetch_hero_data',
                [CacheType.Build]: 'refetch_build_data',
                [CacheType.Artifact]: 'refetch_artifact_data',
                [CacheType.CombatAnalytics]: 'refetch_combat_data',
                [CacheType.Metagame]: 'refetch_metagame_data',
            };

            const command = commandMap[type];
            if (!command) {
                throw new Error(`Unknown cache type: ${type}`);
            }

            // Reset progress to 0 before refetching
            setProgress((prev) => ({
                ...prev,
                [type]: 0,
            }));

            await invoke(command);
        } catch (error) {
            console.error(`[CacheManager] Failed to refetch ${type}:`, error);
            throw error;
        }
    };

    const purgeAllCache = async (): Promise<void> => {
        try {
            // Reset all progress to 0
            setProgress({
                [CacheType.Hero]: 0,
                [CacheType.Build]: 0,
                [CacheType.Artifact]: 0,
                [CacheType.CombatAnalytics]: 0,
                [CacheType.Metagame]: 0,
            });

            // Call backend to clear all cache (cache_clear is the correct command)
            await invoke('cache_clear');
            console.log('[CacheManager] All cache cleared successfully');
        } catch (error) {
            console.error('[CacheManager] Failed to clear all cache:', error);
            throw error;
        }
    };

    const value: CacheManagerState = {
        progress,
        refetch,
        purgeAllCache,
    };

    return (
        <CacheManagerContext.Provider value={value}>
            {children}
        </CacheManagerContext.Provider>
    );
};

export const useCacheManager = (): CacheManagerState => {
    const context = useContext(CacheManagerContext);
    if (!context) {
        throw new Error('useCacheManager must be used within CacheManagerProvider');
    }
    return context;
};
