import { ClientProfile } from '../models/ClientProfile';

export const CLIENT_PROFILES: ClientProfile[] = [
    {
        id: 'epic7-pc',
        name: 'Epic Seven (PC Client)',
        windowTitlePattern: 'Epic Seven',  // Exact match
        layout: {
            offset: {
                x: { pixels: -8, percent: 0 },
                y: { pixels: 0, percent: 0 }
            },
            size: {
                width: { pixels: 0, percent: 100 },
                height: { pixels: 0, percent: 100 }
            }
        },
        enabled: true,
    },
    {
        id: 'bluestack',
        name: 'BlueStacks App Player',
        windowTitlePattern: 'Bluestacks App Player',  // Exact match
        layout: {
            offset: {
                x: { pixels: -8, percent: 0 },
                y: { pixels: 40, percent: 0 }               // Skip ~5% of window height (resizable title bar)
            },
            size: {
                width: { pixels: 0, percent: 100 },
                height: { pixels: -40, percent: 100 }             // Offset reduces layout height by 5%
            }
        },
        enabled: true,
    },
];

export const DEFAULT_CLIENT_PROFILE_ID = 'epic7-pc';
