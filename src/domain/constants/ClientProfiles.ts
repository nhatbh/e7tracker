import { ClientProfile } from '../models/ClientProfile';

export const CLIENT_PROFILES: ClientProfile[] = [
    {
        id: 'epic7-pc',
        name: 'Epic Seven (PC Client)',
        windowTitlePattern: 'Epic Seven',  // Exact match
        offsetPixelsX: -8,
        offsetPercentageX: 0,
        offsetPixelsY: 0,
        offsetPercentageY: 0,
        enabled: true,
    },
    {
        id: 'bluestack',
        name: 'BlueStack App Player',
        windowTitlePattern: 'Bluestack App Player',  // Exact match
        offsetPixelsX: 0,
        offsetPercentageX: 0,
        offsetPixelsY: 0,
        offsetPercentageY: 5,               // Skip ~5% of window height (resizable title bar)
        enabled: true,
    },
];

export const DEFAULT_CLIENT_PROFILE_ID = 'epic7-pc';
