import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface AppSettings {
    blurEnabledOverlay: boolean;
    opacityOverlay: number; // 0.0 to 1.0
    blurEnabledHeroDetails: boolean;
    opacityHeroDetails: number; // 0.0 to 1.0
    activeClient: string; // "ldplayer" | "bluestacks" | "mumu" | "pc_client" | "default"
}

export const DEFAULT_SETTINGS: AppSettings = {
    blurEnabledOverlay: true,
    opacityOverlay: 0.6,
    blurEnabledHeroDetails: true,
    opacityHeroDetails: 0.65,
    activeClient: 'default',
};

const SETTINGS_CACHE_KEY = 'app_user_settings';

export const SettingsService = {
    async getSettings(): Promise<AppSettings> {
        try {
            const cachedValue = await invoke<string | null>('cache_get', { key: SETTINGS_CACHE_KEY });
            if (cachedValue) {
                const parsed = JSON.parse(cachedValue);
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.error('[SettingsService] Failed to load settings from SQLite cache, using defaults:', e);
        }
        return DEFAULT_SETTINGS;
    },

    async saveSettings(settings: AppSettings): Promise<void> {
        try {
            await invoke('cache_set', { key: SETTINGS_CACHE_KEY, val: JSON.stringify(settings) });
            await invoke('broadcast_settings', { settings });
        } catch (e) {
            console.error('[SettingsService] Failed to save settings to SQLite cache:', e);
        }
    },

    onSettingsChanged(callback: (settings: AppSettings) => void): () => void {
        let active = true;
        let unlistenFn: (() => void) | null = null;

        listen<AppSettings>('settings-changed', (event) => {
            if (active) {
                callback(event.payload);
            }
        }).then((unlisten) => {
            unlistenFn = unlisten;
        }).catch((e) => {
            console.error('[SettingsService] Failed to listen to settings-changed event:', e);
        });

        return () => {
            active = false;
            if (unlistenFn) {
                unlistenFn();
            }
        };
    }
};
