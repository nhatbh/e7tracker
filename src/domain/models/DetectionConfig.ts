/**
 * Detection Configuration - Code-based OCR zone definitions
 * 
 * This file replaces the legacy ocr_zones.json configuration.
 * All zone coordinates are defined as percentages (0-100) and scale with window size.
 */

import { ScreenType, DetectionSlot } from './DetectionSchema';

/**
 * Zone coordinates defined as percentages (0-100) relative to window dimensions.
 * This allows the detection zones to scale properly across different resolutions.
 */
export interface ZoneCoordinates {
    x: number;  // X position as percentage (0-100)
    y: number;  // Y position as percentage (0-100)
    w: number;   // Width as percentage (0-100)
    h: number;   // Height as percentage (0-100)
}

/**
 * Screen zone configuration containing description and all available zones for that screen.
 */
export interface ScreenZoneConfig {
    description: string;
    zones: Partial<Record<DetectionSlot, ZoneCoordinates>>;
}

/**
 * Conversion helper to match the Zone interface expected by Rust backend.
 */
export interface Zone extends ZoneCoordinates { }

/**
 * Complete detection configuration for all supported screens.
 * 
 * Zones are defined in percentage coordinates to support resolution scaling.
 * The backend converts these to pixel coordinates based on the captured window size.
 */
export const DetectionConfig: Record<ScreenType, ScreenZoneConfig> = {
    [ScreenType.HeroStats]: {
        description: "Hero stats screen showing detailed statistics",
        zones: {
            [DetectionSlot.SelectedHero]: {
                x: 0.209,
                y: 0.556,
                w: 44.725,
                h: 7.037,
            },
            [DetectionSlot.StatsPanel]: {
                x: 19.261,
                y: 56.119,
                w: 5.896,
                h: 28.671,
            },
        },
    },

    [ScreenType.Lobby]: {
        description: "Main lobby screen",
        zones: {
            [DetectionSlot.SelectedHero]: {
                x: 50.0,
                y: 80.0,
                w: 15.0,
                h: 4.0,
            },
        },
    },

    [ScreenType.GuildWar]: {
        description: "Guild War screen",
        zones: {
            [DetectionSlot.SelectedHero]: {
                x: 50.0,
                y: 15.0,
                w: 20.0,
                h: 5.0,
            },
        },
    },
    [ScreenType.Unknown]: {
        description: "Unknown screen",
        zones: {},
    },
};

/**
 * Helper function to get zone coordinates for a specific screen and slot.
 * Returns undefined if the zone is not configured.
 */
export function getZoneForSlot(screen: ScreenType, slot: DetectionSlot): ZoneCoordinates | undefined {
    return DetectionConfig[screen]?.zones[slot];
}

/**
 * Helper function to check if a slot exists for a given screen.
 */
export function hasSlot(screen: ScreenType, slot: DetectionSlot): boolean {
    return slot in (DetectionConfig[screen]?.zones || {});
}

/**
 * Get all slots configured for a specific screen.
 */
export function getSlotsForScreen(screen: ScreenType): DetectionSlot[] {
    const zones = DetectionConfig[screen]?.zones || {};
    return Object.keys(zones) as DetectionSlot[];
}
