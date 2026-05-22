/**
 * Hook to manage cursor event pass-through for the overlay window
 * Allows toggling between interactive and non-interactive overlay states
 */

import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const useCursorEvents = (shouldIgnore: boolean) => {
    const windowRef = useRef<any>(null);

    useEffect(() => {
        const manageCursorEvents = async () => {
            try {
                if (!windowRef.current) {
                    windowRef.current = getCurrentWindow();
                }
                
                const window = windowRef.current;
                if (window && window.label === 'main') {
                    await window.setIgnoreCursorEvents(shouldIgnore);
                }
            } catch (error) {
                // Silently fail if not in Tauri context
            }
        };

        manageCursorEvents();
    }, [shouldIgnore]);
};
